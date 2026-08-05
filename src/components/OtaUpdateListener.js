import { useEffect, useState } from 'react';
import { Modal } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import UpdateRequiredScreen from '../screens/common/UpdateRequiredScreen';

export default function OtaUpdateListener() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // No filtramos por __DEV__: al canal dev también le mandamos OTAs. La guarda real
    // es isEnabled, que expo-updates pone en false donde no hay updates (Expo Go, Metro),
    // que es justo donde checkForUpdateAsync tiraría.
    if (!Updates.isEnabled) return;

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

  // Modal opaco (sin transparent) = pantalla completa. Sin onRequestClose, el back
  // de Android tampoco la saca: la única salida es reiniciar la app, que es el punto.
  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      {/* El Modal abre una ventana nativa aparte: necesita su propio provider
          para medir los insets de esta ventana (mismo caso que en HomeScreen). */}
      <SafeAreaProvider>
        <UpdateRequiredScreen />
      </SafeAreaProvider>
    </Modal>
  );
}
