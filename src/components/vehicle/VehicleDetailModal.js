import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, Image, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';
import { buildImageUri } from '../../services/apiService';
import { collectVehiclePhotoPaths } from '../../utils/vehiclePhotos';

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

/**
 * Todo el detalle de un vehículo —color, patente, asientos, documentación,
 * características—, en una hoja que sube desde abajo en vez de navegar a otra pantalla.
 * Mismo contenido que tenía VehicleDetailScreen, ahora reutilizado como modal desde
 * TripDetailScreen y ApplicationDetailScreen: ahí el auto queda reducido a nombre + fotos +
 * una flecha, y el resto vive acá para no alargar esas pantallas.
 *
 *   <VehicleDetailModal visible={open} vehicle={trip.vehicle} onClose={() => setOpen(false)} />
 */
const VehicleDetailModal = ({ visible, vehicle, onClose }) => {
  const ui = useUI();
  const [fullImage, setFullImage] = useState(null);

  if (!vehicle) return null;

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
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: ui.bg }]} onPress={() => {}}>
            <View style={[styles.handle, { backgroundColor: ui.border }]} />
            <View style={styles.header}>
              <Text style={[styles.title, { color: ui.text }]}>Vehículo</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={ui.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

              <View style={styles.nombreRow}>
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
                vehicle.documentacionCompleta ? 'Completa' : 'Incompleta',
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
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!fullImage} transparent animationType="fade" onRequestClose={() => setFullImage(null)}>
        <TouchableOpacity style={styles.imgOverlay} activeOpacity={1} onPress={() => setFullImage(null)}>
          {!!fullImage && (
            <Image source={{ uri: fullImage }} style={styles.imgOverlayImg} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingTop: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
  },
  title: { fontSize: 17, fontFamily: 'Sora_700Bold' },
  content: { paddingHorizontal: 20, paddingBottom: 30 },

  fotosScroll: { flexDirection: 'row', gap: 10, paddingBottom: 16 },
  fotoTouch: { borderRadius: 12, overflow: 'hidden' },
  foto: { width: 220, height: 148, borderRadius: 12 },

  nombreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  nombre: { fontSize: 20, fontFamily: 'Sora_700Bold', letterSpacing: -0.5 },

  dato: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 16,
  },
  datoRotulo: { fontSize: 13, fontFamily: 'Sora_400Regular' },
  datoValor: { fontSize: 15, fontFamily: 'Sora_600SemiBold', flexShrink: 1, textAlign: 'right' },

  seccion: { marginTop: 22 },
  seccionLabel: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 1, marginBottom: 12 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  featureText: { fontSize: 14, fontFamily: 'Sora_400Regular' },

  imgOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  imgOverlayImg: { width: '100%', height: '80%' },
});

export default VehicleDetailModal;
