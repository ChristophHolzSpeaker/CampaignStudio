import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { z } from 'zod';
import { confirmBookingReschedule, resolveRescheduleBookingFlow } from '$lib/server/bookings';

const rescheduleConfirmationSchema = z.object({
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

type RescheduleConfirmationSubmission = {
	selectedStartsAtIso: string;
	selectedEndsAtIso: string;
};

type RescheduleConfirmationFieldErrors = Partial<
	Record<keyof RescheduleConfirmationSubmission, string>
>;

export type RescheduleActionData = {
	confirmationValues: RescheduleConfirmationSubmission;
	confirmationErrors?: RescheduleConfirmationFieldErrors;
	message?: string;
	confirmationState?:
		| 'rescheduled'
		| 'slot_unavailable'
		| 'booking_unavailable'
		| 'calendar_sync_failed'
		| 'missing_calendar_event_id'
		| 'invalid_token';
	updatedBookingId?: string;
	updatedStartsAtIso?: string;
	updatedEndsAtIso?: string;
	slotGroups?: Awaited<ReturnType<typeof resolveRescheduleBookingFlow>>['slotGroups'];
	availabilityState?:
		| 'available'
		| 'bookings_paused'
		| 'rules_missing'
		| 'booking_type_disabled'
		| 'invalid_window'
		| 'no_slots'
		| null;
};

function toConfirmationSubmission(formData: FormData): RescheduleConfirmationSubmission {
	return {
		selectedStartsAtIso: formData.get('selected_starts_at')?.toString().trim() ?? '',
		selectedEndsAtIso: formData.get('selected_ends_at')?.toString().trim() ?? ''
	};
}

function toConfirmationErrors(input: z.ZodError): RescheduleConfirmationFieldErrors {
	const fieldErrors: RescheduleConfirmationFieldErrors = {};

	for (const issue of input.issues) {
		const field = issue.path[0];
		if (typeof field !== 'string' || field in fieldErrors) {
			continue;
		}

		if (field === 'selectedStartsAtIso' || field === 'selectedEndsAtIso') {
			fieldErrors[field] = issue.message;
		}
	}

	return fieldErrors;
}

export const load: PageServerLoad = async ({ params }: { params: { token?: string } }) => {
	const token = params.token?.trim() ?? '';
	const flow = await resolveRescheduleBookingFlow({ rescheduleToken: token });

	return {
		tokenState: flow.resolution.state,
		message: flow.resolution.message,
		availabilityState: flow.resolution.availability?.state ?? null,
		currentBooking:
			flow.resolution.booking === null
				? null
				: {
						id: flow.resolution.booking.id,
						bookingType: flow.resolution.booking.booking_type,
						email: flow.resolution.booking.email,
						name: flow.resolution.booking.name,
						scope: flow.resolution.booking.scope,
						startsAtIso: flow.resolution.booking.starts_at.toISOString(),
						endsAtIso: flow.resolution.booking.ends_at.toISOString()
					},
		slotGroups: flow.slotGroups,
		searchStartsAtIso: flow.resolution.searchStartsAt?.toISOString() ?? null,
		searchEndsAtIso: flow.resolution.searchEndsAt?.toISOString() ?? null
	};
};

export const actions: Actions = {
	confirm: async ({ request, params }: { request: Request; params: { token?: string } }) => {
		const token = params.token?.trim() ?? '';
		const formData = await request.formData();
		const confirmationValues = toConfirmationSubmission(formData);
		const parseResult = rescheduleConfirmationSchema.safeParse(confirmationValues);

		if (!parseResult.success) {
			const flow = await resolveRescheduleBookingFlow({ rescheduleToken: token });

			return fail<RescheduleActionData>(400, {
				confirmationValues,
				confirmationErrors: toConfirmationErrors(parseResult.error),
				slotGroups: flow.slotGroups,
				availabilityState: flow.resolution.availability?.state ?? null
			});
		}

		const confirmation = await confirmBookingReschedule({
			rescheduleToken: token,
			selectedStartsAt: new Date(parseResult.data.selectedStartsAtIso),
			selectedEndsAt: new Date(parseResult.data.selectedEndsAtIso),
			requestOrigin: new URL(request.url).origin
		});

		if (confirmation.state === 'rescheduled') {
			return {
				confirmationValues,
				confirmationState: 'rescheduled' as const,
				updatedBookingId: confirmation.booking.id,
				updatedStartsAtIso: confirmation.booking.starts_at.toISOString(),
				updatedEndsAtIso: confirmation.booking.ends_at.toISOString(),
				message: 'Booking rescheduled. Your calendar invite will reflect the new time.'
			};
		}

		const flow = await resolveRescheduleBookingFlow({ rescheduleToken: token });
		const status =
			confirmation.state === 'invalid_token'
				? 400
				: confirmation.state === 'calendar_sync_failed'
					? 503
					: 409;

		return fail<RescheduleActionData>(status, {
			confirmationValues,
			confirmationState: confirmation.state,
			message: confirmation.message,
			slotGroups: flow.slotGroups,
			availabilityState: flow.resolution.availability?.state ?? null
		});
	}
};
