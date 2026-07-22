import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import * as Updates from 'expo-updates';
import { useTheme } from '../context/ThemeContext';

export default function OtaUpdateListener() {
  const { isDarkMode } = useTheme();
  const [visible, setVisible] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    if (__DEV__) return;

    let cancelled = false;

    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (!cancelled) setVisible(true);
      } catch {
        /* sin red, sin ruido */
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleReload = async () => {
    setReloading(true);
    await Updates.reloadAsync();
  };

  const bg = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const text = isDarkMode ? '#FFFFFF' : '#111827';
  const subtext = isDarkMode ? '#9CA3AF' : '#6B7280';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: bg }]}>
          <Text style={[styles.title, { color: text }]}>Nueva actualización</Text>
          <Text style={[styles.message, { color: subtext }]}>
            Hay una versión nueva disponible, cierra y abre nuevamente la aplicación para aplicar los cambios.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 30 },
  title: { fontSize: 18, fontFamily: 'Sora_700Bold', marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btn: {
    width: '100%',
    height: 50,
    backgroundColor: '#000000',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  btnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Sora_700Bold' },
  later: { fontSize: 14, fontFamily: 'Sora_500Medium' },
});
