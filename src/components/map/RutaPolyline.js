import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Polyline } from 'react-native-maps';

/** Marca de version del bundle, para el cartel de diagnostico. Subir al cambiar algo del mapa. */
export const VERSION_MAPA = 'v4-remonta';

/**
 * Una línea de ruta que iOS efectivamente dibuja.
 *
 * Dos cosas distintas, las dos de iOS + Google Maps:
 *
 * 1. EL COLOR. `AIRGoogleMapPolyline` arranca con
 *    `spans = @[[GMSStyleSpan spanWithColor:_strokeColor]]` y `_strokeColor` es nil; en el SDK
 *    de Google los spans mandan sobre `strokeColor`, y `setStrokeColor:` no rehace los spans
 *    salvo que haya `lineDashPattern`. `fillColor` sí los rehace con un span sólido, que es el
 *    mismo camino que ya sabemos que cubre la línea entera.
 *
 * 2. QUE SE PINTE. El trazado recién agregado se queda invisible hasta que algo le cambia las
 *    props: tocando un marcador aparecía, y en un viaje en curso se veía siempre porque la
 *    posición del conductor re-renderiza cada 8 segundos. En un viaje sin arrancar no pasa
 *    nada nunca, y la línea no se dibujaba jamás.
 *
 *    Por eso el remonte de abajo. Intentar la `key` con `mapReady` en la pantalla NO alcanza:
 *    el mapa está listo antes de que llegue la ruta, así que la key nace con su valor final y
 *    no cambia nunca. Tiene que ser después de montar el trazado, y por eso va acá adentro.
 *
 * ponytail: un remonte a destiempo es un parche, no una explicación. Si algún día se actualiza
 * react-native-maps, probar sacándolo — el `tick` es lo único que hay que borrar.
 */
const RutaPolyline = ({ coordinates, color = '#000000', width = 5, ...rest }) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!coordinates?.length) return undefined;
    setTick(0);
    const t = setTimeout(() => setTick(1), 600);
    return () => clearTimeout(t);
  }, [coordinates]);

  return (
    <Polyline
      key={`ruta-${tick}`}
      coordinates={coordinates}
      strokeColor={color}
      {...(Platform.OS === 'ios' ? { fillColor: color } : null)}
      strokeWidth={width}
      lineCap="round"
      lineJoin="round"
      {...rest}
    />
  );
};

export default RutaPolyline;
