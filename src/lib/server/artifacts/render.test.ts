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
	it('renders v9 generic campaign email links with the current page alias before consent', () => {
		const document =
			'<html><head></head><body><a href="mailto:speakerlp@christophholz.com?subject=Hello&amp;body=Test">Contact</a><a href="mailto:speakerlp+356@christophholz.com">Explicit other page</a><a href="mailto:someone@example.com">Other</a><p>speakerlp@christophholz.com</p><button aria-label="Copy speakerlp@christophholz.com to clipboard"></button></body></html>';
		const v9 = injectArtifactRuntime(
			document,
			{ ...page, runtimeVersion: 'v9', campaignPageId: 379 },
			false
		);
		expect(v9).toContain(
			'href="mailto:speakerlp+379@christophholz.com?subject=Hello&amp;body=Test"'
		);
		expect(v9).toContain('aria-label="Copy speakerlp+379@christophholz.com to clipboard"');
		expect(v9).toContain('href="mailto:someone@example.com"');
		expect(v9).toContain('href="mailto:speakerlp+356@christophholz.com"');
		expect(v9).toContain('<p>speakerlp@christophholz.com</p>');
		const old = injectArtifactRuntime(
			document,
			{ ...page, runtimeVersion: 'v6', campaignPageId: 356 },
			false
		);
		expect(old).toContain('href="mailto:speakerlp@christophholz.com?subject=Hello&amp;body=Test"');
	});
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
		expect(live.split(';').find((d) => d.trim().startsWith('connect-src'))).toContain(
			'https://pagead2.googlesyndication.com'
		);
		expect(preview).not.toContain('pagead2.googlesyndication.com');
		expect(preview).not.toContain('googletagmanager');
		expect(live.split(';').find((d) => d.trim().startsWith('script-src'))).not.toContain(
			'unsafe-inline'
		);
	});
	it('allows the configured asset origin without opening all HTTP origins', () => {
		const headers = new Headers(artifactResponseHeaders(page, false, 'http://127.0.0.1:54321'));
		const policy = headers.get('content-security-policy');

		expect(headers.get('etag')).toBe('"content-hash-v1-r7"');
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
		expect(html).toContain('/campaign-runtime/email-v1.js');
		expect(html).toContain('/campaign-runtime/v1.js');
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
	it.each(['v8', 'v9'])(
		'renders %s with the floating consent banner and private response policy',
		(version) => {
			const runtimePage = { ...page, runtimeVersion: version };
			const html = injectArtifactRuntime(
				'<html><head></head><body></body></html>',
				runtimePage,
				false
			);
			expect(html).toContain('width:min(400px,100%)');
			expect(html).toContain(`/campaign-runtime/${version}.js`);
			expect(
				injectArtifactRuntime('<html><head></head><body></body></html>', runtimePage, false, true)
			).toContain('id="cs-consent" hidden');
			const headers = new Headers(
				artifactResponseHeaders(runtimePage, false, 'https://assets.example.com')
			);
			expect(headers.get('Cache-Control')).toBe('private, no-store');
			expect(headers.get('Content-Security-Policy')).toContain('https://www.googletagmanager.com');
		}
	);

	it('renders the floating v7 banner without changing the pinned v6 layout', () => {
		const v7 = { ...page, runtimeVersion: 'v7' };
		const html = '<html><head></head><body></body></html>';
		const result = injectArtifactRuntime(html, v7, false);
		expect(result).toContain('width:min(400px,100%)');
		expect(result).toContain('top:50%;left:50%');
		expect(result).not.toContain('--cs-consent-space');
		expect(result).toContain('/campaign-runtime/v7.js');
		expect(injectArtifactRuntime(html, v7, false, true)).toContain('id="cs-consent" hidden');
		expect(
			new Headers(artifactResponseHeaders(v7, false, 'https://assets.example.com')).get(
				'Cache-Control'
			)
		).toBe('private, no-store');
	});

	it('injects the v6 banner with reserved viewport CSS and suppresses returning-visitor flashes', () => {
		const v6 = { ...page, runtimeVersion: 'v6' };
		const html = '<html><head></head><body><form>Lead form</form></body></html>';
		expect(injectArtifactRuntime(html, v6, false)).toContain('id="cs-consent" aria-label=');
		expect(injectArtifactRuntime(html, v6, false, true)).toContain('id="cs-consent" hidden');
		expect(injectArtifactRuntime(html, v6, true, true)).not.toContain('id="cs-consent" hidden');
		expect(injectArtifactRuntime(html, v6, false)).toContain('data-cs-consent-style');
		expect(injectArtifactRuntime(html, v6, false)).toContain(
			'/campaign-runtime/v6.js?revision=visit-ip-1'
		);
		expect(injectArtifactRuntime(html, page, false)).not.toContain('id="cs-consent"');
		const headers = new Headers(artifactResponseHeaders(v6, false, 'https://assets.example.com'));
		expect(headers.get('cache-control')).toBe('private, no-store');
		expect(headers.has('etag')).toBe(false);
		expect(headers.get('content-security-policy')).toContain('https://www.googletagmanager.com');
	});
});
