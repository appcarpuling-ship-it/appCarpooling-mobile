import { useState, useEffect, useRef } from 'react';
import { get_withauth } from '../services/apiService';
import socketService from '../services/socketService';
import { useAuth } from '../context/AuthContext';

export const useUnreadMessages = () => {
  const { user, isAuthenticated } = useAuth();
  const authUserId = user?._id?.toString() || user?.id?.toString() || '';

  const [unreadCount, setUnreadCount] = useState(0);
  const listenersSetup = useRef(false);
  const userRef = useRef(user);
  const setUnreadCountRef = useRef(setUnreadCount);
  const prevAuthUserIdRef = useRef(null);
  const activeConversationId = useRef(null);

  // Update user ref when user changes
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Update setUnreadCount ref when it changes
  useEffect(() => {
    setUnreadCountRef.current = setUnreadCount;
  }, []);

  // Stable handlers que siempre tienen acceso a los valores más recientes
  const handleNewMessage = useRef((message) => {
    const currentUser = userRef.current;
    if (!currentUser) return;

    const currentUserId = currentUser._id || currentUser.id;
    const messageSenderId = message.sender?._id || message.sender;
    const messageConversationId = message.conversation;

    if (messageSenderId && messageSenderId.toString() !== currentUserId.toString()) {
      if (messageConversationId === activeConversationId.current) return;

      setUnreadCountRef.current(prev => prev + 1);
    }
  });

  const handleConversationUpdate = useRef(() => {
    loadUnreadCountRef.current();
  });

  const handleMessagesRead = useRef((data) => {
    setTimeout(() => {
      loadUnreadCountRef.current();
    }, 200);
  });

  const handleSocketConnect = useRef(() => {
    loadUnreadCountRef.current();
  });

  // Ref para mantener el valor actual de unreadCount
  const unreadCountRef = useRef(unreadCount);
  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  // Función para cargar contador - usar ref para evitar problemas con hooks en callbacks
  const loadingRef = useRef(false);
  const loadUnreadCountRef = useRef(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const response = await get_withauth('/chat/unread-count');
      if (response.success && response.data != null) {
        const newCount =
          typeof response.data.count === 'number' ? response.data.count : Number(response.data.count) || 0;
        if (newCount !== unreadCountRef.current) {
          console.log('📊 [useUnreadMessages] Contador actualizado:', unreadCountRef.current, '→', newCount);
          setUnreadCountRef.current(newCount);
        }
      }
    } catch (error) {
      console.error('❌ [useUnreadMessages] Error al cargar mensajes no leídos:', error);
    } finally {
      loadingRef.current = false;
    }
  });

  useEffect(() => {
    if (!isAuthenticated || !authUserId) {
      setUnreadCount(0);
      prevAuthUserIdRef.current = null;
      return;
    }

    const switchedAccount =
      prevAuthUserIdRef.current != null && prevAuthUserIdRef.current !== authUserId;
    prevAuthUserIdRef.current = authUserId;
    if (switchedAccount) {
      setUnreadCount(0);
    }

    loadUnreadCountRef.current();

    // Limpiar los listeners PROPIOS antes de configurar nuevos. Con el callback: sin él se
    // daban de baja todos los de ese evento, incluido el de ChatDetailScreen si había un chat
    // abierto (registerListener ya ignora los duplicados, así que re-registrar es inofensivo).
    if (socketService.socket) {
      socketService.removeListener('message:received', handleNewMessage.current);
      socketService.removeListener('conversation:updated', handleConversationUpdate.current);
      socketService.removeListener('messages:read', handleMessagesRead.current);
      socketService.socket.off('connect', handleSocketConnect.current);
    }

    // Configurar listeners de socket
    const setupSocketListeners = () => {
      if (!socketService.isConnected) {
        socketService.connect();
      }

      setTimeout(() => {
        if (!socketService.socket) return;

        socketService.onMessageReceived(handleNewMessage.current);
        socketService.onConversationUpdated(handleConversationUpdate.current);
        socketService.onMessagesRead(handleMessagesRead.current);

        if (socketService.socket) {
          socketService.socket.on('connect', handleSocketConnect.current);
        }
      }, 500);
    };

    setupSocketListeners();

    return () => {

      if (socketService.socket) {
        socketService.socket.off('connect', handleSocketConnect.current);
        socketService.removeListener('message:received', handleNewMessage.current);
        socketService.removeListener('conversation:updated', handleConversationUpdate.current);
        socketService.removeListener('messages:read', handleMessagesRead.current);
      }
    };
  }, [isAuthenticated, authUserId]);

  const markAsRead = (conversationId) => {
    // Disminuir el contador cuando se marca una conversación como leída
    loadUnreadCountRef.current();
  };

  const setActiveConversation = (conversationId) => {
    activeConversationId.current = conversationId;
  };

  const clearActiveConversation = () => {
    activeConversationId.current = null;
  };

  return {
    unreadCount,
    markAsRead,
    loadUnreadCount: loadUnreadCountRef.current,
    setActiveConversation,
    clearActiveConversation
  };
};
