import { describe, expect, it } from 'vitest';
import type { PageSectionType } from '$lib/page-builder/sections';
import type { LandingPageCapability } from '../section-definitions';
import {
	buildLandingPageStrategistSystemPrompt,
	buildLandingPageWriterSystemPrompt
} from './landing-page';

const TEST_CONTEXT = {
	allowedSectionTypes: [
		'seo',
		'immediate_authority_hero',
		'logos_of_trust_ribbon',
		'youtube_grid',
		'keynote_speeches',
		'hybrid_content_section',
		'frictionless_funnel_booking',
		'proof_of_performance',
		'booklet_download_cta',
		'compliance_transparency_footer'
	] as PageSectionType[],
	requiredSectionTypes: [
		'seo',
		'immediate_authority_hero',
		'logos_of_trust_ribbon',
		'youtube_grid',
		'keynote_speeches',
		'hybrid_content_section',
		'frictionless_funnel_booking',
		'proof_of_performance',
		'booklet_download_cta',
		'compliance_transparency_footer'
	] as PageSectionType[],
	requiredCapabilities: [
		'seo_metadata',
		'hero_authority',
		'video_proof',
		'keynote_offers',
		'logo_proof',
		'audience_outcomes',
		'booking_cta',
		'testimonial_proof',
		'booklet_cta',
		'compliance'
	] as LandingPageCapability[],
	preferredSectionOrder: [
		'seo',
		'immediate_authority_hero',
		'youtube_grid',
		'keynote_speeches',
		'logos_of_trust_ribbon',
		'hybrid_content_section',
		'frictionless_funnel_booking',
		'proof_of_performance',
		'booklet_download_cta',
		'compliance_transparency_footer'
	] as PageSectionType[],
	sectionCatalog: [],
	disallowedReasonByType: {}
};

const REQUIRED_ORDER_RULE =
	'preferred section order for narrative flow:\n\tseo, immediate_authority_hero, youtube_grid, keynote_speeches, logos_of_trust_ribbon, hybrid_content_section, frictionless_funnel_booking, proof_of_performance, booklet_download_cta, compliance_transparency_footer';
const YOUTUBE_GRID_RATIONALE_RULE =
	'when youtube_grid is selected, choose exactly three videos from input.assets.assetCatalog.speakerInActionVideos by ID and include a non-empty assetPlan.speakerInAction.rationale';
const KEYNOTE_SELECTION_RULE =
	'when keynote_speeches is selected, choose exactly three keynote IDs from input.assets.assetCatalog.keynoteCatalog in assetPlan.keynoteSpeeches.keynoteIds';

describe('landing page prompt ordering preference', () => {
	it('includes fixed section order in strategist system prompt', () => {
		const prompt = buildLandingPageStrategistSystemPrompt(TEST_CONTEXT);
		expect(prompt).toContain('preferred section order for narrative flow:');
		expect(prompt).toContain(YOUTUBE_GRID_RATIONALE_RULE);
		expect(prompt).toContain(KEYNOTE_SELECTION_RULE);
	});

	it('includes fixed section order in writer system prompt', () => {
		const prompt = buildLandingPageWriterSystemPrompt(TEST_CONTEXT, []);
		expect(prompt).toContain(REQUIRED_ORDER_RULE);
	});
});
