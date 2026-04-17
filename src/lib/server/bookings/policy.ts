import type {
	BookingPauseState,
	BookingPolicyResult,
	BookingRulesSnapshot,
	BookingType
} from './contracts';
import { getBookingRulesByType, getGlobalBookingSettings } from './repository';

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

export async function getBookingPolicy(bookingType: BookingType): Promise<BookingPolicyResult> {
	const [settingsRow, rulesRow] = await Promise.all([
		getGlobalBookingSettings(),
		getBookingRulesByType(bookingType)
	]);

	const pause = normalizePauseState(settingsRow);
	const rules = normalizeRuleSnapshot(bookingType, rulesRow);

	if (!rules) {
		return {
			state: 'rules_missing',
			bookingType,
			pause,
			rules: null
		};
	}

	if (pause.isPaused) {
		return {
			state: 'globally_paused',
			bookingType,
			pause,
			rules
		};
	}

	if (!rules.isEnabled) {
		return {
			state: 'type_disabled',
			bookingType,
			pause,
			rules
		};
	}

	return {
		state: 'active',
		bookingType,
		pause,
		rules
	};
}

export async function isBookingsGloballyPaused(): Promise<BookingPauseState> {
	const settingsRow = await getGlobalBookingSettings();
	return normalizePauseState(settingsRow);
}
