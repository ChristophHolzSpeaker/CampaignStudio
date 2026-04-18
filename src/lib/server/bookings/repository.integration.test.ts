import { describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import {
	booking_links,
	booking_reschedules,
	booking_settings,
	bookings
} from '$lib/server/db/schema';

const runIntegration = process.env.RUN_BOOKING_DB_TESTS === 'true';
const describeDb = runIntegration ? describe : describe.skip;

describeDb('booking repository integration', () => {
	it('reads booking rules and returns latest global settings', async () => {
		const repository = await import('./repository');
		const { db } = await import('$lib/server/db');

		const createdSettingIds: string[] = [];

		try {
			const leadRules = await repository.getBookingRulesByType('lead');
			if (leadRules) {
				expect(leadRules.booking_type).toBe('lead');
			} else {
				expect(leadRules).toBeNull();
			}

			const [seededSetting] = await db
				.insert(booking_settings)
				.values({
					is_paused: true,
					pause_message: 'repository integration test',
					updated_at: new Date('2100-01-01T00:00:00.000Z')
				})
				.returning();

			if (!seededSetting) {
				throw new Error('Failed to seed booking_settings integration row');
			}
			createdSettingIds.push(seededSetting.id);

			const latestSettings = await repository.getGlobalBookingSettings();

			expect(latestSettings?.id).toBe(seededSetting.id);
			expect(latestSettings?.is_paused).toBe(true);
			expect(latestSettings?.pause_message).toBe('repository integration test');
		} finally {
			if (createdSettingIds.length > 0) {
				await db.delete(booking_settings).where(inArray(booking_settings.id, createdSettingIds));
			}
		}
	});

	it('creates and updates booking records, links, and reschedule audits', async () => {
		const repository = await import('./repository');
		const { db } = await import('$lib/server/db');

		const createdBookingIds: string[] = [];
		const createdLinkIds: string[] = [];
		const createdRescheduleIds: string[] = [];

		const idSuffix = crypto.randomUUID();
		const bookingEmail = `booking-${idSuffix}@example.com`;
		const rescheduleToken = `resched-${idSuffix}`;
		const linkToken = `booking-link-${idSuffix}`;

		try {
			const createdBooking = await repository.createBookingRecord({
				bookingType: 'general',
				requester: {
					email: bookingEmail,
					name: 'Integration Lead',
					company: 'Campaign Studio',
					scope: `integration-scope-${idSuffix}`
				},
				startsAt: new Date('2026-06-01T10:00:00.000Z'),
				endsAt: new Date('2026-06-01T10:30:00.000Z'),
				status: 'confirmed',
				rescheduleToken
			});
			createdBookingIds.push(createdBooking.id);

			const fetchedById = await repository.getBookingById(createdBooking.id);
			expect(fetchedById?.id).toBe(createdBooking.id);

			const fetchedByReschedule = await repository.getBookingByRescheduleToken(rescheduleToken);
			expect(fetchedByReschedule?.id).toBe(createdBooking.id);

			const byEmail = await repository.getBookingsByEmail(bookingEmail, { limit: 10 });
			expect(byEmail.some((row) => row.id === createdBooking.id)).toBe(true);

			const upcoming = await repository.getUpcomingConfirmedBookingByEmail(bookingEmail, {
				now: new Date('2026-06-01T09:00:00.000Z')
			});
			expect(upcoming?.id).toBe(createdBooking.id);

			const updatedSchedule = await repository.updateBookingSchedule({
				bookingId: createdBooking.id,
				startsAt: new Date('2026-06-01T12:00:00.000Z'),
				endsAt: new Date('2026-06-01T12:30:00.000Z')
			});
			expect(updatedSchedule.starts_at.toISOString()).toBe('2026-06-01T12:00:00.000Z');

			const updatedEvent = await repository.updateBookingGoogleEventId({
				bookingId: createdBooking.id,
				googleCalendarEventId: `evt-${idSuffix}`
			});
			expect(updatedEvent.google_calendar_event_id).toBe(`evt-${idSuffix}`);

			const updatedRepeat = await repository.updateBookingRepeatInteraction({
				bookingId: createdBooking.id,
				isRepeatInteraction: true
			});
			expect(updatedRepeat.is_repeat_interaction).toBe(true);

			const [createdLink] = await db
				.insert(booking_links)
				.values({
					token: linkToken,
					booking_type: 'lead',
					expires_at: new Date('2026-07-01T00:00:00.000Z')
				})
				.returning();

			if (!createdLink) {
				throw new Error('Failed to seed booking_links integration row');
			}
			createdLinkIds.push(createdLink.id);

			const fetchedLink = await repository.getBookingLinkByToken(linkToken);
			expect(fetchedLink?.id).toBe(createdLink.id);

			const updatedLink = await repository.updateBookingLinkTimestamps({
				bookingLinkId: createdLink.id,
				clickedAt: new Date('2026-06-01T09:05:00.000Z'),
				bookedAt: new Date('2026-06-01T09:15:00.000Z')
			});
			expect(updatedLink.clicked_at?.toISOString()).toBe('2026-06-01T09:05:00.000Z');
			expect(updatedLink.booked_at?.toISOString()).toBe('2026-06-01T09:15:00.000Z');

			const audit = await repository.createBookingRescheduleAudit({
				bookingId: createdBooking.id,
				oldStartsAt: new Date('2026-06-01T10:00:00.000Z'),
				oldEndsAt: new Date('2026-06-01T10:30:00.000Z'),
				newStartsAt: new Date('2026-06-01T12:00:00.000Z'),
				newEndsAt: new Date('2026-06-01T12:30:00.000Z'),
				changedBy: 'system'
			});
			createdRescheduleIds.push(audit.id);

			expect(audit.booking_id).toBe(createdBooking.id);
			expect(audit.changed_by).toBe('system');
		} finally {
			if (createdRescheduleIds.length > 0) {
				await db
					.delete(booking_reschedules)
					.where(inArray(booking_reschedules.id, createdRescheduleIds));
			}
			if (createdBookingIds.length > 0) {
				await db.delete(bookings).where(inArray(bookings.id, createdBookingIds));
			}
			if (createdLinkIds.length > 0) {
				await db.delete(booking_links).where(inArray(booking_links.id, createdLinkIds));
			}
		}
	});
});
