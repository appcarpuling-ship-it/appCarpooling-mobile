import { writeFileSync } from 'node:fs';

const LIGHT = {
  name: 'Light',
  bg: '#FFFFFF', surface: '#F4F4F5', border: '#E7E7E9',
  text: '#000000', muted: '#8A8A8E',
  invertBg: '#000000', invertText: '#FFFFFF',
  glow: 'rgba(0,0,0,0.10)', road: 'rgba(0,0,0,0.07)', hairline: 'rgba(0,0,0,0.14)',
};

const DARK = {
  name: 'Dark',
  bg: '#0A0A0A', surface: '#161616', border: '#2A2A2A',
  text: '#FFFFFF', muted: '#8A8A8E',
  invertBg: '#FFFFFF', invertText: '#000000',
  glow: 'rgba(255,255,255,0.13)', road: 'rgba(255,255,255,0.07)', hairline: 'rgba(255,255,255,0.16)',
};

/**
 * El hero: una ruta que se pierde en el horizonte, con el pin del auto flotando y un halo
 * detrás. Todo en formas — se recolorea entero con los tokens del tema, así que el mismo
 * dibujo funciona en claro y en oscuro sin dos archivos de imagen.
 */
const hero = (t, h) => {
  const cx = 195;
  const horizon = h * 0.46;
  const pinY = h * 0.40;
  return `
  <svg width="390" height="${h}" viewBox="0 0 390 ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block">
    <defs>
      <radialGradient id="halo${h}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${t.glow}"/>
        <stop offset="100%" stop-color="${t.glow.replace(/[\d.]+\)$/, '0)')}"/>
      </radialGradient>
      <linearGradient id="asfalto${h}" x1="0" y1="${h}" x2="0" y2="${horizon}">
        <stop offset="0%" stop-color="${t.road}"/>
        <stop offset="100%" stop-color="${t.road.replace(/[\d.]+\)$/, '0)')}"/>
      </linearGradient>
    </defs>

    <ellipse cx="${cx}" cy="${horizon + 10}" rx="200" ry="${h * 0.42}" fill="url(#halo${h})"/>

    <path d="M ${cx - 120} ${h} L ${cx - 17} ${horizon} L ${cx + 17} ${horizon} L ${cx + 120} ${h} Z" fill="url(#asfalto${h})"/>
    <path d="M ${cx - 120} ${h} L ${cx - 17} ${horizon}" stroke="${t.hairline}" stroke-width="1.25"/>
    <path d="M ${cx + 120} ${h} L ${cx + 17} ${horizon}" stroke="${t.hairline}" stroke-width="1.25"/>

    ${[0, 1, 2, 3].map((i) => {
      const p0 = i / 4, p1 = (i + 0.52) / 4;
      const y0 = h - (h - horizon) * p0, y1 = h - (h - horizon) * p1;
      const w0 = 4.5 * (1 - p0) + 0.8, w1 = 4.5 * (1 - p1) + 0.8;
      return `<path d="M ${cx - w0} ${y0} L ${cx + w0} ${y0} L ${cx + w1} ${y1} L ${cx - w1} ${y1} Z" fill="${t.hairline}"/>`;
    }).join('\n    ')}

    <line x1="42" y1="${horizon}" x2="348" y2="${horizon}" stroke="${t.hairline}" stroke-width="1"/>

    <g transform="translate(${cx}, ${pinY})">
      <ellipse cx="0" cy="46" rx="26" ry="6" fill="${t.glow}"/>
      <path d="M 0 44 C -13 26 -30 18 -30 -4 A 30 30 0 1 1 30 -4 C 30 18 13 26 0 44 Z"
            fill="${t.invertBg}"/>
      <g stroke="${t.invertText}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <path d="M -13 -1 L -11 -10 A 3 3 0 0 1 -8.2 -12 L 8.2 -12 A 3 3 0 0 1 11 -10 L 13 -1"/>
        <path d="M -15 -1 L 15 -1 A 2.4 2.4 0 0 1 17 1.4 L 17 8 A 2 2 0 0 1 15 10 L -15 10 A 2 2 0 0 1 -17 8 L -17 1.4 A 2.4 2.4 0 0 1 -15 -1 Z"/>
        <path d="M -10.5 5 L -8 5"/>
        <path d="M 8 5 L 10.5 5"/>
      </g>
    </g>
  </svg>`;
};


/**
 * Los cuatro caminos de fondo que se comparan en la página "Fondo". `ruta` es el que está
 * puesto en las pantallas.
 */

/** B · Mapa abstracto: la retícula de calles con el trazado y los dos puntos del viaje.
 *  Es el lenguaje que la app ya usa en todos sus mapas. */
const heroMapa = (t, h) => {
  const calles = [];
  for (let x = -40; x < 470; x += 46) calles.push(`<line x1="${x}" y1="0" x2="${x - 60}" y2="${h}" stroke="${t.hairline}" stroke-width="1"/>`);
  for (let y = 18; y < h; y += 38) calles.push(`<line x1="0" y1="${y}" x2="390" y2="${y}" stroke="${t.hairline}" stroke-width="1"/>`);
  return `
  <svg width="390" height="${h}" viewBox="0 0 390 ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block">
    <defs>
      <radialGradient id="fade${h}" cx="50%" cy="45%" r="62%">
        <stop offset="55%" stop-color="${t.bg}" stop-opacity="0"/>
        <stop offset="100%" stop-color="${t.bg}"/>
      </radialGradient>
    </defs>
    <g opacity="0.85">${calles.join('')}</g>
    <path d="M 82 ${h - 46} C 150 ${h - 62} 152 ${h * 0.5} 208 ${h * 0.44} C 262 ${h * 0.38} 286 ${h * 0.36} 306 ${h * 0.3}"
          stroke="${t.text}" stroke-width="4.5" stroke-linecap="round" fill="none"/>
    <circle cx="82" cy="${h - 46}" r="9" fill="${t.bg}" stroke="${t.text}" stroke-width="4"/>
    <circle cx="306" cy="${h * 0.3}" r="9" fill="${t.text}"/>
    <rect x="0" y="0" width="390" height="${h}" fill="url(#fade${h})"/>
  </svg>`;
};

/** A · Sin fondo: sólo aire y tipografía. Lo más fiel al blanco y negro estricto. */
const heroNinguno = (t, h) => `<div style="height: ${Math.round(h * 0.45)}px"></div>`;

/** D · Foto tratada en blanco y negro. El bloque gris es un marcador: iría una foto real. */
const heroFoto = (t, h) => `
  <div style="position: relative; height: ${h}px; background: linear-gradient(160deg, ${t.surface}, ${t.border}); display: flex; align-items: center; justify-content: center">
    <span style="font-size: 12px; font-weight: 700; letter-spacing: 1.4px; color: ${t.muted}">[ FOTO B/N ]</span>
    <div style="position: absolute; left: 0; right: 0; bottom: 0; height: ${Math.round(h * 0.55)}px; background: linear-gradient(180deg, rgba(0,0,0,0), ${t.bg})"></div>
  </div>`;



/**
 * B mejorado. Tres refinamientos del mapa abstracto: todos llevan la parada intermedia
 * —que es lo propio de Carpuling— y cambian en cuánto contexto de mapa dibujan y en cómo
 * tratan el tramo que falta.
 */
const mapaBase = (t, h, { manzanas = false, guiones = 'tramo' } = {}) => {
  const O = [72, h - 44], S = [196, h * 0.52], D = [306, h * 0.24];
  const p = (a) => `${a[0]} ${a[1]}`;

  const calles = [];
  for (let x = -60; x < 500; x += 52) calles.push(`<line x1="${x}" y1="0" x2="${x - 70}" y2="${h}" stroke="${t.hairline}" stroke-width="1"/>`);
  for (let y = 16; y < h; y += 42) calles.push(`<line x1="0" y1="${y}" x2="390" y2="${y}" stroke="${t.hairline}" stroke-width="1"/>`);

  // Manzanas: rompen la retícula perfecta y hacen que se lea como un mapa y no como una grilla.
  const bloques = manzanas ? [[20, 60], [130, 150], [250, 90], [300, 210], [60, 250], [180, 330]]
    .map(([bx, by], i) => {
      const w = 30 + (i % 3) * 12, hh = 22 + (i % 2) * 10;
      const sk = (by / h) * -14;
      return `<path d="M ${bx + sk} ${by} l ${w} 0 l ${-6} ${hh} l ${-w} 0 Z" fill="${t.hairline}" opacity="0.55"/>`;
    }).join('') : '';

  // El tramo hecho va sólido y el que falta punteado: es la misma lectura que el mapa del viaje.
  const dashTramo2 = guiones === 'tramo' ? `stroke-dasharray="1 9" stroke-linecap="round"` : '';
  const dashTodo = guiones === 'todo' ? `stroke-dasharray="1 9" stroke-linecap="round"` : '';

  return `
  <svg width="390" height="${h}" viewBox="0 0 390 ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block">
    <defs>
      <radialGradient id="fade${h}${guiones}${manzanas}" cx="50%" cy="45%" r="64%">
        <stop offset="52%" stop-color="${t.bg}" stop-opacity="0"/>
        <stop offset="100%" stop-color="${t.bg}"/>
      </radialGradient>
    </defs>

    <g opacity="0.8">${calles.join('')}</g>
    ${bloques}

    <path d="M ${p(O)} C 122 ${h - 60} 150 ${h * 0.66} ${p(S)}"
          stroke="${t.text}" stroke-width="4.5" stroke-linecap="round" fill="none" ${dashTodo}/>
    <path d="M ${p(S)} C 240 ${h * 0.44} 262 ${h * 0.34} ${p(D)}"
          stroke="${t.text}" stroke-width="4.5" stroke-linecap="round" fill="none" ${dashTramo2 || dashTodo}/>

    <circle cx="${O[0]}" cy="${O[1]}" r="9" fill="${t.bg}" stroke="${t.text}" stroke-width="4"/>
    <circle cx="${S[0]}" cy="${S[1]}" r="7" fill="${t.bg}" stroke="${t.text}" stroke-width="3.2"/>
    <circle cx="${D[0]}" cy="${D[1]}" r="9.5" fill="${t.text}"/>

    <rect x="0" y="0" width="390" height="${h}" fill="url(#fade${h}${guiones}${manzanas})"/>
  </svg>`;
};

const heroMapaParada = (t, h) => mapaBase(t, h, { manzanas: false, guiones: 'tramo' });
const heroMapaManzanas = (t, h) => mapaBase(t, h, { manzanas: true, guiones: 'tramo' });
const heroMapaPunteado = (t, h) => mapaBase(t, h, { manzanas: true, guiones: 'todo' });



/**
 * El mapa con el recorrido serpenteando: dos paradas repartidas por el ancho en vez de una
 * diagonal recta. `amplitud` gradúa cuánto se va de la línea directa.
 */
const mapaCurvo = (t, h, amplitud = 1) => {
  const a = amplitud;
  const O  = [54, h * 0.84];
  const S1 = [132 - 8 * a, h * (0.50 - 0.045 * a)];
  const S2 = [238 + 6 * a, h * (0.62 + 0.055 * a)];
  const D  = [334, h * 0.24];
  const p = (q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`;

  const calles = [];
  for (let x = -60; x < 500; x += 52) calles.push(`<line x1="${x}" y1="0" x2="${x - 70}" y2="${h}" stroke="${t.hairline}" stroke-width="1"/>`);
  for (let y = 16; y < h; y += 42) calles.push(`<line x1="0" y1="${y}" x2="390" y2="${y}" stroke="${t.hairline}" stroke-width="1"/>`);

  // Manzanas corridas a los márgenes, para no chocar con el recorrido.
  const bloques = [[16, 74], [292, 62], [22, 268], [318, 232], [176, 24]]
    .map(([bx, by], i) => {
      const w = 30 + (i % 3) * 12, hh = 22 + (i % 2) * 10;
      const sk = (by / h) * -14;
      return `<path d="M ${bx + sk} ${by} l ${w} 0 l ${-6} ${hh} l ${-w} 0 Z" fill="${t.hairline}" opacity="0.55"/>`;
    }).join('');

  const punto = (q, r, relleno) => relleno
    ? `<circle cx="${q[0]}" cy="${q[1]}" r="${r}" fill="${t.text}"/>`
    : `<circle cx="${q[0]}" cy="${q[1]}" r="${r}" fill="${t.bg}" stroke="${t.text}" stroke-width="${r > 8 ? 4 : 3.2}"/>`;

  return `
  <svg width="390" height="${h}" viewBox="0 0 390 ${h}" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block">
    <defs>
      <radialGradient id="fadec${h}${a}" cx="50%" cy="45%" r="64%">
        <stop offset="52%" stop-color="${t.bg}" stop-opacity="0"/>
        <stop offset="100%" stop-color="${t.bg}"/>
      </radialGradient>
    </defs>

    <g opacity="0.8">${calles.join('')}</g>
    ${bloques}

    <g stroke="${t.text}" stroke-width="4.5" stroke-linecap="round" fill="none">
      <path d="M ${p(O)} C ${58 - 6 * a} ${(h * 0.70).toFixed(1)} ${96 - 14 * a} ${(h * 0.60).toFixed(1)} ${p(S1)}"/>
      <path d="M ${p(S1)} C ${176 + 10 * a} ${(h * 0.38).toFixed(1)} ${192 - 6 * a} ${(h * 0.64).toFixed(1)} ${p(S2)}"/>
      <path d="M ${p(S2)} C ${286 + 8 * a} ${(h * 0.74).toFixed(1)} ${300} ${(h * 0.42).toFixed(1)} ${p(D)}"
            stroke-dasharray="1 9"/>
    </g>

    ${punto(O, 9, false)}
    ${punto(S1, 7, false)}
    ${punto(S2, 7, false)}
    ${punto(D, 9.5, true)}

    <rect x="0" y="0" width="390" height="${h}" fill="url(#fadec${h}${a})"/>
  </svg>`;
};

const heroCurvoSuave = (t, h) => mapaCurvo(t, h, 0.55);
const heroCurvoMarcado = (t, h) => mapaCurvo(t, h, 1.35);


// Elegido el 2026-08-28: mapa abstracto con manzanas, dos paradas y el recorrido
// serpenteando suave. El tramo final va punteado — igual que "lo que falta" en el mapa real.
const HERO = (t, h) => heroCurvoSuave(t, h);

const icons = {
  mail: (c) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4.5" width="19" height="15" rx="3"/><path d="M3 7l8.2 5.6a1.5 1.5 0 0 0 1.6 0L21 7"/></svg>`,
  lock: (c) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`,
  user: (c) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6"/></svg>`,
  back: (c) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  google: () => `<svg width="19" height="19" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.7-.06-1.4-.19-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.74 2.98-4.3 2.98-7.35Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.75-5.59-4.11H3.06v2.58A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.93a6 6 0 0 1 0-3.84V7.5H3.06a10 10 0 0 0 0 9l3.35-2.58Z"/><path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2a10 10 0 0 0-8.94 5.5l3.35 2.59C7.2 7.73 9.4 5.98 12 5.98Z"/></svg>`,
  apple: (c) => `<svg width="19" height="19" viewBox="0 0 24 24" fill="${c}"><path d="M16.4 12.7c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.6-1.9-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.2-.9-1.7 0-3.2 1-4 2.5-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.7 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.4-.9-2.4-3.9ZM14.1 5.1c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z"/></svg>`,
};

/**
 * Los cuatro tratamientos de input que se comparan en la página "Inputs". `relleno` es el
 * que llevan las pantallas hasta que se elija otro.
 */
const VARIANTES = {
  // Caja con fondo y borde. El más neutro y el más parecido a la referencia.
  relleno: (t, { label, icon, placeholder }) => `
        <div style="display: flex; flex-direction: column; gap: 7px">
          <span style="font-size: 12.5px; font-weight: 600; color: ${t.muted}; letter-spacing: 0.1px">${label}</span>
          <div style="display: flex; align-items: center; gap: 11px; height: 56px; padding: 0 16px; border-radius: 14px; background: ${t.surface}; border: 1px solid ${t.border}">
            ${icons[icon](t.muted)}
            <span style="font-size: 15px; color: ${t.muted}; font-weight: 400">${placeholder}</span>
          </div>
        </div>`,

  // Sin caja: sólo una línea abajo. Es el que menos peso visual agrega y el que deja
  // respirar al hero, pero marca menos dónde se toca.
  linea: (t, { label, icon, placeholder }) => `
        <div style="display: flex; flex-direction: column; gap: 6px">
          <span style="font-size: 12.5px; font-weight: 600; color: ${t.muted}; letter-spacing: 0.1px">${label}</span>
          <div style="display: flex; align-items: center; gap: 11px; height: 50px; padding: 0 2px; border-bottom: 1.5px solid ${t.border}">
            ${icons[icon](t.muted)}
            <span style="font-size: 16px; color: ${t.muted}; font-weight: 400">${placeholder}</span>
          </div>
        </div>`,

  // La etiqueta vive adentro del campo: ocupa menos alto total, que es lo que importa en
  // los pasos con muchos campos.
  adentro: (t, { label, icon, placeholder }) => `
        <div style="display: flex; align-items: center; gap: 12px; height: 64px; padding: 0 16px; border-radius: 16px; background: ${t.surface}">
          ${icons[icon](t.muted)}
          <div style="display: flex; flex-direction: column; gap: 2px">
            <span style="font-size: 11.5px; font-weight: 600; color: ${t.muted}; letter-spacing: 0.2px">${label}</span>
            <span style="font-size: 15px; color: ${t.text}; font-weight: 500">${placeholder}</span>
          </div>
        </div>`,

  // Cápsula, igual que los botones. El más "de marca", pero sin etiqueta arriba el campo
  // vacío depende del placeholder para decir qué va.
  capsula: (t, { icon, placeholder }) => `
        <div style="display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 20px; border-radius: 999px; background: ${t.surface}; border: 1px solid ${t.border}">
          ${icons[icon](t.muted)}
          <span style="font-size: 15px; color: ${t.muted}; font-weight: 400">${placeholder}</span>
        </div>`,
};

// Elegido el 2026-08-28: sin caja, sólo la línea de abajo.
const VARIANTE = 'linea';
const field = (t, opts) => VARIANTES[VARIANTE](t, opts);

const primary = (t, label) => `
        <div style="display: flex; align-items: center; justify-content: center; height: 56px; border-radius: 999px; background: ${t.invertBg}">
          <span style="font-size: 15.5px; font-weight: 700; color: ${t.invertText}; letter-spacing: 0.2px">${label}</span>
        </div>`;

const divider = (t) => `
        <div style="display: flex; align-items: center; gap: 14px">
          <div style="flex-grow: 1; height: 1px; background: ${t.border}"></div>
          <span style="font-size: 12.5px; color: ${t.muted}">o continuá con</span>
          <div style="flex-grow: 1; height: 1px; background: ${t.border}"></div>
        </div>`;

const social = (t) => `
        <div style="display: flex; flex-direction: column; gap: 11px">
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px; height: 52px; border-radius: 999px; background: ${t.surface}; border: 1px solid ${t.border}">
            ${icons.google()}
            <span style="font-size: 14.5px; font-weight: 600; color: ${t.text}">Continuar con Google</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: center; gap: 10px; height: 52px; border-radius: 999px; background: ${t.surface}; border: 1px solid ${t.border}">
            ${icons.apple(t.text)}
            <span style="font-size: 14.5px; font-weight: 600; color: ${t.text}">Continuar con Apple</span>
          </div>
        </div>`;

const footerLink = (t, plain, link) => `
        <div style="display: flex; align-items: center; justify-content: center; gap: 5px">
          <span style="font-size: 13.5px; color: ${t.muted}">${plain}</span>
          <span style="font-size: 13.5px; color: ${t.text}; font-weight: 700">${link}</span>
        </div>`;

const backBtn = (t) => `
      <div style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 999px; background: ${t.surface}; border: 1px solid ${t.border}">
        ${icons.back(t.text)}
      </div>`;

const titleBlock = (t, title, sub, size = 30) => `
        <div style="display: flex; flex-direction: column; gap: 8px">
          <span style="font-size: ${size}px; font-weight: 800; color: ${t.text}; letter-spacing: -0.6px; line-height: 1.15">${title}</span>
          <span style="font-size: 14.5px; color: ${t.muted}; line-height: 1.45; text-wrap: pretty">${sub}</span>
        </div>`;

const shell = (t, body) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap">
  <style>
    body { margin: 0; font-family: 'Sora', 'Segoe UI', system-ui, sans-serif; }
    a { color: ${t.text}; } a:hover { color: ${t.muted}; }
  </style>
</helmet>
<div style="width: 390px; height: 844px; background: ${t.bg}; display: flex; flex-direction: column; overflow: hidden">
${body}
</div>
</x-dc>
<script data-dc-script>
class Component extends DCLogic {}
</script>
</body>
</html>
`;

const loginCon = (t, dibujo) => shell(t, `
  <div style="height: 240px; flex-shrink: 0">${dibujo(t, 240)}</div>
  <div style="display: flex; flex-direction: column; gap: 20px; padding: 4px 26px 26px">
${titleBlock(t, 'Carpuling', 'Viajá inteligente, ahorrá más', 32)}
    <div style="display: flex; flex-direction: column; gap: 13px">
${field(t, { label: 'Email', icon: 'mail', placeholder: 'tu@email.com' })}
${field(t, { label: 'Contraseña', icon: 'lock', placeholder: '••••••••' })}
      <div style="display: flex; justify-content: flex-end">
        <span style="font-size: 13px; color: ${t.text}; font-weight: 600">¿Olvidaste tu contraseña?</span>
      </div>
    </div>
${primary(t, 'Iniciar Sesión')}
${divider(t)}
${social(t)}
${footerLink(t, '¿No tenés cuenta?', 'Registrate')}
  </div>`);

const login = (t) => loginCon(t, HERO);

/**
 * El registro es un wizard de 4 pasos (STEPS en RegisterScreen), no una pantalla sola. La
 * barra segmentada es la misma que ya usa el alta de viaje, para no inventar un segundo
 * lenguaje de "vas por acá".
 */
const stepper = (t, paso, total, titulo) => `
    <div style="display: flex; flex-direction: column; gap: 9px">
      <div style="display: flex; gap: 6px">
${Array.from({ length: total }, (_, i) => `        <div style="flex-grow: 1; height: 3px; border-radius: 999px; background: ${i < paso ? t.text : t.border}"></div>`).join('\n')}
      </div>
      <span style="font-size: 12.5px; font-weight: 600; color: ${t.muted}">Paso ${paso} de ${total} · ${titulo}</span>
    </div>`;

const register = (t) => shell(t, `
  <div style="padding: 20px 26px 0">${backBtn(t)}</div>
  <div style="height: 150px; flex-shrink: 0; margin-top: -8px">${HERO(t, 150)}</div>
  <div style="display: flex; flex-direction: column; gap: 20px; padding: 4px 26px 22px">
${stepper(t, 1, 4, 'Sobre vos')}
${titleBlock(t, 'Creá tu cuenta', 'Contanos quién sos', 27)}
    <div style="display: flex; flex-direction: column; gap: 13px">
${field(t, { label: 'Nombre', icon: 'user', placeholder: 'Ingresá tu nombre' })}
${field(t, { label: 'Apellido', icon: 'user', placeholder: 'Ingresá tu apellido' })}
    </div>
${primary(t, 'Continuar')}
${divider(t)}
${social(t)}
${footerLink(t, '¿Ya tenés cuenta?', 'Iniciá sesión')}
  </div>`);

/** El paso más cargado (3 campos): sirve para ver que el layout aguanta la densidad. */
const registerPaso2 = (t) => shell(t, `
  <div style="padding: 20px 26px 0">${backBtn(t)}</div>
  <div style="height: 120px; flex-shrink: 0; margin-top: -8px">${HERO(t, 120)}</div>
  <div style="display: flex; flex-direction: column; gap: 20px; padding: 4px 26px 22px">
${stepper(t, 2, 4, 'Tu cuenta')}
${titleBlock(t, 'Tu cuenta', 'Creá tus credenciales de acceso', 27)}
    <div style="display: flex; flex-direction: column; gap: 13px">
${field(t, { label: 'Email', icon: 'mail', placeholder: 'ejemplo@correo.com' })}
${field(t, { label: 'Contraseña', icon: 'lock', placeholder: 'Mínimo 8 caracteres' })}
${field(t, { label: 'Confirmar contraseña', icon: 'lock', placeholder: 'Repetí tu contraseña' })}
    </div>
${primary(t, 'Continuar')}
    <div style="display: flex; align-items: center; justify-content: center">
      <span style="font-size: 13.5px; color: ${t.muted}">Volver al paso anterior</span>
    </div>
  </div>`);

/** Página de comparación: el mismo campo en los cuatro tratamientos. */
const inputs = (t) => {
  const muestra = (nombre, nota, render) => `
    <div style="display: flex; flex-direction: column; gap: 10px">
      <div style="display: flex; flex-direction: column; gap: 3px">
        <span style="font-size: 15px; font-weight: 700; color: ${t.text}">${nombre}</span>
        <span style="font-size: 12.5px; color: ${t.muted}; line-height: 1.4; text-wrap: pretty">${nota}</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 11px">
${render(t, { label: 'Email', icon: 'mail', placeholder: 'ejemplo@correo.com' })}
${render(t, { label: 'Contraseña', icon: 'lock', placeholder: 'Mínimo 8 caracteres' })}
      </div>
    </div>`;
  return shell(t, `
  <div style="display: flex; flex-direction: column; gap: 26px; padding: 32px 26px">
    <div style="display: flex; flex-direction: column; gap: 5px">
      <span style="font-size: 24px; font-weight: 800; color: ${t.text}; letter-spacing: -0.4px">Inputs · ${t.name === 'Dark' ? 'oscuro' : 'claro'}</span>
      <span style="font-size: 13px; color: ${t.muted}">Elegí uno y lo aplico a las cuatro pantallas.</span>
    </div>
${muestra('A · Relleno', 'Caja con fondo y borde. El más neutro; es el que está puesto ahora.', VARIANTES.relleno)}
${muestra('B · Línea', 'Sólo una línea abajo. El que menos peso agrega, pero marca menos dónde se toca.', VARIANTES.linea)}
${muestra('C · Etiqueta adentro', 'La etiqueta vive dentro del campo: ocupa menos alto, que es lo que importa en los pasos con muchos campos.', VARIANTES.adentro)}
${muestra('D · Cápsula', 'Redondeado como los botones. El más de marca, pero sin etiqueta arriba depende del placeholder.', VARIANTES.capsula)}
  </div>`);
};

const forgot = (t) => shell(t, `
  <div style="padding: 20px 26px 0">${backBtn(t)}</div>
  <div style="height: 214px; flex-shrink: 0; margin-top: -10px">${HERO(t, 214)}</div>
  <div style="display: flex; flex-direction: column; gap: 22px; padding: 6px 26px 26px">
${titleBlock(t, '¿Olvidaste tu\ncontraseña?', 'Poné tu email y te mandamos un código de 6 dígitos para que puedas crear una nueva.', 28)}
${field(t, { label: 'Email', icon: 'mail', placeholder: 'tu@email.com' })}
${primary(t, 'Enviarme el código')}
    <div style="display: flex; align-items: center; justify-content: center">
      <span style="font-size: 13.5px; color: ${t.muted}">¿Te acordaste? <span style="color: ${t.text}; font-weight: 700">Volvé al inicio</span></span>
    </div>
  </div>`);

const verify = (t) => {
  const box = (ch, filled) => `
          <div style="display: flex; align-items: center; justify-content: center; width: 48px; height: 60px; border-radius: 14px; background: ${filled ? t.surface : t.bg}; border: ${filled ? `1.5px solid ${t.text}` : `1px solid ${t.border}`}">
            <span style="font-size: 24px; font-weight: 700; color: ${filled ? t.text : t.muted}">${ch}</span>
          </div>`;
  return shell(t, `
  <div style="padding: 20px 26px 0">${backBtn(t)}</div>
  <div style="height: 196px; flex-shrink: 0; margin-top: -6px">${HERO(t, 196)}</div>
  <div style="display: flex; flex-direction: column; gap: 24px; padding: 8px 26px 26px">
${titleBlock(t, 'Verificá tu email', 'Te mandamos un código de 6 dígitos a tu correo. Revisá también el spam.', 28)}
    <div style="display: flex; justify-content: space-between">
${box('4', true)}${box('9', true)}${box('2', true)}${box('', false)}${box('', false)}${box('', false)}
    </div>
${primary(t, 'Verificar')}
    <div style="display: flex; align-items: center; justify-content: center; gap: 5px">
      <span style="font-size: 13.5px; color: ${t.muted}">¿No te llegó?</span>
      <span style="font-size: 13.5px; color: ${t.text}; font-weight: 700">Reenviar código</span>
    </div>
  </div>`);
};

const screens = [
  ['Login', 'Login', login],
  ['Registro', 'Registro · paso 1', register],
  ['RegistroDos', 'Registro · paso 2', registerPaso2],
  ['Recuperar', 'Recuperar', forgot],
  ['Verificar', 'Verificar', verify],
];

const seeded = [];
for (const t of [DARK, LIGHT]) {
  for (const [name, , fn] of screens) {
    // El login oscuro es `Main`, el artboard de entrada: no se escribe dos veces.
    const file = (t === DARK && name === 'Login') ? 'Main.dc.html' : `${name}${t.name}.dc.html`;
    writeFileSync(file, fn(t));
    seeded.push(file);
  }
}

const W = 390, H = 844, GAP_X = 110, GAP_Y = 170;

const fila = (y, tema, prefijo) => screens.map(([name, label], i) => ({
  file: (tema === DARK && name === 'Login') ? 'Main.dc.html' : `${name}${tema.name}.dc.html`,
  x: i * (W + GAP_X), y, w: W, h: H,
  title: `${prefijo} · ${label}`,
}));

const artboards = [
  ...fila(0, DARK, 'Oscuro'),
  ...fila(H + GAP_Y, LIGHT, 'Claro'),
];
const canvas = {
  artboards,
  annotations: [
    
    {
      id: 'nota-hero',
      x: 0, y: -170, w: 620,
      text: 'Hero hecho con formas, no con una foto: la ruta se pierde en el horizonte y el pin del auto flota con un halo detrás. Se recolorea entero con los tokens del tema, así que el mismo dibujo sirve en claro y en oscuro.',
    },
    {
      id: 'nota-registro',
      x: 680, y: -170, w: 620,
      text: 'El registro es un wizard de 4 pasos (Sobre vos · Tu cuenta · Tus datos · Últimos detalles). Se muestran el 1 y el 2 — el 2 es el más cargado, para ver que el layout aguanta la densidad.',
    },
  ],
  launch: { view: 'canvas' },
};
writeFileSync('canvas.json', JSON.stringify(canvas, null, 2));
console.log('artboards:', artboards.length, '| archivos:', seeded.length);
