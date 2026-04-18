import { db } from '$lib/server/db';
import {
	booking_links,
	booking_reschedules,
	booking_rules,
	booking_settings,
	bookings
} from '$lib/server/db/schema';
import { and, asc, desc, eq, gt, gte, lt, ne } from 'drizzle-orm';
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

export async function getGlobalBookingSettings(): Promise<BookingSettingsRecord | null> {
	const [row] = await db
		.select()
		.from(booking_settings)
		.orderBy(desc(booking_settings.updated_at))
		.limit(1);

	return row ?? null;
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
}): Promise<BookingRecord | null> {
	const [row] = await db
		.select()
		.from(bookings)
		.where(
			and(
				lt(bookings.starts_at, input.endsAt),
				gt(bookings.ends_at, input.startsAt),
				ne(bookings.status, 'cancelled')
			)
		)
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
