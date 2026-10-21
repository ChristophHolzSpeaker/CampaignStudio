import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import template from './google-consent-v6.tpl?raw';

const source = template
	.split('___SANDBOXED_JS_FOR_WEB_TEMPLATE___')[1]
	.split('___WEB_PERMISSIONS___')[0];
const denied = {
	ad_storage: 'denied',
	analytics_storage: 'denied',
	ad_user_data: 'denied',
	ad_personalization: 'denied'
};
function run(options: { version?: number; event?: string; signals?: Record<string, string> } = {}) {
	const calls: string[] = [];
	const apis = {
		copyFromWindow: (path: string) =>
			path.endsWith('.version')
				? (options.version ?? 1)
				: { version: 1, revision: 3, signals: options.signals ?? denied },
		copyFromDataLayer: () => options.event ?? 'cs_consent_update',
		getType: (value: unknown) => typeof value,
		setDefaultConsentState: vi.fn(() => calls.push('default')),
		updateConsentState: vi.fn(() => calls.push('update')),
		callInWindow: vi.fn(() => calls.push('ack'))
	};
	const data = { gtmOnSuccess: vi.fn(), gtmOnFailure: vi.fn() };
	runInNewContext('(function(){' + source + '})()', {
		require: (name: keyof typeof apis) => apis[name],
		data
	});
	return { apis, data, calls };
}
describe('importable GTM v6 template', () => {
	it('sets a denied default during Consent Initialization and updates before acknowledgement', () => {
		const result = run({ event: 'gtm.init_consent' });
		expect(result.apis.setDefaultConsentState).toHaveBeenCalledWith({
			...denied,
			wait_for_update: 500
		});
		expect(result.apis.updateConsentState).toHaveBeenCalledWith(denied);
		expect(result.apis.callInWindow).toHaveBeenCalledWith('__csConsentV6.applied', 3, denied);
		expect(result.calls).toEqual(['default', 'update', 'ack']);
	});
	it('preserves legacy pages and ignores measurement events', () => {
		for (const options of [{ version: 0 }, { event: 'cs_event' }]) {
			const result = run(options);
			expect(result.calls).toEqual([]);
			expect(result.data.gtmOnSuccess).toHaveBeenCalledOnce();
		}
	});
	it('rejects malformed consent without partially applying or acknowledging it', () => {
		const result = run({ signals: { ...denied, ad_user_data: 'yes' } });
		expect(result.calls).toEqual([]);
		expect(result.data.gtmOnFailure).toHaveBeenCalledOnce();
	});
});
