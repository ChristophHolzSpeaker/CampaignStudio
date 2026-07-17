import { getOrCreateVisitorIdentifier } from '$lib/server/attribution/campaign-visits';
import { db } from '$lib/server/db';
import {
	ab_events,
	ab_experiments,
	ab_variants,
	ab_visitor_assignments
} from '$lib/server/db/schema';
import type { Cookies } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

const SPEAKER_PRIMARY_CTA_EXPERIMENT_KEY = 'speaker_primary_cta_v1';
const SPEAKER_PRIMARY_CTA_COOKIE_NAME = 'cs_ab_speaker_primary_cta_v1';
const SPEAKER_PRIMARY_CTA_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;

export type SpeakerPrimaryCtaMode = 'booking_calendar' | 'dual_buttons';

export type SpeakerPrimaryCtaAbTest = {
	experimentId: string | null;
	experimentKey: string;
	variantId: string | null;
	variantKey: string;
	visitorId: string;
	ctaMode: SpeakerPrimaryCtaMode;
	primaryLabel?: string;
	secondaryLabel?: string;
};

type AbVariantRow = {
	id: string;
	experimentId: string;
	key: string;
	name: string;
	weight: number;
	config: unknown;
	isControl: boolean;
};

type ResolveSpeakerPrimaryCtaInput = {
	cookies: Cookies;
	secureCookie: boolean;
	route: string;
	slug: string;
	searchParams: URLSearchParams;
	referrer: string | null;
};

function readAssignmentCookie(cookies: Cookies): string | null {
	return cookies.get(SPEAKER_PRIMARY_CTA_COOKIE_NAME) ?? null;
}

function writeAssignmentCookie(cookies: Cookies, variantKey: string, secureCookie: boolean): void {
	cookies.set(SPEAKER_PRIMARY_CTA_COOKIE_NAME, variantKey, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: secureCookie,
		maxAge: SPEAKER_PRIMARY_CTA_COOKIE_MAX_AGE_SECONDS
	});
}

function normalizeConfig(config: unknown): {
	cta_mode?: SpeakerPrimaryCtaMode;
	primary_label?: string;
	secondary_label?: string;
} {
	if (typeof config !== 'object' || config === null || Array.isArray(config)) {
		return {};
	}

	const record = config as Record<string, unknown>;
	return {
		cta_mode: record.cta_mode === 'dual_buttons' ? 'dual_buttons' : 'booking_calendar',
		primary_label: typeof record.primary_label === 'string' ? record.primary_label : undefined,
		secondary_label: typeof record.secondary_label === 'string' ? record.secondary_label : undefined
	};
}

function pickWeightedVariant(variants: AbVariantRow[]): AbVariantRow | null {
	if (variants.length === 0) {
		return null;
	}

	const totalWeight = variants.reduce((sum, variant) => sum + Math.max(0, variant.weight), 0);
	if (totalWeight <= 0) {
		return variants[0] ?? null;
	}

	let cursor = Math.random() * totalWeight;
	for (const variant of variants) {
		cursor -= Math.max(0, variant.weight);
		if (cursor < 0) {
			return variant;
		}
	}

	return variants.at(-1) ?? null;
}

async function persistAssignment(input: {
	experimentId: string;
	variantId: string;
	visitorId: string;
}): Promise<void> {
	await db
		.insert(ab_visitor_assignments)
		.values({
			experiment_id: input.experimentId,
			variant_id: input.variantId,
			visitor_id: input.visitorId
		})
		.onConflictDoNothing();
}

async function persistExposure(input: {
	experimentId: string | null;
	variantId: string | null;
	visitorId: string;
	route: string;
	slug: string;
	searchParams: URLSearchParams;
	referrer: string | null;
}): Promise<void> {
	const attribution: Record<string, string> = {};
	for (const key of [
		'gclid',
		'utm_source',
		'utm_medium',
		'utm_campaign',
		'utm_content',
		'utm_term'
	]) {
		const value = input.searchParams.get(key)?.trim();
		if (value) {
			attribution[key] = value;
		}
	}

	if (input.referrer) {
		attribution.referrer = input.referrer;
	}

	await db.insert(ab_events).values({
		experiment_id: input.experimentId,
		variant_id: input.variantId,
		visitor_id: input.visitorId,
		event_type: 'page_view',
		route: input.route,
		slug: input.slug,
		metadata: attribution
	});
}

export async function resolveSpeakerPrimaryCtaAbTest(
	input: ResolveSpeakerPrimaryCtaInput
): Promise<SpeakerPrimaryCtaAbTest> {
	const visitorId = getOrCreateVisitorIdentifier({
		cookies: input.cookies,
		secureCookie: input.secureCookie
	});
	const assignmentCookieVariantKey = readAssignmentCookie(input.cookies);

	try {
		const [experiment] = await db
			.select({
				id: ab_experiments.id,
				key: ab_experiments.key
			})
			.from(ab_experiments)
			.where(
				and(
					eq(ab_experiments.key, SPEAKER_PRIMARY_CTA_EXPERIMENT_KEY),
					eq(ab_experiments.status, 'running')
				)
			)
			.limit(1);

		if (!experiment) {
			return {
				experimentId: null,
				experimentKey: SPEAKER_PRIMARY_CTA_EXPERIMENT_KEY,
				variantId: null,
				variantKey: 'A',
				visitorId,
				ctaMode: 'booking_calendar'
			};
		}

		const variantRows = await db
			.select({
				id: ab_variants.id,
				experimentId: ab_variants.experiment_id,
				key: ab_variants.key,
				name: ab_variants.name,
				weight: ab_variants.weight,
				config: ab_variants.config,
				isControl: ab_variants.is_control
			})
			.from(ab_variants)
			.where(eq(ab_variants.experiment_id, experiment.id))
			.orderBy(ab_variants.created_at);

		const cookieVariant = assignmentCookieVariantKey
			? variantRows.find((variant) => variant.key === assignmentCookieVariantKey)
			: null;

		const assignmentRow = await db
			.select({
				variantId: ab_visitor_assignments.variant_id
			})
			.from(ab_visitor_assignments)
			.where(
				and(
					eq(ab_visitor_assignments.experiment_id, experiment.id),
					eq(ab_visitor_assignments.visitor_id, visitorId)
				)
			)
			.limit(1);

		const storedVariant = assignmentRow[0]
			? (variantRows.find((variant) => variant.id === assignmentRow[0].variantId) ?? null)
			: null;
		const assignedVariant = cookieVariant ?? storedVariant ?? pickWeightedVariant(variantRows);

		if (!assignedVariant) {
			return {
				experimentId: experiment.id,
				experimentKey: experiment.key,
				variantId: null,
				variantKey: 'A',
				visitorId,
				ctaMode: 'booking_calendar'
			};
		}

		writeAssignmentCookie(input.cookies, assignedVariant.key, input.secureCookie);

		try {
			await persistAssignment({
				experimentId: experiment.id,
				variantId: assignedVariant.id,
				visitorId
			});
		} catch (error) {
			console.error('AB assignment persistence failed', error);
		}

		void persistExposure({
			experimentId: experiment.id,
			variantId: assignedVariant.id,
			visitorId,
			route: input.route,
			slug: input.slug,
			searchParams: input.searchParams,
			referrer: input.referrer
		}).catch((error) => {
			console.error('AB exposure logging failed', error);
		});

		const normalizedConfig = normalizeConfig(assignedVariant.config);

		return {
			experimentId: experiment.id,
			experimentKey: experiment.key,
			variantId: assignedVariant.id,
			variantKey: assignedVariant.key,
			visitorId,
			ctaMode: normalizedConfig.cta_mode ?? 'booking_calendar',
			...(normalizedConfig.primary_label ? { primaryLabel: normalizedConfig.primary_label } : {}),
			...(normalizedConfig.secondary_label
				? { secondaryLabel: normalizedConfig.secondary_label }
				: {})
		};
	} catch (error) {
		console.error('AB test resolution failed', error);
		return {
			experimentId: null,
			experimentKey: SPEAKER_PRIMARY_CTA_EXPERIMENT_KEY,
			variantId: null,
			variantKey: 'A',
			visitorId,
			ctaMode: 'booking_calendar'
		};
	}
}
