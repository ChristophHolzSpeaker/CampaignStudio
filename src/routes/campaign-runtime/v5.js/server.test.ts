import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

class ElementStub {
	children: ElementStub[] = [];
	textContent = '';
	style: Record<string, string> = {};
	src = '';
	listeners = new Map<string, () => void>();
	constructor(readonly attributes: Record<string, string> = {}) {}
	closest() {
		return null;
	}
	getAttribute(name: string) {
		return this.attributes[name] ?? null;
	}
	setAttribute(name: string, value: string) {
		this.attributes[name] = value;
	}
	addEventListener(name: string, callback: () => void) {
		this.listeners.set(name, callback);
	}
	replaceChildren(...children: ElementStub[]) {
		this.children = children;
	}
}

type PlayerEvents = {
	onReady?: (event: { target: { playVideo: () => void } }) => void;
	onStateChange: (event: { data: number }) => void;
	onError?: () => void;
};

async function mount(preview = false) {
	const widget = new ElementStub({
		'data-cs-widget': 'youtube-video',
		'data-cs-youtube-id': 'xmJRcJAr8Rc',
		'data-cs-video-title': 'Keynote'
	});
	const players: Array<{ frame: ElementStub; events: PlayerEvents }> = [];
	const playVideo = vi.fn();
	const fetch = vi.fn(
		async (_url: string, _init?: RequestInit) =>
			new Response(
				JSON.stringify({
					data: _url.startsWith('/api/runtime/v1/tracking')
						? {
								mappings: [
									{ event: 'video_play', conversionId: 'AW-123', conversionLabel: 'video' }
								],
								gtmContainerId: null
							}
						: { visitId: 17 }
				})
			)
	);
	const context = {
		runtimeVersion: 'v5',
		campaignId: 38,
		campaignPageId: 222,
		preview,
		endpoints: { visits: '/visits', cta: '/cta', engagement: '/engagement' }
	};
	const bookingFrame = Object.assign(new ElementStub(), { contentWindow: {} });
	const windowListeners = vi.fn();
	const document = {
		visibilityState: 'visible',
		getElementById: () => ({ textContent: JSON.stringify(context) }),
		createElement: () => new ElementStub(),
		addEventListener: vi.fn(),
		querySelectorAll: (selector: string) =>
			selector === '[data-cs-widget]'
				? [widget]
				: selector === '[data-cs-widget="booking-calendar"] iframe'
					? [bookingFrame]
					: []
	};
	const window = {
		dataLayer: [] as Array<Record<string, unknown>>,
		YT: {
			PlayerState: { PLAYING: 1 },
			Player: class {
				constructor(frame: ElementStub, options: { events: PlayerEvents }) {
					players.push({ frame, events: options.events });
				}
			}
		}
	};
	const response = await GET({} as never);
	runInNewContext(await response.text(), {
		document,
		window,
		parent: window,
		fetch,
		Element: ElementStub,
		location: { origin: 'https://example.com', pathname: '/inline', search: '' },
		setTimeout: vi.fn(),
		setInterval: vi.fn(),
		performance: { now: () => 0 },
		crypto,
		IntersectionObserver: class {
			observe() {}
			unobserve() {}
		},
		addEventListener: windowListeners
	});
	const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
	await settle();
	const videoPosts = () => fetch.mock.calls.filter((call) => call[0] === '/cta');
	return {
		widget,
		players,
		playVideo,
		settle,
		videoPosts,
		fetch,
		window,
		document,
		windowListeners,
		bookingFrame
	};
}

describe('artifact runtime v5 inline video', () => {
	it('shows the native inline player without an extra load button or autoplay', async () => {
		const app = await mount();

		expect(app.players).toHaveLength(1);
		expect(app.widget.children[0]).toBe(app.players[0].frame);
		expect(app.widget.children[0].getAttribute('data-cs-youtube-load')).toBeNull();
		const url = new URL(app.players[0].frame.src);
		expect(url.searchParams.get('autoplay')).toBe('0');
		expect(url.searchParams.get('controls')).toBe('1');
		app.players[0].events.onReady?.({ target: { playVideo: app.playVideo } });
		expect(new URL(app.players[0].frame.src).searchParams.get('playsinline')).toBe('1');
		expect(app.playVideo).not.toHaveBeenCalled();
		expect(app.videoPosts()).toHaveLength(0);
	});

	it('tracks confirmed playback once, with the existing attribution contract', async () => {
		const app = await mount();
		for (const data of [3, 1, 2, 1, 0, 1]) app.players[0].events.onStateChange({ data });
		await app.settle();
		expect(app.videoPosts()).toHaveLength(1);
		expect(app.window.dataLayer.filter((e) => e.cs_event_name === 'video_play')).toHaveLength(1);
		expect(app.window.dataLayer.find((e) => e.cs_event_name === 'video_play')).toMatchObject({
			cs_action: 'video-xmJRcJAr8Rc',
			cs_ads_conversion_id: '123',
			cs_ads_conversion_label: 'video'
		});
		expect(app.fetch).toHaveBeenCalledWith(
			'/cta',
			expect.objectContaining({
				body: JSON.stringify({
					type: 'video',
					campaign_id: 38,
					campaign_page_id: 222,
					campaign_visit_id: 17,
					cta_key: 'video-xmJRcJAr8Rc',
					cta_label: 'Keynote',
					cta_section: 'videos'
				})
			})
		);
	});

	it('does not count player loading, buffering, or errors as playback', async () => {
		const app = await mount();
		for (const data of [-1, 5, 3, 2, 0]) app.players[0].events.onStateChange({ data });
		app.players[0].events.onError?.();
		expect(app.widget.textContent).toBe('Video is unavailable.');
		await app.settle();
		expect(app.videoPosts()).toHaveLength(0);
	});

	it('allows preview playback without analytics', async () => {
		const app = await mount(true);
		app.players[0].events.onStateChange({ data: 1 });
		await app.settle();
		expect(app.playVideo).not.toHaveBeenCalled();
		expect(app.fetch).not.toHaveBeenCalled();
	});
});

it('accepts booking messages only from the actual same-origin widget', async () => {
	const app = await mount();
	const callbacks = app.windowListeners.mock.calls
		.filter((c) => c[0] === 'message')
		.map((c) => c[1]);
	const data = { type: 'cs-widget-measure', name: 'booking_confirmed', action: 'booking_form' };
	for (const callback of callbacks) {
		callback({ origin: 'https://attacker.example', source: app.bookingFrame.contentWindow, data });
		callback({ origin: 'https://example.com', source: {}, data });
	}
	expect(app.window.dataLayer.filter((e) => e.cs_event_name === 'booking_confirmed')).toHaveLength(
		0
	);
	for (const callback of callbacks)
		callback({ origin: 'https://example.com', source: app.bookingFrame.contentWindow, data });
	expect(app.window.dataLayer.filter((e) => e.cs_event_name === 'booking_confirmed')).toHaveLength(
		1
	);
});

it('records native media only on confirmed playing and deduplicates resume', async () => {
	const app = await mount();
	const media = Object.assign(new ElementStub({ 'data-cs-track': 'native_video' }), {
		matches: (selector: string) => selector === 'video,audio' || selector === 'video'
	});
	const callback = app.document.addEventListener.mock.calls.find((c) => c[0] === 'playing')?.[1];
	expect(callback).toBeTypeOf('function');
	callback({ target: media });
	callback({ target: media });
	expect(app.window.dataLayer.filter((e) => e.cs_event_name === 'video_play')).toHaveLength(1);
});
