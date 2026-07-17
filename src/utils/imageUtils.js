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

export function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/uploads') || trimmed.startsWith('/api/uploads')) {
    return `${API_ORIGIN}${trimmed.replace('/api', '')}`;
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
