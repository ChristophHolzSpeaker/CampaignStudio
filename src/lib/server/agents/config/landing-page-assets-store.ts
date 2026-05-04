import { db } from '$lib/server/db';
import { clients, landing_page_asset_sets, media_assets } from '$lib/server/db/schema';
import { asc, desc, eq } from 'drizzle-orm';
import { landingPageAssets } from './landing-page-assets';
import {
	landingPageAssetsSchema,
	type HeroVideoOption,
	type HybridSupportingImageOption,
	type SpeakerInActionVideoOption,
	type ClientOption,
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

type ClientRow = {
	id: string;
	name: string;
	logoUrl: string;
	logoAlt: string;
	industry: string;
	keynoteCaseStudy: string;
	audiences: string[];
	topics: string[];
	formats: string[];
	geographies: string[];
	intentTags: string[];
	priority: number;
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

async function loadActiveClients(): Promise<ClientRow[]> {
	const rows = await db
		.select({
			id: clients.id,
			name: clients.name,
			logoUrl: clients.logo_url,
			logoAlt: clients.logo_alt,
			industry: clients.industry,
			keynoteCaseStudy: clients.keynote_case_study,
			audiences: clients.audiences,
			topics: clients.topics,
			formats: clients.formats,
			geographies: clients.geographies,
			intentTags: clients.intent_tags,
			priority: clients.priority
		})
		.from(clients)
		.where(eq(clients.is_active, true))
		.orderBy(asc(clients.priority), asc(clients.id));

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

function sortClientsByRelevance(rows: ClientRow[], context?: LandingPageAssetContext): ClientRow[] {
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
			scoreOverlap([left.industry], contextTokens) * 5 +
			scoreOverlap(left.audiences, contextTokens) * 4 +
			scoreOverlap(left.topics, contextTokens) * 3 +
			scoreOverlap(left.formats, contextTokens) * 2 +
			scoreOverlap(left.geographies, contextTokens) * 2 +
			scoreOverlap(left.intentTags, contextTokens) * 4 +
			scoreOverlap([left.keynoteCaseStudy], contextTokens) * 2;
		const rightScore =
			scoreOverlap([right.industry], contextTokens) * 5 +
			scoreOverlap(right.audiences, contextTokens) * 4 +
			scoreOverlap(right.topics, contextTokens) * 3 +
			scoreOverlap(right.formats, contextTokens) * 2 +
			scoreOverlap(right.geographies, contextTokens) * 2 +
			scoreOverlap(right.intentTags, contextTokens) * 4 +
			scoreOverlap([right.keynoteCaseStudy], contextTokens) * 2;

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
	catalog: { heroVideos: HeroVideoOption[] }
): LandingPageAssets {
	const fallbackHero = catalog.heroVideos[0];
	if (!fallbackHero) {
		return assets;
	}

	return {
		...assets,
		heroDefaults: {
			...assets.heroDefaults,
			videoThumbnailUrl: assets.heroDefaults.videoThumbnailUrl ?? fallbackHero.videoThumbnailUrl,
			videoThumbnailAlt: assets.heroDefaults.videoThumbnailAlt ?? fallbackHero.videoThumbnailAlt
		}
	};
}

function buildCatalogFromMediaAssets(rows: MediaAssetRow[]): {
	heroVideos: HeroVideoOption[];
	hybridSupportingImages: HybridSupportingImageOption[];
	speakerInActionVideos: SpeakerInActionVideoOption[];
} {
	const heroVideos: HeroVideoOption[] = [];
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
		}

		if (asset.kind === 'video' && asset.sectionTypes.includes('speaker_in_action')) {
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

	return { heroVideos, hybridSupportingImages, speakerInActionVideos };
}

function buildClientCatalog(rows: ClientRow[]): ClientOption[] {
	return rows.map((client) => ({
		id: client.id,
		name: client.name,
		logoUrl: client.logoUrl,
		logoAlt: client.logoAlt,
		industry: client.industry,
		keynoteCaseStudy: client.keynoteCaseStudy,
		audiences: client.audiences,
		topics: client.topics,
		formats: client.formats,
		geographies: client.geographies,
		intentTags: client.intentTags
	}));
}

export async function loadLandingPageAssets(
	context?: LandingPageAssetContext
): Promise<LandingPageAssets> {
	try {
		const activeSet = await loadActiveLandingPageAssetSet();
		const mediaRows = sortMediaAssetsByRelevance(await loadActiveMediaAssets(), context);
		const catalog = buildCatalogFromMediaAssets(mediaRows);
		const clientsCatalog = buildClientCatalog(
			sortClientsByRelevance(await loadActiveClients(), context)
		);

		if (!activeSet) {
			return fillHeroDefaultsFromCatalog(
				{
					...landingPageAssets,
					assetCatalog: {
						heroVideos: catalog.heroVideos,
						hybridSupportingImages: catalog.hybridSupportingImages,
						speakerInActionVideos: catalog.speakerInActionVideos,
						clientCatalog: clientsCatalog
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
						hybridSupportingImages: catalog.hybridSupportingImages,
						speakerInActionVideos: catalog.speakerInActionVideos,
						clientCatalog: clientsCatalog
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
					hybridSupportingImages: catalog.hybridSupportingImages,
					speakerInActionVideos: catalog.speakerInActionVideos,
					clientCatalog: clientsCatalog
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
