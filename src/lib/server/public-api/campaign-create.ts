import { z } from 'zod';
import { landingPageDocumentSchema, parseLandingPageDocument } from '$lib/page-builder/page';
import { campaignFormSchema } from '$lib/validation/campaign';
import { db } from '$lib/server/db';
import { campaign_pages, campaigns } from '$lib/server/db/schema';
import { persistGeneratedLandingPage } from '$lib/server/agents/landing-page-pipeline';
import { eq } from 'drizzle-orm';

const artifactCampaignCreateRequestSchema = z
	.object({
		renderer_type: z.literal('artifact'),
		campaign: campaignFormSchema
	})
	.strict();

const sectionCampaignCreateRequestSchema = z
	.object({
		renderer_type: z.literal('sections').optional(),
		campaign: campaignFormSchema,
		content_json: landingPageDocumentSchema,
		change_note: z.string().trim().max(500).optional()
	})
	.strict();

export const publicCampaignCreateRequestSchema = z.union([
	artifactCampaignCreateRequestSchema,
	sectionCampaignCreateRequestSchema
]);

export type PublicCampaignCreateRequest = z.infer<typeof publicCampaignCreateRequestSchema>;

export async function createCampaignFromPublicApi(input: PublicCampaignCreateRequest): Promise<
	| {
			campaignId: number;
			rendererType: 'artifact';
	  }
	| {
			campaignId: number;
			rendererType: 'sections';
			campaignPageId: number;
			pageSlug: string;
	  }
> {
	if (input.renderer_type === 'artifact') {
		const [createdCampaign] = await db
			.insert(campaigns)
			.values({
				name: input.campaign.name,
				audience: input.campaign.audience,
				format: input.campaign.format,
				topic: input.campaign.topic,
				language: input.campaign.language,
				geography: input.campaign.geography,
				notes: input.campaign.notes?.trim() || null,
				status: 'draft',
				created_by: null
			})
			.returning({ id: campaigns.id });

		if (!createdCampaign) throw new Error('Failed to create campaign');
		return { campaignId: createdCampaign.id, rendererType: 'artifact' };
	}

	const page = parseLandingPageDocument(input.content_json);
	const changeNote = input.change_note?.trim() || 'Created via public campaign API';

	return db.transaction(async (tx) => {
		const [createdCampaign] = await tx
			.insert(campaigns)
			.values({
				name: input.campaign.name,
				audience: input.campaign.audience,
				format: input.campaign.format,
				topic: input.campaign.topic,
				language: input.campaign.language,
				geography: input.campaign.geography,
				notes: input.campaign.notes?.trim() || null,
				status: 'draft',
				created_by: null
			})
			.returning({ id: campaigns.id });

		if (!createdCampaign) {
			throw new Error('Failed to create campaign');
		}

		const persistedPage = await persistGeneratedLandingPage(
			createdCampaign.id,
			page,
			tx,
			changeNote
		);

		const [createdPage] = await tx
			.select({ slug: campaign_pages.slug })
			.from(campaign_pages)
			.where(eq(campaign_pages.id, persistedPage.campaignPageId))
			.limit(1);

		return {
			campaignId: createdCampaign.id,
			rendererType: 'sections' as const,
			campaignPageId: persistedPage.campaignPageId,
			pageSlug: createdPage?.slug ?? ''
		};
	});
}
