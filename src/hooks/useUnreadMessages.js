import { useState, useEffect, useRef } from 'react';
import { useNavigationState } from '@react-navigation/native';
import { get_withauth } from '../services/apiService';
import socketService from '../services/socketService';
import { useAuth } from '../context/AuthContext';

export const useUnreadMessages = () => {
  const { user, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const listenersSetup = useRef(false);
  const userRef = useRef(user);

  // Obtener el estado de navegación para saber si estamos en un chat activo
  const navigationState = useNavigationState(state => state);
  const activeConversationId = useRef(null);

  // Update user ref when user changes
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Stable handlers que siempre tienen acceso a los valores más recientes
  const handleNewMessage = useRef((message) => {
    const currentUser = userRef.current;
    if (!currentUser) {
      console.log('⚠️ [useUnreadMessages] No hay usuario actual');
      return;
    }

    const currentUserId = currentUser._id || currentUser.id;
    const messageSenderId = message.sender?._id || message.sender;
    const messageConversationId = message.conversation;

    console.log('📨 [useUnreadMessages] Nuevo mensaje recibido:', {
      currentUserId,
      messageSenderId,
      messageId: message._id,
      conversationId: messageConversationId,
      activeConversation: activeConversationId.current,
      messageContent: message.content?.substring(0, 20)
    });

    // NO incrementar si:
    // 1. El mensaje es del usuario actual
    // 2. El mensaje es de la conversación que está activa (ya se marca como leído automáticamente)
    if (messageSenderId && messageSenderId.toString() !== currentUserId.toString()) {
      if (messageConversationId === activeConversationId.current) {
        console.log('ℹ️ [useUnreadMessages] Mensaje de conversación activa, no incrementar (se marca como leído automáticamente)');
        return;
      }

      console.log('✅ [useUnreadMessages] Incrementando contador de no leídos');
      setUnreadCount(prev => {
        const newCount = prev + 1;
        console.log('📊 [useUnreadMessages] Contador anterior:', prev, '→ Nuevo contador:', newCount);
        return newCount;
      });
    } else {
      console.log('ℹ️ [useUnreadMessages] Mensaje del usuario actual, no incrementar');
    }
  });

  const handleConversationUpdate = useRef(() => {
    console.log('🔄 [useUnreadMessages] Conversación actualizada, recargando contador');
    loadUnreadCount();
  });

  const handleMessagesRead = useRef((data) => {
    console.log('👀 [useUnreadMessages] Evento messages:read recibido!', data);
    console.log('🔄 [useUnreadMessages] Recargando contador por evento messages:read');
    // Agregar un delay para dar tiempo a que el servidor actualice
    setTimeout(() => {
      console.log('⏰ [useUnreadMessages] Ejecutando loadUnreadCount después del delay');
      loadUnreadCount();
    }, 200);
  });

  const handleSocketConnect = useRef(() => {
    console.log('🔌 [useUnreadMessages] Socket conectado, recargando contador');
    loadUnreadCount();
  });

  // Función para cargar contador
  const loadUnreadCount = async () => {
    try {
      console.log('🔄 [useUnreadMessages] Cargando contador de no leídos...');
      const response = await get_withauth('/chat/unread-count');
      if (response.success) {
        const newCount = response.data.count || 0;
        console.log('✅ [useUnreadMessages] Contador cargado:', newCount, '(anterior:', unreadCount, ')');
        setUnreadCount(newCount);
        console.log('📊 [useUnreadMessages] Estado actualizado a:', newCount);
      }
    } catch (error) {
      console.error('❌ [useUnreadMessages] Error al cargar mensajes no leídos:', error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('🚫 [useUnreadMessages] No autenticado o sin usuario, reseteando contador');
      setUnreadCount(0);
      return;
    }

    // Cargar contador inicial
    console.log('🔄 [useUnreadMessages] Cargando contador inicial');
    loadUnreadCount();

    // Limpiar listeners existentes antes de configurar nuevos
    if (socketService.socket) {
      console.log('🧹 [useUnreadMessages] Limpiando listeners existentes');
      socketService.removeListener('message:received');
      socketService.removeListener('conversation:updated');
      socketService.removeListener('messages:read');
      socketService.socket.off('connect', handleSocketConnect.current);
    }

    // Configurar listeners de socket
    const setupSocketListeners = () => {
      console.log('🔌 [useUnreadMessages] Configurando listeners de socket');
      console.log('🔌 [useUnreadMessages] Socket conectado?', socketService.isConnected);

      // Conectar socket si no está conectado
      if (!socketService.isConnected) {
        console.log('🔌 [useUnreadMessages] Conectando socket...');
        socketService.connect();
      }

      // Esperar un momento para que el socket se conecte
      setTimeout(() => {
        if (!socketService.socket) {
          console.error('❌ [useUnreadMessages] Socket no disponible después de conectar');
          return;
        }

        console.log('🎯 [useUnreadMessages] Agregando listener para message:received');
        socketService.onMessageReceived(handleNewMessage.current);

        console.log('🎯 [useUnreadMessages] Agregando listener para conversation:updated');
        socketService.onConversationUpdated(handleConversationUpdate.current);

        console.log('🎯 [useUnreadMessages] Agregando listener para messages:read');
        socketService.onMessagesRead(handleMessagesRead.current);

        // Listener para reconexión
        if (socketService.socket) {
          console.log('🎯 [useUnreadMessages] Agregando listener para connect');
          socketService.socket.on('connect', handleSocketConnect.current);
        }

        console.log('✅ [useUnreadMessages] Todos los listeners configurados');
      }, 500);
    };

    setupSocketListeners();

    return () => {
      // Cleanup
      console.log('🧹 [useUnreadMessages] Limpiando listeners en cleanup');

      if (socketService.socket) {
        socketService.socket.off('connect', handleSocketConnect.current);
        socketService.removeListener('message:received');
        socketService.removeListener('conversation:updated');
        socketService.removeListener('messages:read');
      }
    };
  }, [isAuthenticated]);

  const markAsRead = (conversationId) => {
    // Disminuir el contador cuando se marca una conversación como leída
    loadUnreadCount();
  };

  const setActiveConversation = (conversationId) => {
    console.log('🎯 [useUnreadMessages] Conversación activa establecida:', conversationId);
    activeConversationId.current = conversationId;
  };

  const clearActiveConversation = () => {
    console.log('🎯 [useUnreadMessages] Conversación activa limpiada');
    activeConversationId.current = null;
  };

  return {
    unreadCount,
    markAsRead,
    loadUnreadCount,
    setActiveConversation,
    clearActiveConversation
  };
};
