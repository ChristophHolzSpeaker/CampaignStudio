import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

vi.mock('$app/state', () => ({
	page: {
		url: new URL('http://test.local/book/s'),
		route: { id: '/book/s' }
	}
}));

describe('/book/s +page.svelte', () => {
	it('renders shared slot-first sequence by default', () => {
		const { body } = render(Page, {
			props: {
				data: {
					bookingType: 'general',
					policyState: 'active',
					unavailableMessage: null,
					slotTimeZone: 'Europe/Berlin',
					slotGroups: [
						{
							dateKey: '2026-05-01',
							slots: [
								{
									startsAtIso: '2026-05-01T10:00:00.000Z',
									endsAtIso: '2026-05-01T10:30:00.000Z'
								}
							]
						}
					]
				} as any
			}
		});

		expect(body).toContain('General briefing request');
		expect(body).toContain('Select a briefing slot');
		expect(body).toContain('Please select an available slot first');
		expect(body).toContain('inline-booking-day-tab-2026-05-01');
		expect(body).toContain('Christoph Holz');
		expect(body).toContain('Compliance and Transparency footer section');
		expect(body).toContain('id="booking"');
		expect(body).toContain('id="contact"');
	});

	it('renders no-slot notice when preview has no slots', () => {
		const { body } = render(Page, {
			props: {
				data: {
					bookingType: 'general',
					policyState: 'active',
					unavailableMessage: null,
					message:
						'No briefing slots are currently available from 2 days from now through the next 2 weeks.',
					slotGroups: []
				} as any
			}
		});

		expect(body).toContain(
			'No briefing slots are currently available from 2 days from now through the next 2 weeks.'
		);
		expect(body).toContain('Contact us to request a custom time');
	});
});
