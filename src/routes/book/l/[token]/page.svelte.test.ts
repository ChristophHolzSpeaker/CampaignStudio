import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

describe('/book/l/[token] +page.svelte', () => {
	it('renders summary panel and slot-selection stage for skipped intake state', () => {
		const { body } = render(Page, {
			props: {
				data: {
					bookingType: 'lead',
					tokenState: 'usable',
					tokenMessage: null,
					policyState: 'active',
					unavailableMessage: null,
					prefillValues: {
						email: 'lead@example.com',
						name: 'Lead User',
						company: '',
						scope: 'Discuss launch strategy'
					},
					intakeSkipped: true,
					availabilityState: 'available',
					classification: {
						interactionKind: 'first_time',
						hasUpcomingBooking: false,
						totalBookings: 0,
						upcomingBookingStartsAt: null
					},
					intakeSummary: {
						name: 'Lead User',
						email: 'lead@example.com',
						scope: 'Discuss launch strategy',
						requestSummary: 'Discuss launch strategy',
						company: null
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
					],
					searchStartsAtIso: '2026-05-01T00:00:00.000Z',
					searchEndsAtIso: '2026-05-04T00:00:00.000Z',
					message: undefined
				} as any,
				form: undefined as any
			}
		});

		expect(body).toContain('Booking details');
		expect(body).toContain('Choose a time');
		expect(body).toContain('lead@example.com');
		expect(body).toContain('Discuss launch strategy');
		expect(body).toContain('href="?edit=1"');
		expect(body).toContain('action="?/confirm"');
	});

	it('renders editable intake form with prefilled values when intake is not skipped', () => {
		const { body } = render(Page, {
			props: {
				data: {
					bookingType: 'lead',
					tokenState: 'usable',
					tokenMessage: null,
					policyState: 'active',
					unavailableMessage: null,
					prefillValues: {
						email: 'lead@example.com',
						name: 'Lead User',
						company: 'ACME',
						scope: 'Discuss launch strategy'
					},
					intakeSkipped: false,
					intakeSummary: undefined,
					classification: undefined,
					availabilityState: undefined,
					slotGroups: undefined,
					searchStartsAtIso: undefined,
					searchEndsAtIso: undefined,
					message: undefined
				} as any,
				form: undefined as any
			}
		});

		expect(body).toContain('action="?/check"');
		expect(body).not.toContain('Booking details');
		expect(body).toContain('value="lead@example.com"');
		expect(body).toContain('value="Lead User"');
		expect(body).toContain('value="ACME"');
		expect(body).toContain('Discuss launch strategy');
	});
});
