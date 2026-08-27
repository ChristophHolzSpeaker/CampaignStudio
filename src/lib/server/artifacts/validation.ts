import { createHash } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import {
	ARTIFACT_ALLOWED_HTML_TAGS,
	ARTIFACT_ALLOWED_MEDIA_TYPES,
	ARTIFACT_ENTRYPOINT,
	ARTIFACT_MAX_FILE_BYTES,
	ARTIFACT_MAX_FILE_COUNT,
	ARTIFACT_MAX_TOTAL_BYTES,
	ARTIFACT_RUNTIME_VERSION,
	ARTIFACT_PROHIBITED_EXTENSIONS,
	normalizeArtifactPath,
	type ArtifactManifest,
	type ArtifactManifestFile
} from '$lib/artifacts/contract';

export type UploadedArtifactFile = ArtifactManifestFile & { bytes: Uint8Array };

const prohibitedExtensions = new Set<string>(ARTIFACT_PROHIBITED_EXTENSIONS);
const htmlMediaTypes = new Set(['text/html', 'application/xhtml+xml']);
const allowedMediaTypes = new Set<string>(ARTIFACT_ALLOWED_MEDIA_TYPES);
const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/;

export function sha256(bytes: Uint8Array | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function extension(path: string): string {
	const dot = path.lastIndexOf('.');
	return dot < 0 ? '' : path.slice(dot).toLowerCase();
}

function assertSafeUploadFile(file: UploadedArtifactFile): void {
	if (file.path !== normalizeArtifactPath(file.path))
		throw new Error(`Non-canonical path: ${file.path}`);
	if (file.byteSize !== file.bytes.byteLength) throw new Error(`Byte size mismatch: ${file.path}`);
	if (file.byteSize > ARTIFACT_MAX_FILE_BYTES) throw new Error(`File exceeds limit: ${file.path}`);
	if (file.sha256 !== sha256(file.bytes)) throw new Error(`SHA-256 mismatch: ${file.path}`);
	if (prohibitedExtensions.has(extension(file.path)))
		throw new Error(`Executable file is not allowed: ${file.path}`);
	if (!allowedMediaTypes.has(file.mediaType.toLowerCase().split(';')[0] ?? ''))
		throw new Error(`Unsupported media type for ${file.path}`);
	if (file.path !== ARTIFACT_ENTRYPOINT && htmlMediaTypes.has(file.mediaType.toLowerCase())) {
		throw new Error(`Only ${ARTIFACT_ENTRYPOINT} may contain HTML`);
	}
}

function splitReference(value: string): { path: string; suffix: string } {
	const index = value.search(/[?#]/);
	return index < 0
		? { path: value, suffix: '' }
		: { path: value.slice(0, index), suffix: value.slice(index) };
}

function isExternalReference(value: string): boolean {
	return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value);
}

function resolveLocalPath(reference: string, sourcePath: string): string {
	if (reference.startsWith('/'))
		throw new Error(`Root-relative artifact reference is not allowed: ${reference}`);
	const base = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1) : '';
	return normalizeArtifactPath(`${base}${reference}`);
}

function rewriteLocalReference(input: {
	value: string;
	sourcePath: string;
	assetUrls: Map<string, string>;
}): string {
	if (!input.value || isExternalReference(input.value) || input.value.startsWith('data:'))
		return input.value;
	const { path, suffix } = splitReference(input.value);
	const normalized = resolveLocalPath(path, input.sourcePath);
	const publicUrl = input.assetUrls.get(normalized);
	if (!publicUrl) throw new Error(`Artifact reference does not exist: ${input.value}`);
	return `${publicUrl}${suffix}`;
}

function assertSafeHtml(html: string): void {
	const prohibitedPatterns: Array<[RegExp, string]> = [
		[/<\s*(?:script|iframe|object|embed|applet|base)\b/i, 'active or embedded HTML elements'],
		[/\son[a-z]+\s*=/i, 'inline event handlers'],
		[/(?:href|src|action)\s*=\s*["']?\s*javascript:/i, 'javascript URLs'],
		[
			/<\s*meta\b[^>]*http-equiv\s*=\s*["']?\s*(?:refresh|content-security-policy)/i,
			'security-changing meta elements'
		],
		[/(?:expression\s*\(|javascript\s*:)/i, 'script-capable CSS or URL values']
	];
	for (const [pattern, description] of prohibitedPatterns) {
		if (pattern.test(html)) throw new Error(`Artifact HTML contains prohibited ${description}`);
	}
	if (!/<html\b/i.test(html) || !/<body\b/i.test(html)) {
		throw new Error('index.html must be a complete HTML document');
	}
}

function assertSafeYouTubeWidgets(html: string): void {
	const widgetTags = html.matchAll(
		/<[a-z][a-z0-9:-]*\b[^>]*\bdata-cs-widget=(['"])youtube-video\1[^>]*>/gi
	);
	for (const match of widgetTags) {
		const tag = match[0];
		const videoId = /\bdata-cs-youtube-id=(['"])(.*?)\1/i.exec(tag)?.[2];
		if (!videoId || !youtubeVideoIdPattern.test(videoId))
			throw new Error('YouTube widgets require an 11-character URL-safe video ID');
		const title = /\bdata-cs-video-title=(['"])(.*?)\1/i.exec(tag)?.[2];
		if (title && title.length > 120)
			throw new Error('YouTube widget titles must be at most 120 characters');
	}
}

function sanitizeAndRewriteHtml(html: string, assetUrls: Map<string, string>): string {
	assertSafeHtml(html);
	assertSafeYouTubeWidgets(html);
	const sanitized = sanitizeHtml(html, {
		allowedTags: [...ARTIFACT_ALLOWED_HTML_TAGS],
		allowedAttributes: false,
		allowVulnerableTags: true,
		disallowedTagsMode: 'discard',
		exclusiveFilter(frame) {
			return ['script', 'iframe', 'object', 'embed', 'applet', 'base'].includes(
				frame.tag.toLowerCase()
			);
		},
		transformTags: {
			form: (tagName, attribs) => {
				const { action: _action, target: _target, ...safeAttributes } = attribs;
				return { tagName, attribs: safeAttributes };
			}
		}
	});

	return sanitized.replace(
		/\b(src|href|poster)=(['"])(.*?)\2/gi,
		(match, attribute: string, quote: string, value: string) => {
			if (attribute.toLowerCase() === 'href' && /^(?:#|mailto:|tel:|https?:)/i.test(value))
				return match;
			const rewritten = rewriteLocalReference({
				value,
				sourcePath: ARTIFACT_ENTRYPOINT,
				assetUrls
			});
			return `${attribute}=${quote}${rewritten}${quote}`;
		}
	);
}

function rewriteCss(css: string, sourcePath: string, assetUrls: Map<string, string>): string {
	if (/expression\s*\(|javascript\s*:/i.test(css)) throw new Error(`Unsafe CSS in ${sourcePath}`);
	return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, quote: string, value: string) => {
		if (!value || isExternalReference(value) || value.startsWith('data:')) return match;
		const rewritten = rewriteLocalReference({ value, sourcePath, assetUrls });
		return `url(${quote}${rewritten}${quote})`;
	});
}

export function buildArtifactManifest(files: UploadedArtifactFile[]): ArtifactManifest {
	if (files.length > ARTIFACT_MAX_FILE_COUNT) throw new Error('Artifact contains too many files');
	const paths = new Set<string>();
	let totalBytes = 0;
	for (const file of files) {
		assertSafeUploadFile(file);
		if (paths.has(file.path)) throw new Error(`Duplicate artifact path: ${file.path}`);
		paths.add(file.path);
		totalBytes += file.byteSize;
	}
	if (totalBytes > ARTIFACT_MAX_TOTAL_BYTES) throw new Error('Artifact exceeds total byte limit');
	if (!paths.has(ARTIFACT_ENTRYPOINT))
		throw new Error(`Artifact must contain ${ARTIFACT_ENTRYPOINT}`);

	return {
		version: 1,
		entrypoint: ARTIFACT_ENTRYPOINT,
		runtimeVersion: ARTIFACT_RUNTIME_VERSION,
		files: files
			.map(({ path, mediaType, byteSize, sha256 }) => ({ path, mediaType, byteSize, sha256 }))
			.sort((left, right) => left.path.localeCompare(right.path))
	};
}

export function getArtifactContentHash(manifest: ArtifactManifest): string {
	return sha256(JSON.stringify(manifest));
}

export function prepareArtifactFiles(input: {
	files: UploadedArtifactFile[];
	assetPublicUrl: (path: string) => string;
}): { manifest: ArtifactManifest; contentSha256: string; files: UploadedArtifactFile[] } {
	const originalManifest = buildArtifactManifest(input.files);
	const assetUrls = new Map(
		originalManifest.files
			.filter((file) => file.path !== ARTIFACT_ENTRYPOINT)
			.map((file) => [file.path, input.assetPublicUrl(file.path)])
	);
	const prepared = input.files.map((file): UploadedArtifactFile => {
		if (file.path === ARTIFACT_ENTRYPOINT) {
			const bytes = new TextEncoder().encode(
				sanitizeAndRewriteHtml(new TextDecoder().decode(file.bytes), assetUrls)
			);
			return {
				...file,
				bytes,
				byteSize: bytes.byteLength,
				sha256: sha256(bytes),
				mediaType: 'text/html; charset=utf-8'
			};
		}
		if (file.mediaType.toLowerCase().startsWith('text/css') || extension(file.path) === '.css') {
			const bytes = new TextEncoder().encode(
				rewriteCss(new TextDecoder().decode(file.bytes), file.path, assetUrls)
			);
			return {
				...file,
				bytes,
				byteSize: bytes.byteLength,
				sha256: sha256(bytes),
				mediaType: 'text/css; charset=utf-8'
			};
		}
		return file;
	});
	const manifest = buildArtifactManifest(prepared);
	return { manifest, contentSha256: getArtifactContentHash(manifest), files: prepared };
}
