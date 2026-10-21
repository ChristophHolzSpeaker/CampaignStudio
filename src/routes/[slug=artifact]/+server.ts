import { getTrackingConfig } from '$lib/server/tracking/config';
import { readBrowserConsent } from '$lib/server/tracking/browser-consent';
import { error } from '@sveltejs/kit';
import { artifactResponseHeaders, injectArtifactRuntime } from '$lib/server/artifacts/render';
import {
	getPublishedArtifactPage,
	readVerifiedArtifactHtml
} from '$lib/server/artifacts/repository';
import { getArtifactAssetPublicOrigin } from '$lib/server/artifacts/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, request, cookies }) => {
	const page = await getPublishedArtifactPage(params.slug);
	if (!page) throw error(404, 'Artifact page not found');
	const headers = artifactResponseHeaders(page, false, getArtifactAssetPublicOrigin());
	if (
		new Headers(headers).has('etag') &&
		request.headers.get('if-none-match') === new Headers(headers).get('etag')
	)
		return new Response(null, { status: 304, headers });
	try {
		const policy =
			page.runtimeVersion === 'v6' ? (await getTrackingConfig(page.campaignId)).consent : null;
		const remembered = policy ? Boolean(readBrowserConsent(cookies, policy)) : false;
		return new Response(
			injectArtifactRuntime(await readVerifiedArtifactHtml(page), page, false, remembered),
			{
				headers
			}
		);
	} catch (cause) {
		console.error('artifact_render_failed', { campaignPageId: page.campaignPageId, cause });
		throw error(503, 'Artifact page is temporarily unavailable');
	}
};
