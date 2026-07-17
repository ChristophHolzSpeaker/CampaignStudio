import { browser } from '$app/environment';
export const MAILTO_CLICKED_EVENT = 'mailto_clicked';
type WindowWithDataLayer = Window & {
	dataLayer?: Array<Record<string, unknown>>;
};

export type MailtoAttributionInput = {
	campaignId?: number | null;
	campaignPageId?: number | null;
	ctaKey: string;
	ctaLabel: string;
	ctaSection: string;
	ctaVariant?: string | null;
};

function sendMailtoAttribution(input: MailtoAttributionInput): void {
	if (input.campaignId == null || input.campaignPageId == null) {
		return;
	}

	const body = JSON.stringify({
		type: 'email',
		campaign_id: input.campaignId,
		campaign_page_id: input.campaignPageId,
		cta_key: input.ctaKey,
		cta_label: input.ctaLabel,
		cta_section: input.ctaSection,
		...(input.ctaVariant ? { cta_variant: input.ctaVariant } : {})
	});

	if (navigator.sendBeacon) {
		const sent = navigator.sendBeacon(
			'/api/attribution/cta',
			new Blob([body], { type: 'application/json' })
		);
		if (sent) {
			return;
		}
	}

	void fetch('/api/attribution/cta', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body,
		keepalive: true
	}).catch(() => {
		// best-effort tracking
	});
}

export function trackMailtoClick(input?: MailtoAttributionInput): void {
	if (!browser) {
		return;
	}

	const dataLayerWindow = window as WindowWithDataLayer;
	dataLayerWindow.dataLayer = dataLayerWindow.dataLayer || [];
	dataLayerWindow.dataLayer.push({
		event: MAILTO_CLICKED_EVENT
	});

	if (input) {
		sendMailtoAttribution(input);
	}
}
