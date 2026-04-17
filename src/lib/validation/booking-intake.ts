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

export type BookingIntakeSubmission = {
	email: string;
	scope: string;
	name: string;
	company: string;
};

export type BookingIntakeFieldErrors = Partial<Record<keyof BookingIntakeSubmission, string>>;

export function getBookingIntakeSubmission(formData: FormData): BookingIntakeSubmission {
	return {
		email: formData.get('email')?.toString().trim() ?? '',
		scope: formData.get('scope')?.toString().trim() ?? '',
		name: formData.get('name')?.toString().trim() ?? '',
		company: formData.get('company')?.toString().trim() ?? ''
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
