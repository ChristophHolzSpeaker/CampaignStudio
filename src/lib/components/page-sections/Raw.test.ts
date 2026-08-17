import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Raw from './Raw.svelte';

describe('Raw', () => {
	it('wraps supplied HTML in the section id and emits its compiled Tailwind CSS', () => {
		const rendered = render(Raw, {
			props: {
				props: {
					id: 'claude-layout',
					html: '<div class="grid">Custom layout</div>',
					tailwindCss: '.grid { display: grid; }'
				}
			}
		});

		expect(rendered.body).toContain('<section id="claude-layout">');
		expect(rendered.body).toContain('<div class="grid">Custom layout</div>');
		expect(rendered.head).toContain('.grid { display: grid; }');
	});
});
