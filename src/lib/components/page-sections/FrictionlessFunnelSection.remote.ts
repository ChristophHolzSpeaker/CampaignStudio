import { form } from '$app/server';
import { z } from 'zod';

const bookingRequestSchema = z.object({
	fullName: z.string().trim().min(2, 'Please enter your full name.'),
	organization: z.string().trim().min(2, 'Please enter your organization.'),
	email: z.string().trim().email('Please provide a valid email address.'),
	eventDetails: z
		.string()
		.trim()
		.min(20, 'Please provide a bit more detail about your event goals.')
});

export const submitBookingRequest = form(bookingRequestSchema, async () => {
	return {
		success: true,
		message: 'Thanks! Your booking request is captured. We will follow up shortly.'
	};
});
