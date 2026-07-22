import { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from '../navigation/rootNavigation';
import {
  navigateFromNotification,
  buildNotificationLikeFromPushData,
} from '../utils/notificationNavigation';

/**
 * Al tocar una notificación push del sistema (bandeja / banner), navega igual que
 * al tocar una fila en la lista de notificaciones in-app.
 */
export default function PushNotificationRouter() {
  const { isAuthenticated } = useAuth();
  const handledIds = useRef(new Set());

  const processResponse = useCallback((response) => {
    if (!response?.notification) return;
    const id = response.notification.request.identifier;
    if (id && handledIds.current.has(id)) return;
    if (id) handledIds.current.add(id);

    const data = response.notification.request.content?.data || {};
    const payload = buildNotificationLikeFromPushData(data);

    const go = () => {
      if (!navigationRef.isReady()) return false;
      // isReady() puede dar true mientras todavía está montado el stack sin autenticar:
      // navegar a 'Main' ahí no hace nada y la notificación se pierde en el Home.
      if (!navigationRef.getRootState()?.routeNames?.includes('Main')) return false;
      navigateFromNotification(navigationRef, payload, { useMainStack: true });
      return true;
    };

    if (!go()) {
      // En frío el árbol autenticado tarda en montarse; un solo reintento a 500ms
      // se quedaba corto y la notificación dejaba al usuario en Home.
      let tries = 0;
      const timer = setInterval(() => {
        if (go() || ++tries > 40) clearInterval(timer);
      }, 250);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      processResponse(response);
    });

    return () => subscription.remove();
  }, [isAuthenticated, processResponse]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (cancelled || !last) return;
        processResponse(last);
        await Notifications.clearLastNotificationResponseAsync();
      } catch (e) {
        console.warn('PushNotificationRouter cold start:', e?.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, processResponse]);

  return null;
}
