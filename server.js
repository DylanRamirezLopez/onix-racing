import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.DEEPSEEK_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || randomUUID();
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const TELEMETRY_FILE = './data/telemetry.json';
const CTX_PATH = './data/context.txt';

// ── Validar variables de entorno requeridas ──
if (!ADMIN_USER || !ADMIN_PASS) {
  console.error('[FATAL] ADMIN_USER y ADMIN_PASS deben definirse en .env');
  process.exit(1);
}
if (!process.env.DEEPSEEK_API_KEY) {
  console.error('[FATAL] DEEPSEEK_API_KEY debe definirse en .env');
  process.exit(1);
}

// ── Inicializar telemetría ──
if (!existsSync('./data')) mkdirSync('./data', { recursive: true });
if (!existsSync(TELEMETRY_FILE)) writeFileSync(TELEMETRY_FILE, '[]', 'utf-8');

// ── Middleware globales ──
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(express.static('.', { setHeaders: (res, path) => { if (path.endsWith('.html')) res.set('Cache-Control', 'no-store'); } }));

// ── Rate limiting ──
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  message: { error: 'Too many requests. Slow down.' },
  standardHeaders: true, legacyHeaders: false
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  message: { error: 'Too many login attempts. Try again later.' },
  standardHeaders: true, legacyHeaders: false
});

// ── Sanitización de entrada ──
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"'/]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;'
  })[c] || c);
}

// ── Admin JWT middleware ──
function authRequired(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Session expired' });
  }
}

// ── Telemetría helpers ──
function readTelemetry() {
  try { return JSON.parse(readFileSync(TELEMETRY_FILE, 'utf-8')); }
  catch { return []; }
}
function writeTelemetry(data) {
  writeFileSync(TELEMETRY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Honeypot set (rosters de IPs bloqueadas) ──
const blockedIPs = new Set();
export function isBlocked(ip) { return blockedIPs.has(ip); }

// ── Rutas ──

app.get('/', (req, res) => res.sendFile('onix_racing.html', { root: '.' }));
app.get('/admin', (req, res) => res.sendFile('admin.html', { root: '.' }));

// Telemetry
app.post('/api/telemetry', chatLimiter, (req, res) => {
  try {
    const { coords, ip: clientIP, isp, ua, fingerprint, termsAccepted } = req.body;
    const honeypot = req.body.honeypot;

    // Bloquear si honeypot fue llenado (bot)
    if (honeypot) {
      const ip = req.ip || req.connection?.remoteAddress;
      blockedIPs.add(ip);
      console.warn(`[HONEYPOT] Bot blocked: ${ip}`);
      return res.json({ blocked: true });
    }

    if (!termsAccepted) return res.status(400).json({ error: 'Terms not accepted' });

    const entry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      coords: coords || null,
      ip: clientIP || req.ip,
      isp: isp || null,
      userAgent: ua || null,
      fingerprint: fingerprint || null,
      honeypot: false
    };
    const data = readTelemetry();
    data.push(entry);
    writeTelemetry(data);
    res.json({ ok: true });
  } catch (err) {
    console.error('[TELEMETRY]', err);
    res.status(500).json({ error: 'Telemetry error' });
  }
});

// Admin login
app.post('/api/admin/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  const userMatch = timingSafeEqual
    ? (() => {
        const u1 = Buffer.from(username || '');
        const u2 = Buffer.from(ADMIN_USER);
        const p1 = Buffer.from(password || '');
        const p2 = Buffer.from(ADMIN_PASS);
        return u1.length === u2.length && p1.length === p2.length
          && timingSafeEqual(u1, u2) && timingSafeEqual(p1, p2);
      })()
    : username === ADMIN_USER && password === ADMIN_PASS;

  if (!userMatch) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ user: ADMIN_USER, role: 'admin' }, JWT_SECRET, { expiresIn: '4h' });
  res.cookie('token', token, {
    httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 4 * 60 * 60 * 1000
  });
  res.json({ ok: true });
});

// Admin telemetry fetch
app.get('/api/admin/telemetry', authRequired, (req, res) => {
  const { ip, dateFrom, dateTo, limit = 100, offset = 0 } = req.query;
  let data = readTelemetry();
  if (ip) data = data.filter(e => e.ip && e.ip.includes(ip));
  if (dateFrom) data = data.filter(e => e.timestamp >= dateFrom);
  if (dateTo) data = data.filter(e => e.timestamp <= dateTo);
  data.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const total = data.length;
  const page = data.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  res.json({ data: page, total, offset: parseInt(offset), limit: parseInt(limit) });
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// Context
function getContext() {
  try { return existsSync(CTX_PATH) ? readFileSync(CTX_PATH, 'utf-8') : ''; }
  catch { return ''; }
}

// Chat — protegido con rate limit + sanitización
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    let { message, lang } = req.body;
    const ip = req.ip || req.connection?.remoteAddress;
    if (isBlocked(ip)) return res.status(403).json({ error: 'Access denied' });

    message = sanitize(message);
    if (!message) return res.status(400).json({ error: 'message required' });
    if (message.length > 2000) return res.status(400).json({ error: 'Message too long' });

    const teamContext = getContext();
    const systemMsg = {
      role: 'system',
      content: 'Eres ONIX AI, asistente de STEM Racing Costa Rica E03. Tu única base de conocimiento es el texto a continuación. Responde de forma perfecta, directa y muy concisa (máximo 3 oraciones). Idioma de respuesta: ' + (lang || 'en') + '. Contexto:\n\n' + teamContext
    };

    const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [systemMsg, { role: 'user', content: message }],
        max_tokens: 150,
        temperature: 0.2
      })
    });
    if (!deepseekRes.ok) {
      const errText = await deepseekRes.text();
      console.error('DeepSeek error:', deepseekRes.status, errText);
      return res.status(502).json({ error: 'Upstream API error' });
    }
    const data = await deepseekRes.json();
    res.json({ reply: data.choices[0].message.content });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── 404 ──
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log('ONIX backend running at http://localhost:' + PORT);
  console.log('Admin: http://localhost:' + PORT + '/admin');
});
