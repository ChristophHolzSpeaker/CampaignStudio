import { describe, expect, it } from 'vitest';
import type { PageSectionType } from '$lib/page-builder/sections';
import {
	buildLandingPageStrategistSystemPrompt,
	buildLandingPageWriterSystemPrompt
} from './landing-page';

const TEST_CONTEXT = {
	allowedSectionTypes: [
		'seo',
		'proof_of_performance',
		'frictionless_funnel_booking',
		'compliance_transparency_footer',
		'keynote_speeches'
	] as PageSectionType[],
	requiredSectionTypes: [
		'seo',
		'keynote_speeches',
		'compliance_transparency_footer'
	] as PageSectionType[],
	sectionCatalog: [],
	disallowedReasonByType: {}
};

const PREFERENCE_RULE =
	'soft preference: when both frictionless_funnel_booking and proof_of_performance';

describe('landing page prompt ordering preference', () => {
	it('includes frictionless-before-proof preference in strategist system prompt', () => {
		const prompt = buildLandingPageStrategistSystemPrompt(TEST_CONTEXT);
		expect(prompt).toContain(PREFERENCE_RULE);
	});

	it('includes frictionless-before-proof preference in writer system prompt', () => {
		const prompt = buildLandingPageWriterSystemPrompt(TEST_CONTEXT, []);
		expect(prompt).toContain(PREFERENCE_RULE);
	});
});
