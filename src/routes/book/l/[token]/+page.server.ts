import { fail, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	confirmBookingSelection,
	getBookingPolicy,
	getPublicBookingUnavailableMessage,
	markBookingLinkClickedAt,
	resolveLeadBookingIntakeContext,
	resolveLeadBookingToken,
	resolvePublicBookingSlots,
	type PublicBookingSlotDayGroup
} from '$lib/server/bookings';
import { logLeadEvent } from '$lib/server/attribution/lead-events';
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

type IntakeSummaryView = {
	name: string | null;
	email: string;
	scope: string;
	requestSummary: string;
	company: string | null;
};

export type LeadBookingActionData = {
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
	intakeSummary?: IntakeSummaryView;
};

type LeadBookingPageData = {
	bookingType: 'lead';
	tokenState: 'usable' | 'invalid' | 'expired';
	tokenMessage: string | null;
	policyState: Awaited<ReturnType<typeof getBookingPolicy>>['state'] | null;
	unavailableMessage: string | null;
	prefillValues?: BookingIntakeSubmission;
	intakeSummary?: IntakeSummaryView;
	intakeSkipped?: boolean;
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
	message?: string;
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

export const load: PageServerLoad = async ({
	params,
	url
}: {
	params: { token?: string };
	url: URL;
}) => {
	const token = params.token?.trim() ?? '';
	const tokenResolution = await resolveLeadBookingToken(token);

	if (tokenResolution.state !== 'usable') {
		return {
			bookingType: 'lead' as const,
			tokenState: tokenResolution.state,
			tokenMessage: getTokenMessage(tokenResolution.state),
			policyState: null,
			unavailableMessage: null
		} satisfies LeadBookingPageData;
	}

	if (!tokenResolution.context.clickedAt) {
		const clicked = await markBookingLinkClickedAt({
			bookingLinkId: tokenResolution.context.bookingLinkId,
			clickedAt: new Date()
		});

		if (clicked) {
			await logLeadEvent({
				leadJourneyId: tokenResolution.context.leadJourneyId,
				campaignId: tokenResolution.context.campaignId,
				eventType: 'booking_link_clicked',
				eventSource: 'sveltekit.book_lead_page',
				eventPayload: {
					booking_link_id: tokenResolution.context.bookingLinkId,
					booking_type: tokenResolution.context.bookingType,
					page_path: '/book/l/[token]'
				},
				occurredAt: clicked.clicked_at ?? new Date()
			});
		}
	}

	const policy = await getBookingPolicy('lead');
	const intakeContext = await resolveLeadBookingIntakeContext({
		tokenContext: tokenResolution.context
	});
	const isEditDetails = url.searchParams.get('edit') === '1';

	if (policy.state === 'active' && intakeContext.isComplete && !isEditDetails) {
		const bookingFlow = await resolvePublicBookingSlots({
			bookingType: 'lead',
			requesterEmail: intakeContext.values.email
		});

		return {
			bookingType: 'lead' as const,
			tokenState: 'usable' as const,
			tokenMessage: null,
			policyState: policy.state,
			unavailableMessage: getPublicBookingUnavailableMessage(policy),
			prefillValues: intakeContext.values,
			intakeSummary: intakeContext.summary ?? undefined,
			intakeSkipped: true,
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
		} satisfies LeadBookingPageData;
	}

	return {
		bookingType: 'lead' as const,
		tokenState: 'usable' as const,
		tokenMessage: null,
		policyState: policy.state,
		unavailableMessage: getPublicBookingUnavailableMessage(policy),
		prefillValues: intakeContext.values,
		intakeSummary: intakeContext.summary ?? undefined,
		intakeSkipped: false
	} satisfies LeadBookingPageData;
};

export const actions: Actions = {
	check: async ({ request, params }: RequestEvent) => {
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

		const normalizedValues: BookingIntakeSubmission = {
			email: parseResult.data.email,
			scope: parseResult.data.scope,
			name: parseResult.data.name ?? '',
			company: parseResult.data.company ?? ''
		};

		return {
			values: normalizedValues,
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
			intakeSummary: {
				name: normalizedValues.name || null,
				email: normalizedValues.email,
				scope: normalizedValues.scope,
				requestSummary: normalizedValues.scope,
				company: normalizedValues.company || null
			},
			message:
				bookingFlow.availability.state === 'no_slots'
					? 'No slots are currently available in the next 3 days.'
					: undefined
		};
	},
	confirm: async ({ request, params }: RequestEvent) => {
		const token = params.token?.trim() ?? '';
		const tokenResolution = await resolveLeadBookingToken(token);

		const formData = await request.formData();
		const values = getBookingIntakeSubmission(formData);
		const confirmationValues = getBookingConfirmationSubmission(formData);

		if (tokenResolution.state !== 'usable') {
			return fail<LeadBookingActionData>(400, {
				values,
				confirmationValues,
				confirmationState: 'booking_unavailable',
				message: getTokenMessage(tokenResolution.state)
			});
		}

		const policy = await getBookingPolicy('lead');
		if (policy.state !== 'active') {
			return fail<LeadBookingActionData>(409, {
				values,
				confirmationValues,
				confirmationState: 'booking_unavailable',
				message: getPublicBookingUnavailableMessage(policy) ?? 'Booking is currently unavailable.'
			});
		}

		const parseResult = bookingConfirmationSchema.safeParse(confirmationValues);
		if (!parseResult.success) {
			return fail<LeadBookingActionData>(400, {
				values,
				confirmationValues,
				confirmationErrors: toBookingConfirmationFieldErrors(parseResult.error)
			});
		}

		const confirmation = await confirmBookingSelection({
			bookingType: 'lead',
			intake: {
				email: parseResult.data.email,
				scope: parseResult.data.scope,
				name: parseResult.data.name,
				company: parseResult.data.company
			},
			selectedStartsAt: new Date(parseResult.data.selectedStartsAtIso),
			selectedEndsAt: new Date(parseResult.data.selectedEndsAtIso),
			requestOrigin: new URL(request.url).origin,
			leadTokenContext: {
				token: tokenResolution.context.token,
				bookingLinkId: tokenResolution.context.bookingLinkId,
				leadJourneyId: tokenResolution.context.leadJourneyId,
				campaignId: tokenResolution.context.campaignId,
				metadata: tokenResolution.context.metadata
			}
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
		return fail<LeadBookingActionData>(status, {
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
