import { useEffect, useState } from 'react';
import { getDirections } from '../services/mapsService';
import { ordenarStops, puntosDeRuta } from '../utils/routePoints';

/**
 * El recorrido completo de un viaje, listo para dibujar.
 *
 * Se pide a Directions con las coordenadas reales del viaje —origen, las paradas de cada
 * pasajero en el orden del camino y destino—, igual que el mapa del viaje en curso. No se usa
 * ningún trazado guardado: el que se guarda al crear el viaje se calcula antes de que exista
 * ninguna reserva, así que no pasa por los puntos de recogida ni de bajada.
 *
 * Los tres intentos son los mismos que hace el mapa del conductor, y están porque cada uno
 * falla por su cuenta: overview_polyline puede venir vacío, y una parada con coordenadas a la
 * que no se llega por calle hace fallar la ruta ENTERA con waypoints. Sin el reintento sin
 * paradas, una sola parada mal puesta dejaba la pantalla sin ningún trazado.
 *
 * ponytail: TripMapScreen todavía tiene su propia copia de esta lógica, entrelazada con el
 * encuadre del mapa y los marcadores. Vale unificarlas cuando haya que tocar las dos.
 *
 * @param {Object} trip
 * @param {{ enabled?: boolean }} [opts] `enabled: false` no pide nada — para cuando el que
 *   llama ya tiene un trazado guardado y este hook sería una llamada a Directions de más.
 */
export const useTripRoute = (trip, { enabled = true } = {}) => {
  const [coordinates, setCoordinates] = useState([]);
  const [loading, setLoading] = useState(true);

  const origen = trip?.origin?.coordinates;
  const destino = trip?.destination?.coordinates;

  useEffect(() => {
    let cancelado = false;

    if (!enabled || origen?.latitude == null || destino?.latitude == null) {
      setLoading(false);
      return undefined;
    }

    (async () => {
      const orig = `${origen.latitude},${origen.longitude}`;
      const dest = `${destino.latitude},${destino.longitude}`;
      const paradas = ordenarStops(trip)
        .filter((s) => s?.coordinates?.latitude != null && s?.coordinates?.longitude != null)
        .map((s) => `${s.coordinates.latitude},${s.coordinates.longitude}`)
        .join('|');

      try {
        const data = await getDirections(orig, dest, paradas || undefined);
        if (cancelado) return;

        let puntos = puntosDeRuta(data?.routes?.[0]);

        if (puntos.length === 0 && paradas) {
          const simple = await getDirections(orig, dest);
          if (cancelado) return;
          puntos = puntosDeRuta(simple?.routes?.[0]);
        }

        // Última red: la línea recta entre las puntas. No sigue las calles, pero decir "este
        // viaje fue de acá hasta acá" es el trabajo del mapa en esta pantalla, y un mapa vacío
        // no lo hace.
        if (puntos.length === 0) puntos = [origen, destino];

        setCoordinates(puntos);
      } catch {
        if (!cancelado) setCoordinates([origen, destino]);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => { cancelado = true; };
  }, [trip?._id, enabled]);

  return { coordinates, loading };
};

export default useTripRoute;
