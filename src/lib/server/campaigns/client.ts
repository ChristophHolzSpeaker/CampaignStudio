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

export async function getCampaignById(id: number): Promise<CampaignRecord | null> {
	const [record] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
	return (record as CampaignRecord) ?? null;
}

export async function createCampaign(input: {
	name: string;
	audience: string;
	format: string;
	topic: string;
	language: string;
	geography: string;
	notes: string | null;
	created_by: string | null;
}): Promise<CampaignRecord> {
	const [created] = await db
		.insert(campaigns)
		.values({
			name: input.name,
			audience: input.audience,
			format: input.format,
			topic: input.topic,
			language: input.language,
			geography: input.geography,
			notes: input.notes,
			status: 'draft',
			created_by: input.created_by
		})
		.returning();

	if (!created) {
		throw new Error('Failed to create campaign');
	}

	return created as CampaignRecord;
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
