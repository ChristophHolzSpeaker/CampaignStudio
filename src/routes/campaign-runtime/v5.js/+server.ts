import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

const runtimeSource = String.raw`(() => {
  'use strict';
  const node = document.getElementById('cs-page-context');
  if (!node) return;
  let context;
  try { context = JSON.parse(node.textContent || '{}'); } catch { return; }
  if (context.runtimeVersion !== 'v5') return;
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
  // One envelope for all tags; every optional destination field is reset on every event.
  window.dataLayer = window.dataLayer || [];
  let trackingConfig = null;
  const pendingTags = [];
  const pendingEvents = [];
  let flushing = false;
  const identifier = (value) => /^[a-z][a-zA-Z0-9_-]{0,63}$/.test(value || '') ? value : undefined;
  const eventName = (value) => /^[a-z][a-z0-9_]{0,39}$/.test(value || '') ? value : undefined;
  const tag = (e) => {
    if (!trackingConfig) { if (pendingTags.length < 200) pendingTags.push(e); return; }
    const mappings = trackingConfig.mappings || [];
    const mapping = mappings.find(m => m.event === e.name && m.action === e.action)
      || mappings.find(m => m.event === e.name && !m.action);
    window.dataLayer.push({event:'cs_event', cs_event_name:e.name, cs_event_id:e.id,
      cs_campaign_id:context.campaignId, cs_page_id:context.campaignPageId,
      cs_action:e.action || null, cs_section:e.section || null, cs_metric:e.metric ?? null,
      cs_ads_conversion_id:mapping?.conversionId?.replace(/^AW-/, '') || null, cs_ads_conversion_label:mapping?.conversionLabel || null,
      cs_value:mapping?.value ?? null, cs_currency:mapping?.currency || null});
  };
  const flush = async () => {
    if (flushing || !visitId || !pendingEvents.length || context.preview) return;
    flushing = true;
    const batch = pendingEvents.splice(0,30);
    try { await post('/api/runtime/v1/events',{campaignPageId:context.campaignPageId,visitId,events:batch},true); }
    catch { pendingEvents.unshift(...batch); if (pendingEvents.length > 200) pendingEvents.length = 200; }
    finally { flushing = false; }
  };
  const measure = (name, action, section, metric) => {
    if (context.preview) return;
    const e={id:crypto.randomUUID(),name:eventName(name) || 'interaction',action:identifier(action),section:identifier(section),...(Number.isFinite(metric)?{metric}: {})};
    tag(e); if (pendingEvents.length < 200) pendingEvents.push(e);
    if (pendingEvents.length >= 20) flush();
  };
  const sectionOf = el => el.closest('[data-cs-section]')?.getAttribute('data-cs-section') || el.getAttribute('data-cs-cta-section');
  const actionOf = el => el.getAttribute('data-cs-track') || el.getAttribute('data-cs-cta-key') || identifier(el.id);
  if (!context.preview) {
    // Owner-configured Google defaults. This is not a record of visitor consent.
    function consent(){window.dataLayer.push(arguments);}
    consent('consent','default',{ad_storage:'granted',analytics_storage:'granted',ad_user_data:'granted',ad_personalization:'granted'});
    fetch('/api/runtime/v1/tracking?pageId='+context.campaignPageId,{credentials:'same-origin'})
      .then(r=>{if(!r.ok)throw new Error('Tracking configuration unavailable');return r.json();})
      .then(result=>{
        trackingConfig=result.data;
        if (/^GTM-[A-Z0-9]+$/.test(trackingConfig.gtmContainerId || '')) {
          window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});
          const script=document.createElement('script');script.async=true;
          script.src='https://www.googletagmanager.com/gtm.js?id='+trackingConfig.gtmContainerId;
          document.head.appendChild(script);
        }
        pendingTags.splice(0).forEach(tag);
      }).catch(()=>{trackingConfig={mappings:[]};pendingTags.splice(0).forEach(tag);});
    setInterval(flush,2000);
    measure('page_view');
  }
  document.addEventListener('click',e=>{
    const el=e.target instanceof Element?e.target.closest('a,button,[data-cs-track]'):null;
    if (!el || el.closest('[data-cs-track-ignore]') || el.closest('[data-cs-widget="youtube-video"]')) return;
    measure(el.getAttribute('data-cs-event') || (el.matches('a')?'navigation_click':'button_click'),actionOf(el),sectionOf(el));
  });
  const nativePlays=new WeakSet();
  document.addEventListener('playing',e=>{
    const el=e.target;
    if (!(el instanceof Element) || !el.matches('video,audio') || nativePlays.has(el) || el.closest('[data-cs-track-ignore]')) return;
    nativePlays.add(el);measure(el.matches('video')?'video_play':'audio_play',actionOf(el),sectionOf(el));
  },true);
  const startedForms=new WeakSet(); const inputFields=new WeakSet();
  document.addEventListener('input',e=>{
    const el=e.target;if(!(el instanceof HTMLElement)||el.closest('[data-cs-track-ignore]'))return;
    const form=el.closest('form');if(!form)return;
    if(!startedForms.has(form)){startedForms.add(form);measure('form_start',actionOf(form)||form.getAttribute('data-cs-form-key'),sectionOf(form));}
    // Only declared safe field identifiers; never values, names, labels, or keystrokes.
    if(!inputFields.has(el)){inputFields.add(el);measure('form_input',el.getAttribute('data-cs-track'),sectionOf(el));}
  });
  let activeMs=0;let lastTick=performance.now();const timeMarks=new Set();const scrollMarks=new Set();
  const tick=()=>{const now=performance.now();if(document.visibilityState==='visible')activeMs+=Math.min(now-lastTick,2000);lastTick=now;
    [10,30,60,120].forEach(s=>{if(activeMs>=s*1000&&!timeMarks.has(s)){timeMarks.add(s);measure('active_time','seconds_'+s,undefined,s);}});
  };
  if(!context.preview)setInterval(tick,1000);
  document.addEventListener('visibilitychange',()=>{lastTick=performance.now();if(document.visibilityState==='hidden')flush();});
  addEventListener('scroll',()=>{
    const extent=document.documentElement.scrollHeight-innerHeight;if(extent<=0)return;
    const percent=100*scrollY/extent;
    [25,50,75,90,100].forEach(n=>{if(percent>=n-0.5&&!scrollMarks.has(n)){scrollMarks.add(n);measure('scroll_depth','percent_'+n,undefined,n);}});
  },{passive:true});
  const observed=new WeakSet();
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting||observed.has(entry.target))return;
    observed.add(entry.target);measure('section_view',entry.target.getAttribute('data-cs-track-view'),sectionOf(entry.target));
    observer.unobserve(entry.target);
  }),{threshold:0.25});
  document.querySelectorAll('[data-cs-track-view]').forEach(el=>observer.observe(el));
  addEventListener('pagehide',()=>{measure('page_exit',undefined,undefined,Math.round(activeMs));flush();});

  const trackCta = (payload) => {
    if (context.preview) return;
    if (payload.type === 'video') measure('video_play', payload.cta_key, payload.cta_section);
    // Legacy CS persistence remains independent of the GTM envelope.
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
        measure('form_submit', form.getAttribute('data-cs-form-key'), sectionOf(form));
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
      if (!/^[A-Za-zA-Z0-9_-]{11}$/.test(videoId)) { node.textContent = 'Video is unavailable.'; return; }
      let playbackReported = false;
      const reportPlayback = () => {
        if (playbackReported) return;
        playbackReported = true;
        trackCta({
          type: 'video', campaign_id: context.campaignId, campaign_page_id: context.campaignPageId,
          ...(visitId ? { campaign_visit_id: visitId } : {}),
          cta_key: identifier(node.getAttribute('data-cs-track')) || 'video-' + videoId, cta_label: title, cta_section: identifier(sectionOf(node)) || 'videos'
        });
      };
      node.style.aspectRatio = '16 / 9';
      node.textContent = 'Loading video…';
      loadYouTubeIframeApi()
        .then((YT) => {
          const iframe = document.createElement('iframe');
          iframe.title = title;
          iframe.src = 'https://www.youtube-nocookie.com/embed/' + videoId + '?rel=0&playsinline=1&autoplay=0&controls=1&enablejsapi=1&origin=' + encodeURIComponent(location.origin);
          iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
          iframe.allowFullscreen = true; iframe.referrerPolicy = 'strict-origin-when-cross-origin';
          iframe.sandbox = 'allow-scripts allow-same-origin allow-presentation';
          iframe.style.display = 'block'; iframe.style.width = '100%'; iframe.style.height = '100%';
          iframe.style.aspectRatio = '16 / 9'; iframe.style.border = '0';
          node.replaceChildren(iframe);
          new YT.Player(iframe, {
            events: {
              onStateChange: (event) => { if (event.data === YT.PlayerState.PLAYING) reportPlayback(); },
              onError: () => { node.textContent = 'Video is unavailable.'; }
            }
          });
        })
        .catch(() => { node.textContent = 'Video is unavailable.'; });
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
    if (event.origin !== location.origin || !event.data || event.data.type !== 'cs-widget-measure') return;
    const frame=Array.from(document.querySelectorAll('[data-cs-widget="booking-calendar"] iframe')).find(f=>f.contentWindow===event.source);
    if (!frame || !['button_click','navigation_click','form_start','form_input','booking_confirmed'].includes(event.data.name)) return;
    measure(event.data.name,identifier(event.data.action),identifier(sectionOf(frame)) || 'booking');
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
