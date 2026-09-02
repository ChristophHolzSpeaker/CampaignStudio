import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

const runtimeSource = String.raw`(() => {
  'use strict';
  const node = document.getElementById('cs-page-context');
  if (!node) return;
  let context;
  try { context = JSON.parse(node.textContent || '{}'); } catch { return; }
  if (context.runtimeVersion !== 'v3') return;
  const post = async (url, body, keepalive = false) => {
    const response = await fetch(url, {
      method: 'POST', credentials: 'same-origin', keepalive,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Campaign Studio request failed');
    return response.status === 204 ? null : response.json();
  };
  let visitId = null;
  const startedAt = Date.now();
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
  const trackCta = (payload) => {
    if (context.preview) return;
    if (window.dataLayer) window.dataLayer.push({ event: 'cta_click', ...payload });
    post(context.endpoints.cta, payload, true).catch(() => undefined);
    engage();
  };
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-cs-action="cta"]') : null;
    if (!target || context.preview) return;
    trackCta({
      type: target.getAttribute('data-cs-cta-type') || 'navigation',
      campaign_id: context.campaignId, campaign_page_id: context.campaignPageId,
      ...(visitId ? { campaign_visit_id: visitId } : {}),
      cta_key: target.getAttribute('data-cs-cta-key') || undefined,
      cta_label: (target.textContent || '').trim().slice(0, 255) || undefined,
      cta_section: target.getAttribute('data-cs-cta-section') || undefined
    });
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
  const IFRAME_API_URL = 'https://www.youtube.com/iframe_api';
  let youTubeApiPromise = null;
  const loadYouTubeIframeApi = () => {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (youTubeApiPromise) return youTubeApiPromise;
    youTubeApiPromise = new Promise((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (previousReady) previousReady();
        if (window.YT && window.YT.Player) resolve(window.YT);
      };
      const existingScript = document.querySelector('script[src="' + IFRAME_API_URL + '"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = IFRAME_API_URL; script.async = true;
        script.onerror = () => reject(new Error('Failed to load YouTube IFrame API'));
        document.head.appendChild(script);
      }
    });
    return youTubeApiPromise;
  };
  document.querySelectorAll('[data-cs-widget]').forEach(async (node) => {
    const widget = node.getAttribute('data-cs-widget');
    if (widget === 'youtube-video') {
      const videoId = node.getAttribute('data-cs-youtube-id') || '';
      const title = (node.getAttribute('data-cs-video-title') || '').trim().slice(0, 120) || videoId;
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) { node.textContent = 'Video is unavailable.'; return; }
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = 'Play ' + title;
      button.setAttribute('data-cs-youtube-load', '');
      button.setAttribute('aria-label', 'Load YouTube video: ' + title);
      button.addEventListener('click', () => {
        let playbackReported = false;
        const reportPlayback = () => {
          if (playbackReported) return;
          playbackReported = true;
          trackCta({
            type: 'video', campaign_id: context.campaignId, campaign_page_id: context.campaignPageId,
            ...(visitId ? { campaign_visit_id: visitId } : {}),
            cta_key: 'video-' + videoId, cta_label: title, cta_section: 'videos'
          });
        };
        node.textContent = 'Loading video…';
        loadYouTubeIframeApi()
          .then((YT) => {
            const iframe = document.createElement('iframe');
            iframe.title = title; iframe.loading = 'lazy';
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + videoId + '?rel=0&enablejsapi=1&origin=' + encodeURIComponent(location.origin);
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.allowFullscreen = true; iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            iframe.sandbox = 'allow-scripts allow-same-origin allow-presentation';
            iframe.style.width = '100%'; iframe.style.aspectRatio = '16 / 9'; iframe.style.border = '0';
            node.replaceChildren(iframe);
            new YT.Player(iframe, {
              events: { onStateChange: (event) => { if (event.data === YT.PlayerState.PLAYING) reportPlayback(); } }
            });
          })
          .catch(() => { node.textContent = 'Video is unavailable.'; });
      }, { once: true });
      node.replaceChildren(button);
      return;
    }
    if (widget !== 'booking-calendar') {
      if (context.preview) console.warn('Unknown Campaign Studio widget', widget);
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
  if (context.preview && parent !== window) {
    let lastHeight = 0;
    const reportHeight = () => {
      const height = Math.ceil(Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0));
      if (height === lastHeight) return;
      lastHeight = height;
      parent.postMessage({
        type: 'campaignstudio:embed-height', height,
        slug: context.slug, campaignId: context.campaignId, campaignPageId: context.campaignPageId
      }, '*');
    };
    new ResizeObserver(reportHeight).observe(document.documentElement);
    addEventListener('load', reportHeight);
    requestAnimationFrame(reportHeight);
  }
})();`;

export const GET: RequestHandler = () =>
	new Response(runtimeSource, {
		headers: {
			'Content-Type': 'text/javascript; charset=utf-8',
			'Cache-Control': dev ? 'no-store' : 'public, max-age=31536000, immutable',
			'X-Content-Type-Options': 'nosniff'
		}
	});
