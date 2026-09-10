import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../../theme/ui';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import { put_withauth_formdata } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import PillButton from '../../../components/ui/PillButton';

/**
 * Dónde le transfiere el pasajero al conductor.
 *
 * Pantalla propia y no un bloque más en "Editar perfil": es plata, no es un dato personal
 * como la edad o la bio, y sólo le importa a quien maneja. Vive al lado de "Mi saldo" en
 * Perfil, que es el otro lugar de la app donde el conductor mira números.
 *
 * Sin esto cargado, pedir seña no sirve: el pasajero no tiene a dónde mandar la plata.
 * Ver Trip.requiereSena en el backend.
 */
const soloDigitos = (s) => String(s || '').replace(/\D/g, '');

/** `0000003100010000000001` -> `0000 0031 0001 0000 0000 01`, que es como se lee un CVU. */
const agrupar = (d) => d.replace(/(.{4})/g, '$1 ').trim();

const DatosCobroScreen = ({ navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { showAlert } = useAlert();

  const [alias, setAlias] = useState('');
  const [cvu, setCvu] = useState('');
  const [titular, setTitular] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [foco, setFoco] = useState(null);

  useEffect(() => {
    setAlias(user?.datosCobro?.alias || '');
    setCvu(user?.datosCobro?.cvu || '');
    setTitular(user?.datosCobro?.titular || '');
  }, [user]);

  const cvuDigitos = soloDigitos(cvu);
  const cvuIncompleto = cvuDigitos.length > 0 && cvuDigitos.length !== 22;
  const hayAlgo = Boolean(alias.trim() || cvuDigitos);

  const guardar = async () => {
    // Un CVU a medias es peor que ninguno: la transferencia se va a otra cuenta.
    if (cvuIncompleto) {
      showAlert('Revisá el CVU', `Tiene que tener 22 dígitos y pusiste ${cvuDigitos.length}.`);
      return;
    }
    setGuardando(true);
    try {
      const fd = new FormData();
      // Se mandan siempre, incluso vacíos, para poder BORRAR un dato que ya no querés publicar.
      fd.append('datosCobro_alias', alias.trim());
      fd.append('datosCobro_cvu', cvuDigitos);
      fd.append('datosCobro_titular', titular.trim());
      const res = await put_withauth_formdata(ENDPOINTS.UPDATE_PROFILE, fd);
      if (!res?.success) throw new Error(res?.message || 'No se pudo guardar');
      await refreshUser();
      navigation.goBack();
    } catch (e) {
      showAlert('Ocurrió algo', e?.message || 'No pudimos guardar tus datos de cobro.');
    } finally {
      setGuardando(false);
    }
  };

  const campo = (key, label, valor, onChange, extra = {}) => (
    <View
      style={[
        styles.campo,
        { backgroundColor: ui.surface, borderColor: foco === key ? ui.text : 'transparent' },
      ]}
    >
      <Text style={[styles.campoLabel, { color: ui.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.campoInput, { color: ui.text }]}
        value={valor}
        onChangeText={onChange}
        onFocus={() => setFoco(key)}
        onBlur={() => setFoco(null)}
        placeholderTextColor={ui.textMuted}
        {...extra}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[styles.screen, { backgroundColor: ui.bg }]}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.intro, { color: ui.textMuted }]}>
          Es a dónde te transfiere el pasajero cuando pedís seña. La plata va directo a tu
          cuenta — Carpuling no la toca.
        </Text>

        {campo('alias', 'ALIAS', alias, setAlias, {
          placeholder: 'tu.alias.mp',
          autoCapitalize: 'none',
          autoCorrect: false,
          maxLength: 40,
        })}

        {campo('cvu', 'CVU / CBU', agrupar(cvuDigitos), (v) => setCvu(soloDigitos(v)), {
          placeholder: '22 dígitos',
          keyboardType: 'number-pad',
          maxLength: 27, // 22 dígitos + 5 espacios
        })}
        {cvuIncompleto && (
          <Text style={[styles.error, { color: '#B45309' }]}>
            Van {cvuDigitos.length} de 22 dígitos.
          </Text>
        )}

        {campo('titular', 'TITULAR DE LA CUENTA', titular, setTitular, {
          placeholder: 'Como figura en el banco',
          maxLength: 80,
        })}

        <View style={[styles.aviso, { borderColor: ui.border }]}>
          <Ionicons name="eye-off-outline" size={18} color={ui.textMuted} />
          <Text style={[styles.avisoText, { color: ui.textMuted }]}>
            Sólo los ve el pasajero de un viaje tuyo que pida seña. No aparecen en tu perfil
            público.
          </Text>
        </View>

        <View style={{ marginTop: 24 }}>
          <PillButton
            label={guardando ? 'Guardando…' : 'Guardar'}
            onPress={guardar}
            disabled={guardando || cvuIncompleto}
          />
        </View>

        {!hayAlgo && (
          <Text style={[styles.pie, { color: ui.textMuted }]}>
            Con el alias alcanza. El CVU es por si el pasajero prefiere ese.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 24 },
  intro: { fontSize: 13, fontFamily: 'Sora_400Regular', lineHeight: 19, marginBottom: 20 },

  campo: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  campoLabel: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.5 },
  campoInput: { fontSize: 16, fontFamily: 'Sora_500Medium', paddingVertical: 6, paddingHorizontal: 0 },

  error: { fontSize: 12, fontFamily: 'Sora_500Medium', marginTop: -6, marginBottom: 12, marginLeft: 4 },

  aviso: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, marginTop: 10,
  },
  avisoText: { flex: 1, fontSize: 13, fontFamily: 'Sora_400Regular', lineHeight: 19 },

  pie: { fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 18, textAlign: 'center', marginTop: 16 },
});

export default DatosCobroScreen;
