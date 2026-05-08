/**
 * Navegación compartida: lista de notificaciones in-app y notificación push del sistema.
 *
 * @param {import('@react-navigation/native').NavigationProp} navigation
 * @param {object} notification - documento de API o forma normalizada desde push `data`
 * @param {{ useMainStack?: boolean }} [options] - true si `navigation` es el ref raíz (Stack con Main)
 */

function navigateToTripDetail(navigation, tripId, useMainStack) {
  if (!tripId) return;
  const params = { screen: 'TripDetail', params: { tripId } };
  if (useMainStack) {
    navigation.navigate('Main', { screen: 'HomeTab', params });
  } else {
    navigation.navigate('HomeTab', params);
  }
}

function navigateToTripRequests(navigation, tripId, useMainStack) {
  if (!tripId) return;
  const params = { screen: 'TripRequests', params: { tripId } };
  if (useMainStack) {
    navigation.navigate('Main', { screen: 'CarpoolingsTab', params });
  } else {
    navigation.navigate('CarpoolingsTab', params);
  }
}

function navigateToCreateReview(navigation, tripId, useMainStack) {
  if (!tripId) return;
  const params = { screen: 'CreateReviewFromTrip', params: { tripId } };
  if (useMainStack) {
    navigation.navigate('Main', { screen: 'CarpoolingsTab', params });
  } else {
    navigation.navigate('CarpoolingsTab', params);
  }
}

function navigateToChat(navigation, conversationId, otherUser, useMainStack) {
  if (!conversationId) return;
  const chatParams = {
    screen: 'ChatDetail',
    params: {
      conversation: { _id: conversationId },
      otherUser: otherUser || {},
    },
  };
  if (useMainStack) {
    navigation.navigate('Main', { screen: 'ChatsTab', params: chatParams });
  } else {
    navigation.navigate('ChatsTab', chatParams);
  }
}

function navigateToChats(navigation, useMainStack) {
  const params = { screen: 'Chats' };
  if (useMainStack) {
    navigation.navigate('Main', { screen: 'ChatsTab', params });
  } else {
    navigation.navigate('ChatsTab', params);
  }
}

function navigateToMyBookings(navigation, useMainStack) {
  const params = { screen: 'MyBookings' };
  if (useMainStack) {
    navigation.navigate('Main', { screen: 'CarpoolingsTab', params });
  } else {
    navigation.navigate('CarpoolingsTab', params);
  }
}

function navigateToMySeatReservations(navigation, useMainStack) {
  const params = { screen: 'MySeatReservations' };
  if (useMainStack) {
    navigation.navigate('Main', { screen: 'CarpoolingsTab', params });
  } else {
    navigation.navigate('CarpoolingsTab', params);
  }
}

function navigateToProfile(navigation, useMainStack) {
  const params = { screen: 'Profile' };
  if (useMainStack) {
    navigation.navigate('Main', { screen: 'ProfileTab', params });
  } else {
    navigation.navigate('ProfileTab', params);
  }
}

/**
 * Convierte el payload `data` de Expo Push a forma parecida a un documento Notification.
 * Los valores en push suelen ser strings.
 */
export function buildNotificationLikeFromPushData(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const str = (k) => {
    const v = data[k];
    if (v == null || v === undefined) return null;
    return typeof v === 'string' ? v : String(v);
  };

  const tripId = str('tripId');
  const bookingId = str('bookingId');
  const conversationId = str('conversationId');
  const senderId = str('senderId');
  let actionUrl = str('actionUrl');

  if (!actionUrl && conversationId) {
    actionUrl = `/chat/${conversationId}`;
  }

  const senderFirstName = str('senderFirstName');
  const senderLastName = str('senderLastName');
  return {
    actionUrl,
    type: str('type') || '',
    relatedTrip: tripId ? { _id: tripId } : null,
    relatedBooking: bookingId ? { _id: bookingId } : null,
    data: {
      tripId,
      bookingId,
      conversationId,
      sender: senderId ? { _id: senderId } : {},
    },
    relatedUser: {
      ...(senderId && { _id: senderId }),
      ...(senderFirstName && { firstName: senderFirstName }),
      ...(senderLastName && { lastName: senderLastName }),
    },
  };
}

export function navigateFromNotification(navigation, notification, options = {}) {
  if (!navigation || !notification) return;
  const useMainStack = !!options.useMainStack;

  const getTripId = () => {
    if (notification.relatedTrip) return notification.relatedTrip._id || notification.relatedTrip;
    if (notification.data?.tripId) return notification.data.tripId;
    return null;
  };
  const getBookingId = () => {
    if (notification.relatedBooking) return notification.relatedBooking._id || notification.relatedBooking;
    if (notification.data?.bookingId) return notification.data.bookingId;
    return null;
  };
  const getConversationId = () => {
    if (notification.data?.conversationId) return notification.data.conversationId;
    if (notification.actionUrl?.startsWith('/chat/')) {
      const match = notification.actionUrl.match(/\/chat\/([^/]+)/);
      return match ? match[1] : null;
    }
    return null;
  };

  const tripId = getTripId();
  const bookingId = getBookingId();
  const conversationId = getConversationId();

  if (notification.actionUrl) {
    const path = notification.actionUrl.replace(/^\//, '');
    const parts = path.split('/');
    if (path.startsWith('trips/')) {
      const id = parts[1];
      if (parts[2] === 'requests' && id) {
        navigateToTripRequests(navigation, id, useMainStack);
      } else if (parts[2] === 'review' && id) {
        navigateToCreateReview(navigation, id, useMainStack);
      } else if (id) {
        navigateToTripDetail(navigation, id, useMainStack);
      }
      return;
    }
    if (path.startsWith('bookings/')) {
      navigateToMyBookings(navigation, useMainStack);
      return;
    }
    if (path.startsWith('chat/')) {
      const id = parts[1];
      if (id) {
        navigateToChat(navigation, id, notification.relatedUser || {}, useMainStack);
      }
      return;
    }
    if (path === 'seat-reservations' || path.startsWith('seat-reservations/')) {
      navigateToMySeatReservations(navigation, useMainStack);
      return;
    }
    if (path === 'profile' || path === 'security') {
      navigateToProfile(navigation, useMainStack);
      return;
    }
    return;
  }

  if (tripId) {
    const type = notification.type || '';
    if (type.includes('booking_created') || type.includes('seat_reservation_request')) {
      navigateToTripRequests(navigation, tripId, useMainStack);
    } else if (type.includes('review')) {
      navigateToCreateReview(navigation, tripId, useMainStack);
    } else {
      navigateToTripDetail(navigation, tripId, useMainStack);
    }
    return;
  }
  if (conversationId) {
    navigateToChat(
      navigation,
      conversationId,
      notification.relatedUser || notification.data?.sender || {},
      useMainStack
    );
    return;
  }
  if (bookingId) {
    navigateToMyBookings(navigation, useMainStack);
    return;
  }
  if (notification.type === 'review_received') {
    navigateToProfile(navigation, useMainStack);
    return;
  }
  if (notification.type === 'new_message') {
    navigateToChats(navigation, useMainStack);
  }
}
