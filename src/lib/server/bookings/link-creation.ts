import { db } from '$lib/server/db';
import { booking_links } from '$lib/server/db/schema';
import { randomBytes } from 'node:crypto';

const BOOKING_LINK_EXPIRY_DAYS = 7;

function generateBookingToken(): string {
	return randomBytes(32).toString('base64url');
}

export async function createBookingLinkForJourney(input: {
	leadJourneyId: string;
	campaignId: number | null;
	eventSource: string;
	metadata?: Record<string, unknown>;
}): Promise<{
	bookingLinkId: string;
	token: string;
	expiresAt: Date;
}> {
	const token = generateBookingToken();
	const expiresAt = new Date(Date.now() + BOOKING_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

	const [created] = await db
		.insert(booking_links)
		.values({
			lead_journey_id: input.leadJourneyId,
			campaign_id: input.campaignId,
			token,
			booking_type: 'lead',
			expires_at: expiresAt,
			metadata: input.metadata ?? null
		})
		.returning();

	if (!created) {
		throw new Error('Failed to create booking link');
	}

	return {
		bookingLinkId: created.id,
		token: created.token,
		expiresAt: created.expires_at
	};
}
