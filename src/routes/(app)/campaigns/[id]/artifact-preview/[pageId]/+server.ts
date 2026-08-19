import { error } from '@sveltejs/kit';
import { artifactResponseHeaders, injectArtifactRuntime } from '$lib/server/artifacts/render';
import { getArtifactPageById, readVerifiedArtifactHtml } from '$lib/server/artifacts/repository';
import { getArtifactAssetPublicOrigin } from '$lib/server/artifacts/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const campaignId = Number(params.id);
	const campaignPageId = Number(params.pageId);
	if (!Number.isInteger(campaignId) || !Number.isInteger(campaignPageId)) {
		throw error(404, 'Artifact preview not found');
	}

	const page = await getArtifactPageById(campaignPageId);
	if (!page || page.campaignId !== campaignId) {
		throw error(404, 'Artifact preview not found');
	}

	return new Response(injectArtifactRuntime(await readVerifiedArtifactHtml(page), page, true), {
		headers: artifactResponseHeaders(page, true, getArtifactAssetPublicOrigin())
	});
};
