import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getBookingAdminSettings,
	saveBookingTypeRules,
	saveGlobalBookingPauseState
} from '$lib/server/bookings';
import {
	bookingPauseAdminSchema,
	bookingRulesAdminSchema,
	getBookingPauseAdminValues,
	getBookingRulesAdminValues,
	toBookingPauseAdminFieldErrors,
	toBookingRulesAdminFieldErrors,
	type BookingPauseAdminFieldErrors,
	type BookingPauseAdminValues,
	type BookingRulesAdminFieldErrors,
	type BookingRulesAdminValues
} from '$lib/validation/booking-admin-settings';

type BookingRuleFormState = {
	values: BookingRulesAdminValues;
	errors?: BookingRulesAdminFieldErrors;
	message?: string;
	success?: boolean;
};

type BookingPauseFormState = {
	values: BookingPauseAdminValues;
	errors?: BookingPauseAdminFieldErrors;
	message?: string;
	success?: boolean;
};

export type BookingAdminActionData = {
	rulesForm?: BookingRuleFormState;
	pauseForm?: BookingPauseFormState;
};

export const load: PageServerLoad = async () => {
	const settings = await getBookingAdminSettings();

	return {
		rules: settings.rules,
		pause: settings.pause
	};
};

export const actions: Actions = {
	updateRules: async ({ request }) => {
		const formData = await request.formData();
		const values = getBookingRulesAdminValues(formData);
		const parseResult = bookingRulesAdminSchema.safeParse(values);

		if (!parseResult.success) {
			return fail<BookingAdminActionData>(400, {
				rulesForm: {
					values,
					errors: toBookingRulesAdminFieldErrors(parseResult.error),
					message: 'Please correct the highlighted rule values.',
					success: false
				}
			});
		}

		await saveBookingTypeRules({
			bookingType: parseResult.data.bookingType,
			advanceNoticeMinutes: parseResult.data.advanceNoticeMinutes,
			slotDurationMinutes: parseResult.data.slotDurationMinutes,
			slotIntervalMinutes: parseResult.data.slotIntervalMinutes,
			isEnabled: parseResult.data.isEnabled
		});

		return {
			rulesForm: {
				values,
				message: `${parseResult.data.bookingType} booking rules updated.`,
				success: true
			}
		};
	},
	updatePause: async ({ request }) => {
		const formData = await request.formData();
		const values = getBookingPauseAdminValues(formData);
		const parseResult = bookingPauseAdminSchema.safeParse({
			isPaused: values.isPaused,
			pauseMessage: values.pauseMessage.length === 0 ? null : values.pauseMessage
		});

		if (!parseResult.success) {
			return fail<BookingAdminActionData>(400, {
				pauseForm: {
					values,
					errors: toBookingPauseAdminFieldErrors(parseResult.error),
					message: 'Please correct the pause message and try again.',
					success: false
				}
			});
		}

		await saveGlobalBookingPauseState({
			isPaused: parseResult.data.isPaused,
			pauseMessage: parseResult.data.pauseMessage
		});

		return {
			pauseForm: {
				values,
				message: parseResult.data.isPaused
					? 'Bookings are now globally paused.'
					: 'Bookings are now active.',
				success: true
			}
		};
	}
};
