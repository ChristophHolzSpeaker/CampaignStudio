import type {
	BookingConfirmationLeadTokenContext,
	BookingType,
	ConfirmBookingInput,
	ConfirmBookingResult
} from './contracts';
import type { BookingCalendarEventProvider } from './calendar-provider';
import { WorkerBookingCalendarEventProvider } from './calendar-provider';
import { getBookingPolicy } from './policy';
import { classifyBookingRequesterByEmail } from './requester-classification';
import {
	createBooking,
	attachBookingCalendarEventId,
	markBookingCalendarSyncFailed
} from './lifecycle';
import { getOverlappingActiveBooking, markBookingLinkBookedAt } from './repository';
import { getPublicBookingUnavailableMessage } from './public-flow';
import { normalizeEmailAddress } from '$lib/server/attribution/email';
import { notifyBookingConfirmed } from '$lib/server/notifications/telegram';
import type { CreateBookingCalendarEventRequest } from '../../../../shared/booking-calendar';
import { randomBytes } from 'node:crypto';

const SLOT_UNAVAILABLE_MESSAGE =
	'That slot is no longer available. Please choose another available time.';
const CALENDAR_SYNC_FAILED_MESSAGE =
	'Your booking was received, but calendar sync is temporarily unavailable. We will follow up shortly.';

function generateRescheduleToken(): string {
	return randomBytes(32).toString('base64url');
}

function isSlotValidForPolicy(input: {
	bookingType: BookingType;
	startsAt: Date;
	endsAt: Date;
	now: Date;
	advanceNoticeMinutes: number;
	slotDurationMinutes: number;
	slotIntervalMinutes: number;
}): boolean {
	if (input.endsAt <= input.startsAt) {
		return false;
	}

	const durationMs = input.endsAt.getTime() - input.startsAt.getTime();
	if (durationMs !== input.slotDurationMinutes * 60 * 1000) {
		return false;
	}

	const intervalMs = input.slotIntervalMinutes * 60 * 1000;
	if (intervalMs <= 0 || input.startsAt.getTime() % intervalMs !== 0) {
		return false;
	}

	const cutoff = input.now.getTime() + input.advanceNoticeMinutes * 60 * 1000;
	if (input.startsAt.getTime() < cutoff) {
		return false;
	}

	return true;
}

function buildRescheduleUrl(input: { requestOrigin: string; rescheduleToken: string }): string {
	const base = new URL(input.requestOrigin);
	return new URL(`/book/r/${input.rescheduleToken}`, base).toString();
}

function toLeadContext(input: BookingConfirmationLeadTokenContext | undefined): {
	lead_journey_id?: string | null;
	campaign_id?: number | null;
	booking_link_id?: string | null;
} | null {
	if (!input) {
		return null;
	}

	return {
		lead_journey_id: input.leadJourneyId,
		campaign_id: input.campaignId,
		booking_link_id: input.bookingLinkId
	};
}

function toCalendarPayload(input: {
	bookingId: string;
	bookingType: BookingType;
	email: string;
	name: string | null;
	company: string | null;
	scope: string;
	startsAt: Date;
	endsAt: Date;
	rescheduleUrl: string;
	isRepeatInteraction: boolean;
	leadTokenContext?: BookingConfirmationLeadTokenContext;
}): CreateBookingCalendarEventRequest {
	return {
		booking_id: input.bookingId,
		booking_type: input.bookingType,
		attendee_email: input.email,
		attendee_name: input.name,
		company: input.company,
		meeting_scope: input.scope,
		starts_at_iso: input.startsAt.toISOString(),
		ends_at_iso: input.endsAt.toISOString(),
		reschedule_url: input.rescheduleUrl,
		is_repeat_interaction: input.isRepeatInteraction,
		lead_context: toLeadContext(input.leadTokenContext)
	};
}

function toSyncErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message.slice(0, 800);
	}

	return 'Unknown calendar sync error';
}

export async function confirmBookingSelection(
	input: ConfirmBookingInput,
	deps?: {
		calendarEventProvider?: BookingCalendarEventProvider;
	}
): Promise<ConfirmBookingResult> {
	const now = input.now ?? new Date();
	const policy = await getBookingPolicy(input.bookingType);

	if (policy.state !== 'active') {
		return {
			state: 'booking_unavailable',
			message: getPublicBookingUnavailableMessage(policy) ?? 'Booking is currently unavailable.'
		};
	}

	if (
		!isSlotValidForPolicy({
			bookingType: input.bookingType,
			startsAt: input.selectedStartsAt,
			endsAt: input.selectedEndsAt,
			now,
			advanceNoticeMinutes: policy.rules.advanceNoticeMinutes,
			slotDurationMinutes: policy.rules.slotDurationMinutes,
			slotIntervalMinutes: policy.rules.slotIntervalMinutes
		})
	) {
		return {
			state: 'slot_unavailable',
			message: SLOT_UNAVAILABLE_MESSAGE
		};
	}

	const normalizedEmail = normalizeEmailAddress(input.intake.email);
	if (!normalizedEmail) {
		return {
			state: 'booking_unavailable',
			message: 'Booking is currently unavailable.'
		};
	}

	const conflicting = await getOverlappingActiveBooking({
		startsAt: input.selectedStartsAt,
		endsAt: input.selectedEndsAt
	});

	if (conflicting) {
		return {
			state: 'slot_unavailable',
			message: SLOT_UNAVAILABLE_MESSAGE
		};
	}

	const classification = await classifyBookingRequesterByEmail(normalizedEmail, { now });
	const rescheduleToken = generateRescheduleToken();
	const created = await createBooking({
		bookingType: input.bookingType,
		requester: {
			email: normalizedEmail,
			name: input.intake.name?.trim() || null,
			company: input.intake.company?.trim() || null,
			scope: input.intake.scope,
			leadJourneyId: input.leadTokenContext?.leadJourneyId ?? null
		},
		startsAt: input.selectedStartsAt,
		endsAt: input.selectedEndsAt,
		status: 'pending_calendar_sync',
		calendarSyncError: null,
		rescheduleToken,
		isRepeatInteraction: classification.interactionKind === 'repeat'
	});

	if (input.leadTokenContext?.bookingLinkId) {
		await markBookingLinkBookedAt({
			bookingLinkId: input.leadTokenContext.bookingLinkId,
			bookedAt: now
		});
	}

	const rescheduleUrl = buildRescheduleUrl({
		requestOrigin: input.requestOrigin,
		rescheduleToken
	});
	const eventProvider = deps?.calendarEventProvider ?? new WorkerBookingCalendarEventProvider();

	try {
		const calendarResponse = await eventProvider.createBookingEvent(
			toCalendarPayload({
				bookingId: created.booking.id,
				bookingType: input.bookingType,
				email: created.booking.email,
				name: created.booking.name,
				company: created.booking.company,
				scope: created.booking.scope,
				startsAt: created.booking.starts_at,
				endsAt: created.booking.ends_at,
				rescheduleUrl,
				isRepeatInteraction: created.booking.is_repeat_interaction,
				leadTokenContext: input.leadTokenContext
			})
		);

		const attached = await attachBookingCalendarEventId({
			bookingId: created.booking.id,
			googleCalendarEventId: calendarResponse.event_id
		});

		try {
			await notifyBookingConfirmed({
				booking_id: attached.booking.id,
				booking_type: attached.booking.booking_type,
				attendee_name: attached.booking.name,
				attendee_email: attached.booking.email,
				company: attached.booking.company,
				meeting_scope: attached.booking.scope,
				booking_time: {
					starts_at_iso: attached.booking.starts_at.toISOString(),
					ends_at_iso: attached.booking.ends_at.toISOString()
				},
				campaign_context: {
					lead_journey_id: attached.booking.lead_journey_id,
					campaign_id: input.leadTokenContext?.campaignId ?? null,
					booking_link_id: input.leadTokenContext?.bookingLinkId ?? null
				},
				urls: {
					reschedule_url: rescheduleUrl,
					calendar_event_url: calendarResponse.html_link ?? null
				}
			});
		} catch (notificationError) {
			console.error('telegram_booking_confirmed_failed', {
				booking_id: attached.booking.id,
				error:
					notificationError instanceof Error
						? notificationError.message
						: 'unknown_notification_error'
			});
		}

		return {
			state: 'confirmed',
			booking: attached.booking,
			calendarEventId: calendarResponse.event_id
		};
	} catch (calendarSyncError) {
		const syncErrorMessage = toSyncErrorMessage(calendarSyncError);
		const failed = await markBookingCalendarSyncFailed({
			bookingId: created.booking.id,
			errorMessage: syncErrorMessage
		});

		return {
			state: 'calendar_sync_failed',
			booking: failed.booking,
			message: CALENDAR_SYNC_FAILED_MESSAGE
		};
	}
}
