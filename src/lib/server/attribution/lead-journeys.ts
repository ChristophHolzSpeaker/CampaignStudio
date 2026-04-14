import { db } from '$lib/server/db';
import { lead_journeys } from '$lib/server/db/schema';
import { and, desc, eq, gte, notInArray } from 'drizzle-orm';

const CLOSED_STAGES = ['won', 'lost', 'cancelled', 'closed', 'disqualified', 'archived'] as const;
const MATCH_WINDOW_DAYS = 30;

export type LeadJourneyRecord = typeof lead_journeys.$inferSelect;

function getWindowStart(): Date {
	return new Date(Date.now() - MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export async function findRecentOpenLeadJourney(input: {
	contactEmail: string;
	campaignId: number;
}): Promise<LeadJourneyRecord | null> {
	const [journey] = await db
		.select()
		.from(lead_journeys)
		.where(
			and(
				eq(lead_journeys.contact_email, input.contactEmail),
				eq(lead_journeys.campaign_id, input.campaignId),
				notInArray(lead_journeys.current_stage, [...CLOSED_STAGES]),
				gte(lead_journeys.updated_at, getWindowStart())
			)
		)
		.orderBy(desc(lead_journeys.updated_at))
		.limit(1);

	return journey ?? null;
}

export async function createLeadJourney(input: {
	campaignId: number;
	campaignPageId: number;
	contactEmail: string;
	contactName: string;
	firstTouchType: 'form';
	firstTouchAt: Date;
}): Promise<LeadJourneyRecord> {
	const [journey] = await db
		.insert(lead_journeys)
		.values({
			campaign_id: input.campaignId,
			campaign_page_id: input.campaignPageId,
			contact_email: input.contactEmail,
			contact_name: input.contactName,
			first_touch_type: input.firstTouchType,
			first_touch_at: input.firstTouchAt,
			current_stage: 'new',
			updated_at: input.firstTouchAt
		})
		.returning();

	if (!journey) {
		throw new Error('Failed to create lead journey');
	}

	return journey;
}

export async function touchLeadJourney(input: {
	journeyId: string;
	campaignPageId: number;
	contactName: string;
	updatedAt: Date;
}): Promise<LeadJourneyRecord> {
	const [updatedJourney] = await db
		.update(lead_journeys)
		.set({
			updated_at: input.updatedAt,
			campaign_page_id: input.campaignPageId,
			contact_name: input.contactName
		})
		.where(eq(lead_journeys.id, input.journeyId))
		.returning();

	if (!updatedJourney) {
		throw new Error(`Failed to update lead journey ${input.journeyId}`);
	}

	return updatedJourney;
}

export async function findOrCreateLeadJourneyFromInquiry(input: {
	campaignId: number;
	campaignPageId: number;
	contactEmail: string;
	contactName: string;
	now?: Date;
}): Promise<{ journey: LeadJourneyRecord; created: boolean }> {
	const now = input.now ?? new Date();
	const existing = await findRecentOpenLeadJourney({
		contactEmail: input.contactEmail,
		campaignId: input.campaignId
	});

	if (existing) {
		const updated = await touchLeadJourney({
			journeyId: existing.id,
			campaignPageId: input.campaignPageId,
			contactName: input.contactName,
			updatedAt: now
		});

		return { journey: updated, created: false };
	}

	const createdJourney = await createLeadJourney({
		campaignId: input.campaignId,
		campaignPageId: input.campaignPageId,
		contactEmail: input.contactEmail,
		contactName: input.contactName,
		firstTouchType: 'form',
		firstTouchAt: now
	});

	return { journey: createdJourney, created: true };
}
