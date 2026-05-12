/**
 * Config dinámica: inyecta la URL de la API desde .env en `extra`,
 * así el cliente (Constants.expoConfig.extra) coincide con EXPO_PUBLIC_* en cada arranque de Metro.
 *
 * Mismo backend, distinto host según dónde corre esta app (Expo):
 * - Metro Web (navegador): en dev usa http://localhost:5000/api salvo que definas
 *   EXPO_PUBLIC_API_BASE_URL_WEB (ver mobile/src/config/api.js).
 * - iOS / Android: EXPO_PUBLIC_API_BASE_URL (ej. http://192.168.1.3:5000/api en dispositivo físico).
 *   Emulador Android: suele ser http://10.0.2.2:5000/api
 * El proyecto web/ (Vite) es aparte: ahí va VITE_API_URL en web/.env.
 *
 * Si seguís viendo una IP vieja: reiniciá Metro con `npx expo start -c`.
 * Con EAS Update, la URL queda “horneada” en el último publish hasta que publiques de nuevo
 * o desactives updates en desarrollo.
 */
module.exports = ({ config }) => {
  const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    'https://appcarpuling.cloud/api';

  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      API_BASE_URL,
    },
  };
};
