import React from 'react';
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
 * y en el SDK de Google los `spans` MANDAN sobre `strokeColor`. `setStrokeColor:` asigna la
 * propiedad pero sólo rehace los spans si además hay `lineDashPattern`, así que ese span de
 * color nulo del init sobrevive y la línea sale del azul por defecto.
 *
 * La salida es `fillColor`, que en esta clase no pinta ningún relleno —una línea no tiene
 * interior— sino que hace exactamente esto:
 *
 *     _polyline.spans = @[[GMSStyleSpan spanWithColor:fillColor]];
 *
 * Es decir, el mismo camino que ya sabemos que dibuja la línea ENTERA (así se dibujaba la
 * azul), pero con un color de verdad en vez de nil.
 *
 * Antes probé `strokeColors`, que también reconstruye los spans pero arma UNO POR COLOR con
 * estilos de degradado. Con eso la línea directamente dejó de verse, así que no: un solo span
 * sólido, que es la forma que está demostrado que cubre todo el trazado.
 *
 * En Android no se manda nada de esto: ahí `strokeColor` funciona.
 */
const RutaPolyline = ({ coordinates, color = '#000000', width = 5, ...rest }) => (
  <Polyline
    coordinates={coordinates}
    strokeColor={color}
    {...(Platform.OS === 'ios' ? { fillColor: color } : null)}
    strokeWidth={width}
    lineCap="round"
    lineJoin="round"
    {...rest}
  />
);

export default RutaPolyline;
