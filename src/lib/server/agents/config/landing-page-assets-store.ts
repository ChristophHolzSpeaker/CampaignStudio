import { db } from '$lib/server/db';
import { landing_page_asset_sets, media_assets } from '$lib/server/db/schema';
import { asc, desc, eq } from 'drizzle-orm';
import { landingPageAssets } from './landing-page-assets';
import {
	landingPageAssetsSchema,
	type HeroVideoOption,
	type HybridSupportingImageOption,
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
			priority: media_assets.priority
		})
		.from(media_assets)
		.where(eq(media_assets.is_active, true))
		.orderBy(asc(media_assets.priority), asc(media_assets.id));

	return rows;
}

function buildCatalogFromMediaAssets(rows: MediaAssetRow[]): {
	heroVideos: HeroVideoOption[];
	hybridSupportingImages: HybridSupportingImageOption[];
} {
	const heroVideos: HeroVideoOption[] = [];
	const hybridSupportingImages: HybridSupportingImageOption[] = [];

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

	return { heroVideos, hybridSupportingImages };
}

export async function loadLandingPageAssets(): Promise<LandingPageAssets> {
	try {
		const activeSet = await loadActiveLandingPageAssetSet();
		if (!activeSet) {
			const mediaRows = await loadActiveMediaAssets();
			const catalog = buildCatalogFromMediaAssets(mediaRows);
			return {
				...landingPageAssets,
				assetCatalog: {
					heroVideos:
						catalog.heroVideos.length > 0
							? catalog.heroVideos
							: landingPageAssets.assetCatalog.heroVideos,
					hybridSupportingImages:
						catalog.hybridSupportingImages.length > 0
							? catalog.hybridSupportingImages
							: landingPageAssets.assetCatalog.hybridSupportingImages
				}
			};
		}

		const parsedAssets = landingPageAssetsSchema.safeParse(activeSet.assetsJson);
		if (!parsedAssets.success) {
			console.warn(
				`Invalid landing page assets in set ${activeSet.assetKey}. Falling back to static defaults.`,
				parsedAssets.error.flatten()
			);
			return landingPageAssets;
		}

		const mediaRows = await loadActiveMediaAssets();
		const catalog = buildCatalogFromMediaAssets(mediaRows);

		return {
			...parsedAssets.data,
			assetCatalog: {
				heroVideos:
					catalog.heroVideos.length > 0
						? catalog.heroVideos
						: parsedAssets.data.assetCatalog.heroVideos,
				hybridSupportingImages:
					catalog.hybridSupportingImages.length > 0
						? catalog.hybridSupportingImages
						: parsedAssets.data.assetCatalog.hybridSupportingImages
			}
		};
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
