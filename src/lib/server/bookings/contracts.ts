import type {
	booking_links,
	booking_reschedules,
	booking_rules,
	booking_settings,
	bookings
} from '$lib/server/db/schema';

export const bookingTypes = ['lead', 'general'] as const;
export type BookingType = (typeof bookingTypes)[number];
export type BookingFlowType = BookingType;

export const bookingStatuses = [
	'pending_calendar_sync',
	'confirmed',
	'calendar_sync_failed',
	'cancelled'
] as const;
export type BookingStatus = (typeof bookingStatuses)[number];

export const bookingRescheduleActors = ['lead', 'admin', 'system'] as const;
export type BookingRescheduleActor = (typeof bookingRescheduleActors)[number];

export const requesterInteractionKinds = ['first_time', 'repeat'] as const;
export type RequesterInteractionKind = (typeof requesterInteractionKinds)[number];

export const bookingPolicyStates = [
	'active',
	'globally_paused',
	'rules_missing',
	'type_disabled'
] as const;
export type BookingPolicyState = (typeof bookingPolicyStates)[number];

export const tokenResolutionStates = ['usable', 'invalid', 'expired'] as const;
export type TokenResolutionState = (typeof tokenResolutionStates)[number];

export const bookingAvailabilityStates = [
	'available',
	'bookings_paused',
	'rules_missing',
	'booking_type_disabled',
	'invalid_window',
	'no_slots'
] as const;
export type BookingAvailabilityState = (typeof bookingAvailabilityStates)[number];

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

export type BookingRequester = {
	email: string;
	name?: string | null;
	company?: string | null;
	scope: string;
	leadJourneyId?: string | null;
};

export type BookingPauseState = {
	isPaused: boolean;
	pauseMessage: string | null;
	settingsRowId: string | null;
	updatedAt: Date | null;
};

export type BookingRulesSnapshot = {
	bookingType: BookingType;
	advanceNoticeMinutes: number;
	slotDurationMinutes: number;
	slotIntervalMinutes: number;
	isEnabled: boolean;
	ruleRowId: string;
	updatedAt: Date;
};

export type ActiveBookingPolicy = {
	state: 'active';
	bookingType: BookingType;
	pause: BookingPauseState;
	rules: BookingRulesSnapshot;
};

export type PausedBookingPolicy = {
	state: 'globally_paused';
	bookingType: BookingType;
	pause: BookingPauseState;
	rules: BookingRulesSnapshot | null;
};

export type MissingRulesBookingPolicy = {
	state: 'rules_missing';
	bookingType: BookingType;
	pause: BookingPauseState;
	rules: null;
};

export type DisabledTypeBookingPolicy = {
	state: 'type_disabled';
	bookingType: BookingType;
	pause: BookingPauseState;
	rules: BookingRulesSnapshot;
};

export type BookingPolicyResult =
	| ActiveBookingPolicy
	| PausedBookingPolicy
	| MissingRulesBookingPolicy
	| DisabledTypeBookingPolicy;

export type BookingLinkResolutionContext = {
	bookingType: BookingType;
	token: string;
	bookingLinkId: string;
	leadJourneyId: string | null;
	campaignId: number | null;
	expiresAt: Date;
	clickedAt: Date | null;
	bookedAt: Date | null;
	metadata: unknown;
};

export type BookingTokenUsableResult = {
	state: 'usable';
	context: BookingLinkResolutionContext;
};

export type BookingTokenInvalidResult = {
	state: 'invalid';
	reason: 'not_found' | 'type_mismatch';
};

export type BookingTokenExpiredResult = {
	state: 'expired';
	context: BookingLinkResolutionContext;
};

export type BookingTokenResolutionResult =
	| BookingTokenUsableResult
	| BookingTokenInvalidResult
	| BookingTokenExpiredResult;

export type RequesterRecentBookingSummary = {
	bookingId: string;
	status: BookingStatus;
	startsAt: Date;
	endsAt: Date;
	bookingType: BookingType;
	isRepeatInteraction: boolean;
};

export type BookingRequesterClassification = {
	email: string;
	normalizedEmail: string;
	hasPriorBookings: boolean;
	hasUpcomingBooking: boolean;
	interactionKind: RequesterInteractionKind;
	upcomingBooking: RequesterRecentBookingSummary | null;
	recentBooking: RequesterRecentBookingSummary | null;
	totalBookings: number;
};

export type BookingSlotRequestInput = {
	bookingType: BookingType;
	searchStartsAt: Date;
	searchEndsAt: Date;
	rules: BookingRulesSnapshot;
	busyIntervals: CalendarBusyInterval[];
	now?: Date;
};

export type BookingSlot = {
	startsAt: Date;
	endsAt: Date;
	bookingType: BookingType;
	source: 'computed';
};

export type BookingSlotResult = {
	state: 'slots_available' | 'no_slots' | 'invalid_window';
	slots: BookingSlot[];
	searchStartsAt: Date;
	searchEndsAt: Date;
};

export type BookingAvailabilityResult = {
	state: BookingAvailabilityState;
	policy: BookingPolicyResult;
	slots: BookingSlot[];
	searchStartsAt: Date;
	searchEndsAt: Date;
	reason?: string;
};

export type CalendarBusyInterval = {
	startsAt: Date;
	endsAt: Date;
	source: 'calendar' | 'manual' | 'unknown';
	label?: string;
	raw?: unknown;
};

export type CalendarBusyIntervalRequest = {
	rangeStartsAt: Date;
	rangeEndsAt: Date;
	calendarId?: string;
};

export type CalendarBusyIntervalResponse = {
	intervals: CalendarBusyInterval[];
	providerName: string;
};

export type CreateBookingInput = {
	bookingType: BookingType;
	requester: BookingRequester;
	startsAt: Date;
	endsAt: Date;
	status?: BookingStatus;
	calendarSyncError?: string | null;
	rescheduleToken?: string | null;
	isRepeatInteraction?: boolean;
};

export type CreateBookingResult = {
	booking: BookingRecord;
};

export type RescheduleBookingInput = {
	rescheduleToken: string;
	newStartsAt: Date;
	newEndsAt: Date;
	changedBy: BookingRescheduleActor;
};

export type RescheduleBookingResult = {
	booking: BookingRecord;
	audit: BookingRescheduleRecord;
};

export type AttachCalendarEventIdInput = {
	bookingId: string;
	googleCalendarEventId: string;
};

export type AttachCalendarEventIdResult = {
	booking: BookingRecord;
};

export type MarkRepeatInteractionInput = {
	bookingId: string;
	isRepeatInteraction: boolean;
};

export type MarkRepeatInteractionResult = {
	booking: BookingRecord;
};

export type BookingConfirmationState =
	| 'confirmed'
	| 'slot_unavailable'
	| 'booking_unavailable'
	| 'calendar_sync_failed'
	| 'invalid_token';

export type BookingConfirmationIntake = {
	email: string;
	scope: string;
	name?: string;
	company?: string;
};

export type BookingConfirmationLeadTokenContext = {
	token: string;
	bookingLinkId: string;
	leadJourneyId: string | null;
	campaignId: number | null;
	metadata: unknown;
};

export type ConfirmBookingInput = {
	bookingType: BookingType;
	intake: BookingConfirmationIntake;
	selectedStartsAt: Date;
	selectedEndsAt: Date;
	requestOrigin: string;
	calendarId?: string;
	now?: Date;
	leadTokenContext?: BookingConfirmationLeadTokenContext;
};

export type ConfirmBookingResult =
	| {
			state: 'confirmed';
			booking: BookingRecord;
			calendarEventId: string;
	  }
	| {
			state: 'slot_unavailable';
			message: string;
	  }
	| {
			state: 'booking_unavailable';
			message: string;
	  }
	| {
			state: 'calendar_sync_failed';
			booking: BookingRecord;
			message: string;
	  }
	| {
			state: 'invalid_token';
			message: string;
	  };

export type RescheduleBookingResolutionState =
	| 'usable'
	| 'invalid_token'
	| 'booking_not_found'
	| 'booking_unavailable';

export type RescheduleBookingResolution = {
	state: RescheduleBookingResolutionState;
	booking: BookingRecord | null;
	availability: BookingAvailabilityResult | null;
	searchStartsAt: Date | null;
	searchEndsAt: Date | null;
	message: string | null;
};

export type ConfirmBookingRescheduleInput = {
	rescheduleToken: string;
	selectedStartsAt: Date;
	selectedEndsAt: Date;
	requestOrigin: string;
	now?: Date;
};

export type ConfirmBookingRescheduleResult =
	| {
			state: 'rescheduled';
			booking: BookingRecord;
			audit: BookingRescheduleRecord;
	  }
	| {
			state:
				| 'invalid_token'
				| 'booking_unavailable'
				| 'slot_unavailable'
				| 'calendar_sync_failed'
				| 'missing_calendar_event_id';
			message: string;
			booking?: BookingRecord;
	  };
