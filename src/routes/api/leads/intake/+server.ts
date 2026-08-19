import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { campaigns, campaign_pages } from '$lib/server/db/schema';
import { submitLeadIntake } from '$lib/server/leads/intake-service';
import { bookingIntakeSchema } from '$lib/validation/booking-intake';
import type { RequestHandler } from './$types';

const ALLOWED_ORIGINS = (process.env.PRIVATE_ALLOWED_WEBFLOW_ORIGINS || '')
	.split(',')
	.map((value) => value.trim())
	.filter(Boolean);
function isOriginAllowed(origin: string | null, currentOrigin: string): boolean {
	return Boolean(origin && (origin === currentOrigin || ALLOWED_ORIGINS.includes(origin)));
}
function corsHeaders(origin: string): HeadersInit {
	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type'
	};
}
function allowedJson(data: unknown, init: ResponseInit = {}, origin?: string) {
	return json(data, {
		...init,
		headers: origin ? { ...corsHeaders(origin), ...init.headers } : init.headers
	});
}
function readSingleString(input: unknown): string | undefined {
	if (typeof input === 'string') return input;
	if (Array.isArray(input)) return typeof input[0] === 'string' ? input[0] : undefined;
	return undefined;
}

async function resolveWebflowContext(campaignId?: number, campaignPageId?: number) {
	if (Number.isInteger(campaignId) && Number.isInteger(campaignPageId)) {
		const [page] = await db
			.select({ campaignId: campaign_pages.campaign_id, campaignPageId: campaign_pages.id })
			.from(campaign_pages)
			.where(eq(campaign_pages.id, campaignPageId!))
			.limit(1);
		if (page?.campaignId === campaignId) return page;
	}
	const [sentinel] = await db
		.select({ id: campaigns.id })
		.from(campaigns)
		.where(eq(campaigns.name, 'Webflow Direct'))
		.limit(1);
	if (!sentinel) throw new Error('Webflow direct sentinel campaign not found');
	return { campaignId: sentinel.id, campaignPageId: null };
}

export const OPTIONS: RequestHandler = ({ request, url }) => {
	const origin = request.headers.get('origin');
	return isOriginAllowed(origin, url.origin)
		? new Response(null, { status: 204, headers: corsHeaders(origin!) })
		: new Response(null, { status: 403 });
};

export const POST: RequestHandler = async ({ request, url }) => {
	const origin = request.headers.get('origin');
	const allowedOrigin = isOriginAllowed(origin, url.origin) ? origin! : undefined;
	let raw: Record<string, unknown>;
	try {
		raw = request.headers.get('content-type')?.includes('application/json')
			? await request.json()
			: Object.fromEntries((await request.formData()).entries());
	} catch {
		return allowedJson(
			{ success: false, message: 'Invalid submission.' },
			{ status: 400 },
			allowedOrigin
		);
	}
	const parsed = bookingIntakeSchema.safeParse({
		email: readSingleString(raw.email) ?? '',
		name: readSingleString(raw.name) ?? '',
		phone: readSingleString(raw.phone) ?? '',
		company: readSingleString(raw.company) ?? '',
		scope: readSingleString(raw.scope) ?? ''
	});
	if (!parsed.success)
		return allowedJson(
			{ success: false, message: parsed.error.issues[0]?.message ?? 'Invalid submission.' },
			{ status: 400 },
			allowedOrigin
		);
	try {
		const context = await resolveWebflowContext(
			Number(readSingleString(raw.campaignId)) || undefined,
			Number(readSingleString(raw.campaignPageId)) || undefined
		);
		await submitLeadIntake({
			intake: parsed.data,
			campaignId: context.campaignId,
			campaignPageId: context.campaignPageId,
			visitorIdentifier: null,
			pageSlug: readSingleString(raw.pageSlug) ?? null,
			pagePath: url.pathname,
			surface: 'webflow',
			eventSource: 'sveltekit.webflow_lead_intake',
			formType: 'webflow_lead_intake',
			notificationFlow: 'webflow_lead_intake'
		});
		return allowedJson(
			{
				success: true,
				message: 'Thank you. Your request has been received and we will respond by email shortly.'
			},
			{},
			allowedOrigin
		);
	} catch (error) {
		return allowedJson(
			{
				success: false,
				message: error instanceof Error ? error.message : 'Service temporarily unavailable.'
			},
			{ status: 503 },
			allowedOrigin
		);
	}
};
