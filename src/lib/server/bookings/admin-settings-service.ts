import type { BookingPauseState, BookingRulesSnapshot, BookingType } from './contracts';
import {
	getBookingRulesByType,
	getGlobalBookingSettings,
	upsertBookingRulesByType,
	upsertGlobalBookingSettings
} from './repository';

export type BookingAdminSettingsSnapshot = {
	rules: Record<BookingType, BookingRulesSnapshot | null>;
	pause: BookingPauseState;
};

function normalizePauseState(
	input: Awaited<ReturnType<typeof getGlobalBookingSettings>>
): BookingPauseState {
	if (!input) {
		return {
			isPaused: false,
			pauseMessage: null,
			settingsRowId: null,
			updatedAt: null
		};
	}

	return {
		isPaused: input.is_paused,
		pauseMessage: input.pause_message,
		settingsRowId: input.id,
		updatedAt: input.updated_at
	};
}

function normalizeRuleSnapshot(
	bookingType: BookingType,
	row: Awaited<ReturnType<typeof getBookingRulesByType>>
): BookingRulesSnapshot | null {
	if (!row) {
		return null;
	}

	return {
		bookingType,
		advanceNoticeMinutes: row.advance_notice_minutes,
		slotDurationMinutes: row.slot_duration_minutes,
		slotIntervalMinutes: row.slot_interval_minutes,
		isEnabled: row.is_enabled,
		ruleRowId: row.id,
		updatedAt: row.updated_at
	};
}

export async function getBookingAdminSettings(): Promise<BookingAdminSettingsSnapshot> {
	const [leadRules, generalRules, pauseSettings] = await Promise.all([
		getBookingRulesByType('lead'),
		getBookingRulesByType('general'),
		getGlobalBookingSettings()
	]);

	return {
		rules: {
			lead: normalizeRuleSnapshot('lead', leadRules),
			general: normalizeRuleSnapshot('general', generalRules)
		},
		pause: normalizePauseState(pauseSettings)
	};
}

export async function saveBookingTypeRules(input: {
	bookingType: BookingType;
	advanceNoticeMinutes: number;
	slotDurationMinutes: number;
	slotIntervalMinutes: number;
	isEnabled: boolean;
}): Promise<BookingRulesSnapshot> {
	const updated = await upsertBookingRulesByType({
		bookingType: input.bookingType,
		advanceNoticeMinutes: input.advanceNoticeMinutes,
		slotDurationMinutes: input.slotDurationMinutes,
		slotIntervalMinutes: input.slotIntervalMinutes,
		isEnabled: input.isEnabled
	});

	return {
		bookingType: input.bookingType,
		advanceNoticeMinutes: updated.advance_notice_minutes,
		slotDurationMinutes: updated.slot_duration_minutes,
		slotIntervalMinutes: updated.slot_interval_minutes,
		isEnabled: updated.is_enabled,
		ruleRowId: updated.id,
		updatedAt: updated.updated_at
	};
}

export async function saveGlobalBookingPauseState(input: {
	isPaused: boolean;
	pauseMessage: string | null;
}): Promise<BookingPauseState> {
	const updated = await upsertGlobalBookingSettings({
		isPaused: input.isPaused,
		pauseMessage: input.pauseMessage
	});

	return {
		isPaused: updated.is_paused,
		pauseMessage: updated.pause_message,
		settingsRowId: updated.id,
		updatedAt: updated.updated_at
	};
}
