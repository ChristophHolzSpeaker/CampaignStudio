import { createArtifactPreviewToken } from '$lib/server/artifacts/preview-token';
import { finalizeArtifactUploadSession } from '$lib/server/artifacts/repository';
import { publicApiJson, requirePublicApiWriteRequest } from '$lib/server/public-api/http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, url }) => {
	const guard = await requirePublicApiWriteRequest(request);
	if (!guard.ok) return guard.response;
	try {
		const page = await finalizeArtifactUploadSession(params.id);
		const previewUrl = new URL(`/artifact-preview/${page.campaignPageId}`, url.origin);
		previewUrl.searchParams.set('token', createArtifactPreviewToken(page.campaignPageId));
		return publicApiJson(
			{
				ok: true,
				data: {
					campaignId: page.campaignId,
					campaignPageId: page.campaignPageId,
					versionNumber: page.versionNumber,
					slug: page.slug,
					previewUrl: previewUrl.href,
					publishUrl: new URL(
						`/api/public/v1/artifact-versions/${page.campaignPageId}/publish`,
						url.origin
					).href
				}
			},
			guard.context
		);
	} catch (error) {
		return publicApiJson(
			{ ok: false, error: error instanceof Error ? error.message : 'Artifact finalization failed' },
			guard.context,
			{ status: 400 }
		);
	}
};
