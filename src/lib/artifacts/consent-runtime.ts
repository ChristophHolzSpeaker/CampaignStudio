// Included only in immutable runtime v6; keep browser code self-contained.
export const consentRuntimeSource = String.raw`
  const consentHost = document.getElementById('cs-consent');
  const consentSettings = {mode:'basic',policyVersion:'cs-consent-v1',retentionDays:180,ownMeasurement:'statistics',missingOfflineConsent:'DENIED'};
  let consentReady = false;
  let consentDismissed = false;
  let choice = null;
  let consentSequence = Promise.resolve();
  let consentOpener = null;
  const deniedSignals = {ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'};
  window.dataLayer = window.dataLayer || [];
  const gtag = function(){window.dataLayer.push(arguments);};
  if (!context.preview) {
    gtag('consent','default',{...deniedSignals,wait_for_update:500});
    gtag('set','ads_data_redaction',true);
    gtag('set','url_passthrough',true);
  }
  const statisticsAllowed = () => consentReady && (consentSettings.ownMeasurement === 'necessary' || choice?.statistics === true);
  const googleAllowed = () => consentReady && (consentSettings.mode === 'advanced' || choice?.statistics || choice?.marketing || choice?.personalization);
  let consentRevision = 0;
  let appliedConsentRevision = 0;
  // The GTM template uses updateConsentState before acknowledging this snapshot.
  // Without the template, defaults stay denied and CS tag events stay buffered.
  const consentBridge = {version:1,snapshot:null,applied:(revision,signals)=>{
    const expected=consentBridge.snapshot;
    if(!expected || revision!==expected.revision || !Object.keys(deniedSignals).every(k=>signals?.[k]===expected.signals[k]))return;
    appliedConsentRevision=revision;
    pendingTags.splice(0).forEach(tag);
  }};
  if(!context.preview)window.__csConsentV6=consentBridge;
  const updateGoogleConsent = (signals) => {
    pendingTags.length=0;
    const snapshot={version:1,revision:++consentRevision,signals:{...signals}};
    consentBridge.snapshot=snapshot;
    window.dataLayer.push({event:'cs_consent_update',cs_consent_v6:snapshot});
  };
  let googleScript = null;
  const loadGoogle = () => {
    if (context.preview || !googleAllowed() || googleScript || !trackingConfig) return;
    if (!/^GTM-[A-Z0-9]+$/.test(trackingConfig.gtmContainerId || '')) return;
    window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});
    googleScript=document.createElement('script');googleScript.async=true;
    googleScript.src='https://www.googletagmanager.com/gtm.js?id='+trackingConfig.gtmContainerId;
    document.head.appendChild(googleScript);
  };
  let visitPromise = null;
  let measuredVisit = false;
  let advertisingVisit = false;
  let emailCleanup = null;
  const ensureVisit = () => {
    if (context.preview) return Promise.resolve(null);
    if (visitId && (!statisticsAllowed() || measuredVisit) && (!choice?.marketing || advertisingVisit)) return Promise.resolve(visitId);
    if (visitPromise) return visitPromise;
    const measuring=statisticsAllowed();
    const advertising=choice?.marketing===true;
    visitPromise=post(context.endpoints.visits,{campaignPageId:context.campaignPageId,pageUrl:(measuring || advertising)?location.pathname+location.search:location.pathname,consentOnly:!measuring})
      .then(result=>{visitId=result?.data?.visitId || null;measuredVisit=measuring;advertisingVisit=advertising;if(visitId && statisticsAllowed() && !emailCleanup)emailCleanup=startEmailAttribution(context.campaignPageId);return visitId;})
      .finally(()=>{visitPromise=null;if(visitId && ((statisticsAllowed() && !measuredVisit) || (choice?.marketing && !advertisingVisit)))ensureVisit().catch(()=>undefined);});
    return visitPromise;
  };
  const persistChoice = (selected) => {
    if (context.preview || !selected) return;
    consentSequence=consentSequence.catch(()=>undefined).then(async()=>{
      if(selected.evidenceRef!==choice?.evidenceRef)return;
      const id=await ensureVisit();
      if(selected.evidenceRef!==choice?.evidenceRef)return;
      if (!id) throw new Error('Visit unavailable');
      await post('/api/runtime/v1/consent',{campaignPageId:context.campaignPageId,visitId:id,
        adUserDataConsent:selected.marketing?'GRANTED':'DENIED',evidenceRef:selected.evidenceRef,policyVersion:selected.policyVersion,expiresAt:new Date(selected.expiresAt).toISOString()});
      if(consentHost)consentHost.querySelector('[data-cs-consent-status]').textContent='';
    }).catch(()=>{
      if(consentHost){consentHost.hidden=false;consentHost.querySelector('[data-cs-consent-status]').textContent='Ihre Auswahl gilt hier bereits. Der Nachweis konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.';}
    });
  };
  const deleteMeasurementCookies = (selected) => {
    document.cookie.split(';').forEach(part=>{
      const name=part.trim().split('=')[0];
      if(!((!selected.statistics && /^(_ga(?:_|$)|_gid$|_gat)/.test(name)) || (!selected.marketing && /^_gcl_/.test(name))))return;
      const domains=['',location.hostname];
      const labels=location.hostname.split('.');
      for(let i=1;i<labels.length-1;i++)domains.push('.'+labels.slice(i).join('.'));
      domains.forEach(domain=>document.cookie=name+'=; Path=/; Max-Age=0; SameSite=Lax'+(domain?'; Domain='+domain:'')+(location.protocol==='https:'?'; Secure':''));
    });
  };
  const applyChoice = (selected, remember) => {
    const previouslyMeasured=statisticsAllowed();
    choice=selected;
    if(!context.preview){
      updateGoogleConsent({ad_storage:selected.marketing?'granted':'denied',analytics_storage:selected.statistics?'granted':'denied',
        ad_user_data:selected.marketing?'granted':'denied',ad_personalization:selected.personalization?'granted':'denied'});
      if(!selected.statistics || !selected.marketing)deleteMeasurementCookies(selected);
      if(remember)document.cookie='cs_consent='+encodeURIComponent(JSON.stringify(selected))+'; Path=/; SameSite=Lax; Max-Age='+consentSettings.retentionDays*86400+(location.protocol==='https:'?'; Secure':'');
    }
    if(consentHost)consentHost.hidden=true;
    if(!statisticsAllowed()){stopStatistics();pendingEvents.length=0;if(emailCleanup){emailCleanup();emailCleanup=null;}}
    loadGoogle();
    refreshConsentWidgets();
    if(statisticsAllowed()){startStatistics();ensureVisit().catch(()=>undefined);if(remember && !previouslyMeasured)measure('page_view');}
    persistChoice({...selected});
    if(remember){
      const target=consentOpener && !consentHost?.contains(consentOpener) ? consentOpener : document.querySelector('[data-cs-consent-open]');
      target?.focus({preventScroll:true});
    }
    consentOpener=null;
  };
  const selectConsent = (statistics,marketing,personalization) => {
    if(!consentReady)return;
    applyChoice({statistics,marketing,personalization,policyVersion:consentSettings.policyVersion,
      evidenceRef:'cs:'+crypto.randomUUID(),expiresAt:Date.now()+consentSettings.retentionDays*86400000},true);
  };
  const dismissConsent = () => {
    if(!consentHost)return;
    consentDismissed=true;
    consentHost.hidden=true;
    const target=consentOpener && !consentHost.contains(consentOpener) ? consentOpener : document.querySelector('[data-cs-consent-open]');
    target?.focus({preventScroll:true});
    consentOpener=null;
  };
  const openConsent = (opener) => {
    if(!consentHost)return;
    consentDismissed=false;
    consentOpener=opener || null;
    consentHost.hidden=false;
    consentHost.querySelector('[data-cs-consent-summary]').hidden=true;
    consentHost.querySelector('[data-cs-consent-preferences]').hidden=false;
    consentHost.querySelector('[data-cs-consent-settings]').hidden=true;
    consentHost.querySelector('[data-cs-consent-save]').hidden=false;
    consentHost.querySelectorAll('[data-cs-consent-category]').forEach(input=>input.checked=choice?.[input.getAttribute('data-cs-consent-category')] === true);
    consentHost.querySelector('[data-cs-consent-preferences] h2').focus({preventScroll:true});
    consentHost.scrollTop=0;
    consentHost.querySelector('.cs-consent-copy').scrollTop=0;
  };
  if(consentHost){
    consentHost.querySelector('[data-cs-consent-close]').addEventListener('click',dismissConsent);
    consentHost.querySelector('[data-cs-consent-accept]').addEventListener('click',()=>selectConsent(true,true,true));
    consentHost.querySelector('[data-cs-consent-reject]').addEventListener('click',()=>selectConsent(false,false,false));
    consentHost.querySelector('[data-cs-consent-settings]').addEventListener('click',e=>openConsent(e.currentTarget));
    consentHost.querySelector('[data-cs-consent-save]').addEventListener('click',()=>selectConsent(
      consentHost.querySelector('[data-cs-consent-category="statistics"]').checked,
      consentHost.querySelector('[data-cs-consent-category="marketing"]').checked,
      consentHost.querySelector('[data-cs-consent-category="personalization"]').checked));
  }
  consentHost?.addEventListener('keydown',event=>{
    if(event.key==='Escape')dismissConsent();
  });
  document.addEventListener('click',event=>{
    const opener=event.target instanceof Element?event.target.closest('[data-cs-consent-open]'):null;
    if(opener){event.preventDefault();openConsent(opener);}
  });
  const initializeConsent = (settings) => {
    Object.assign(consentSettings,settings || {});
    consentReady=true;
    if(context.preview)return;
    let saved;
    try{saved=JSON.parse(decodeURIComponent(document.cookie.split('; ').find(p=>p.startsWith('cs_consent='))?.slice(11) || 'null'));}catch{}
    if(saved && saved.policyVersion===consentSettings.policyVersion && Number.isFinite(saved.expiresAt) && saved.expiresAt>Date.now()
      && saved.expiresAt<=Date.now()+consentSettings.retentionDays*86400000
      && ['statistics','marketing','personalization'].every(k=>typeof saved[k]==='boolean') && /^cs:[a-f0-9-]{36}$/.test(saved.evidenceRef || ''))applyChoice(saved,false);
    else {
      if(consentHost)consentHost.hidden=consentDismissed;
      document.cookie='cs_consent=; Path=/; Max-Age=0; SameSite=Lax';
      updateGoogleConsent(deniedSignals);
      loadGoogle();
      if(statisticsAllowed()){startStatistics();ensureVisit().catch(()=>undefined);}
    }
  };
`;
