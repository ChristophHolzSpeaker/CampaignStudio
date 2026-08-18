import { describe, expect, it } from 'vitest';
import { pageSectionSchema, rawPropsSchema, sectionRegistry, sectionSpecs } from './index';

describe('raw section contract', () => {
	it('is schema-validated, documented, and registered', () => {
		const section = pageSectionSchema.parse({
			type: 'raw',
			props: {
				id: 'claude-layout',
				html: '<div class="grid md:grid-cols-2">Layout</div>'
			}
		});

		expect(section.type).toBe('raw');
		expect(sectionSpecs.raw.propsSchema).toBe(rawPropsSchema);
		expect(sectionRegistry.raw.component).toBeDefined();
	});

	it('rejects ids that cannot be used as stable HTML section ids', () => {
		expect(() =>
			rawPropsSchema.parse({
				id: 'not a valid id',
				html: '<div>Layout</div>'
			})
		).toThrow();
	});
});
