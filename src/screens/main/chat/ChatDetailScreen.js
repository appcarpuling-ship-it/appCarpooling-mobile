import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Image,
  Animated,
  DeviceEventEmitter,
  Dimensions,
  AppState,
  Modal,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useUnreadMessages } from '../../../hooks/useUnreadMessages';
import apiService, { buildImageUri, post_withauth_formdata } from '../../../services/apiService';
import { appendFile } from '../../../utils/formDataFile';
import { useElegirFoto } from '../../../hooks/useElegirFoto';
import { useAlert } from '../../../context/AlertContext';
import socketService from '../../../services/socketService';
import { useUI } from '../../../theme/ui';
import { reportError } from '../../../utils/sentry';

/** Misma distancia borde superior del compositor ↔ cabecera del input, e input ↔ teclado (teclado abierto). */
const COMPOSER_VERTICAL_INSET = 12;

/** Igual que del lado del server (chatController.EDIT_WINDOW_MS): sólo para no mostrar
 * "Editar" cuando ya va a fallar. El backend es quien lo hace cumplir de verdad. */
const EDIT_WINDOW_MS = 60 * 60 * 1000; // 1 hora

/**
 * Burbuja de un mensaje. Componente propio (y no una función inline dentro del render de
 * la pantalla) para que cada mensaje tenga SU animación al editarse/eliminarse — un solo
 * Animated.Value compartido no puede distinguir "este mensaje cambió" de "otro cambió".
 */
const MessageBubble = ({ item, isOwnMessage, ui, fadeAnim, formatMessageTime, onLongPress, onImagePress }) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const yaMontado = useRef(false);
  const bubbleRef = useRef(null);

  // Un pequeño "pop" cuando cambia el contenido, la foto o pasa a editado/eliminado —
  // pero no en el montaje inicial (cuando se cargan los mensajes de siempre).
  useEffect(() => {
    if (!yaMontado.current) {
      yaMontado.current = true;
      return;
    }
    pulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.spring(pulseAnim, { toValue: 0, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [item.content, item.edited, item.deleted, item.imageUrl, pulseAnim]);

  const canLongPress = isOwnMessage && !item.isTemp && !item.deleted;
  const scale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const highlight = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] });

  // El menú de Editar/Eliminar nace de la burbuja, no del centro de la pantalla: se mide su
  // posición real en pantalla para anclarlo ahí, como el menú contextual de WhatsApp.
  const handleLongPress = () => {
    bubbleRef.current?.measureInWindow((x, y, width, height) => {
      onLongPress(item, { x, y, width, height });
    });
  };

  return (
    <Animated.View
      style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
        { opacity: fadeAnim, transform: [{ scale }] }
      ]}
    >
      <TouchableOpacity
        activeOpacity={canLongPress ? 0.7 : 1}
        onLongPress={canLongPress ? handleLongPress : undefined}
        delayLongPress={300}
      >
        {/* `collapsable={false}`: sin esto Android puede optimizar esta View fuera del árbol
            nativo y `measureInWindow` deja de encontrarla. Se mide una View de verdad (no el
            TouchableOpacity) — es el host component que `measureInWindow` espera. */}
        <View ref={bubbleRef} collapsable={false}>
          {isOwnMessage ? (
            <View style={[styles.messageBubble, styles.ownMessage, { backgroundColor: ui.invertBg }]}>
              {item.deleted ? (
                <Text style={[styles.messageText, styles.deletedText, { color: ui.invertText, opacity: 0.7 }]}>
                  Mensaje eliminado
                </Text>
              ) : (
                <>
                  {item.imageUrl ? (
                    <TouchableOpacity onPress={() => onImagePress(item.imageUrl)} activeOpacity={0.9}>
                      <Image source={{ uri: item.imageUrl }} style={styles.messageImage} resizeMode="cover" />
                    </TouchableOpacity>
                  ) : null}
                  {item.content ? (
                  <Text style={[styles.messageText, { color: ui.invertText }]}>
                    {item.content}
                  </Text>
                  ) : null}
                </>
              )}
              <Text style={[styles.messageTime, { color: ui.invertText, opacity: 0.6 }]}>
                {item.edited && !item.deleted ? 'Editado · ' : ''}{formatMessageTime(item.createdAt)}
              </Text>
            </View>
          ) : (
            <View style={[
              styles.messageBubble,
              styles.otherMessage,
              { backgroundColor: ui.surface }
            ]}>
              {item.deleted ? (
                <Text style={[styles.messageText, styles.deletedText, { color: ui.textMuted, opacity: 0.7 }]}>
                  Mensaje eliminado
                </Text>
              ) : (
                <>
                  {item.imageUrl ? (
                    <TouchableOpacity onPress={() => onImagePress(item.imageUrl)} activeOpacity={0.9}>
                      <Image source={{ uri: item.imageUrl }} style={styles.messageImage} resizeMode="cover" />
                    </TouchableOpacity>
                  ) : null}
                  {item.content ? (
                  <Text style={[styles.messageText, styles.otherMessageText, { color: ui.text }]}>
                    {item.content}
                  </Text>
                  ) : null}
                </>
              )}
              <Text style={[styles.messageTime, styles.otherMessageTime, { color: ui.textMuted }]}>
                {item.edited && !item.deleted ? 'Editado · ' : ''}{formatMessageTime(item.createdAt)}
              </Text>
            </View>
          )}
          {/* Destello breve encima de la burbuja al editar/eliminar, como confirmación visual. */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.pulseOverlay, { backgroundColor: ui.text, opacity: highlight }]}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ChatDetailScreen = ({ route, navigation }) => {
  const params = route.params ?? {};
  const rawConversation = params.conversation;
  const otherUserFromParams = useMemo(() => {
    const o = params.otherUser;
    return o && typeof o === 'object' ? o : {};
  }, [params.otherUser]);
  const conversationId = useMemo(() => {
    if (rawConversation && typeof rawConversation === 'object' && rawConversation._id) {
      return String(rawConversation._id);
    }
    if (typeof rawConversation === 'string' && rawConversation) return rawConversation;
    return null;
  }, [rawConversation]);

  const { user } = useAuth();

  // Al entrar desde una notificación push solo llega el conversationId: el payload
  // no trae al otro participante (notificationNavigation.js manda `otherUser: {}`),
  // y la cabecera quedaba en "Usuario" / "?". Se resuelve acá y no en el emisor del
  // push para que valga igual para deep links y para notificaciones ya enviadas.
  const [fetchedOtherUser, setFetchedOtherUser] = useState(null);
  // El viaje de la conversación, para el subtítulo del header ("Concordia → Córdoba"). Puede
  // venir en los params (si se abrió desde el detalle del viaje) o resolverse por el fetch de
  // abajo (si se llegó desde una notificación push, que solo trae el conversationId).
  const [fetchedTrip, setFetchedTrip] = useState(null);
  const conversationTrip =
    (rawConversation && typeof rawConversation === 'object' && rawConversation.trip) || fetchedTrip;
  const recorridoViaje = (() => {
    const o = conversationTrip?.origin?.city;
    const d = conversationTrip?.destination?.city;
    return o && d ? `${o} → ${d}` : '';
  })();
  const otherUser = otherUserFromParams?.firstName
    ? otherUserFromParams
    : fetchedOtherUser ?? otherUserFromParams;

  useEffect(() => {
    // Se busca si falta el otro usuario O el viaje (subtítulo del header). Desde una
    // notificación push llegan los dos vacíos; desde el detalle del viaje llegan ambos.
    const faltaOtro = !otherUserFromParams?.firstName;
    const faltaViaje = !(rawConversation && typeof rawConversation === 'object' && rawConversation.trip);
    if ((!faltaOtro && !faltaViaje) || !conversationId) return;
    let cancelled = false;
    (async () => {
      try {
        // ponytail: se reusa /chat/conversations (ya popula participants y trip) en vez de
        // agregar un endpoint por id.
        const response = await apiService.get('/chat/conversations');
        const body = response.data;
        if (!body?.success || !Array.isArray(body.data)) return;
        const conv = body.data.find((c) => String(c._id) === String(conversationId));
        if (cancelled || !conv) return;
        const myId = String(user?._id ?? user?.id ?? '');
        const other = conv.participants?.find((p) => String(p._id) !== myId);
        if (other) setFetchedOtherUser(other);
        if (conv.trip) setFetchedTrip(conv.trip);
      } catch (error) {
        reportError(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, otherUserFromParams?.firstName, rawConversation, user?._id, user?.id]);

  const displayName = [otherUser?.firstName, otherUser?.lastName].filter(Boolean).join(' ') || 'Usuario';
  const displayInitials =
    `${otherUser?.firstName?.[0] ?? '?'}` + `${otherUser?.lastName?.[0] ?? ''}`;
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  
  const { loadUnreadCount, setActiveConversation, clearActiveConversation } = useUnreadMessages();
  // Arriba con el resto de los hooks a propósito: más abajo, cualquier `return`
  // temprano que alguien agregue en el medio los saltearía y la pantalla crashea.
  const elegirFoto = useElegirFoto();
  const { showAlert } = useAlert();
  const [messages, setMessages] = useState([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  // scrollToBottom se usa en la carga inicial y al mandar/recibir. NO debe dispararse
  // cuando se prependean mensajes viejos, o el chat salta al final solo.
  const didInitialScrollRef = useRef(false);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // Envío de fotos: comprobantes de seña, capturas, el punto de encuentro.
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  // Mensaje propio en edición (como WhatsApp): al tocar "Editar" se precarga el compositor
  // con su texto y, al mandar, se hace PUT en vez de crear un mensaje nuevo.
  const [editingMessage, setEditingMessage] = useState(null);
  // Menú de Editar/Eliminar de un mensaje propio: antes reusaba el AlertModal genérico con
  // título y botones vacíos (`showAlert(null, null, buttons)`), que se veía como pastillas
  // sin texto. Ahora es su propia hoja, con ícono + rótulo por opción, como WhatsApp.
  const [accionesMensaje, setAccionesMensaje] = useState(null);
  const [typing, setTyping] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputPadBottom = useRef(new Animated.Value(COMPOSER_VERTICAL_INSET + insets.bottom)).current;

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  /**
   * Android: scroll al abrir el teclado y, sobre todo, el padding del compositor.
   * Antes esto colgaba del onFocus/onBlur del TextInput, pero cerrar el teclado
   * (boton atras, gesto) NO desenfoca el input: el onBlur no corria y el padding
   * quedaba sin insets.bottom, asi que el compositor volvia mas arriba de donde
   * estaba al entrar. El teclado es el que manda, no el foco.
   */
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const onShow = Keyboard.addListener('keyboardDidShow', (e) => {
      // Cuanto hay que levantar el compositor = distancia del borde de arriba del teclado
      // al borde FISICO de abajo de la pantalla.
      //
      // No alcanza con endCoordinates.height: RN lo calcula contra el alto de la ventana,
      // que no incluye la barra de navegacion, mientras que en edge-to-edge el compositor
      // si llega hasta el borde de la pantalla. Faltaba justo esa barra y el input quedaba
      // tapado por poco. screenY viene en las mismas coordenadas, asi que restarlo del alto
      // de pantalla da la distancia real sin depender de que incluya o no la barra.
      //
      // El techo es height + insets.bottom, que es lo maximo que puede llegar a faltar:
      // en pantalla dividida screen.height es el alto del display entero y screenY el de
      // la ventana, y sin el techo la resta mandaba el compositor mucho mas arriba.
      const kb = e?.endCoordinates;
      const kbHeight = kb?.height || 0;
      const byScreen = kb?.screenY != null ? Dimensions.get('screen').height - kb.screenY : 0;
      const lift = Math.min(Math.max(byScreen, kbHeight), kbHeight + insets.bottom);
      inputPadBottom.setValue(COMPOSER_VERTICAL_INSET + lift);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
    });
    const onHide = Keyboard.addListener('keyboardDidHide', () => {
      inputPadBottom.setValue(COMPOSER_VERTICAL_INSET + insets.bottom);
    });
    return () => { onShow.remove(); onHide.remove(); };
  }, [insets.bottom]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', () =>
      inputPadBottom.setValue(COMPOSER_VERTICAL_INSET));
    const hide = Keyboard.addListener('keyboardWillHide', () =>
      inputPadBottom.setValue(COMPOSER_VERTICAL_INSET + insets.bottom));
    return () => { show.remove(); hide.remove(); };
  }, [insets.bottom]);

  useLayoutEffect(() => {
    if (!conversationId) {
      navigation.goBack();
    }
  }, [conversationId, navigation]);

  // El server no manda push de mensajes nuevos si el socket del destinatario sigue
  // adentro de la room de la conversación (asume que la está viendo). Minimizar la
  // app no desmonta esta pantalla, así que sin esto la room se quedaba "ocupada" con
  // el chat abierto de fondo y los mensajes que llegaban mientras tanto no avisaban
  // nada — más marcado en Android, donde el socket no se cae tan rápido como en iOS
  // al pasar a segundo plano.
  useEffect(() => {
    if (!conversationId) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        socketService.joinConversation(conversationId);
      } else {
        socketService.leaveConversation(conversationId);
      }
    });
    return () => sub.remove();
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    // Marcar esta conversación como activa para evitar incrementar el contador
    setActiveConversation(conversationId);

    // Animacion fadeIn
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true
    }).start();

    navigation.setOptions({
      headerStyle: {
        backgroundColor: ui.bg
      },
      headerTintColor: ui.text,
      headerTitleStyle: {
        color: ui.text
      },
      headerTitleAlign: 'left',
      headerTitleContainerStyle: {
        left: 0,
        right: 0
      },
      headerBackTitleVisible: false,
      headerLeft: () => (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // ChatDetail siempre se empuja sobre el stack actual (Inicio, o el
            // detalle del viaje si venís de afuera): goBack vuelve al origen. El
            // tab de Mensajes ya no existe, así que el fallback es Inicio.
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('Home');
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={ui.text} />
        </TouchableOpacity>
      ),
      headerTitle: () => {
        const profileUserId = otherUser?._id || otherUser?.id;
        const openPeerProfile = () => {
          if (!profileUserId) return;
          navigation.navigate('UserProfile', {
            userId: String(profileUserId),
            conversationId,
            fromChat: true,
          });
        };
        return (
          <TouchableOpacity
            style={styles.headerTitleTouchable}
            onPress={openPeerProfile}
            activeOpacity={0.75}
            disabled={!profileUserId}
          >
            <View style={styles.headerContainer}>
              <View style={styles.headerAvatarContainer}>
                {otherUser?.avatar && buildImageUri(otherUser.avatar) ? (
                  <Image
                    source={{ uri: buildImageUri(otherUser.avatar) }}
                    style={styles.headerAvatar}
                  />
                ) : (
                  <View style={[styles.headerAvatar, { backgroundColor: ui.invertBg }]}>
                    <Text style={[styles.headerAvatarText, { color: ui.invertText }]}>
                      {displayInitials}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: ui.text }]}>
                  {displayName}
                </Text>
                {/* "Escribiendo..." mientras el otro tipea; el resto del tiempo, el recorrido
                    del viaje. Antes decía "En línea" fijo, que era falso: no hay tracking de
                    presencia. Sin recorrido resuelto todavía, no se muestra segunda línea. */}
                {(typing || recorridoViaje) ? (
                  <Text style={[styles.headerSubtitle, { color: ui.textMuted }]} numberOfLines={1}>
                    {typing ? 'Escribiendo...' : recorridoViaje}
                  </Text>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        );
      }
    });

    loadMessages();

    // Unirse a la conversación
    socketService.joinConversation(conversationId);

    return () => {
      // Limpiar conversación activa al salir
      clearActiveConversation();

      // Salir de la conversación. Los listeners NO se tocan acá: este efecto tiene `typing`
      // entre sus dependencias, así que se limpia cada vez que el otro empieza o deja de
      // escribir — y al desregistrar `message:received` acá, el chat dejaba de recibir
      // mensajes justo después de ver "Escribiendo...". El efecto que los registra (más
      // abajo) no se volvía a ejecutar porque sus dependencias no habían cambiado, así que
      // no había forma de recuperarlos sin salir y volver a entrar. Cada efecto limpia lo
      // suyo: los listeners los da de baja el que los dio de alta.
      socketService.leaveConversation(conversationId);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Recargar contador al salir
      setTimeout(() => {
        loadUnreadCount();
      }, 300);
    };
  }, [conversationId, navigation, otherUser, typing, recorridoViaje, ui.bg, ui.text, ui.textMuted, ui.invertBg, ui.invertText]);

  // Separar en un useEffect para los listeners del socket
  useEffect(() => {
    if (!conversationId) return;
    // Escuchar mensajes en tiempo real
    const handleMessageReceived = async (message) => {
      if (String(message.conversation) !== String(conversationId)) return;

      setMessages(prev => {
        // Evitar duplicados: remover mensaje temporal si existe
        const filtered = (Array.isArray(prev) ? prev : []).filter(m => !m.isTemp);
        const exists = filtered.some(m => m._id === message._id);
        if (exists) return prev;
        return [...filtered, message];
      });
      scrollToBottom();

      // Solo marcar como leído si el usuario está viendo el chat (pantalla enfocada)
      // Evita que al volver a ChatsScreen el handler "fantasma" marque mensajes como leídos
      if (!isFocusedRef.current) return;

      try {
        await apiService.put(`/chat/conversation/${conversationId}/read`);
        console.log('✅ [ChatDetailScreen] Mensaje marcado como leído al recibir');
      } catch (error) {
        console.error('❌ [ChatDetailScreen] Error al marcar mensaje como leído:', error);
        socketService.markMessagesAsRead(conversationId);
      }
      setTimeout(() => loadUnreadCount(), 500);
    };

    // Mensaje propio editado o eliminado (en cualquiera de los dos dispositivos/pestañas):
    // se reemplaza in place, nunca se agrega ni se saca de la lista.
    const handleMessageEdited = (message) => {
      if (String(message.conversation) !== String(conversationId)) return;
      setMessages(prev => prev.map(m => (m._id === message._id ? message : m)));
    };
    const handleMessageDeleted = (message) => {
      if (String(message.conversation) !== String(conversationId)) return;
      setMessages(prev => prev.map(m => (m._id === message._id ? message : m)));
    };

    // Escuchar cuando el otro usuario está escribiendo
    const handleTyping = (data) => {
      const userId = user?._id || user?.id;
      if (data.userId !== userId) {
        setTyping(data.isTyping);
      }
    };

    // Escuchar cuando se cierra la conversación (ej: viaje completado).
    // Se cierra en silencio: el alert nativo era intrusivo.
    const handleConversationClosed = (data) => {
      if (String(data.conversationId) === String(conversationId)) {
        navigation.goBack();
      }
    };

    socketService.onMessageReceived(handleMessageReceived);
    socketService.onMessageEdited(handleMessageEdited);
    socketService.onMessageDeleted(handleMessageDeleted);
    socketService.onTyping(handleTyping);
    socketService.onConversationClosed(handleConversationClosed);

    return () => {
      // Con el callback: el contador global de no leídos (useUnreadMessages) escucha el mismo
      // `message:received`, y sin identificar cuál sacar se llevaba puesto el suyo también.
      socketService.removeListener('message:received', handleMessageReceived);
      socketService.removeListener('message:edited', handleMessageEdited);
      socketService.removeListener('message:deleted', handleMessageDeleted);
      socketService.removeListener('typing:user', handleTyping);
      socketService.removeListener('conversation:closed', handleConversationClosed);
    };
  }, [conversationId, user?._id, user?.id, navigation]);

  const loadMessages = async () => {
    if (!conversationId) return;
    try {
      const response = await apiService.get(
        `/chat/conversation/${conversationId}/messages`
      );

      if (response.data.success) {
        setMessages(response.data.data);
        setHasMoreOlder(response.data.hasMore ?? false);

        // Marcar todos los mensajes como leídos cuando se carga el chat
        try {
          await apiService.put(`/chat/conversation/${conversationId}/read`);
          console.log('✅ [ChatDetailScreen] Mensajes marcados como leídos al cargar');
        } catch (error) {
          console.error('❌ [ChatDetailScreen] Error al marcar mensajes como leídos:', error);
        }

        // Recargar contador de no leídos después de un delay
        setTimeout(() => {
          loadUnreadCount();
        }, 1000);
      }
    } catch (error) {
      console.error('Error al cargar mensajes:', error);
      reportError(error, { screen: 'ChatDetailScreen', action: 'loadMessages' });
    } finally {
      setLoading(false);
    }
  };

  // Pagina por cursor (`before` = fecha del mensaje más viejo cargado) en vez de por
  // offset: si entran mensajes nuevos mientras el usuario sube, un offset le repetiría
  // o le saltearía mensajes.
  const loadOlderMessages = async () => {
    if (loadingOlderRef.current || !hasMoreOlder || messages.length === 0) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const oldest = messages[0];
      const response = await apiService.get(
        `/chat/conversation/${conversationId}/messages`,
        { params: { before: oldest.createdAt, limit: 30 } }
      );
      if (response.data.success) {
        const older = response.data.data || [];
        setMessages(prev => {
          const seen = new Set(prev.map(m => m._id));
          return [...older.filter(m => !seen.has(m._id)), ...prev];
        });
        setHasMoreOlder(response.data.hasMore ?? false);
      }
    } catch (error) {
      console.error('Error al cargar mensajes anteriores:', error);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  };

  const handleSaveEdit = async () => {
    const content = newMessage.trim();
    if (!content || sending) return;
    const messageId = editingMessage._id;
    setSending(true);
    try {
      const response = await apiService.put(`/chat/message/${messageId}`, { content });
      if (response.data?.success) {
        setMessages(prev => prev.map(m => (m._id === messageId ? response.data.data : m)));
      }
      setEditingMessage(null);
      setNewMessage('');
    } catch (error) {
      reportError(error, { screen: 'ChatDetailScreen', action: 'editMessage' });
      showAlert('Ocurrió algo', error?.response?.data?.message || 'No pudimos editar el mensaje. Probá de nuevo.');
    } finally {
      setSending(false);
    }
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setNewMessage('');
  };

  const deleteMessage = async (messageId) => {
    try {
      const response = await apiService.delete(`/chat/message/${messageId}`);
      if (response.data?.success) {
        setMessages(prev => prev.map(m => (m._id === messageId ? response.data.data : m)));
      }
    } catch (error) {
      reportError(error, { screen: 'ChatDetailScreen', action: 'deleteMessage' });
      showAlert('Ocurrió algo', 'No pudimos eliminar el mensaje. Probá de nuevo.');
    }
  };

  // Long-press sobre un mensaje propio: menú Editar/Eliminar, como WhatsApp. `anchor` es la
  // posición real de la burbuja en pantalla (medida en MessageBubble): el menú nace de ahí.
  const handleLongPressMessage = (item, anchor) => {
    const senderId = item.sender?._id || item.sender;
    const isOwnMessage = senderId === user._id || senderId === user.id;
    if (!isOwnMessage || item.isTemp || item.deleted) return;

    // Sólo se edita texto (una foto no tiene qué editar) y sólo dentro de la primera hora.
    const dentroDeVentana = Date.now() - new Date(item.createdAt).getTime() < EDIT_WINDOW_MS;
    setAccionesMensaje({ item, puedeEditar: !!item.content && dentroDeVentana, anchor });
  };

  const handleEditarDesdeAcciones = () => {
    const item = accionesMensaje?.item;
    setAccionesMensaje(null);
    if (!item) return;
    setEditingMessage({ _id: item._id });
    setNewMessage(item.content);
  };

  const handleEliminarDesdeAcciones = () => {
    const item = accionesMensaje?.item;
    setAccionesMensaje(null);
    if (!item) return;
    showAlert(
      'Eliminar mensaje',
      'Se eliminará para todos en la conversación.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteMessage(item._id) },
      ]
    );
  };

  const handleSendMessage = async () => {
    if (editingMessage) return handleSaveEdit();
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // Enviar a través de WebSocket
      socketService.sendMessage(conversationId, messageText);

      // Agregar mensaje optimísticamente
      const tempMessage = {
        _id: Date.now().toString(),
        content: messageText,
        sender: user,
        createdAt: new Date(),
        isTemp: true
      };

      setMessages(prev => [...prev, tempMessage]);
      scrollToBottom();

      // Notificar a ChatsScreen para actualizar el preview sin hacer request
      DeviceEventEmitter.emit('conversationUpdated', {
        conversationId,
        message: tempMessage,
      });

      // Detener indicador de escritura
      socketService.stopTyping(conversationId);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
    } finally {
      setSending(false);
    }
  };

  /**
   * La foto va por HTTP multipart y no por el socket como el texto: un socket no transporta
   * archivos. El backend, al guardarla, emite el mismo `message:received` de siempre, así que
   * la burbuja aparece por el canal de siempre y no hace falta agregarla optimísticamente.
   */
  const handleEnviarFoto = () => {
    if (subiendoFoto || sending) return;
    elegirFoto(async (uri) => {
      setSubiendoFoto(true);
      try {
        const fd = new FormData();
        fd.append('conversationId', conversationId);
        await appendFile(fd, 'image', uri, 'foto.jpg');
        const res = await post_withauth_formdata('/chat/message', fd);
        if (!res?.success) throw new Error(res?.message || 'No se pudo enviar la foto');
        scrollToBottom();
      } catch (e) {
        reportError(e, { screen: 'ChatDetail', action: 'enviarFoto' });
        showAlert('Ocurrió algo', 'No pudimos enviar la foto. Probá de nuevo.');
      } finally {
        setSubiendoFoto(false);
      }
    }, { titulo: 'Enviar foto', mensaje: '¿De dónde la querés sacar?' });
  };

  const handleTyping = (text) => {
    setNewMessage(text);

    // Notificar que está escribiendo
    if (text.length > 0) {
      socketService.startTyping(conversationId);

      // Detener después de 2 segundos sin escribir
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socketService.stopTyping(conversationId);
      }, 2000);
    } else {
      socketService.stopTyping(conversationId);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatMessageTime = (date) => {
    const messageDate = new Date(date);
    return messageDate.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMessage = ({ item }) => {
    const senderId = item.sender?._id || item.sender;
    const isOwnMessage = senderId === user._id || senderId === user.id;
    return (
      <MessageBubble
        item={item}
        isOwnMessage={isOwnMessage}
        ui={ui}
        fadeAnim={fadeAnim}
        formatMessageTime={formatMessageTime}
        onLongPress={handleLongPressMessage}
        onImagePress={setFotoAmpliada}
      />
    );
  };

  if (!conversationId) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: ui.bg }]}>
        <ActivityIndicator size="large" color={ui.invertBg} />
      </View>
    );
  }


  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: ui.bg }]}>
        <ActivityIndicator size="large" color={ui.invertBg} />
      </View>
    );
  }

  // Dónde va el menú de Editar/Eliminar: pegado a la burbuja que se tocó (su `anchor`, medido
  // en MessageBubble), no centrado en la pantalla. Si no entra debajo (bubble cerca del
  // teclado/composer), se dibuja arriba de ella en su lugar.
  const ACCIONES_MENU_WIDTH = 200;
  const accionesMenuPos = (() => {
    const anchor = accionesMensaje?.anchor;
    if (!anchor) return null;
    const { width: screenW, height: screenH } = Dimensions.get('window');
    const filas = accionesMensaje.puedeEditar ? 2 : 1;
    const alto = filas * 48;
    const espacio = 8;
    const margen = 12;
    let top = anchor.y + anchor.height + espacio;
    if (top + alto > screenH - 90) top = anchor.y - alto - espacio;
    top = Math.max(60, top);
    const left = Math.min(
      Math.max(anchor.x + anchor.width - ACCIONES_MENU_WIDTH, margen),
      screenW - ACCIONES_MENU_WIDTH - margen,
    );
    return { top, left, width: ACCIONES_MENU_WIDTH };
  })();

  // En Android el KAV no participa: desde SDK 54 (edge-to-edge) su cuenta de padding
  // se hace sobre el frame de la pantalla y no cerraba en ninguno de los dos estados.
  // Lo maneja el listener de keyboardDidShow con el alto real del teclado, mas arriba.
  // iOS sigue con 'padding' + headerHeight, que es lo que viene andando bien.
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: ui.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      <View style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          ref={flatListRef}
          style={{ flex: 1 }}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => item._id || index.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => {
            if (!didInitialScrollRef.current) {
              scrollToBottom();
              didInitialScrollRef.current = true;
            }
          }}
          onLayout={scrollToBottom}
          onStartReached={loadOlderMessages}
          onStartReachedThreshold={0.2}
          // Mantiene la posición visible al prependear: sin esto el contenido salta
          // hacia arriba cada vez que entra una tanda de mensajes viejos.
          maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
          ListHeaderComponent={
            loadingOlder ? (
              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={ui.textMuted} />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />

        {typing && (
          <View style={[styles.typingIndicator, { backgroundColor: ui.bg }]}>
            <View
              style={[styles.typingDot, { backgroundColor: ui.invertBg }]}
            />
            <Text style={[styles.typingText, { color: ui.textMuted }]}>
              {displayName} esta escribiendo...
            </Text>
          </View>
        )}

        {editingMessage && (
          <View style={[styles.editingBanner, { backgroundColor: ui.surface, borderTopColor: ui.border }]}>
            <Text style={[styles.editingBannerText, { color: ui.text }]} numberOfLines={1}>
              Editando mensaje
            </Text>
            <TouchableOpacity onPress={cancelEdit} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Cancelar edición">
              <Ionicons name="close" size={20} color={ui.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <Animated.View style={[
          styles.inputContainer,
          {
            backgroundColor: ui.bg,
            borderTopColor: ui.border,
            paddingTop: COMPOSER_VERTICAL_INSET,
            paddingBottom: inputPadBottom,
          },
        ]}>
          {/* Adjuntar foto: el mismo selector Cámara/Galería/Cancelar del resto de la app.
              Es lo que hace usable la seña — el pasajero transfiere y manda el comprobante
              acá mismo, en el chat del viaje. Oculto mientras se edita un mensaje: no se
              adjunta una foto a un mensaje de texto ya enviado. */}
          {!editingMessage && (
          <TouchableOpacity
            onPress={handleEnviarFoto}
            disabled={subiendoFoto || sending}
            activeOpacity={0.7}
            style={[styles.attachButton, { backgroundColor: ui.surface, borderColor: ui.border }]}
            accessibilityRole="button"
            accessibilityLabel="Adjuntar foto"
          >
            {subiendoFoto
              ? <ActivityIndicator size="small" color={ui.text} />
              : <Ionicons name="camera-outline" size={20} color={ui.text} />}
          </TouchableOpacity>
          )}
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: ui.surface,
                borderColor: ui.border,
                color: ui.text,
              },
            ]}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={ui.textMuted}
            value={newMessage}
            onChangeText={handleTyping}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.sendButton,
                { backgroundColor: (!newMessage.trim() || sending) ? ui.surface : ui.invertBg },
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={ui.invertText} />
              ) : (
                <Ionicons name={editingMessage ? 'checkmark' : 'send'} size={22} color={(!newMessage.trim()) ? ui.textMuted : ui.invertText} />
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
        </Animated.View>
      </View>

      {/* Foto a pantalla completa: un comprobante de transferencia en una burbuja chica no
          se lee. Se cierra tocando en cualquier lado. */}
      <Modal visible={!!fotoAmpliada} transparent animationType="fade" onRequestClose={() => setFotoAmpliada(null)}>
        <TouchableOpacity style={styles.fotoOverlay} activeOpacity={1} onPress={() => setFotoAmpliada(null)}>
          <Image source={{ uri: fotoAmpliada }} style={styles.fotoAmpliada} resizeMode="contain" />
        </TouchableOpacity>
      </Modal>

      {/* Editar/Eliminar un mensaje propio: el menú nace de la burbuja que tocaste, anclado a
          su posición real en pantalla (medida en MessageBubble), no un cuadro centrado — como
          el menú contextual de WhatsApp. Tocar afuera lo cierra, no hace falta un "Cancelar". */}
      <Modal
        visible={!!accionesMensaje}
        transparent
        animationType="fade"
        onRequestClose={() => setAccionesMensaje(null)}
      >
        <TouchableOpacity style={styles.accionesOverlay} activeOpacity={1} onPress={() => setAccionesMensaje(null)}>
          {!!accionesMenuPos && (
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.accionesSheet, accionesMenuPos, { backgroundColor: ui.card, borderColor: ui.border }]}
              onPress={() => {}}
            >
              {accionesMensaje?.puedeEditar && (
                <>
                  <TouchableOpacity style={styles.accionFila} onPress={handleEditarDesdeAcciones} activeOpacity={0.7}>
                    <Ionicons name="create-outline" size={19} color={ui.text} />
                    <Text style={[styles.accionTexto, { color: ui.text }]}>Editar</Text>
                  </TouchableOpacity>
                  <View style={[styles.accionDivider, { backgroundColor: ui.border }]} />
                </>
              )}
              <TouchableOpacity style={styles.accionFila} onPress={handleEliminarDesdeAcciones} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={19} color="#DC2626" />
                <Text style={[styles.accionTexto, { color: '#DC2626' }]}>Eliminar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>

    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  // Header styles
  headerTitleTouchable: {
    flex: 1,
    maxWidth: '100%',
  },
  headerContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginLeft: -16
  },
  headerAvatarContainer: {
    marginRight: 12
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerAvatarText: {
    fontSize: 16,
    fontFamily: 'Sora_700Bold'
  },
  headerTextContainer: {
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Sora_600SemiBold',
    marginBottom: 2
  },
  headerSubtitle: {
    fontSize: 12
  },
  // Messages list
  messagesList: {
    padding: 16,
    paddingBottom: 8
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '80%'
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse'
  },
  otherMessageContainer: {
    alignSelf: 'flex-start'
  },
  messageAvatar: {
    marginRight: 8
  },
  smallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  smallAvatarText: {
    fontSize: 13,
    fontFamily: 'Sora_700Bold'
  },
  // Message bubbles
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  ownMessage: {
    borderBottomRightRadius: 4
  },
  otherMessage: {
    borderBottomLeftRadius: 4
  },
  // Foto dentro de la burbuja. Ancho fijo para que todas se vean parejas; el alto sale del
  // 4:3 más común en fotos de celular, y `cover` recorta lo que sobre.
  messageImage: { width: 200, height: 150, borderRadius: 12, marginBottom: 6 },
  attachButton: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  fotoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  fotoAmpliada: { width: '100%', height: '80%' },

  // Menú Editar/Eliminar de un mensaje: nace anclado a la burbuja (`accionesMenuPos`, con
  // top/left/width calculados en el render), no centrado en la pantalla.
  accionesOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  accionesSheet: {
    position: 'absolute', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  accionFila: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  accionTexto: { fontSize: 14, fontFamily: 'Sora_500Medium' },
  accionDivider: { height: StyleSheet.hairlineWidth },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 4
  },
  otherMessageText: {
    // Color dinámico aplicado en JSX
  },
  deletedText: {
    fontStyle: 'italic'
  },
  pulseOverlay: {
    borderRadius: 18
  },
  editingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  editingBannerText: {
    fontSize: 13,
    fontFamily: 'Sora_500Medium',
    flex: 1,
  },
  messageTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 2
  },
  otherMessageTime: {
    // Color dinámico aplicado en JSX
  },
  // Typing indicator
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8
  },
  typingText: {
    fontSize: 13,
    fontStyle: 'italic'
  },
  // Input area
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  // Back button
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: -8,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 15,
    // minHeight: en nativo un TextInput multiline vacío ya se acomoda solo a una línea,
    // pero react-native-web renderiza el <textarea> con una altura por defecto bastante
    // más alta que eso — sin este piso explícito, el input vacío se veía enorme en web.
    minHeight: 44,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4
  }
});

export default ChatDetailScreen;
