import { unpublishArtifactPage } from '$lib/server/artifacts/repository';
import { publicApiJson, requirePublicApiWriteRequest } from '$lib/server/public-api/http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params }) => {
	const guard = await requirePublicApiWriteRequest(request);
	if (!guard.ok) return guard.response;
	const campaignPageId = Number(params.id);
	if (!Number.isInteger(campaignPageId) || campaignPageId <= 0)
		return publicApiJson({ ok: false, error: 'Artifact version ID is invalid' }, guard.context, {
			status: 400
		});
	try {
		const page = await unpublishArtifactPage(campaignPageId);
		return publicApiJson(
			{
				ok: true,
				data: {
					campaignId: page.campaignId,
					campaignPageId: page.campaignPageId,
					slug: page.slug,
					liveUrl: null
				}
			},
			guard.context
		);
	} catch (error) {
		return publicApiJson(
			{ ok: false, error: error instanceof Error ? error.message : 'Artifact unpublish failed' },
			guard.context,
			{ status: 404 }
		);
	}
};
