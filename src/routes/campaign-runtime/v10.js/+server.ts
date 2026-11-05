import { startEmailAttribution } from '$lib/tracking/email-browser';
import { consentRuntimeV10Source } from '$lib/artifacts/consent-runtime-v10';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

const runtimeSource = String.raw`(() => {
  'use strict';
  const node = document.getElementById('cs-page-context');
  if (!node) return;
  let context;
  try { context = JSON.parse(node.textContent || '{}'); } catch { return; }
  if (context.runtimeVersion !== 'v10') return;
  const post = async (url, body, keepalive = false) => {
    const response = await fetch(url, {
      method: 'POST', credentials: 'same-origin', keepalive,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('Campaign Studio request failed');
    return response.status === 204 ? null : response.json();
  };
  let visitId = null;
  let startedAt = null;
  const startEmailAttribution = ${startEmailAttribution.toString()};
  ${consentRuntimeV10Source}
  let engagementSent = false;
  const engage = () => {
    if (context.preview || !statisticsAllowed() || startedAt===null || engagementSent || !visitId) return;
    engagementSent = true;
    post(context.endpoints.engagement, { campaignPageId: context.campaignPageId, visitId, durationMs: Date.now() - startedAt }, true).catch(() => undefined);
  };
  let engagementTimer;
  const startStatistics = () => {if(startedAt!==null)return;startedAt=Date.now();engagementSent=false;engagementTimer=setTimeout(engage,10000);};
  const stopStatistics = () => {startedAt=null;clearTimeout(engagementTimer);};
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
    if (!googleAllowed()) return;
    if (!trackingConfig || appliedConsentRevision !== consentRevision || !consentRevision) { if (pendingTags.length < 200) pendingTags.push(e); return; }
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
    if (!statisticsAllowed() || flushing || !visitId || !pendingEvents.length || context.preview) return;
    flushing = true;
    const batch = pendingEvents.splice(0,30);
    const evidenceAtStart=choice?.evidenceRef;
    try { await post('/api/runtime/v1/events',{campaignPageId:context.campaignPageId,visitId,events:batch},true); }
    catch { if(statisticsAllowed() && evidenceAtStart===choice?.evidenceRef){pendingEvents.unshift(...batch); if (pendingEvents.length > 200) pendingEvents.length = 200;} }
    finally { flushing = false; }
  };
  const measure = (name, action, section, metric) => {
    if (context.preview || (!statisticsAllowed() && !googleAllowed())) return;
    const e={id:crypto.randomUUID(),name:eventName(name) || 'interaction',action:identifier(action),section:identifier(section),...(Number.isFinite(metric)?{metric}: {})};
    tag(e); if (statisticsAllowed() && pendingEvents.length < 200) pendingEvents.push(e);
    if (pendingEvents.length >= 20) flush();
  };
  const sectionOf = el => el.closest('[data-cs-section]')?.getAttribute('data-cs-section') || el.getAttribute('data-cs-cta-section');
  const actionOf = el => el.getAttribute('data-cs-track') || el.getAttribute('data-cs-cta-key') || identifier(el.id);
  if (!context.preview) {
    let trackingTimeout;
    const trackingDeadline=new Promise((_,reject)=>{trackingTimeout=setTimeout(()=>reject(new Error('Tracking configuration timed out')),10000);});
    const trackingRequest=fetch('/api/runtime/v1/tracking?pageId='+context.campaignPageId,{credentials:'same-origin'})
      .then(r=>{if(!r.ok)throw new Error('Tracking configuration unavailable');return r.json();});
    Promise.race([trackingRequest,trackingDeadline])
      .then(result=>{
        trackingConfig=result.data;
        initializeConsent(trackingConfig.consent);
        measure('page_view');
        pendingTags.splice(0).forEach(tag);
      }).catch(()=>{consentLoadFailed();}).finally(()=>clearTimeout(trackingTimeout));
    setInterval(flush,2000);
  } else { initializeConsent(); }
  document.addEventListener('click',e=>{
    const el=e.target instanceof Element?e.target.closest('a,button,[data-cs-track]'):null;
    if (!el || el.closest('[data-cs-consent-open]') || el.closest('[data-cs-track-ignore]') || el.closest('[data-cs-widget="youtube-video"]')) return;
    measure(el.getAttribute('data-cs-event') || (el.matches('a')?'navigation_click':'button_click'),actionOf(el),sectionOf(el));
  });
  const nativePlays=new WeakSet();
  document.addEventListener('playing',e=>{
    const el=e.target;
    if ((!statisticsAllowed() && !googleAllowed()) || !(el instanceof Element) || !el.matches('video,audio') || nativePlays.has(el) || el.closest('[data-cs-track-ignore]')) return;
    nativePlays.add(el);measure(el.matches('video')?'video_play':'audio_play',actionOf(el),sectionOf(el));
  },true);
  const startedForms=new WeakSet(); const inputFields=new WeakSet();
  document.addEventListener('input',e=>{
    const el=e.target;if((!statisticsAllowed() && !googleAllowed()) || !(el instanceof HTMLElement)||el.closest('[data-cs-track-ignore]'))return;
    const form=el.closest('form');if(!form)return;
    if(!startedForms.has(form)){startedForms.add(form);measure('form_start',actionOf(form)||form.getAttribute('data-cs-form-key'),sectionOf(form));}
    // Only declared safe field identifiers; never values, names, labels, or keystrokes.
    if(!inputFields.has(el)){inputFields.add(el);measure('form_input',el.getAttribute('data-cs-track'),sectionOf(el));}
  });
  let activeMs=0;let lastTick=performance.now();const timeMarks=new Set();const scrollMarks=new Set();
  const tick=()=>{const now=performance.now();if(!statisticsAllowed() && !googleAllowed()){lastTick=now;return;}if(document.visibilityState==='visible')activeMs+=Math.min(now-lastTick,2000);lastTick=now;
    [10,30,60,120].forEach(s=>{if(activeMs>=s*1000&&!timeMarks.has(s)){timeMarks.add(s);measure('active_time','seconds_'+s,undefined,s);}});
  };
  if(!context.preview)setInterval(tick,1000);
  document.addEventListener('visibilitychange',()=>{lastTick=performance.now();if(document.visibilityState==='hidden')flush();});
  document.body.addEventListener('scroll',()=>{
    if(!statisticsAllowed() && !googleAllowed())return;
    const extent=document.body.scrollHeight-document.body.clientHeight;if(extent<=0)return;
    const percent=100*document.body.scrollTop/extent;
    [25,50,75,90,100].forEach(n=>{if(percent>=n-0.5&&!scrollMarks.has(n)){scrollMarks.add(n);measure('scroll_depth','percent_'+n,undefined,n);}});
  },{passive:true});
  const observed=new WeakSet();
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if((!statisticsAllowed() && !googleAllowed()) || !entry.isIntersecting||observed.has(entry.target))return;
    observed.add(entry.target);measure('section_view',entry.target.getAttribute('data-cs-track-view'),sectionOf(entry.target));
    observer.unobserve(entry.target);
  }),{threshold:0.25});
  document.querySelectorAll('[data-cs-track-view]').forEach(el=>observer.observe(el));
  addEventListener('pagehide',()=>{measure('page_exit',undefined,undefined,Math.round(activeMs));flush();});

  const trackCta = (payload) => {
    if (context.preview) return;
    if (payload.type === 'video') measure('video_play', payload.cta_key, payload.cta_section);
    if (!statisticsAllowed()) return;
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
        // Submit the lead immediately. Attribution may finish later and must never block it.
        const canLinkAtSubmission = statisticsAllowed() || choice?.marketing === true;
        const attributionVisit = canLinkAtSubmission ? ensureVisit().catch(() => null) : null;
        const result = await post(context.endpoints.leadIntake, { campaignPageId: context.campaignPageId, formKey: form.getAttribute('data-cs-form-key') || undefined, fields: data });
        if (attributionVisit && result?.data?.attributionReceipt) {
          attributionVisit.then(async id => {
            await consentSequence;
            if (id && attributionVisitReceipt && (statisticsAllowed() || choice?.marketing === true))
              return post('/api/runtime/v1/forms/attribution', {campaignPageId:context.campaignPageId,visitId:id,visitReceipt:attributionVisitReceipt,attributionReceipt:result.data.attributionReceipt}, true);
          }).catch(() => undefined);
        }
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
  const initializedVideos = new WeakSet();
  const videoTokens = new WeakMap();
  const initializeWidget = async (node) => {
    const widget = node.getAttribute('data-cs-widget');
    if (widget === 'youtube-video') {
      if(context.preview){node.style.aspectRatio='16 / 9';node.textContent='Video-Vorschau: Im veröffentlichten Artefakt abspielbar.';return;}
      if(initializedVideos.has(node))return;
      initializedVideos.add(node);
      const videoId = node.getAttribute('data-cs-youtube-id') || '';
      const title = (node.getAttribute('data-cs-video-title') || '').trim().slice(0, 120) || 'YouTube-Video';
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) { node.textContent = 'Video is unavailable.'; return; }
      node.style.aspectRatio = '16 / 9';
      node.style.position = 'relative';
      const button = document.createElement('button');
      button.type = 'button'; button.setAttribute('data-cs-video-play','');
      button.setAttribute('aria-label','YouTube-Video abspielen: ' + title);
      button.textContent = 'YouTube-Video abspielen';
      button.style.cssText='position:absolute;inset:50% auto auto 50%;transform:translate(-50%,-50%);z-index:1;max-width:calc(100% - 16px);padding:12px 16px;border:1px solid white;border-radius:4px;background:rgba(0,0,0,.85);color:white;font:inherit;line-height:1.2;text-align:center;cursor:pointer';
      button.addEventListener('click',()=>{
        const trackPlayback=choice?.marketing===true;
        const videoToken=Symbol();videoTokens.set(node,videoToken);
        const iframe=document.createElement('iframe');
        iframe.title=title;
        iframe.src='https://www.youtube-nocookie.com/embed/'+videoId+'?rel=0&playsinline=1&autoplay=1&controls=1'+(trackPlayback?'&enablejsapi=1&origin='+encodeURIComponent(location.origin):'');
        iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';
        iframe.sandbox='allow-scripts allow-same-origin allow-presentation';
        iframe.style.display='block';iframe.style.width='100%';iframe.style.height='100%';iframe.style.aspectRatio='16 / 9';iframe.style.border='0';
        node.replaceChildren(iframe);
        if(!trackPlayback)return;
        let playbackReported=false;
        loadYouTubeIframeApi().then(YT=>{
          if(videoTokens.get(node)!==videoToken || !node.contains(iframe))return;
          const reportPlaying=()=>{
            if(playbackReported || !choice?.marketing)return;
            playbackReported=true;
            trackCta({type:'video',campaign_id:context.campaignId,campaign_page_id:context.campaignPageId,
              ...(visitId?{campaign_visit_id:visitId}:{}),cta_key:identifier(node.getAttribute('data-cs-track'))||'video-'+videoId,
              cta_label:title,cta_section:identifier(sectionOf(node))||'videos'});
          };
          new YT.Player(iframe,{events:{
            onReady:(event)=>{if(event.target.getPlayerState()===YT.PlayerState.PLAYING)reportPlaying();},
            onStateChange:(event)=>{if(event.data===YT.PlayerState.PLAYING)reportPlaying();}
          }});
        }).catch(()=>undefined);
      },{once:true});
      node.appendChild(button);
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
  };
  const refreshConsentWidgets = () => document.querySelectorAll('[data-cs-widget="youtube-video"]').forEach(initializeWidget);
  document.querySelectorAll('[data-cs-widget]').forEach(initializeWidget);
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
