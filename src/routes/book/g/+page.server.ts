import { fail, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	confirmBookingSelection,
	getBookingPolicy,
	getPublicBookingUnavailableMessage,
	resolvePublicBookingSlots,
	type PublicBookingSlotDayGroup
} from '$lib/server/bookings';
import {
	bookingConfirmationSchema,
	bookingIntakeSchema,
	getBookingConfirmationSubmission,
	getBookingIntakeSubmission,
	toBookingConfirmationFieldErrors,
	toBookingIntakeFieldErrors,
	type BookingConfirmationFieldErrors,
	type BookingConfirmationSubmission,
	type BookingIntakeFieldErrors,
	type BookingIntakeSubmission
} from '$lib/validation/booking-intake';

type ClassificationView = {
	interactionKind: 'first_time' | 'repeat';
	hasUpcomingBooking: boolean;
	totalBookings: number;
	upcomingBookingStartsAt: string | null;
};

export type GeneralBookingActionData = {
	values: BookingIntakeSubmission;
	errors?: BookingIntakeFieldErrors;
	confirmationValues?: BookingConfirmationSubmission;
	confirmationErrors?: BookingConfirmationFieldErrors;
	message?: string;
	confirmationState?:
		| 'confirmed'
		| 'slot_unavailable'
		| 'booking_unavailable'
		| 'calendar_sync_failed';
	confirmedBookingId?: string;
	classification?: ClassificationView;
	availabilityState?:
		| 'available'
		| 'bookings_paused'
		| 'rules_missing'
		| 'booking_type_disabled'
		| 'invalid_window'
		| 'no_slots';
	slotGroups?: PublicBookingSlotDayGroup[];
	searchStartsAtIso?: string;
	searchEndsAtIso?: string;
};

function toClassificationView(input: {
	interactionKind: 'first_time' | 'repeat';
	hasUpcomingBooking: boolean;
	totalBookings: number;
	upcomingBookingStartsAt: Date | null;
}): ClassificationView {
	return {
		interactionKind: input.interactionKind,
		hasUpcomingBooking: input.hasUpcomingBooking,
		totalBookings: input.totalBookings,
		upcomingBookingStartsAt: input.upcomingBookingStartsAt?.toISOString() ?? null
	};
}

export const load: PageServerLoad = async () => {
	const policy = await getBookingPolicy('general');

	return {
		bookingType: 'general' as const,
		policyState: policy.state,
		unavailableMessage: getPublicBookingUnavailableMessage(policy)
	};
};

export const actions: Actions = {
	check: async ({ request }: RequestEvent) => {
		const policy = await getBookingPolicy('general');
		const unavailableMessage = getPublicBookingUnavailableMessage(policy);

		const formData = await request.formData();
		const values = getBookingIntakeSubmission(formData);

		if (policy.state !== 'active') {
			return fail<GeneralBookingActionData>(409, {
				values,
				message: unavailableMessage ?? 'Booking is currently unavailable.'
			});
		}

		const parseResult = bookingIntakeSchema.safeParse(values);
		if (!parseResult.success) {
			return fail<GeneralBookingActionData>(400, {
				values,
				errors: toBookingIntakeFieldErrors(parseResult.error)
			});
		}

		const bookingFlow = await resolvePublicBookingSlots({
			bookingType: 'general',
			requesterEmail: parseResult.data.email
		});

		return {
			values,
			classification: toClassificationView({
				interactionKind: bookingFlow.classification.interactionKind,
				hasUpcomingBooking: bookingFlow.classification.hasUpcomingBooking,
				totalBookings: bookingFlow.classification.totalBookings,
				upcomingBookingStartsAt: bookingFlow.classification.upcomingBooking?.startsAt ?? null
			}),
			availabilityState: bookingFlow.availability.state,
			slotGroups: bookingFlow.slotGroups,
			searchStartsAtIso: bookingFlow.searchStartsAt.toISOString(),
			searchEndsAtIso: bookingFlow.searchEndsAt.toISOString(),
			message:
				bookingFlow.availability.state === 'no_slots'
					? 'No slots are currently available in the next 3 days.'
					: undefined
		};
	},
	confirm: async ({ request }: RequestEvent) => {
		const policy = await getBookingPolicy('general');
		const unavailableMessage = getPublicBookingUnavailableMessage(policy);

		const formData = await request.formData();
		const values = getBookingIntakeSubmission(formData);
		const confirmationValues = getBookingConfirmationSubmission(formData);

		if (policy.state !== 'active') {
			return fail<GeneralBookingActionData>(409, {
				values,
				confirmationValues,
				confirmationState: 'booking_unavailable',
				message: unavailableMessage ?? 'Booking is currently unavailable.'
			});
		}

		const parseResult = bookingConfirmationSchema.safeParse(confirmationValues);
		if (!parseResult.success) {
			return fail<GeneralBookingActionData>(400, {
				values,
				confirmationValues,
				confirmationErrors: toBookingConfirmationFieldErrors(parseResult.error)
			});
		}

		const confirmation = await confirmBookingSelection({
			bookingType: 'general',
			intake: {
				email: parseResult.data.email,
				scope: parseResult.data.scope,
				name: parseResult.data.name,
				company: parseResult.data.company
			},
			selectedStartsAt: new Date(parseResult.data.selectedStartsAtIso),
			selectedEndsAt: new Date(parseResult.data.selectedEndsAtIso),
			requestOrigin: new URL(request.url).origin
		});

		if (confirmation.state === 'confirmed') {
			return {
				values,
				confirmationValues,
				confirmationState: 'confirmed' as const,
				confirmedBookingId: confirmation.booking.id,
				message: 'Booking confirmed. Check your inbox for the calendar invite.'
			};
		}

		const status = confirmation.state === 'calendar_sync_failed' ? 503 : 409;
		return fail<GeneralBookingActionData>(status, {
			values,
			confirmationValues,
			confirmationState:
				confirmation.state === 'slot_unavailable'
					? 'slot_unavailable'
					: confirmation.state === 'calendar_sync_failed'
						? 'calendar_sync_failed'
						: 'booking_unavailable',
			message: confirmation.message
		});
	}
};
