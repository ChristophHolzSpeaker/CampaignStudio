import type {
	booking_links,
	booking_reschedules,
	booking_rules,
	booking_settings,
	bookings
} from '$lib/server/db/schema';

export const bookingTypes = ['lead', 'general'] as const;
export type BookingType = (typeof bookingTypes)[number];

export const bookingStatuses = ['confirmed', 'cancelled'] as const;
export type BookingStatus = (typeof bookingStatuses)[number];

export const bookingRescheduleActors = ['lead', 'admin', 'system'] as const;
export type BookingRescheduleActor = (typeof bookingRescheduleActors)[number];

export type BookingLinkRecord = typeof booking_links.$inferSelect;
export type NewBookingLinkRecord = typeof booking_links.$inferInsert;

export type BookingRecord = typeof bookings.$inferSelect;
export type NewBookingRecord = typeof bookings.$inferInsert;

export type BookingRuleRecord = typeof booking_rules.$inferSelect;
export type NewBookingRuleRecord = typeof booking_rules.$inferInsert;

export type BookingSettingsRecord = typeof booking_settings.$inferSelect;
export type NewBookingSettingsRecord = typeof booking_settings.$inferInsert;

export type BookingRescheduleRecord = typeof booking_reschedules.$inferSelect;
export type NewBookingRescheduleRecord = typeof booking_reschedules.$inferInsert;
