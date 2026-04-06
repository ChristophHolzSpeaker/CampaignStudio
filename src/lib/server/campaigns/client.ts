import { db } from '$lib/server/db';
import { campaigns } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type {
	CampaignAd,
	CampaignAdGroupRecord,
	CampaignAdGroupWithDetails,
	CampaignAdPackage,
	CampaignAdPackageWithDetails,
	CampaignKeyword
} from './ads';
import {
	createAdGroup,
	createAdPackage,
	createCampaignAd,
	createKeyword,
	getCampaignAdPackageWithDetails,
	getCampaignAdPackages
} from './ads';

export type CampaignStatus = 'draft' | 'published' | 'generated' | 'scheduled' | 'archived';

export interface CampaignRecord {
	id: number;
	name: string;
	audience: string;
	format: string;
	topic: string;
	language: string;
	geography: string;
	notes: string | null;
	status: CampaignStatus | string;
	created_at: Date;
	updated_at: Date;
	created_by: string | null;
}

export async function listCampaigns(): Promise<CampaignRecord[]> {
	return await db.select().from(campaigns).orderBy(desc(campaigns.created_at));
}

export {
	createAdPackage,
	createAdGroup,
	createKeyword,
	createCampaignAd,
	getCampaignAdPackages,
	getCampaignAdPackageWithDetails
};

export type {
	CampaignAdPackage,
	CampaignAdPackageWithDetails,
	CampaignAdGroupRecord,
	CampaignAdGroupWithDetails,
	CampaignAd,
	CampaignKeyword
};
export async function setCampaignStatus(id: number, status: string): Promise<void> {
	await db.update(campaigns).set({ status, updated_at: new Date() }).where(eq(campaigns.id, id));
}
