import type { BookingTokenResolutionResult } from './contracts';
import { getBookingLinkByToken } from './repository';

export async function resolveLeadBookingToken(
	token: string,
	input?: { now?: Date }
): Promise<BookingTokenResolutionResult> {
	const now = input?.now ?? new Date();
	const link = await getBookingLinkByToken(token);

	if (!link) {
		return {
			state: 'invalid',
			reason: 'not_found'
		};
	}

	if (link.booking_type !== 'lead') {
		return {
			state: 'invalid',
			reason: 'type_mismatch'
		};
	}

	const context = {
		bookingType: link.booking_type,
		token: link.token,
		bookingLinkId: link.id,
		leadJourneyId: link.lead_journey_id,
		campaignId: link.campaign_id,
		expiresAt: link.expires_at,
		clickedAt: link.clicked_at,
		bookedAt: link.booked_at,
		metadata: link.metadata
	} as const;

	if (link.expires_at <= now) {
		return {
			state: 'expired',
			context
		};
	}

	return {
		state: 'usable',
		context
	};
}
