import { describe, expect, it } from 'vitest';
import { prepareArtifactFiles, sha256, type UploadedArtifactFile } from './validation';

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
});
