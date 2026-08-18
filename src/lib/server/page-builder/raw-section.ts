import { compile } from 'tailwindcss';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sanitizeHtml from 'sanitize-html';
import type { LandingPageDocument } from '$lib/page-builder/page';

const MAX_TAILWIND_CANDIDATES = 5_000;

const projectThemeCss = String.raw`
@theme {
	--font-sans: 'Bureau Grot', ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji',
		'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';
	--color-surface: #ffffff;
	--color-surface-container-low: #97ddea33;
	--color-surface-container-lowest: #e4e4e7;
	--color-primary: #e2183b;
	--color-secondary: #0ea5e9;
	--color-tertiary: #52525b;
	--color-on-surface: #09090b;
}
`;

const allowedRawTags = [
	...sanitizeHtml.defaults.allowedTags,
	'img',
	'picture',
	'source',
	'video',
	'audio',
	'track',
	'iframe',
	'button',
	'svg',
	'g',
	'path',
	'circle',
	'ellipse',
	'line',
	'polyline',
	'polygon',
	'rect',
	'defs',
	'linearGradient',
	'radialGradient',
	'stop',
	'use',
	'symbol'
];

const rawHtmlSanitizerOptions: sanitizeHtml.IOptions = {
	allowedTags: allowedRawTags,
	allowedAttributes: {
		'*': ['id', 'class', 'title', 'role', 'dir', 'lang', 'tabindex', 'aria-*', 'data-*'],
		a: ['href', 'name', 'target', 'rel'],
		img: ['src', 'srcset', 'sizes', 'alt', 'loading', 'width', 'height', 'decoding'],
		source: ['src', 'srcset', 'type', 'media', 'sizes'],
		video: [
			'src',
			'controls',
			'autoplay',
			'loop',
			'muted',
			'playsinline',
			'poster',
			'preload',
			'width',
			'height'
		],
		audio: ['src', 'controls', 'autoplay', 'loop', 'muted', 'preload'],
		track: ['default', 'kind', 'label', 'src', 'srclang'],
		iframe: [
			'src',
			'title',
			'width',
			'height',
			'loading',
			'allow',
			'allowfullscreen',
			'referrerpolicy'
		],
		button: ['type', 'name', 'value', 'disabled'],
		svg: ['xmlns', 'viewBox', 'width', 'height', 'fill', 'stroke', 'aria-hidden', 'focusable'],
		g: ['fill', 'stroke', 'stroke-width', 'transform'],
		path: ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'],
		circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'],
		ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width'],
		line: ['x1', 'x2', 'y1', 'y2', 'stroke', 'stroke-width'],
		polyline: ['points', 'fill', 'stroke', 'stroke-width'],
		polygon: ['points', 'fill', 'stroke', 'stroke-width'],
		rect: ['x', 'y', 'rx', 'ry', 'width', 'height', 'fill', 'stroke', 'stroke-width'],
		linearGradient: ['id', 'x1', 'x2', 'y1', 'y2', 'gradientUnits'],
		radialGradient: ['id', 'cx', 'cy', 'r', 'gradientUnits'],
		stop: ['offset', 'stop-color', 'stop-opacity'],
		use: ['href', 'x', 'y', 'width', 'height'],
		symbol: ['id', 'viewBox']
	},
	allowedSchemes: ['http', 'https', 'mailto', 'tel'],
	allowProtocolRelative: false,
	allowedIframeHostnames: [
		'www.youtube.com',
		'youtube.com',
		'www.youtube-nocookie.com',
		'player.vimeo.com'
	]
};

let tailwindThemeCssPromise: Promise<string> | undefined;

function getTailwindThemeCss(): Promise<string> {
	tailwindThemeCssPromise ??= readFile(
		fileURLToPath(import.meta.resolve('tailwindcss/theme.css')),
		'utf8'
	);
	return tailwindThemeCssPromise;
}

export function sanitizeRawSectionHtml(html: string): string {
	const sanitized = sanitizeHtml(html, rawHtmlSanitizerOptions).trim();
	if (!sanitized) {
		throw new Error('Raw section HTML is empty after sanitization.');
	}

	return sanitized;
}

export function extractTailwindCandidates(html: string): string[] {
	const candidates = new Set<string>();
	const classAttributePattern = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

	for (const match of html.matchAll(classAttributePattern)) {
		const classValue = match[1] ?? match[2] ?? match[3] ?? '';
		for (const candidate of classValue.split(/\s+/)) {
			const normalized = candidate.trim();
			if (!normalized) continue;
			if (normalized.length > 512) {
				throw new Error('Raw section contains an excessively long Tailwind class candidate.');
			}

			candidates.add(normalized);
			if (candidates.size > MAX_TAILWIND_CANDIDATES) {
				throw new Error(
					`Raw section exceeds the ${MAX_TAILWIND_CANDIDATES} Tailwind class candidate limit.`
				);
			}
		}
	}

	return [...candidates];
}

export async function compileRawSectionTailwindCss(html: string): Promise<string> {
	const candidates = extractTailwindCandidates(html);
	if (candidates.length === 0) return '';

	const tailwindThemeCss = await getTailwindThemeCss();
	const compiler = await compile(`${tailwindThemeCss}\n${projectThemeCss}\n@tailwind utilities;`);
	return compiler.build(candidates);
}

export async function prepareRawSectionsForPersistence(
	page: LandingPageDocument
): Promise<LandingPageDocument> {
	const sections = await Promise.all(
		page.sections.map(async (section) => {
			if (section.type !== 'raw') return section;

			const html = sanitizeRawSectionHtml(section.props.html);
			const tailwindCss = await compileRawSectionTailwindCss(html);
			return {
				...section,
				props: {
					...section.props,
					html,
					tailwindCss
				}
			};
		})
	);

	return { ...page, sections };
}
