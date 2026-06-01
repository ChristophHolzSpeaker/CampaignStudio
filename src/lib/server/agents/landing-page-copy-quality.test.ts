import { describe, expect, it } from 'vitest';
import {
	evaluateLandingPageCopyQuality,
	hasMetaLanguageWarning
} from './landing-page-copy-quality';
import type { LandingPageDocument } from '$lib/page-builder/page';
import type { LandingPageGenerationInput } from './schemas/landing-page-input';

function createBaseInput(): LandingPageGenerationInput {
	return {
		campaign: {
			id: 1,
			name: 'AI Leadership Summit',
			audience: 'Enterprise technology leaders',
			format: 'keynote',
			topic: 'Applied AI transformation',
			language: 'en',
			geography: 'Germany',
			notes: null
		},
		adPackage: {
			id: 1,
			targetingSummary: 'Leaders need practical AI decisions',
			messagingAngle: 'Decision-ready AI strategy for leadership teams',
			conversionGoal: 'Book strategy session'
		},
		adGroup: {
			id: 1,
			name: 'AI Strategy Leaders',
			intentSummary: 'Find keynote support for AI strategy',
			landingPageAngle: null,
			keywords: [],
			ads: []
		},
		campaignIntentBrief: {
			audience: 'Enterprise technology leaders',
			problemStatement: 'Leaders need practical AI decisions',
			promise: 'Decision-ready AI strategy for leadership teams',
			offer: 'A keynote for enterprise leadership teams',
			proofPoints: [],
			ctaObjective: 'Book strategy session',
			tone: 'Confident, practical, and specific',
			constraints: []
		},
		messageMap: {
			primaryAudience: 'Enterprise technology leaders',
			primaryPain: 'Leaders need practical AI decisions',
			primaryOutcome: 'Decision-ready AI strategy for leadership teams',
			proofAnchors: [],
			ctaIntent: 'Book strategy session',
			bannedGenericPhrases: []
		},
		assets: {
			heroDefaults: {
				videoEmbedUrl: 'https://www.youtube.com/watch?v=test',
				heroImageUrl: 'https://example.com/hero.jpg'
			},
			assetCatalog: {
				heroVideos: [],
				heroImages: [],
				logoCatalog: [],
				hybridSupportingImages: [],
				speakerInActionVideos: [],
				keynoteCatalog: []
			},
			fixedProofOfPerformance: { testimonials: [] },
			fixedLogosRibbon: { logos: [] },
			complianceDefaults: {
				organizerName: 'Christoph',
				organizerAddress: 'Address',
				organizerContactEmail: 'hello@example.com',
				privacyPolicyUrl: 'https://example.com/privacy',
				termsUrl: 'https://example.com/terms'
			}
		}
	} as unknown as LandingPageGenerationInput;
}

function createDocumentWithText(text: string): LandingPageDocument {
	return {
		version: 1,
		title: 'AI Strategy Keynote',
		sections: [
			{
				type: 'immediate_authority_hero',
				props: {
					headline: 'Make better AI decisions this quarter',
					subheadline: text,
					primaryCtaLabel: 'Book now',
					videoEmbedUrl: 'https://www.youtube.com/watch?v=test',
					heroImageUrl: 'https://example.com/hero.jpg',
					heroImageAlt: 'Speaker on stage',
					videoThumbnailUrl: 'https://example.com/thumb.jpg',
					videoThumbnailAlt: 'Speaker thumbnail'
				}
			}
		]
	} as LandingPageDocument;
}

describe('evaluateLandingPageCopyQuality meta-language detection', () => {
	it('fails quality when instructional meta language appears', () => {
		const input = createBaseInput();
		const page = createDocumentWithText(
			'This paragraph will describe what the audience will learn from the keynotes.'
		);

		const result = evaluateLandingPageCopyQuality(page, input);

		expect(hasMetaLanguageWarning(result)).toBe(true);
		expect(result.passed).toBe(false);
		expect(result.metaLanguageMatches?.length).toBeGreaterThan(0);
	});

	it('passes meta-language check for publishable prose', () => {
		const input = createBaseInput();
		const page = createDocumentWithText(
			'Enterprise technology leaders leave with a practical decision framework to prioritize AI investments and align cross-functional execution.'
		);

		const result = evaluateLandingPageCopyQuality(page, input);

		expect(hasMetaLanguageWarning(result)).toBe(false);
	});
});
