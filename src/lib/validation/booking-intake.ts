import { z } from 'zod';

export const bookingIntakeSchema = z.object({
	email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
	scope: z
		.string()
		.trim()
		.min(2, 'Meeting purpose is required')
		.max(500, 'Meeting purpose is too long'),
	name: z.string().trim().max(120, 'Name is too long').optional(),
	company: z.string().trim().max(120, 'Company is too long').optional()
});

export const bookingConfirmationSchema = bookingIntakeSchema.extend({
	selectedStartsAtIso: z
		.string()
		.trim()
		.min(1, 'Please select a slot')
		.refine((value) => !Number.isNaN(Date.parse(value)), 'Selected slot is invalid'),
	selectedEndsAtIso: z
		.string()
		.trim()
		.min(1, 'Please select a slot')
		.refine((value) => !Number.isNaN(Date.parse(value)), 'Selected slot is invalid')
});

export type BookingIntakeSubmission = {
	email: string;
	scope: string;
	name: string;
	company: string;
};

export type BookingConfirmationSubmission = BookingIntakeSubmission & {
	selectedStartsAtIso: string;
	selectedEndsAtIso: string;
};

export type BookingIntakeFieldErrors = Partial<Record<keyof BookingIntakeSubmission, string>>;
export type BookingConfirmationFieldErrors = Partial<
	Record<keyof BookingConfirmationSubmission, string>
>;

export function getBookingIntakeSubmission(formData: FormData): BookingIntakeSubmission {
	return {
		email: formData.get('email')?.toString().trim() ?? '',
		scope: formData.get('scope')?.toString().trim() ?? '',
		name: formData.get('name')?.toString().trim() ?? '',
		company: formData.get('company')?.toString().trim() ?? ''
	};
}

export function getBookingConfirmationSubmission(
	formData: FormData
): BookingConfirmationSubmission {
	return {
		...getBookingIntakeSubmission(formData),
		selectedStartsAtIso: formData.get('selected_starts_at')?.toString().trim() ?? '',
		selectedEndsAtIso: formData.get('selected_ends_at')?.toString().trim() ?? ''
	};
}

export function toBookingIntakeFieldErrors(input: z.ZodError): BookingIntakeFieldErrors {
	const fieldErrors: BookingIntakeFieldErrors = {};

	for (const issue of input.issues) {
		const field = issue.path[0];
		if (typeof field !== 'string') {
			continue;
		}

		if (field in fieldErrors) {
			continue;
		}

		if (field === 'email' || field === 'scope' || field === 'name' || field === 'company') {
			fieldErrors[field] = issue.message;
		}
	}

	return fieldErrors;
}

export function toBookingConfirmationFieldErrors(
	input: z.ZodError
): BookingConfirmationFieldErrors {
	const fieldErrors: BookingConfirmationFieldErrors = {};

	for (const issue of input.issues) {
		const field = issue.path[0];
		if (typeof field !== 'string') {
			continue;
		}

		if (field in fieldErrors) {
			continue;
		}

		if (
			field === 'email' ||
			field === 'scope' ||
			field === 'name' ||
			field === 'company' ||
			field === 'selectedStartsAtIso' ||
			field === 'selectedEndsAtIso'
		) {
			fieldErrors[field] = issue.message;
		}
	}

	return fieldErrors;
}
