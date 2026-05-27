import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { readFileSync, existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { randomUUID, timingSafeEqual, scryptSync } from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.DEEPSEEK_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || randomUUID();
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH;
const ADMIN_PASS_SALT = process.env.ADMIN_PASS_SALT;
const TELEMETRY_FILE = './data/telemetry.json';
const DB_PATH = './data/telemetry.db';
const CTX_PATH = './data/context.txt';

if (!ADMIN_USER || !ADMIN_PASS_HASH || !ADMIN_PASS_SALT) {
  console.error('[FATAL] ADMIN_USER, ADMIN_PASS_HASH y ADMIN_PASS_SALT deben definirse en .env');
  process.exit(1);
}
if (!process.env.DEEPSEEK_API_KEY) {
  console.error('[FATAL] DEEPSEEK_API_KEY debe definirse en .env');
  process.exit(1);
}

if (!existsSync('./data')) mkdirSync('./data', { recursive: true });

// ── SQLite ──
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS visitors (
    hash TEXT PRIMARY KEY,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    visit_count INTEGER DEFAULT 1,
    first_coords TEXT,
    last_coords TEXT,
    first_ip TEXT,
    last_ip TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    visitor_hash TEXT NOT NULL REFERENCES visitors(hash),
    timestamp TEXT NOT NULL,
    ip TEXT,
    isp TEXT,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON sessions(visitor_hash);
  CREATE INDEX IF NOT EXISTS idx_sessions_ts ON sessions(timestamp);
`);

const insertVisitor = db.prepare(`INSERT INTO visitors (hash, first_seen, last_seen, visit_count, first_coords, last_coords, first_ip, last_ip) VALUES (@hash, @ts, @ts, 1, @coordsStr, @coordsStr, @ip, @ip) ON CONFLICT(hash) DO UPDATE SET last_seen=@ts, visit_count=visit_count+1, last_coords=@coordsStr, last_ip=@ip`);
const insertSession = db.prepare(`INSERT INTO sessions (id, visitor_hash, timestamp, ip, isp, data) VALUES (@id, @visitorHash, @timestamp, @ip, @isp, @data)`);

// ── Migrar telemetry.json legacy a SQLite ──
if (existsSync(TELEMETRY_FILE)) {
  try {
    const legacy = JSON.parse(readFileSync(TELEMETRY_FILE, 'utf-8'));
    if (Array.isArray(legacy) && legacy.length > 0) {
      const migrate = db.transaction(() => {
        for (const entry of legacy) {
          const h = 'legacy_' + (entry.fingerprint || entry.id || randomUUID());
          const coordsStr = entry.coords ? JSON.stringify(entry.coords) : null;
          insertVisitor.run({ hash: h, ts: entry.timestamp, coordsStr: coordsStr, ip: entry.ip || null });
          insertSession.run({ id: entry.id || randomUUID(), visitorHash: h, timestamp: entry.timestamp, ip: entry.ip || null, isp: entry.isp || null, data: JSON.stringify(entry) });
        }
      });
      migrate();
      console.log('[DB] Migrated ' + legacy.length + ' legacy entries');
    }
    // Backup y remover JSON
    const bak = TELEMETRY_FILE + '.bak';
    if (!existsSync(bak)) writeFileSync(bak, readFileSync(TELEMETRY_FILE));
    unlinkSync(TELEMETRY_FILE);
  } catch (e) { console.error('[DB] Migration error:', e.message); }
}

// ── Middleware ──
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(express.static('.', { setHeaders: (res, path) => { if (path.endsWith('.html')) res.set('Cache-Control', 'no-store'); } }));

// ── Rate limiters ──
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'Too many requests. Slow down.' }, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: 'Too many login attempts. Try again later.' }, standardHeaders: true, legacyHeaders: false });
const telemetryLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: 'Too many requests.' }, standardHeaders: true, legacyHeaders: false });

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"'/]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' })[c] || c);
}

function authRequired(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.admin = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.clearCookie('token'); return res.status(401).json({ error: 'Session expired' }); }
}

const blockedIPs = new Set();
export function isBlocked(ip) { return blockedIPs.has(ip); }

// ── Funciones helper telemetría ──
function processTelemetryEvent(event, clientIp) {
  const ts = event.timestamp || new Date().toISOString();
  const ip = event.ip || clientIp;
  const isp = event.isp || null;
  const coords = event.coords || null;
  const coordsStr = coords ? JSON.stringify(coords) : null;
  const vid = event.visitorHash || ('anon_' + randomUUID());

  insertVisitor.run({ hash: vid, ts, coordsStr, ip });
  insertSession.run({ id: event.sessionId || randomUUID(), visitorHash: vid, timestamp: ts, ip, isp, data: JSON.stringify(event) });
  return vid;
}

function sessionToRow(s) {
  const d = (() => { try { return JSON.parse(s.data); } catch { return {}; } })();
  return {
    id: s.id, visitorHash: s.visitor_hash, timestamp: s.timestamp,
    ip: s.ip, isp: s.isp,
    coords: d.coords || null,
    userAgent: d.userAgent || null, platform: d.platform || null,
    language: d.language || null, languages: d.languages || null,
    hardwareConcurrency: d.hardwareConcurrency || null, deviceMemory: d.deviceMemory || null,
    screenWidth: d.screenWidth || null, screenHeight: d.screenHeight || null,
    colorDepth: d.colorDepth || null, devicePixelRatio: d.devicePixelRatio || null,
    connectionType: d.connectionType || null, downlink: d.downlink || null, rtt: d.rtt || null,
    referrer: d.referrer || null,
    utmSource: d.utmSource || null, utmMedium: d.utmMedium || null, utmCampaign: d.utmCampaign || null,
    timezone: d.timezone || null, timezoneOffset: d.timezoneOffset || null,
    maxScrollDepth: d.maxScrollDepth || 0, clicks: d.clicks || 0,
    timeOnPage: d.timeOnPage || 0, pageLoadTime: d.pageLoadTime || null,
    webglRenderer: d.webglRenderer || null, webglVendor: d.webglVendor || null,
    url: d.url || null, path: d.path || null, title: d.title || null,
    batteryLevel: d.batteryLevel || null, batteryCharging: d.batteryCharging || null,
    sessionCount: d.sessionCount || null
  };
}

// ── Rutas ──

app.get('/', (req, res) => res.sendFile('onix_racing.html', { root: '.' }));
app.get('/admin', (req, res) => res.sendFile('admin.html', { root: '.' }));

// --- Batch telemetry (nuevo tracker) ---
app.post('/api/telemetry/batch', telemetryLimiter, (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) return res.status(400).json({ error: 'events array required' });
    const clientIp = req.ip || req.connection?.remoteAddress;

    for (const ev of events) {
      if (ev.honeypot) {
        blockedIPs.add(clientIp);
        console.warn('[HONEYPOT] Bot blocked: ' + clientIp);
        return res.json({ blocked: true });
      }
    }

    const txn = db.transaction(() => {
      for (const ev of events) processTelemetryEvent(ev, clientIp);
    });
    txn();

    const last = events[events.length - 1];
    res.json({ ok: true, visitorHash: last?.visitorHash || null });
  } catch (err) {
    console.error('[BATCH]', err);
    res.status(500).json({ error: 'Batch error' });
  }
});

// --- Legacy single telemetry (mantenido para compatibilidad) ---
app.post('/api/telemetry', chatLimiter, (req, res) => {
  try {
    const { coords, ip: clientIP, isp, ua, fingerprint, termsAccepted } = req.body;
    const honeypot = req.body.honeypot;
    if (honeypot) {
      const ip = req.ip || req.connection?.remoteAddress;
      blockedIPs.add(ip);
      console.warn('[HONEYPOT] Bot blocked: ' + ip);
      return res.json({ blocked: true });
    }
    if (!termsAccepted) return res.status(400).json({ error: 'Terms not accepted' });

    const event = {
      sessionId: randomUUID(), timestamp: new Date().toISOString(),
      coords: coords || null, ip: clientIP || req.ip, isp: isp || null,
      userAgent: ua || null, fingerprint: fingerprint || null,
      visitorHash: fingerprint ? ('canvas_' + fingerprint) : ('anon_' + randomUUID().substring(0, 8))
    };

    const txn = db.transaction(() => processTelemetryEvent(event, req.ip));
    txn();

    res.json({ ok: true });
  } catch (err) {
    console.error('[TELEMETRY]', err);
    res.status(500).json({ error: 'Telemetry error' });
  }
});

// --- Admin login ---
app.post('/api/admin/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Invalid input' });
  const passHash = scryptSync(password, ADMIN_PASS_SALT, 64).toString('hex');
  const userMatch = timingSafeEqual
    ? (() => {
        const u1 = Buffer.from(username); const u2 = Buffer.from(ADMIN_USER);
        const p1 = Buffer.from(passHash); const p2 = Buffer.from(ADMIN_PASS_HASH);
        return u1.length === u2.length && p1.length === p2.length && timingSafeEqual(u1, u2) && timingSafeEqual(p1, p2);
      })()
    : username === ADMIN_USER && passHash === ADMIN_PASS_HASH;
  if (!userMatch) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ user: ADMIN_USER, role: 'admin' }, JWT_SECRET, { expiresIn: '4h' });
  res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 4 * 60 * 60 * 1000 });
  res.json({ ok: true });
});

// --- Admin logout ---
app.post('/api/admin/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

// --- Stats ---
app.get('/api/admin/stats', authRequired, (req, res) => {
  try {
    const totalVisitors = db.prepare('SELECT COUNT(*) as c FROM visitors').get().c;
    const totalSessions = db.prepare('SELECT COUNT(*) as c FROM sessions').get().c;
    const today = new Date().toISOString().substring(0, 10);
    const visitorsToday = db.prepare("SELECT COUNT(DISTINCT visitor_hash) as c FROM sessions WHERE timestamp >= ?").get(today).c;
    const sessionsToday = db.prepare("SELECT COUNT(*) as c FROM sessions WHERE timestamp >= ?").get(today).c;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10);
    const visitorsWeek = db.prepare("SELECT COUNT(DISTINCT visitor_hash) as c FROM sessions WHERE timestamp >= ?").get(weekAgo).c;

    const sessionsByDay = db.prepare("SELECT substr(timestamp,1,10) as day, COUNT(*) as count FROM sessions WHERE timestamp >= ? GROUP BY day ORDER BY day").all(weekAgo);

    const browsers = db.prepare("SELECT json_extract(data, '$.userAgent') as val, COUNT(*) as count FROM sessions WHERE json_extract(data, '$.userAgent') IS NOT NULL GROUP BY val ORDER BY count DESC LIMIT 10").all();
    const platforms = db.prepare("SELECT json_extract(data, '$.platform') as val, COUNT(*) as count FROM sessions WHERE json_extract(data, '$.platform') IS NOT NULL GROUP BY val ORDER BY count DESC LIMIT 10").all();
    const languages = db.prepare("SELECT json_extract(data, '$.language') as val, COUNT(*) as count FROM sessions WHERE json_extract(data, '$.language') IS NOT NULL GROUP BY val ORDER BY count DESC LIMIT 10").all();
    const connections = db.prepare("SELECT json_extract(data, '$.connectionType') as val, COUNT(*) as count FROM sessions WHERE json_extract(data, '$.connectionType') IS NOT NULL GROUP BY val ORDER BY count DESC LIMIT 10").all();

    res.json({ totalVisitors, totalSessions, visitorsToday, sessionsToday, visitorsWeek, sessionsByDay, browsers, platforms, languages, connections });
  } catch (err) { console.error('[STATS]', err); res.status(500).json({ error: 'Stats error' }); }
});

// --- Geo ---
app.get('/api/admin/geo', authRequired, (req, res) => {
  try {
    const rows = db.prepare("SELECT visitor_hash, timestamp, json_extract(data, '$.coords') as coords FROM sessions WHERE json_extract(data, '$.coords') IS NOT NULL AND json_extract(data, '$.coords.lat') IS NOT NULL").all();
    const points = rows.map(r => { try { return { ...JSON.parse(r.coords), visitorHash: r.visitor_hash, timestamp: r.timestamp }; } catch { return null; } }).filter(Boolean);
    res.json(points);
  } catch (err) { console.error('[GEO]', err); res.status(500).json({ error: 'Geo error' }); }
});

// --- Visitors ---
app.get('/api/admin/visitors', authRequired, (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;
    let query = 'SELECT * FROM visitors';
    const params = [];
    if (search) { query += ' WHERE hash LIKE ?'; params.push('%' + search + '%'); }
    query += ' ORDER BY last_seen DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const rows = db.prepare(query).all(...params);
    const total = db.prepare(search ? 'SELECT COUNT(*) as c FROM visitors WHERE hash LIKE ?' : 'SELECT COUNT(*) as c FROM visitors').get(search ? ('%' + search + '%') : undefined)?.c || 0;
    res.json({ data: rows, total, offset: parseInt(offset), limit: parseInt(limit) });
  } catch (err) { console.error('[VISITORS]', err); res.status(500).json({ error: 'Visitors error' }); }
});

// --- Sessions ---
app.get('/api/admin/sessions', authRequired, (req, res) => {
  try {
    const { limit = 50, offset = 0, ip, dateFrom, dateTo, visitorHash } = req.query;
    let query = 'SELECT * FROM sessions WHERE 1=1';
    const params = [];
    if (ip) { query += ' AND ip LIKE ?'; params.push('%' + ip + '%'); }
    if (dateFrom) { query += ' AND timestamp >= ?'; params.push(dateFrom); }
    if (dateTo) { query += ' AND timestamp <= ?'; params.push(dateTo + 'T23:59:59'); }
    if (visitorHash) { query += ' AND visitor_hash = ?'; params.push(visitorHash); }
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as c');
    const total = db.prepare(countQuery).get(...params)?.c || 0;
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const rows = db.prepare(query).all(...params).map(sessionToRow);
    res.json({ data: rows, total, offset: parseInt(offset), limit: parseInt(limit) });
  } catch (err) { console.error('[SESSIONS]', err); res.status(500).json({ error: 'Sessions error' }); }
});

// --- Legacy sessions endpoint (compatibilidad) ---
app.get('/api/admin/telemetry', authRequired, (req, res) => {
  const { ip, dateFrom, dateTo, limit = 100, offset = 0 } = req.query;
  let query = 'SELECT * FROM sessions WHERE 1=1';
  const params = [];
  if (ip) { query += ' AND ip LIKE ?'; params.push('%' + ip + '%'); }
  if (dateFrom) { query += ' AND timestamp >= ?'; params.push(dateFrom); }
  if (dateTo) { query += ' AND timestamp <= ?'; params.push(dateTo + 'T23:59:59'); }
  const total = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as c')).get(...params)?.c || 0;
  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  const rows = db.prepare(query).all(...params).map(sessionToRow).map(e => ({
    id: e.id, timestamp: e.timestamp, ip: sanitize(e.ip || ''), isp: sanitize(e.isp || ''),
    coords: e.coords, userAgent: e.userAgent, fingerprint: null
  }));
  res.json({ data: rows, total, offset: parseInt(offset), limit: parseInt(limit) });
});

// --- Export CSV ---
app.get('/api/admin/export/csv', authRequired, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM sessions ORDER BY timestamp DESC').all().map(sessionToRow);
    const headers = ['id', 'timestamp', 'ip', 'isp', 'visitorHash', 'url', 'path', 'referrer', 'language', 'platform', 'hardwareConcurrency', 'deviceMemory', 'screenWidth', 'screenHeight', 'connectionType', 'downlink', 'rtt', 'timezone', 'maxScrollDepth', 'clicks', 'timeOnPage', 'coords.lat', 'coords.lng'];
    let csv = headers.join(',') + '\n';
    for (const r of rows) {
      const row = [
        r.id, r.timestamp, r.ip, r.isp, r.visitorHash, r.url, r.path, r.referrer,
        r.language, r.platform, r.hardwareConcurrency, r.deviceMemory,
        r.screenWidth, r.screenHeight, r.connectionType, r.downlink, r.rtt,
        r.timezone, r.maxScrollDepth, r.clicks, r.timeOnPage,
        r.coords?.lat || '', r.coords?.lng || ''
      ].map(v => { const s = String(v || ''); return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s; });
      csv += row.join(',') + '\n';
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=onix_telemetry.csv');
    res.send(csv);
  } catch (err) { console.error('[CSV]', err); res.status(500).json({ error: 'Export error' }); }
});

// --- Export JSON ---
app.get('/api/admin/export/json', authRequired, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM sessions ORDER BY timestamp DESC').all().map(sessionToRow);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=onix_telemetry.json');
    res.json(rows);
  } catch (err) { console.error('[JSON]', err); res.status(500).json({ error: 'Export error' }); }
});

// --- Chat ---
function getContext() { try { return existsSync(CTX_PATH) ? readFileSync(CTX_PATH, 'utf-8') : ''; } catch { return ''; } }

app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    let { message, lang } = req.body;
    const ip = req.ip || req.connection?.remoteAddress;
    if (isBlocked(ip)) return res.status(403).json({ error: 'Access denied' });
    message = sanitize(message);
    if (!message) return res.status(400).json({ error: 'message required' });
    if (message.length > 2000) return res.status(400).json({ error: 'Message too long' });
    const teamContext = getContext();
    const systemMsg = { role: 'system', content: 'Eres ONIX AI, asistente de STEM Racing Costa Rica E03. Tu única base de conocimiento es el texto a continuación. Responde de forma perfecta, directa y muy concisa (máximo 3 oraciones). Idioma de respuesta: ' + (lang || 'en') + '. Contexto:\n\n' + teamContext };
    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [systemMsg, { role: 'user', content: message }], max_tokens: 150, temperature: 0.2 })
    });
    if (!deepseekRes.ok) { const errText = await deepseekRes.text(); console.error('DeepSeek error:', deepseekRes.status, errText); return res.status(502).json({ error: 'Upstream API error' }); }
    const data = await deepseekRes.json();
    res.json({ reply: data.choices[0].message.content });
  } catch (err) { console.error('Chat error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── 404 ──
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log('ONIX backend running at http://localhost:' + PORT);
  console.log('Admin: http://localhost:' + PORT + '/admin');
});
