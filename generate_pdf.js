import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';

const doc = new PDFDocument({ margin: 50, size: 'A4' });
doc.pipe(createWriteStream('ONIX_Proyecto_Explicacion.pdf'));

// ── Helper ──
function title(text) {
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#411145').text(text, { underline: false });
  doc.moveDown(0.5);
}
function subtitle(text) {
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#FC0195').text(text);
  doc.moveDown(0.3);
}
function bold(text) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a1a').text(text);
  doc.moveDown(0.2);
}
function body(text) {
  doc.font('Helvetica').fontSize(10).fillColor('#333').text(text, { align: 'justify' });
  doc.moveDown(0.4);
}
function bullet(text) {
  doc.font('Helvetica').fontSize(10).fillColor('#333').text('  • ' + text, { indent: 15 });
  doc.moveDown(0.15);
}
function tableRow(col1, col2) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#411145').text(col1, 60, doc.y, { width: 160, continued: true });
  doc.font('Helvetica').fillColor('#333').text(col2, 230, doc.y, { width: 330 });
  doc.moveDown(0.3);
}
function separator() {
  doc.moveDown(0.3);
  doc.fontSize(8).fillColor('#ccc').text('────────────────────────────────────────────────────────────────', { align: 'center' });
  doc.moveDown(0.3);
}

// ── PORTADA ──
doc.font('Helvetica-Bold').fontSize(36).fillColor('#411145').text('ONIX Racing E03', { align: 'center' });
doc.moveDown(0.3);
doc.font('Helvetica').fontSize(16).fillColor('#FC0195').text('Proyecto Web + AI Chatbot', { align: 'center' });
doc.moveDown(0.5);
doc.fontSize(11).fillColor('#666').text('STEM Racing Costa Rica · Supported by Honda', { align: 'center' });
doc.moveDown(1);
doc.fontSize(10).fillColor('#888').text('Documentación completa del proyecto — Explicación para el equipo', { align: 'center' });
doc.moveDown(3);

doc.fontSize(9).fillColor('#aaa').text('Generado: ' + new Date().toLocaleString('es-CR'), { align: 'center' });

doc.addPage();

// ── ÍNDICE ──
title('ÍNDICE');
const items = [
  '1. Estructura General (3 capas)',
  '2. Frontend (lo que se ve)',
  '3. Backend (el cerebro oculto)',
  '4. API de DeepSeek (la IA)',
  '5. Funcionalidades una por una',
  '6. Seguridad',
  '7. File Structure',
  '8. Deploy (cómo está online)',
  '9. Glosario de conceptos clave'
];
items.forEach(i => bullet(i));
doc.addPage();

// ── 1. ESTRUCTURA GENERAL ──
title('1. ESTRUCTURA GENERAL');
body('La página tiene 3 capas que trabajan juntas para que todo funcione:');

subtitle('Capa 1: Frontend (lo que se ve)');
body('Es todo lo que aparece en el navegador cuando alguien entra al link. Incluye el HTML (el esqueleto de la página: textos, imágenes, botones), el CSS (los colores, animaciones, bordes, sombras, diseño responsive) y el JavaScript (todo lo que la página hace cuando interactuás: scrollear, apretar botones, cambiar idioma, reproducir el video, animar números).');
body('El frontend vive en el archivo onix_racing.html. Ahí está TODO: el diseño, los textos, los scripts, los estilos.');

subtitle('Capa 2: Backend (el cerebro oculto)');
body('Es un programa que corre en un servidor en la nube (Render). No se ve, pero hace todo el trabajo pesado: recibe los mensajes del chat y los manda a DeepSeek, guarda la telemetría, maneja el login del admin, limita peticiones para evitar ataques, sanitiza los inputs.');
body('El backend vive en server.js, escrito en Node.js (JavaScript del lado del servidor).');

subtitle('Capa 3: API de DeepSeek (la inteligencia artificial)');
body('DeepSeek es una empresa que tiene un modelo de lenguaje (como ChatGPT pero más barato y técnico). Le mandamos el contexto del equipo (archivo context.txt) más el mensaje del usuario, y DeepSeek devuelve la respuesta. Nosotros no entrenamos nada. Solo le damos contexto y ella responde en base a eso.');

doc.addPage();

// ── 2. FRONTEND ──
title('2. FRONTEND — EXPLICACIÓN DETALLADA');
body('El frontend es todo lo que el usuario ve y con lo que interactúa. Está compuesto por:');

bold('HTML (HyperText Markup Language)');
body('Es el lenguaje de marcado que define la estructura de la página. Cada elemento es una etiqueta: <div> para contenedores, <section> para secciones, <button> para botones, <input> para campos de texto, <video> para videos, <img> para imágenes. El navegador lee el HTML y muestra los elementos en pantalla.');

bold('CSS (Cascading Style Sheets)');
body('Es el lenguaje que le da estilo a la página. Define colores (--onix-purple: #411145), fuentes (Bebas Neue para títulos, Syne para botones), tamaños, animaciones (@keyframes), diseño responsive ( @media queries para adaptarse a celular), efectos de vidrio (backdrop-filter: blur), sombras, bordes, transiciones suaves.');

bold('JavaScript (JS)');
body('Es el lenguaje de programación que hace que la página sea interactiva. Corre en el navegador del usuario. Ejemplos: cuando scrolleás y los elementos aparecen con animación (IntersectionObserver), cuando apretás el botón de idioma y todo cambia a español (toggleLang), cuando las imágenes del auto cambian solas (setInterval), cuando los números suben animados (requestAnimationFrame), cuando escribís en el chat y se envía el mensaje (sendMessage).');

doc.addPage();

// ── 3. BACKEND ──
title('3. BACKEND — EXPLICACIÓN DETALLADA');
body('El backend es un servidor Node.js con Express que corre en Render. No se ve, pero es el cerebro de la operación. Escucha en un puerto (3000) y espera peticiones HTTP.');

bold('Servidor Express');
body('Express es un framework para Node.js que facilita crear rutas (endpoints). Cada ruta es una URL que el frontend llama para hacer algo específico.');

bold('Endpoints del backend');
tableRow('GET /', 'Sirve la página onix_racing.html');
tableRow('GET /admin', 'Sirve el panel admin.html');
tableRow('POST /api/chat', 'Recibe el mensaje, lo manda a DeepSeek, devuelve la respuesta');
tableRow('POST /api/telemetry', 'Recibe datos de telemetría y los guarda en telemetry.json');
tableRow('POST /api/admin/login', 'Verifica usuario/contraseña, devuelve un JWT');
tableRow('GET /api/admin/telemetry', 'Devuelve los datos de telemetría (requiere JWT)');
tableRow('POST /api/admin/logout', 'Elimina la cookie del token');

bold('Middleware');
body('Son funciones que se ejecutan antes de llegar a las rutas. El backend usa: helmet() para headers de seguridad, express.json() para leer JSON, cookieParser() para manejar cookies, rateLimit() para control de peticiones, authRequired() para verificar el JWT del admin.');

doc.addPage();

// ── 4. API DEEPSEEK ──
title('4. API DE DEEPSEEK (la inteligencia artificial)');
body('DeepSeek es un modelo de lenguaje grande (LLM) similar a ChatGPT pero más económico y con buen rendimiento técnico. Su API funciona así:');

bold('Flujo de una conversación:');
bullet('El usuario escribe un mensaje en el chat del frontend');
bullet('El frontend hace un fetch POST a /api/chat con el texto y el idioma');
bullet('El backend recibe el mensaje y construye un system prompt: "Eres ONIX AI, asistente de STEM Racing Costa Rica E03. Responde en máximo 3 oraciones. Idioma: [en/es]. Contexto: [texto de context.txt]"');
bullet('El backend manda el system prompt + el mensaje del usuario a la API de DeepSeek');
bullet('DeepSeek procesa y devuelve la respuesta generada por IA');
bullet('El backend reenvía la respuesta al frontend');
bullet('El frontend muestra la respuesta en la ventana del chat');

bold('Parámetros de configuración:');
tableRow('Modelo', 'deepseek-chat');
tableRow('max_tokens', '150 (respuestas cortas)');
tableRow('temperature', '0.2 (respuestas factuales, ceñidas al contexto)');
tableRow('API Key', 'sk-89d689ff812646be97d3db01c74b3d28 (solo en backend)');

doc.addPage();

// ── 5. FUNCIONALIDADES ──
title('5. FUNCIONALIDADES UNA POR UNA');

subtitle('Página Web');
bold('Hero'); body('La pantalla principal al entrar. Tiene el logo ONIX con gradiente rosa-dorado, el subtítulo "Born from precision...", y dos botones: "Discover the Car" y "Chat with ONIX AI". Tiene animación de entrada (fadeUp).');
bold('Carrusel'); body('Las imágenes del auto E03 que cambian solas cada 4.5 segundos. Hay dos slides con fotos reales del auto en base64. También se puede cambiar manualmente con los dots.');
bold('Marquee'); body('Textos que se mueven horizontalmente infinitamente: PRECISION, SPEED, INNOVATION, TEAMWORK. Usan CSS animation con @keyframes marquee.');
bold('Stats animadas'); body('4 tarjetas con números que suben animados cuando aparecen en pantalla: 6 miembros, ₡854K recaudados, +15 sponsors, 6,296 views. Usan IntersectionObserver + requestAnimationFrame.');
bold('Video cinemático'); body('Un video MP4 (9.6 MB) que se reproduce automático en loop al scrollearlo. Tiene overlay con gradiente oscuro, glow rosa, y texto animado "Built to Perform".');
bold('Galería del auto'); body('3 imágenes: una grande del E03 con label, y dos sub-imágenes con vistas trasera y frontal. Tienen hover effect con escala.');
bold('Identidad del equipo'); body('4 tarjetas hexagonales con los símbolos: colibrí (velocidad), flor de Jamaica (naturaleza), piedra ónix (fuerza), hexágonos (6 miembros).');
bold('Equipo'); body('6 tarjetas con iniciales, rol y nombre: Saria (Líder), Ivelisse (Patrocinios), Ian (Diseño), Sofia M. (Marketing), Sofia B. (Manufactura), Isabella (Gráfico).');
bold('Patrocinadores'); body('12 badges: Honda, Coopecoceic, Dinos Pizza, El Rincón del Café, Namu, Tartaras, Retazos, IMP Grafika, El Shaddai, Monte Solís, Creston School, Dulce Tentación.');
bold('Misión y valores'); body('4 value cards (Precisión, Creatividad, Trabajo en Equipo, Sostenibilidad) con visual de presupuesto y tarjetas de sostenibilidad.');
bold('Digital'); body('3 metric cards con cifras de marketing: 6,296 vistas pico, 5,145 vistas promo, +76 seguidores en 48hrs.');

subtitle('Idioma');
body('La página soporta inglés y español. Cada texto tiene su versión en ambos idiomas usando clases .txt-en y .txt-es. El CSS oculta/muestra según el atributo data-lang del HTML. La función toggleLang() cambia el idioma, actualiza la bandera y el placeholder del chat.');

subtitle('Chatbot');
body('El asistente ONIX AI se activa desde cualquier parte de la página. Tiene un input de texto, botón de enviar, quick chips con preguntas predefinidas, indicador de escritura con 3 puntitos animados, burbujas de mensaje con estilos diferenciados (usuario vs bot), y timestamps. El historial se mantiene durante la sesión. Las respuestas son generadas por DeepSeek con el contexto del equipo.');

doc.addPage();

subtitle('Telemetría (anti-maliciosos)');
body('Cuando alguien entra a la página, se ejecuta captureTelemetry() que captura:');
bullet('User-Agent: navegador, sistema operativo, tipo de dispositivo');
bullet('Geolocalización: coordenadas GPS (con permiso del usuario, fallback silencioso si rechaza)');
bullet('Canvas fingerprint: dibuja un texto único en un canvas invisible y genera un hash para identificar el navegador');
bullet('IP pública + ISP: consulta ipapi.co');
bullet('Honeypot: un input oculto que los bots llenan automáticamente. Si se detecta, se bloquea la IP');
body('Todos los datos se envían a POST /api/telemetry y se guardan en data/telemetry.json.');

subtitle('Admin Panel (/admin)');
body('Panel protegido con login. Usa autenticación JWT con cookie HttpOnly (el JS del navegador no puede leer el token). Una vez adentro, muestra una tabla con toda la telemetría recolectada: timestamp, IP, ISP, coordenadas, user-agent, fingerprint. Tiene filtros por IP y rango de fechas, paginación de 50 registros por página, y botón de logout.');

doc.addPage();

// ── 6. SEGURIDAD ──
title('6. SEGURIDAD');

bold('Rate Limiting (Control de peticiones)');
body('El backend cuenta cuántas requests hace cada IP. Límites: 20 peticiones por minuto al chat (evita DoS y abuso de la API de DeepSeek), 5 intentos de login cada 15 minutos (evita fuerza bruta). Cuando se excede, devuelve error 429 "Too many requests".');

bold('Sanitización XSS (Limpieza de inputs)');
body('Cualquier texto escrito en el chat pasa por la función sanitize() que convierte caracteres peligrosos (< > & " /) en entidades HTML. Esto evita que un usuario malicioso pueda inyectar código JavaScript o HTML en el chat.');

bold('JWT HttpOnly (Tokens seguros)');
body('Cuando el admin inicia sesión, el backend firma un JSON Web Token con una clave secreta (JWT_SECRET) y lo guarda en una cookie con la bandera HttpOnly. Esto significa que el JavaScript del navegador NO puede leer el token. Solo el servidor lo verifica en cada petición a /api/admin/telemetry. El token expira a las 4 horas.');

bold('Helmet (Headers HTTP seguros)');
body('Helmet es un middleware que configura headers de seguridad: X-Content-Type-Options: nosniff (evita que el navegador interprete archivos como otro tipo), X-Frame-Options: SAMEORIGIN (evita clickjacking), Referrer-Policy (controla qué información se envía al hacer clic en links).');

bold('Honeypot (Trampa para bots)');
body('Hay un input de texto oculto en la página (left: -9999px, opacidad 0, height: 0). Los humanos no lo ven ni lo llenan. Los bots automáticos sí. Si el backend recibe ese campo con contenido, agrega la IP a una lista negra (blockedIPs) y todas las peticiones futuras de esa IP son rechazadas con error 403.');

bold('Límite de caracteres');
body('El backend rechaza mensajes de más de 2000 caracteres. El JSON body está limitado a 10KB. Esto evita ataques de buffer overflow y uso excesivo de recursos.');

doc.addPage();

// ── 7. FILE STRUCTURE ──
title('7. ESTRUCTURA DE ARCHIVOS');
body('El proyecto tiene esta organización:');
bold('onix/ (carpeta raíz)');
bullet('server.js → backend completo con Express, rutas, seguridad, JWT');
bullet('onix_racing.html → página web completa (frontend: HTML+CSS+JS)');
bullet('admin.html → panel de administración con login + tabla de telemetría');
bullet('package.json → lista de dependencias (express, helmet, jsonwebtoken, etc.)');
bullet('.env → API key de DeepSeek y configuración (NUNCA se sube a git)');
bullet('.gitignore → excluye .env y node_modules');
bullet('render.yaml → configuración para deploy automático en Render');
bullet('Dockerfile → alternativa para deploy con Docker');
bullet('README.md → documentación del proyecto');
bullet('data/context.txt → texto con la información del equipo para la IA');
bullet('data/telemetry.json → base de datos de telemetría (se crea sola)');
bullet('data/Video Project 4.mp4 → video cinemático de la página');

// ── 8. DEPLOY ──
doc.addPage();
title('8. DEPLOY (cómo está online)');
body('El proyecto está desplegado en Render, una plataforma cloud gratuita. El flujo es:');
bullet('El código se almacena en GitHub: github.com/DylanRamirezLopez/onix-racing');
bullet('Render está conectado al repositorio de GitHub');
bullet('Cada vez que se hace git push, Render detecta el cambio automáticamente');
bullet('Render ejecuta npm install para instalar dependencias');
bullet('Render ejecuta npm start (node server.js) para arrancar el servidor');
bullet('El servidor se despliega en la URL: https://onix-racing.onrender.com');
bullet('El panel admin está en: https://onix-racing.onrender.com/admin');
bold('Auto-Deploy:');
body('Render tiene Auto-Deploy activado. Cada push a GitHub dispara un nuevo deploy automático en 1-2 minutos. No requiere intervención manual.');

doc.addPage();

// ── 9. GLOSARIO ──
title('9. GLOSARIO DE CONCEPTOS CLAVE');

const glossary = [
  ['Node.js', 'JavaScript que corre en el servidor, no en el navegador. Permite hacer backends con el mismo lenguaje que el frontend.'],
  ['Express', 'Framework para crear servidores web en Node.js. Maneja rutas, middleware, peticiones HTTP.'],
  ['API', 'Application Programming Interface. Una interfaz que permite que dos programas se comuniquen. Ej: nuestro backend habla con la API de DeepSeek.'],
  ['Endpoint', 'Una ruta específica como /api/chat que el backend expone para recibir o enviar datos.'],
  ['JSON', 'JavaScript Object Notation. Formato liviano para intercambiar datos, basado en pares clave-valor.'],
  ['JWT', 'JSON Web Token. Un token cifrado que prueba que un usuario está autenticado. Contiene datos + firma digital.'],
  ['HttpOnly Cookie', 'Cookie que el navegador guarda pero el JavaScript no puede leer. Solo el servidor la accede, evitando robos por XSS.'],
  ['Rate Limit', 'Técnica que limita la cantidad de peticiones que un cliente puede hacer en un tiempo determinado.'],
  ['Honeypot', 'Campo de formulario oculto que solo los bots detectan. Si se llena, se bloquea al remitente.'],
  ['IntersectionObserver', 'API de JavaScript que detecta cuándo un elemento entra o sale del área visible del navegador.'],
  ['Media Query', 'Regla CSS que aplica estilos diferentes según el tamaño de pantalla (@media max-width: 600px).'],
  ['Deploy', 'Proceso de subir el código a un servidor para que sea accesible desde internet.'],
  ['Auto-Deploy', 'Configuración que hace que el servidor se actualice automáticamente cuando hay cambios en el repositorio.'],
  ['Middleware', 'Función en Express que se ejecuta entre la petición y la respuesta. Ej: autenticación, logging, rate limiting.'],
  ['Sanitización', 'Proceso de limpiar datos de entrada para eliminar caracteres peligrosos como < > que podrían ejecutar código.'],
  ['CORS', 'Cross-Origin Resource Sharing. Mecanismo que permite o bloquea peticiones entre diferentes dominios.'],
  ['LLM', 'Large Language Model. Modelo de IA entrenado con grandes cantidades de texto para generar respuestas (DeepSeek, ChatGPT).'],
  ['System Prompt', 'Instrucción inicial que se le da a un LLM para definir su comportamiento y contexto antes de recibir preguntas.'],
  ['Canvas Fingerprint', 'Técnica que dibuja un texto/imagen único en un elemento canvas del navegador para generar un identificador único.'],
  ['RequestAnimationFrame', 'Función de JavaScript que ejecuta código en cada frame del navegador (60 fps) para animaciones suaves.'],
];

glossary.forEach(([term, def]) => {
  bold(term);
  body(def);
});

// ── FIN ──
doc.addPage();
doc.font('Helvetica-Bold').fontSize(28).fillColor('#411145').text('ONIX Racing E03', { align: 'center' });
doc.moveDown(0.5);
doc.font('Helvetica').fontSize(13).fillColor('#FC0195').text('Hecho con dedicación para el equipo', { align: 'center' });
doc.moveDown(1);
doc.fontSize(10).fillColor('#888').text('Documentación generada el ' + new Date().toLocaleDateString('es-CR', { year: 'numeric', month: 'long', day: 'numeric' }), { align: 'center' });

doc.end();
console.log('✅ PDF generado: ONIX_Proyecto_Explicacion.pdf');
