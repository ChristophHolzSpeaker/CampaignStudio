import type { PageRendererType } from '$lib/page-url';
import { createArtifactPreviewToken } from '$lib/server/artifacts/preview-token';
import { buildEmbedPreviewUrl } from '$lib/server/public-api/embed-token';

export function buildPagePreviewUrl(
	origin: string,
	page: { campaignPageId: number; slug: string; rendererType: PageRendererType }
): string {
	if (page.rendererType === 'sections') {
		return buildEmbedPreviewUrl(origin, page);
	}

	const previewUrl = new URL(`/artifact-preview/${page.campaignPageId}`, origin);
	previewUrl.searchParams.set('token', createArtifactPreviewToken(page.campaignPageId));
	return previewUrl.href;
}
