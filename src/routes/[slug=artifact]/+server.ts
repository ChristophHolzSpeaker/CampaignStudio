import { error } from '@sveltejs/kit';
import { artifactResponseHeaders, injectArtifactRuntime } from '$lib/server/artifacts/render';
import {
	getPublishedArtifactPage,
	readVerifiedArtifactHtml
} from '$lib/server/artifacts/repository';
import { getArtifactAssetPublicOrigin } from '$lib/server/artifacts/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, request }) => {
	const page = await getPublishedArtifactPage(params.slug);
	if (!page) throw error(404, 'Artifact page not found');
	const headers = artifactResponseHeaders(page, false, getArtifactAssetPublicOrigin());
	if (request.headers.get('if-none-match') === new Headers(headers).get('etag'))
		return new Response(null, { status: 304, headers });
	try {
		return new Response(injectArtifactRuntime(await readVerifiedArtifactHtml(page), page, false), {
			headers
		});
	} catch (cause) {
		console.error('artifact_render_failed', { campaignPageId: page.campaignPageId, cause });
		throw error(503, 'Artifact page is temporarily unavailable');
	}
};
