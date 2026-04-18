import { PUBLIC_BOOKING_CALENDAR_ID } from '$env/static/public';
import type {
	ConfirmBookingRescheduleInput,
	ConfirmBookingRescheduleResult,
	RescheduleBookingResolution
} from './contracts';
import { getBookingAvailability } from './availability-service';
import { createPublicBookingCalendarProvider, getPublicBookingSearchWindow } from './public-flow';
import { getBookingPolicy } from './policy';
import { rescheduleBooking } from './lifecycle';
import {
	getBookingByRescheduleToken,
	getOverlappingActiveBooking,
	updateBookingStatus
} from './repository';
import { updateBookingCalendarEventViaWorker } from './worker-calendar-client';
import { notifyBookingRescheduled } from '$lib/server/notifications/telegram';

const SLOT_UNAVAILABLE_MESSAGE =
	'That replacement slot is no longer available. Please choose another available time.';
const CALENDAR_SYNC_FAILED_MESSAGE =
	'Reschedule was saved, but calendar sync is temporarily unavailable. Please try again shortly.';

export type RescheduleSlotPresentation = {
	startsAtIso: string;
	endsAtIso: string;
};

export type RescheduleSlotDayGroup = {
	dateKey: string;
	slots: RescheduleSlotPresentation[];
};

export type RescheduleBookingFlow = {
	resolution: RescheduleBookingResolution;
	slotGroups: RescheduleSlotDayGroup[];
};

function isReschedulableStatus(status: string): boolean {
	return status !== 'cancelled';
}

function toSlotGroups(input: Array<{ startsAt: Date; endsAt: Date }>): RescheduleSlotDayGroup[] {
	const grouped = new Map<string, RescheduleSlotPresentation[]>();

	for (const slot of input) {
		const dateKey = slot.startsAt.toISOString().slice(0, 10);
		const existing = grouped.get(dateKey) ?? [];

		existing.push({
			startsAtIso: slot.startsAt.toISOString(),
			endsAtIso: slot.endsAt.toISOString()
		});

		grouped.set(dateKey, existing);
	}

	return [...grouped.entries()].map(([dateKey, slots]) => ({ dateKey, slots }));
}

function toSyncErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message.slice(0, 800);
	}

	return 'Unknown calendar sync error';
}

function buildRescheduleUrl(input: { requestOrigin: string; rescheduleToken: string }): string {
	const base = new URL(input.requestOrigin);
	return new URL(`/book/r/${input.rescheduleToken}`, base).toString();
}

function isSlotValidForPolicy(input: {
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

export async function resolveRescheduleBookingFlow(input: {
	rescheduleToken: string;
	now?: Date;
}): Promise<RescheduleBookingFlow> {
	const now = input.now ?? new Date();
	const token = input.rescheduleToken.trim();

	if (!token) {
		return {
			resolution: {
				state: 'invalid_token',
				booking: null,
				availability: null,
				searchStartsAt: null,
				searchEndsAt: null,
				message: 'This reschedule link is invalid.'
			},
			slotGroups: []
		};
	}

	const booking = await getBookingByRescheduleToken(token);
	if (!booking) {
		return {
			resolution: {
				state: 'invalid_token',
				booking: null,
				availability: null,
				searchStartsAt: null,
				searchEndsAt: null,
				message: 'This reschedule link is invalid.'
			},
			slotGroups: []
		};
	}

	if (!isReschedulableStatus(booking.status)) {
		return {
			resolution: {
				state: 'booking_unavailable',
				booking,
				availability: null,
				searchStartsAt: null,
				searchEndsAt: null,
				message: 'This booking can no longer be rescheduled.'
			},
			slotGroups: []
		};
	}

	const { searchStartsAt, searchEndsAt } = getPublicBookingSearchWindow({ now });
	const availability = await getBookingAvailability({
		bookingType: booking.booking_type,
		searchStartsAt,
		searchEndsAt,
		calendarProvider: createPublicBookingCalendarProvider(),
		calendarId: PUBLIC_BOOKING_CALENDAR_ID,
		ignoredBusyIntervals: [{ startsAt: booking.starts_at, endsAt: booking.ends_at }],
		now
	});

	const policyMessage =
		availability.state === 'bookings_paused'
			? (availability.reason ?? 'Bookings are currently paused.')
			: availability.state === 'booking_type_disabled' || availability.state === 'rules_missing'
				? 'Booking is currently unavailable.'
				: null;

	if (policyMessage) {
		return {
			resolution: {
				state: 'booking_unavailable',
				booking,
				availability,
				searchStartsAt,
				searchEndsAt,
				message: policyMessage
			},
			slotGroups: []
		};
	}

	const replacementSlots = availability.slots.filter(
		(slot) =>
			slot.startsAt.getTime() !== booking.starts_at.getTime() ||
			slot.endsAt.getTime() !== booking.ends_at.getTime()
	);

	return {
		resolution: {
			state: 'usable',
			booking,
			availability: {
				...availability,
				slots: replacementSlots
			},
			searchStartsAt,
			searchEndsAt,
			message: null
		},
		slotGroups: toSlotGroups(replacementSlots)
	};
}

export async function confirmBookingReschedule(
	input: ConfirmBookingRescheduleInput
): Promise<ConfirmBookingRescheduleResult> {
	const now = input.now ?? new Date();
	const token = input.rescheduleToken.trim();

	if (!token) {
		return {
			state: 'invalid_token',
			message: 'This reschedule link is invalid.'
		};
	}

	const booking = await getBookingByRescheduleToken(token);
	if (!booking) {
		return {
			state: 'invalid_token',
			message: 'This reschedule link is invalid.'
		};
	}

	if (!isReschedulableStatus(booking.status)) {
		return {
			state: 'booking_unavailable',
			message: 'This booking can no longer be rescheduled.'
		};
	}

	const policy = await getBookingPolicy(booking.booking_type);
	if (policy.state !== 'active') {
		return {
			state: 'booking_unavailable',
			message:
				policy.state === 'globally_paused'
					? (policy.pause.pauseMessage ?? 'Bookings are currently paused.')
					: 'Booking is currently unavailable.'
		};
	}

	if (
		!isSlotValidForPolicy({
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

	if (
		booking.starts_at.getTime() === input.selectedStartsAt.getTime() &&
		booking.ends_at.getTime() === input.selectedEndsAt.getTime()
	) {
		return {
			state: 'slot_unavailable',
			message: 'Please choose a different slot to reschedule this booking.'
		};
	}

	const overlappingBooking = await getOverlappingActiveBooking({
		startsAt: input.selectedStartsAt,
		endsAt: input.selectedEndsAt,
		excludeBookingId: booking.id
	});

	if (overlappingBooking) {
		return {
			state: 'slot_unavailable',
			message: SLOT_UNAVAILABLE_MESSAGE
		};
	}

	const availability = await getBookingAvailability({
		bookingType: booking.booking_type,
		searchStartsAt: input.selectedStartsAt,
		searchEndsAt: input.selectedEndsAt,
		calendarProvider: createPublicBookingCalendarProvider(),
		calendarId: PUBLIC_BOOKING_CALENDAR_ID,
		ignoredBusyIntervals: [{ startsAt: booking.starts_at, endsAt: booking.ends_at }],
		now
	});

	const selectedSlotStillAvailable =
		availability.state === 'available' &&
		availability.slots.some(
			(slot) =>
				slot.startsAt.getTime() === input.selectedStartsAt.getTime() &&
				slot.endsAt.getTime() === input.selectedEndsAt.getTime()
		);

	if (!selectedSlotStillAvailable) {
		return {
			state: 'slot_unavailable',
			message: SLOT_UNAVAILABLE_MESSAGE
		};
	}

	if (!booking.google_calendar_event_id) {
		return {
			state: 'missing_calendar_event_id',
			message: 'This booking cannot be rescheduled right now. Please contact support.'
		};
	}

	const rescheduled = await rescheduleBooking({
		rescheduleToken: token,
		newStartsAt: input.selectedStartsAt,
		newEndsAt: input.selectedEndsAt,
		changedBy: 'lead'
	});

	try {
		await updateBookingCalendarEventViaWorker({
			booking_id: rescheduled.booking.id,
			event_id: booking.google_calendar_event_id,
			booking_type: rescheduled.booking.booking_type,
			attendee_email: rescheduled.booking.email,
			attendee_name: rescheduled.booking.name,
			meeting_scope: rescheduled.booking.scope,
			starts_at_iso: rescheduled.booking.starts_at.toISOString(),
			ends_at_iso: rescheduled.booking.ends_at.toISOString(),
			reschedule_url: buildRescheduleUrl({
				requestOrigin: input.requestOrigin,
				rescheduleToken: token
			}),
			company: rescheduled.booking.company,
			is_repeat_interaction: rescheduled.booking.is_repeat_interaction,
			lead_context: {
				lead_journey_id: rescheduled.booking.lead_journey_id
			}
		});

		const syncedBooking = await updateBookingStatus({
			bookingId: rescheduled.booking.id,
			status: 'confirmed',
			calendarSyncError: null
		});

		try {
			await notifyBookingRescheduled({
				booking_id: syncedBooking.id,
				booking_type: syncedBooking.booking_type,
				attendee_name: syncedBooking.name,
				attendee_email: syncedBooking.email,
				company: syncedBooking.company,
				meeting_scope: syncedBooking.scope,
				previous_booking_time: {
					starts_at_iso: booking.starts_at.toISOString(),
					ends_at_iso: booking.ends_at.toISOString()
				},
				new_booking_time: {
					starts_at_iso: syncedBooking.starts_at.toISOString(),
					ends_at_iso: syncedBooking.ends_at.toISOString()
				},
				campaign_context: {
					lead_journey_id: syncedBooking.lead_journey_id
				},
				urls: {
					reschedule_url: buildRescheduleUrl({
						requestOrigin: input.requestOrigin,
						rescheduleToken: token
					})
				}
			});
		} catch (notificationError) {
			console.error('telegram_booking_rescheduled_failed', {
				booking_id: syncedBooking.id,
				error:
					notificationError instanceof Error
						? notificationError.message
						: 'unknown_notification_error'
			});
		}

		return {
			state: 'rescheduled',
			booking: syncedBooking,
			audit: rescheduled.audit
		};
	} catch (calendarSyncError) {
		const syncErrorMessage = toSyncErrorMessage(calendarSyncError);
		const failedBooking = await updateBookingStatus({
			bookingId: rescheduled.booking.id,
			status: 'calendar_sync_failed',
			calendarSyncError: syncErrorMessage
		});

		return {
			state: 'calendar_sync_failed',
			message: CALENDAR_SYNC_FAILED_MESSAGE,
			booking: failedBooking
		};
	}
}
