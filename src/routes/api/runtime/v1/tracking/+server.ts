import { json } from '@sveltejs/kit';
import { resolvePublishedCampaignPageContext } from '$lib/server/attribution/campaign-context';
import { getTrackingConfig } from '$lib/server/tracking/config';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ url }) => {
	const id = Number(url.searchParams.get('pageId'));
	if (!Number.isSafeInteger(id) || id < 1) return json({ ok: false }, { status: 400 });
	const page = await resolvePublishedCampaignPageContext({ campaignPageId: id });
	if (!page) return json({ ok: false }, { status: 404 });
	const config = await getTrackingConfig(page.campaignId);
	return json(
		{
			ok: true,
			data: {
				gtmContainerId: config.gtmContainerId,
				mappings: config.mappings.filter((m) => m.channel === 'browser')
			}
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
