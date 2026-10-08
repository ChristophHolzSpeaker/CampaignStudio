import { startEmailAttribution } from '$lib/tracking/email-browser';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	new Response(
		`(() => {
  const node = document.getElementById('cs-page-context');
  if (!node) return;
  let context;
  try { context = JSON.parse(node.textContent || '{}'); } catch { return; }
  if (context.preview || !Number.isSafeInteger(context.campaignPageId) || context.campaignPageId <= 0) return;
  (${startEmailAttribution.toString()})(context.campaignPageId);
})();`,
		{
			headers: {
				'Content-Type': 'application/javascript; charset=utf-8',
				'Cache-Control': 'public, max-age=31536000, immutable',
				'X-Content-Type-Options': 'nosniff'
			}
		}
	);
