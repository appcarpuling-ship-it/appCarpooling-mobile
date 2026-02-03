import React, { createContext, useState, useEffect, useContext } from 'react';
import { get_withauth, put_withauth } from '../services/apiService';
import { ENDPOINTS } from '../config/api';
import socketService from '../services/socketService';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications debe ser usado dentro de un NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]); // ✅ Inicializado como array
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
      setupSocketListeners();
    }

    return () => {
      cleanupSocketListeners();
    };
  }, [isAuthenticated]);

  const setupSocketListeners = () => {
    console.log('📡 [NotificationContext] Configurando listeners de socket...');

    // Escuchar nuevas notificaciones
    socketService.onNotificationReceived((notification) => {
      console.log('🔔 [NotificationContext] Nueva notificación recibida:', notification);
      // ✅ Validación defensiva
      setNotifications(prev => {
        const prevArray = Array.isArray(prev) ? prev : [];
        return [notification, ...prevArray];
      });
      setUnreadCount(prev => prev + 1);
    });

    // Escuchar actualizaciones de solicitudes de viaje
    socketService.onBookingStatusUpdate((data) => {
      console.log('🚗 [NotificationContext] Actualización de booking recibida:', data);
      // Crear notificación local
      const notification = {
        _id: Date.now().toString(),
        type: 'booking_update',
        title: 'Actualización de Solicitud',
        message: data.message || `Tu solicitud ha sido ${data.status}`,
        data: data,
        read: false,
        createdAt: new Date(),
      };
      // ✅ Validación defensiva
      setNotifications(prev => {
        const prevArray = Array.isArray(prev) ? prev : [];
        return [notification, ...prevArray];
      });
      setUnreadCount(prev => prev + 1);
    });

    // NOTA: No escuchar mensajes aquí para evitar conflictos con useUnreadMessages
    // El hook useUnreadMessages maneja específicamente los mensajes no leídos para el tab badge
  };

  const cleanupSocketListeners = () => {
    console.log('🧹 [NotificationContext] Limpiando listeners de socket...');
    socketService.removeListener('notification:new');
    socketService.removeListener('booking:statusUpdate');
    // Ya no limpiamos message:received aquí
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await get_withauth(ENDPOINTS.GET_NOTIFICATIONS);
      
      // ✅ VALIDACIÓN CRÍTICA - Aquí estaba el error
      if (response && response.success) {
        // Asegurar que response.data sea un array
        const notificationsData = Array.isArray(response.data) 
          ? response.data 
          : [];
        
        console.log('✅ [NotificationContext] Notificaciones cargadas:', notificationsData.length);
        setNotifications(notificationsData);
        
        // ✅ Contar no leídas de forma segura
        const unread = notificationsData.filter(n => n && !n.read).length;
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
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await put_withauth(ENDPOINTS.MARK_AS_READ(notificationId));
      if (response && response.success) {
        // ✅ Actualizar estado local de forma segura
        setNotifications(prev => {
          if (!Array.isArray(prev)) return [];
          return prev.map(n =>
            n && n._id === notificationId ? { ...n, read: true } : n
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
        // ✅ Actualizar estado local de forma segura
        setNotifications(prev => {
          if (!Array.isArray(prev)) return [];
          return prev.map(n => n ? { ...n, read: true } : n);
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
    
    // Actualizar contador si era no leída
    const notificationsArray = Array.isArray(notifications) ? notifications : [];
    const notification = notificationsArray.find(n => n && n._id === notificationId);
    if (notification && !notification.read) {
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