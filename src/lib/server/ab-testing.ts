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
import { isEligibleHeroVideoUrl } from '$lib/experiments/hero-video';

export const SPEAKER_HERO_MEDIA_EXPERIMENT_KEY = 'speaker_hero_autoplay_video_v1';
const SPEAKER_HERO_MEDIA_COOKIE_NAME = 'cs_ab_speaker_hero_autoplay_video_v1';
const SPEAKER_HERO_MEDIA_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;

export type SpeakerHeroMediaMode = 'static_image' | 'autoplay_video';

export type SpeakerHeroMediaExperiment = {
	experimentId: string | null;
	experimentKey: string;
	variantId: string | null;
	variantKey: string;
	visitorId: string;
	heroMediaMode: SpeakerHeroMediaMode;
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

export type ExperimentAttribution = {
	experimentId: string;
	variantId: string;
};

type ResolveSpeakerHeroMediaInput = {
	cookies: Cookies;
	secureCookie: boolean;
	route: string;
	slug: string;
	videoEmbedUrl: string;
	searchParams: URLSearchParams;
	referrer: string | null;
};

function readAssignmentCookie(cookies: Cookies): string | null {
	return cookies.get(SPEAKER_HERO_MEDIA_COOKIE_NAME) ?? null;
}

function writeAssignmentCookie(cookies: Cookies, variantKey: string, secureCookie: boolean): void {
	cookies.set(SPEAKER_HERO_MEDIA_COOKIE_NAME, variantKey, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: secureCookie,
		maxAge: SPEAKER_HERO_MEDIA_COOKIE_MAX_AGE_SECONDS
	});
}

function normalizeConfig(config: unknown): { hero_media_mode?: SpeakerHeroMediaMode } {
	if (typeof config !== 'object' || config === null || Array.isArray(config)) {
		return {};
	}

	const record = config as Record<string, unknown>;
	return {
		hero_media_mode: record.hero_media_mode === 'autoplay_video' ? 'autoplay_video' : 'static_image'
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

export async function getSpeakerHeroMediaAttribution(
	visitorId: string | null
): Promise<ExperimentAttribution | null> {
	if (!visitorId) {
		return null;
	}

	const [assignment] = await db
		.select({
			experimentId: ab_visitor_assignments.experiment_id,
			variantId: ab_visitor_assignments.variant_id
		})
		.from(ab_visitor_assignments)
		.innerJoin(
			ab_experiments,
			and(
				eq(ab_experiments.id, ab_visitor_assignments.experiment_id),
				eq(ab_experiments.key, SPEAKER_HERO_MEDIA_EXPERIMENT_KEY),
				eq(ab_experiments.status, 'running')
			)
		)
		.innerJoin(
			ab_variants,
			and(
				eq(ab_variants.id, ab_visitor_assignments.variant_id),
				eq(ab_variants.experiment_id, ab_experiments.id)
			)
		)
		.where(eq(ab_visitor_assignments.visitor_id, visitorId))
		.limit(1);

	return assignment ?? null;
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

export async function resolveSpeakerHeroMediaExperiment(
	input: ResolveSpeakerHeroMediaInput
): Promise<SpeakerHeroMediaExperiment> {
	const visitorId = getOrCreateVisitorIdentifier({
		cookies: input.cookies,
		secureCookie: input.secureCookie
	});
	const assignmentCookieVariantKey = readAssignmentCookie(input.cookies);
	const fallback: SpeakerHeroMediaExperiment = {
		experimentId: null,
		experimentKey: SPEAKER_HERO_MEDIA_EXPERIMENT_KEY,
		variantId: null,
		variantKey: 'A',
		visitorId,
		heroMediaMode: 'static_image'
	};

	if (!isEligibleHeroVideoUrl(input.videoEmbedUrl)) {
		return fallback;
	}

	try {
		const [experiment] = await db
			.select({
				id: ab_experiments.id,
				key: ab_experiments.key
			})
			.from(ab_experiments)
			.where(
				and(
					eq(ab_experiments.key, SPEAKER_HERO_MEDIA_EXPERIMENT_KEY),
					eq(ab_experiments.status, 'running')
				)
			)
			.limit(1);

		if (!experiment) {
			return fallback;
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
		const assignedVariant = storedVariant ?? cookieVariant ?? pickWeightedVariant(variantRows);

		if (!assignedVariant) {
			return {
				experimentId: experiment.id,
				experimentKey: experiment.key,
				variantId: null,
				variantKey: 'A',
				visitorId,
				heroMediaMode: 'static_image'
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
			heroMediaMode: normalizedConfig.hero_media_mode ?? 'static_image'
		};
	} catch (error) {
		console.error('AB test resolution failed', error);
		return fallback;
	}
}
