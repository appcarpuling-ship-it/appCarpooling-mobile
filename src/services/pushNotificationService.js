import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { put_withauth, delete_withauth } from './apiService';
import { reportError } from '../utils/sentry';

// Configurar cómo se manejan las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registrar el dispositivo para recibir push notifications
 * @returns {Promise<string|null>} Push token o null si falla
 */
export const registerForPushNotificationsAsync = async () => {
  let token = null;

  try {
    // Verificar que sea un dispositivo físico
    if (!Device.isDevice) {
      console.log('⚠️ Las notificaciones push requieren un dispositivo físico');
      return null;
    }

    // Verificar permisos existentes
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Si no tiene permisos, solicitarlos
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Permiso para notificaciones push denegado');
      return null;
    }

    // Obtener el push token - projectId se lee de app.json via expo-constants
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      '4f43e00d-f804-4c94-aa0a-beae6f6be58a';
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

    token = tokenData.data;
    console.log('📱 Push token obtenido:', token);

    // Configurar canal de notificaciones para Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10b981',
      });
    }

    return token;
  } catch (error) {
    console.error('❌ Error registrando push notifications:', error);
    reportError(error, { service: 'pushNotificationService', action: 'registerForPushNotifications' });
    return null;
  }
};

/**
 * Guardar el push token en el servidor
 * @param {string} pushToken - Token de push
 */
export const savePushTokenToServer = async (pushToken) => {
  try {
    if (!pushToken) {
      console.log('⚠️ No hay push token para guardar');
      return false;
    }

    const response = await put_withauth('/users/push-token', { pushToken });

    if (response.success) {
      console.log('✅ Push token guardado en el servidor');
      return true;
    } else {
      console.error('❌ Error guardando push token:', response.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Error guardando push token en servidor:', error);
    return false;
  }
};

/**
 * Eliminar el push token del servidor (al cerrar sesión)
 */
export const removePushTokenFromServer = async () => {
  try {
    const response = await delete_withauth('/users/push-token');

    if (response.success) {
      console.log('✅ Push token eliminado del servidor');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error eliminando push token:', error);
    return false;
  }
};

/**
 * Configurar listeners para notificaciones
 * @param {Function} onNotificationReceived - Callback cuando se recibe una notificación
 * @param {Function} onNotificationResponse - Callback cuando el usuario interactúa con la notificación
 * @returns {Object} Subscripciones para limpiar después
 */
export const setupNotificationListeners = (onNotificationReceived, onNotificationResponse) => {
  // Listener para notificaciones recibidas mientras la app está abierta
  const notificationListener = Notifications.addNotificationReceivedListener(notification => {
    console.log('📬 Notificación recibida:', notification);
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // Listener para cuando el usuario toca la notificación
  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('👆 Usuario interactuó con notificación:', response);
    if (onNotificationResponse) {
      onNotificationResponse(response);
    }
  });

  return {
    notificationListener,
    responseListener,
    remove: () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    }
  };
};

/**
 * Obtener la última notificación que abrió la app
 */
export const getLastNotificationResponse = async () => {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    return response;
  } catch (error) {
    console.error('❌ Error obteniendo última notificación:', error);
    return null;
  }
};

/**
 * Limpiar todas las notificaciones
 */
export const clearAllNotifications = async () => {
  try {
    await Notifications.dismissAllNotificationsAsync();
    console.log('🧹 Todas las notificaciones limpiadas');
  } catch (error) {
    console.error('❌ Error limpiando notificaciones:', error);
  }
};

/**
 * Obtener el número de notificaciones pendientes
 */
export const getBadgeCount = async () => {
  try {
    const count = await Notifications.getBadgeCountAsync();
    return count;
  } catch (error) {
    console.error('❌ Error obteniendo badge count:', error);
    return 0;
  }
};

/**
 * Establecer el número del badge
 */
export const setBadgeCount = async (count) => {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('❌ Error estableciendo badge count:', error);
  }
};

export default {
  registerForPushNotificationsAsync,
  savePushTokenToServer,
  removePushTokenFromServer,
  setupNotificationListeners,
  getLastNotificationResponse,
  clearAllNotifications,
  getBadgeCount,
  setBadgeCount,
};
