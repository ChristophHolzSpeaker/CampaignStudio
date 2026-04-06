import { db } from '$lib/server/db';
import { campaigns } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

export type CampaignStatus = 'draft' | 'published' | 'generated' | 'scheduled' | 'archived';

export interface CampaignRecord {
	id: number;
	name: string;
	audience: string;
	format: string;
	topic: string;
	notes: string | null;
	status: CampaignStatus | string;
	created_at: Date;
	updated_at: Date;
	created_by: string | null;
}

export async function listCampaigns(): Promise<CampaignRecord[]> {
	return await db.select().from(campaigns).orderBy(desc(campaigns.created_at));
}

export async function setCampaignStatus(id: number, status: string): Promise<void> {
	await db.update(campaigns).set({ status, updated_at: new Date() }).where(eq(campaigns.id, id));
}
