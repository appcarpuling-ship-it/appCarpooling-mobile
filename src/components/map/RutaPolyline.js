import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Polyline } from 'react-native-maps';

/** Marca de version del bundle, para el cartel de diagnostico. Subir al tocar algo del mapa. */
export const VERSION_MAPA = 'v5-nudge';

/**
 * Una línea de ruta que iOS efectivamente dibuja.
 *
 * Dos cosas distintas, las dos de iOS + Google Maps:
 *
 * 1. EL COLOR. `AIRGoogleMapPolyline` arranca con
 *    `spans = @[[GMSStyleSpan spanWithColor:_strokeColor]]` y `_strokeColor` es nil; en el SDK
 *    de Google los spans mandan sobre `strokeColor`, y `setStrokeColor:` no los rehace salvo
 *    que haya `lineDashPattern`. `fillColor` sí los rehace, con un span sólido.
 *
 * 2. QUE SE PINTE. El trazado recién agregado se queda invisible hasta que le CAMBIAN LAS
 *    PROPS estando ya puesto. Se veía al tocar un marcador (el re-render reenvía las props) y
 *    en un viaje en curso, donde la posición del conductor re-renderiza cada 8 segundos; en un
 *    viaje sin arrancar no pasa nada nunca y la línea no aparecía jamás.
 *
 *    De ahí el empujón de abajo. Importa que sea un cambio de props y NO un remonte por `key`:
 *    remontar crea un polyline nuevo, que nace con exactamente el mismo problema — probado, no
 *    funcionó. Hay que tocar el que ya está. Se reenvían las coordenadas (array nuevo) y se
 *    mueve el ancho una centésima, invisible en pantalla y suficiente para que la prop cambie.
 *
 * ponytail: es un parche, no una explicación del bug de la librería. Si algún día se actualiza
 * react-native-maps, probar sacándolo: es borrar `empujon` y sus dos usos.
 */
const RutaPolyline = ({ coordinates, color = '#000000', width = 5, ...rest }) => {
  const [empujon, setEmpujon] = useState(false);

  useEffect(() => {
    if (!coordinates?.length) return undefined;
    setEmpujon(false);
    const t = setTimeout(() => setEmpujon(true), 500);
    return () => clearTimeout(t);
  }, [coordinates]);

  return (
    <Polyline
      coordinates={empujon ? [...coordinates] : coordinates}
      strokeColor={color}
      {...(Platform.OS === 'ios' ? { fillColor: color } : null)}
      strokeWidth={empujon ? width + 0.01 : width}
      lineCap="round"
      lineJoin="round"
      {...rest}
    />
  );
};

export default RutaPolyline;
