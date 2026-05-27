# ONIX Racing — AI Chatbot

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/DylanRamirezLopez/onix-racing)

## Stack
- **Backend:** Node.js + Express (proxy seguro para DeepSeek API)
- **Frontend:** HTML/CSS vanilla con diseño premium responsive
- **Seguridad:** Rate limiting, JWT HttpOnly, Honeypot anti-bots, Helmet headers
- **Telemetría:** Geolocalización, Canvas fingerprint, User-Agent, IP/ISP
- **Admin:** `/admin` — dashboard con tabla de telemetría filtrable

## Deploy rápido (Render)

1. Crear cuenta gratis en https://render.com
2. Click botón "Deploy to Render" de arriba
3. Agregar variable de entorno: `DEEPSEEK_API_KEY`
4. Esperar 2-3 minutos

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DEEPSEEK_API_KEY` | ✅ | API key de DeepSeek |
| `ADMIN_USER` | ❌ | Usuario admin (default: admin) |
| `ADMIN_PASS` | ❌ | Password admin (default: changeme) |
| `JWT_SECRET` | ❌ | Secreto JWT (auto-generado) |
