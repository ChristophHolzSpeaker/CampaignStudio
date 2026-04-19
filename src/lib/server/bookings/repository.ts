import { db } from '$lib/server/db';
import {
	booking_links,
	booking_reschedules,
	booking_rules,
	booking_settings,
	bookings
} from '$lib/server/db/schema';
import { and, asc, desc, eq, gt, gte, isNull, lt, ne } from 'drizzle-orm';
import type {
	BookingLinkRecord,
	BookingRecord,
	BookingRescheduleActor,
	BookingRescheduleRecord,
	BookingRuleRecord,
	BookingSettingsRecord,
	BookingStatus,
	BookingType,
	CreateBookingInput
} from './contracts';

export async function getBookingRulesByType(
	bookingType: BookingType
): Promise<BookingRuleRecord | null> {
	const [row] = await db
		.select()
		.from(booking_rules)
		.where(eq(booking_rules.booking_type, bookingType))
		.limit(1);

	return row ?? null;
}

export async function upsertBookingRulesByType(input: {
	bookingType: BookingType;
	advanceNoticeMinutes: number;
	slotDurationMinutes: number;
	slotIntervalMinutes: number;
	isEnabled: boolean;
	updatedAt?: Date;
}): Promise<BookingRuleRecord> {
	const updatedAt = input.updatedAt ?? new Date();

	const [upserted] = await db
		.insert(booking_rules)
		.values({
			booking_type: input.bookingType,
			advance_notice_minutes: input.advanceNoticeMinutes,
			slot_duration_minutes: input.slotDurationMinutes,
			slot_interval_minutes: input.slotIntervalMinutes,
			is_enabled: input.isEnabled,
			updated_at: updatedAt
		})
		.onConflictDoUpdate({
			target: booking_rules.booking_type,
			set: {
				advance_notice_minutes: input.advanceNoticeMinutes,
				slot_duration_minutes: input.slotDurationMinutes,
				slot_interval_minutes: input.slotIntervalMinutes,
				is_enabled: input.isEnabled,
				updated_at: updatedAt
			}
		})
		.returning();

	if (!upserted) {
		throw new Error(`Failed to upsert booking rules for type ${input.bookingType}`);
	}

	return upserted;
}

export async function getGlobalBookingSettings(): Promise<BookingSettingsRecord | null> {
	const [row] = await db
		.select()
		.from(booking_settings)
		.orderBy(desc(booking_settings.updated_at))
		.limit(1);

	return row ?? null;
}

export async function upsertGlobalBookingSettings(input: {
	isPaused: boolean;
	pauseMessage: string | null;
	updatedAt?: Date;
}): Promise<BookingSettingsRecord> {
	const updatedAt = input.updatedAt ?? new Date();
	const existing = await getGlobalBookingSettings();

	if (!existing) {
		const [created] = await db
			.insert(booking_settings)
			.values({
				is_paused: input.isPaused,
				pause_message: input.pauseMessage,
				updated_at: updatedAt
			})
			.returning();

		if (!created) {
			throw new Error('Failed to create booking settings row');
		}

		return created;
	}

	const [updated] = await db
		.update(booking_settings)
		.set({
			is_paused: input.isPaused,
			pause_message: input.pauseMessage,
			updated_at: updatedAt
		})
		.where(eq(booking_settings.id, existing.id))
		.returning();

	if (!updated) {
		throw new Error(`Failed to update booking settings row ${existing.id}`);
	}

	return updated;
}

export async function getBookingLinkByToken(token: string): Promise<BookingLinkRecord | null> {
	const [row] = await db
		.select()
		.from(booking_links)
		.where(eq(booking_links.token, token))
		.limit(1);

	return row ?? null;
}

export async function getBookingsByEmail(
	email: string,
	input?: { limit?: number }
): Promise<BookingRecord[]> {
	const limit = input?.limit ?? 50;

	return db
		.select()
		.from(bookings)
		.where(eq(bookings.email, email))
		.orderBy(desc(bookings.starts_at))
		.limit(limit);
}

export async function getUpcomingConfirmedBookingByEmail(
	email: string,
	input?: { now?: Date }
): Promise<BookingRecord | null> {
	const now = input?.now ?? new Date();

	const [row] = await db
		.select()
		.from(bookings)
		.where(
			and(eq(bookings.email, email), eq(bookings.status, 'confirmed'), gte(bookings.starts_at, now))
		)
		.orderBy(asc(bookings.starts_at))
		.limit(1);

	return row ?? null;
}

export async function createBookingRecord(input: CreateBookingInput): Promise<BookingRecord> {
	const [created] = await db
		.insert(bookings)
		.values({
			booking_type: input.bookingType,
			lead_journey_id: input.requester.leadJourneyId ?? null,
			email: input.requester.email,
			name: input.requester.name ?? null,
			company: input.requester.company ?? null,
			scope: input.requester.scope,
			status: input.status ?? 'pending_calendar_sync',
			starts_at: input.startsAt,
			ends_at: input.endsAt,
			reschedule_token: input.rescheduleToken ?? null,
			calendar_sync_error: input.calendarSyncError ?? null,
			is_repeat_interaction: input.isRepeatInteraction ?? false
		})
		.returning();

	if (!created) {
		throw new Error('Failed to create booking record');
	}

	return created;
}

export async function getOverlappingActiveBooking(input: {
	startsAt: Date;
	endsAt: Date;
	excludeBookingId?: string;
}): Promise<BookingRecord | null> {
	const conditions = [
		lt(bookings.starts_at, input.endsAt),
		gt(bookings.ends_at, input.startsAt),
		ne(bookings.status, 'cancelled')
	];

	if (input.excludeBookingId) {
		conditions.push(ne(bookings.id, input.excludeBookingId));
	}

	const [row] = await db
		.select()
		.from(bookings)
		.where(and(...conditions))
		.orderBy(asc(bookings.starts_at))
		.limit(1);

	return row ?? null;
}

export async function getBookingByRescheduleToken(token: string): Promise<BookingRecord | null> {
	const [row] = await db
		.select()
		.from(bookings)
		.where(eq(bookings.reschedule_token, token))
		.limit(1);

	return row ?? null;
}

export async function getBookingById(bookingId: string): Promise<BookingRecord | null> {
	const [row] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);

	return row ?? null;
}

export async function updateBookingSchedule(input: {
	bookingId: string;
	startsAt: Date;
	endsAt: Date;
	updatedAt?: Date;
}): Promise<BookingRecord> {
	const [updated] = await db
		.update(bookings)
		.set({
			starts_at: input.startsAt,
			ends_at: input.endsAt,
			updated_at: input.updatedAt ?? new Date()
		})
		.where(eq(bookings.id, input.bookingId))
		.returning();

	if (!updated) {
		throw new Error(`Booking ${input.bookingId} was not found for schedule update`);
	}

	return updated;
}

export async function updateBookingGoogleEventId(input: {
	bookingId: string;
	googleCalendarEventId: string;
	status?: BookingStatus;
	calendarSyncError?: string | null;
	updatedAt?: Date;
}): Promise<BookingRecord> {
	const [updated] = await db
		.update(bookings)
		.set({
			google_calendar_event_id: input.googleCalendarEventId,
			status: input.status,
			calendar_sync_error: input.calendarSyncError ?? null,
			updated_at: input.updatedAt ?? new Date()
		})
		.where(eq(bookings.id, input.bookingId))
		.returning();

	if (!updated) {
		throw new Error(`Booking ${input.bookingId} was not found for event-id update`);
	}

	return updated;
}

export async function updateBookingStatus(input: {
	bookingId: string;
	status: BookingStatus;
	calendarSyncError?: string | null;
	updatedAt?: Date;
}): Promise<BookingRecord> {
	const [updated] = await db
		.update(bookings)
		.set({
			status: input.status,
			calendar_sync_error: input.calendarSyncError ?? null,
			updated_at: input.updatedAt ?? new Date()
		})
		.where(eq(bookings.id, input.bookingId))
		.returning();

	if (!updated) {
		throw new Error(`Booking ${input.bookingId} was not found for status update`);
	}

	return updated;
}

export async function updateBookingRepeatInteraction(input: {
	bookingId: string;
	isRepeatInteraction: boolean;
	updatedAt?: Date;
}): Promise<BookingRecord> {
	const [updated] = await db
		.update(bookings)
		.set({
			is_repeat_interaction: input.isRepeatInteraction,
			updated_at: input.updatedAt ?? new Date()
		})
		.where(eq(bookings.id, input.bookingId))
		.returning();

	if (!updated) {
		throw new Error(`Booking ${input.bookingId} was not found for repeat update`);
	}

	return updated;
}

export async function markBookingConfirmationEmailSent(input: {
	bookingId: string;
	providerMessageId: string;
	sentAt?: Date;
}): Promise<BookingRecord | null> {
	const sentAt = input.sentAt ?? new Date();
	const [updated] = await db
		.update(bookings)
		.set({
			booking_confirmation_email_sent_at: sentAt,
			booking_confirmation_email_provider_message_id: input.providerMessageId,
			updated_at: sentAt
		})
		.where(
			and(eq(bookings.id, input.bookingId), isNull(bookings.booking_confirmation_email_sent_at))
		)
		.returning();

	return updated ?? null;
}

export async function updateBookingLinkTimestamps(input: {
	bookingLinkId: string;
	clickedAt?: Date | null;
	bookedAt?: Date | null;
	updatedAt?: Date;
}): Promise<BookingLinkRecord> {
	const [updated] = await db
		.update(booking_links)
		.set({
			clicked_at: input.clickedAt,
			booked_at: input.bookedAt,
			updated_at: input.updatedAt ?? new Date()
		})
		.where(eq(booking_links.id, input.bookingLinkId))
		.returning();

	if (!updated) {
		throw new Error(`Booking link ${input.bookingLinkId} was not found for timestamp update`);
	}

	return updated;
}

export async function markBookingLinkBookedAt(input: {
	bookingLinkId: string;
	bookedAt: Date;
	updatedAt?: Date;
}): Promise<BookingLinkRecord> {
	const [updated] = await db
		.update(booking_links)
		.set({
			booked_at: input.bookedAt,
			updated_at: input.updatedAt ?? new Date()
		})
		.where(eq(booking_links.id, input.bookingLinkId))
		.returning();

	if (!updated) {
		throw new Error(`Booking link ${input.bookingLinkId} was not found for booked-at update`);
	}

	return updated;
}

export async function markBookingLinkClickedAt(input: {
	bookingLinkId: string;
	clickedAt: Date;
	updatedAt?: Date;
}): Promise<BookingLinkRecord | null> {
	const [updated] = await db
		.update(booking_links)
		.set({
			clicked_at: input.clickedAt,
			updated_at: input.updatedAt ?? new Date()
		})
		.where(and(eq(booking_links.id, input.bookingLinkId), isNull(booking_links.clicked_at)))
		.returning();

	return updated ?? null;
}

export async function createBookingRescheduleAudit(input: {
	bookingId: string;
	oldStartsAt: Date;
	oldEndsAt: Date;
	newStartsAt: Date;
	newEndsAt: Date;
	changedBy: BookingRescheduleActor;
	changedAt?: Date;
}): Promise<BookingRescheduleRecord> {
	const [created] = await db
		.insert(booking_reschedules)
		.values({
			booking_id: input.bookingId,
			old_starts_at: input.oldStartsAt,
			old_ends_at: input.oldEndsAt,
			new_starts_at: input.newStartsAt,
			new_ends_at: input.newEndsAt,
			changed_by: input.changedBy,
			changed_at: input.changedAt ?? new Date()
		})
		.returning();

	if (!created) {
		throw new Error(`Failed to create reschedule audit for booking ${input.bookingId}`);
	}

	return created;
}
