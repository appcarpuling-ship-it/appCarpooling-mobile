import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSocketURL, SOCKET_CONFIG } from '../config/socket.config';
import { notifySessionInvalid, isSocketAuthFailure } from './authSession';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  /**
   * Conectar al servidor WebSocket
   */
  async connect() {
    try {
      // Obtener token de autenticación
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        console.error('No se encontró token de autenticación');
        return;
      }

      const url = getSocketURL();
      console.log('🔌 Conectando WebSocket a:', url);

      // Crear conexión socket
      this.socket = io(url, {
        auth: {
          token
        },
        ...SOCKET_CONFIG.OPTIONS
      });

      // Eventos de conexión
      this.socket.on('connect', () => {
        console.log('✅ Conectado al servidor WebSocket');
        this.isConnected = true;
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Desconectado del servidor WebSocket');
        this.isConnected = false;
      });

      this.socket.on('connect_error', async (error) => {
        console.error('Error de conexión WebSocket:', error.message, '(URL:', url, ')');
        this.isConnected = false;
        if (isSocketAuthFailure(error?.message)) {
          this.disconnect();
          await notifySessionInvalid();
        }
      });

      this.socket.on('error', (error) => {
        console.error('Error de socket:', error);
      });

    } catch (error) {
      console.error('Error al conectar socket:', error);
    }
  }

  /**
   * Desconectar del servidor
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  /**
   * Unirse a una conversación
   */
  joinConversation(conversationId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('conversation:join', conversationId);
    }
  }

  /**
   * Salir de una conversación
   */
  leaveConversation(conversationId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('conversation:leave', conversationId);
    }
  }

  /**
   * Enviar un mensaje
   */
  sendMessage(conversationId, content) {
    if (this.socket && this.isConnected) {
      this.socket.emit('message:send', { conversationId, content });
    }
  }

  /**
   * Indicar que el usuario está escribiendo
   */
  startTyping(conversationId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing:start', conversationId);
    }
  }

  /**
   * Indicar que el usuario dejó de escribir
   */
  stopTyping(conversationId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing:stop', conversationId);
    }
  }

  /**
   * Marcar mensajes como leídos
   */
  markMessagesAsRead(conversationId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('messages:read', { conversationId });
    }
  }

  /**
   * Escuchar mensajes recibidos
   */
  onMessageReceived(callback) {
    if (this.socket) {
      this.socket.on('message:received', (message) => {
        callback(message);
      });
    } else {
      console.warn('Socket no disponible para onMessageReceived');
    }
  }

  /**
   * Escuchar cuando alguien está escribiendo
   */
  onTyping(callback) {
    if (this.socket) {
      this.socket.on('typing:user', (data) => {
        callback(data);
      });
    }
  }

  /**
   * Escuchar actualizaciones de conversaciones
   */
  onConversationUpdated(callback) {
    if (this.socket) {
      this.socket.on('conversation:updated', (data) => {
        callback(data);
      });
    } else {
      console.warn('Socket no disponible para onConversationUpdated');
    }
  }

  /**
   * Escuchar mensajes leídos
   */
  onMessagesRead(callback) {
    if (this.socket) {
      this.socket.on('messages:read', (data) => {
        callback(data);
      });
    } else {
      console.warn('Socket no disponible para onMessagesRead');
    }
  }

  /**
   * Escuchar conversaciones cerradas
   */
  onConversationClosed(callback) {
    if (this.socket) {
      this.socket.on('conversation:closed', (data) => {
        callback(data);
      });
    } else {
      console.warn('Socket no disponible para onConversationClosed');
    }
  }

  /**
   * Escuchar usuarios en línea
   */
  onUsersOnline(callback) {
    if (this.socket) {
      this.socket.on('users:online', callback);
      this.listeners.set('users:online', callback);
    }
  }

  /**
   * Escuchar notificaciones recibidas
   */
  onNotificationReceived(callback) {
    if (this.socket) {
      this.socket.on('notification:new', callback);
      this.listeners.set('notification:new', callback);
    }
  }

  /**
   * Escuchar actualizaciones de estado de reservas
   */
  onBookingStatusUpdate(callback) {
    if (this.socket) {
      this.socket.on('booking:statusUpdate', callback);
      this.listeners.set('booking:statusUpdate', callback);
    }
  }

  /**
   * Remover listener específico
   */
  removeListener(event) {
    if (this.socket && this.listeners.has(event)) {
      this.socket.off(event, this.listeners.get(event));
      this.listeners.delete(event);
    }
  }

  /**
   * Remover todos los listeners
   */
  removeAllListeners() {
    if (this.socket) {
      this.listeners.forEach((callback, event) => {
        this.socket.off(event, callback);
      });
      this.listeners.clear();
    }
  }
}

// Exportar instancia singleton
export default new SocketService();
