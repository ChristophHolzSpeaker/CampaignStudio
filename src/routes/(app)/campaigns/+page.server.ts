import { db } from '$lib/server/db';
import { campaigns } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const campaignList = await loadCampaigns();

	return {
		campaignList
	};
};
async function loadCampaigns() {
	try {
		return await db.select().from(campaigns).orderBy(desc(campaigns.created_at));
	} catch (err) {
		console.error('Error loading campaigns:', err);
		return [];
	}
}
