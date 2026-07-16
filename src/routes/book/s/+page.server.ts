import { fail, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	confirmBookingSelection,
	getBookingPolicy,
	getPublicBookingUnavailableMessage,
	isSlotInPublicBookingGroups,
	resolvePublicBookingSlotPreview,
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
import { notifyBookingFormSubmission } from '$lib/server/notifications/booking-form-submission';
import {
	getSpecialBookingSlotProfile,
	SPECIAL_BOOKING_NO_SLOTS_MESSAGE
} from './special-booking-profile';

type ClassificationView = {
	interactionKind: 'first_time' | 'repeat';
	hasUpcomingBooking: boolean;
	totalBookings: number;
	upcomingBookingStartsAt: string | null;
};

export type SpecialBookingActionData = {
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
	slotTimeZone?: string;
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
	const slotProfile = getSpecialBookingSlotProfile();

	if (policy.state !== 'active') {
		return {
			bookingType: 'general' as const,
			policyState: policy.state,
			unavailableMessage: getPublicBookingUnavailableMessage(policy)
		};
	}

	const slotPreview = await resolvePublicBookingSlotPreview({
		bookingType: 'general',
		slotProfile
	});

	return {
		bookingType: 'general' as const,
		policyState: policy.state,
		unavailableMessage: getPublicBookingUnavailableMessage(policy),
		availabilityState: slotPreview.availability.state,
		slotGroups: slotPreview.slotGroups,
		searchStartsAtIso: slotPreview.searchStartsAt.toISOString(),
		searchEndsAtIso: slotPreview.searchEndsAt.toISOString(),
		slotTimeZone: slotProfile.timeZone,
		message:
			slotPreview.availability.state === 'no_slots' ? SPECIAL_BOOKING_NO_SLOTS_MESSAGE : undefined
	};
};

export const actions: Actions = {
	check: async ({ request }: RequestEvent) => {
		const policy = await getBookingPolicy('general');
		const unavailableMessage = getPublicBookingUnavailableMessage(policy);
		const slotProfile = getSpecialBookingSlotProfile();

		const formData = await request.formData();
		const values = getBookingIntakeSubmission(formData);

		if (policy.state !== 'active') {
			return fail<SpecialBookingActionData>(409, {
				values,
				message: unavailableMessage ?? 'Briefing is currently unavailable.'
			});
		}

		const parseResult = bookingIntakeSchema.safeParse(values);
		if (!parseResult.success) {
			return fail<SpecialBookingActionData>(400, {
				values,
				errors: toBookingIntakeFieldErrors(parseResult.error)
			});
		}

		try {
			await notifyBookingFormSubmission({
				flow: 'book_s',
				email: parseResult.data.email,
				name: parseResult.data.name ?? null,
				phone: parseResult.data.phone ?? null,
				company: parseResult.data.company ?? null,
				scope: parseResult.data.scope,
				pagePath: '/book/s'
			});
		} catch (error) {
			console.error('booking_form_submission_notification_failed', {
				flow: 'book_s',
				error: error instanceof Error ? error.message : 'unknown_error'
			});
		}

		const bookingFlow = await resolvePublicBookingSlots({
			bookingType: 'general',
			requesterEmail: parseResult.data.email,
			slotProfile
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
			slotTimeZone: slotProfile.timeZone,
			message:
				bookingFlow.availability.state === 'no_slots' ? SPECIAL_BOOKING_NO_SLOTS_MESSAGE : undefined
		};
	},
	confirm: async ({ request }: RequestEvent) => {
		const policy = await getBookingPolicy('general');
		const unavailableMessage = getPublicBookingUnavailableMessage(policy);

		const formData = await request.formData();
		const values = getBookingIntakeSubmission(formData);
		const confirmationValues = getBookingConfirmationSubmission(formData);

		if (policy.state !== 'active') {
			return fail<SpecialBookingActionData>(409, {
				values,
				confirmationValues,
				confirmationState: 'booking_unavailable',
				message: unavailableMessage ?? 'Briefing is currently unavailable.'
			});
		}

		const parseResult = bookingConfirmationSchema.safeParse(confirmationValues);
		if (!parseResult.success) {
			return fail<SpecialBookingActionData>(400, {
				values,
				confirmationValues,
				confirmationErrors: toBookingConfirmationFieldErrors(parseResult.error)
			});
		}

		const slotProfile = getSpecialBookingSlotProfile();
		const selectedStartsAt = new Date(parseResult.data.selectedStartsAtIso);
		const selectedEndsAt = new Date(parseResult.data.selectedEndsAtIso);
		const slotPreview = await resolvePublicBookingSlotPreview({
			bookingType: 'general',
			slotProfile
		});

		if (
			!isSlotInPublicBookingGroups({
				slotGroups: slotPreview.slotGroups,
				startsAt: selectedStartsAt,
				endsAt: selectedEndsAt
			})
		) {
			return fail<SpecialBookingActionData>(409, {
				values,
				confirmationValues,
				confirmationState: 'slot_unavailable',
				message: 'That slot is no longer available. Please choose another available time.'
			});
		}

		const confirmation = await confirmBookingSelection({
			bookingType: 'general',
			intake: {
				email: parseResult.data.email,
				scope: parseResult.data.scope,
				name: parseResult.data.name,
				phone: parseResult.data.phone,
				company: parseResult.data.company
			},
			selectedStartsAt,
			selectedEndsAt,
			requestOrigin: new URL(request.url).origin
		});

		if (confirmation.state === 'confirmed') {
			return {
				values,
				confirmationValues,
				confirmationState: 'confirmed' as const,
				confirmedBookingId: confirmation.booking.id,
				message: 'Briefing confirmed. Please check your inbox for the calendar invite.'
			};
		}

		const status = confirmation.state === 'calendar_sync_failed' ? 503 : 409;
		return fail<SpecialBookingActionData>(status, {
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
