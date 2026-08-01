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

const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();

  if (!API_BASE_URL) {
    console.warn('[app.config] ⚠️  EXPO_PUBLIC_API_BASE_URL no definida — revisá tu .env');
  }

  // Sin este archivo Android no puede sacar token de FCM y no llega ninguna push
  // (iOS no lo necesita, va por APNs: por eso ahí sí llegaban). Se saca de la
  // consola de Firebase. Si no está, se omite la clave en vez de dejar que
  // prebuild reviente por un path inexistente: el build sale, pero sin push.
  const googleServicesFile = config?.android?.googleServicesFile;
  const hasGoogleServices =
    googleServicesFile && fs.existsSync(path.resolve(__dirname, googleServicesFile));

  if (!hasGoogleServices) {
    console.warn(
      '[app.config] ⚠️  Falta google-services.json en la raíz — las notificaciones push de Android NO van a funcionar en este build',
    );
  }

  const fromEnvMaps =
    (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY &&
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.trim()) ||
    (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY.trim()) ||
    '';
  const mapsFromJsonIos = config?.ios?.config?.googleMapsApiKey;
  const mapsFromJsonAndroid = config?.android?.config?.googleMaps?.apiKey;
  const googleMapsApiKey =
    fromEnvMaps || mapsFromJsonIos || mapsFromJsonAndroid || '';

  return {
    ...config,
    ios: {
      ...(config.ios || {}),
      config: {
        ...(config.ios?.config || {}),
        googleMapsApiKey: googleMapsApiKey || mapsFromJsonIos,
      },
    },
    android: {
      ...(config.android || {}),
      ...(hasGoogleServices ? {} : { googleServicesFile: undefined }),
      config: {
        ...(config.android?.config || {}),
        googleMaps: {
          ...(config.android?.config?.googleMaps || {}),
          apiKey: googleMapsApiKey || mapsFromJsonAndroid,
        },
      },
    },
    extra: {
      ...(config.extra || {}),
      API_BASE_URL,
      /** Fallback runtime si babel no inlinó EXPO_PUBLIC_ (mis builds EAS pueden leer sólo desde extra) */
      googleMapsApiKey: googleMapsApiKey || undefined,
    },
  };
};
