import { z } from 'zod';
import { ARTIFACT_AUTHORING_CONTRACT } from '$lib/artifacts/authoring-contract';
import { artifactSlugSchema } from '$lib/artifacts/contract';
import { createArtifactUploadSession } from '$lib/server/artifacts/repository';
import { publicApiJson, requirePublicApiWriteRequest } from '$lib/server/public-api/http';
import type { RequestHandler } from './$types';

const requestSchema = z.object({ slug: artifactSlugSchema });

export const POST: RequestHandler = async ({ request, params, url }) => {
	const guard = await requirePublicApiWriteRequest(request);
	if (!guard.ok) return guard.response;
	const campaignId = Number(params.id);
	if (!Number.isInteger(campaignId) || campaignId <= 0)
		return publicApiJson({ ok: false, error: 'Campaign ID is invalid' }, guard.context, {
			status: 400
		});
	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		return publicApiJson({ ok: false, error: 'Request body must be valid JSON' }, guard.context, {
			status: 400
		});
	}
	const parsed = requestSchema.safeParse(raw);
	if (!parsed.success)
		return publicApiJson(
			{ ok: false, error: 'Invalid artifact version request', issues: parsed.error.issues },
			guard.context,
			{ status: 400 }
		);
	try {
		const session = await createArtifactUploadSession({ campaignId, slug: parsed.data.slug });
		return publicApiJson(
			{
				ok: true,
				data: {
					artifactVersionId: session.id,
					expiresAt: session.expiresAt,
					constraints: ARTIFACT_AUTHORING_CONTRACT.bundle.limits,
					uploadTemplate: new URL(
						`/api/public/v1/artifact-versions/${session.id}/files/{path}`,
						url.origin
					).href,
					finalizeUrl: new URL(
						`/api/public/v1/artifact-versions/${session.id}/finalize`,
						url.origin
					).href
				}
			},
			guard.context,
			{ status: 201 }
		);
	} catch (error) {
		return publicApiJson(
			{
				ok: false,
				error: error instanceof Error ? error.message : 'Failed to create upload session'
			},
			guard.context,
			{ status: 404 }
		);
	}
};
