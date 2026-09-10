import {
	findMapping,
	measurementSchema,
	trackingConfigSchema,
	type TrackingConfig
} from '$lib/tracking/contract';
import type { SpeakerMeasurement } from '$lib/tracking/speaker-context';

type Measurement = SpeakerMeasurement & { id: string };
type TrackingWindow = Window & { dataLayer?: unknown[] };

export function buildSpeakerTag(
	config: TrackingConfig,
	campaignId: number,
	pageId: number,
	e: Measurement
) {
	const mapping = findMapping(config, 'browser', e.name, e.action);
	return {
		event: 'cs_event',
		cs_event_name: e.name,
		cs_event_id: e.id,
		cs_campaign_id: campaignId,
		cs_page_id: pageId,
		cs_action: e.action ?? null,
		cs_section: e.section ?? null,
		cs_metric: e.metric ?? null,
		cs_ads_conversion_id: mapping?.conversionId?.replace(/^AW-/, '') ?? null,
		cs_ads_conversion_label: mapping?.conversionLabel ?? null,
		cs_value: mapping?.value ?? null,
		cs_currency: mapping?.currency ?? null
	};
}

export function startSpeakerTracking(
	campaignId: number,
	pageId: number,
	getVisitId: () => number | null
) {
	const win = window as TrackingWindow;
	const layer = (win.dataLayer ??= []);
	let stopped = false;
	let config: TrackingConfig | null = null;
	const tags: Measurement[] = [];
	const events: Measurement[] = [];
	let flushing = false;
	const tag = (e: Measurement) => {
		if (config) layer.push(buildSpeakerTag(config, campaignId, pageId, e));
		else if (tags.length < 200) tags.push(e);
	};
	const flush = async () => {
		const visitId = getVisitId();
		if (flushing || !visitId || !events.length) return;
		flushing = true;
		const batch = events.splice(0, 30);
		try {
			const response = await fetch('/api/runtime/v1/events', {
				method: 'POST',
				credentials: 'same-origin',
				keepalive: true,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ campaignPageId: pageId, visitId, events: batch })
			});
			if (!response.ok) throw new Error('Measurement unavailable');
		} catch {
			if (!stopped) {
				events.unshift(...batch);
				events.splice(200);
			}
		} finally {
			flushing = false;
		}
	};
	const measure = (input: SpeakerMeasurement) => {
		if (stopped) return;
		const parsed = measurementSchema.safeParse({ ...input, id: crypto.randomUUID() });
		if (!parsed.success) return;
		tag(parsed.data);
		if (events.length < 200) events.push(parsed.data);
	};
	// Same owner-configured defaults as artifact runtime v5; not visitor consent evidence.
	function consent(..._args: unknown[]) {
		layer.push(arguments);
	}
	consent('consent', 'default', {
		ad_storage: 'granted',
		analytics_storage: 'granted',
		ad_user_data: 'granted',
		ad_personalization: 'granted'
	});
	void fetch('/api/runtime/v1/tracking?pageId=' + pageId, { credentials: 'same-origin' })
		.then(async (response) => {
			if (!response.ok) throw new Error('Tracking configuration unavailable');
			const result = await response.json();
			return trackingConfigSchema.parse(result.data);
		})
		.catch(() => trackingConfigSchema.parse({}))
		.then((result) => {
			if (stopped) return;
			config = result;
			if (config.gtmContainerId) {
				const src = 'https://www.googletagmanager.com/gtm.js?id=' + config.gtmContainerId;
				if (!document.querySelector(`script[src="${src}"]`)) {
					layer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
					const script = document.createElement('script');
					script.async = true;
					script.src = src;
					document.head.appendChild(script);
				}
			}
			tags.splice(0).forEach(tag);
		});

	const controller = new AbortController();
	const options = { signal: controller.signal, capture: true };
	const sectionOf = (el: Element) =>
		el.closest('[data-cs-section]')?.getAttribute('data-cs-section') ?? undefined;
	const actionOf = (el: Element) => el.getAttribute('data-cs-track') ?? undefined;
	const eligible = (target: EventTarget | null) =>
		target instanceof Element && !target.closest('[data-cs-track-ignore]') ? target : null;
	document.addEventListener(
		'click',
		(event) => {
			const el = eligible(event.target)?.closest('a,button,[data-cs-track]');
			if (!el) return;
			const href = el.getAttribute('href') ?? '';
			const action =
				actionOf(el) ??
				(href.startsWith('mailto:')
					? 'email'
					: href.startsWith('tel:')
						? 'phone'
						: /\.pdf(?:[?#]|$)/i.test(href)
							? 'booklet_download'
							: href === '#booking'
								? 'booking_open'
								: undefined);
			measure({
				name:
					el.getAttribute('data-cs-event') ??
					(el.matches('a') ? 'navigation_click' : 'button_click'),
				action,
				section: sectionOf(el)
			});
		},
		options
	);
	const forms = new WeakSet<Element>();
	const fields = new WeakSet<Element>();
	document.addEventListener(
		'input',
		(event) => {
			const el = eligible(event.target);
			const form = el?.closest('form');
			if (!el || !form) return;
			if (!forms.has(form)) {
				forms.add(form);
				measure({ name: 'form_start', action: actionOf(form), section: sectionOf(form) });
			}
			if (!fields.has(el)) {
				fields.add(el);
				measure({ name: 'form_input', action: actionOf(el), section: sectionOf(el) });
			}
		},
		options
	);
	const media = new WeakSet<Element>();
	document.addEventListener(
		'playing',
		(event) => {
			const el = eligible(event.target);
			if (!el?.matches('video,audio') || media.has(el)) return;
			media.add(el);
			measure({
				name: el.matches('video') ? 'video_play' : 'audio_play',
				action: actionOf(el),
				section: sectionOf(el)
			});
		},
		options
	);
	let activeMs = 0;
	let lastTick = performance.now();
	const timeMarks = new Set<number>();
	const scrollMarks = new Set<number>();
	const timer = setInterval(() => {
		const now = performance.now();
		if (document.visibilityState === 'visible') activeMs += Math.min(now - lastTick, 2000);
		lastTick = now;
		for (const seconds of [10, 30, 60, 120]) {
			if (activeMs >= seconds * 1000 && !timeMarks.has(seconds)) {
				timeMarks.add(seconds);
				measure({ name: 'active_time', action: 'seconds_' + seconds, metric: seconds });
			}
		}
		void flush();
	}, 1000);
	window.addEventListener(
		'scroll',
		() => {
			const extent = document.documentElement.scrollHeight - innerHeight;
			if (extent <= 0) return;
			for (const percent of [25, 50, 75, 90, 100]) {
				if ((100 * scrollY) / extent >= percent - 0.5 && !scrollMarks.has(percent)) {
					scrollMarks.add(percent);
					measure({ name: 'scroll_depth', action: 'percent_' + percent, metric: percent });
				}
			}
		},
		{ signal: controller.signal, passive: true }
	);
	document.addEventListener(
		'visibilitychange',
		() => {
			lastTick = performance.now();
			if (document.visibilityState === 'hidden') void flush();
		},
		options
	);
	const observer =
		typeof IntersectionObserver === 'undefined'
			? null
			: new IntersectionObserver(
					(entries) => {
						for (const entry of entries)
							if (entry.isIntersecting) {
								measure({
									name: 'section_view',
									action: actionOf(entry.target),
									section: sectionOf(entry.target)
								});
								observer?.unobserve(entry.target);
							}
					},
					{ threshold: 0.25 }
				);
	document
		.querySelectorAll('[data-cs-track-view]')
		.forEach((el) => observer?.observe(el.firstElementChild ?? el));
	let exited = false;
	const exit = () => {
		if (!exited) {
			exited = true;
			measure({ name: 'page_exit', metric: Math.round(activeMs) });
		}
		void flush();
	};
	window.addEventListener('pagehide', exit, options);
	measure({ name: 'page_view' });
	return {
		measure,
		stop() {
			exit();
			stopped = true;
			controller.abort();
			clearInterval(timer);
			observer?.disconnect();
		}
	};
}
