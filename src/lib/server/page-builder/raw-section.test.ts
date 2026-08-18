import { describe, expect, it } from 'vitest';
import type { LandingPageDocument } from '$lib/page-builder/page';
import {
	compileRawSectionTailwindCss,
	extractTailwindCandidates,
	prepareRawSectionsForPersistence,
	sanitizeRawSectionHtml
} from './raw-section';

describe('raw section preparation', () => {
	it('sanitizes executable markup while preserving layout markup and classes', () => {
		const html = sanitizeRawSectionHtml(`
			<div class="grid gap-4" onclick="alert('no')">
				<script>alert('no')</script>
				<style>body { display: none }</style>
				<a href="javascript:alert('no')">Read more</a>
			</div>
		`);

		expect(html).toContain('class="grid gap-4"');
		expect(html).not.toContain('onclick');
		expect(html).not.toContain('<script');
		expect(html).not.toContain('<style');
		expect(html).not.toContain('javascript:');
	});

	it('extracts unique Tailwind class candidates', () => {
		expect(
			extractTailwindCandidates(
				'<div class="grid gap-4 md:grid-cols-2"><span class="gap-4 text-primary"></span></div>'
			)
		).toEqual(['grid', 'gap-4', 'md:grid-cols-2', 'text-primary']);
	});

	it('compiles default and Campaign Studio Tailwind utilities', async () => {
		const css = await compileRawSectionTailwindCss(
			'<div class="grid gap-4 bg-primary md:grid-cols-2 hover:bg-blue-600"></div>'
		);

		expect(css).toContain('.grid');
		expect(css).toContain('.gap-4');
		expect(css).toContain('.bg-primary');
		expect(css).toContain('.md\\:grid-cols-2');
		expect(css).toContain('.hover\\:bg-blue-600');
	});

	it('overwrites caller-supplied CSS before persistence', async () => {
		const page: LandingPageDocument = {
			version: 1,
			title: 'Raw section page',
			sections: [
				{
					type: 'raw',
					props: {
						id: 'custom-layout',
						html: '<div class="p-4" onclick="alert(1)">Hello</div>',
						tailwindCss: 'body { display: none }'
					}
				}
			]
		};

		const prepared = await prepareRawSectionsForPersistence(page);
		const [section] = prepared.sections;
		expect(section?.type).toBe('raw');
		if (!section || section.type !== 'raw') return;

		expect(section.props.html).not.toContain('onclick');
		expect(section.props.tailwindCss).toContain('.p-4');
		expect(section.props.tailwindCss).not.toContain('body { display: none }');
	});
});
