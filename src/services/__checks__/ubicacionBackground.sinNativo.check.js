/**
 * Un OTA puede llegarle a un binario mas viejo que el codigo. Este check verifica que eso
 * no rompa la app: `expo-task-manager` es NATIVO y solo existe en binarios compilados desde
 * que se agrego la dependencia, pero App.js importa ubicacionBackground AL ARRANCAR.
 *
 * Si el import fuera estatico, ese OTA dejaria la app en pantalla blanca para todos los
 * usuarios y sin forma de arreglarlo salvo publicar otro OTA.
 *
 * Correr: node src/services/__checks__/ubicacionBackground.sinNativo.check.js
 */
/**
 * Simula un binario de produccion VIEJO (sin expo-task-manager) ejecutando el modulo que
 * App.js importa al arrancar. Si esto tira, la app queda en pantalla blanca para todos.
 */
const MOBILE = require('path').join(__dirname, '..', '..', '..');
const babel = require(MOBILE + '/node_modules/@babel/core');
const vm = require('vm');

const { code } = babel.transformFileSync(MOBILE + '/src/services/ubicacionBackground.js', {
  presets: [MOBILE + '/node_modules/babel-preset-expo'],
  plugins: [MOBILE + '/node_modules/@babel/plugin-transform-modules-commonjs'],
  babelrc: false, configFile: false,
});

// El require que ve el modulo: todo lo nativo stubbeado, MENOS expo-task-manager, que se
// hace fallar a proposito — que es exactamente lo que pasa en un binario que no lo incluye.
const fakeRequire = (id) => {
  // Los helpers que babel externaliza van al require de verdad: no son del binario.
  if (id.startsWith('@babel/runtime')) return require(MOBILE + '/node_modules/' + id);
  if (id === 'expo-task-manager') {
    const e = new Error("Cannot find module 'expo-task-manager'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
  }
  if (id === 'expo-location') return {
    requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    requestBackgroundPermissionsAsync: async () => ({ status: 'granted' }),
    hasStartedLocationUpdatesAsync: async () => false,
    startLocationUpdatesAsync: async () => {},
    stopLocationUpdatesAsync: async () => {},
    Accuracy: { Balanced: 3 }, ActivityType: { AutomotiveNavigation: 3 },
  };
  if (id.includes('async-storage')) return { default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } };
  if (id.includes('config/api')) return { API_CONFIG: { BASE_URL: 'http://x/api' }, tunnelExtraHeaders: () => ({}) };
  return {};
};

const mod = { exports: {} };
const ctx = { require: fakeRequire, module: mod, exports: mod.exports, console, fetch: async () => ({ status: 200 }), setTimeout, clearTimeout };

(async () => {
  try {
    vm.runInNewContext(code, ctx, { filename: 'ubicacionBackground.js' });
    console.log('OK  el modulo carga sin explotar en un binario SIN expo-task-manager');
  } catch (e) {
    console.log('>>> FALLA: el arranque explota ->', e.message);
    process.exit(1);
  }

  const api = mod.exports;
  console.log('OK  disponible() =', api.disponible(), '(false = degrada, correcto)');
  try {
    const r = await Promise.all([
      api.seguimientoActivo(),
      api.iniciarSeguimiento('viaje-1'),
      api.pedirPermisoBackground(),
      api.detenerSeguimiento(),
    ]);
    console.log('OK  las 4 funciones responden sin tirar:', JSON.stringify(r));
    process.exit(0);
  } catch (e) {
    console.log('>>> FALLA: una funcion tiro ->', e.message);
    process.exit(1);
  }
})();
