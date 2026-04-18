import { z } from 'zod';

const bookingTypes = ['lead', 'general'] as const;
type BookingType = (typeof bookingTypes)[number];

export const bookingRulesAdminSchema = z
	.object({
		advanceNoticeMinutes: z.coerce
			.number({ message: 'Advance notice is required' })
			.int('Advance notice must be a whole number')
			.min(0, 'Advance notice must be zero or greater'),
		slotDurationMinutes: z.coerce
			.number({ message: 'Slot duration is required' })
			.int('Slot duration must be a whole number')
			.min(1, 'Slot duration must be at least 1 minute'),
		slotIntervalMinutes: z.coerce
			.number({ message: 'Slot interval is required' })
			.int('Slot interval must be a whole number')
			.min(1, 'Slot interval must be at least 1 minute'),
		isEnabled: z.boolean(),
		bookingType: z.enum(bookingTypes)
	})
	.superRefine((value, ctx) => {
		if (value.slotIntervalMinutes > value.slotDurationMinutes) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['slotIntervalMinutes'],
				message: 'Slot interval must not exceed slot duration'
			});
		}
	});

export const bookingPauseAdminSchema = z.object({
	isPaused: z.boolean(),
	pauseMessage: z
		.string()
		.trim()
		.max(500, 'Pause message must be 500 characters or fewer')
		.nullable()
});

export type BookingRulesAdminValues = {
	advanceNoticeMinutes: string;
	slotDurationMinutes: string;
	slotIntervalMinutes: string;
	isEnabled: boolean;
	bookingType: BookingType;
};

export type BookingPauseAdminValues = {
	isPaused: boolean;
	pauseMessage: string;
};

export type BookingRulesAdminFieldErrors = Partial<
	Record<
		'advanceNoticeMinutes' | 'slotDurationMinutes' | 'slotIntervalMinutes' | 'bookingType',
		string
	>
>;

export type BookingPauseAdminFieldErrors = Partial<Record<'pauseMessage', string>>;

export function getBookingRulesAdminValues(formData: FormData) {
	return {
		bookingType: (formData.get('booking_type')?.toString().trim() ?? '') as BookingType,
		advanceNoticeMinutes: formData.get('advance_notice_minutes')?.toString().trim() ?? '',
		slotDurationMinutes: formData.get('slot_duration_minutes')?.toString().trim() ?? '',
		slotIntervalMinutes: formData.get('slot_interval_minutes')?.toString().trim() ?? '',
		isEnabled: formData.get('is_enabled') !== null
	} satisfies BookingRulesAdminValues;
}

export function getBookingPauseAdminValues(formData: FormData): BookingPauseAdminValues {
	return {
		isPaused: formData.get('is_paused') !== null,
		pauseMessage: formData.get('pause_message')?.toString().trim() ?? ''
	};
}

export function toBookingRulesAdminFieldErrors(input: z.ZodError): BookingRulesAdminFieldErrors {
	const fieldErrors: BookingRulesAdminFieldErrors = {};

	for (const issue of input.issues) {
		const field = issue.path[0];
		if (typeof field !== 'string' || field in fieldErrors) {
			continue;
		}

		if (
			field === 'advanceNoticeMinutes' ||
			field === 'slotDurationMinutes' ||
			field === 'slotIntervalMinutes' ||
			field === 'bookingType'
		) {
			fieldErrors[field] = issue.message;
		}
	}

	return fieldErrors;
}

export function toBookingPauseAdminFieldErrors(input: z.ZodError): BookingPauseAdminFieldErrors {
	const fieldErrors: BookingPauseAdminFieldErrors = {};

	for (const issue of input.issues) {
		const field = issue.path[0];
		if (typeof field !== 'string' || field in fieldErrors) {
			continue;
		}

		if (field === 'pauseMessage') {
			fieldErrors[field] = issue.message;
		}
	}

	return fieldErrors;
}
