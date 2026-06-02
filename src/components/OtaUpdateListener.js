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

  const bg      = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const text    = isDarkMode ? '#FFFFFF' : '#111827';
  const subtext = isDarkMode ? '#9CA3AF' : '#6B7280';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: bg }]}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🚀</Text>
          </View>
          <Text style={[styles.title, { color: text }]}>Nueva actualización</Text>
          <Text style={[styles.message, { color: subtext }]}>
            Hay una versión nueva disponible. Reiniciá la app para aplicar los cambios.
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={handleReload}
            disabled={reloading}
            activeOpacity={0.85}
          >
            {reloading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.btnText}>Reiniciar ahora</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setVisible(false)} disabled={reloading}>
            <Text style={[styles.later, { color: subtext }]}>Más tarde</Text>
          </TouchableOpacity>
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
  icon:    { fontSize: 30 },
  title:   { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
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
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  later:   { fontSize: 14, fontWeight: '500' },
});
