import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useUI } from '../../theme/ui';

/**
 * Se muestra cuando un admin bloqueó la cuenta (`isActive: false` en el backend).
 *
 * Va como pantalla y no como alerta porque no hay nada que el usuario pueda
 * hacer dentro de la app: cualquier request devuelve 401 y volver a entrar da lo
 * mismo. El correo de soporte llega en la propia respuesta del backend, así que
 * no hace falta pedirlo aparte (y no se podría: no hay sesión).
 */
const AccountBlockedScreen = () => {
  const { accountBlocked, clearAccountBlocked } = useAuth();
  const ui = useUI();

  const supportEmail = accountBlocked?.supportEmail;

  const escribirASoporte = () => {
    if (!supportEmail) return;
    const asunto = encodeURIComponent('Cuenta bloqueada');
    Linking.openURL(`mailto:${supportEmail}?subject=${asunto}`).catch(() => {});
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: ui.bg }]}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { borderColor: ui.border }]}>
          <Ionicons name="lock-closed-outline" size={34} color={ui.text} />
        </View>

        <Text style={[styles.title, { color: ui.text }]}>Tu cuenta está bloqueada</Text>

        <Text style={[styles.body, { color: ui.textMuted }]}>
          No podés usar Carpuling por ahora. Si creés que es un error, escribinos y lo
          revisamos.
        </Text>

        {supportEmail ? (
          <>
            <Text style={[styles.label, { color: ui.textMuted }]}>Escribinos a</Text>
            <TouchableOpacity onPress={escribirASoporte} activeOpacity={0.7}>
              <Text style={[styles.email, { color: ui.text }]}>{supportEmail}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: ui.invertBg }]}
              onPress={escribirASoporte}
              activeOpacity={0.85}
            >
              <Text style={[styles.primaryBtnText, { color: ui.invertText }]}>
                Contactar a soporte
              </Text>
            </TouchableOpacity>
          </>
        ) : null}

        <TouchableOpacity style={styles.secondaryBtn} onPress={clearAccountBlocked} activeOpacity={0.7}>
          <Text style={[styles.secondaryBtnText, { color: ui.textMuted }]}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { fontSize: 22, fontFamily: 'Sora_700Bold', textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  label: { fontSize: 13, marginBottom: 4 },
  email: { fontSize: 16, fontFamily: 'Sora_700Bold', marginBottom: 28 },
  primaryBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 15, fontFamily: 'Sora_700Bold' },
  secondaryBtn: { marginTop: 18, paddingVertical: 10 },
  secondaryBtnText: { fontSize: 14 },
});

export default AccountBlockedScreen;
