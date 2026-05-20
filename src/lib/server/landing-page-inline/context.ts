import type { RequestEvent } from '@sveltejs/kit';
import { parseLandingPageDocument, type LandingPageDocument } from '$lib/page-builder/page';
import { persistGeneratedLandingPage } from '$lib/server/agents/landing-page-pipeline';
import { db } from '$lib/server/db';
import { campaign_pages, campaigns } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';

const INLINE_EDIT_SESSION_PREFIX = 'Inline edit session';

export type EditablePageContext = {
	page: LandingPageDocument;
	sourcePageRecord: {
		id: number;
		campaignId: number;
		isPublished: boolean;
		changeNote: string | null;
		versionNumber: number;
	};
	isExistingSession: boolean;
};

type LoadEditablePageContextInput = {
	event: RequestEvent;
	campaignId: number;
	campaignPageId: number;
};

export async function loadEditablePageContext(
	input: LoadEditablePageContextInput
): Promise<EditablePageContext> {
	const {
		data: { user }
	} = await input.event.locals.supabase.auth.getUser();

	if (!user) {
		throw new Error('Unauthorized');
	}

	const [campaignRecord] = await db
		.select({ id: campaigns.id, status: campaigns.status })
		.from(campaigns)
		.where(eq(campaigns.id, input.campaignId))
		.limit(1);

	if (!campaignRecord) {
		throw new Error('Campaign not found');
	}

	if (campaignRecord.status === 'published') {
		throw new Error('Inline edits are only allowed in preview mode');
	}

	const [sourcePageRecord] = await db
		.select({
			id: campaign_pages.id,
			campaignId: campaign_pages.campaign_id,
			structuredContentJson: campaign_pages.structured_content_json,
			isPublished: campaign_pages.is_published,
			changeNote: campaign_pages.change_note,
			versionNumber: campaign_pages.version_number
		})
		.from(campaign_pages)
		.where(eq(campaign_pages.id, input.campaignPageId))
		.limit(1);

	if (!sourcePageRecord || sourcePageRecord.campaignId !== input.campaignId) {
		throw new Error('Campaign page not found');
	}

	if (sourcePageRecord.isPublished) {
		throw new Error('Published pages cannot be edited inline');
	}

	return {
		page: parseLandingPageDocument(sourcePageRecord.structuredContentJson),
		sourcePageRecord: {
			id: sourcePageRecord.id,
			campaignId: sourcePageRecord.campaignId,
			isPublished: sourcePageRecord.isPublished,
			changeNote: sourcePageRecord.changeNote,
			versionNumber: sourcePageRecord.versionNumber
		},
		isExistingSession: (sourcePageRecord.changeNote ?? '').startsWith(INLINE_EDIT_SESSION_PREFIX)
	};
}

type PersistInlineSessionOrUpdateInput = {
	campaignId: number;
	sourcePageRecord: EditablePageContext['sourcePageRecord'];
	updatedPage: LandingPageDocument;
};

export async function saveAsInlineSessionOrUpdate(
	input: PersistInlineSessionOrUpdateInput
): Promise<{ campaignPageId: number; createdSession: boolean }> {
	const isExistingSession = (input.sourcePageRecord.changeNote ?? '').startsWith(
		INLINE_EDIT_SESSION_PREFIX
	);

	if (isExistingSession) {
		await db
			.update(campaign_pages)
			.set({
				structured_content_json: input.updatedPage,
				updated_at: new Date()
			})
			.where(eq(campaign_pages.id, input.sourcePageRecord.id));

		return {
			campaignPageId: input.sourcePageRecord.id,
			createdSession: false
		};
	}

	const [latestPage] = await db
		.select({ id: campaign_pages.id })
		.from(campaign_pages)
		.where(eq(campaign_pages.campaign_id, input.campaignId))
		.orderBy(desc(campaign_pages.version_number))
		.limit(1);

	if (!latestPage || latestPage.id !== input.sourcePageRecord.id) {
		throw new Error('Inline edits are only available on the latest preview version');
	}

	const persisted = await persistGeneratedLandingPage(
		input.campaignId,
		input.updatedPage,
		undefined,
		`${INLINE_EDIT_SESSION_PREFIX} (v${input.sourcePageRecord.versionNumber})`
	);

	return {
		campaignPageId: persisted.campaignPageId,
		createdSession: true
	};
}
