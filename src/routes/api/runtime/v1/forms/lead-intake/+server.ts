import { json } from '@sveltejs/kit';
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
		await submitLeadIntake({
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
		return json({
			ok: true,
			data: {
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
