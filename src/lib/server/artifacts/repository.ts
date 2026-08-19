import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
	ARTIFACT_ASSET_BUCKET,
	ARTIFACT_ENTRYPOINT,
	ARTIFACT_MAX_FILE_BYTES,
	ARTIFACT_MAX_FILE_COUNT,
	ARTIFACT_MAX_TOTAL_BYTES,
	ARTIFACT_SOURCE_BUCKET,
	artifactManifestSchema,
	isArtifactSlug,
	normalizeArtifactPath,
	type ArtifactManifest
} from '$lib/artifacts/contract';
import { db } from '$lib/server/db';
import {
	artifact_upload_files,
	artifact_upload_sessions,
	campaign_ad_groups,
	campaign_ad_packages,
	campaign_pages,
	campaigns,
	page_artifacts
} from '$lib/server/db/schema';
import {
	downloadArtifactSource,
	getArtifactAssetPublicUrl,
	removeArtifactObjects,
	uploadArtifactObject
} from './storage';
import {
	buildArtifactManifest,
	getArtifactContentHash,
	prepareArtifactFiles,
	sha256,
	type UploadedArtifactFile
} from './validation';

export type ArtifactPageRecord = {
	campaignId: number;
	campaignPageId: number;
	versionNumber: number;
	slug: string;
	sourcePath: string;
	manifest: ArtifactManifest;
	contentSha256: string;
	runtimeVersion: string;
};

export async function createArtifactUploadSession(input: { campaignId: number; slug: string }) {
	const [campaign] = await db
		.select({ id: campaigns.id })
		.from(campaigns)
		.where(eq(campaigns.id, input.campaignId))
		.limit(1);
	if (!campaign) throw new Error('Campaign not found');
	const [session] = await db
		.insert(artifact_upload_sessions)
		.values({
			campaign_id: input.campaignId,
			slug: input.slug,
			expires_at: new Date(Date.now() + 60 * 60 * 1000)
		})
		.returning({ id: artifact_upload_sessions.id, expiresAt: artifact_upload_sessions.expires_at });
	if (!session) throw new Error('Failed to create artifact upload session');
	return session;
}

export async function uploadArtifactSessionFile(input: {
	sessionId: string;
	path: string;
	mediaType: string;
	bytes: Uint8Array;
}) {
	const path = normalizeArtifactPath(input.path);
	if (input.bytes.byteLength === 0 || input.bytes.byteLength > ARTIFACT_MAX_FILE_BYTES)
		throw new Error('File size is outside the allowed range');
	const [session] = await db
		.select({
			status: artifact_upload_sessions.status,
			expiresAt: artifact_upload_sessions.expires_at
		})
		.from(artifact_upload_sessions)
		.where(eq(artifact_upload_sessions.id, input.sessionId))
		.limit(1);
	if (
		!session ||
		!['pending', 'uploaded'].includes(session.status) ||
		session.expiresAt.getTime() < Date.now()
	)
		throw new Error('Upload session is unavailable or expired');
	const existing = await db
		.select({ path: artifact_upload_files.path, byteSize: artifact_upload_files.byte_size })
		.from(artifact_upload_files)
		.where(eq(artifact_upload_files.upload_session_id, input.sessionId));
	if (existing.some((file) => file.path === path))
		throw new Error('A file already exists at this path');
	if (
		existing.length >= ARTIFACT_MAX_FILE_COUNT ||
		existing.reduce((sum, file) => sum + file.byteSize, 0) + input.bytes.byteLength >
			ARTIFACT_MAX_TOTAL_BYTES
	)
		throw new Error('Artifact bundle limit exceeded');
	const storagePath = `uploads/${input.sessionId}/${path}`;
	await uploadArtifactObject({
		bucket: ARTIFACT_SOURCE_BUCKET,
		path: storagePath,
		body: input.bytes,
		contentType: input.mediaType,
		cacheControl: '3600'
	});
	try {
		const [created] = await db
			.insert(artifact_upload_files)
			.values({
				upload_session_id: input.sessionId,
				path,
				media_type: input.mediaType,
				byte_size: input.bytes.byteLength,
				sha256: sha256(input.bytes),
				storage_path: storagePath
			})
			.returning({
				path: artifact_upload_files.path,
				mediaType: artifact_upload_files.media_type,
				byteSize: artifact_upload_files.byte_size,
				sha256: artifact_upload_files.sha256
			});
		await db
			.update(artifact_upload_sessions)
			.set({ status: 'uploaded', updated_at: new Date() })
			.where(eq(artifact_upload_sessions.id, input.sessionId));
		return created;
	} catch (error) {
		await removeArtifactObjects(ARTIFACT_SOURCE_BUCKET, [storagePath]);
		throw error;
	}
}

async function reserveArtifactPage(input: {
	campaignId: number;
	slug: string;
}): Promise<{ id: number; versionNumber: number }> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(${input.campaignId})`);
		const [latest] = await tx
			.select({ versionNumber: campaign_pages.version_number })
			.from(campaign_pages)
			.where(eq(campaign_pages.campaign_id, input.campaignId))
			.orderBy(desc(campaign_pages.version_number))
			.limit(1);
		const [page] = await tx
			.insert(campaign_pages)
			.values({
				campaign_id: input.campaignId,
				version_number: (latest?.versionNumber ?? 0) + 1,
				renderer_type: 'artifact',
				structured_content_json: null,
				slug: input.slug,
				change_note: 'Artifact upload'
			})
			.returning({ id: campaign_pages.id, versionNumber: campaign_pages.version_number });
		if (!page) throw new Error('Failed to reserve artifact page version');
		return page;
	});
}

export async function finalizeArtifactUploadSession(
	sessionId: string
): Promise<ArtifactPageRecord> {
	const [existingSession] = await db
		.select({
			status: artifact_upload_sessions.status,
			pageId: artifact_upload_sessions.finalized_campaign_page_id
		})
		.from(artifact_upload_sessions)
		.where(eq(artifact_upload_sessions.id, sessionId))
		.limit(1);
	if (existingSession?.status === 'finalized' && existingSession.pageId) {
		const existingPage = await getArtifactPageById(existingSession.pageId);
		if (existingPage) return existingPage;
	}
	const [claimed] = await db
		.update(artifact_upload_sessions)
		.set({ status: 'finalizing', error_json: null, updated_at: new Date() })
		.where(
			and(
				eq(artifact_upload_sessions.id, sessionId),
				inArray(artifact_upload_sessions.status, ['pending', 'uploaded'])
			)
		)
		.returning({
			campaignId: artifact_upload_sessions.campaign_id,
			slug: artifact_upload_sessions.slug,
			expiresAt: artifact_upload_sessions.expires_at
		});
	if (!claimed || claimed.expiresAt.getTime() < Date.now())
		throw new Error('Upload session is unavailable, expired, or already finalized');

	let pageId: number | null = null;
	const storedOutputs: Array<{ bucket: string; path: string }> = [];
	try {
		const rows = await db
			.select()
			.from(artifact_upload_files)
			.where(eq(artifact_upload_files.upload_session_id, sessionId));
		const files: UploadedArtifactFile[] = await Promise.all(
			rows.map(async (row) => ({
				path: row.path,
				mediaType: row.media_type,
				byteSize: row.byte_size,
				sha256: row.sha256,
				bytes: await downloadArtifactSource(row.storage_path)
			}))
		);
		const rawHash = getArtifactContentHash(buildArtifactManifest(files));
		const page = await reserveArtifactPage({ campaignId: claimed.campaignId, slug: claimed.slug });
		pageId = page.id;
		const prefix = `${claimed.campaignId}/${page.id}/${rawHash}`;
		const prepared = prepareArtifactFiles({
			files,
			assetPublicUrl: (path) => getArtifactAssetPublicUrl(`${prefix}/${path}`)
		});

		for (const file of prepared.files.filter((entry) => entry.path !== ARTIFACT_ENTRYPOINT)) {
			const path = `${prefix}/${file.path}`;
			await uploadArtifactObject({
				bucket: ARTIFACT_ASSET_BUCKET,
				path,
				body: file.bytes,
				contentType: file.mediaType,
				cacheControl: '31536000'
			});
			storedOutputs.push({ bucket: ARTIFACT_ASSET_BUCKET, path });
		}
		const entry = prepared.files.find((file) => file.path === ARTIFACT_ENTRYPOINT);
		if (!entry) throw new Error('Prepared artifact has no entrypoint');
		const sourcePath = `${prefix}/${ARTIFACT_ENTRYPOINT}`;
		await uploadArtifactObject({
			bucket: ARTIFACT_SOURCE_BUCKET,
			path: sourcePath,
			body: entry.bytes,
			contentType: entry.mediaType,
			cacheControl: '60'
		});
		storedOutputs.push({ bucket: ARTIFACT_SOURCE_BUCKET, path: sourcePath });
		const manifestPath = `${prefix}/manifest.json`;
		await uploadArtifactObject({
			bucket: ARTIFACT_SOURCE_BUCKET,
			path: manifestPath,
			body: JSON.stringify(prepared.manifest),
			contentType: 'application/json',
			cacheControl: '31536000'
		});
		storedOutputs.push({ bucket: ARTIFACT_SOURCE_BUCKET, path: manifestPath });

		await db.transaction(async (tx) => {
			await tx.insert(page_artifacts).values({
				campaign_page_id: page.id,
				source_bucket: ARTIFACT_SOURCE_BUCKET,
				source_path: sourcePath,
				asset_bucket: ARTIFACT_ASSET_BUCKET,
				asset_prefix: prefix,
				entrypoint: ARTIFACT_ENTRYPOINT,
				manifest_json: prepared.manifest,
				content_sha256: prepared.contentSha256
			});
			await tx
				.update(artifact_upload_sessions)
				.set({ status: 'finalized', finalized_campaign_page_id: page.id, updated_at: new Date() })
				.where(eq(artifact_upload_sessions.id, sessionId));
		});
		return {
			campaignId: claimed.campaignId,
			campaignPageId: page.id,
			versionNumber: page.versionNumber,
			slug: claimed.slug,
			sourcePath,
			manifest: prepared.manifest,
			contentSha256: prepared.contentSha256,
			runtimeVersion: prepared.manifest.runtimeVersion
		};
	} catch (error) {
		for (const bucket of [ARTIFACT_SOURCE_BUCKET, ARTIFACT_ASSET_BUCKET]) {
			await removeArtifactObjects(
				bucket,
				storedOutputs.filter((item) => item.bucket === bucket).map((item) => item.path)
			).catch(() => undefined);
		}
		if (pageId)
			await db
				.delete(campaign_pages)
				.where(eq(campaign_pages.id, pageId))
				.catch(() => undefined);
		await db
			.update(artifact_upload_sessions)
			.set({
				status: 'failed',
				error_json: { message: error instanceof Error ? error.message : 'Finalization failed' },
				updated_at: new Date()
			})
			.where(eq(artifact_upload_sessions.id, sessionId));
		throw error;
	}
}

function toArtifactPageRecord(row: {
	campaignId: number;
	campaignPageId: number;
	versionNumber: number;
	slug: string;
	sourcePath: string;
	manifest: unknown;
	contentSha256: string;
	runtimeVersion: string;
}): ArtifactPageRecord {
	return { ...row, manifest: artifactManifestSchema.parse(row.manifest) };
}

const artifactPageSelection = {
	campaignId: campaign_pages.campaign_id,
	campaignPageId: campaign_pages.id,
	versionNumber: campaign_pages.version_number,
	slug: campaign_pages.slug,
	sourcePath: page_artifacts.source_path,
	manifest: page_artifacts.manifest_json,
	contentSha256: page_artifacts.content_sha256,
	runtimeVersion: page_artifacts.runtime_version
};

export async function getPublishedArtifactPage(slug: string): Promise<ArtifactPageRecord | null> {
	const [row] = await db
		.select(artifactPageSelection)
		.from(campaign_pages)
		.innerJoin(page_artifacts, eq(page_artifacts.campaign_page_id, campaign_pages.id))
		.innerJoin(campaigns, eq(campaigns.id, campaign_pages.campaign_id))
		.where(
			and(
				eq(campaign_pages.slug, slug),
				eq(campaign_pages.renderer_type, 'artifact'),
				eq(campaign_pages.is_published, true),
				eq(campaigns.status, 'published')
			)
		)
		.limit(1);
	return row ? toArtifactPageRecord(row) : null;
}

export async function getPublishedArtifactPageById(
	campaignPageId: number
): Promise<ArtifactPageRecord | null> {
	const [row] = await db
		.select(artifactPageSelection)
		.from(campaign_pages)
		.innerJoin(page_artifacts, eq(page_artifacts.campaign_page_id, campaign_pages.id))
		.innerJoin(campaigns, eq(campaigns.id, campaign_pages.campaign_id))
		.where(
			and(
				eq(campaign_pages.id, campaignPageId),
				eq(campaign_pages.renderer_type, 'artifact'),
				eq(campaign_pages.is_published, true),
				eq(campaigns.status, 'published')
			)
		)
		.limit(1);
	return row ? toArtifactPageRecord(row) : null;
}

export async function getArtifactPageById(
	campaignPageId: number
): Promise<ArtifactPageRecord | null> {
	const [row] = await db
		.select(artifactPageSelection)
		.from(campaign_pages)
		.innerJoin(page_artifacts, eq(page_artifacts.campaign_page_id, campaign_pages.id))
		.where(and(eq(campaign_pages.id, campaignPageId), eq(campaign_pages.renderer_type, 'artifact')))
		.limit(1);
	return row ? toArtifactPageRecord(row) : null;
}

export async function publishArtifactPage(campaignPageId: number): Promise<ArtifactPageRecord> {
	const candidate = await getArtifactPageById(campaignPageId);
	if (!candidate || !isArtifactSlug(candidate.slug))
		throw new Error('Artifact page version or slug is invalid');
	await readVerifiedArtifactHtml(candidate);
	return db.transaction(async (tx) => {
		const [target] = await tx
			.select(artifactPageSelection)
			.from(campaign_pages)
			.innerJoin(page_artifacts, eq(page_artifacts.campaign_page_id, campaign_pages.id))
			.where(
				and(eq(campaign_pages.id, campaignPageId), eq(campaign_pages.renderer_type, 'artifact'))
			)
			.limit(1);
		if (!target) throw new Error('Artifact page version not found');
		await tx.execute(sql`select pg_advisory_xact_lock(${target.campaignId})`);
		await tx
			.update(campaign_pages)
			.set({ is_published: false, published_at: null, updated_at: new Date() })
			.where(eq(campaign_pages.campaign_id, target.campaignId));
		await tx
			.update(campaign_pages)
			.set({ is_published: true, published_at: new Date(), updated_at: new Date() })
			.where(eq(campaign_pages.id, campaignPageId));
		await tx
			.update(campaigns)
			.set({ status: 'published', updated_at: new Date() })
			.where(eq(campaigns.id, target.campaignId));
		const [adPackage] = await tx
			.select({ id: campaign_ad_packages.id })
			.from(campaign_ad_packages)
			.where(eq(campaign_ad_packages.campaign_id, target.campaignId))
			.orderBy(desc(campaign_ad_packages.version_number))
			.limit(1);
		if (adPackage)
			await tx
				.update(campaign_ad_groups)
				.set({ campaign_page_id: campaignPageId, updated_at: new Date() })
				.where(eq(campaign_ad_groups.ad_package_id, adPackage.id));
		return toArtifactPageRecord(target);
	});
}

export async function unpublishArtifactPage(campaignPageId: number): Promise<ArtifactPageRecord> {
	return db.transaction(async (tx) => {
		const [target] = await tx
			.select(artifactPageSelection)
			.from(campaign_pages)
			.innerJoin(page_artifacts, eq(page_artifacts.campaign_page_id, campaign_pages.id))
			.where(
				and(eq(campaign_pages.id, campaignPageId), eq(campaign_pages.renderer_type, 'artifact'))
			)
			.limit(1);
		if (!target) throw new Error('Artifact page version not found');
		await tx.execute(sql`select pg_advisory_xact_lock(${target.campaignId})`);
		await tx
			.update(campaign_pages)
			.set({ is_published: false, published_at: null, updated_at: new Date() })
			.where(and(eq(campaign_pages.id, campaignPageId), eq(campaign_pages.is_published, true)));
		await tx
			.update(campaigns)
			.set({ status: 'draft', updated_at: new Date() })
			.where(eq(campaigns.id, target.campaignId));
		return toArtifactPageRecord(target);
	});
}

export async function readVerifiedArtifactHtml(page: ArtifactPageRecord): Promise<string> {
	const entry = page.manifest.files.find((file) => file.path === page.manifest.entrypoint);
	if (!entry || entry.byteSize > ARTIFACT_MAX_FILE_BYTES)
		throw new Error('Artifact entrypoint manifest is invalid');
	const bytes = await downloadArtifactSource(page.sourcePath);
	if (bytes.byteLength !== entry.byteSize || sha256(bytes) !== entry.sha256)
		throw new Error('Artifact entrypoint integrity check failed');
	return new TextDecoder().decode(bytes);
}
