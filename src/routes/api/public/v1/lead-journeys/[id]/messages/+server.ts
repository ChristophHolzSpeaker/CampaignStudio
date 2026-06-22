import { db } from '$lib/server/db';
import { lead_messages } from '$lib/server/db/schema';
import {
	parseOptionalDate,
	parsePositiveInt,
	publicApiJson,
	requirePublicApiRequest
} from '$lib/server/public-api/http';
import { and, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ request, params, url }) => {
	const guard = await requirePublicApiRequest(request);
	if (!guard.ok) return guard.response;

	if (!UUID_PATTERN.test(params.id)) {
		return publicApiJson({ ok: false, error: 'Invalid journey id' }, guard.context, {
			status: 400
		});
	}

	const limit = parsePositiveInt(url.searchParams.get('limit'), DEFAULT_LIMIT, MAX_LIMIT);
	const receivedAfter = parseOptionalDate(url.searchParams.get('received_after'));
	const receivedBefore = parseOptionalDate(url.searchParams.get('received_before'));
	const direction = url.searchParams.get('direction');

	const whereClauses: SQL[] = [eq(lead_messages.lead_journey_id, params.id)];
	if (receivedAfter) whereClauses.push(gte(lead_messages.created_at, receivedAfter));
	if (receivedBefore) whereClauses.push(lt(lead_messages.created_at, receivedBefore));
	if (direction) whereClauses.push(eq(lead_messages.direction, direction));

	const rows = await db
		.select({
			id: lead_messages.id,
			leadJourneyId: lead_messages.lead_journey_id,
			direction: lead_messages.direction,
			provider: lead_messages.provider,
			providerMessageId: lead_messages.provider_message_id,
			providerThreadId: lead_messages.provider_thread_id,
			fromEmail: lead_messages.from_email,
			toEmail: lead_messages.to_email,
			subject: lead_messages.subject,
			bodyText: lead_messages.body_text,
			bodyHtml: lead_messages.body_html,
			classification: lead_messages.classification,
			classificationConfidence: lead_messages.classification_confidence,
			autoResponseDecision: lead_messages.auto_response_decision,
			autoResponseSentAt: lead_messages.auto_response_sent_at,
			receivedAt: lead_messages.received_at,
			sentAt: lead_messages.sent_at,
			rawMetadata: lead_messages.raw_metadata,
			createdAt: lead_messages.created_at,
			updatedAt: lead_messages.updated_at
		})
		.from(lead_messages)
		.where(and(...whereClauses))
		.orderBy(desc(lead_messages.created_at))
		.limit(limit);

	return publicApiJson(
		{
			ok: true,
			data: rows,
			pagination: {
				limit,
				count: rows.length,
				nextReceivedBefore: rows.length === limit ? rows.at(-1)?.createdAt : null
			}
		},
		guard.context
	);
};
