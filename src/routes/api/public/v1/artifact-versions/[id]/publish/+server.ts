import { publishArtifactPage } from '$lib/server/artifacts/repository';
import { publicApiJson, requirePublicApiWriteRequest } from '$lib/server/public-api/http';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, url }) => {
	const guard = await requirePublicApiWriteRequest(request);
	if (!guard.ok) return guard.response;
	const campaignPageId = Number(params.id);
	if (!Number.isInteger(campaignPageId) || campaignPageId <= 0)
		return publicApiJson({ ok: false, error: 'Artifact version ID is invalid' }, guard.context, {
			status: 400
		});
	try {
		const page = await publishArtifactPage(campaignPageId);
		return publicApiJson(
			{
				ok: true,
				data: {
					campaignId: page.campaignId,
					campaignPageId: page.campaignPageId,
					versionNumber: page.versionNumber,
					slug: page.slug,
					liveUrl: new URL(`/${page.slug}`, url.origin).href
				}
			},
			guard.context
		);
	} catch (error) {
		return publicApiJson(
			{ ok: false, error: error instanceof Error ? error.message : 'Artifact publication failed' },
			guard.context,
			{ status: 404 }
		);
	}
};
