import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { get_withauth, put_withauth } from '../services/apiService';
import { ENDPOINTS } from '../config/api';
import socketService from '../services/socketService';
import { useAuth } from './AuthContext';
import * as Notifications from 'expo-notifications';

/** Solo push (como WhatsApp); no lista en el centro de notificaciones */
const isInAppNotificationType = (n) => n && n.type !== 'new_message';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    // Retornar valores por defecto en lugar de lanzar error para evitar problemas con hooks
    console.warn('useNotifications: NotificationContext no disponible, usando valores por defecto');
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      loadNotifications: () => {},
      markAsRead: () => {},
      markAllAsRead: () => {},
      clearNotification: () => {},
      clearAllNotifications: () => {},
      getNotificationsByType: () => [],
    };
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated = false } = useAuth();
  
  const [notifications, setNotifications] = useState([]); // ✅ Inicializado como array
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Usar refs para mantener referencias estables a las funciones de estado
  const setNotificationsRef = useRef(setNotifications);
  const setUnreadCountRef = useRef(setUnreadCount);
  
  // Actualizar refs cuando cambian las funciones
  useEffect(() => {
    setNotificationsRef.current = setNotifications;
    setUnreadCountRef.current = setUnreadCount;
  }, []);

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const response = await get_withauth(ENDPOINTS.GET_NOTIFICATIONS);
      
      // ✅ VALIDACIÓN CRÍTICA - Aquí estaba el error
      if (response && response.success) {
        // Asegurar que response.data sea un array
        const notificationsData = (Array.isArray(response.data) ? response.data : []).filter(
          isInAppNotificationType
        );
        
        console.log('✅ [NotificationContext] Notificaciones cargadas:', notificationsData.length);
        setNotifications(notificationsData);

        // Usar el unreadCount AUTORITATIVO del backend (cuenta todas las no leídas
        // excluyendo new_message, no solo la página traída). Recontar del lado del
        // cliente sobre la página 1 dejaba el badge en 1 por un unread fuera de esa
        // página. Fallback al conteo local si el backend no lo manda.
        const serverUnread = Number(response.unreadCount);
        const unread = Number.isFinite(serverUnread)
          ? serverUnread
          : notificationsData.filter(n => n && !n.isRead).length;
        setUnreadCount(unread);
      } else {
        console.warn('⚠️ [NotificationContext] Respuesta inválida:', response);
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('❌ [NotificationContext] Error cargando notificaciones:', error);
      // ✅ En caso de error, asegurar estado válido
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // setupSocketListeners tiene deps [] a proposito, asi que no puede cerrar sobre
  // loadNotifications directamente.
  const loadNotificationsRef = useRef(loadNotifications);
  loadNotificationsRef.current = loadNotifications;

  const setupSocketListeners = useCallback(() => {
    console.log('📡 [NotificationContext] Configurando listeners de socket...');

    // Escuchar nuevas notificaciones
    socketService.onNotificationReceived((notification) => {
      console.log('🔔 [NotificationContext] Nueva notificación recibida:', notification);
      if (!isInAppNotificationType(notification)) return;
      // ✅ Usar refs para evitar problemas con hooks en callbacks
      // Dedupe por _id: si el socket reconecta o el mismo evento llega dos veces,
      // la notificacion se prependeaba repetida y el contador subia de mas.
      setNotificationsRef.current(prev => {
        const prevArray = Array.isArray(prev) ? prev : [];
        if (notification?._id && prevArray.some(n => n?._id === notification._id)) return prevArray;
        return [notification, ...prevArray];
      });
      // El prepend es solo para que aparezca al toque. El contador lo resuelve el
      // backend: sumar +1 a ciegas por evento hacia que el badge se despegara del
      // valor real (decia 7 y al refrescar bajaba a 5), porque cualquier evento
      // duplicado o ya contado inflaba el numero y nada lo reconciliaba.
      loadNotificationsRef.current({ silent: true });
    });

    // NOTA: No escuchar mensajes aquí para evitar conflictos con useUnreadMessages
    // El hook useUnreadMessages maneja específicamente los mensajes no leídos para el tab badge
  }, []);

  const cleanupSocketListeners = useCallback(() => {
    console.log('🧹 [NotificationContext] Limpiando listeners de socket...');
    socketService.removeListener('notification:new');
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
      setupSocketListeners();
    }

    return () => {
      cleanupSocketListeners();
    };
  }, [isAuthenticated, loadNotifications, setupSocketListeners, cleanupSocketListeners]);

  // Escuchar push notifications recibidas en primer plano (foreground) como respaldo al socket
  useEffect(() => {
    if (!isAuthenticated) return;

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification?.request?.content?.data;
      const tripTypes = ['trip_started', 'trip_completed', 'booking_accepted', 'booking_rejected', 'trip_cancelled'];
      // Solo recargar desde el server — el socket ya incrementó el count.
      // No incrementar manualmente acá para evitar doble conteo.
      if (data?.type && tripTypes.includes(data.type)) {
        loadNotifications();
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated, loadNotifications]);



  const markAsRead = async (notificationId) => {
    try {
      const response = await put_withauth(ENDPOINTS.MARK_AS_READ(notificationId));
      if (response && response.success) {
        // ✅ Actualizar estado local usando isRead (backend usa isRead)
        setNotifications(prev => {
          if (!Array.isArray(prev)) return [];
          return prev.map(n =>
            n && n._id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n
          );
        });
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('❌ [NotificationContext] Error marcando como leída:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await put_withauth(ENDPOINTS.MARK_ALL_AS_READ);
      if (response && response.success) {
        // ✅ Actualizar estado local usando isRead (backend usa isRead)
        setNotifications(prev => {
          if (!Array.isArray(prev)) return [];
          return prev.map(n => n ? { ...n, isRead: true, readAt: new Date() } : n);
        });
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('❌ [NotificationContext] Error marcando todas como leídas:', error);
    }
  };

  const clearNotification = (notificationId) => {
    // ✅ Validación defensiva
    setNotifications(prev => {
      const prevArray = Array.isArray(prev) ? prev : [];
      return prevArray.filter(n => n && n._id !== notificationId);
    });
    
    // Actualizar contador si era no leída - usar isRead (backend usa isRead)
    const notificationsArray = Array.isArray(notifications) ? notifications : [];
    const notification = notificationsArray.find(n => n && n._id === notificationId);
    if (notification && !notification.isRead) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const getNotificationsByType = (type) => {
    // ✅ Validación defensiva
    const notificationsArray = Array.isArray(notifications) ? notifications : [];
    return (Array.isArray(notificationsArray) ? notificationsArray : []).filter(n => n && n.type === type);
  };

  const value = {
    notifications: Array.isArray(notifications) ? notifications : [], // ✅ Siempre retornar array
    unreadCount: typeof unreadCount === 'number' ? unreadCount : 0, // ✅ Siempre retornar número
    loading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
    getNotificationsByType,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};