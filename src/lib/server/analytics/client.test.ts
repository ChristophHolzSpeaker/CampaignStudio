import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn()
	}
}));

import { db } from '$lib/server/db';
import { buildOverviewKpis, getGeoPerformance, type FunnelDailyPoint } from './client';

const mockedDb = vi.mocked(db);

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

	it('groups geo labels for countries and cities', async () => {
		const where = vi.fn().mockResolvedValueOnce([
			{ country: 'AT', city: 'Vienna' },
			{ country: 'AT', city: 'Vienna' },
			{ country: 'DE', city: 'Berlin' },
			{ country: null, city: null }
		]);

		mockedDb.select.mockReturnValueOnce({
			from: () => ({ where })
		} as never);

		const result = await getGeoPerformance({
			from: new Date('2026-06-24T00:00:00.000Z'),
			toExclusive: new Date('2026-06-25T00:00:00.000Z')
		});

		expect(result.countries).toEqual([
			{ label: 'AT', visits: 2 },
			{ label: 'DE', visits: 1 },
			{ label: null, visits: 1 }
		]);
		expect(result.cities).toEqual([
			{ label: 'Vienna', visits: 2 },
			{ label: 'Berlin', visits: 1 },
			{ label: null, visits: 1 }
		]);
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
