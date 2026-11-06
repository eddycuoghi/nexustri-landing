/* NexusTri — shared site script: navigation, footer year and cookie consent. */
(() => {
  'use strict';

  const doc = document;

  // Sections that moved from the homepage to /company: keep old links such as /#company working.
  const MOVED = { '#company': '/company#company-information', '#philosophy': '/company#approach' };
  if ((window.location.pathname === '/' || window.location.pathname === '/index.html') && MOVED[window.location.hash]) {
    window.location.replace(MOVED[window.location.hash]);
    return;
  }

  // Controls that only work with JavaScript are hidden in the HTML and revealed here.
  doc.querySelectorAll('[data-js-only]').forEach((el) => { el.hidden = false; });

  // Copyright year.
  const year = String(new Date().getFullYear());
  doc.querySelectorAll('[data-year]').forEach((el) => { el.textContent = year; });

  /* ---------- Blog topic filter ----------
     Progressive enhancement: without JavaScript every article is listed. The filter only uses
     the URL fragment (#nameproof, #marginguides, #insights), so it creates no new indexable URLs. */
  const filterBar = doc.querySelector('[data-blog-filter]');
  if (filterBar) {
    const rows = Array.from(doc.querySelectorAll('[data-category]'));
    const buttons = Array.from(filterBar.querySelectorAll('[data-filter]'));
    const descs = Array.from(doc.querySelectorAll('[data-topic-desc]'));
    const status = doc.getElementById('filter-status');
    buttons.forEach((btn) => {
      const key = btn.getAttribute('data-filter');
      const count = key === 'all' ? rows.length : rows.filter((r) => r.getAttribute('data-category') === key).length;
      const badge = btn.querySelector('.filter-count');
      if (badge) badge.textContent = String(count);
    });
    const applyFilter = (wanted, announce) => {
      const active = buttons.find((b) => b.getAttribute('data-filter') === wanted) || buttons[0];
      const key = active.getAttribute('data-filter');
      let shown = 0;
      rows.forEach((row) => {
        const visible = key === 'all' || row.getAttribute('data-category') === key;
        row.hidden = !visible;
        if (visible) shown += 1;
      });
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === active)));
      descs.forEach((d) => { d.hidden = d.getAttribute('data-topic-desc') !== key; });
      if (announce && status) {
        const label = active.querySelector('.filter-label').textContent.trim();
        status.textContent = 'Showing ' + shown + (shown === 1 ? ' article' : ' articles') + (key === 'all' ? '' : ': ' + label) + '.';
      }
      return key;
    };
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = applyFilter(btn.getAttribute('data-filter'), true);
        window.history.replaceState(null, '', key === 'all' ? window.location.pathname : '#' + key);
      });
    });
    applyFilter(window.location.hash.slice(1), false);
    window.addEventListener('hashchange', () => applyFilter(window.location.hash.slice(1), true));
  }

  /* ---------- Mobile navigation ---------- */
  const toggle = doc.querySelector('.nav-toggle');
  const nav = doc.getElementById('site-nav');
  const header = doc.querySelector('.site-header');

  if (toggle && nav) {
    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      if (header) header.classList.toggle('menu-open', open);
    };

    toggle.addEventListener('click', () => setOpen(!isOpen()));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    doc.addEventListener('click', (e) => {
      if (isOpen() && !e.target.closest('.site-header')) setOpen(false);
    });
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    const desktop = window.matchMedia('(min-width: 861px)');
    const onBreakpoint = (e) => { if (e.matches) setOpen(false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onBreakpoint);
    else if (desktop.addListener) desktop.addListener(onBreakpoint);
  }

  /* ---------- Cookie consent ----------
     Analytics (Google Analytics 4) is loaded only after explicit consent.
     The choice is stored in localStorage under the same key and format used
     since the site launched, so existing visitors keep their choice. */
  const CONSENT_KEY = 'nxtr_cookie_consent_v1';
  const CONSENT_VERSION = 1;
  const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // ask again after 12 months
  const GA_MEASUREMENT_ID = 'G-6Z7B0WJP2W';

  const readConsent = () => {
    try {
      const raw = window.localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      const consent = JSON.parse(raw);
      if (!consent || consent.version !== CONSENT_VERSION) return null;
      if (typeof consent.timestamp === 'number' && Date.now() - consent.timestamp > CONSENT_MAX_AGE_MS) return null;
      return consent;
    } catch (err) {
      return null;
    }
  };

  const writeConsent = (analytics) => {
    const consent = {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: !!analytics,
      timestamp: Date.now()
    };
    try {
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    } catch (err) {
      // Storage unavailable (e.g. blocked): the choice applies to this page view only.
    }
    return consent;
  };

  const loadAnalytics = () => {
    window['ga-disable-' + GA_MEASUREMENT_ID] = false;

    if (window.__nxtrAnalyticsLoaded) {
      if (typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: 'granted' });
      return;
    }
    window.__nxtrAnalyticsLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
    // Consent covers analytics only; advertising storage and signals stay denied.
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID);

    const script = doc.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_MEASUREMENT_ID);
    doc.head.appendChild(script);
  };

  const removeAnalyticsCookies = () => {
    const names = doc.cookie
      .split(';')
      .map((c) => c.split('=')[0].trim())
      .filter((name) => name === '_ga' || name.indexOf('_ga_') === 0 || name === '_gid' || name === '_gat');
    if (!names.length) return;

    const parts = window.location.hostname.split('.');
    const domains = ['', window.location.hostname, '.' + window.location.hostname];
    for (let i = 1; i < parts.length - 1; i += 1) {
      const parent = parts.slice(i).join('.');
      domains.push(parent, '.' + parent);
    }
    names.forEach((name) => {
      domains.forEach((domain) => {
        doc.cookie = name + '=; Max-Age=0; path=/' + (domain ? '; domain=' + domain : '');
      });
    });
  };

  const disableAnalytics = () => {
    window['ga-disable-' + GA_MEASUREMENT_ID] = true;
    if (window.__nxtrAnalyticsLoaded && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: 'denied' });
    }
    removeAnalyticsCookies();
  };

  const applyConsent = (consent) => {
    if (consent && consent.analytics) loadAnalytics();
    else disableAnalytics();
  };

  // Build the consent panel once and place it early in the document so
  // keyboard and screen-reader users reach it first; it is fixed visually.
  const banner = doc.createElement('section');
  banner.className = 'cc-banner';
  banner.id = 'cookie-consent';
  banner.setAttribute('aria-labelledby', 'cc-title');
  banner.hidden = true;
  banner.innerHTML = [
    '<p class="cc-title" id="cc-title">Cookies &amp; privacy</p>',
    '<p class="cc-text">We use necessary storage to remember your choices. With your consent, we also use Google Analytics cookies to understand how the site is used in aggregate. You can change your choice at any time from “Cookie settings”. Read our <a href="/cookies">Cookie Policy</a>.</p>',
    '<div class="cc-prefs" id="cc-prefs" hidden>',
    '  <div class="cc-pref">',
    '    <div><p class="cc-pref-title" id="cc-necessary-title">Necessary</p>',
    '    <p class="cc-pref-desc" id="cc-necessary-desc">Remembers your cookie choice and supports basic site operation. Always active.</p></div>',
    '    <span class="switch"><input type="checkbox" role="switch" checked disabled aria-labelledby="cc-necessary-title" aria-describedby="cc-necessary-desc"><span class="track" aria-hidden="true"></span></span>',
    '  </div>',
    '  <div class="cc-pref">',
    '    <div><p class="cc-pref-title" id="cc-analytics-title">Analytics</p>',
    '    <p class="cc-pref-desc" id="cc-analytics-desc">Google Analytics, used only with your consent to understand aggregated usage.</p></div>',
    '    <span class="switch"><input type="checkbox" role="switch" id="cc-analytics" aria-labelledby="cc-analytics-title" aria-describedby="cc-analytics-desc"><span class="track" aria-hidden="true"></span></span>',
    '  </div>',
    '</div>',
    '<div class="cc-actions">',
    '  <button type="button" class="btn" id="cc-prefs-toggle" aria-expanded="false" aria-controls="cc-prefs">Preferences</button>',
    '  <button type="button" class="btn" id="cc-reject">Reject non-essential</button>',
    '  <button type="button" class="btn" id="cc-accept">Accept all</button>',
    '  <button type="button" class="btn btn-primary" id="cc-save" hidden>Save preferences</button>',
    '</div>'
  ].join('\n');

  const skipLink = doc.querySelector('.skip-link');
  if (skipLink && skipLink.parentNode === doc.body) doc.body.insertBefore(banner, skipLink.nextSibling);
  else doc.body.insertBefore(banner, doc.body.firstChild);

  const prefs = doc.getElementById('cc-prefs');
  const analyticsToggle = doc.getElementById('cc-analytics');
  const prefsToggle = doc.getElementById('cc-prefs-toggle');
  const saveBtn = doc.getElementById('cc-save');
  let returnFocusTo = null;

  const showPrefs = (show) => {
    prefs.hidden = !show;
    saveBtn.hidden = !show;
    prefsToggle.setAttribute('aria-expanded', String(show));
    if (show) {
      const consent = readConsent();
      analyticsToggle.checked = !!(consent && consent.analytics);
    }
  };

  const openBanner = (withPrefs, focusTarget) => {
    banner.hidden = false;
    showPrefs(withPrefs);
    if (focusTarget) focusTarget.focus();
  };

  const closeBanner = () => {
    banner.hidden = true;
    showPrefs(false);
    if (returnFocusTo && doc.contains(returnFocusTo)) returnFocusTo.focus();
    returnFocusTo = null;
  };

  const decide = (analytics) => {
    applyConsent(writeConsent(analytics));
    closeBanner();
  };

  doc.getElementById('cc-accept').addEventListener('click', () => decide(true));
  doc.getElementById('cc-reject').addEventListener('click', () => decide(false));
  saveBtn.addEventListener('click', () => decide(analyticsToggle.checked));
  prefsToggle.addEventListener('click', () => showPrefs(prefs.hidden));

  banner.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && readConsent()) {
      e.stopPropagation();
      closeBanner();
    }
  });

  doc.querySelectorAll('[data-cookie-settings]').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      returnFocusTo = trigger;
      openBanner(true, analyticsToggle);
    });
  });

  const existing = readConsent();
  if (existing) applyConsent(existing);
  else openBanner(false, null);
})();
