import type { ZodError } from 'zod';
import {
	createCampaignFromPublicApi,
	publicCampaignCreateRequestSchema
} from '$lib/server/public-api/campaign-create';
import { listPublicCampaignNavItems } from '$lib/server/public-api/campaign-nav';
import { buildEmbedPreviewUrl } from '$lib/server/public-api/embed-token';
import {
	publicApiJson,
	requirePublicApiReadOrWriteRequest,
	requirePublicApiWriteRequest
} from '$lib/server/public-api/http';
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

export const GET: RequestHandler = async ({ request, url }) => {
	const guard = await requirePublicApiReadOrWriteRequest(request);
	if (!guard.ok) return guard.response;

	try {
		return publicApiJson(
			{
				ok: true,
				data: await listPublicCampaignNavItems(url.origin)
			},
			guard.context
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to list campaigns';
		return publicApiJson({ ok: false, error: message }, guard.context, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, url }) => {
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
		const embedUrl = buildEmbedPreviewUrl(url.origin, {
			campaignPageId: result.campaignPageId,
			slug: result.pageSlug
		});

		return publicApiJson(
			{
				ok: true,
				data: {
					campaignId: result.campaignId,
					campaignPageId: result.campaignPageId,
					pageSlug: result.pageSlug,
					campaignUrl: `/campaigns/${result.campaignId}`,
					previewUrl: `/campaigns/${result.campaignId}/landing-page`,
					embedUrl
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
