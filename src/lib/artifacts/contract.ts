import { z } from 'zod';

export const ARTIFACT_RUNTIME_VERSION = 'v3';
export const ARTIFACT_SUPPORTED_RUNTIME_VERSIONS = ['v1', 'v2', ARTIFACT_RUNTIME_VERSION] as const;
export const ARTIFACT_SOURCE_BUCKET = 'page-artifact-source';
export const ARTIFACT_ASSET_BUCKET = 'page-artifact-assets';
export const ARTIFACT_ENTRYPOINT = 'index.html';
export const ARTIFACT_MAX_FILE_COUNT = 100;
export const ARTIFACT_MAX_FILE_BYTES = 4 * 1024 * 1024;
export const ARTIFACT_MAX_TOTAL_BYTES = 25 * 1024 * 1024;

export const ARTIFACT_PROHIBITED_EXTENSIONS = [
	'.cjs',
	'.exe',
	'.js',
	'.jsx',
	'.mjs',
	'.php',
	'.py',
	'.rb',
	'.sh',
	'.ts',
	'.tsx',
	'.wasm'
] as const;

export const ARTIFACT_ALLOWED_MEDIA_TYPES = [
	'text/html',
	'text/css',
	'image/avif',
	'image/gif',
	'image/jpeg',
	'image/png',
	'image/svg+xml',
	'image/webp',
	'font/otf',
	'font/ttf',
	'font/woff',
	'font/woff2',
	'application/font-woff',
	'audio/mpeg',
	'audio/ogg',
	'audio/wav',
	'video/mp4',
	'video/ogg',
	'video/webm'
] as const;

export const ARTIFACT_ALLOWED_HTML_TAGS = [
	'html',
	'head',
	'body',
	'title',
	'meta',
	'link',
	'style',
	'header',
	'footer',
	'nav',
	'main',
	'section',
	'article',
	'aside',
	'div',
	'span',
	'p',
	'br',
	'hr',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'ul',
	'ol',
	'li',
	'dl',
	'dt',
	'dd',
	'strong',
	'em',
	'b',
	'i',
	'u',
	'small',
	'mark',
	'blockquote',
	'q',
	'cite',
	'code',
	'pre',
	'a',
	'img',
	'picture',
	'source',
	'video',
	'audio',
	'track',
	'figure',
	'figcaption',
	'table',
	'caption',
	'thead',
	'tbody',
	'tfoot',
	'tr',
	'th',
	'td',
	'colgroup',
	'col',
	'form',
	'fieldset',
	'legend',
	'label',
	'input',
	'textarea',
	'select',
	'option',
	'optgroup',
	'button',
	'output',
	'details',
	'summary',
	'progress',
	'meter',
	'time',
	'address'
] as const;

export const RESERVED_ARTIFACT_SLUGS = [
	'account',
	'admin',
	'api',
	'artifact-preview',
	'book',
	'campaign',
	'campaign-runtime',
	'campaigns',
	'confirm',
	'embed',
	'favicon.ico',
	'login',
	'no-follow',
	'preview',
	'register',
	'robots.txt',
	'signout',
	'speaker',
	'widgets'
] as const;

const reservedSlugs = new Set<string>(RESERVED_ARTIFACT_SLUGS);
const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const pathSegmentPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function isArtifactSlug(value: string): boolean {
	return slugPattern.test(value) && !reservedSlugs.has(value);
}

export function normalizeArtifactPath(value: string): string {
	const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '');
	const segments = normalized.split('/');

	if (
		!normalized ||
		normalized.startsWith('/') ||
		segments.some(
			(segment) =>
				!segment || segment === '.' || segment === '..' || !pathSegmentPattern.test(segment)
		)
	) {
		throw new Error('Artifact paths must be relative, normalized, and contain safe path segments');
	}

	return segments.join('/');
}

export const artifactSlugSchema = z
	.string()
	.trim()
	.toLowerCase()
	.refine(isArtifactSlug, 'Slug is invalid or reserved');

export const artifactManifestFileSchema = z.object({
	path: z.string().min(1),
	mediaType: z.string().min(1),
	byteSize: z.number().int().nonnegative(),
	sha256: z.string().regex(/^[a-f0-9]{64}$/)
});

export const artifactManifestSchema = z.object({
	version: z.literal(1),
	entrypoint: z.literal(ARTIFACT_ENTRYPOINT),
	runtimeVersion: z.enum(ARTIFACT_SUPPORTED_RUNTIME_VERSIONS),
	files: z.array(artifactManifestFileSchema).min(1).max(ARTIFACT_MAX_FILE_COUNT)
});

export type ArtifactManifest = z.infer<typeof artifactManifestSchema>;
export type ArtifactManifestFile = z.infer<typeof artifactManifestFileSchema>;
