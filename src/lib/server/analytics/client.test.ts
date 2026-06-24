import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	db: {}
}));

import { buildOverviewKpis, type FunnelDailyPoint } from './client';

describe('analytics overview KPIs', () => {
	it('calculates bounce rate from selected funnel days', () => {
		const overview = buildOverviewKpis([
			makeFunnelPoint({ visits: 3, bouncedVisits: 2 }),
			makeFunnelPoint({ visits: 2, bouncedVisits: 0 })
		]);

		expect(overview.visits).toBe(5);
		expect(overview.bouncedVisits).toBe(2);
		expect(overview.bounceRate).toBe(0.4);
	});
});

function makeFunnelPoint(input: { visits: number; bouncedVisits: number }): FunnelDailyPoint {
	return {
		reportDate: '2026-06-24',
		visits: input.visits,
		bouncedVisits: input.bouncedVisits,
		uniqueVisitors: input.visits,
		journeysCreated: 0,
		identifiedLeads: 0,
		inboundMessages: 0,
		bookingLinkClicked: 0,
		bookingsCompleted: 0,
		bounceRate: input.visits > 0 ? input.bouncedVisits / input.visits : 0,
		visitToLeadRate: 0,
		leadToBookingRate: 0,
		visitToBookingRate: 0
	};
}
