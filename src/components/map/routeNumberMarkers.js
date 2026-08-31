/**
 * PNGs de los marcadores numerados del recorrido (1..11), en gris para las paradas y negro para
 * el destino. Se usan como `<Marker image=>` en Android: una vista custom no sigue bien su
 * coordenada cuando la cámara se mueve y el numerito termina lejos del trazado. El require debe
 * ser estático (Metro no resuelve rutas armadas), de ahí este mapa.
 *
 * iOS sigue dibujando la vista custom (`styles.routeMarker`), que ahí funciona bien.
 */
const NUM = [
  null, // índice 0 sin usar: la numeración arranca en 1
  require('../../../assets/map/route-num-1.png'),
  require('../../../assets/map/route-num-2.png'),
  require('../../../assets/map/route-num-3.png'),
  require('../../../assets/map/route-num-4.png'),
  require('../../../assets/map/route-num-5.png'),
  require('../../../assets/map/route-num-6.png'),
  require('../../../assets/map/route-num-7.png'),
  require('../../../assets/map/route-num-8.png'),
  require('../../../assets/map/route-num-9.png'),
  require('../../../assets/map/route-num-10.png'),
  require('../../../assets/map/route-num-11.png'),
];

const NUM_END = [
  null,
  require('../../../assets/map/route-num-1-end.png'),
  require('../../../assets/map/route-num-2-end.png'),
  require('../../../assets/map/route-num-3-end.png'),
  require('../../../assets/map/route-num-4-end.png'),
  require('../../../assets/map/route-num-5-end.png'),
  require('../../../assets/map/route-num-6-end.png'),
  require('../../../assets/map/route-num-7-end.png'),
  require('../../../assets/map/route-num-8-end.png'),
  require('../../../assets/map/route-num-9-end.png'),
  require('../../../assets/map/route-num-10-end.png'),
  require('../../../assets/map/route-num-11-end.png'),
];

/** El PNG del marcador para la posición `n` (1-based). `isEnd` = destino (negro). */
export function routeNumberImage(n, isEnd) {
  const tabla = isEnd ? NUM_END : NUM;
  return tabla[n] || tabla[tabla.length - 1];
}
