import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import { imageForType } from '../../utils/vehicleImage';
import { buildImageUri } from '../../services/apiService';

const { height: SCREEN_H } = Dimensions.get('window');
// La foto ocupa poco más de un tercio: lo suficiente para que el auto se reconozca de un
// vistazo sin comerse los detalles, que son lo que hay que poder leer scrolleando.
const HERO_H = Math.min(Math.round(SCREEN_H * 0.36), 320);

const FEATURES = [
  { key: 'ac', label: 'A/C', icon: 'snow-outline' },
  { key: 'music', label: 'Música', icon: 'musical-notes-outline' },
  { key: 'smoking', label: 'Se puede fumar', icon: 'flame-outline' },
  { key: 'pets', label: 'Mascotas', icon: 'paw-outline' },
  { key: 'luggage', label: 'Equipaje grande', icon: 'bag-handle-outline' },
];

// Mismas etiquetas que el selector de VehicleFormScreen: si difieren, el mismo tipo se
// muestra con dos nombres distintos según la pantalla.
const TYPE_LABELS = {
  sedan: 'Auto',
  hatchback: 'Auto',
  suv: 'Auto-camioneta',
  van: 'Camioneta',
  pickup: 'Camioneta',
  otro: 'Otro',
};

const fecha = (d) => {
  const t = d ? new Date(d) : null;
  if (!t || isNaN(t)) return null;
  return t.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * Estado de un papel del vehículo, leyendo el vencimiento como lo que importa: un seguro
 * vencido es tan inservible como no tenerlo, así que no alcanza con "cargado / no cargado".
 */
const estadoDoc = (url, vence) => {
  if (!url) return { icon: 'ellipse-outline', texto: 'Falta cargarlo', alerta: true };
  const f = vence ? new Date(vence) : null;
  if (f && !isNaN(f) && f < new Date()) return { icon: 'alert-circle', texto: `Vencido el ${fecha(vence)}`, alerta: true };
  if (f && !isNaN(f)) return { icon: 'checkmark-circle', texto: `Vence el ${fecha(vence)}`, alerta: false };
  return { icon: 'checkmark-circle', texto: 'Cargado', alerta: false };
};

/**
 * Un vehículo a página completa: la foto arriba y todo el detalle scrolleando abajo.
 *
 * Lo usan "Mis vehículos" y el selector de vehículo para un viaje, que son la misma pantalla
 * con distintos botones: `acciones` son los circulitos que flotan sobre la foto —editar y
 * borrar en la lista propia, ninguno cuando sólo se está eligiendo—.
 *
 * @param {Object} vehicle
 * @param {number} width     ancho de la página; lo fija el carrusel que la contiene
 * @param {Array}  acciones  [{ icon, onPress, label }], arriba a la derecha de la foto
 */
const VehicleShowcase = ({ vehicle, width, acciones = [] }) => {
  const ui = useUI();
  const [fotoIndex, setFotoIndex] = useState(0);

  const fotos = (vehicle.photos || []).filter(Boolean);
  // `photo` es el campo viejo de una sola foto, y su default es una de picsum que no es el
  // auto de nadie: se ignora, como ya hacía la lista.
  const fotoSuelta = vehicle.photo && !vehicle.photo.includes('picsum') ? vehicle.photo : null;
  const galeria = fotos.length ? fotos : (fotoSuelta ? [fotoSuelta] : []);
  const fotoActual = galeria[Math.min(fotoIndex, galeria.length - 1)];

  const activas = FEATURES.filter((f) => vehicle.features?.[f.key]);
  const tipo = TYPE_LABELS[vehicle.type] || vehicle.type;
  const subtitulo = [vehicle.year, tipo, vehicle.color].filter(Boolean).join(' · ');

  const docs = [
    { label: 'Seguro', ...estadoDoc(vehicle.insuranceUrl, vehicle.insuranceExpiry) },
    { label: 'VTV / RTO', ...estadoDoc(vehicle.inspectionUrl, vehicle.inspectionExpiry) },
    { label: 'Cédula verde', ...estadoDoc(vehicle.registrationCardUrl, null) },
  ];

  const carga = [
    vehicle.cargoSpaceLiters ? `${vehicle.cargoSpaceLiters} L de baúl` : null,
    vehicle.maxCargoWeightKg ? `hasta ${vehicle.maxCargoWeightKg} kg` : null,
  ].filter(Boolean);

  return (
    <View style={{ width, flex: 1 }}>
      <View style={[styles.hero, { height: HERO_H, backgroundColor: ui.surface }]}>
        {fotoActual ? (
          <Image source={{ uri: buildImageUri(fotoActual) }} style={styles.heroImg} resizeMode="cover" />
        ) : (
          // Sin fotos, el dibujo del tipo. El ícono genérico de auto hacía que una camioneta
          // y un sedán sin fotos se vieran idénticos.
          <Image source={imageForType(vehicle.type)} style={styles.heroFallback} resizeMode="contain" />
        )}

        {acciones.length > 0 && (
          <View style={styles.acciones}>
            {acciones.map((a) => (
              <TouchableOpacity
                key={a.icon}
                style={[styles.accionBtn, { backgroundColor: ui.bg }]}
                onPress={a.onPress}
                hitSlop={8}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <Ionicons name={a.icon} size={19} color={ui.text} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <ScrollView
        style={styles.detalle}
        contentContainerStyle={styles.detalleContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.nombre, { color: ui.text }]} numberOfLines={2}>
          {vehicle.brand} {vehicle.model}
        </Text>
        {!!subtitulo && <Text style={[styles.subtitulo, { color: ui.textMuted }]}>{subtitulo}</Text>}

        <View style={styles.chips}>
          {!!vehicle.licensePlate && (
            <View style={[styles.chip, { backgroundColor: ui.invertBg }]}>
              <Text style={[styles.chipText, { color: ui.invertText }]}>{vehicle.licensePlate}</Text>
            </View>
          )}
          {!!vehicle.capacity && (
            <View style={[styles.chip, { backgroundColor: ui.surface }]}>
              <Text style={[styles.chipText, { color: ui.text }]}>{vehicle.capacity} asientos</Text>
            </View>
          )}
        </View>

        {/* Miniaturas: tocarlas cambia la foto grande, en vez de ser una fila decorativa. */}
        {galeria.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.miniaturas}>
            {galeria.map((foto, i) => (
              <TouchableOpacity key={`${foto}-${i}`} onPress={() => setFotoIndex(i)} activeOpacity={0.8}>
                <Image
                  source={{ uri: buildImageUri(foto) }}
                  style={[
                    styles.miniatura,
                    { backgroundColor: ui.surface, borderColor: i === fotoIndex ? ui.text : 'transparent' },
                  ]}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {activas.length > 0 && (
          <View style={styles.bloque}>
            <Text style={[styles.bloqueTitulo, { color: ui.textMuted }]}>COMODIDADES</Text>
            <View style={styles.chips}>
              {activas.map((f) => (
                <View key={f.key} style={[styles.chip, styles.chipIcono, { backgroundColor: ui.surface }]}>
                  <Ionicons name={f.icon} size={13} color={ui.text} />
                  <Text style={[styles.chipText, { color: ui.text }]}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.bloque}>
          <Text style={[styles.bloqueTitulo, { color: ui.textMuted }]}>DOCUMENTACIÓN</Text>
          {docs.map((d) => (
            <View key={d.label} style={styles.docFila}>
              <Ionicons name={d.icon} size={16} color={d.alerta ? ui.textMuted : ui.text} />
              <Text style={[styles.docLabel, { color: ui.text }]}>{d.label}</Text>
              <Text style={[styles.docEstado, { color: ui.textMuted }]}>{d.texto}</Text>
            </View>
          ))}
        </View>

        {carga.length > 0 && (
          <View style={styles.bloque}>
            <Text style={[styles.bloqueTitulo, { color: ui.textMuted }]}>CARGA</Text>
            <Text style={[styles.cargaText, { color: ui.text }]}>{carga.join(' · ')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { borderRadius: 24, overflow: 'hidden', marginHorizontal: 16 },
  heroImg: { width: '100%', height: '100%' },
  heroFallback: { width: '100%', height: '100%', padding: 24 },
  acciones: { position: 'absolute', top: 12, right: 12, gap: 10 },
  accionBtn: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },

  detalle: { flex: 1 },
  detalleContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  nombre: { fontFamily: 'Sora_800ExtraBold', fontSize: 24, letterSpacing: -0.6 },
  subtitulo: { fontFamily: 'Sora_500Medium', fontSize: 13, marginTop: 4 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  chipIcono: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipText: { fontFamily: 'Sora_600SemiBold', fontSize: 12 },

  miniaturas: { gap: 8, paddingTop: 14, paddingRight: 4 },
  miniatura: { width: 68, height: 68, borderRadius: 14, borderWidth: 2 },

  bloque: { marginTop: 22 },
  bloqueTitulo: { fontFamily: 'Sora_600SemiBold', fontSize: 11, letterSpacing: 0.6 },
  docFila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  docLabel: { fontFamily: 'Sora_500Medium', fontSize: 14, flex: 1 },
  docEstado: { fontFamily: 'Sora_400Regular', fontSize: 12 },
  cargaText: { fontFamily: 'Sora_500Medium', fontSize: 14, marginTop: 8 },
});

export default VehicleShowcase;
