import { and, desc, eq, gt, inArray, lte } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { form_consent_evidence, lead_events } from '$lib/server/db/schema';

type BrowserReportedMarketingChoice = {
	marketing: boolean;
	policyVersion: string;
	evidenceRef: string;
	expiresAt: number;
};

// This is a snapshot of the choice received with the form, not an advertising grant.
export async function recordFormConsentEvidence(
	formEventId: string,
	choice: BrowserReportedMarketingChoice
) {
	await db
		.insert(form_consent_evidence)
		.values({
			form_event_id: formEventId,
			marketing_allowed: choice.marketing,
			policy_version: choice.policyVersion,
			evidence_ref: choice.evidenceRef,
			expires_at: new Date(choice.expiresAt)
		})
		.onConflictDoNothing();
}

export async function latestFormConsentEvidence(journeyId: string) {
	// Select the newest form first: an older choice must not stand in for an unknown new one.
	const [form] = await db
		.select({ id: lead_events.id })
		.from(lead_events)
		.where(
			and(
				eq(lead_events.lead_journey_id, journeyId),
				eq(lead_events.event_type, 'form_submitted'),
				eq(lead_events.event_source, 'sveltekit.artifact_lead_intake')
			)
		)
		.orderBy(desc(lead_events.occurred_at), desc(lead_events.id))
		.limit(1);
	if (!form) return null;
	const [choice] = await db
		.select({
			marketingAllowed: form_consent_evidence.marketing_allowed,
			policyVersion: form_consent_evidence.policy_version,
			observedAt: form_consent_evidence.observed_at,
			expiresAt: form_consent_evidence.expires_at
		})
		.from(form_consent_evidence)
		.where(
			and(
				eq(form_consent_evidence.form_event_id, form.id),
				gt(form_consent_evidence.expires_at, new Date())
			)
		)
		.limit(1);
	return choice ? { source: 'browser_reported' as const, ...choice } : null;
}

// Bound each cron run to keep the existing conversion processor responsive.
export async function purgeExpiredFormConsentEvidence() {
	const expired = db
		.select({ id: form_consent_evidence.form_event_id })
		.from(form_consent_evidence)
		.where(lte(form_consent_evidence.expires_at, new Date()))
		.limit(500);
	await db
		.delete(form_consent_evidence)
		.where(inArray(form_consent_evidence.form_event_id, expired));
}
