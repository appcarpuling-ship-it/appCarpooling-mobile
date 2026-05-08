/**
 * Guías prácticas desde Ayuda: cada paso puede incluir `nav` para llevar al usuario a la pantalla indicada.
 * `nav.main`: tabs bajo Main. `nav.root`: pantallas del stack raíz (CreateTrip, etc.).
 */

export const HELP_GUIDE_CATALOG = [
  {
    id: 'create_trip',
    listIcon: 'add-circle-outline',
    listTitle: 'Crear un viaje',
    listSubtitle: 'Publicá tu ruta como conductor: mapa, fecha, precio y asientos',
  },
  {
    id: 'add_vehicle',
    listIcon: 'car-outline',
    listTitle: 'Cargar mi vehículo',
    listSubtitle: 'Patente, datos y foto para poder ofrecer viajes',
  },
  {
    id: 'book_trip',
    listIcon: 'ticket-outline',
    listTitle: 'Inscribirme / reservar un viaje',
    listSubtitle: 'Buscar, elegir un viaje y confirmar tus asientos',
  },
  {
    id: 'my_bookings',
    listIcon: 'briefcase-outline',
    listTitle: 'Ver mis reservas',
    listSubtitle: 'Viajes que reservaste como pasajero',
  },
  {
    id: 'driver_my_trips',
    listIcon: 'ribbon-outline',
    listTitle: 'Mis viajes creados',
    listSubtitle: 'Viajes que publicaste como conductor',
  },
  {
    id: 'trip_requests',
    listIcon: 'people-outline',
    listTitle: 'Solicitudes de pasajeros',
    listSubtitle: 'Aceptar o rechazar quien quiere subirse a tu viaje',
  },
  {
    id: 'chats',
    listIcon: 'chatbubbles-outline',
    listTitle: 'Mensajes y coordinación',
    listSubtitle: 'Hablar con conductor o pasajeros',
  },
];

const GUIDES = {
  create_trip: {
    id: 'create_trip',
    steps: [
      {
        key: 'ct1',
        icon: 'navigate-outline',
        title: 'Empezamos en Viajes',
        body: 'Los viajes que vos ofrecés como conductor se gestionan desde la pestaña «» (el ícono del auto en la barra inferior). Ahí está todo junto: crear viaje, ver los que publicaste y tus reservas como pasajero.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'Carpoolings' } },
      },
      {
        key: 'ct2',
        icon: 'list-outline',
        title: 'La pantalla “Gestionar viajes”',
        body: 'Vas a ver un listado con accesos claros. La primera opción es «»: es la puerta de entrada para publicar un nuevo trayecto. Más abajo están “Mis viajes creados”, “Mis reservas”, etc.\n\nEn el siguiente paso abrimos el formulario real.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'Carpoolings' } },
      },
      {
        key: 'ct3',
        icon: 'map-outline',
        title: 'Formulario con mapa',
        body: 'Al tocar «» se abre la pantalla de publicación (mapa y campos). Ahí definís:\n\n• «» (podés buscar direcciones o elegir en el mapa)\n• «» de salida\n• «» y «» (o la regla que use la app)\n• Cualquier detalle extra que pidan los campos\n\nTomate el tiempo de revisar que la ruta y el horario sean los que querés ofrecer.',
        nav: { root: 'CreateTrip' },
      },
      {
        key: 'ct4',
        icon: 'document-text-outline',
        title: 'Antes de publicar',
        body: 'Es buena idea tener cargado «» en tu perfil si la app lo pide al publicar. Si aún no cargaste el auto, podés salir con el botón atrás del sistema, ir a «» y volver después (también tenés una guía aparte para el vehículo).\n\nCuando todo esté completo, confirmá o publicá según el botón que muestre la pantalla.',
        nav: { root: 'CreateTrip' },
      },
      {
        key: 'ct5',
        icon: 'checkmark-done-outline',
        title: 'Después de publicar',
        body: 'Tu viaje quedará visible para otros usuarios. Van a poder pedir lugar o reservar según cómo esté armada la app. Vas a poder seguir el estado desde «» o desde «» si alguien quiere subirse.\n\n¡Listo! Ya sabés el camino completo para crear un viaje.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'Carpoolings' } },
      },
    ],
  },

  add_vehicle: {
    id: 'add_vehicle',
    steps: [
      {
        key: 'av1',
        icon: 'person-outline',
        title: 'Tu perfil',
        body: 'Los datos del vehículo están en «»: último ícono de la barra inferior (persona). Desde ahí accedés a tu cuenta y a opciones como editar datos o «».',
        nav: { main: { tab: 'ProfileTab', screen: 'Profile' } },
      },
      {
        key: 'av2',
        icon: 'car-outline',
        title: 'Mis vehículos',
        body: 'Tocá «». Vas a ver la lista de autos que ya cargaste (si todavía no tenés ninguno, la lista puede estar vacía: es normal).\n\nPara sumar uno nuevo, usá el botón de «» (+) o la acción que muestre la parte superior o inferior de la pantalla.',
        nav: { main: { tab: 'ProfileTab', screen: 'Vehicles' } },
      },
      {
        key: 'av3',
        icon: 'create-outline',
        title: 'Formulario del vehículo',
        body: 'En el formulario completá con cuidado:\n\n• «»\n• «» y «» (como figura en la cédula)\n• «» útiles para viaje, si aplica\n• «» u otros datos que pida la pantalla\n\nLos datos correctos ayudan a que los pasajeros confíen y a evitar problemas al coordinar.',
        nav: { main: { tab: 'ProfileTab', screen: 'VehicleForm', params: {} } },
      },
      {
        key: 'av4',
        icon: 'shield-checkmark-outline',
        title: 'Guardar y listo',
        body: 'Guardá o confirmá con el botón principal de la pantalla. Si algo falta, la app suele avisarte qué campo revisar.\n\nMás adelante podés «» un vehículo desde la misma lista tocando el ítem correspondiente.',
        nav: { main: { tab: 'ProfileTab', screen: 'Vehicles' } },
      },
    ],
  },

  book_trip: {
    id: 'book_trip',
    steps: [
      {
        key: 'bk1',
        icon: 'home-outline',
        title: 'Inicio',
        body: 'Para «» como pasajero, lo habitual es empezar desde «» (primer ícono abajo). Ahí suele haber accesos rápidos para buscar viajes o ver recomendaciones.',
        nav: { main: { tab: 'HomeTab', screen: 'Home' } },
      },
      {
        key: 'bk2',
        icon: 'search-outline',
        title: 'Buscar viajes',
        body: 'Tocá la opción para «» (por ejemplo “Buscar” o un campo de origen/destino en la pantalla principal). Vas a poder indicar «» salís, «» querés ir y la «».\n\nLa app te mostrará resultados compatibles con tu búsqueda.',
        nav: { main: { tab: 'HomeTab', screen: 'SearchTrips' } },
      },
      {
        key: 'bk3',
        icon: 'list-circle-outline',
        title: 'Resultados y detalle',
        body: 'En la lista de resultados, tocá el viaje que te interese. Se abre el «»: conductor, horario, precio por asiento, puntos de encuentro y reglas del viaje.\n\nLeé bien antes de reservar: horario de salida, políticas y cuántos asientos quedan.',
        nav: { main: { tab: 'HomeTab', screen: 'SearchTrips' } },
      },
      {
        key: 'bk4',
        icon: 'calendar-outline',
        title: 'Otra forma: ver muchos viajes',
        body: 'Si tu app ofrece «» u otra lista general desde Inicio, también podés entrar ahí, filtrar mentalmente por tu ruta y abrir el detalle del que prefieras. El flujo después es el mismo: abrir el viaje y buscar la acción de «».',
        nav: { main: { tab: 'HomeTab', screen: 'AllTrips' } },
      },
      {
        key: 'bk5',
        icon: 'hand-left-outline',
        title: 'Reservar',
        body: 'Dentro del detalle del viaje, tocá «» (o el botón equivalente). Elegí «» necesitás y seguí los pasos que te pida la pantalla (confirmación, mensajes al conductor si aplica, etc.).\n\nHasta que no confirmes desde esa pantalla, el lugar no queda asegurado.',
        nav: { main: { tab: 'HomeTab', screen: 'SearchTrips' } },
      },
      {
        key: 'bk6',
        icon: 'reader-outline',
        title: 'Después de reservar',
        body: 'Podés revisar lo que reservaste en «». Ahí ves el estado de cada viaje y podés coordinar por «» si hace falta.\n\nSi tenés dudas, también podés volver a esta sección de Ayuda cuando quieras.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'MyBookings' } },
      },
    ],
  },

  my_bookings: {
    id: 'my_bookings',
    steps: [
      {
        key: 'mb1',
        icon: 'car-outline',
        title: 'Pestaña Viajes',
        body: 'Tus reservas como «» se agrupan en la pestaña «» (auto abajo). No hace falta estar en Inicio: todo lo de “yo me subí a un viaje de otro” suele estar acá.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'Carpoolings' } },
      },
      {
        key: 'mb2',
        icon: 'briefcase-outline',
        title: 'Mis reservas',
        body: 'Tocá «». Vas a ver la lista de viajes a los que te anotaste: fechas, conductor, estado (confirmada, pendiente, etc.).\n\nDesde cada ítem suele poder entrar al detalle o cancelar si la app lo permite.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'MyBookings' } },
      },
      {
        key: 'mb3',
        icon: 'notifications-outline',
        title: 'Cambios y avisos',
        body: 'Si el conductor cancela o cambia algo, suele llegarte «». Revisá también «» si necesitás coordinar hora o punto de encuentro.\n\nMantener la comunicación clara ayuda a que el viaje salga bien.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'MyBookings' } },
      },
    ],
  },

  driver_my_trips: {
    id: 'driver_my_trips',
    steps: [
      {
        key: 'dt1',
        icon: 'car-outline',
        title: 'Viajes como conductor',
        body: 'Si «» el viaje, la lista de esas publicaciones está en «». Primero entramos a la pestaña Viajes desde la barra inferior.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'Carpoolings' } },
      },
      {
        key: 'dt2',
        icon: 'ribbon-outline',
        title: 'Mis viajes creados',
        body: 'Tocá «». Ahí ves cada trayecto que ofrecés: podés abrir uno para ver detalle, editar si la app lo permite, o revisar quién reservó según el caso.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'MyTrips' } },
      },
      {
        key: 'dt3',
        icon: 'construct-outline',
        title: 'Editar o dar de baja',
        body: 'Desde el detalle de un viaje propio suele haber opciones para «» datos o «» el viaje. Si cancelás, es buena práctica avisar a quien ya había reservado (la app puede notificar automáticamente según la implementación).',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'MyTrips' } },
      },
    ],
  },

  trip_requests: {
    id: 'trip_requests',
    steps: [
      {
        key: 'tr1',
        icon: 'car-outline',
        title: 'Sos conductor en un viaje',
        body: 'Cuando alguien pide lugar en «» viaje, esas solicitudes se gestionan desde la misma zona de «» donde creaste la publicación.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'Carpoolings' } },
      },
      {
        key: 'tr2',
        icon: 'people-outline',
        title: 'Reservas recibidas / solicitudes',
        body: 'Tocá «» (o el nombre similar en tu pantalla). Vas a ver las pedidas de los pasajeros: podés «» o «» según asientos libres y tu criterio.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'TripRequests' } },
      },
      {
        key: 'tr3',
        icon: 'chatbubble-ellipses-outline',
        title: 'Coordinar',
        body: 'Después de aceptar, es común coordinar por «» el punto exacto de encuentro u horario fino. Cuanto más claro, mejor experiencia para todos.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'TripRequests' } },
      },
    ],
  },

  chats: {
    id: 'chats',
    steps: [
      {
        key: 'ch1',
        icon: 'chatbubbles-outline',
        title: 'Pestaña Mensajes',
        body: 'La «» en la barra inferior agrupa tus conversaciones con otros usuarios: conductor o pasajeros según el contexto.',
        nav: { main: { tab: 'ChatsTab', screen: 'Chats' } },
      },
      {
        key: 'ch2',
        icon: 'mail-unread-outline',
        title: 'Lista de conversaciones',
        body: 'Vas a ver cada hilo ordenado (a veces con «» si hay mensajes sin leer). Tocá una conversación para abrirla y responder.',
        nav: { main: { tab: 'ChatsTab', screen: 'Chats' } },
      },
      {
        key: 'ch3',
        icon: 'information-circle-outline',
        title: 'Buenas prácticas',
        body: 'Acordá lugar y hora por chat, respetá el precio publicado y avisá con tiempo si algo cambia. El chat es la herramienta principal para que el carpool funcione sin fricción.',
        nav: { main: { tab: 'ChatsTab', screen: 'Chats' } },
      },
    ],
  },
};

export function getHelpGuide(id) {
  return GUIDES[id] || null;
}
