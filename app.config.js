/**
 * Config dinámica: inyecta la URL de la API desde .env en `extra`,
 * así el cliente (Constants.expoConfig.extra) coincide con EXPO_PUBLIC_* en cada arranque de Metro.
 *
 * EAS Build: eas.json (`env` por perfil) y/o secrets Expo; mismo host ngrok también en perfil `ngrok`.
 *
 * Metro Web en dev usa http://localhost:5000/api salvo EXPO_PUBLIC_API_BASE_URL_WEB (ver api.js).
 * El proyecto web (Vite) es aparte: VITE_API_URL en web/.env.
 *
 * Tras cambiar sólo .env: npx expo start -c.
 */

function normalizeLanHost(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  if (s.includes('://')) {
    try {
      const u = new URL(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(s) ? s : `http://${s}`);
      return u.hostname || null;
    } catch {
      return null;
    }
  }
  const hostOnly = s.split('/')[0].split(':')[0];
  return hostOnly || null;
}

module.exports = ({ config }) => {
  const LAN = normalizeLanHost(process.env.DEV_LAN_HOST);
  const fromLan = LAN ? `http://${LAN}:5000/api` : null;

  const API_BASE_URL =
    (process.env.EXPO_PUBLIC_API_BASE_URL &&
      process.env.EXPO_PUBLIC_API_BASE_URL.trim()) ||
    (process.env.API_BASE_URL && process.env.API_BASE_URL.trim()) ||
    fromLan ||
    'https://appcarpuling.cloud/api';

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      API_BASE_URL,
    },
  };
};
