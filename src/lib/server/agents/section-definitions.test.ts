import { describe, expect, it } from 'vitest';
import type { LandingPageDocument } from '$lib/page-builder/page';
import { pageSectionTypes } from '$lib/page-builder/sections';
import {
	requiredMvpCapabilities,
	resolvePageCapabilities,
	resolveRequiredSectionTypes,
	sectionDefinitions
} from './section-definitions';

describe('section definitions', () => {
	it('covers every registered page section type', () => {
		for (const sectionType of pageSectionTypes) {
			expect(sectionDefinitions[sectionType]).toBeDefined();
		}
	});

	it('resolves required section types from required capabilities', () => {
		const requiredSectionTypes = resolveRequiredSectionTypes();
		expect(requiredSectionTypes.length).toBe(requiredMvpCapabilities.length);
		expect(requiredSectionTypes).toContain('seo');
		expect(requiredSectionTypes).toContain('compliance_transparency_footer');
	});

	it('resolves missing capabilities for incomplete pages', () => {
		const page: LandingPageDocument = {
			version: 1,
			title: 'Test Page',
			sections: [
				{
					type: 'seo',
					props: {
						title: 'SEO title',
						description: 'SEO description'
					}
				}
			]
		};

		const result = resolvePageCapabilities(page);
		expect(result.presentCapabilities).toContain('seo_metadata');
		expect(result.missingRequiredCapabilities.length).toBeGreaterThan(0);
		expect(result.missingRequiredCapabilities).toContain('compliance');
	});
});
