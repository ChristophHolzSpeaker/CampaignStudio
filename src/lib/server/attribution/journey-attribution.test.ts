import { describe, expect, it } from 'vitest';
import {
	deriveJourneyAttributionUpdate,
	type JourneyAttributionState
} from '$lib/server/attribution/journey-attribution';

function baseJourney(overrides?: Partial<JourneyAttributionState>): JourneyAttributionState {
	return {
		first_visit_id: null,
		first_campaign_id: null,
		first_page_id: null,
		first_utm_source: null,
		first_utm_medium: null,
		first_utm_campaign: null,
		first_referrer: null,
		first_cta_key: null,
		first_seen_at: null,
		last_visit_id: null,
		last_campaign_id: null,
		last_page_id: null,
		last_utm_source: null,
		last_utm_medium: null,
		last_utm_campaign: null,
		last_referrer: null,
		last_cta_key: null,
		last_seen_at: null,
		attribution_model_version: 'journey_attribution_v1',
		...overrides
	};
}

describe('deriveJourneyAttributionUpdate', () => {
	it('sets first and last attribution when journey has no snapshot yet', () => {
		const observedAt = new Date('2026-05-01T10:00:00.000Z');
		const update = deriveJourneyAttributionUpdate({
			journey: baseJourney(),
			firstCandidate: {
				visitId: 10,
				campaignId: 1,
				pageId: 2,
				utmSource: 'google',
				utmMedium: 'cpc',
				utmCampaign: 'speaker_launch',
				referrer: 'https://google.com',
				ctaKey: 'hero_primary_talk_to_christoph',
				seenAt: new Date('2026-05-01T09:00:00.000Z')
			},
			lastCandidate: {
				visitId: 11,
				campaignId: 1,
				pageId: 3,
				utmSource: 'google',
				utmMedium: 'cpc',
				utmCampaign: 'speaker_launch',
				referrer: 'https://google.com',
				ctaKey: 'footer_secondary_book_now',
				seenAt: new Date('2026-05-01T09:40:00.000Z')
			},
			observedAt
		});

		expect(update).not.toBeNull();
		expect(update?.first_visit_id).toBe(10);
		expect(update?.last_visit_id).toBe(11);
		expect(update?.updated_at.toISOString()).toBe(observedAt.toISOString());
	});

	it('does not overwrite first-touch with newer candidate', () => {
		const update = deriveJourneyAttributionUpdate({
			journey: baseJourney({
				first_visit_id: 10,
				first_campaign_id: 1,
				first_page_id: 2,
				first_seen_at: new Date('2026-05-01T09:00:00.000Z'),
				last_seen_at: new Date('2026-05-01T09:30:00.000Z')
			}),
			firstCandidate: {
				visitId: 20,
				campaignId: 1,
				pageId: 4,
				utmSource: 'linkedin',
				utmMedium: 'paid_social',
				utmCampaign: 'later_touch',
				referrer: 'https://linkedin.com',
				ctaKey: null,
				seenAt: new Date('2026-05-01T09:10:00.000Z')
			},
			lastCandidate: {
				visitId: 21,
				campaignId: 1,
				pageId: 5,
				utmSource: 'linkedin',
				utmMedium: 'paid_social',
				utmCampaign: 'later_touch',
				referrer: 'https://linkedin.com',
				ctaKey: null,
				seenAt: new Date('2026-05-01T09:50:00.000Z')
			},
			observedAt: new Date('2026-05-01T10:00:00.000Z')
		});

		expect(update?.first_visit_id).toBe(10);
		expect(update?.last_visit_id).toBe(21);
	});

	it('allows first-touch replacement only for clearly earlier authoritative visit', () => {
		const update = deriveJourneyAttributionUpdate({
			journey: baseJourney({
				first_visit_id: 10,
				first_seen_at: new Date('2026-05-01T09:00:00.000Z')
			}),
			firstCandidate: {
				visitId: 9,
				campaignId: 1,
				pageId: 1,
				utmSource: 'google',
				utmMedium: 'cpc',
				utmCampaign: 'earlier_touch',
				referrer: 'https://google.com',
				ctaKey: null,
				seenAt: new Date('2026-05-01T08:00:00.000Z')
			},
			lastCandidate: {
				visitId: 12,
				campaignId: 1,
				pageId: 2,
				utmSource: 'google',
				utmMedium: 'cpc',
				utmCampaign: 'later_touch',
				referrer: 'https://google.com',
				ctaKey: null,
				seenAt: new Date('2026-05-01T10:00:00.000Z')
			},
			observedAt: new Date('2026-05-01T10:05:00.000Z')
		});

		expect(update?.first_visit_id).toBe(9);
		expect(update?.first_seen_at?.toISOString()).toBe('2026-05-01T08:00:00.000Z');
	});

	it('keeps existing last utm values when last-touch update has no authoritative visit', () => {
		const update = deriveJourneyAttributionUpdate({
			journey: baseJourney({
				last_visit_id: 11,
				last_utm_source: 'google',
				last_utm_medium: 'cpc',
				last_utm_campaign: 'speaker_launch',
				last_referrer: 'https://google.com',
				last_seen_at: new Date('2026-05-01T09:30:00.000Z')
			}),
			firstCandidate: {
				visitId: null,
				campaignId: 1,
				pageId: 2,
				utmSource: null,
				utmMedium: null,
				utmCampaign: null,
				referrer: null,
				ctaKey: null,
				seenAt: new Date('2026-05-01T09:00:00.000Z')
			},
			lastCandidate: {
				visitId: null,
				campaignId: 1,
				pageId: 2,
				utmSource: null,
				utmMedium: null,
				utmCampaign: null,
				referrer: null,
				ctaKey: 'form_primary_submit',
				seenAt: new Date('2026-05-01T09:40:00.000Z')
			},
			observedAt: new Date('2026-05-01T09:40:00.000Z')
		});

		expect(update?.last_visit_id).toBeNull();
		expect(update?.last_utm_source).toBe('google');
		expect(update?.last_utm_medium).toBe('cpc');
		expect(update?.last_utm_campaign).toBe('speaker_launch');
		expect(update?.last_referrer).toBe('https://google.com');
		expect(update?.last_cta_key).toBe('form_primary_submit');
	});
});
