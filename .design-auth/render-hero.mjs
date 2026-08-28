/**
 * Rasteriza el fondo de las pantallas de acceso a PNG, uno por tema.
 *
 * Va como imagen y no como SVG en vivo porque `react-native-svg` es un módulo nativo: sumarlo
 * obligaría a un build nuevo de iOS y Android, y estas pantallas no saldrían por OTA. El PNG
 * viaja dentro del bundle y se ve al toque.
 *
 * El recorrido queda centrado verticalmente y los bordes se desvanecen contra el fondo, así
 * que la imagen se puede recortar (resizeMode="cover") a cualquier alto sin cortar el trazado.
 *
 * Uso: node render-hero.mjs
 */
import sharp from 'sharp';

const W = 390, H = 240, ESCALA = 3;

const LIGHT = { name: 'light', bg: '#FFFFFF', text: '#000000', hairline: 'rgba(0,0,0,0.14)' };
const DARK  = { name: 'dark',  bg: '#0A0A0A', text: '#FFFFFF', hairline: 'rgba(255,255,255,0.16)' };

const svg = (t) => {
  const h = H, a = 0.55; // amplitud suave, la elegida
  const O  = [54, h * 0.84];
  const S1 = [132 - 8 * a, h * (0.50 - 0.045 * a)];
  const S2 = [238 + 6 * a, h * (0.62 + 0.055 * a)];
  const D  = [334, h * 0.24];
  const p = (q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`;

  const calles = [];
  for (let x = -60; x < 500; x += 52) calles.push(`<line x1="${x}" y1="0" x2="${x - 70}" y2="${h}" stroke="${t.hairline}" stroke-width="1"/>`);
  for (let y = 16; y < h; y += 42) calles.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${t.hairline}" stroke-width="1"/>`);

  const bloques = [[16, 74], [292, 62], [22, 268], [318, 232], [176, 24]]
    .map(([bx, by], i) => {
      const w = 30 + (i % 3) * 12, hh = 22 + (i % 2) * 10;
      const sk = (by / h) * -14;
      return `<path d="M ${bx + sk} ${by} l ${w} 0 l ${-6} ${hh} l ${-w} 0 Z" fill="${t.hairline}" opacity="0.55"/>`;
    }).join('');

  const punto = (q, r, relleno) => relleno
    ? `<circle cx="${q[0]}" cy="${q[1]}" r="${r}" fill="${t.text}"/>`
    : `<circle cx="${q[0]}" cy="${q[1]}" r="${r}" fill="${t.bg}" stroke="${t.text}" stroke-width="${r > 8 ? 4 : 3.2}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">
  <defs>
    <radialGradient id="fade" cx="50%" cy="48%" r="76%">
      <stop offset="68%" stop-color="${t.bg}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${t.bg}"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${h}" fill="${t.bg}"/>
  <g opacity="0.8">${calles.join('')}</g>
  ${bloques}
  <g stroke="${t.text}" stroke-width="4.5" stroke-linecap="round" fill="none">
    <path d="M ${p(O)} C ${58 - 6 * a} ${(h * 0.70).toFixed(1)} ${96 - 14 * a} ${(h * 0.60).toFixed(1)} ${p(S1)}"/>
    <path d="M ${p(S1)} C ${176 + 10 * a} ${(h * 0.38).toFixed(1)} ${192 - 6 * a} ${(h * 0.64).toFixed(1)} ${p(S2)}"/>
    <path d="M ${p(S2)} C ${286 + 8 * a} ${(h * 0.74).toFixed(1)} 300 ${(h * 0.42).toFixed(1)} ${p(D)}" stroke-dasharray="1 9"/>
  </g>
  ${punto(O, 9, false)}
  ${punto(S1, 7, false)}
  ${punto(S2, 7, false)}
  ${punto(D, 9.5, true)}
  <rect width="${W}" height="${h}" fill="url(#fade)"/>
</svg>`;
};

for (const t of [LIGHT, DARK]) {
  const salida = `../assets/illustrations/auth-map-${t.name}.png`;
  await sharp(Buffer.from(svg(t)), { density: 72 * ESCALA })
    .resize(W * ESCALA, H * ESCALA)
    .png({ compressionLevel: 9 })
    .toFile(salida);
  console.log('escrito', salida);
}
