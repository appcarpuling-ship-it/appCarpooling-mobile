import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useUI } from '../../theme/ui';
import RemoteImageWithLoader from '../RemoteImageWithLoader';

/** dd/mm/aaaa, que es como se lee un vencimiento en Argentina. */
const formatFecha = (d) =>
  d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '';

/**
 * Un documento: la foto y, si corresponde, su fecha de vencimiento.
 *
 * Existe porque son tres papeles (cédula, seguro, VTV) con exactamente el mismo bloque de
 * ~65 líneas. Repetirlo tres veces era garantizar que el cuarto saliera distinto.
 *
 * La fecha no es opcional donde se pide: un seguro vencido se ve igual que uno al día, y sin
 * el vencimiento la app termina diciendo que un vehículo está en regla cuando no lo está. El
 * server valida lo mismo, así que esto es para avisar antes de subir la foto al pedo.
 */
const DocumentoUpload = ({
  label,
  hint,
  uri,              // imagen recién elegida
  uriGuardada,      // la que ya está en el server
  onElegir,
  onQuitar,
  procesando = false,
  vencimiento,      // Date | null
  onVencimiento,    // si no viene, el documento no vence (cédula)
  isDarkMode,
}) => {
  const ui = useUI();
  const [abierto, setAbierto] = useState(false);
  const [temp, setTemp] = useState(vencimiento || new Date());

  const pideVencimiento = typeof onVencimiento === 'function';
  const vencido = vencimiento && vencimiento < new Date(new Date().setHours(0, 0, 0, 0));

  const confirmar = (fecha) => {
    onVencimiento(fecha);
    setAbierto(false);
  };

  return (
    <View style={styles.bloque}>
      <Text style={[styles.label, { color: ui.text }]}>{label}</Text>
      {!!hint && <Text style={[styles.hint, { color: ui.textMuted }]}>{hint}</Text>}

      {uri ? (
        <View style={styles.preview}>
          <Image source={{ uri }} style={styles.img} />
          <TouchableOpacity style={styles.quitar} onPress={onQuitar} hitSlop={8}>
            <Ionicons name="close" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : uriGuardada ? (
        <View style={styles.preview}>
          <RemoteImageWithLoader
            uri={uriGuardada}
            style={styles.img}
            isDarkMode={isDarkMode}
            spinnerColor={ui.text}
          />
          <TouchableOpacity
            style={[styles.reemplazar, { borderColor: ui.border }]}
            onPress={onElegir}
            disabled={procesando}
          >
            {procesando
              ? <ActivityIndicator size="small" color={ui.text} />
              : <Text style={[styles.reemplazarText, { color: ui.text }]}>Cambiar imagen</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.subir, { backgroundColor: ui.surface, borderColor: ui.border }]}
          onPress={onElegir}
          disabled={procesando}
        >
          {procesando ? (
            <ActivityIndicator size="small" color={ui.text} />
          ) : (
            <>
              <View style={[styles.icono, { backgroundColor: ui.invertBg }]}>
                <Ionicons name="document-text-outline" size={20} color={ui.invertText} />
              </View>
              <Text style={[styles.subirText, { color: ui.textMuted }]}>Subir documento</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {pideVencimiento && (
        <TouchableOpacity
          style={[styles.fecha, { borderColor: vencido ? '#EF4444' : ui.border, backgroundColor: ui.surface }]}
          onPress={() => { setTemp(vencimiento || new Date()); setAbierto(true); }}
          activeOpacity={0.8}
        >
          <Ionicons name="calendar-outline" size={17} color={vencido ? '#EF4444' : ui.textMuted} />
          <Text style={[styles.fechaText, { color: vencimiento ? (vencido ? '#EF4444' : ui.text) : ui.textMuted }]}>
            {vencimiento ? `Vence el ${formatFecha(vencimiento)}` : 'Fecha de vencimiento'}
          </Text>
          {vencido && <Text style={styles.vencido}>Vencido</Text>}
        </TouchableOpacity>
      )}

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <View style={styles.modalFondo}>
          <View style={[styles.modalCaja, { backgroundColor: ui.bg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: ui.border }]}>
              <Text style={[styles.modalTitulo, { color: ui.text }]}>{label}</Text>
              <TouchableOpacity onPress={() => setAbierto(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={ui.text} />
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={temp}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              // Un documento que vence antes de hoy no sirve: no se puede ni elegir.
              minimumDate={new Date()}
              onChange={(e, fecha) => {
                if (Platform.OS === 'android') {
                  setAbierto(false);
                  if (e.type === 'set' && fecha) onVencimiento(fecha);
                  return;
                }
                if (fecha) setTemp(fecha);
              }}
              style={{ marginVertical: 8 }}
            />
            {Platform.OS === 'ios' && (
              <View style={[styles.modalBtns, { borderTopColor: ui.border }]}>
                <TouchableOpacity onPress={() => setAbierto(false)} style={styles.modalBtn}>
                  <Text style={{ color: ui.textMuted, fontFamily: 'Sora_600SemiBold', fontSize: 15 }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmar(temp)} style={styles.modalBtn}>
                  <Text style={{ color: ui.text, fontFamily: 'Sora_700Bold', fontSize: 15 }}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  bloque: { marginTop: 18 },
  label: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  hint: { fontSize: 12, fontFamily: 'Sora_400Regular', marginTop: 3, marginBottom: 8 },

  preview: { marginTop: 8 },
  img: { width: '100%', height: 150, borderRadius: 12 },
  quitar: {
    position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center',
  },
  reemplazar: { marginTop: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingVertical: 9, alignItems: 'center' },
  reemplazarText: { fontSize: 13, fontFamily: 'Sora_600SemiBold' },

  subir: {
    marginTop: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, borderStyle: 'dashed',
    paddingVertical: 22, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  icono: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  subirText: { fontSize: 13, fontFamily: 'Sora_500Medium' },

  fecha: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
  },
  fechaText: { flex: 1, fontSize: 14, fontFamily: 'Sora_500Medium' },
  vencido: { color: '#EF4444', fontSize: 12, fontFamily: 'Sora_700Bold' },

  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCaja: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  modalTitulo: { fontSize: 16, fontFamily: 'Sora_700Bold' },
  modalBtns: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: 14 },
});

export default DocumentoUpload;
