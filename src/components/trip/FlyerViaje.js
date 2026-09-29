import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { buildImageUri } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { fechaLegible } from '../../utils/fechaViaje';

const ANCHO = 360;
const ALTO = 640; // 9:16, formato historia — Whatsapp Status / Instagram Stories

const iniciales = (nombre) =>
  nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

/**
 * El flyer que se comparte de un viaje publicado: el fondo (servido por el backend —
 * `ENDPOINTS.FLYER_BACKGROUND` — así se puede cambiar el diseño sin tocar la app) más los datos
 * del viaje encima.
 *
 * Se monta siempre en TripDetailScreen, fuera de la pantalla (ver ese archivo): no es algo que
 * la persona vea, es lo que `react-native-view-shot` captura como imagen al tocar "Compartir".
 *
 * `allowFontScaling={false}` en todo el texto a propósito: es una imagen que se exporta, tiene
 * que verse igual sin importar el tamaño de letra del sistema de quien la genera.
 */
const FlyerViaje = forwardRef(({ trip }, ref) => {
  if (!trip) return null;

  const nombreConductor = [trip.driver?.firstName, trip.driver?.lastName].filter(Boolean).join(' ');
  const precio = trip.sinPrecioFijo
    ? { etiqueta: 'Modalidad', valor: 'Gastos compartidos' }
    : { etiqueta: 'Por asiento', valor: `$${Number(trip.driverPrice || 0).toLocaleString('es-AR')}` };

  return (
    <View ref={ref} collapsable={false} style={styles.flyer}>
      <Image
        source={{ uri: buildImageUri(ENDPOINTS.FLYER_BACKGROUND) }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      {/* El texto es blanco fijo: el degradé asegura contraste sin importar qué tan clara sea
          la foto de fondo que se suba después. */}
      <LinearGradient
        colors={['rgba(10,10,10,0.55)', 'rgba(10,10,10,0.75)', '#0A0A0A']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.contenido}>
        <Text allowFontScaling={false} style={styles.marca}>CARPULING</Text>

        <View style={styles.ruta}>
          <Text allowFontScaling={false} style={styles.rutaEtiqueta}>VIAJE DISPONIBLE</Text>
          <Text allowFontScaling={false} style={styles.ciudad} numberOfLines={1}>{trip.origin?.city}</Text>
          <Text allowFontScaling={false} style={styles.flecha}>↓</Text>
          <Text allowFontScaling={false} style={styles.ciudad} numberOfLines={1}>{trip.destination?.city}</Text>
        </View>

        <View style={styles.pildora}>
          <Text allowFontScaling={false} style={styles.pildoraTexto}>{fechaLegible(new Date(trip.departureDate))}</Text>
          <View style={styles.punto} />
          <Text allowFontScaling={false} style={styles.pildoraTexto}>{trip.departureTime}</Text>
        </View>

        <View style={{ flex: 1 }} />

        <View>
          <Text allowFontScaling={false} style={styles.precioEtiqueta}>{precio.etiqueta}</Text>
          <Text allowFontScaling={false} style={styles.precioValor} numberOfLines={1}>{precio.valor}</Text>
        </View>

        {!!nombreConductor && (
          <View style={styles.conductor}>
            <View style={styles.avatar}>
              <Text allowFontScaling={false} style={styles.avatarTexto}>{iniciales(nombreConductor)}</Text>
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text allowFontScaling={false} style={styles.conductorEtiqueta}>CONDUCTOR</Text>
              <Text allowFontScaling={false} style={styles.conductorNombre} numberOfLines={1}>{nombreConductor}</Text>
            </View>
          </View>
        )}

        <Text allowFontScaling={false} style={styles.cta}>Escribime para reservar tu lugar.</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  flyer: {
    width: ANCHO,
    height: ALTO,
    backgroundColor: '#0A0A0A',
    overflow: 'hidden',
  },
  contenido: {
    flex: 1,
    padding: 28,
    paddingTop: 32,
  },
  marca: { color: '#FFFFFF', opacity: 0.7, fontSize: 12, fontWeight: '700', letterSpacing: 3 },

  ruta: { marginTop: 44 },
  rutaEtiqueta: { color: '#FFFFFF', opacity: 0.55, fontSize: 11, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase' },
  ciudad: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: -0.8, lineHeight: 36, marginTop: 6 },
  flecha: { color: '#FFFFFF', opacity: 0.55, fontSize: 18, fontWeight: '600', marginVertical: 2 },

  pildora: {
    marginTop: 22, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9,
  },
  pildoraTexto: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  punto: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF', opacity: 0.5 },

  precioEtiqueta: { color: '#FFFFFF', opacity: 0.6, fontSize: 12, fontWeight: '500' },
  precioValor: { color: '#FFFFFF', fontSize: 44, fontWeight: '800', letterSpacing: -1.2 },

  conductor: {
    marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  avatar: { width: 30, height: 30, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  conductorEtiqueta: { color: '#FFFFFF', opacity: 0.55, fontSize: 10, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  conductorNombre: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  cta: { color: '#FFFFFF', opacity: 0.7, fontSize: 12, fontWeight: '500', marginTop: 14 },
});

FlyerViaje.ANCHO = ANCHO;
FlyerViaje.ALTO = ALTO;

export default FlyerViaje;
