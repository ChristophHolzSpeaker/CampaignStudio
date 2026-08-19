export type PageRendererType = 'sections' | 'artifact';

export function buildLivePageUrl(
	origin: string,
	slug: string,
	rendererType: PageRendererType
): string {
	return new URL(rendererType === 'artifact' ? `/${slug}` : `/speaker/${slug}`, origin).href;
}
