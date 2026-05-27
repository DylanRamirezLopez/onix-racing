# 🏎️ ONIX Racing E03 — Web Oficial + AI Chatbot

**STEM Racing Costa Rica · Supported by Honda**

[![Live Site](https://img.shields.io/badge/🌐-Sitio%20Online-411145?style=for-the-badge)](https://onix-racing.onrender.com)
[![Admin Panel](https://img.shields.io/badge/🔐-Admin%20Panel-FC0195?style=for-the-badge)](https://onix-racing.onrender.com/admin)

---

## 🚀 Funcionalidades

### 🌐 Página Web Premium
- Hero animado con carrusel de imágenes del auto E03
- Sección de identidad del equipo (logo, colores, símbolos)
- Galería del auto con vistas frontal, lateral y trasera
- Video cinemático con reproducción automática al scrollear
- Estadísticas animadas (recaudación, sponsors, vistas)
- Equipo completo con roles y miembros
- Patrocinadores oficiales (Honda, Coopecoceic, +10)
- Misión, valores y métricas de sostenibilidad
- Diseño responsive mobile-first con menú hamburguesa
- Animaciones suaves con Intersection Observer
- Cambio de idioma EN/ES

### 🤖 Chatbot IA con DeepSeek
- Asistente ONIX AI entrenado con contexto del equipo
- Responde sobre: el auto E03, miembros, sponsors, eventos
- System prompt optimizado con respuesta máxima de 3 oraciones
- Historial de chat con los últimos mensajes
- Soporte bilingüe inglés/español
- Sugerencias rápidas (quick chips)
- Indicador de escritura

### 📡 Sistema de Telemetría
- Captura de geolocalización (coordenadas GPS)
- Huella digital del navegador (Canvas fingerprint)
- User-Agent, sistema operativo y dispositivo
- Dirección IP pública e ISP
- Almacenamiento en base de datos aislada
- Anti-bot con campo honeypot oculto

### 🔐 Panel de Administración
- Ruta protegida: `/admin`
- Autenticación con JWT + cookie HttpOnly
- Tabla de telemetría con filtros por IP y fecha
- Paginación de datos
- Logo de acceso rápido en el footer

### 🛡️ Seguridad
- Rate limiting en API del chat y login admin
- Sanitización de entradas (XSS + inyección)
- Helmet HTTP headers
- Honeypot anti-bots
- Límite de caracteres por mensaje (2000)
- API Key de DeepSeek del lado del servidor (nunca expuesta)

---

## 🛠 Stack Técnico

| Componente | Tecnología |
|---|---|
| **Frontend** | HTML5, CSS3, JavaScript vanilla |
| **Backend** | Node.js + Express |
| **API IA** | DeepSeek Chat (deepseek-chat) |
| **Auth Admin** | JWT + HttpOnly cookies |
| **Rate Limiting** | express-rate-limit |
| **Seguridad** | Helmet, sanitización XSS |
| **Telemetría** | GPS API, Canvas FP, ipapi.co |
| **Hosting** | Render (auto-deploy desde GitHub) |

---

## 📦 Repositorio

```
https://github.com/DylanRamirezLopez/onix-racing
```

> Proyecto desarrollado para STEM Racing Costa Rica E03 · Equipo ONIX
