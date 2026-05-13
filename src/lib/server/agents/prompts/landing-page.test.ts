import { describe, expect, it } from 'vitest';
import type { PageSectionType } from '$lib/page-builder/sections';
import {
	buildLandingPageStrategistSystemPrompt,
	buildLandingPageWriterSystemPrompt
} from './landing-page';

const TEST_CONTEXT = {
	allowedSectionTypes: [
		'seo',
		'immediate_authority_hero',
		'logos_of_trust_ribbon',
		'keynote_speeches',
		'hybrid_content_section',
		'speaker_in_action',
		'frictionless_funnel_booking',
		'proof_of_performance',
		'booklet_download_cta',
		'compliance_transparency_footer'
	] as PageSectionType[],
	requiredSectionTypes: [
		'seo',
		'immediate_authority_hero',
		'logos_of_trust_ribbon',
		'keynote_speeches',
		'hybrid_content_section',
		'speaker_in_action',
		'frictionless_funnel_booking',
		'proof_of_performance',
		'booklet_download_cta',
		'compliance_transparency_footer'
	] as PageSectionType[],
	sectionCatalog: [],
	disallowedReasonByType: {}
};

const REQUIRED_ORDER_RULE =
	'Sections must appear in this exact order: seo, immediate_authority_hero, logos_of_trust_ribbon, keynote_speeches, hybrid_content_section, speaker_in_action, frictionless_funnel_booking, proof_of_performance, booklet_download_cta, compliance_transparency_footer';
const SPEAKER_RATIONALE_RULE =
	'when speaker_in_action is selected, choose exactly four videos from input.assets.assetCatalog.speakerInActionVideos by ID and include a non-empty assetPlan.speakerInAction.rationale';

describe('landing page prompt ordering preference', () => {
	it('includes fixed section order in strategist system prompt', () => {
		const prompt = buildLandingPageStrategistSystemPrompt(TEST_CONTEXT);
		expect(prompt).toContain(
			'sectionPlan must include exactly these section types in this exact order:'
		);
		expect(prompt).toContain(SPEAKER_RATIONALE_RULE);
	});

	it('includes fixed section order in writer system prompt', () => {
		const prompt = buildLandingPageWriterSystemPrompt(TEST_CONTEXT, []);
		expect(prompt).toContain(REQUIRED_ORDER_RULE);
	});
});
