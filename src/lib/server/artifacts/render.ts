import {
	renderConsentBanner,
	consentBannerStyle,
	floatingConsentBannerStyle
} from './consent-banner';
import type { ArtifactPageRecord } from './repository';
import type { ConsentBannerLinks } from '$lib/tracking/contract';
import { createBookingWidgetToken } from './widget-token';

const ARTIFACT_RENDERER_REVISION = 'r7';
const CONSENT_RUNTIME_VERSIONS = ['v6', 'v7', 'v8', 'v9', 'v10'];

export function artifactRuntimeScriptUrl(version: string): string {
	// The scripts are cached immutably. The new banner needs the matching handlers.
	const revision = CONSENT_RUNTIME_VERSIONS.includes(version) ? '?revision=explicit-consent-1' : '';
	return `/campaign-runtime/${version}.js${revision}`;
}

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

// A page ID is assigned after an artifact is uploaded. Bind the documented
// generic address to that version before consent or browser scripts run.
function renderV10PageEmailAlias(html: string, pageId: number): string {
	const address = `speakerlp+${pageId}@christophholz.com`;
	return html
		.replace(/(\s+href\s*=\s*["']mailto:)speakerlp@christophholz\.com(?=[?"'#])/gi, `$1${address}`)
		.replace(
			/(\s+aria-label\s*=\s*"[^"]*)speakerlp@christophholz\.com(?=[^"]*")/gi,
			`$1${address}`
		);
}

export function injectArtifactRuntime(
	html: string,
	page: ArtifactPageRecord,
	preview: boolean,
	consentInitiallyHidden = false,
	consentBannerLinks?: ConsentBannerLinks
): string {
	if (page.runtimeVersion === 'v10') html = renderV10PageEmailAlias(html, page.campaignPageId);
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
	const hasConsent = CONSENT_RUNTIME_VERSIONS.includes(page.runtimeVersion);
	const emailHelper =
		preview || hasConsent ? '' : '<script src="/campaign-runtime/email-v1.js" defer></script>';
	let banner = hasConsent ? renderConsentBanner(consentBannerLinks) : '';
	if (consentInitiallyHidden && !preview)
		banner = banner.replace('id="cs-consent"', 'id="cs-consent" hidden');
	const bannerStyle = hasConsent
		? page.runtimeVersion === 'v6'
			? consentBannerStyle
			: floatingConsentBannerStyle
		: '';
	const injection = `${banner}<script id="cs-page-context" type="application/json">${serializeInertJson(context)}</script><script src="${artifactRuntimeScriptUrl(page.runtimeVersion)}" defer></script>${emailHelper}`;
	const documentWithFonts = /<\/head\s*>/i.test(html)
		? html.replace(/<\/head\s*>/i, `${fontStylesheet}${bannerStyle}</head>`)
		: `${fontStylesheet}${bannerStyle}${html}`;
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
	const frameAncestors = preview ? '*' : "'none'";
	const hasConsent = CONSENT_RUNTIME_VERSIONS.includes(page.runtimeVersion);
	return {
		'Content-Type': 'text/html; charset=utf-8',
		'Cache-Control':
			preview || hasConsent
				? 'private, no-store'
				: 'public, s-maxage=60, stale-while-revalidate=300',
		...(hasConsent
			? {}
			: { ETag: `"${page.contentSha256}-${page.runtimeVersion}-${ARTIFACT_RENDERER_REVISION}"` }),
		'Content-Security-Policy': `default-src 'none'; base-uri 'none'; object-src 'none'; script-src 'self' https://www.youtube.com${['v5', 'v6', 'v7', 'v8', 'v9', 'v10'].includes(page.runtimeVersion) && !preview ? ' https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com' : ''}; style-src 'self' 'unsafe-inline' https: ${publicAssetOrigin}; img-src 'self' data: blob: https: ${publicAssetOrigin}; font-src 'self' data: https: ${publicAssetOrigin}; media-src 'self' blob: https: ${publicAssetOrigin}; connect-src 'self'${['v5', 'v6', 'v7', 'v8', 'v9', 'v10'].includes(page.runtimeVersion) && !preview ? ' https://pagead2.googlesyndication.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com https://www.google.de https://*.doubleclick.net' : ''}; form-action 'self'; frame-src 'self' https://www.youtube-nocookie.com${['v5', 'v6', 'v7', 'v8', 'v9', 'v10'].includes(page.runtimeVersion) && !preview ? ' https://www.googletagmanager.com https://td.doubleclick.net https://www.google.com' : ''}; frame-ancestors ${frameAncestors}`,
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
		'X-Content-Type-Options': 'nosniff',
		...(preview ? {} : { 'X-Frame-Options': 'DENY' }),
		...(preview ? { 'X-Robots-Tag': 'noindex, nofollow' } : {})
	};
}
