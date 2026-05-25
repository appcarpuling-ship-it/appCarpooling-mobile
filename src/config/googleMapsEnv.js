/**
 * URL de Maps en tiempo de compilación + fallback en tiempo de ejecución (extra de app.config).
 * En EAS: definí EXPO_PUBLIC_GOOGLE_MAPS_API_KEY como variable del proyecto/secreto — el .env local no viaja al build en la nube.
 */
import Constants from 'expo-constants';

export function getGoogleMapsApiKey() {
  const raw =
    (typeof process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY === 'string' &&
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.trim()) ||
    (Constants.expoConfig?.extra?.googleMapsApiKey &&
      String(Constants.expoConfig.extra.googleMapsApiKey).trim()) ||
    '';
  return raw;
}
