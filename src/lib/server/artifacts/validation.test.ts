import { describe, expect, it } from 'vitest';
import { prepareArtifactFiles, sha256, type UploadedArtifactFile } from './validation';
import { artifactManifestSchema } from '$lib/artifacts/contract';

function file(path: string, body: string, mediaType: string): UploadedArtifactFile {
	const bytes = new TextEncoder().encode(body);
	return { path, mediaType, bytes, byteSize: bytes.byteLength, sha256: sha256(bytes) };
}

describe('artifact bundle validation', () => {
	it('rewrites local HTML and CSS assets to immutable URLs', () => {
		const result = prepareArtifactFiles({
			files: [
				file(
					'index.html',
					'<!doctype html><html><head><link href="assets/site.css" rel="stylesheet"></head><body><img src="assets/hero.webp"></body></html>',
					'text/html'
				),
				file('assets/site.css', '.hero{background:url("hero.webp")}', 'text/css'),
				file('assets/hero.webp', 'image', 'image/webp')
			],
			assetPublicUrl: (path) => `https://cdn.test/version/${path}`
		});
		const html = new TextDecoder().decode(
			result.files.find((entry) => entry.path === 'index.html')?.bytes
		);
		const css = new TextDecoder().decode(
			result.files.find((entry) => entry.path.endsWith('.css'))?.bytes
		);
		expect(html).toContain('https://cdn.test/version/assets/site.css');
		expect(html).toContain('https://cdn.test/version/assets/hero.webp');
		expect(css).toContain('https://cdn.test/version/assets/hero.webp');
	});

	it.each([
		'<html><body><script>alert(1)</script></body></html>',
		'<html><body><button onclick="alert(1)">Go</button></body></html>',
		'<html><body><a href="javascript:alert(1)">Go</a></body></html>'
	])('rejects author JavaScript', (html) => {
		expect(() =>
			prepareArtifactFiles({
				files: [file('index.html', html, 'text/html')],
				assetPublicUrl: (path) => path
			})
		).toThrow(/prohibited/);
	});

	it.each([
		'<html><body><div data-cs-widget="youtube-video"></div></body></html>',
		'<html><body><div data-cs-widget="youtube-video" data-cs-youtube-id="not-valid"></div></body></html>'
	])('rejects malformed YouTube widgets', (html) => {
		expect(() =>
			prepareArtifactFiles({
				files: [file('index.html', html, 'text/html')],
				assetPublicUrl: (path) => path
			})
		).toThrow(/YouTube widgets require/);
	});

	it('accepts a valid YouTube widget placeholder', () => {
		const result = prepareArtifactFiles({
			files: [
				file(
					'index.html',
					'<!doctype html><html><body><div data-cs-widget="youtube-video" data-cs-youtube-id="dQw4w9WgXcQ" data-cs-video-title="Campaign introduction"></div></body></html>',
					'text/html'
				)
			],
			assetPublicUrl: (path) => path
		});

		expect(new TextDecoder().decode(result.files[0]?.bytes)).toContain(
			'data-cs-youtube-id="dQw4w9WgXcQ"'
		);
	});

	it('continues to read v1 artifact manifests after the runtime advances', () => {
		expect(
			artifactManifestSchema.parse({
				version: 1,
				entrypoint: 'index.html',
				runtimeVersion: 'v1',
				files: [{ path: 'index.html', mediaType: 'text/html', byteSize: 1, sha256: 'a'.repeat(64) }]
			})
		).toMatchObject({ runtimeVersion: 'v1' });
	});

	it('continues to read v2 artifact manifests after the runtime advances', () => {
		expect(
			artifactManifestSchema.parse({
				version: 1,
				entrypoint: 'index.html',
				runtimeVersion: 'v2',
				files: [{ path: 'index.html', mediaType: 'text/html', byteSize: 1, sha256: 'a'.repeat(64) }]
			})
		).toMatchObject({ runtimeVersion: 'v2' });
	});
});
