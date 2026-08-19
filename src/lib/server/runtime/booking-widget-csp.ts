import { createHash } from 'node:crypto';

const INLINE_SCRIPT_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

function getInlineScriptHashes(html: string): string[] {
	const hashes = new Set<string>();
	for (const match of html.matchAll(INLINE_SCRIPT_PATTERN)) {
		if (/\bsrc\s*=/i.test(match[1] ?? '')) continue;
		const body = match[2] ?? '';
		if (!body.trim()) continue;
		hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
	}
	return [...hashes];
}

function buildBookingWidgetCsp(html: string): string {
	const inlineScriptHashes = getInlineScriptHashes(html);
	return [
		"default-src 'self'",
		"base-uri 'none'",
		"object-src 'none'",
		"frame-ancestors 'self'",
		"style-src 'self' 'unsafe-inline'",
		`script-src 'self'${inlineScriptHashes.length ? ` ${inlineScriptHashes.join(' ')}` : ''}`,
		"connect-src 'self'",
		"img-src 'self' data: https:",
		"font-src 'self' data: https:",
		"form-action 'self'"
	].join('; ');
}

export async function secureBookingWidgetResponse(response: Response): Promise<Response> {
	if (!response.headers.get('content-type')?.toLowerCase().includes('text/html')) return response;

	const html = await response.text();
	const headers = new Headers(response.headers);
	headers.set('Content-Security-Policy', buildBookingWidgetCsp(html));
	headers.delete('Content-Length');

	return new Response(html, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
