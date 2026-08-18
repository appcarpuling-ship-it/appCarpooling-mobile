import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';

/**
 * Al postularse a una solicitud: ¿el conductor hace ese mismo tramo, o viene de más lejos?
 *
 * Era un alert genérico de tres botones. Como pantalla entra lo que en el alert no entraba y
 * es justo lo que hace falta para decidir: el recorrido concreto que se está aceptando, y que
 * el pasajero paga su tramo igual (el desvío no se le cobra a nadie más que a uno mismo).
 *
 * Va como pantalla y no como modal para que sea la misma forma que VehiclePicker, que es el
 * paso inmediatamente anterior del mismo flujo.
 *
 *   navigation.navigate('DriverRoutePicker', { tramo, onSelect })
 *     tramo    { origin, destination } de la solicitud, para mostrar qué se acepta
 *     onSelect ('mismo' | 'propio') => void
 */
const DriverRoutePickerScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { tramo = {}, onSelect } = route.params || {};

  const elegir = (opcion) => {
    navigation.goBack();
    onSelect?.(opcion);
  };

  const ciudad = (p) => p?.city || p?.address || '';
  const detalle = (p) => (p?.address && p.address !== p.city ? p.address : '');

  const opciones = [
    {
      key: 'mismo',
      icono: 'swap-horizontal-outline',
      titulo: 'Hago este mismo tramo',
      // El recorrido concreto en vez de una descripción abstracta: es lo que se está aceptando.
      detalle: [ciudad(tramo.origin), ciudad(tramo.destination)].filter(Boolean).join('  →  '),
      pie: [detalle(tramo.origin), detalle(tramo.destination)].filter(Boolean).join('  →  '),
    },
    {
      key: 'propio',
      icono: 'git-branch-outline',
      titulo: 'Vengo de más lejos o sigo más allá',
      detalle: 'Elegí en el mapa desde dónde salís y hasta dónde vas',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: ui.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={[styles.headerBtn, { backgroundColor: ui.surface }]}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={20} color={ui.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: ui.text }]}>Tu recorrido</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.intro, { color: ui.textMuted }]}>
          Contanos por dónde pasás. El pasajero lo ve antes de elegirte.
        </Text>

        {opciones.map((o) => (
          <TouchableOpacity
            key={o.key}
            style={[styles.opcion, { backgroundColor: ui.surface, borderColor: ui.border }]}
            onPress={() => elegir(o.key)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={o.titulo}
          >
            <View style={[styles.iconoWrap, { backgroundColor: ui.invertBg }]}>
              <Ionicons name={o.icono} size={18} color={ui.invertText} />
            </View>
            <View style={styles.textos}>
              <Text style={[styles.opcionTitulo, { color: ui.text }]}>{o.titulo}</Text>
              {!!o.detalle && (
                <Text style={[styles.opcionDetalle, { color: ui.textMuted }]} numberOfLines={2}>
                  {o.detalle}
                </Text>
              )}
              {!!o.pie && (
                <Text style={[styles.opcionPie, { color: ui.textMuted }]} numberOfLines={1}>
                  {o.pie}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={ui.textMuted} />
          </TouchableOpacity>
        ))}

        {/* La duda que aparece sola al leer "vengo de más lejos": si eso le sale más caro al
            pasajero. No: paga su tramo y nada más. */}
        <View style={styles.nota}>
          <Ionicons name="information-circle-outline" size={15} color={ui.textMuted} />
          <Text style={[styles.notaText, { color: ui.textMuted }]}>
            Viajes lo que viajes, el pasajero paga sólo su tramo.
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: 'Sora_700Bold', fontSize: 20, letterSpacing: -0.5, textAlign: 'center' },

  body: { paddingHorizontal: 24, paddingTop: 16, gap: 12 },
  intro: { fontFamily: 'Sora_400Regular', fontSize: 14, lineHeight: 20, marginBottom: 4 },

  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconoWrap: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 3 },
  opcionTitulo: { fontFamily: 'Sora_600SemiBold', fontSize: 15, lineHeight: 20 },
  opcionDetalle: { fontFamily: 'Sora_500Medium', fontSize: 13, lineHeight: 18 },
  opcionPie: { fontFamily: 'Sora_400Regular', fontSize: 11, lineHeight: 15, opacity: 0.8 },

  nota: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingHorizontal: 4, marginTop: 4 },
  notaText: { flex: 1, fontFamily: 'Sora_400Regular', fontSize: 12, lineHeight: 17 },
});

export default DriverRoutePickerScreen;
