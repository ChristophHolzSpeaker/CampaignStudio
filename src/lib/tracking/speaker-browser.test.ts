import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSpeakerTag, startSpeakerTracking } from './speaker-browser';
import { trackingConfigSchema } from './contract';

const config = trackingConfigSchema.parse({
	gtmContainerId: 'GTM-TEST123',
	mappings: [
		{
			channel: 'browser',
			event: 'navigation_click',
			conversionId: 'AW-123',
			conversionLabel: 'general'
		},
		{
			channel: 'browser',
			event: 'navigation_click',
			action: 'email',
			conversionId: 'AW-456',
			conversionLabel: 'email',
			value: 2,
			currency: 'EUR'
		},
		{
			channel: 'offline',
			event: 'booking_confirmed',
			customerId: '2354667197',
			conversionActionId: '7755799332'
		}
	]
});
const id = 'b85cc6d2-207c-4a83-aaf9-c746c7e642a0';

function mount() {
	vi.useFakeTimers();
	const win = Object.assign(new EventTarget(), { dataLayer: [] as unknown[] });
	const scripts: Array<{ src: string }> = [];
	const doc = Object.assign(new EventTarget(), {
		visibilityState: 'visible',
		documentElement: { scrollHeight: 2000 },
		querySelector: (selector: string) => scripts.find((s) => selector.includes(s.src)),
		querySelectorAll: () => [],
		createElement: () => ({ src: '', async: false }),
		head: { appendChild: (script: { src: string }) => scripts.push(script) }
	});
	const fetch = vi.fn(async (url: string) =>
		url.includes('/tracking?')
			? Response.json({
					data: { ...config, mappings: config.mappings.filter((m) => m.channel === 'browser') }
				})
			: new Response(null, { status: 204 })
	);
	vi.stubGlobal('window', win);
	vi.stubGlobal('document', doc);
	vi.stubGlobal('fetch', fetch);
	vi.stubGlobal('IntersectionObserver', undefined);
	return { win, doc, scripts, fetch };
}
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('speaker measurement contract', () => {
	it('uses action-specific browser mappings and clears destination fields on unmatched events', () => {
		expect(
			buildSpeakerTag(config, 44, 269, { id, name: 'navigation_click', action: 'email' })
		).toMatchObject({
			cs_ads_conversion_id: '456',
			cs_ads_conversion_label: 'email',
			cs_value: 2,
			cs_currency: 'EUR'
		});
		expect(
			buildSpeakerTag(config, 44, 269, { id, name: 'navigation_click', action: 'other' })
				.cs_ads_conversion_label
		).toBe('general');
		expect(buildSpeakerTag(config, 44, 269, { id, name: 'booking_confirmed' })).toMatchObject({
			cs_campaign_id: 44,
			cs_page_id: 269,
			cs_action: null,
			cs_section: null,
			cs_metric: null,
			cs_ads_conversion_id: null,
			cs_ads_conversion_label: null,
			cs_value: null,
			cs_currency: null
		});
	});
	it('buffers early events, installs consent before GTM, and persists only after visit resolution', async () => {
		const { win, fetch, scripts } = mount();
		let visitId: number | null = null;
		const tracker = startSpeakerTracking(44, 269, () => visitId);
		tracker.measure({ name: 'navigation_click', action: 'email' });
		await vi.advanceTimersByTimeAsync(1000);
		expect(scripts).toHaveLength(1);
		expect(Array.from(win.dataLayer[0] as ArrayLike<unknown>)[0]).toBe('consent');
		expect(win.dataLayer).toContainEqual(
			expect.objectContaining({
				cs_event_name: 'navigation_click',
				cs_ads_conversion_label: 'email'
			})
		);
		expect(fetch.mock.calls.filter(([url]) => url.endsWith('/events'))).toHaveLength(0);
		visitId = 17;
		await vi.advanceTimersByTimeAsync(1000);
		expect(fetch).toHaveBeenCalledWith(
			'/api/runtime/v1/events',
			expect.objectContaining({ body: expect.stringContaining('"visitId":17') })
		);
		tracker.stop();
		const count = win.dataLayer.length;
		tracker.measure({ name: 'booking_confirmed' });
		await vi.advanceTimersByTimeAsync(10000);
		expect(win.dataLayer).toHaveLength(count);
	});
	it('discards an old page configuration response after navigation', async () => {
		const { win, scripts } = mount();
		let resolve!: (response: Response) => void;
		vi.stubGlobal(
			'fetch',
			vi.fn(
				() =>
					new Promise<Response>((r) => {
						resolve = r;
					})
			)
		);
		const tracker = startSpeakerTracking(44, 269, () => null);
		tracker.stop();
		resolve(Response.json({ data: config }));
		await vi.advanceTimersByTimeAsync(0);
		expect(scripts).toHaveLength(0);
		expect(win.dataLayer).toHaveLength(1);
	});
	it('does not duplicate the same GTM script across speaker pages', async () => {
		const { scripts, win } = mount();
		const first = startSpeakerTracking(44, 269, () => null);
		await vi.advanceTimersByTimeAsync(0);
		first.stop();
		const second = startSpeakerTracking(45, 270, () => null);
		await vi.advanceTimersByTimeAsync(0);
		expect(scripts).toHaveLength(1);
		expect(win.dataLayer).toContainEqual(
			expect.objectContaining({ cs_event_name: 'page_view', cs_campaign_id: 45, cs_page_id: 270 })
		);
		second.stop();
	});
});

it('retries persistence with the same event IDs without repeating Google events', async () => {
	const { fetch, win } = mount();
	let failures = 1;
	fetch.mockImplementation(async (url) => {
		if (url.includes('/tracking?')) return Response.json({ data: config });
		if (failures-- > 0) return new Response(null, { status: 503 });
		return new Response(null, { status: 204 });
	});
	const tracker = startSpeakerTracking(44, 269, () => 17);
	await vi.advanceTimersByTimeAsync(2000);
	const requests = vi
		.mocked(globalThis.fetch)
		.mock.calls.filter(([url]) => url === '/api/runtime/v1/events');
	expect(requests).toHaveLength(2);
	expect(requests[0][1]?.body).toEqual(requests[1][1]?.body);
	expect(
		win.dataLayer.filter((e) => (e as Record<string, unknown>).cs_event_name === 'page_view')
	).toHaveLength(1);
	tracker.stop();
});
