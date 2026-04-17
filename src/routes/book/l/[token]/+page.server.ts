import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getBookingPolicy,
	getPublicBookingUnavailableMessage,
	resolveLeadBookingToken,
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

export type LeadBookingActionData = {
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

function getTokenMessage(state: 'invalid' | 'expired'): string {
	if (state === 'expired') {
		return 'This booking link has expired. Please request a new link.';
	}

	return 'This booking link is invalid.';
}

export const load: PageServerLoad = async ({ params }: { params: { token?: string } }) => {
	const token = params.token?.trim() ?? '';
	const tokenResolution = await resolveLeadBookingToken(token);

	if (tokenResolution.state !== 'usable') {
		return {
			bookingType: 'lead' as const,
			tokenState: tokenResolution.state,
			tokenMessage: getTokenMessage(tokenResolution.state),
			policyState: null,
			unavailableMessage: null
		};
	}

	const policy = await getBookingPolicy('lead');

	return {
		bookingType: 'lead' as const,
		tokenState: 'usable' as const,
		tokenMessage: null,
		policyState: policy.state,
		unavailableMessage: getPublicBookingUnavailableMessage(policy)
	};
};

export const actions: Actions = {
	default: async ({ request, params }: { request: Request; params: { token?: string } }) => {
		const token = params.token?.trim() ?? '';
		const tokenResolution = await resolveLeadBookingToken(token);

		const formData = await request.formData();
		const values = getBookingIntakeSubmission(formData);

		if (tokenResolution.state !== 'usable') {
			return fail<LeadBookingActionData>(400, {
				values,
				message: getTokenMessage(tokenResolution.state)
			});
		}

		const policy = await getBookingPolicy('lead');
		if (policy.state !== 'active') {
			return fail<LeadBookingActionData>(409, {
				values,
				message: getPublicBookingUnavailableMessage(policy) ?? 'Booking is currently unavailable.'
			});
		}

		const parseResult = bookingIntakeSchema.safeParse(values);
		if (!parseResult.success) {
			return fail<LeadBookingActionData>(400, {
				values,
				errors: toBookingIntakeFieldErrors(parseResult.error)
			});
		}

		const bookingFlow = await resolvePublicBookingSlots({
			bookingType: 'lead',
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
