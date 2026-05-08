/**
 * Config dinámica: inyecta la URL de la API desde .env en `extra`,
 * así el cliente (Constants.expoConfig.extra) coincide con EXPO_PUBLIC_* en cada arranque de Metro.
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
