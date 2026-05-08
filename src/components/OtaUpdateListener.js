import { useEffect } from 'react';
import * as Updates from 'expo-updates';
import { useAlert } from '../context/AlertContext';

/**
 * Tras descargar un OTA, avisa al usuario que cierre la app manualmente (sin reload automático).
 */
export default function OtaUpdateListener() {
  const { showAlert } = useAlert();

  useEffect(() => {
    if (__DEV__) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        showAlert(
          'Actualización disponible',
          'Hay una actualización nueva. Por favor cerrá la aplicación por completo y volvé a abrirla para aplicar los cambios.',
          [{ text: 'Entendido' }]
        );
      } catch {
        /* sin red ruido */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showAlert]);

  return null;
}
