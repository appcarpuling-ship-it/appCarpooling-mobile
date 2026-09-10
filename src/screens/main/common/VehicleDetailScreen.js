import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../../theme/ui';
import { buildImageUri } from '../../../services/apiService';
import { collectVehiclePhotoPaths } from '../../../utils/vehiclePhotos';

/**
 * Todos los detalles del vehículo, en su propia pantalla.
 *
 * En el detalle del viaje el auto quedó reducido a nombre + fotos + una flecha; el resto
 * —color, patente, asientos, documentación, características— vive acá para no alargar esa
 * pantalla con datos que la mayoría no mira antes de reservar.
 *
 *   navigation.navigate('VehicleDetail', { vehicle })   // el objeto de trip.vehicle, ya populado
 */
const TIPO_LABEL = {
  sedan: 'Auto', hatchback: 'Auto', suv: 'SUV',
  pickup: 'Camioneta', van: 'Camioneta', otro: 'Otro',
};

const FEATURES = [
  { key: 'ac', icon: 'snow-outline', label: 'Aire acondicionado' },
  { key: 'music', icon: 'musical-notes-outline', label: 'Música' },
  { key: 'pets', icon: 'paw-outline', label: 'Se permiten mascotas' },
  { key: 'luggage', icon: 'bag-handle-outline', label: 'Espacio para equipaje' },
  { key: 'smoking', icon: 'flame-outline', label: 'Se permite fumar' },
];

const VehicleDetailScreen = ({ route }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const vehicle = route.params?.vehicle;

  const [fullImage, setFullImage] = useState(null);

  if (!vehicle) {
    return (
      <View style={[styles.centro, { backgroundColor: ui.bg }]}>
        <Text style={{ color: ui.textMuted }}>No hay datos del vehículo.</Text>
      </View>
    );
  }

  const fotos = collectVehiclePhotoPaths(vehicle);
  const nombre = `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() +
    (vehicle.year ? ` (${vehicle.year})` : '');
  const featuresActivas = FEATURES.filter((f) => vehicle.features?.[f.key]);

  const dato = (rotulo, valor) => {
    if (!valor) return null;
    return (
      <View style={[styles.dato, { borderBottomColor: ui.border }]}>
        <Text style={[styles.datoRotulo, { color: ui.textMuted }]}>{rotulo}</Text>
        <Text style={[styles.datoValor, { color: ui.text }]}>{valor}</Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: ui.bg }}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
    >
      {fotos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.fotosScroll}
        >
          {fotos.map((path, idx) => {
            const uri = buildImageUri(path);
            if (!uri) return null;
            return (
              <TouchableOpacity
                key={`foto-${idx}`}
                activeOpacity={0.85}
                onPress={() => setFullImage(uri)}
                style={styles.fotoTouch}
              >
                <Image source={{ uri }} style={[styles.foto, { backgroundColor: ui.surface }]} resizeMode="cover" />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.header}>
        <Text style={[styles.nombre, { color: ui.text }]}>{nombre}</Text>
        {vehicle.documentacionCompleta && (
          <Ionicons name="shield-checkmark" size={18} color={ui.text} />
        )}
      </View>

      {dato('Color', vehicle.color)}
      {dato('Patente', vehicle.licensePlate)}
      {dato('Asientos', vehicle.capacity ? `${vehicle.capacity}` : null)}
      {dato('Tipo', TIPO_LABEL[vehicle.type] || null)}
      {dato(
        'Documentación',
        vehicle.documentacionCompleta
          // "Completa" != "verificada": la subió el conductor y declaró, nadie la comprobó
          // todavía (ver docStatus en el modelo Vehicle). No prometer de más.
          ? 'Completa (declarada por el conductor)'
          : 'Incompleta',
      )}

      {featuresActivas.length > 0 && (
        <View style={styles.seccion}>
          <Text style={[styles.seccionLabel, { color: ui.textMuted }]}>CARACTERÍSTICAS</Text>
          {featuresActivas.map((f) => (
            <View key={f.key} style={styles.feature}>
              <Ionicons name={f.icon} size={17} color={ui.text} />
              <Text style={[styles.featureText, { color: ui.text }]}>{f.label}</Text>
            </View>
          ))}
        </View>
      )}

      <Modal visible={!!fullImage} transparent animationType="fade" onRequestClose={() => setFullImage(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setFullImage(null)}>
          {!!fullImage && (
            <Image source={{ uri: fullImage }} style={styles.overlayImg} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24 },

  fotosScroll: { flexDirection: 'row', gap: 10, paddingVertical: 4, marginBottom: 20 },
  fotoTouch: { borderRadius: 12, overflow: 'hidden' },
  foto: { width: 220, height: 148, borderRadius: 12 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  nombre: { fontSize: 22, fontFamily: 'Sora_700Bold', letterSpacing: -0.5 },

  dato: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, gap: 16,
  },
  datoRotulo: { fontSize: 13, fontFamily: 'Sora_400Regular' },
  datoValor: { fontSize: 15, fontFamily: 'Sora_600SemiBold', flexShrink: 1, textAlign: 'right' },

  seccion: { marginTop: 28 },
  seccionLabel: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 1, marginBottom: 14 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  featureText: { fontSize: 14, fontFamily: 'Sora_400Regular' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  overlayImg: { width: '100%', height: '80%' },
});

export default VehicleDetailScreen;
