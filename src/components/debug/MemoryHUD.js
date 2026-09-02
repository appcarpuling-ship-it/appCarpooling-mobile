import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DeviceInfo from 'react-native-device-info';

/**
 * ponytail: herramienta de UNA sola vez para verificar a ojo que el pop-al-root de tabs
 * (MainTabNavigator) libera memoria de verdad, sacando la pila de pantallas que quedaban
 * vivas al cambiar de tab (ver commit f61ff0c). Sacar este componente y su import de
 * MainTabNavigator una vez confirmado — no es algo para dejar en la app.
 *
 * Siempre visible mientras esté montado (ver MainTabNavigator) — es de testeo, no hace
 * falta esconderlo con un gesto. getUsedMemory ya viene con react-native-device-info
 * (dependencia ya instalada). Async y no la Sync: la sync tira en algunos setups.
 */
export default function MemoryHUD() {
  const [mb, setMb] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let vivo = true;
    const tick = async () => {
      try {
        const bytes = await DeviceInfo.getUsedMemory();
        if (vivo) { setMb(Math.round(bytes / 1024 / 1024)); setErr(null); }
      } catch (e) {
        if (vivo) setErr(e?.message || 'error');
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => { vivo = false; clearInterval(id); };
  }, []);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Text style={styles.text}>{err ? `ERR: ${err}` : mb === null ? '…' : `${mb} MB`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 50,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 9999,
    elevation: 9999,
    maxWidth: 220,
  },
  text: {
    color: '#00FF88',
    fontSize: 12,
    fontWeight: '700',
  },
});
