import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { secureBookingWidgetResponse } from './booking-widget-csp';

describe('booking widget CSP', () => {
	it('authorizes the rendered inline bootstrap by hash', async () => {
		const script = 'globalThis.__booking = { campaignPageId: 3 };';
		const response = await secureBookingWidgetResponse(
			new Response(`<html><body><script>${script}</script></body></html>`, {
				headers: { 'content-type': 'text/html; charset=utf-8' }
			})
		);
		const expectedHash = createHash('sha256').update(script).digest('base64');
		const policy = response.headers.get('content-security-policy');

		expect(policy).toContain(`'sha256-${expectedHash}'`);
		expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
		expect(await response.text()).toContain(`<script>${script}</script>`);
	});
});
