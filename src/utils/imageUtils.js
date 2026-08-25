/**
 * Sustituye via.placeholder.com (a menudo inaccesible) por picsum.photos con semilla estable.
 */
import { API_CONFIG } from '../config/api';

/** Origen del API sin el sufijo /api: las rutas /uploads cuelgan del host, no del prefijo. */
const API_ORIGIN = String(API_CONFIG.BASE_URL || '').replace(/\/api\/?$/, '');

function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) + h ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

// Las fotos se suben a Cloudinary sin ningún límite de tamaño (multer solo topea a
// 10MB el archivo, no las dimensiones): una foto de cámara de celular de 4000px de
// ancho se decodifica entera en memoria aunque se muestre en un avatar de 40px —
// iOS no recorta el decode al tamaño de pantalla. Con varias fotos así en pantalla
// a la vez (avatares, carrusel del vehículo, banners) esto es justo el tipo de cosa
// que hace crecer la memoria hasta que el sistema mata la app.
//
// Cloudinary permite pedir una versión redimensionada agregando un segmento de
// transformación en la URL, sin re-subir nada. w_768 es de sobra para cualquier
// uso en esta app (el más grande es el banner, ~pantalla de ancho); c_limit no
// agranda una imagen más chica; q_auto/f_auto bajan peso de red también.
const CLOUDINARY_UPLOAD_RE = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;
function capCloudinarySize(url) {
  const m = url.match(CLOUDINARY_UPLOAD_RE);
  if (!m) return url;
  // Ya viene con una transformación (empieza con "letra_" tipo w_768,c_fill) — no tocar.
  if (/^[a-z]+_/i.test(m[2])) return url;
  return `${m[1]}w_768,c_limit,q_auto,f_auto/${m[2]}`;
}

export function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/uploads') || trimmed.startsWith('/api/uploads')) {
    return `${API_ORIGIN}${trimmed.replace('/api', '')}`;
  }

  if (trimmed.includes('res.cloudinary.com')) {
    return capCloudinarySize(trimmed);
  }

  if (trimmed.includes('appcarpuling.cloud')) {
    return trimmed;
  }

  if (trimmed.includes('via.placeholder.com')) {
    const seed = hashString(trimmed);
    const dimensionMatch = trimmed.match(/(\d+)x(\d+)/);
    if (dimensionMatch) {
      const w = dimensionMatch[1];
      const h = dimensionMatch[2];
      return `https://picsum.photos/seed/${seed}/${w}/${h}`;
    }
    const single = trimmed.match(/via\.placeholder\.com\/(\d+)/);
    if (single) {
      const size = single[1];
      return `https://picsum.photos/seed/${seed}/${size}/${size}`;
    }
    return `https://picsum.photos/seed/${seed}/300/200`;
  }

  return trimmed;
}
