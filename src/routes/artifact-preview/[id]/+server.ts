import { error } from '@sveltejs/kit';
import { verifyArtifactPreviewToken } from '$lib/server/artifacts/preview-token';
import { artifactResponseHeaders, injectArtifactRuntime } from '$lib/server/artifacts/render';
import { getArtifactPageById, readVerifiedArtifactHtml } from '$lib/server/artifacts/repository';
import { getArtifactAssetPublicOrigin } from '$lib/server/artifacts/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const campaignPageId = Number(params.id);
	if (
		!Number.isInteger(campaignPageId) ||
		!verifyArtifactPreviewToken(url.searchParams.get('token'), campaignPageId)
	)
		throw error(404, 'Artifact preview not found');
	const page = await getArtifactPageById(campaignPageId);
	if (!page) throw error(404, 'Artifact preview not found');
	return new Response(injectArtifactRuntime(await readVerifiedArtifactHtml(page), page, true), {
		headers: artifactResponseHeaders(page, true, getArtifactAssetPublicOrigin())
	});
};
