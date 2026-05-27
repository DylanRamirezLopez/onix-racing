(function () {
  'use strict';

  let maxScroll = 0, clickCount = 0;

  function getConnection() {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return null;
    return { effectiveType: c.effectiveType, downlink: c.downlink, rtt: c.rtt, saveData: c.saveData };
  }

  function getUTM() {
    const p = new URLSearchParams(window.location.search);
    return { source: p.get('utm_source'), medium: p.get('utm_medium'), campaign: p.get('utm_campaign'), term: p.get('utm_term'), content: p.get('utm_content') };
  }

  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function getCanvasFingerprint() {
    const c = document.createElement('canvas'); c.width = 280; c.height = 100;
    const ctx = c.getContext('2d');
    ctx.textBaseline = 'top'; ctx.font = '18px Arial';
    ctx.fillStyle = '#f60'; ctx.fillRect(50, 1, 100, 40);
    ctx.fillStyle = '#069'; ctx.fillText('ONIX' + navigator.userAgent + screen.width + screen.height + screen.colorDepth, 2, 15);
    ctx.font = '16px Georgia'; ctx.fillStyle = 'rgba(102,204,0,0.7)'; ctx.fillText('fp', 80, 45);
    return c.toDataURL();
  }

  function getWebGLInfo() {
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      if (!gl) return null;
      return { renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR) };
    } catch { return null; }
  }

  function getAudioFingerprint() {
    try {
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = actx.createOscillator(); const a = actx.createAnalyser();
      osc.connect(a); const buf = new Float32Array(a.frequencyBinCount);
      a.getFloatFrequencyData(buf); actx.close();
      return Array.from(buf.slice(0, 5)).map(v => v.toFixed(1)).join(',');
    } catch { return null; }
  }

  async function getFingerprintHash() {
    const parts = [getCanvasFingerprint(), getAudioFingerprint() || '', JSON.stringify(getWebGLInfo() || {}), navigator.platform, navigator.language, screen.width, screen.height, screen.colorDepth];
    return await sha256(parts.join('||'));
  }

  async function getBatteryInfo() {
    try { const b = await navigator.getBattery(); return { level: b.level, charging: b.charging }; }
    catch { return null; }
  }

  async function getLocation() {
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }));
      return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, altitude: pos.coords.altitude, altitudeAccuracy: pos.coords.altitudeAccuracy, heading: pos.coords.heading, speed: pos.coords.speed };
    } catch { return null; }
  }

  window.addEventListener('scroll', () => {
    const pct = Math.min(100, Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100));
    if (pct > maxScroll) maxScroll = pct;
  }, { passive: true });

  document.addEventListener('click', () => clickCount++);

  async function collect() {
    const now = Date.now();
    const perf = performance.getEntriesByType('navigation')[0];
    const conn = getConnection(); const utm = getUTM(); const webgl = getWebGLInfo();

    const hp = document.getElementById('honeypot');
    return {
      sessionId: crypto.randomUUID(),
      honeypot: hp ? hp.value : '',
      timestamp: new Date(now).toISOString(),
      timeOnPage: Math.round(performance.now()),
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      utmSource: utm.source, utmMedium: utm.medium, utmCampaign: utm.campaign, utmTerm: utm.term, utmContent: utm.content,
      userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language, languages: navigator.languages.join(','),
      hardwareConcurrency: navigator.hardwareConcurrency, deviceMemory: navigator.deviceMemory, cookieEnabled: navigator.cookieEnabled, doNotTrack: navigator.doNotTrack,
      screenWidth: screen.width, screenHeight: screen.height, colorDepth: screen.colorDepth,
      availWidth: screen.availWidth, availHeight: screen.availHeight, devicePixelRatio: window.devicePixelRatio,
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      connectionType: conn?.effectiveType, downlink: conn?.downlink, rtt: conn?.rtt, saveData: conn?.saveData,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, timezoneOffset: new Date().getTimezoneOffset(),
      maxScrollDepth: maxScroll, clicks: clickCount,
      webglRenderer: webgl?.renderer, webglVendor: webgl?.vendor,
      pageLoadTime: perf ? Math.round(perf.loadEventEnd - perf.fetchStart) : null,
      dnsTime: perf ? Math.round(perf.domainLookupEnd - perf.domainLookupStart) : null,
      tcpTime: perf ? Math.round(perf.connectEnd - perf.connectStart) : null,
      ttfb: perf ? Math.round(perf.responseStart - perf.requestStart) : null
    };
  }

  async function init() {
    let visitorHash = localStorage.getItem('onix_vid');
    let sessionCount = parseInt(localStorage.getItem('onix_sc') || '0');

    if (!visitorHash) {
      visitorHash = await getFingerprintHash();
      try { localStorage.setItem('onix_vid', visitorHash); } catch {}
    }
    sessionCount++;
    try { localStorage.setItem('onix_sc', sessionCount.toString()); } catch {}

    const [data, battery, coords] = await Promise.all([collect(), getBatteryInfo(), getLocation()]);
    data.visitorHash = visitorHash;
    data.sessionCount = sessionCount;
    data.batteryLevel = battery?.level;
    data.batteryCharging = battery?.charging;
    data.coords = coords;

    const payload = { events: [data] };

    fetch('/api/telemetry/batch', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).catch(() => {});

    window.addEventListener('beforeunload', () => {
      data.timeOnPage = Math.round(performance.now());
      data.maxScrollDepth = maxScroll;
      data.clicks = clickCount;
      try { navigator.sendBeacon('/api/telemetry/batch', JSON.stringify({ events: [data] })); } catch {}
    });
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
})();
