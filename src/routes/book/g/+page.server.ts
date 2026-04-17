import { fail, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getBookingPolicy,
	getPublicBookingUnavailableMessage,
	resolvePublicBookingSlots,
	type PublicBookingSlotDayGroup
} from '$lib/server/bookings';
import {
	bookingIntakeSchema,
	getBookingIntakeSubmission,
	toBookingIntakeFieldErrors,
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
	message?: string;
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
	default: async ({ request }: RequestEvent) => {
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
	}
};
