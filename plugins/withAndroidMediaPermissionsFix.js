const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

/**
 * Google Play rechazó la app con "Política de permisos de fotos y vídeos": una app que apunta
 * a API 33+ no puede pedir READ_MEDIA_IMAGES/READ_MEDIA_VIDEO (ni su equivalente heredado,
 * READ_EXTERNAL_STORAGE) sin límite de versión si ya usa el selector de fotos del sistema —
 * que es justo lo que hace expo-image-picker acá.
 *
 * `android/` NO está commiteada (proyecto managed, prebuild continuo): un edit a mano en el
 * manifiesto se pierde en el próximo build porque EAS lo regenera desde cero. Un config plugin
 * es el único lugar donde esto persiste de verdad — corre en cada prebuild, no una vez.
 *
 * Dos fuentes, ninguna del código de la app:
 *
 * - expo-image-picker declara READ_EXTERNAL_STORAGE/WRITE_EXTERNAL_STORAGE sin
 *   `maxSdkVersion`. Se usa acá (foto de perfil, fotos del vehículo, documentación) pero vía
 *   el selector del sistema, que en Android 13+ no necesita el permiso. Se capa a 32:
 *   `tools:node="replace"` porque el merge de manifiestos de Gradle, ante el mismo permiso
 *   declarado dos veces con `maxSdkVersion` distinto (una lo tiene, la otra no), lo trata como
 *   conflicto y falla el build si no se le dice cuál gana.
 *
 * - expo-screen-capture (sólo `preventScreenCaptureAsync`/`allowScreenCaptureAsync` en
 *   Login/Register, nunca lee la galería) declara READ_MEDIA_IMAGES para API 33 exacto, para
 *   una función de detección de capturas que la app no usa. Se elimina entero con
 *   `tools:node="remove"` — mismo mecanismo que usa el `blockedPermissions` oficial de Expo,
 *   reimplementado acá para poder tener las dos correcciones (capar y eliminar) juntas.
 */
const CAPAR_A_32 = ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE'];
const ELIMINAR = ['android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO'];

const withAndroidMediaPermissionsFix = (config) =>
  withAndroidManifest(config, (config) => {
    config.modResults = AndroidConfig.Manifest.ensureToolsAvailable(config.modResults);

    let permisos = config.modResults.manifest['uses-permission'];
    if (!Array.isArray(permisos)) permisos = [];

    // Fuera del todo, venga de donde venga.
    permisos = permisos.filter((p) => !ELIMINAR.includes(p.$?.['android:name']));

    // Reemplazadas por una versión propia con tope, no importa si alguna librería ya declaró
    // la suya sin tope: se saca la vieja entrada (si la había) y se agrega la que manda.
    for (const nombre of CAPAR_A_32) {
      permisos = permisos.filter((p) => p.$?.['android:name'] !== nombre);
      permisos.push({
        $: { 'android:name': nombre, 'android:maxSdkVersion': '32', 'tools:node': 'replace' },
      });
    }

    config.modResults.manifest['uses-permission'] = permisos;
    return config;
  });

module.exports = withAndroidMediaPermissionsFix;
