import { runInNewContext } from 'node:vm';
import consentTemplate from '$lib/artifacts/google-consent-v6.tpl?raw';
import { Window, HTMLElement, HTMLInputElement } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';
import { consentBannerMarkup } from '$lib/server/artifacts/consent-banner';

const windows: Window[] = [];
afterEach(async () => {
	await Promise.all(windows.splice(0).map((w) => w.happyDOM.close()));
});
type Settings = {
	mode?: 'basic' | 'advanced';
	policyVersion?: string;
	ownMeasurement?: 'statistics' | 'necessary';
};
async function mount(
	options: {
		preview?: boolean;
		settings?: Settings;
		cookie?: Record<string, unknown>;
		deferVisit?: boolean;
		deferTracking?: boolean;
		failConsent?: boolean;
		template?: boolean;
		youtube?: boolean;
	} = {}
) {
	const win = new Window({ url: 'https://example.com/landing?gclid=test' });
	windows.push(win);
	const context = {
		runtimeVersion: 'v6',
		campaignId: 38,
		campaignPageId: 222,
		preview: options.preview ?? false,
		endpoints: { visits: '/visits', cta: '/cta', engagement: '/engagement', leadIntake: '/lead' },
		widgetUrls: {}
	};
	win.document.body.innerHTML =
		'<main><form data-cs-form="lead-intake"><input name="email"><button type="submit">Send</button></form><button data-cs-consent-open>Cookie-Einstellungen</button></main>' +
		(options.youtube
			? '<div data-cs-widget="youtube-video" data-cs-youtube-id="dQw4w9WgXcQ"></div>'
			: '') +
		consentBannerMarkup +
		'<script id="cs-page-context" type="application/json">' +
		JSON.stringify(context) +
		'</script>';
	if (options.cookie)
		win.document.cookie =
			'cs_consent=' + encodeURIComponent(JSON.stringify(options.cookie)) + '; Path=/';
	const order: string[] = [];
	let finishTracking: () => void = () => {};
	let finishVisit: (value: Response) => void = () => {};
	const fetch = vi.fn(async (url: string, init?: RequestInit) => {
		order.push(url);
		if (url.startsWith('/api/runtime/v1/tracking')) {
			if (options.deferTracking)
				await new Promise<void>((resolve) => {
					finishTracking = resolve;
				});
			return new Response(
				JSON.stringify({
					data: {
						gtmContainerId: 'GTM-TEST',
						mappings: [],
						consent: {
							mode: 'basic',
							policyVersion: 'cs-consent-v1',
							retentionDays: 180,
							ownMeasurement: 'statistics',
							...options.settings
						}
					}
				})
			);
		}
		if (url === '/visits' && options.deferVisit && JSON.parse(String(init?.body)).baselineOnly)
			return new Promise<Response>((resolve) => {
				finishVisit = resolve;
			});
		if (url === '/api/runtime/v1/consent' && options.failConsent)
			return new Response(null, { status: 503 });
		return new Response(
			JSON.stringify({ data: { visitId: 17, visitReceipt: 'page-receipt', message: 'Danke' } })
		);
	});
	Object.assign(win, {
		fetch,
		IntersectionObserver: class {
			observe() {}
			unobserve() {}
		}
	});
	const layer = () => (win as unknown as { dataLayer: Array<Record<string, unknown>> }).dataLayer;
	const bridge = () =>
		(
			win as unknown as {
				__csConsentV6: {
					snapshot: { revision: number; signals: Record<string, string> };
					applied: (revision: number, signals: Record<string, string>) => void;
				};
			}
		).__csConsentV6;
	const templateSource = consentTemplate
		.split('___SANDBOXED_JS_FOR_WEB_TEMPLATE___')[1]
		.split('___WEB_PERMISSIONS___')[0];
	let scriptLoaded = false;
	const runTemplate = (event = 'cs_consent_update') => {
		const apis: Record<string, unknown> = {
			copyFromWindow: (path: string) =>
				path.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown>)?.[k], win),
			copyFromDataLayer: () => event,
			getType: (value: unknown) => typeof value,
			setDefaultConsentState: () => order.push('consent-default-api'),
			updateConsentState: () => order.push('consent-update-api'),
			callInWindow: (_path: string, revision: number, signals: Record<string, string>) =>
				bridge().applied(revision, signals)
		};
		runInNewContext('(function(){' + templateSource + '})()', {
			require: (name: string) => apis[name],
			data: {
				gtmOnSuccess: () => {},
				gtmOnFailure: () => {
					throw Error('Template failed');
				}
			}
		});
	};
	// Execute the real template against mocked sandbox APIs; never load third-party tags.
	const append = win.document.head.appendChild.bind(win.document.head);
	vi.spyOn(win.document.head, 'appendChild').mockImplementation((node) => {
		order.push('script');
		scriptLoaded = true;
		if (options.template !== false) runTemplate('gtm.init_consent');
		return append(node);
	});
	win.eval(await (await GET({} as never)).text());
	const push = layer().push.bind(layer());
	layer().push = (...items) => {
		const result = push(...items);
		items.forEach((item) => {
			if (item.event === 'cs_event') order.push('measurement:' + item.cs_event_name);
			if (item.event === 'cs_consent_update' && scriptLoaded && options.template !== false)
				runTemplate();
		});
		return result;
	};
	const settle = async () => {
		for (let i = 0; i < 10; i++) await new Promise<void>((resolve) => setImmediate(resolve));
	};
	await settle();
	const click = async (selector: string) => {
		win.document.querySelector<HTMLElement>(selector)!.click();
		await settle();
	};
	const signals = () => bridge()?.snapshot?.signals || layer()[0]?.[2];
	return {
		win,
		fetch,
		order,
		layer,
		bridge,
		runTemplate,
		signals,
		click,
		settle,
		finishTracking: () => finishTracking(),
		finishVisit: () =>
			finishVisit(
				new Response(JSON.stringify({ data: { visitId: 17, visitReceipt: 'page-receipt' } }))
			),
		host: win.document.querySelector<HTMLElement>('#cs-consent')!,
		posts: (url: string) =>
			fetch.mock.calls
				.filter((call) => call[0] === url)
				.map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>)
	};
}
const saved = (extra: Record<string, unknown> = {}) => ({
	statistics: true,
	marketing: true,
	personalization: true,
	policyVersion: 'cs-consent-v1',
	evidenceRef: 'cs:' + crypto.randomUUID(),
	expiresAt: Date.now() + 86400000,
	...extra
});

describe('runtime v6 consent', () => {
	it('records a cookieless baseline visit before any consent choice', async () => {
		const app = await mount();
		expect(app.posts('/visits')).toEqual([
			{ campaignPageId: 222, pageUrl: '/landing?gclid=test', baselineOnly: true }
		]);
		expect(app.win.document.cookie).not.toContain('cs_vid=');
		expect(app.order).not.toContain('script');
		expect(app.posts('/api/runtime/v1/events')).toHaveLength(0);
	});
	it('does not request YouTube resources in preview or before Marketing consent', async () => {
		for (const preview of [true, false]) {
			const app = await mount({ preview, youtube: true });
			expect(app.win.document.querySelector('script[src*="youtube"]')).toBeNull();
			expect(app.win.document.querySelector('iframe')).toBeNull();
			expect(
				app.win.document.querySelector('[data-cs-widget="youtube-video"]')?.textContent
			).toContain(preview ? 'Video-Vorschau' : 'Marketing');
		}
	});
	it('preserves the reading position on restore and prevents scrolling after an explicit choice', async () => {
		const restored = await mount({ cookie: saved() });
		expect(restored.win.document.activeElement).toBe(restored.win.document.body);
		const app = await mount();
		const focus = vi.spyOn(
			app.win.document.querySelector<HTMLElement>('main [data-cs-consent-open]')!,
			'focus'
		);
		await app.click('[data-cs-consent-accept]');
		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
	});
	it('captures Marketing-only click context and refreshes it when Marketing is granted later', async () => {
		const app = await mount();
		await app.click('[data-cs-consent-settings]');
		app.win.document.querySelector<HTMLInputElement>(
			'[data-cs-consent-category="marketing"]'
		)!.checked = true;
		await app.click('[data-cs-consent-save]');
		expect(app.posts('/visits')).toEqual([
			{ campaignPageId: 222, pageUrl: '/landing?gclid=test', baselineOnly: true },
			{
				campaignPageId: 222,
				pageUrl: '/landing?gclid=test',
				consentOnly: true,
				visitReceipt: 'page-receipt'
			}
		]);
		expect(app.posts('/api/runtime/v1/events')).toHaveLength(0);
		const later = await mount();
		await later.click('[data-cs-consent-reject]');
		await later.click('main [data-cs-consent-open]');
		await later.click('[data-cs-consent-accept]');
		expect(later.posts('/visits')).toHaveLength(3);
		expect(later.posts('/visits')[2].pageUrl).toBe('/landing?gclid=test');
	});
	it('does not persist an obsolete grant while visit creation is still pending', async () => {
		const app = await mount({ deferVisit: true });
		await app.click('[data-cs-consent-accept]');
		await app.click('main [data-cs-consent-open]');
		await app.click('[data-cs-consent-reject]');
		app.finishVisit();
		await app.settle();
		expect(app.posts('/api/runtime/v1/consent').map((p) => p.adUserDataConsent)).toEqual([
			'DENIED'
		]);
	});
	it('uses the GTM consent API before releasing measurement events', async () => {
		const app = await mount();
		await app.click('[data-cs-consent-accept]');
		expect(app.order.indexOf('consent-update-api')).toBeLessThan(
			app.order.indexOf('measurement:page_view')
		);
		expect(app.layer().filter((e) => e[0] === 'consent' && e[1] === 'update')).toEqual([]);
	});
	it('buffers tags without the installed template and ignores a stale grant after withdrawal', async () => {
		const app = await mount({ template: false });
		await app.click('[data-cs-consent-accept]');
		const stale = app.bridge().snapshot;
		expect(app.layer().filter((e) => e.event === 'cs_event')).toHaveLength(0);
		await app.click('main [data-cs-consent-open]');
		await app.click('[data-cs-consent-reject]');
		app.bridge().applied(stale.revision, stale.signals);
		expect(app.layer().filter((e) => e.event === 'cs_event')).toHaveLength(0);
		app.runTemplate();
		expect(app.signals()).toMatchObject({ ad_storage: 'denied', analytics_storage: 'denied' });
		expect(app.layer().filter((e) => e.event === 'cs_event')).toHaveLength(0);
	});
	it('applies the latest snapshot when queued updates arrive after a rapid withdrawal', async () => {
		const app = await mount({ template: false, settings: { mode: 'advanced' } });
		await app.click('[data-cs-consent-accept]');
		await app.click('main [data-cs-consent-open]');
		await app.click('[data-cs-consent-reject]');
		app.runTemplate('gtm.init_consent');
		expect(app.signals()).toMatchObject({ ad_storage: 'denied', analytics_storage: 'denied' });
		expect(app.layer().some((e) => e.cs_event_name === 'page_view')).toBe(false);
	});
	it('defaults all four signals to denied before any Google insertion, with basic mode silent', async () => {
		const app = await mount();
		expect(app.layer()[0]).toMatchObject({
			0: 'consent',
			1: 'default',
			2: {
				ad_storage: 'denied',
				analytics_storage: 'denied',
				ad_user_data: 'denied',
				ad_personalization: 'denied',
				wait_for_update: 500
			}
		});
		expect(app.layer()[1]).toMatchObject({ 0: 'set', 1: 'ads_data_redaction', 2: true });
		expect(app.layer()[2]).toMatchObject({ 0: 'set', 1: 'url_passthrough', 2: true });
		expect(app.order).not.toContain('script');
		expect(app.posts('/visits')).toHaveLength(1);
		expect(app.host.hidden).toBe(false);
	});

	it('keeps an early dismissal closed when tracking settings finish loading', async () => {
		const app = await mount({ deferTracking: true });
		await app.click('[data-cs-consent-close]');
		app.finishTracking();
		await app.settle();
		expect(app.host.hidden).toBe(true);
		expect(app.posts('/api/runtime/v1/consent')).toHaveLength(0);
	});
	it('does not turn necessary platform measurement into advertising consent when dismissed', async () => {
		const app = await mount({ settings: { ownMeasurement: 'necessary' } });
		await app.click('[data-cs-consent-close]');
		expect(app.host.hidden).toBe(true);
		expect(app.posts('/visits')).toHaveLength(2);
		expect(app.layer().filter((e) => e[0] === 'consent')).toHaveLength(1);
		expect(app.posts('/api/runtime/v1/consent')).toHaveLength(0);
	});
	it('dismisses without granting or recording a choice and can reopen from the footer', async () => {
		const app = await mount();
		await app.click('[data-cs-consent-close]');
		expect(app.host.hidden).toBe(true);
		expect(app.layer().filter((e) => e[0] === 'consent')).toHaveLength(1);
		expect(app.posts('/api/runtime/v1/consent')).toHaveLength(0);
		expect(app.posts('/visits')).toHaveLength(1);
		expect(app.win.document.cookie).not.toContain('cs_consent=');
		await app.click('main [data-cs-consent-open]');
		expect(app.host.hidden).toBe(false);
		app.host.dispatchEvent(new app.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(app.host.hidden).toBe(true);
		expect(app.posts('/api/runtime/v1/consent')).toHaveLength(0);
	});
	it('keeps a remembered choice when unsaved preference changes are dismissed', async () => {
		const app = await mount({ cookie: saved() });
		const cookie = app.win.document.cookie;
		const signals = app.signals();
		const posts = app.posts('/api/runtime/v1/consent').length;
		await app.click('main [data-cs-consent-open]');
		app.win.document.querySelector<HTMLInputElement>(
			'[data-cs-consent-category="marketing"]'
		)!.checked = false;
		await app.click('[data-cs-consent-close]');
		expect(app.host.hidden).toBe(true);
		expect(app.signals()).toEqual(signals);
		expect(app.win.document.cookie).toBe(cookie);
		expect(app.posts('/api/runtime/v1/consent')).toHaveLength(posts);
	});
	it('accepts all, records real evidence after visit resolution and remembers the choice', async () => {
		const app = await mount({ deferVisit: true });
		await app.click('[data-cs-consent-accept]');
		expect(app.signals()).toEqual({
			ad_storage: 'granted',
			analytics_storage: 'granted',
			ad_user_data: 'granted',
			ad_personalization: 'granted'
		});
		expect(app.posts('/api/runtime/v1/consent')).toHaveLength(0);
		app.finishVisit();
		await app.settle();
		expect(app.posts('/api/runtime/v1/consent')[0]).toMatchObject({
			visitId: 17,
			adUserDataConsent: 'GRANTED',
			policyVersion: 'cs-consent-v1',
			evidenceRef: expect.stringMatching(/^cs:/),
			expiresAt: expect.any(String)
		});
		expect(app.win.document.cookie).toContain('cs_consent=');
		expect(app.host.hidden).toBe(true);
		expect(app.win.document.querySelector('script[src*="gtm.js"]')).not.toBeNull();
	});
	it('rejects optional measurement while keeping the baseline visit and recording consent', async () => {
		const app = await mount();
		await app.click('[data-cs-consent-reject]');
		expect(app.signals()).toMatchObject({ ad_storage: 'denied', analytics_storage: 'denied' });
		expect(app.order).not.toContain('script');
		expect(app.posts('/visits')).toEqual([
			{ campaignPageId: 222, pageUrl: '/landing?gclid=test', baselineOnly: true },
			{ campaignPageId: 222, pageUrl: '/landing', consentOnly: true, visitReceipt: 'page-receipt' }
		]);
		expect(app.posts('/api/runtime/v1/consent')[0]).toMatchObject({ adUserDataConsent: 'DENIED' });
		expect(app.posts('/api/runtime/v1/events')).toHaveLength(0);
	});
	it('maps a statistics-only choice and supports live withdrawal through the footer hook', async () => {
		const app = await mount();
		await app.click('[data-cs-consent-settings]');
		app.win.document.querySelector<HTMLInputElement>(
			'[data-cs-consent-category="statistics"]'
		)!.checked = true;
		await app.click('[data-cs-consent-save]');
		expect(app.signals()).toEqual({
			ad_storage: 'denied',
			analytics_storage: 'granted',
			ad_user_data: 'denied',
			ad_personalization: 'denied'
		});
		await app.click('main [data-cs-consent-open]');
		expect(app.host.hidden).toBe(false);
		await app.click('[data-cs-consent-reject]');
		expect(app.posts('/api/runtime/v1/consent').at(-1)).toMatchObject({
			adUserDataConsent: 'DENIED'
		});
		expect(app.signals()).toMatchObject({ analytics_storage: 'denied' });
	});
	it('supports advanced cookieless tags without enabling Campaign Studio statistics', async () => {
		const app = await mount({ settings: { mode: 'advanced' } });
		expect(app.order).toContain('script');
		expect(app.layer()[0]).toMatchObject({ 0: 'consent', 1: 'default' });
		expect(app.posts('/visits')).toHaveLength(1);
		expect(app.layer().find((e) => e.cs_event_name === 'page_view')).toBeDefined();
	});
	it('restores only current unexpired choices and records them on the new visit', async () => {
		const app = await mount({ cookie: saved() });
		expect(app.host.hidden).toBe(true);
		expect(app.posts('/api/runtime/v1/consent')).toHaveLength(1);
		for (const cookie of [
			saved({ expiresAt: Date.now() - 1 }),
			saved({ policyVersion: 'old' }),
			saved({ statistics: 'yes' })
		]) {
			const invalid = await mount({ cookie });
			expect(invalid.host.hidden).toBe(false);
			expect(invalid.posts('/visits')).toHaveLength(1);
		}
	});
	it('never sends preview consent, visits, Google tags or cookies', async () => {
		const app = await mount({ preview: true, cookie: saved() });
		await app.click('[data-cs-consent-accept]');
		expect(app.fetch).not.toHaveBeenCalled();
		expect(app.layer()).toHaveLength(0);
		expect(app.order).not.toContain('script');
	});
	it('keeps denied offline behavior safe and exposes a retry if recording fails', async () => {
		const app = await mount({ failConsent: true });
		await app.click('[data-cs-consent-reject]');
		expect(app.host.hidden).toBe(false);
		expect(app.host.querySelector('[role="status"]')!.textContent).toContain('nicht gespeichert');
	});
});
