import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

describe('/book/g +page.svelte', () => {
	it('renders intake stage by default', () => {
		const { body } = render(Page, {
			props: {
				data: {
					bookingType: 'general',
					policyState: 'active',
					unavailableMessage: null
				} as any,
				form: undefined as any
			}
		});

		expect(body).toContain('General briefing request');
		expect(body).toContain('action="?/check"');
		expect(body).not.toContain('Select a briefing slot');
	});

	it('renders two-column slot-selection stage after availability resolves', () => {
		const { body } = render(Page, {
			props: {
				data: {
					bookingType: 'general',
					policyState: 'active',
					unavailableMessage: null
				} as any,
				form: {
					values: {
						email: 'person@example.com',
						name: 'General User',
						company: 'ACME',
						scope: 'Discovery call'
					},
					availabilityState: 'available',
					classification: {
						interactionKind: 'first_time',
						hasUpcomingBooking: false,
						totalBookings: 0,
						upcomingBookingStartsAt: null
					},
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

		expect(body).toContain('Briefing details');
		expect(body).toContain('Select a briefing slot');
		expect(body).toContain('action="?/confirm"');
		expect(body).toContain('name="selected_starts_at"');
		expect(body).toContain('name="selected_ends_at"');
		expect(body).toContain('Confirm briefing slot');
	});
});
