/**
 * Pantallas "genéricas" de la app —sin un id dinámico— a las que se puede mandar a alguien
 * desde un banner o una notificación manual (push masiva/individual desde el dashboard).
 *
 * Vive en un solo lugar para que banners y notificaciones compartan la misma lista y la misma
 * lógica de navegación en vez de cada una tener la suya (como pasaba antes: bannerNavigation.js
 * tenía su propio switch, notificationNavigation.js el suyo, y agregar un destino nuevo
 * significaba tocar los dos y esperar que a nadie se le olvidara).
 *
 * El `key` tiene que ser IDÉNTICO al que usa dashboard/src/constants/appDestinations.js — si se
 * agrega un destino de un lado sin el otro, el admin lo elige y no pasa nada, sin ningún error
 * visible (mismo problema que ya describe bannerScreens.js para targetApp).
 *
 * Para "un id específico" (un viaje puntual, una reserva puntual) no hay pantalla en esta lista
 * a propósito: eso lo resuelve el esquema de rutas de las notificaciones transaccionales
 * (`actionUrl: '/trips/:id'`, etc., ver navigateFromNotification), que ya arma la ruta con el
 * dato real al crear la notificación. Esta lista es sólo para "mandalo a tal pantalla general".
 */
export const APP_DESTINATIONS = [
  { key: 'home', label: 'Inicio' },
  { key: 'all_trips', label: 'Ver todos los viajes' },
  { key: 'search_trips', label: 'Buscar viajes' },
  { key: 'create_trip', label: 'Crear viaje' },
  { key: 'my_trips', label: 'Mis viajes (los que publiqué)' },
  { key: 'my_bookings', label: 'Mis reservas' },
  { key: 'my_seat_reservations', label: 'Reservas de asiento' },
  { key: 'profile', label: 'Mi perfil' },
  { key: 'saldo', label: 'Mi saldo' },
];

const DESTINATION_KEYS = new Set(APP_DESTINATIONS.map((d) => d.key));

export const isAppDestinationKey = (key) => DESTINATION_KEYS.has(key);

/**
 * Navega a una de las pantallas de arriba.
 * @param {import('@react-navigation/native').NavigationProp} navigation
 * @param {string} key - uno de los `key` de APP_DESTINATIONS
 * @param {boolean} useMainStack - true si `navigation` es el ref raíz (se llama desde fuera de
 *   los tabs, como al tocar una notificación push con la app recién abierta)
 */
export const resolveAppDestination = (navigation, key, useMainStack = false) => {
  if (!navigation || !key) return;

  const go = (tab, params) => {
    if (useMainStack) navigation.navigate('Main', { screen: tab, params });
    else navigation.navigate(tab, params);
  };

  switch (key) {
    case 'home':
      go('HomeTab', { screen: 'Home', initial: false });
      break;
    case 'all_trips':
      go('HomeTab', { screen: 'AllTrips', initial: false });
      break;
    case 'search_trips':
      go('HomeTab', { screen: 'SearchTrips', initial: false });
      break;
    case 'create_trip':
      // Vive en la raíz del stack principal, no en un tab: navigate() sube hasta encontrarla
      // sin importar desde qué tab o si `navigation` ya es el ref raíz.
      navigation.navigate('CreateTrip');
      break;
    case 'my_trips':
      go('CarpoolingsTab', { screen: 'MyTrips', initial: false });
      break;
    case 'my_bookings':
      go('CarpoolingsTab', { screen: 'MyBookings', initial: false });
      break;
    case 'my_seat_reservations':
      go('CarpoolingsTab', { screen: 'MySeatReservations', initial: false });
      break;
    case 'profile':
      go('ProfileTab', { screen: 'Profile', initial: false });
      break;
    case 'saldo':
      go('ProfileTab', { screen: 'Saldo', initial: false });
      break;
    default:
      break;
  }
};
