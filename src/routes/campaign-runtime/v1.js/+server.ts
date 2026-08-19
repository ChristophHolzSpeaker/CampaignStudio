import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

const runtimeSource = String.raw`(() => {
  'use strict';
  const node = document.getElementById('cs-page-context');
  if (!node) return;
  let context;
  try { context = JSON.parse(node.textContent || '{}'); } catch { return; }
  if (context.runtimeVersion !== 'v1') return;
  let visitId = null;
  const startedAt = Date.now();
  const post = async (url, body, keepalive = false) => {
    const response = await fetch(url, {
      method: 'POST', credentials: 'same-origin', keepalive,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Campaign Studio request failed');
    return response.status === 204 ? null : response.json();
  };
  if (!context.preview) {
    post(context.endpoints.visits, { campaignPageId: context.campaignPageId, pageUrl: location.pathname + location.search })
      .then((result) => { visitId = result && result.data ? result.data.visitId : null; })
      .catch(() => undefined);
  }
  let engagementSent = false;
  const engage = () => {
    if (context.preview || engagementSent || !visitId) return;
    engagementSent = true;
    post(context.endpoints.engagement, { campaignPageId: context.campaignPageId, visitId, durationMs: Date.now() - startedAt }, true).catch(() => undefined);
  };
  setTimeout(engage, 10000);
  addEventListener('pagehide', engage);
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-cs-action="cta"]') : null;
    if (!target || context.preview) return;
    const payload = {
      type: target.getAttribute('data-cs-cta-type') || 'navigation',
      campaign_id: context.campaignId, campaign_page_id: context.campaignPageId,
      ...(visitId ? { campaign_visit_id: visitId } : {}),
      cta_key: target.getAttribute('data-cs-cta-key') || undefined,
      cta_label: (target.textContent || '').trim().slice(0, 255) || undefined,
      cta_section: target.getAttribute('data-cs-cta-section') || undefined
    };
    if (window.dataLayer) window.dataLayer.push({ event: 'cta_click', ...payload });
    post(context.endpoints.cta, payload, true).catch(() => undefined);
    engage();
  });
  document.querySelectorAll('form[data-cs-form="lead-intake"]').forEach((form) => {
    form.removeAttribute('action');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (context.preview) return;
      const submit = form.querySelector('[type="submit"]');
      let status = form.querySelector('[data-cs-form-status]');
      if (!status) { status = document.createElement('p'); status.setAttribute('data-cs-form-status', ''); form.appendChild(status); }
      if (submit) submit.disabled = true;
      status.textContent = 'Submitting…'; status.setAttribute('role', 'status');
      try {
        const data = Object.fromEntries(new FormData(form).entries());
        const result = await post(context.endpoints.leadIntake, { campaignPageId: context.campaignPageId, formKey: form.getAttribute('data-cs-form-key') || undefined, fields: data });
        status.textContent = result.data.message; form.reset();
      } catch { status.textContent = 'We could not submit your request. Please try again.'; status.setAttribute('role', 'alert'); }
      finally { if (submit) submit.disabled = false; }
    });
  });
  document.querySelectorAll('[data-cs-widget]').forEach(async (node) => {
    if (node.getAttribute('data-cs-widget') !== 'booking-calendar') {
      if (context.preview) console.warn('Unknown Campaign Studio widget', node.getAttribute('data-cs-widget'));
      return;
    }
    let widgetUrl = context.widgetUrls.bookingCalendar;
    if (!widgetUrl) {
      try { const result = await post(context.endpoints.bookingWidget, { campaignPageId: context.campaignPageId }); widgetUrl = result.data.url; }
      catch { node.textContent = 'Booking is temporarily unavailable.'; return; }
    }
	    const iframe = document.createElement('iframe');
	    iframe.title = 'Book a meeting'; iframe.loading = 'lazy'; iframe.src = widgetUrl;
	    iframe.style.width = '100%'; iframe.style.border = '0'; iframe.style.minHeight = '760px';
    node.replaceChildren(iframe);
  });
  addEventListener('message', (event) => {
    if (event.origin !== location.origin || !event.data || event.data.type !== 'cs-widget-resize') return;
    const iframe = Array.from(document.querySelectorAll('iframe')).find((candidate) => candidate.contentWindow === event.source);
    if (iframe && Number.isFinite(event.data.height)) iframe.style.height = Math.max(320, Math.min(2000, event.data.height)) + 'px';
  });
})();`;

export const GET: RequestHandler = () =>
	new Response(runtimeSource, {
		headers: {
			'Content-Type': 'text/javascript; charset=utf-8',
			'Cache-Control': dev ? 'no-store' : 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff'
		}
	});
