// Trusted platform markup. Artifact authors cannot provide scripts or customize this panel.
export const consentBannerStyle = `<style data-cs-consent-style>
html:has(#cs-consent){height:100%;overflow:hidden;--cs-consent-space:min(120px,45dvh)}
html:has(#cs-consent) body{box-sizing:border-box!important;margin:0!important;height:calc(100dvh - var(--cs-consent-space))!important;overflow-y:auto!important;scroll-padding-block:16px}
html:has(#cs-consent[hidden]) body{height:100dvh!important}
#cs-consent{all:initial;box-sizing:border-box;position:fixed;inset:auto 0 0;z-index:2147483647;height:var(--cs-consent-space);display:block;background:#fff;color:#09090b;box-shadow:0 -5px 14px -8px rgb(9 9 11 / 22%);font:400 12.5px/1.35 var(--cs-font-sans,'Bureau Grot',system-ui,sans-serif);color-scheme:light;overflow:auto;isolation:isolate}
#cs-consent[hidden],#cs-consent [hidden]{display:none!important}
#cs-consent *{box-sizing:border-box;font:inherit;color:inherit;letter-spacing:normal;text-transform:none}
#cs-consent .cs-consent-inner{max-width:1344px;margin:auto;padding:10px 32px;height:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:24px;align-items:center}
#cs-consent .cs-consent-copy{grid-column:1;grid-row:1;min-height:0;max-height:100%;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:4px}
#cs-consent h2{font:700 20px/1 var(--cs-font-display,'Bureau Grot Compressed','Bureau Grot',sans-serif);text-transform:uppercase;letter-spacing:-.02em;margin:0 0 4px;padding-right:28px}
#cs-consent p{margin:0}
#cs-consent .cs-consent-links{display:flex;gap:8px;align-items:center;font-size:12px;line-height:1.35;color:#44444b}
#cs-consent a{text-decoration:underline;text-underline-offset:3px;font:inherit;text-transform:none;letter-spacing:normal}
#cs-consent .cs-consent-copy:focus-visible{outline:2px solid #09090b;outline-offset:-2px}
#cs-consent a:hover{color:#bd1230}
#cs-consent .cs-consent-actions{grid-column:2;grid-row:1;display:grid;grid-template-columns:repeat(3,114px);gap:6px;align-self:center}
#cs-consent button{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;cursor:pointer;min-height:44px;padding:6px 8px;border:1px solid #09090b;border-radius:0;background:#fff;color:#09090b;font:500 16px/1.1 var(--cs-font-display,'Bureau Grot Compressed','Bureau Grot',sans-serif);text-transform:uppercase;letter-spacing:-.02em;text-align:center;transition:background-color .15s,color .15s,border-color .15s}
#cs-consent .cs-consent-close{position:absolute;top:4px;right:6px;width:32px;height:32px;min-height:32px;padding:8px;border:0;background:transparent;color:#44444b;z-index:1}
#cs-consent .cs-consent-close:hover{background:#f1f1f2;color:#09090b}
#cs-consent .cs-consent-close svg{display:block;width:16px;height:16px;pointer-events:none}
#cs-consent button:hover{background:#e2183b;border-color:#e2183b;color:#fff}
#cs-consent :is(button,a,input):focus-visible{outline:2px solid #09090b;outline-offset:3px}
#cs-consent [data-cs-consent-preferences]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:16px;row-gap:6px}
#cs-consent [data-cs-consent-preferences] h2{grid-column:1 / -1;margin-bottom:2px}
#cs-consent label{display:flex;gap:8px;align-items:flex-start;margin:0;line-height:1.4}
#cs-consent input{appearance:none;display:grid;place-items:center;border:1px solid #696970;background:#fff;width:20px;height:20px;margin:0;flex:none;cursor:pointer;border-radius:0}
#cs-consent input:checked{background:#09090b;border-color:#09090b}
#cs-consent input:checked::after{content:'';width:11px;height:8px;clip-path:polygon(0 38%,18% 17%,41% 48%,83% 0,100% 17%,40% 100%);background:#fff}
#cs-consent input:disabled{cursor:default;opacity:.65}
#cs-consent [role=status]{color:#a40f29;font-size:12px}
#cs-consent [role=status]:empty{display:none}
@media(max-width:1150px){html:has(#cs-consent){--cs-consent-space:min(160px,45dvh)}#cs-consent .cs-consent-inner{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;padding:10px 32px;row-gap:8px}#cs-consent .cs-consent-actions{grid-column:1;grid-row:2;grid-template-columns:repeat(3,minmax(0,1fr));max-width:420px}}
@media(max-width:640px){html:has(#cs-consent){--cs-consent-space:min(228px,45dvh)}#cs-consent .cs-consent-inner{padding:12px 16px;row-gap:8px}#cs-consent h2{font-size:20px}#cs-consent button{font-size:16px;padding:6px 4px}#cs-consent [data-cs-consent-preferences]{grid-template-columns:minmax(0,1fr);row-gap:8px}}
@media(prefers-reduced-motion:reduce){#cs-consent button{transition:none}}
</style>`;

export const consentBannerMarkup = `<aside id="cs-consent" aria-label="Cookie-Einstellungen" lang="de" data-cs-track-ignore>
<button type="button" class="cs-consent-close" data-cs-consent-close aria-label="Cookie-Banner schließen" title="Ohne neue Auswahl schließen"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>
<div class="cs-consent-inner"><div class="cs-consent-copy" tabindex="0" role="region" aria-label="Informationen zu Cookies">
<div data-cs-consent-summary><h2>Ihre Cookie-Auswahl</h2><p>Wir verwenden Cookies und ähnliche Technologien, um die Nutzung dieser Seite zu messen und den Erfolg unserer Anzeigen auszuwerten. Sie entscheiden, was erlaubt ist — Ihre Auswahl können Sie jederzeit über „Cookie-Einstellungen“ ändern.</p></div>
<div data-cs-consent-preferences hidden><h2 tabindex="-1">Cookie-Einstellungen</h2>
<label><input type="checkbox" checked disabled>Notwendig — immer aktiv: Betrieb der Seite und Ihre Anfrage.</label>
<label><input type="checkbox" data-cs-consent-category="statistics">Statistik — Messung, welche Inhalte genutzt werden.</label>
<label><input type="checkbox" data-cs-consent-category="marketing">Marketing — Messung des Erfolgs unserer Google-Anzeigen.</label>
<label><input type="checkbox" data-cs-consent-category="personalization">Personalisierung — personalisierte Werbung bei Google.</label>
</div>
<p class="cs-consent-links"><a href="https://www.christophholz.com/datenschutzerklarung" target="_blank" rel="noopener">Datenschutz</a><span aria-hidden="true">·</span><a href="https://www.christophholz.com/impressum" target="_blank" rel="noopener">Impressum</a></p>
<p role="status" data-cs-consent-status></p></div>
<div class="cs-consent-actions"><button type="button" data-cs-consent-accept>Alle akzeptieren</button><button type="button" data-cs-consent-reject>Nur notwendige</button><button type="button" data-cs-consent-settings>Einstellungen</button><button type="button" data-cs-consent-save hidden>Auswahl speichern</button></div>
</div></aside>`;
