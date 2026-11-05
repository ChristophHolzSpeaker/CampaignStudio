import { json } from '@sveltejs/kit';
import { createFormAttributionReceipt } from '$lib/server/attribution/form-attribution-receipt';
import { getTrackingConfig } from '$lib/server/tracking/config';
import { recordFormConsentEvidence } from '$lib/server/tracking/form-consent-evidence';
import { browserStatisticsAllowed, readBrowserConsent } from '$lib/server/tracking/browser-consent';
import { z } from 'zod';
import { getPublishedArtifactPageById } from '$lib/server/artifacts/repository';
import { readVisitorIdentifier } from '$lib/server/attribution/campaign-visits';
import { submitLeadIntake } from '$lib/server/leads/intake-service';
import {
	enforceRuntimeRateLimit,
	enforceSameOrigin,
	readLimitedJson
} from '$lib/server/runtime/http';
import { bookingIntakeSchema } from '$lib/validation/booking-intake';
import type { RequestHandler } from './$types';

const schema = z.object({
	campaignPageId: z.number().int().positive(),
	formKey: z.string().trim().max(120).optional(),
	fields: bookingIntakeSchema
});
export const POST: RequestHandler = async ({ request, url, cookies }) => {
	const originError = enforceSameOrigin(request, url);
	if (originError) return originError;
	let parsed;
	try {
		parsed = schema.safeParse(await readLimitedJson(request));
	} catch {
		return json({ ok: false, error: 'Invalid request body' }, { status: 400 });
	}
	if (!parsed.success)
		return json(
			{ ok: false, error: 'Invalid lead intake payload', issues: parsed.error.issues },
			{ status: 400 }
		);
	const page = await getPublishedArtifactPageById(parsed.data.campaignPageId);
	if (!page)
		return json({ ok: false, error: 'Published artifact page not found' }, { status: 404 });
	const visitor = readVisitorIdentifier(cookies);
	const rateError = await enforceRuntimeRateLimit(
		visitor ?? request.headers.get('x-forwarded-for') ?? 'anonymous'
	);
	if (rateError) return rateError;
	try {
		const result = await submitLeadIntake({
			intake: parsed.data.fields,
			campaignId: page.campaignId,
			campaignPageId: page.campaignPageId,
			visitorIdentifier: visitor,
			pageSlug: page.slug,
			pagePath: `/${page.slug}`,
			surface: 'artifact_runtime',
			eventSource: 'sveltekit.artifact_lead_intake',
			formType: 'artifact_lead_intake',
			notificationFlow: 'inline_lead_intake',
			logJourneyCreated: true,
			cta: { key: parsed.data.formKey, section: 'artifact_form' }
		});
		let attributionReceipt: string | undefined;
		if (['v8', 'v9', 'v10'].includes(page.runtimeVersion)) {
			// Never leave an already-saved lead waiting indefinitely for optional diagnostics.
			const prepareAttribution = async (): Promise<string | undefined> => {
				try {
					const settings = (await getTrackingConfig(page.campaignId)).consent;
					const choice = readBrowserConsent(cookies, settings);
					if (choice) {
						try {
							await recordFormConsentEvidence(result.formEventId, choice);
						} catch {
							console.error('form_consent_evidence_record_failed');
						}
					}
					if (browserStatisticsAllowed(cookies, settings) || choice?.marketing === true)
						return createFormAttributionReceipt({
							formEventId: result.formEventId,
							campaignPageId: page.campaignPageId,
							policyVersion: settings.policyVersion,
							evidenceRef: choice?.evidenceRef ?? null
						});
				} catch {
					/* The lead is already saved; attribution must not fail the submission. */
				}
				return undefined;
			};
			let timeout: number | undefined;
			const deadline = new Promise<undefined>((resolve) => {
				timeout = setTimeout(resolve, 1000);
			});
			attributionReceipt = await Promise.race([prepareAttribution(), deadline]);
			clearTimeout(timeout);
		}
		return json({
			ok: true,
			data: {
				...(attributionReceipt ? { attributionReceipt } : {}),
				message: 'Thank you. Your request has been received and we will respond by email shortly.'
			}
		});
	} catch (error) {
		return json(
			{ ok: false, error: error instanceof Error ? error.message : 'Lead intake failed' },
			{ status: 500 }
		);
	}
};
