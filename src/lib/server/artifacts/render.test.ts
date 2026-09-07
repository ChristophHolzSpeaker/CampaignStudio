import { describe, expect, it } from 'vitest';
import type { ArtifactPageRecord } from './repository';
import { artifactResponseHeaders, injectArtifactRuntime } from './render';

const page = {
	campaignId: 12,
	campaignPageId: 3,
	versionNumber: 13,
	slug: 'ki-keynote-speaker',
	sourcePath: '12/3/hash/index.html',
	manifest: {
		version: 1,
		runtimeVersion: 'v1',
		entrypoint: 'index.html',
		files: []
	},
	contentSha256: 'content-hash',
	runtimeVersion: 'v1'
} satisfies ArtifactPageRecord;

describe('artifact response security headers', () => {
	it('permits Google tags only on published v5 artifacts without allowing authored inline scripts', () => {
		const live = new Headers(
			artifactResponseHeaders(
				{ ...page, runtimeVersion: 'v5' },
				false,
				'https://assets.example.com'
			)
		).get('content-security-policy')!;
		const preview = new Headers(
			artifactResponseHeaders({ ...page, runtimeVersion: 'v5' }, true, 'https://assets.example.com')
		).get('content-security-policy')!;
		expect(live).toContain('https://www.googletagmanager.com');
		expect(preview).not.toContain('googletagmanager');
		expect(live.split(';').find((d) => d.trim().startsWith('script-src'))).not.toContain(
			'unsafe-inline'
		);
	});
	it('allows the configured asset origin without opening all HTTP origins', () => {
		const headers = new Headers(artifactResponseHeaders(page, false, 'http://127.0.0.1:54321'));
		const policy = headers.get('content-security-policy');

		expect(headers.get('etag')).toBe('"content-hash-v1-r4"');
		expect(policy).toContain("script-src 'self' https://www.youtube.com");
		expect(policy).toContain("style-src 'self' 'unsafe-inline' https: http://127.0.0.1:54321");
		expect(policy).toContain("img-src 'self' data: blob: https: http://127.0.0.1:54321");
		expect(policy).toContain("font-src 'self' data: https: http://127.0.0.1:54321");
		expect(policy).toContain("media-src 'self' blob: https: http://127.0.0.1:54321");
		expect(policy).toContain("frame-src 'self' https://www.youtube-nocookie.com");
		expect(policy).not.toMatch(
			/(?:^|;\s)(?:style-src|img-src|font-src|media-src)[^;]*\shttp:(?:\s|;|$)/
		);
	});

	it('injects the versioned platform font stylesheet', () => {
		const html = injectArtifactRuntime(
			'<!doctype html><html><head><title>Artifact</title></head><body></body></html>',
			page,
			false
		);

		expect(html).toContain(
			'<link rel="stylesheet" href="/campaign-runtime/fonts/v1.css" data-cs-platform-fonts>'
		);
		expect(html.indexOf('data-cs-platform-fonts')).toBeLessThan(html.indexOf('</head>'));
	});

	it('allows tokenized previews to be framed while keeping live pages frame-protected', () => {
		const previewHeaders = new Headers(
			artifactResponseHeaders(page, true, 'https://assets.example.com')
		);
		const liveHeaders = new Headers(
			artifactResponseHeaders(page, false, 'https://assets.example.com')
		);

		expect(previewHeaders.get('content-security-policy')).toContain('frame-ancestors *');
		expect(previewHeaders.has('x-frame-options')).toBe(false);
		expect(previewHeaders.get('x-robots-tag')).toBe('noindex, nofollow');
		expect(liveHeaders.get('content-security-policy')).toContain("frame-ancestors 'none'");
		expect(liveHeaders.get('x-frame-options')).toBe('DENY');
	});
});
