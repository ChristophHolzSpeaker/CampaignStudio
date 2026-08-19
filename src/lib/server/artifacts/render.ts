import type { ArtifactPageRecord } from './repository';
import { createBookingWidgetToken } from './widget-token';

const ARTIFACT_RENDERER_REVISION = 'r2';

type ArtifactPublicContext = {
	runtimeVersion: string;
	campaignId: number;
	campaignPageId: number;
	versionId: number;
	slug: string;
	preview: boolean;
	endpoints: {
		visits: string;
		engagement: string;
		cta: string;
		leadIntake: string;
		bookingWidget: string;
	};
	widgetUrls: { bookingCalendar: string | null };
};

function serializeInertJson(value: unknown): string {
	return JSON.stringify(value).replace(
		/[<>&\u2028\u2029]/g,
		(character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
	);
}

export function injectArtifactRuntime(
	html: string,
	page: ArtifactPageRecord,
	preview: boolean
): string {
	const context: ArtifactPublicContext = {
		runtimeVersion: page.runtimeVersion,
		campaignId: page.campaignId,
		campaignPageId: page.campaignPageId,
		versionId: page.versionNumber,
		slug: page.slug,
		preview,
		endpoints: {
			visits: '/api/runtime/v1/visits',
			engagement: '/api/runtime/v1/visits/engagement',
			cta: '/api/attribution/cta',
			leadIntake: '/api/runtime/v1/forms/lead-intake',
			bookingWidget: '/api/runtime/v1/widgets/booking'
		},
		widgetUrls: {
			bookingCalendar: preview
				? `/widgets/booking?context=${encodeURIComponent(createBookingWidgetToken(page, true))}`
				: null
		}
	};
	const fontStylesheet = `<link rel="stylesheet" href="/campaign-runtime/fonts/${page.runtimeVersion}.css" data-cs-platform-fonts>`;
	const injection = `<script id="cs-page-context" type="application/json">${serializeInertJson(context)}</script><script src="/campaign-runtime/${page.runtimeVersion}.js" defer></script>`;
	const documentWithFonts = /<\/head\s*>/i.test(html)
		? html.replace(/<\/head\s*>/i, `${fontStylesheet}</head>`)
		: `${fontStylesheet}${html}`;
	if (/<\/body\s*>/i.test(documentWithFonts))
		return documentWithFonts.replace(/<\/body\s*>/i, `${injection}</body>`);
	return `${documentWithFonts}${injection}`;
}

function normalizeCspOrigin(value: string): string {
	const url = new URL(value);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error('Artifact asset origin must use HTTP or HTTPS');
	}
	return url.origin;
}

export function artifactResponseHeaders(
	page: ArtifactPageRecord,
	preview: boolean,
	assetOrigin: string
): HeadersInit {
	const publicAssetOrigin = normalizeCspOrigin(assetOrigin);
	return {
		'Content-Type': 'text/html; charset=utf-8',
		'Cache-Control': preview
			? 'private, no-store'
			: 'public, s-maxage=60, stale-while-revalidate=300',
		ETag: `"${page.contentSha256}-${page.runtimeVersion}-${ARTIFACT_RENDERER_REVISION}"`,
		'Content-Security-Policy': `default-src 'none'; base-uri 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https: ${publicAssetOrigin}; img-src 'self' data: blob: https: ${publicAssetOrigin}; font-src 'self' data: https: ${publicAssetOrigin}; media-src 'self' blob: https: ${publicAssetOrigin}; connect-src 'self'; form-action 'self'; frame-src 'self'; frame-ancestors 'none'`,
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY',
		...(preview ? { 'X-Robots-Tag': 'noindex, nofollow' } : {})
	};
}
