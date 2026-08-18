import { Platform } from 'react-native';
import { PROVIDER_GOOGLE } from 'react-native-maps';

/**
 * Qué motor de mapas usa cada plataforma.
 *
 * - **Android**: Google Maps, que ahí ES el mapa nativo del sistema.
 * - **iOS**: MapKit (Apple), que es el nativo de iPhone. `undefined` es como se pide en
 *   react-native-maps — de hecho es su default, Google hay que pedirlo explícitamente.
 *
 * Por qué se dejó de forzar Google en iOS: el SDK de Google (`GMSMapView`) es mucho más pesado
 * y no libera bien la memoria entre montajes. Con la app abriendo y cerrando el mapa varias
 * veces, la RAM crecía hasta que el watchdog de iOS mataba la app — confirmado en Sentry con
 * WatchdogTermination y eventos LOW_MEMORY, en un iPhone de 7,4 GB.
 *
 * Lo que se usa funciona igual en los dos: marcadores, polyline, región controlada, punto de
 * ubicación, onPress y onRegionChange. Cambia el estilo visual, no el comportamiento. Y
 * `followsUserLocation` sólo está implementado para Apple, así que ahí incluso se gana.
 *
 * Vive acá y no repetido en cada pantalla para que cambiar de motor sea tocar un solo lugar:
 * son cuatro mapas y que uno quede con otro proveedor es un bug difícil de ver.
 */
export const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;
