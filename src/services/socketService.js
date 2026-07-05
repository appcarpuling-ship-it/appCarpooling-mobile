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

      // Aplicar listeners pendientes garantizando que no se registren dos veces.
      // socket.io reutiliza la misma instancia si la URL es la misma, por lo que
      // es necesario quitar el listener previo antes de volver a añadirlo.
      this.listeners.forEach((callback, event) => {
        this.socket.off(event, callback);
        this.socket.on(event, callback);
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
   * Escuchar notificaciones recibidas.
   * El callback se guarda en this.listeners siempre, y si el socket ya existe
   * se registra de inmediato; si no, connect() lo aplicará cuando cree el socket.
   */
  onNotificationReceived(callback) {
    // Quitar listener previo si existe para no registrar el mismo evento dos veces
    if (this.socket && this.listeners.has('notification:new')) {
      this.socket.off('notification:new', this.listeners.get('notification:new'));
    }
    this.listeners.set('notification:new', callback);
    if (this.socket) {
      this.socket.on('notification:new', callback);
    }
  }

  onBookingStatusUpdate(callback) {
    if (this.socket && this.listeners.has('booking:statusUpdate')) {
      this.socket.off('booking:statusUpdate', this.listeners.get('booking:statusUpdate'));
    }
    this.listeners.set('booking:statusUpdate', callback);
    if (this.socket) {
      this.socket.on('booking:statusUpdate', callback);
    }
  }

  /**
   * Unirse/salir del seguimiento de ubicación en vivo de un viaje
   */
  joinTripTracking(tripId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('trip:track:join', tripId);
    }
  }

  leaveTripTracking(tripId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('trip:track:leave', tripId);
    }
  }

  /**
   * El conductor reporta su posición GPS (solo coordenadas, sin llamadas a APIs de mapas)
   */
  sendTripLocationUpdate(tripId, { latitude, longitude, heading }) {
    if (this.socket && this.isConnected) {
      this.socket.emit('trip:location:update', { tripId, latitude, longitude, heading });
    }
  }

  onTripLocation(callback) {
    if (this.socket && this.listeners.has('trip:location')) {
      this.socket.off('trip:location', this.listeners.get('trip:location'));
    }
    this.listeners.set('trip:location', callback);
    if (this.socket) {
      this.socket.on('trip:location', callback);
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
