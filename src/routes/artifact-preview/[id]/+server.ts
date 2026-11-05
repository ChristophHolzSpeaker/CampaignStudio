import { error } from '@sveltejs/kit';
import { verifyArtifactPreviewToken } from '$lib/server/artifacts/preview-token';
import { artifactResponseHeaders, injectArtifactRuntime } from '$lib/server/artifacts/render';
import { getArtifactPageById, readVerifiedArtifactHtml } from '$lib/server/artifacts/repository';
import { getArtifactAssetPublicOrigin } from '$lib/server/artifacts/storage';
import { getTrackingConfig } from '$lib/server/tracking/config';
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
	const config = ['v6', 'v7', 'v8', 'v9', 'v10'].includes(page.runtimeVersion)
		? await getTrackingConfig(page.campaignId)
		: null;
	return new Response(
		injectArtifactRuntime(
			await readVerifiedArtifactHtml(page),
			page,
			true,
			false,
			config?.consentBannerLinks
		),
		{
			headers: artifactResponseHeaders(page, true, getArtifactAssetPublicOrigin())
		}
	);
};
