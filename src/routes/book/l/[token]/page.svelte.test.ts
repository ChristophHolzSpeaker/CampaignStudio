import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

describe('/book/l/[token] +page.svelte', () => {
	it('renders shared slot-selection stage for skipped intake state', () => {
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
						phone: '',
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
						phone: null,
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

		expect(body).toContain('Select a briefing slot');
		expect(body).toContain('lead@example.com');
		expect(body).toContain('Confirm briefing slot');
		expect(body).toContain('Christoph Holz');
		expect(body).toContain('Compliance and Transparency footer section');
		expect(body).toContain('id="booking"');
		expect(body).toContain('id="contact"');
		expect(body).not.toContain('Briefing details');
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
						phone: '+43123456789',
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
		expect(body).not.toContain('Briefing details');
		expect(body).toContain('value="lead@example.com"');
		expect(body).toContain('value="Lead User"');
		expect(body).toContain('value="ACME"');
		expect(body).toContain('Discuss launch strategy');
	});
});
