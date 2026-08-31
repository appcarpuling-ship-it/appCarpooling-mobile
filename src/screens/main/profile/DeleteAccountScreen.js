import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../../theme/ui';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import { delete_withauth } from '../../../services/apiService';
import PillButton from '../../../components/ui/PillButton';

/**
 * Eliminar la cuenta.
 *
 * Pantalla propia y no un botón con un "¿estás seguro?": es irreversible y conviene que se lea
 * qué se borra antes de tocar nada. Toda app que permita crear una cuenta tiene que permitir
 * borrarla desde adentro (App Store, guideline 5.1.1(v)).
 *
 * La contraseña se pide de nuevo porque el teléfono puede estar desbloqueado en manos de
 * cualquiera. Quien entró con Google o Apple no tiene contraseña propia: ahí no se pide y el
 * server tampoco la exige.
 */
const DeleteAccountScreen = ({ navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();

  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);

  // `authProviders` vacío = cuenta vieja creada con correo y contraseña.
  const proveedores = user?.authProviders || [];
  const tienePassword = proveedores.length === 0 || proveedores.includes('normal');

  const seBorra = [
    'Tu perfil, tu foto y tus datos personales',
    'Tu documentación: DNI, licencia y los papeles de tus vehículos',
    'Tus vehículos y los viajes que publicaste',
    'Tus reservas y tus conversaciones',
    'Las calificaciones que recibiste',
  ];

  const confirmar = () => {
    showAlert(
      'Eliminar cuenta',
      'Esto no se puede deshacer. Vas a perder tus viajes, tus reservas y tus calificaciones.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: eliminar },
      ],
    );
  };

  const eliminar = async () => {
    setEnviando(true);
    try {
      const res = await delete_withauth('/auth/me', tienePassword ? { password } : {});
      if (res?.success) {
        // Sin cuenta no hay sesión que sostener: se cierra y el navegador vuelve al login solo.
        navigation.navigate('Result', {
          type: 'success',
          title: 'Cuenta eliminada',
          message: 'Tu cuenta y tus datos fueron eliminados.',
          onPrimary: () => logout(),
        });
        return;
      }
      navigation.navigate('Result', {
        type: 'error',
        title: 'No se pudo eliminar',
        message: res?.message || 'Intentá de nuevo en un rato.',
      });
    } catch (error) {
      navigation.navigate('Result', {
        type: 'error',
        title: 'No se pudo eliminar',
        message: error?.message || 'Intentá de nuevo en un rato.',
        error,
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
      <View style={[styles.screen, { backgroundColor: ui.bg }]}>
        {/* Botón al final del scroll, como el resto de la app: al confirmar con la contraseña
            lo que importa es ver el input; el botón se alcanza scrolleando. */}
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          <View style={[styles.aviso, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <Ionicons name="warning-outline" size={22} color="#EF4444" />
            <Text style={[styles.avisoText, { color: ui.text }]}>
              Esta acción es permanente. No vas a poder recuperar tu cuenta ni tu historial.
            </Text>
          </View>

          <Text style={[styles.titulo, { color: ui.text }]}>Qué se elimina</Text>
          <View style={[styles.lista, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            {seBorra.map((t, i) => (
              <View
                key={t}
                style={[styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.border }]}
              >
                <Ionicons name="close-circle-outline" size={17} color={ui.textMuted} />
                <Text style={[styles.itemText, { color: ui.textMuted }]}>{t}</Text>
              </View>
            ))}
          </View>

          {/* Que no se lleve puesto a terceros: se dice antes, no después. */}
          <Text style={[styles.nota, { color: ui.textMuted }]}>
            Las calificaciones que vos escribiste sobre otras personas se conservan sin tu
            nombre, para no modificar su reputación. Los comprobantes de pago se guardan por
            obligaciones contables.
          </Text>

          {tienePassword && (
            <>
              <Text style={[styles.titulo, { color: ui.text }]}>Confirmá con tu contraseña</Text>
              <TextInput
                style={[styles.input, { backgroundColor: ui.surface, borderColor: ui.border, color: ui.text }]}
                placeholder="Tu contraseña"
                placeholderTextColor={ui.textMuted}
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
              />
            </>
          )}
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <PillButton
              label="Eliminar mi cuenta"
              onPress={confirmar}
              loading={enviando}
              disabled={tienePassword && password.length === 0}
            />
            <Text
              style={[styles.cancelar, { color: ui.textMuted }]}
              onPress={() => navigation.goBack()}
            >
              Mejor no
            </Text>
          </View>
        </ScrollView>
      </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 24 },

  aviso: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16,
  },
  avisoText: { flex: 1, fontSize: 13, fontFamily: 'Sora_500Medium', lineHeight: 19 },

  titulo: { fontSize: 15, fontFamily: 'Sora_700Bold', marginTop: 26, marginBottom: 10 },
  lista: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  itemText: { flex: 1, fontSize: 13, fontFamily: 'Sora_400Regular', lineHeight: 18 },

  nota: { fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 18, marginTop: 12 },

  input: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, fontFamily: 'Sora_400Regular',
  },

  footer: { paddingHorizontal: 24, paddingTop: 10 },
  cancelar: { textAlign: 'center', fontSize: 14, fontFamily: 'Sora_600SemiBold', paddingVertical: 14 },
});

export default DeleteAccountScreen;
