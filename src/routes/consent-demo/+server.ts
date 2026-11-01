import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import {
	consentBannerMarkup,
	floatingConsentBannerStyle
} from '$lib/server/artifacts/consent-banner';
import type { RequestHandler } from './$types';

// A measurement-free preview using the same markup, CSS and runtime as v7 artifacts.
export const GET: RequestHandler = ({ url }) => {
	if (!dev && url.hostname !== 'campaign-studio-staging.vercel.app') throw error(404);
	const context = JSON.stringify({
		runtimeVersion: 'v7',
		campaignId: 0,
		campaignPageId: 0,
		slug: 'consent-demo',
		preview: true,
		endpoints: {},
		widgetUrls: {}
	});
	return new Response(
		`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cookie-Banner – Vorschau</title>
<link rel="stylesheet" href="/campaign-runtime/fonts/v7.css">
<style>
*{box-sizing:border-box}body{margin:0;color:#171719;background:#f7f5f0;font-family:var(--cs-font-sans,Arial,sans-serif)}header{display:flex;justify-content:space-between;align-items:center;padding:22px clamp(20px,6vw,90px);background:#fff}header strong{font-size:20px;letter-spacing:-.04em}header span{font-size:12px;letter-spacing:.12em;text-transform:uppercase}.hero{min-height:620px;display:grid;grid-template-columns:1fr 1fr}.copy{padding:clamp(42px,8vw,120px) clamp(20px,6vw,90px);align-self:center}.eyebrow{text-transform:uppercase;font-size:13px;letter-spacing:.12em;color:#bd1230;font-weight:bold}h1{font-family:var(--cs-font-display,Arial,sans-serif);font-size:clamp(52px,7vw,100px);line-height:.91;letter-spacing:-.045em;text-transform:uppercase;margin:22px 0}p{line-height:1.55;font-size:18px;max-width:520px}.cta{display:inline-block;margin-top:18px;padding:16px 24px;background:#e2183b;color:white;text-decoration:none;text-transform:uppercase;font-weight:bold}.photo{min-height:420px;background:center/cover url('/christoph-holz-on-stage-engaging-cheering-audience-bow-tie.webp')}footer{padding:28px clamp(20px,6vw,90px);background:#171719;color:white;display:flex;gap:24px;flex-wrap:wrap;font-size:14px}footer button{font:inherit;border:0;background:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0}@media(max-width:700px){.hero{grid-template-columns:1fr}.photo{min-height:340px}.copy{padding-top:55px;padding-bottom:55px}}
</style>${floatingConsentBannerStyle}</head><body><header><strong>CHRISTOPH HOLZ</strong><span>Staging-Vorschau</span></header><main><section class="hero"><div class="copy"><div class="eyebrow">Keynote Speaker · Zukunft &amp; Digitalisierung</div><h1>Die Zukunft<br>beginnt jetzt.</h1><p>Inspiration für Menschen, die Veränderung gestalten. Eine Beispielseite, um das Cookie-Banner im Kontext zu erleben.</p><a class="cta" href="#kontakt">Keynote anfragen</a></div><div class="photo" role="img" aria-label="Christoph Holz auf der Bühne"></div></section></main><footer id="kontakt"><span>Vorschau – keine Daten werden gesendet.</span><button type="button" data-cs-consent-open>Cookie-Einstellungen</button><a href="/consent-demo" style="color:inherit">Banner erneut ansehen</a></footer>${consentBannerMarkup}<script id="cs-page-context" type="application/json">${context}</script><script src="/campaign-runtime/v7.js" defer></script></body></html>`,
		{
			headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
		}
	);
};
