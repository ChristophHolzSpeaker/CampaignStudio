import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	confirmBookingSelection,
	createBookingLinkForJourney,
	getBookingPolicy,
	getPublicBookingUnavailableMessage,
	markBookingLinkClickedAt,
	resolveLeadBookingIntakeContext,
	resolveLeadBookingToken,
	resolvePublicBookingSlots,
	type PublicBookingSlotDayGroup
} from '$lib/server/bookings';
import { logLeadEvent } from '$lib/server/attribution/lead-events';
import { findOrCreateLeadJourneyFromInquiry } from '$lib/server/attribution/lead-journeys';
import { readVisitorIdentifier } from '$lib/server/attribution/campaign-visits';
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
	redirectToken?: string;
};

type UtmContext = {
	source: string | null;
	campaignId: number | null;
	campaignPageId: number | null;
	pageSlug: string | null;
};

type LeadBookingPageData = {
	bookingType: 'lead';
	tokenState: 'usable' | 'invalid' | 'expired' | 'new';
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
	utmContext?: UtmContext;
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

	// Handle "new" as special case for direct booking from speaker pages
	if (token === 'new') {
		// Extract and sanitize UTM params
		const utmSource = url.searchParams.get('utm_source') ?? null;
		const utmCampaignIdRaw = url.searchParams.get('utm_campaignId');
		const utmCampaignId = utmCampaignIdRaw ? parseInt(utmCampaignIdRaw, 10) : NaN;
		const utmPageSlug = url.searchParams.get('utm_pageSlug') ?? null;
		const utmCampaignPageIdRaw = url.searchParams.get('utm_campaignPageId');
		const utmCampaignPageId = utmCampaignPageIdRaw ? parseInt(utmCampaignPageIdRaw, 10) : NaN;

		// Validate campaignId - redirect to /book/g if invalid
		if (!Number.isInteger(utmCampaignId) || utmCampaignId <= 0) {
			redirect(302, '/book/g');
		}

		const policy = await getBookingPolicy('lead');

		return {
			bookingType: 'lead' as const,
			tokenState: 'new' as const,
			tokenMessage: null,
			policyState: policy.state,
			unavailableMessage: getPublicBookingUnavailableMessage(policy),
			utmContext: {
				source: utmSource,
				campaignId: utmCampaignId,
				campaignPageId: Number.isInteger(utmCampaignPageId) ? utmCampaignPageId : null,
				pageSlug: utmPageSlug
			}
		} satisfies LeadBookingPageData;
	}

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
	check: async ({ request, params, cookies }: RequestEvent) => {
		const token = params.token?.trim() ?? '';
		const formData = await request.formData();
		const values = getBookingIntakeSubmission(formData);

		// Handle "new" token - direct booking from speaker pages
		if (token === 'new') {
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

			// Extract UTM context from hidden fields
			const utmSource = (formData.get('utm_source')?.toString().trim() ?? '') || null;
			const utmPageSlug = (formData.get('utm_pageSlug')?.toString().trim() ?? '') || null;
			const campaignIdRaw = formData.get('utm_campaignId');
			const campaignId = campaignIdRaw ? parseInt(String(campaignIdRaw), 10) : NaN;
			const campaignPageIdRaw = formData.get('utm_campaignPageId');
			const campaignPageId = campaignPageIdRaw ? parseInt(String(campaignPageIdRaw), 10) : NaN;

			// Validate campaign context
			if (!Number.isInteger(campaignId) || campaignId <= 0) {
				return fail<LeadBookingActionData>(400, {
					values,
					message: 'Invalid campaign context. Please try again from the speaker page.'
				});
			}

			if (!Number.isInteger(campaignPageId) || campaignPageId <= 0) {
				return fail<LeadBookingActionData>(400, {
					values,
					message: 'Invalid campaign page context. Please try again from the speaker page.'
				});
			}

			// Read visitor identifier
			const visitorIdentifier = readVisitorIdentifier(cookies);

			// Find or create journey
			const { journey, created } = await findOrCreateLeadJourneyFromInquiry({
				campaignId,
				campaignPageId,
				contactEmail: parseResult.data.email,
				contactName: parseResult.data.name ?? '',
				visitorIdentifier
			});

			// Create booking link
			const bookingLink = await createBookingLinkForJourney({
				leadJourneyId: journey.id,
				campaignId,
				eventSource: 'sveltekit.book_l_new_check',
				metadata: {
					utm: {
						source: utmSource,
						campaign_id: campaignId,
						campaign_page_id: campaignPageId,
						page_slug: utmPageSlug
					},
					intake: {
						email: parseResult.data.email,
						scope: parseResult.data.scope,
						name: parseResult.data.name ?? null,
						company: parseResult.data.company ?? null
					}
				}
			});

			// Log event
			await logLeadEvent({
				leadJourneyId: journey.id,
				campaignId,
				campaignPageId,
				eventType: 'form_submitted',
				eventSource: 'sveltekit.book_l_new_page',
				eventPayload: {
					attribution: {
						page_path: '/book/l/new',
						page_slug: utmPageSlug,
						campaign_page_id: campaignPageId,
						utm_source: utmSource
					},
					form: {
						email: parseResult.data.email,
						full_name: parseResult.data.name ?? '',
						organization: parseResult.data.company ?? '',
						meeting_scope: parseResult.data.scope,
						form_type: 'booking_modal_intake'
					},
					journey: {
						created
					},
					booking_link_id: bookingLink.bookingLinkId
				},
				occurredAt: new Date()
			});

			// Get slots
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
				redirectToken: bookingLink.token,
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
		}

		// Existing token flow
		const tokenResolution = await resolveLeadBookingToken(token);

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
