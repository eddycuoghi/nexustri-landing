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

  /* ---------- Scroll reveal ----------
     Sections marked data-reveal fade in once as they enter the viewport. Only elements that start
     below the fold are ever hidden, and only when motion is welcome and IntersectionObserver exists:
     without JavaScript, or with reduced motion, everything is simply visible. */
  const revealTargets = Array.from(doc.querySelectorAll('[data-reveal]'));
  const motionOK = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
  if (revealTargets.length && motionOK && 'IntersectionObserver' in window) {
    const pending = new Set();
    let observer = null;
    const reveal = (el, delayMs) => {
      if (!pending.delete(el)) return;
      observer.unobserve(el);
      el.style.setProperty('--reveal-delay', delayMs + 'ms');
      el.classList.add('is-revealed');
      // Hand the element back to its normal styles (hover lift, etc.) once the transition is over.
      window.setTimeout(() => {
        el.classList.remove('reveal', 'is-revealed');
        el.style.removeProperty('--reveal-delay');
      }, delayMs + 900);
    };
    observer = new IntersectionObserver((entries) => {
      let batch = 0;
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target, Math.min(batch, 3) * 80); // gentle stagger for items entering together
        batch += 1;
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    const fold = window.innerHeight;
    revealTargets.forEach((el) => {
      if (el.getBoundingClientRect().top < fold) return; // never hide what is already on screen
      el.classList.add('reveal');
      pending.add(el);
      observer.observe(el);
    });
    // Keyboard focus and printing must never meet hidden content.
    doc.addEventListener('focusin', (e) => {
      pending.forEach((el) => { if (el.contains(e.target)) reveal(el, 0); });
    });
    window.addEventListener('beforeprint', () => { pending.forEach((el) => reveal(el, 0)); });
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
     since the site launched, so existing visitors keep their choice. It is
     shared by every open tab of the website. */
  const CONSENT_KEY = 'nxtr_cookie_consent_v1';
  const CONSENT_VERSION = 1;
  const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // ask again after 12 months
  const GA_MEASUREMENT_ID = 'G-6Z7B0WJP2W';

  // If storage is unavailable, the choice applies to this page view only.
  let memoryConsent = null;
  let useMemory = false;

  const validConsent = (consent) => {
    if (!consent || consent.version !== CONSENT_VERSION) return null;
    if (typeof consent.timestamp === 'number' && Date.now() - consent.timestamp > CONSENT_MAX_AGE_MS) return null;
    return consent;
  };

  const readConsent = () => {
    if (useMemory) return validConsent(memoryConsent);
    let raw;
    try {
      raw = window.localStorage.getItem(CONSENT_KEY);
    } catch (err) {
      useMemory = true;
      return validConsent(memoryConsent);
    }
    if (!raw) return null;
    try {
      return validConsent(JSON.parse(raw));
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
    memoryConsent = consent;
    try {
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    } catch (err) {
      useMemory = true; // storage blocked or full: never let an older stored choice override this one
    }
    return consent;
  };

  const analyticsAllowed = () => {
    const consent = readConsent();
    return !!(consent && consent.analytics);
  };

  /* Analytics gate.
     Withdrawing consent must stop Google Analytics at once: in this tab, in other open tabs and in
     pages restored from the back/forward cache, including events the running tag has already queued.
     The ga-disable flag, Consent Mode and removing the script do not achieve this on their own (queued
     hits were observed being sent seconds after withdrawal), so every Analytics request and cookie
     write is checked against the stored choice at the moment it happens and dropped without consent.
     Installed just before the Google tag is loaded; pages without consent never load the tag. */
  const GA_HOSTS = /(^|\.)(google-analytics\.com|analytics\.google\.com|googletagmanager\.com|doubleclick\.net)$/i;
  const GA_COOKIE = /^_g(a|id)/; // _ga, _ga_<id>, _gat, _gac_*, _gid
  let syncQueued = false;

  const isAnalyticsUrl = (url) => {
    try {
      const u = new URL(String(url), window.location.href);
      return GA_HOSTS.test(u.hostname) ||
        (/(^|\.)google\.[a-z.]+$/i.test(u.hostname) && /^\/(g|ccm|pagead|measurement)\//.test(u.pathname));
    } catch (err) {
      return false;
    }
  };

  const blocked = (url) => {
    if (!isAnalyticsUrl(url) || analyticsAllowed()) return false;
    if (!syncQueued) { // let the page catch up with a choice made elsewhere (or an expired one)
      syncQueued = true;
      window.setTimeout(() => { syncQueued = false; syncConsent(); }, 0);
    }
    return true;
  };

  let gateInstalled = false;
  const installGate = () => {
    if (gateInstalled) return;
    gateInstalled = true;

    const nav = window.navigator;
    if (nav && typeof nav.sendBeacon === 'function') {
      const sendBeacon = nav.sendBeacon;
      nav.sendBeacon = function (url) {
        return blocked(url) ? true : sendBeacon.apply(nav, arguments);
      };
    }

    if (typeof window.fetch === 'function') {
      const fetchFn = window.fetch;
      window.fetch = function (input) {
        const url = input && typeof input === 'object' && 'url' in input ? input.url : input;
        if (blocked(url)) return Promise.resolve(new Response(null, { status: 204 }));
        return fetchFn.apply(window, arguments);
      };
    }

    const xhr = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (xhr) {
      const gaRequests = new WeakSet();
      const open = xhr.open;
      const send = xhr.send;
      xhr.open = function (method, url) {
        if (isAnalyticsUrl(url)) gaRequests.add(this);
        else gaRequests.delete(this);
        return open.apply(this, arguments);
      };
      xhr.send = function () {
        if (gaRequests.has(this) && !analyticsAllowed()) return undefined;
        return send.apply(this, arguments);
      };
    }

    // Image pixels, scripts and frames pointing at Analytics endpoints.
    const guardSrc = (proto) => {
      const d = proto && Object.getOwnPropertyDescriptor(proto, 'src');
      if (!d || !d.set || !d.configurable) return;
      Object.defineProperty(proto, 'src', {
        configurable: true,
        enumerable: d.enumerable,
        get: d.get,
        set(value) { if (!blocked(value)) d.set.call(this, value); }
      });
    };
    [window.HTMLImageElement, window.HTMLScriptElement, window.HTMLIFrameElement].forEach((C) => guardSrc(C && C.prototype));
    const setAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if (String(name).toLowerCase() === 'src' && /^(IMG|SCRIPT|IFRAME)$/.test(this.tagName) && blocked(value)) return undefined;
      return setAttr.apply(this, arguments);
    };

    // Analytics cookies cannot be (re)created without consent; deleting them is always allowed.
    const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    if (cookie && cookie.set && cookie.configurable) {
      Object.defineProperty(Document.prototype, 'cookie', {
        configurable: true,
        enumerable: cookie.enumerable,
        get: cookie.get,
        set(value) {
          const text = String(value);
          const eq = text.indexOf('=');
          const name = (eq < 0 ? text : text.slice(0, eq)).trim();
          const val = eq < 0 ? '' : text.slice(eq + 1).split(';')[0].trim();
          if (GA_COOKIE.test(name) && val && !analyticsAllowed()) return;
          cookie.set.call(this, value);
        }
      });
    }
  };

  const loadAnalytics = () => {
    window['ga-disable-' + GA_MEASUREMENT_ID] = false;

    if (window.__nxtrAnalyticsLoaded) {
      if (typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: 'granted' });
      return;
    }
    window.__nxtrAnalyticsLoaded = true;
    installGate();

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

  // The state this page has applied: 'granted', 'denied' or null (no valid choice).
  let applied;
  const stateOf = (consent) => (consent ? (consent.analytics ? 'granted' : 'denied') : null);

  let expiryTimer = null;
  const applyConsent = (consent) => {
    applied = stateOf(consent);
    window.clearTimeout(expiryTimer);
    if (applied === 'granted') {
      loadAnalytics();
      // Consent that expires while the page is open stops Analytics at that moment.
      const left = typeof consent.timestamp === 'number' ? consent.timestamp + CONSENT_MAX_AGE_MS - Date.now() : Infinity;
      if (left < 2147483647) expiryTimer = window.setTimeout(syncConsent, Math.max(0, left) + 50);
    } else {
      disableAnalytics();
    }
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

  // Follow a choice made, withdrawn, cleared or expired elsewhere (another tab, or while this page
  // was in the background or the back/forward cache), and keep the visible controls consistent.
  function syncConsent() {
    const consent = readConsent();
    if (stateOf(consent) === applied) return;
    applyConsent(consent);
    if (!consent) {
      if (banner.hidden) openBanner(false, null);
    } else if (!banner.hidden) {
      if (prefs.hidden) closeBanner();
      else analyticsToggle.checked = !!consent.analytics;
    }
  }

  window.addEventListener('storage', (e) => {
    if (e.key === CONSENT_KEY || e.key === null) syncConsent();
  });
  window.addEventListener('pageshow', (e) => { if (e.persisted) syncConsent(); });
  window.addEventListener('focus', syncConsent);
  doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') syncConsent(); });
  doc.addEventListener('resume', syncConsent); // page unfrozen by the browser

  const existing = readConsent();
  applyConsent(existing); // without a valid choice this also clears leftover Analytics cookies
  if (!existing) openBanner(false, null);
})();
