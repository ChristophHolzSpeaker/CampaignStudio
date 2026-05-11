import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

describe('/book/r/[token] +page.svelte', () => {
	it('renders shared reschedule slot flow for usable token', () => {
		const { body } = render(Page, {
			props: {
				data: {
					tokenState: 'usable',
					message: null,
					availabilityState: 'available',
					currentBooking: {
						id: 'booking-1',
						bookingType: 'lead',
						email: 'lead@example.com',
						name: 'Lead User',
						scope: 'Call',
						startsAtIso: '2026-06-01T10:00:00.000Z',
						endsAtIso: '2026-06-01T10:30:00.000Z'
					},
					slotGroups: [
						{
							dateKey: '2026-06-01',
							slots: [
								{
									startsAtIso: '2026-06-01T11:00:00.000Z',
									endsAtIso: '2026-06-01T11:30:00.000Z'
								}
							]
						}
					]
				} as any
			}
		});

		expect(body).toContain('Reschedule booking');
		expect(body).toContain('Current time:');
		expect(body).toContain('Select a briefing slot');
		expect(body).toContain('Confirm briefing slot');
		expect(body).toContain('Christoph Holz');
		expect(body).toContain('Compliance and Transparency footer section');
		expect(body).toContain('id="booking"');
		expect(body).toContain('id="contact"');
	});
});
