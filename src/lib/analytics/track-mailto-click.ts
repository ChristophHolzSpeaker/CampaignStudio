import { browser } from '$app/environment';
export const MAILTO_CLICKED_EVENT = 'mailto_clicked';
type WindowWithDataLayer = Window & {
	dataLayer?: Array<Record<string, unknown>>;
};

export function trackMailtoClick(): void {
	if (!browser) {
		return;
	}

	const dataLayerWindow = window as WindowWithDataLayer;
	dataLayerWindow.dataLayer = dataLayerWindow.dataLayer || [];
	dataLayerWindow.dataLayer.push({
		event: MAILTO_CLICKED_EVENT
	});
}
