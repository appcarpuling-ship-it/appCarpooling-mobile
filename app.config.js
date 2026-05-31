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

module.exports = ({ config }) => {
  const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();

  if (!API_BASE_URL) {
    console.warn('[app.config] ⚠️  EXPO_PUBLIC_API_BASE_URL no definida — revisá tu .env');
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
