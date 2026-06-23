import type { ZodError } from 'zod';
import {
	createCampaignFromPublicApi,
	publicCampaignCreateRequestSchema
} from '$lib/server/public-api/campaign-create';
import { publicApiJson, requirePublicApiWriteRequest } from '$lib/server/public-api/http';
import type { RequestHandler } from './$types';

function validationErrorResponse(error: ZodError, context: Parameters<typeof publicApiJson>[1]) {
	return publicApiJson(
		{
			ok: false,
			error: 'Invalid campaign creation payload',
			issues: error.issues.map((issue) => ({
				path: issue.path.join('.'),
				message: issue.message
			}))
		},
		context,
		{ status: 400 }
	);
}

export const POST: RequestHandler = async ({ request }) => {
	const guard = await requirePublicApiWriteRequest(request);
	if (!guard.ok) return guard.response;

	let rawPayload: unknown;
	try {
		rawPayload = await request.json();
	} catch {
		return publicApiJson({ ok: false, error: 'Request body must be valid JSON' }, guard.context, {
			status: 400
		});
	}

	const parsed = publicCampaignCreateRequestSchema.safeParse(rawPayload);
	if (!parsed.success) {
		return validationErrorResponse(parsed.error, guard.context);
	}

	try {
		const result = await createCampaignFromPublicApi(parsed.data);

		return publicApiJson(
			{
				ok: true,
				data: {
					campaignId: result.campaignId,
					campaignPageId: result.campaignPageId,
					pageSlug: result.pageSlug,
					campaignUrl: `/campaigns/${result.campaignId}`,
					previewUrl: `/campaigns/${result.campaignId}/landing-page`
				}
			},
			guard.context,
			{ status: 201 }
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to create campaign';

		return publicApiJson({ ok: false, error: message }, guard.context, { status: 500 });
	}
};
