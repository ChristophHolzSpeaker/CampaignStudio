import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { ARTIFACT_ASSET_BUCKET, ARTIFACT_SOURCE_BUCKET } from '$lib/artifacts/contract';

let artifactStorageClient: SupabaseClient | null = null;

function getStorageUrl(): string {
	const value = env.SUPABASE_URL?.trim();
	if (!value) throw new Error('SUPABASE_URL is not configured');
	return value;
}

export function getArtifactStorageClient(): SupabaseClient {
	if (artifactStorageClient) return artifactStorageClient;
	const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
	if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');

	artifactStorageClient = createClient(getStorageUrl(), key, {
		auth: { autoRefreshToken: false, persistSession: false }
	});
	return artifactStorageClient;
}

export async function uploadArtifactObject(input: {
	bucket: string;
	path: string;
	body: Uint8Array | string;
	contentType: string;
	cacheControl?: string;
}): Promise<void> {
	const { error } = await getArtifactStorageClient()
		.storage.from(input.bucket)
		.upload(input.path, input.body, {
			contentType: input.contentType,
			cacheControl: input.cacheControl,
			upsert: false
		});
	if (error) throw new Error(`Artifact storage upload failed: ${error.message}`);
}

export async function downloadArtifactSource(path: string): Promise<Uint8Array> {
	const { data, error } = await getArtifactStorageClient()
		.storage.from(ARTIFACT_SOURCE_BUCKET)
		.download(path);
	if (error || !data)
		throw new Error(`Artifact source download failed: ${error?.message ?? 'missing object'}`);
	return new Uint8Array(await data.arrayBuffer());
}

export function getArtifactAssetPublicUrl(path: string): string {
	return getArtifactStorageClient().storage.from(ARTIFACT_ASSET_BUCKET).getPublicUrl(path).data
		.publicUrl;
}

export function getArtifactAssetPublicOrigin(): string {
	return new URL(getStorageUrl()).origin;
}

export async function removeArtifactObjects(bucket: string, paths: string[]): Promise<void> {
	if (paths.length === 0) return;
	const { error } = await getArtifactStorageClient().storage.from(bucket).remove(paths);
	if (error) throw new Error(`Artifact storage cleanup failed: ${error.message}`);
}
