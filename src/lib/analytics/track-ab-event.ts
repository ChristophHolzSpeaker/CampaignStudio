import { browser } from '$app/environment';

export type TrackAbEventInput = {
	eventType: 'cta_click';
	experimentId: string;
	variantId: string;
	visitorId: string;
	route: string;
	slug: string;
	metadata?: Record<string, unknown>;
};

export function trackAbEvent(input: TrackAbEventInput): void {
	if (!browser) {
		return;
	}

	const body = JSON.stringify({
		...input,
		metadata: input.metadata ?? {}
	});

	if (navigator.sendBeacon) {
		const sent = navigator.sendBeacon(
			'/api/ab-events',
			new Blob([body], { type: 'application/json' })
		);
		if (sent) {
			return;
		}
	}

	void fetch('/api/ab-events', {
		method: 'POST',
		headers: {
			'content-type': 'application/json'
		},
		body,
		keepalive: true
	}).catch(() => {
		// best-effort tracking
	});
}
