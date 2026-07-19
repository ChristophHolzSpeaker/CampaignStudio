import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn()
	}
}));

import { db } from '$lib/server/db';
import {
	buildOverviewKpis,
	getExperimentPerformanceByCampaign,
	getGeoPerformance,
	type FunnelDailyPoint
} from './client';

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

describe('experiment conversion attribution', () => {
	it('keeps legacy conversions before retirement isolated from ID-attributed conversions', async () => {
		mockedDb.select
			.mockReturnValueOnce({
				from: () => ({
					where: async () => [{ id: 10, slug: 'christoph-holz' }]
				})
			} as never)
			.mockReturnValueOnce({
				from: () => ({
					innerJoin: () => ({
						where: () => ({
							orderBy: async () => [
								{
									experimentId: 'old-experiment',
									experimentKey: 'speaker_primary_cta_v1',
									experimentName: 'Old CTA',
									routePattern: '/speaker/[slug]',
									status: 'completed',
									goalEvent: 'lead_created',
									endedAt: new Date('2026-07-01T00:00:00.000Z'),
									variantId: 'old-b',
									variantKey: 'B',
									variantName: 'Dual buttons',
									isControl: false
								},
								{
									experimentId: 'new-experiment',
									experimentKey: 'speaker_hero_autoplay_video_v1',
									experimentName: 'Hero video',
									routePattern: '/speaker/[slug]',
									status: 'running',
									goalEvent: 'lead_created',
									endedAt: null,
									variantId: 'new-b',
									variantKey: 'B',
									variantName: 'Autoplay video',
									isControl: false
								}
							]
						})
					})
				})
			} as never)
			.mockReturnValueOnce({ from: () => ({ where: async () => [] }) } as never)
			.mockReturnValueOnce({
				from: () => ({
					where: async () => [
						{
							experimentId: null,
							variantId: null,
							eventType: 'form_submitted',
							ctaVariant: 'B',
							ctaKey: 'hero_inline_booking',
							campaignPageId: 10,
							occurredAt: new Date('2026-06-30T00:00:00.000Z')
						},
						{
							experimentId: 'new-experiment',
							variantId: 'new-b',
							eventType: 'journey_created',
							ctaVariant: null,
							ctaKey: 'frictionless_funnel_inline_booking',
							campaignPageId: 10,
							occurredAt: new Date('2026-07-20T00:00:00.000Z')
						},
						{
							experimentId: null,
							variantId: null,
							eventType: 'form_submitted',
							ctaVariant: 'B',
							ctaKey: 'hero_inline_booking',
							campaignPageId: 10,
							occurredAt: new Date('2026-07-21T00:00:00.000Z')
						}
					]
				})
			} as never);

		const result = await getExperimentPerformanceByCampaign(7);

		expect(result.find((item) => item.experimentId === 'old-experiment')?.variants[0]?.leads).toBe(
			1
		);
		expect(result.find((item) => item.experimentId === 'new-experiment')?.variants[0]?.leads).toBe(
			1
		);
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
