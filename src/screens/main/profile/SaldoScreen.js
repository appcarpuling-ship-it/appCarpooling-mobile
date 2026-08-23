import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../../theme/ui';
import { useAlert } from '../../../context/AlertContext';
import { get_withauth, post_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import PillButton from '../../../components/ui/PillButton';

/**
 * Mi saldo: lo que el conductor le debe a Carpuling por los asientos que se ocuparon en
 * los viajes que completó.
 *
 * La plata del viaje nunca pasa por la app: el pasajero le paga directo al conductor. Lo
 * nuestro es la comisión por asiento ocupado, y se salda desde acá.
 *
 * Muestra los viajes que componen la deuda ACTUAL, no el libro completo: lo ya pagado no le
 * sirve a nadie acá, y mezclarlo hacía que la lista no sumara el número de arriba.
 */
const pesos = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

const SaldoScreen = () => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pagando, setPagando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await get_withauth(ENDPOINTS.SALDO);
      if (res?.success) setData(res.data);
    } catch (error) {
      showAlert('No se pudo cargar', error?.message || 'Intentá de nuevo en un rato.');
    } finally {
      setCargando(false);
    }
  }, [showAlert]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  const pagar = async () => {
    setPagando(true);
    try {
      const res = await post_withauth(ENDPOINTS.SALDO_PAGAR, {});
      const url = res?.data?.paymentUrl;
      if (!url) throw new Error(res?.message || 'No se pudo generar el pago');
      // Se abre el checkout de dLocal afuera. La deuda baja recién cuando dLocal confirma
      // por webhook, no al volver: si se descontara acá, alcanzaría con abrir el link.
      await Linking.openURL(url);
    } catch (error) {
      showAlert('No se pudo generar el pago', error?.message || 'Intentá de nuevo en un rato.');
    } finally {
      setPagando(false);
    }
  };

  if (cargando) {
    return (
      <View style={[styles.screen, styles.centrado, { backgroundColor: ui.bg }]}>
        <ActivityIndicator color={ui.text} />
      </View>
    );
  }

  const deuda = data?.deuda || 0;
  const bloqueado = data?.bloqueado;
  const movimientos = data?.movimientos || [];

  return (
    <View style={[styles.screen, { backgroundColor: ui.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} tintColor={ui.text} />}
      >
        <Text style={[styles.label, { color: ui.textMuted }]}>Saldo pendiente</Text>
        <Text style={[styles.monto, { color: ui.text }]}>{pesos(deuda)}</Text>

        {deuda > 0 ? (
          <Text style={[styles.ayuda, { color: ui.textMuted }]}>
            Es la comisión de Carpuling por los asientos que se ocuparon en los viajes que
            completaste. Podés saldarla cuando quieras.
          </Text>
        ) : (
          <Text style={[styles.ayuda, { color: ui.textMuted }]}>
            No debés nada. Cuando completes un viaje con pasajeros, la comisión de Carpuling
            va a aparecer acá.
          </Text>
        )}

        {bloqueado && (
          <View style={[styles.aviso, { backgroundColor: ui.surface, borderColor: '#EF4444' }]}>
            <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
            <Text style={[styles.avisoText, { color: ui.text }]}>
              Llegaste al límite de {pesos(data?.techo)}. No vas a poder publicar viajes
              nuevos hasta saldar. Los viajes que ya tenés siguen normal.
            </Text>
          </View>
        )}

        {/* Sólo los viajes que componen la deuda actual. Lo ya saldado no se muestra: el
            conductor viene a esta pantalla a ver QUÉ DEBE, y una lista que mezcla cargos
            viejos con pendientes no suma el número grande de arriba, que es justamente la
            pregunta que responde. El libro completo queda guardado en el backend por si hay
            que auditar un reclamo. */}
        {movimientos.length > 0 && (
          <>
            <Text style={[styles.titulo, { color: ui.text }]}>Viajes pendientes</Text>
            <View style={[styles.lista, { backgroundColor: ui.surface, borderColor: ui.border }]}>
              {movimientos.map((m, i) => (
                <View
                  key={m._id}
                  style={[
                    styles.item,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.border },
                  ]}
                >
                  <Ionicons name="car-outline" size={18} color={ui.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitulo, { color: ui.text }]}>{m.concepto}</Text>
                    <Text style={[styles.itemFecha, { color: ui.textMuted }]}>
                      {new Date(m.createdAt).toLocaleDateString('es-AR')}
                    </Text>
                  </View>
                  <Text style={[styles.itemMonto, { color: ui.text }]}>{pesos(m.monto)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {deuda > 0 && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <PillButton label={`Saldar ${pesos(deuda)}`} onPress={pagar} loading={pagando} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centrado: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 24 },

  label: { fontSize: 13, fontFamily: 'Sora_500Medium' },
  monto: { fontSize: 40, fontFamily: 'Sora_800ExtraBold', letterSpacing: -1.5, marginTop: 4 },
  ayuda: { fontSize: 13, fontFamily: 'Sora_400Regular', lineHeight: 19, marginTop: 10 },

  aviso: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, marginTop: 18,
  },
  avisoText: { flex: 1, fontSize: 13, fontFamily: 'Sora_500Medium', lineHeight: 19 },

  titulo: { fontSize: 15, fontFamily: 'Sora_700Bold', marginTop: 30, marginBottom: 10 },
  lista: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  itemTitulo: { fontSize: 13, fontFamily: 'Sora_500Medium', lineHeight: 18 },
  itemFecha: { fontSize: 11, fontFamily: 'Sora_400Regular', marginTop: 2 },
  itemMonto: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },

  footer: { paddingHorizontal: 24, paddingTop: 10 },
});

export default SaldoScreen;
