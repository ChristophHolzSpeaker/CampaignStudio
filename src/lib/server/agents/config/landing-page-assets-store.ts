import { db } from '$lib/server/db';
import { landing_page_asset_sets } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { landingPageAssets } from './landing-page-assets';
import { landingPageAssetsSchema, type LandingPageAssets } from '../schemas/landing-page-assets';

type AssetSetRow = {
	assetKey: string;
	assetsJson: unknown;
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

export async function loadLandingPageAssets(): Promise<LandingPageAssets> {
	try {
		const activeSet = await loadActiveLandingPageAssetSet();
		if (!activeSet) {
			return landingPageAssets;
		}

		const parsedAssets = landingPageAssetsSchema.safeParse(activeSet.assetsJson);
		if (!parsedAssets.success) {
			console.warn(
				`Invalid landing page assets in set ${activeSet.assetKey}. Falling back to static defaults.`,
				parsedAssets.error.flatten()
			);
			return landingPageAssets;
		}

		return parsedAssets.data;
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
