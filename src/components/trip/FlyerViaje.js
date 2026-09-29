import React, { forwardRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { buildImageUri } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { fechaLegible } from '../../utils/fechaViaje';

const ANCHO = 360;
const ALTO = 640; // 9:16 — mismo formato que la imagen de fondo (1080x1920)

const iniciales = (nombre) =>
  nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

/**
 * El flyer que se comparte de un viaje publicado.
 *
 * La imagen de fondo (`ENDPOINTS.FLYER_BACKGROUND`, servida por el backend) ya ES un flyer
 * terminado: trae su propio título arriba ("Nuevo viaje en Carpuling") y su marca al pie
 * ("Carpuling · Viajá distinto"). Por eso acá NO se dibuja ni logo ni encabezado propio, y NO
 * hay degradé de pantalla completa: taparía el atardecer y borraría el pie.
 *
 * Los datos se apoyan en las dos franjas que el diseño dejó libres:
 *   - el cielo (~28-45%), debajo del título
 *   - el asfalto (~62-85%), arriba del pie — ya es oscuro, así que el texto blanco se lee solo
 * Cada franja lleva un velo suave y sombra en el texto por si algún día se cambia la foto por
 * una más clara.
 *
 * Se monta fuera de la pantalla en TripDetailScreen: no es UI, es lo que
 * react-native-view-shot captura como PNG al tocar "Compartir".
 *
 * `allowFontScaling={false}` en todo: es una imagen que se exporta, tiene que salir igual sin
 * importar el tamaño de letra del sistema de quien la genera.
 */
const FlyerViaje = forwardRef(({ trip }, ref) => {
  if (!trip) return null;

  const nombreConductor = [trip.driver?.firstName, trip.driver?.lastName].filter(Boolean).join(' ');
  const precio = trip.sinPrecioFijo
    ? { etiqueta: 'Modalidad', valor: 'Gastos compartidos', chico: true }
    : { etiqueta: 'Por asiento', valor: `$${Number(trip.driverPrice || 0).toLocaleString('es-AR')}` };

  return (
    <View ref={ref} collapsable={false} style={styles.flyer}>
      <Image
        source={{ uri: buildImageUri(ENDPOINTS.FLYER_BACKGROUND) }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      {/* Franja del cielo: ruta y salida */}
      <View style={styles.bloqueRuta}>
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Text allowFontScaling={false} style={styles.ciudad} numberOfLines={1}>{trip.origin?.city}</Text>
        <Text allowFontScaling={false} style={styles.flecha}>↓</Text>
        <Text allowFontScaling={false} style={styles.ciudad} numberOfLines={1}>{trip.destination?.city}</Text>

        <View style={styles.pildora}>
          <Text allowFontScaling={false} style={styles.pildoraTexto}>{fechaLegible(new Date(trip.departureDate))}</Text>
          <View style={styles.punto} />
          <Text allowFontScaling={false} style={styles.pildoraTexto}>{trip.departureTime}</Text>
        </View>
      </View>

      {/* Franja del asfalto: precio y conductor */}
      <View style={styles.bloqueDatos}>
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.5)']}
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFill}
        />
        <Text allowFontScaling={false} style={styles.precioEtiqueta}>{precio.etiqueta}</Text>
        <Text
          allowFontScaling={false}
          style={[styles.precioValor, precio.chico && styles.precioValorChico]}
          numberOfLines={1}
        >
          {precio.valor}
        </Text>

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
      </View>
    </View>
  );
});

// Sombra pareja en todo el texto: es lo que lo salva si la foto de fondo cambia por una clara.
const sombra = {
  textShadowColor: 'rgba(0,0,0,0.75)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
};

const styles = StyleSheet.create({
  flyer: {
    width: ANCHO,
    height: ALTO,
    backgroundColor: '#0A0A0A',
    overflow: 'hidden',
  },

  // Porcentajes y no píxeles: si mañana cambian ANCHO/ALTO, las franjas siguen cayendo sobre
  // las mismas zonas de la foto.
  bloqueRuta: {
    position: 'absolute',
    left: 0, right: 0,
    top: ALTO * 0.27,
    paddingHorizontal: 28,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ciudad: { color: '#FFFFFF', fontSize: 27, fontWeight: '800', letterSpacing: -0.6, lineHeight: 31, ...sombra },
  flecha: { color: '#FFFFFF', opacity: 0.85, fontSize: 16, fontWeight: '700', marginVertical: 1, ...sombra },

  pildora: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 15, paddingVertical: 8,
  },
  pildoraTexto: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  punto: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF', opacity: 0.6 },

  bloqueDatos: {
    position: 'absolute',
    left: 0, right: 0,
    top: ALTO * 0.63,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 18,
  },
  precioEtiqueta: { color: '#FFFFFF', opacity: 0.75, fontSize: 12, fontWeight: '600', ...sombra },
  precioValor: { color: '#FFFFFF', fontSize: 42, fontWeight: '800', letterSpacing: -1.2, ...sombra },
  precioValorChico: { fontSize: 26, letterSpacing: -0.6 },

  conductor: {
    marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  avatar: { width: 30, height: 30, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  conductorEtiqueta: { color: '#FFFFFF', opacity: 0.7, fontSize: 10, fontWeight: '600', letterSpacing: 0.4, ...sombra },
  conductorNombre: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', ...sombra },
});

FlyerViaje.ANCHO = ANCHO;
FlyerViaje.ALTO = ALTO;

export default FlyerViaje;
