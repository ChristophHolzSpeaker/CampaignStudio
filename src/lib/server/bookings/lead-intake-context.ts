import type { BookingLinkResolutionContext } from './contracts';
import { getLatestFormSubmissionEventForJourney } from '$lib/server/attribution/lead-events';
import { getLeadJourneyById } from '$lib/server/attribution/lead-journeys';
import { normalizeEmailAddress } from '$lib/server/attribution/email';
import { bookingIntakeSchema, type BookingIntakeSubmission } from '$lib/validation/booking-intake';

const requiredLeadIntakeSchema = bookingIntakeSchema.pick({
	email: true,
	scope: true
});

type RequiredLeadIntakeField = 'email' | 'scope';
type OptionalLeadIntakeField = 'name' | 'company';

type LeadBookingPrefillKnownFields = Record<
	RequiredLeadIntakeField | OptionalLeadIntakeField,
	boolean
>;

export type LeadBookingIntakeSummary = {
	name: string | null;
	email: string;
	scope: string;
	requestSummary: string;
	company: string | null;
};

export type LeadBookingIntakeEvaluation = {
	values: BookingIntakeSubmission;
	knownFields: LeadBookingPrefillKnownFields;
	missingRequiredFields: RequiredLeadIntakeField[];
	isComplete: boolean;
	summary: LeadBookingIntakeSummary | null;
};

export type ResolvedLeadBookingIntakeContext = LeadBookingIntakeEvaluation & {
	source: {
		hasJourneyContext: boolean;
		hasLatestFormSubmissionContext: boolean;
		hasBookingLinkMetadataContext: boolean;
	};
};

function toTrimmedString(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return null;
	}

	return value as Record<string, unknown>;
}

function readFirstString(
	record: Record<string, unknown> | null,
	keys: readonly string[]
): string | null {
	if (!record) {
		return null;
	}

	for (const key of keys) {
		const value = toTrimmedString(record[key]);
		if (value) {
			return value;
		}
	}

	return null;
}

function evaluateLeadBookingIntakeValues(input: {
	email: string | null;
	scope: string | null;
	name: string | null;
	company: string | null;
}): LeadBookingIntakeEvaluation {
	const values: BookingIntakeSubmission = {
		email: input.email ?? '',
		scope: input.scope ?? '',
		name: input.name ?? '',
		company: input.company ?? ''
	};

	const knownFields: LeadBookingPrefillKnownFields = {
		email: Boolean(input.email),
		scope: Boolean(input.scope),
		name: Boolean(input.name),
		company: Boolean(input.company)
	};

	const requiredResult = requiredLeadIntakeSchema.safeParse({
		email: values.email,
		scope: values.scope
	});

	const missingRequiredFields: RequiredLeadIntakeField[] = [];
	if (!requiredResult.success) {
		for (const issue of requiredResult.error.issues) {
			const key = issue.path[0];
			if ((key === 'email' || key === 'scope') && !missingRequiredFields.includes(key)) {
				missingRequiredFields.push(key);
			}
		}
	}

	return {
		values,
		knownFields,
		missingRequiredFields,
		isComplete: missingRequiredFields.length === 0,
		summary:
			missingRequiredFields.length === 0
				? {
						name: values.name || null,
						email: values.email,
						scope: values.scope,
						requestSummary: values.scope,
						company: values.company || null
					}
				: null
	};
}

function normalizeOptionalEmail(value: string | null): string | null {
	if (!value) {
		return null;
	}

	return normalizeEmailAddress(value);
}

export async function resolveLeadBookingIntakeContext(input: {
	tokenContext: BookingLinkResolutionContext;
}): Promise<ResolvedLeadBookingIntakeContext> {
	const leadJourneyId = input.tokenContext.leadJourneyId;
	const metadataRecord = toRecord(input.tokenContext.metadata);

	if (!leadJourneyId) {
		return {
			...evaluateLeadBookingIntakeValues({
				email: readFirstString(metadataRecord, ['email', 'contact_email']),
				scope: readFirstString(metadataRecord, [
					'scope',
					'meeting_scope',
					'request_summary',
					'message'
				]),
				name: readFirstString(metadataRecord, ['name', 'contact_name']),
				company: readFirstString(metadataRecord, ['company', 'organization'])
			}),
			source: {
				hasJourneyContext: false,
				hasLatestFormSubmissionContext: false,
				hasBookingLinkMetadataContext: metadataRecord !== null
			}
		};
	}

	const [journey, latestFormSubmission] = await Promise.all([
		getLeadJourneyById(leadJourneyId),
		getLatestFormSubmissionEventForJourney(leadJourneyId)
	]);

	const eventPayload = toRecord(latestFormSubmission?.eventPayload);
	const formPayload = toRecord(eventPayload?.form);
	const intakePayload = toRecord(metadataRecord?.intake);

	const normalizedEmail =
		normalizeOptionalEmail(journey?.contact_email ?? null) ??
		normalizeOptionalEmail(readFirstString(intakePayload, ['email', 'contact_email'])) ??
		normalizeOptionalEmail(readFirstString(metadataRecord, ['email', 'contact_email'])) ??
		normalizeOptionalEmail(readFirstString(formPayload, ['email', 'contact_email']));

	const evaluation = evaluateLeadBookingIntakeValues({
		email: normalizedEmail,
		scope:
			readFirstString(formPayload, ['meeting_scope', 'scope', 'request_summary', 'message']) ??
			readFirstString(eventPayload, ['meeting_scope', 'scope', 'request_summary', 'message']) ??
			readFirstString(intakePayload, ['scope', 'meeting_scope', 'request_summary', 'message']) ??
			readFirstString(metadataRecord, ['scope', 'meeting_scope', 'request_summary', 'message']),
		name:
			toTrimmedString(journey?.contact_name) ??
			readFirstString(formPayload, ['full_name', 'name', 'contact_name']) ??
			readFirstString(intakePayload, ['name', 'contact_name']) ??
			readFirstString(metadataRecord, ['name', 'contact_name']),
		company:
			readFirstString(formPayload, ['organization', 'company']) ??
			readFirstString(intakePayload, ['company', 'organization']) ??
			readFirstString(metadataRecord, ['company', 'organization'])
	});

	return {
		...evaluation,
		source: {
			hasJourneyContext: journey !== null,
			hasLatestFormSubmissionContext: latestFormSubmission !== null,
			hasBookingLinkMetadataContext: metadataRecord !== null
		}
	};
}
