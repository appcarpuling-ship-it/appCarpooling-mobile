import React, { useMemo } from 'react';
import { Platform } from 'react-native';
import { Polyline } from 'react-native-maps';

/**
 * Una línea de ruta del color que se le pide. En iPhone eso no es gratis.
 *
 * `AIRGoogleMapPolyline` (react-native-maps 1.20.1, AirGoogleMaps/AIRGoogleMapPolyline.m)
 * arranca así:
 *
 *     _polyline.spans = @[[GMSStyleSpan spanWithColor:_strokeColor]];  // _strokeColor es nil
 *
 * y en el SDK de Google los `spans` MANDAN sobre `strokeColor`. Después `setStrokeColor:`
 * asigna la propiedad pero sólo rehace los spans si además hay `lineDashPattern`
 * (`configureStyleSpansIfNeeded` corta con `if (!_strokeColor || !_lineDashPattern ...)`),
 * así que el span de color nulo del init sobrevive y la línea sale del azul por defecto por
 * más que se le pase negro. Por eso las rutas seguían azules en iPhone y no en Android.
 *
 * La única puerta que queda desde JS es `strokeColors`, que sí reconstruye los spans. Exige
 * UN COLOR POR COORDENADA: con menos —el `['#010101']` de antes— sólo se pinta el primer
 * tramo y el resto vuelve al azul, que es exactamente lo que se veía. Todos iguales da una
 * línea sólida, porque el degradado de negro a negro es negro.
 *
 * En Android no se manda: ahí `strokeColor` funciona y no hace falta un array por punto.
 */
const RutaPolyline = ({ coordinates, color = '#000000', width = 5, ...rest }) => {
  const colores = useMemo(
    () => (Platform.OS === 'ios' ? coordinates.map(() => color) : undefined),
    [coordinates, color],
  );

  return (
    <Polyline
      coordinates={coordinates}
      strokeColor={color}
      strokeColors={colores}
      strokeWidth={width}
      lineCap="round"
      lineJoin="round"
      {...rest}
    />
  );
};

export default RutaPolyline;
