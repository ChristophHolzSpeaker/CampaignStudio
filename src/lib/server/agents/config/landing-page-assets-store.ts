import { db } from '$lib/server/db';
import { keynotes, landing_page_asset_sets, logos, media_assets } from '$lib/server/db/schema';
import { asc, desc, eq } from 'drizzle-orm';
import { landingPageAssets } from './landing-page-assets';
import {
	landingPageAssetsSchema,
	type HeroVideoOption,
	type HeroImageOption,
	type HybridSupportingImageOption,
	type SpeakerInActionVideoOption,
	type LogoOption,
	type KeynoteOption,
	type LandingPageAssets
} from '../schemas/landing-page-assets';

type AssetSetRow = {
	assetKey: string;
	assetsJson: unknown;
};

type MediaAssetRow = {
	id: string;
	kind: string;
	title: string;
	description: string;
	usageNotes: string;
	avoidNotes: string | null;
	primaryUrl: string;
	thumbnailUrl: string | null;
	thumbnailAlt: string | null;
	sectionTypes: string[];
	topics: string[];
	audiences: string[];
	formats: string[];
	intentTags: string[];
	priority: number;
};

type LandingPageAssetContext = {
	topic?: string;
	audience?: string;
	format?: string;
	geography?: string;
	intentSummary?: string;
	messagingAngle?: string;
	conversionGoal?: string;
};

type LogoRow = {
	id: string;
	name: string;
	logoUrl: string;
	logoAlt: string;
	priority: number;
};

type KeynoteRow = {
	id: string;
	title: string;
	summary: string | null;
	audience: string | null;
	keynoteShort: string | null;
	imageUrl: string;
	imageAlt: string;
};

async function loadActiveLandingPageAssetSet(): Promise<AssetSetRow | null> {
	const [activeSet] = await db
		.select({
			assetKey: landing_page_asset_sets.asset_key,
			assetsJson: landing_page_asset_sets.assets_json
		})
		.from(landing_page_asset_sets)
		.where(eq(landing_page_asset_sets.is_active, true))
		.orderBy(desc(landing_page_asset_sets.updated_at))
		.limit(1);

	return activeSet ?? null;
}

async function loadActiveMediaAssets(): Promise<MediaAssetRow[]> {
	const rows = await db
		.select({
			id: media_assets.id,
			kind: media_assets.kind,
			title: media_assets.title,
			description: media_assets.description,
			usageNotes: media_assets.usage_notes,
			avoidNotes: media_assets.avoid_notes,
			primaryUrl: media_assets.primary_url,
			thumbnailUrl: media_assets.thumbnail_url,
			thumbnailAlt: media_assets.thumbnail_alt,
			sectionTypes: media_assets.section_types,
			topics: media_assets.topics,
			audiences: media_assets.audiences,
			formats: media_assets.formats,
			intentTags: media_assets.intent_tags,
			priority: media_assets.priority
		})
		.from(media_assets)
		.where(eq(media_assets.is_active, true))
		.orderBy(asc(media_assets.priority), asc(media_assets.id));

	return rows;
}

async function loadActiveLogos(): Promise<LogoRow[]> {
	const rows = await db
		.select({
			id: logos.id,
			name: logos.name,
			logoUrl: logos.logo_url,
			logoAlt: logos.logo_alt,
			priority: logos.priority
		})
		.from(logos)
		.where(eq(logos.is_active, true))
		.orderBy(asc(logos.priority), asc(logos.name), asc(logos.id));

	return rows;
}

async function loadActiveKeynotes(): Promise<KeynoteRow[]> {
	const rows = await db
		.select({
			id: keynotes.id,
			title: keynotes.keynote_title,
			summary: keynotes.keynote_short,
			audience: keynotes.audience,
			keynoteShort: keynotes.keynote_short,
			imageUrl: keynotes.image_url,
			imageAlt: keynotes.image_alt
		})
		.from(keynotes)
		.where(eq(keynotes.status, 'active'))
		.orderBy(asc(keynotes.keynote_title), asc(keynotes.id));

	return rows;
}

function normalize(value: string): string {
	return value.trim().toLowerCase();
}

function tokenize(value: string): string[] {
	return normalize(value)
		.split(/[^a-z0-9]+/)
		.filter((token) => token.length >= 3);
}

function uniqueTokens(values: (string | undefined)[]): Set<string> {
	const result = new Set<string>();
	for (const value of values) {
		if (!value) {
			continue;
		}

		for (const token of tokenize(value)) {
			result.add(token);
		}
	}

	return result;
}

function scoreOverlap(tags: string[], contextTokens: Set<string>): number {
	let score = 0;
	for (const tag of tags) {
		const normalizedTag = normalize(tag);
		if (!normalizedTag) {
			continue;
		}

		const tagTokens = tokenize(normalizedTag);
		if (tagTokens.length === 0) {
			continue;
		}

		if (tagTokens.every((token) => contextTokens.has(token))) {
			score += 4;
			continue;
		}

		if (tagTokens.some((token) => contextTokens.has(token))) {
			score += 2;
		}
	}

	return score;
}

function sortMediaAssetsByRelevance(
	rows: MediaAssetRow[],
	context?: LandingPageAssetContext
): MediaAssetRow[] {
	if (!context) {
		return rows;
	}

	const contextTokens = uniqueTokens([
		context.topic,
		context.audience,
		context.format,
		context.geography,
		context.intentSummary,
		context.messagingAngle,
		context.conversionGoal
	]);

	if (contextTokens.size === 0) {
		return rows;
	}

	return [...rows].sort((left, right) => {
		const leftScore =
			scoreOverlap(left.topics, contextTokens) * 3 +
			scoreOverlap(left.audiences, contextTokens) * 3 +
			scoreOverlap(left.formats, contextTokens) * 2 +
			scoreOverlap(left.intentTags, contextTokens) * 4;
		const rightScore =
			scoreOverlap(right.topics, contextTokens) * 3 +
			scoreOverlap(right.audiences, contextTokens) * 3 +
			scoreOverlap(right.formats, contextTokens) * 2 +
			scoreOverlap(right.intentTags, contextTokens) * 4;

		if (leftScore !== rightScore) {
			return rightScore - leftScore;
		}

		if (left.priority !== right.priority) {
			return left.priority - right.priority;
		}

		return left.id.localeCompare(right.id);
	});
}

function fillHeroDefaultsFromCatalog(
	assets: LandingPageAssets,
	catalog: { heroVideos: HeroVideoOption[]; heroImages: HeroImageOption[] }
): LandingPageAssets {
	const fallbackHeroImage = catalog.heroImages[0];
	const fallbackHero = catalog.heroVideos[0];
	if (!fallbackHero && !fallbackHeroImage) {
		return assets;
	}

	return {
		...assets,
		heroDefaults: {
			...assets.heroDefaults,
			heroImageUrl:
				assets.heroDefaults.heroImageUrl ??
				fallbackHeroImage?.imageUrl ??
				fallbackHero?.videoThumbnailUrl,
			heroImageAlt:
				assets.heroDefaults.heroImageAlt ??
				fallbackHeroImage?.alt ??
				fallbackHero?.videoThumbnailAlt,
			videoThumbnailUrl: assets.heroDefaults.videoThumbnailUrl ?? fallbackHero?.videoThumbnailUrl,
			videoThumbnailAlt: assets.heroDefaults.videoThumbnailAlt ?? fallbackHero?.videoThumbnailAlt
		}
	};
}

function buildCatalogFromMediaAssets(rows: MediaAssetRow[]): {
	heroVideos: HeroVideoOption[];
	heroImages: HeroImageOption[];
	hybridSupportingImages: HybridSupportingImageOption[];
	speakerInActionVideos: SpeakerInActionVideoOption[];
} {
	const heroVideos: HeroVideoOption[] = [];
	const heroImages: HeroImageOption[] = [];
	const hybridSupportingImages: HybridSupportingImageOption[] = [];
	const speakerInActionVideos: SpeakerInActionVideoOption[] = [];

	for (const asset of rows) {
		if (asset.kind === 'video' && asset.sectionTypes.includes('immediate_authority_hero')) {
			if (!asset.thumbnailUrl || !asset.thumbnailAlt) {
				continue;
			}

			heroVideos.push({
				id: asset.id,
				title: asset.title,
				description: asset.description,
				usageNotes: asset.usageNotes,
				avoidNotes: asset.avoidNotes ?? undefined,
				videoEmbedUrl: asset.primaryUrl,
				videoThumbnailUrl: asset.thumbnailUrl,
				videoThumbnailAlt: asset.thumbnailAlt
			});

			heroImages.push({
				id: asset.id,
				title: asset.title,
				description: asset.description,
				usageNotes: asset.usageNotes,
				avoidNotes: asset.avoidNotes ?? undefined,
				imageUrl: asset.thumbnailUrl,
				alt: asset.thumbnailAlt
			});
		}

		if (asset.kind === 'image' && asset.sectionTypes.includes('immediate_authority_hero')) {
			heroImages.push({
				id: asset.id,
				title: asset.title,
				description: asset.description,
				usageNotes: asset.usageNotes,
				avoidNotes: asset.avoidNotes ?? undefined,
				imageUrl: asset.primaryUrl,
				alt: asset.thumbnailAlt ?? asset.title
			});
		}

		if (
			asset.kind === 'video' &&
			(asset.sectionTypes.includes('speaker_in_action') ||
				asset.sectionTypes.includes('youtube_grid'))
		) {
			if (!asset.thumbnailUrl || !asset.thumbnailAlt) {
				continue;
			}

			speakerInActionVideos.push({
				id: asset.id,
				title: asset.title,
				description: asset.description,
				usageNotes: asset.usageNotes,
				avoidNotes: asset.avoidNotes ?? undefined,
				videoEmbedUrl: asset.primaryUrl,
				videoThumbnailUrl: asset.thumbnailUrl,
				videoThumbnailAlt: asset.thumbnailAlt
			});
		}

		if (asset.kind === 'image' && asset.sectionTypes.includes('hybrid_content_section')) {
			hybridSupportingImages.push({
				id: asset.id,
				title: asset.title,
				description: asset.description,
				usageNotes: asset.usageNotes,
				avoidNotes: asset.avoidNotes ?? undefined,
				imageUrl: asset.primaryUrl,
				alt: asset.thumbnailAlt ?? asset.title
			});
		}
	}

	return { heroVideos, heroImages, hybridSupportingImages, speakerInActionVideos };
}

function ensureSpeakerInActionCatalog(
	speakerInActionVideos: SpeakerInActionVideoOption[],
	heroVideos: HeroVideoOption[]
): SpeakerInActionVideoOption[] {
	if (speakerInActionVideos.length >= 3 || heroVideos.length === 0) {
		return speakerInActionVideos;
	}

	const fallbackVideos: SpeakerInActionVideoOption[] = [...speakerInActionVideos];
	for (let index = speakerInActionVideos.length; index < 3; index += 1) {
		const heroSource = heroVideos[index % heroVideos.length];
		fallbackVideos.push({
			id: `fallback-speaker-${index + 1}`,
			title: `${heroSource.title} (Speaker fallback ${index + 1})`,
			description: heroSource.description,
			usageNotes: `${heroSource.usageNotes} This entry was auto-filled from hero videos because fewer than four speaker_in_action videos are configured.`,
			avoidNotes: heroSource.avoidNotes,
			videoEmbedUrl: heroSource.videoEmbedUrl,
			videoThumbnailUrl: heroSource.videoThumbnailUrl,
			videoThumbnailAlt: heroSource.videoThumbnailAlt
		});
	}

	console.warn(
		`Landing page assets: auto-filled speaker_in_action catalog from hero videos (speaker=${speakerInActionVideos.length}, hero=${heroVideos.length}).`
	);

	return fallbackVideos;
}

function buildLogoCatalog(rows: LogoRow[]): LogoOption[] {
	return rows.map((logo) => ({
		id: logo.id,
		name: logo.name,
		logoUrl: logo.logoUrl,
		logoAlt: logo.logoAlt
	}));
}

function buildKeynoteCatalog(rows: KeynoteRow[]): KeynoteOption[] {
	return rows.map((keynote) => ({
		id: keynote.id,
		title: keynote.title,
		summary: keynote.keynoteShort ?? keynote.summary ?? '',
		audience: keynote.audience ?? '',
		keynoteShort: keynote.keynoteShort ?? keynote.summary ?? '',
		imageUrl: keynote.imageUrl,
		imageAlt: keynote.imageAlt
	}));
}

export async function loadLandingPageAssets(
	context?: LandingPageAssetContext
): Promise<LandingPageAssets> {
	try {
		const activeSet = await loadActiveLandingPageAssetSet();
		const mediaRows = sortMediaAssetsByRelevance(await loadActiveMediaAssets(), context);
		const catalog = buildCatalogFromMediaAssets(mediaRows);
		const speakerInActionVideos = ensureSpeakerInActionCatalog(
			catalog.speakerInActionVideos,
			catalog.heroVideos
		);
		const logosCatalog = buildLogoCatalog(await loadActiveLogos());
		const keynoteCatalog = buildKeynoteCatalog(await loadActiveKeynotes());

		if (!activeSet) {
			return fillHeroDefaultsFromCatalog(
				{
					...landingPageAssets,
					assetCatalog: {
						heroVideos: catalog.heroVideos,
						heroImages: catalog.heroImages,
						hybridSupportingImages: catalog.hybridSupportingImages,
						speakerInActionVideos,
						logoCatalog: logosCatalog,
						keynoteCatalog
					}
				},
				catalog
			);
		}

		const parsedAssets = landingPageAssetsSchema.safeParse(activeSet.assetsJson);
		if (!parsedAssets.success) {
			console.warn(
				`Invalid landing page assets in set ${activeSet.assetKey}. Falling back to static defaults.`,
				parsedAssets.error.flatten()
			);
			return fillHeroDefaultsFromCatalog(
				{
					...landingPageAssets,
					assetCatalog: {
						heroVideos: catalog.heroVideos,
						heroImages: catalog.heroImages,
						hybridSupportingImages: catalog.hybridSupportingImages,
						speakerInActionVideos,
						logoCatalog: logosCatalog,
						keynoteCatalog
					}
				},
				catalog
			);
		}

		return fillHeroDefaultsFromCatalog(
			{
				...parsedAssets.data,
				assetCatalog: {
					heroVideos: catalog.heroVideos,
					heroImages: catalog.heroImages,
					hybridSupportingImages: catalog.hybridSupportingImages,
					speakerInActionVideos,
					logoCatalog: logosCatalog,
					keynoteCatalog
				}
			},
			catalog
		);
	} catch (error) {
		console.warn(
			'Unable to load landing page assets from database. Falling back to static defaults.',
			{
				error
			}
		);
		return landingPageAssets;
	}
}
