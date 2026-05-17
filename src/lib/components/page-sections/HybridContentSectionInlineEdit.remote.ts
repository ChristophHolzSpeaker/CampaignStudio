import { command, getRequestEvent } from '$app/server';
import { parseLandingPageDocument } from '$lib/page-builder/page';
import { persistGeneratedLandingPage } from '$lib/server/agents/landing-page-pipeline';
import { db } from '$lib/server/db';
import { campaign_pages, campaigns, media_assets } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

const inlineEditInputSchema = z.object({
	campaignId: z.number().int().positive(),
	campaignPageId: z.number().int().positive(),
	sectionIndex: z.number().int().min(0),
	sectionType: z.literal('hybrid_content_section'),
	target: z.discriminatedUnion('kind', [
		z.object({ kind: z.literal('title') }),
		z.object({ kind: z.literal('intro') }),
		z.object({ kind: z.literal('deepDiveTitle') }),
		z.object({ kind: z.literal('emailCtaTitle') }),
		z.object({ kind: z.literal('benefitTitle'), index: z.number().int().min(0) }),
		z.object({ kind: z.literal('benefitBody'), index: z.number().int().min(0) }),
		z.object({ kind: z.literal('deepDiveItemTitle'), index: z.number().int().min(0) }),
		z.object({ kind: z.literal('deepDiveItemBody'), index: z.number().int().min(0) })
	]),
	value: z.string()
});

const INLINE_EDIT_SESSION_PREFIX = 'Inline edit session';

const hybridPrimaryVisualImageInputSchema = z.object({
	campaignId: z.number().int().positive(),
	campaignPageId: z.number().int().positive(),
	sectionIndex: z.number().int().min(0),
	sectionType: z.literal('hybrid_content_section'),
	assetId: z.string().trim().min(1)
});

function hasString(value: unknown): value is string {
	return typeof value === 'string';
}

export const saveHybridContentSectionField = command(inlineEditInputSchema, async (input) => {
	const event = getRequestEvent();
	const {
		data: { user }
	} = await event.locals.supabase.auth.getUser();

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
		.where(
			and(
				eq(campaign_pages.id, input.campaignPageId),
				eq(campaign_pages.campaign_id, input.campaignId)
			)
		)
		.limit(1);

	if (!sourcePageRecord) {
		throw new Error('Campaign page not found');
	}

	if (sourcePageRecord.isPublished) {
		throw new Error('Published pages cannot be edited inline');
	}

	const page = parseLandingPageDocument(sourcePageRecord.structuredContentJson);
	const section = page.sections[input.sectionIndex];

	if (!section) {
		throw new Error('Section not found');
	}

	if (section.type !== 'hybrid_content_section' || input.sectionType !== 'hybrid_content_section') {
		throw new Error('Only Hybrid Content section fields can be edited here');
	}

	let currentValue: string;

	switch (input.target.kind) {
		case 'title':
		case 'intro':
		case 'deepDiveTitle':
		case 'emailCtaTitle': {
			const candidate = section.props[input.target.kind];
			if (input.target.kind === 'emailCtaTitle') {
				if (candidate !== undefined && !hasString(candidate)) {
					throw new Error('Field is not editable');
				}
				currentValue = candidate ?? '';
				break;
			}

			if (!hasString(candidate)) {
				throw new Error('Field is not editable');
			}
			currentValue = candidate;
			break;
		}
		case 'benefitTitle':
		case 'benefitBody': {
			const benefit = section.props.benefits[input.target.index];
			if (!benefit) {
				throw new Error('Benefit item not found');
			}
			const key = input.target.kind === 'benefitTitle' ? 'title' : 'body';
			if (!hasString(benefit[key])) {
				throw new Error('Field is not editable');
			}
			currentValue = benefit[key];
			break;
		}
		case 'deepDiveItemTitle':
		case 'deepDiveItemBody': {
			const deepDiveItem = section.props.deepDiveItems[input.target.index];
			if (!deepDiveItem) {
				throw new Error('Deep dive item not found');
			}
			const key = input.target.kind === 'deepDiveItemTitle' ? 'title' : 'body';
			if (!hasString(deepDiveItem[key])) {
				throw new Error('Field is not editable');
			}
			currentValue = deepDiveItem[key];
			break;
		}
	}

	if (currentValue === input.value) {
		return {
			saved: false,
			campaignPageId: sourcePageRecord.id,
			target: input.target,
			value: currentValue,
			createdSession: false
		};
	}

	const updatedPage = {
		...page,
		sections: page.sections.map((item, index) => {
			if (index !== input.sectionIndex || item.type !== 'hybrid_content_section') {
				return item;
			}

			switch (input.target.kind) {
				case 'title':
				case 'intro':
				case 'deepDiveTitle':
				case 'emailCtaTitle': {
					return {
						...item,
						props: {
							...item.props,
							[input.target.kind]: input.value
						}
					};
				}
				case 'benefitTitle':
				case 'benefitBody': {
					const key = input.target.kind === 'benefitTitle' ? 'title' : 'body';
					const targetIndex = input.target.index;
					return {
						...item,
						props: {
							...item.props,
							benefits: item.props.benefits.map((benefit, benefitIndex) => {
								if (benefitIndex !== targetIndex) {
									return benefit;
								}

								return {
									...benefit,
									[key]: input.value
								};
							})
						}
					};
				}
				case 'deepDiveItemTitle':
				case 'deepDiveItemBody': {
					const key = input.target.kind === 'deepDiveItemTitle' ? 'title' : 'body';
					const targetIndex = input.target.index;
					return {
						...item,
						props: {
							...item.props,
							deepDiveItems: item.props.deepDiveItems.map((deepDiveItem, deepDiveIndex) => {
								if (deepDiveIndex !== targetIndex) {
									return deepDiveItem;
								}

								return {
									...deepDiveItem,
									[key]: input.value
								};
							})
						}
					};
				}
			}
		})
	};

	const isExistingSession = (sourcePageRecord.changeNote ?? '').startsWith(
		INLINE_EDIT_SESSION_PREFIX
	);

	if (isExistingSession) {
		await db
			.update(campaign_pages)
			.set({
				structured_content_json: updatedPage,
				updated_at: new Date()
			})
			.where(eq(campaign_pages.id, sourcePageRecord.id));

		return {
			saved: true,
			campaignPageId: sourcePageRecord.id,
			target: input.target,
			value: input.value,
			createdSession: false
		};
	}

	const [latestPage] = await db
		.select({ id: campaign_pages.id })
		.from(campaign_pages)
		.where(eq(campaign_pages.campaign_id, input.campaignId))
		.orderBy(desc(campaign_pages.version_number))
		.limit(1);

	if (!latestPage || latestPage.id !== sourcePageRecord.id) {
		throw new Error('Inline edits are only available on the latest preview version');
	}

	const persisted = await persistGeneratedLandingPage(
		input.campaignId,
		updatedPage,
		undefined,
		`${INLINE_EDIT_SESSION_PREFIX} (v${sourcePageRecord.versionNumber})`
	);

	return {
		saved: true,
		campaignPageId: persisted.campaignPageId,
		target: input.target,
		value: input.value,
		createdSession: true
	};
});

export const saveHybridPrimaryVisualImage = command(
	hybridPrimaryVisualImageInputSchema,
	async (input) => {
		const event = getRequestEvent();
		const {
			data: { user }
		} = await event.locals.supabase.auth.getUser();

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
			.where(
				and(
					eq(campaign_pages.id, input.campaignPageId),
					eq(campaign_pages.campaign_id, input.campaignId)
				)
			)
			.limit(1);

		if (!sourcePageRecord) {
			throw new Error('Campaign page not found');
		}

		if (sourcePageRecord.isPublished) {
			throw new Error('Published pages cannot be edited inline');
		}

		const [selectedAsset] = await db
			.select({
				id: media_assets.id,
				kind: media_assets.kind,
				primaryUrl: media_assets.primary_url,
				thumbnailAlt: media_assets.thumbnail_alt,
				title: media_assets.title,
				sectionTypes: media_assets.section_types
			})
			.from(media_assets)
			.where(and(eq(media_assets.id, input.assetId), eq(media_assets.is_active, true)))
			.limit(1);

		if (!selectedAsset) {
			throw new Error('Selected asset not found');
		}

		if (selectedAsset.kind !== 'image') {
			throw new Error('Only image assets can be used for hybrid primary visuals');
		}

		if (!selectedAsset.sectionTypes.includes('hybrid_content_section')) {
			console.warn(
				`Hybrid primary visual override using non-hybrid-tagged image asset '${selectedAsset.id}'.`
			);
		}

		const nextImageUrl = selectedAsset.primaryUrl.trim();
		const nextImageAlt = (selectedAsset.thumbnailAlt ?? selectedAsset.title).trim();

		if (!nextImageUrl || !nextImageAlt) {
			throw new Error('Selected asset has incomplete image metadata');
		}

		const page = parseLandingPageDocument(sourcePageRecord.structuredContentJson);
		const section = page.sections[input.sectionIndex];

		if (!section) {
			throw new Error('Section not found');
		}

		if (
			section.type !== 'hybrid_content_section' ||
			input.sectionType !== 'hybrid_content_section'
		) {
			throw new Error('Only Hybrid Content section images can be edited here');
		}

		const legacyPrimaryVisual = (
			section.props as { supportingVisualItems?: { imageUrl: string; alt: string }[] }
		).supportingVisualItems?.[0];
		const currentImageUrl = (
			section.props.primaryVisual?.imageUrl ??
			legacyPrimaryVisual?.imageUrl ??
			''
		).trim();
		const currentImageAlt = (
			section.props.primaryVisual?.alt ??
			legacyPrimaryVisual?.alt ??
			''
		).trim();

		if (currentImageUrl === nextImageUrl && currentImageAlt === nextImageAlt) {
			return {
				saved: false,
				campaignPageId: sourcePageRecord.id,
				imageUrl: currentImageUrl,
				imageAlt: currentImageAlt,
				createdSession: false
			};
		}

		const updatedPage = {
			...page,
			sections: page.sections.map((item, index) => {
				if (index !== input.sectionIndex || item.type !== 'hybrid_content_section') {
					return item;
				}

				return {
					...item,
					props: {
						...item.props,
						primaryVisual: {
							imageUrl: nextImageUrl,
							alt: nextImageAlt
						}
					}
				};
			})
		};

		const isExistingSession = (sourcePageRecord.changeNote ?? '').startsWith(
			INLINE_EDIT_SESSION_PREFIX
		);

		if (isExistingSession) {
			await db
				.update(campaign_pages)
				.set({
					structured_content_json: updatedPage,
					updated_at: new Date()
				})
				.where(eq(campaign_pages.id, sourcePageRecord.id));

			return {
				saved: true,
				campaignPageId: sourcePageRecord.id,
				imageUrl: nextImageUrl,
				imageAlt: nextImageAlt,
				createdSession: false
			};
		}

		const [latestPage] = await db
			.select({ id: campaign_pages.id })
			.from(campaign_pages)
			.where(eq(campaign_pages.campaign_id, input.campaignId))
			.orderBy(desc(campaign_pages.version_number))
			.limit(1);

		if (!latestPage || latestPage.id !== sourcePageRecord.id) {
			throw new Error('Inline edits are only available on the latest preview version');
		}

		const persisted = await persistGeneratedLandingPage(
			input.campaignId,
			updatedPage,
			undefined,
			`${INLINE_EDIT_SESSION_PREFIX} (v${sourcePageRecord.versionNumber})`
		);

		return {
			saved: true,
			campaignPageId: persisted.campaignPageId,
			imageUrl: nextImageUrl,
			imageAlt: nextImageAlt,
			createdSession: true
		};
	}
);
