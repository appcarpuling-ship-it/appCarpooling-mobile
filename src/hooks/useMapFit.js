import { useEffect, useState } from 'react';

/**
 * Encuadra el mapa cuando el mapa Y las coordenadas estén listos, sin importar cuál llegue
 * primero.
 *
 * Antes cada pantalla hacía `setTimeout(() => mapRef.current.fitToCoordinates(...), 300)` en
 * cuanto tenía la ruta. Si a los 300 ms el mapa nativo todavía no había terminado de
 * inicializar —cosa habitual en la primera apertura, y más en iPhone—, `fitToCoordinates` no
 * hacía nada, no fallaba, y no había segundo intento: la cámara se quedaba en la región
 * inicial, un cuadrito alrededor del origen. El trazado estaba dibujado entero, pero de un
 * viaje de 500 km se veían los primeros veinte y el resto salía de pantalla.
 *
 * Devuelve la función con la que se pide el encuadre. Guardar las coordenadas en estado, y no
 * llamar directo, es lo que permite reintentarlo cuando el mapa avisa que está listo.
 *
 * @param {Object} mapRef ref al MapView
 * @param {boolean} mapReady lo que setea onMapReady
 * @param {Object} edgePadding margen alrededor del trazado
 */
export const useMapFit = (mapRef, mapReady, edgePadding) => {
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (!mapReady || !coords?.length) return undefined;
    // Un respiro: el mapa avisa que está listo un pelo antes de poder mover la cámara.
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, { edgePadding, animated: true });
    }, 150);
    return () => clearTimeout(t);
  }, [mapReady, coords]);

  return setCoords;
};

export default useMapFit;
