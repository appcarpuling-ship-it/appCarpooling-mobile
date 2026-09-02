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
    id: 'trip_request_flow',
    listIcon: 'megaphone-outline',
    listTitle: 'Solicitudes de viaje',
    listSubtitle: 'Pedí un viaje y que los conductores se postulen (o postulate vos)',
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
        title: 'Empezamos en Traslados',
        body: 'Los viajes que vos ofrecés como conductor se gestionan desde la pestaña «Traslados» (el ícono del auto en la barra inferior). Ahí vas a ver dos grupos: uno como conductor y otro como pasajero.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'Carpoolings' } },
      },
      {
        key: 'ct2',
        icon: 'list-outline',
        title: 'El grupo «Conductor»',
        body: 'Tocá «Crear Viaje»: es la puerta de entrada para publicar un nuevo trayecto. Al lado tenés «Mis Viajes», donde vas a ver este viaje una vez publicado.\n\nEn el siguiente paso abrimos el formulario real.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'Carpoolings' } },
      },
      {
        key: 'ct3',
        icon: 'map-outline',
        title: 'Formulario con mapa',
        body: 'Al tocar «Crear Viaje» se abre la pantalla de publicación. Ahí definís:\n\n• Origen y destino (buscás la dirección o elegís el punto en el mapa)\n• Fecha y hora de salida\n• Asientos disponibles y precio por asiento (o «Gastos compartidos», sin precio fijo)\n• Vehículo con el que vas a manejar\n\nTomate el tiempo de revisar que la ruta y el horario sean los que querés ofrecer.',
        nav: { root: 'CreateTrip' },
      },
      {
        key: 'ct4',
        icon: 'document-text-outline',
        title: 'Antes de publicar',
        body: 'Para publicar necesitás, en tu perfil, el DNI (frente y dorso) y la licencia de conducir vigente, y en el vehículo, la tarjeta verde o cédula cargada. Sin alguno de esos tres, el botón de publicar te va a avisar qué falta.\n\nSi todavía no cargaste el auto, salí con la flecha de volver, andá a «Perfil → Mis Vehículos» y volvé después (hay una guía aparte para eso).',
        nav: { root: 'CreateTrip' },
      },
      {
        key: 'ct5',
        icon: 'checkmark-done-outline',
        title: 'Después de publicar',
        body: 'Tu viaje queda visible para otros usuarios, que van a poder pedirte lugar. Seguí el estado desde «Mis Viajes», y las reservas que te pidan desde «Reservas Recibidas», en el mismo grupo «Conductor» de Traslados.\n\n¡Listo! Ya sabés el camino completo para crear un viaje.',
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
        body: 'Los datos del vehículo están en «Perfil»: último ícono de la barra inferior. Ahí, entre las opciones de tu cuenta, está «Mis Vehículos».',
        nav: { main: { tab: 'ProfileTab', screen: 'Profile' } },
      },
      {
        key: 'av2',
        icon: 'car-outline',
        title: 'Mis vehículos',
        body: 'Tocá «Mis Vehículos». Vas a ver la lista de autos que ya cargaste (si todavía no tenés ninguno, la lista está vacía, es normal).\n\nPara sumar uno nuevo, tocá el botón «Agregar vehículo».',
        nav: { main: { tab: 'ProfileTab', screen: 'Vehicles' } },
      },
      {
        key: 'av3',
        icon: 'create-outline',
        title: 'Formulario del vehículo',
        body: 'En el formulario completá:\n\n• Marca, modelo, año y color\n• Patente (formato Mercosur o el anterior, cualquiera de los dos)\n• Pasajeros que entran, además de vos\n• Tarjeta verde o cédula, seguro y VTV o RTO, con sus vencimientos\n\nLos datos correctos ayudan a que los pasajeros confíen y a que puedas publicar viajes sin trabas.',
        nav: { main: { tab: 'ProfileTab', screen: 'VehicleForm', params: {} } },
      },
      {
        key: 'av4',
        icon: 'shield-checkmark-outline',
        title: 'Guardar y listo',
        body: 'Guardá con el botón de abajo. Si falta algún dato, la pantalla te marca cuál.\n\nMás adelante podés editar un vehículo desde la misma lista, tocando el que quieras modificar.',
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
        body: 'Para buscar un viaje como pasajero, arrancá en «Inicio» (primer ícono abajo). Ahí tenés el buscador de origen y destino, y debajo, los próximos viajes cerca tuyo.',
        nav: { main: { tab: 'HomeTab', screen: 'Home' } },
      },
      {
        key: 'bk2',
        icon: 'search-outline',
        title: 'Buscar viajes',
        body: 'Tocá los campos «Origen» y «Destino» para elegir provincia y ciudad, y después «Buscar viajes».\n\nSi los dejás vacíos, «Buscar viajes» te lleva directo al listado completo.',
        nav: { main: { tab: 'HomeTab', screen: 'Home' } },
      },
      {
        key: 'bk3',
        icon: 'list-circle-outline',
        title: 'Resultados y detalle',
        body: 'En la lista de resultados, tocá el viaje que te interese. Se abre el detalle: conductor, horario, precio por asiento, paradas y reglas del viaje.\n\nLeé bien antes de reservar: horario de salida, políticas y cuántos asientos quedan.',
        nav: { main: { tab: 'HomeTab', screen: 'Home' } },
      },
      {
        key: 'bk4',
        icon: 'calendar-outline',
        title: 'Otra forma: ver todos los viajes',
        body: 'Si tocás «Buscar viajes» sin cargar origen ni destino, o la flecha de «Ver todos» junto a «Próximos viajes», entrás a la lista completa. Ahí también podés abrir el detalle del que prefieras.',
        nav: { main: { tab: 'HomeTab', screen: 'AllTrips' } },
      },
      {
        key: 'bk5',
        icon: 'hand-left-outline',
        title: 'Reservar',
        body: 'Dentro del detalle del viaje, tocá «Reservar». Elegí cuántos asientos necesitás y confirmá.\n\nHasta que no confirmes desde esa pantalla, el lugar no queda asegurado, y el conductor todavía puede aceptar o rechazar tu pedido.',
        nav: { main: { tab: 'HomeTab', screen: 'Home' } },
      },
      {
        key: 'bk6',
        icon: 'reader-outline',
        title: 'Después de reservar',
        body: 'Revisá lo que reservaste en «Traslados → Mis Reservas», dentro del grupo «Pasajero». Ahí ves el estado de cada viaje, y desde el detalle podés coordinar por chat con el conductor si hace falta.\n\nSi tenés dudas, también podés volver a esta sección de Ayuda cuando quieras.',
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
        title: 'Pestaña Traslados',
        body: 'Tus reservas como pasajero se agrupan en «Traslados» (el auto abajo), dentro del grupo «Pasajero». No hace falta estar en Inicio: todo lo de "me subí a un viaje de otro" está acá.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'Carpoolings' } },
      },
      {
        key: 'mb2',
        icon: 'briefcase-outline',
        title: 'Mis reservas',
        body: 'Tocá «Mis Reservas». Vas a ver la lista de viajes a los que te anotaste: fecha, conductor y estado (pendiente, confirmada, cancelada).\n\nDesde cada ítem entrás al detalle del viaje.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'MyBookings' } },
      },
      {
        key: 'mb3',
        icon: 'notifications-outline',
        title: 'Cambios y avisos',
        body: 'Si el conductor cancela el viaje o algo cambia, te llega una notificación. Desde el detalle de la reserva también podés abrir el chat con el conductor para coordinar hora o punto de encuentro.\n\nMantener la comunicación clara ayuda a que el viaje salga bien.',
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
        body: 'Los viajes que publicaste están en «Traslados» (el auto abajo), dentro del grupo «Conductor».',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'Carpoolings' } },
      },
      {
        key: 'dt2',
        icon: 'ribbon-outline',
        title: 'Mis viajes creados',
        body: 'Tocá «Mis Viajes». Ahí ves cada trayecto que ofrecés: abrí uno para ver el detalle, quién reservó, o cancelarlo si hace falta.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'MyTrips' } },
      },
      {
        key: 'dt3',
        icon: 'construct-outline',
        title: 'Cancelar un viaje',
        body: 'Desde el detalle de un viaje propio podés cancelarlo. Si ya tenía pasajeros con reserva, se les avisa automáticamente. Cancelar de forma reiterada o sin aviso puede llevar a la suspensión de la cuenta.',
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
        body: 'Cuando alguien te pide lugar en un viaje que publicaste, esa solicitud se gestiona desde «Traslados», dentro del grupo «Conductor».',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'Carpoolings' } },
      },
      {
        key: 'tr2',
        icon: 'people-outline',
        title: 'Reservas recibidas',
        body: 'Tocá «Reservas Recibidas». Vas a ver los pedidos de los pasajeros: podés aceptarlos o rechazarlos según los asientos libres que tengas.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'TripRequests' } },
      },
      {
        key: 'tr3',
        icon: 'chatbubble-ellipses-outline',
        title: 'Coordinar',
        body: 'Después de aceptar una reserva, coordiná por chat el punto exacto de encuentro o el horario fino, desde el detalle de esa reserva. Cuanto más claro, mejor experiencia para todos.',
        nav: { main: { tab: 'CarpoolingsTab', screen: 'TripRequests' } },
      },
    ],
  },

  trip_request_flow: {
    id: 'trip_request_flow',
    steps: [
      {
        key: 'trf1',
        icon: 'megaphone-outline',
        title: '¿Qué es una solicitud de viaje?',
        body: 'Además de buscar viajes ya publicados, podés pedir uno. Como pasajero publicás a dónde querés ir y los conductores se postulan para llevarte. Todo esto vive en la pestaña «Solicitudes» del inicio.',
        nav: { main: { tab: 'HomeTab', screen: 'Home' } },
      },
      {
        key: 'trf2',
        icon: 'add-circle-outline',
        title: 'Publicar una solicitud',
        body: 'Tocá «Publicar solicitud». Indicá origen, destino, fecha, hora y cuántos asientos necesitás. El precio se calcula automáticamente según la distancia. Tu solicitud queda abierta 48 horas para que los conductores la vean.',
        nav: { main: { tab: 'HomeTab', screen: 'CreateTripRequest', params: { mode: 'request' } } },
      },
      {
        key: 'trf3',
        icon: 'list-outline',
        title: 'Elegí conductor en «Mis solicitudes»',
        body: 'En «Mis solicitudes» ves los conductores que se postularon (hasta 5), con su vehículo y calificación. Cuando elegís uno, el resto queda rechazado y se genera el pago. Al pagar, el viaje se crea y aparece en «Mis reservas».',
        nav: { main: { tab: 'HomeTab', screen: 'MyTripRequests' } },
      },
      {
        key: 'trf4',
        icon: 'search-outline',
        title: 'Como conductor: solicitudes abiertas',
        body: 'Si manejás, entrá a «Ver solicitudes abiertas» para explorar los pedidos de los pasajeros. Abrí uno y tocá «Ofrecer viaje» para postularte con tu vehículo (necesitás tener uno cargado). Hay un máximo de 5 postulaciones por solicitud.',
        nav: { main: { tab: 'HomeTab', screen: 'OpenTripRequests' } },
      },
      {
        key: 'trf5',
        icon: 'car-outline',
        title: 'Seguí tus postulaciones',
        body: 'En «Mis postulaciones» ves las solicitudes donde te postulaste y su estado: pendiente, aceptada o rechazada. Si el pasajero te elige y completa el pago, el viaje se crea automáticamente y aparece en tu agenda.',
        nav: { main: { tab: 'HomeTab', screen: 'MyApplications' } },
      },
    ],
  },

  // Ya no hay una pestaña de Mensajes: el chat se abre desde el detalle de un
  // viaje o desde el perfil de otro usuario, según el contexto. Sin un lugar fijo
  // no hay un tab al que mandar al usuario, así que estos pasos no navegan.
  chats: {
    id: 'chats',
    steps: [
      {
        key: 'ch1',
        icon: 'chatbubbles-outline',
        title: 'Dónde está el chat',
        body: 'No hay una pestaña propia para los mensajes: se abre desde el detalle de un viaje (botón para hablar con el conductor o el pasajero) o desde el perfil de esa persona.',
      },
      {
        key: 'ch2',
        icon: 'mail-unread-outline',
        title: 'Una conversación por viaje',
        body: 'Cada conversación queda asociada al viaje en el que se originó. Para retomarla, volvé a entrar al detalle de ese viaje.',
      },
      {
        key: 'ch3',
        icon: 'information-circle-outline',
        title: 'Buenas prácticas',
        body: 'Acordá lugar y hora por chat, respetá el precio publicado y avisá con tiempo si algo cambia. El chat es la herramienta principal para que el carpool funcione sin fricción.',
      },
    ],
  },
};

export function getHelpGuide(id) {
  return GUIDES[id] || null;
}
