import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { parseLandingPageDocument } from '$lib/page-builder/page';
import {
	buildSpeakerMailtoHref,
	DEFAULT_SPEAKER_EMAIL_SUBJECT
} from '$lib/server/attribution/mailto';
import { db } from '$lib/server/db';
import { campaign_pages, campaigns } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import type { LandingPageDocument } from '$lib/page-builder/page';
import type { SeoProps } from '$lib/page-builder/sections';

type SpeakerJsonLd = {
	'@context': 'https://schema.org';
	'@graph': Array<Record<string, unknown>>;
};

function getSeoSection(page: LandingPageDocument): SeoProps | undefined {
	const section = page.sections.find((item) => item.type === 'seo');

	if (!section || section.type !== 'seo') {
		return undefined;
	}

	return section.props;
}

function getHeroSection(page: LandingPageDocument) {
	const section = page.sections.find((item) => item.type === 'immediate_authority_hero');

	if (!section || section.type !== 'immediate_authority_hero') {
		return undefined;
	}

	return section;
}

function buildSpeakerJsonLd({
	page,
	origin,
	slug
}: {
	page: ReturnType<typeof parseLandingPageDocument>;
	origin: string;
	slug: string;
}): string {
	const seo = getSeoSection(page);
	const hero = getHeroSection(page);
	const canonicalUrl = seo?.canonicalUrl?.trim() || new URL(`/speaker/${slug}`, origin).href;
	const pageUrl = new URL(canonicalUrl, origin);
	const homeUrl = new URL('/', origin).href;
	const pageDescription = seo?.description?.trim() || page.title;
	const heroProps = hero?.props;
	const personDescription = heroProps?.subheadline.trim() || pageDescription;
	const imageUrl = heroProps?.heroImageUrl?.trim() || heroProps?.videoThumbnailUrl?.trim();
	const webPageId = `${pageUrl.href}#webpage`;
	const personId = `${homeUrl}#person`;

	const jsonLd: SpeakerJsonLd = {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebPage',
				'@id': webPageId,
				url: pageUrl.href,
				name: seo?.title?.trim() || page.title,
				description: pageDescription,
				inLanguage: 'en',
				about: { '@id': personId },
				mainEntity: { '@id': personId },
				...(imageUrl
					? {
							primaryImageOfPage: {
								'@type': 'ImageObject',
								url: imageUrl
							}
						}
					: {})
			},
			{
				'@type': 'Person',
				'@id': personId,
				name: 'Christoph Holz',
				url: homeUrl,
				description: personDescription,
				jobTitle: 'Keynote Speaker',
				mainEntityOfPage: { '@id': webPageId },
				...(imageUrl ? { image: imageUrl } : {})
			}
		]
	};

	return JSON.stringify(jsonLd).replace(/</g, '\\u003c');
}

export const load: PageServerLoad = async ({ params, url }) => {
	const slug = params.slug?.trim();

	if (!slug) {
		throw error(404, 'Page not found');
	}

	const [pageRecord] = await db
		.select({
			structuredContentJson: campaign_pages.structured_content_json,
			campaignId: campaign_pages.campaign_id,
			campaignPageId: campaign_pages.id
		})
		.from(campaign_pages)
		.innerJoin(campaigns, eq(campaigns.id, campaign_pages.campaign_id))
		.where(
			and(
				eq(campaign_pages.slug, slug),
				eq(campaign_pages.is_published, true),
				eq(campaigns.status, 'published')
			)
		)
		.limit(1);

	if (!pageRecord) {
		throw error(404, 'Page not found');
	}

	const page = parseLandingPageDocument(pageRecord.structuredContentJson);
	const jsonLd = buildSpeakerJsonLd({ page, origin: url.origin, slug });

	return {
		page,
		campaignId: pageRecord.campaignId,
		campaignPageId: pageRecord.campaignPageId,
		jsonLd,
		speakerMailtoHref: buildSpeakerMailtoHref({
			campaignId: pageRecord.campaignId,
			campaignPageId: pageRecord.campaignPageId,
			subject: DEFAULT_SPEAKER_EMAIL_SUBJECT
		})
	};
};
