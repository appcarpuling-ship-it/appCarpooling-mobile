import { useEffect, useState } from 'react';
import { getDirections } from '../services/mapsService';
import { decodePolyline, ordenarStops } from '../utils/routePoints';

/**
 * El recorrido completo de un viaje, listo para dibujar.
 *
 * Se pide a Directions con las coordenadas reales del viaje —origen, las paradas de cada
 * pasajero en el orden del camino y destino—, igual que el mapa del viaje en curso. No se usa
 * ningún trazado guardado: el que se guarda al crear el viaje se calcula antes de que exista
 * ninguna reserva, así que no pasa por los puntos de recogida ni de bajada.
 *
 * ponytail: TripMapScreen todavía tiene su propia copia de esta lógica, entrelazada con el
 * encuadre del mapa y los marcadores. Vale unificarlas cuando haya que tocar las dos.
 */
export const useTripRoute = (trip) => {
  const [coordinates, setCoordinates] = useState([]);
  const [loading, setLoading] = useState(true);

  const origen = trip?.origin?.coordinates;
  const destino = trip?.destination?.coordinates;

  useEffect(() => {
    let cancelado = false;

    if (origen?.latitude == null || destino?.latitude == null) {
      setLoading(false);
      return undefined;
    }

    (async () => {
      try {
        const paradas = ordenarStops(trip)
          .filter((s) => s?.coordinates?.latitude != null && s?.coordinates?.longitude != null)
          .map((s) => `${s.coordinates.latitude},${s.coordinates.longitude}`)
          .join('|');

        const data = await getDirections(
          `${origen.latitude},${origen.longitude}`,
          `${destino.latitude},${destino.longitude}`,
          paradas || undefined,
        );
        if (cancelado) return;

        const ruta = data?.routes?.[0];
        // overview_polyline es la geometría que Google simplifica PARA MOSTRAR: sigue las
        // calles y trae una cantidad de puntos razonable.
        const puntos = ruta?.overview_polyline?.points ? decodePolyline(ruta.overview_polyline.points) : [];
        setCoordinates(puntos);
      } catch {
        /* sin ruta: el mapa igual encuadra las puntas */
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => { cancelado = true; };
  }, [trip?._id]);

  return { coordinates, loading };
};

export default useTripRoute;
