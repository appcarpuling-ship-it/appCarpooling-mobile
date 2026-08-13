import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useUI } from '../../../theme/ui';

/**
 * Términos y condiciones.
 *
 * Escritos contra lo que la app hace DE VERDAD, no contra una plantilla. Cada afirmación de
 * acá tiene que poder sostenerse mirando el código: si dice que se puede hacer algo, se puede;
 * si dice que no verificamos algo, no lo verificamos. Un término que promete de más es peor
 * que no tenerlo, porque queda por escrito.
 *
 * Si cambia una regla del producto (el tope del extra, la purga de viajes, quién ve los viajes
 * solo mujeres), este archivo cambia con ella. Y también web/src/pages/legal/Terms.jsx, que
 * dice lo mismo para la web.
 */
const ULTIMA_ACTUALIZACION = '12 de agosto de 2026';

const TermsScreen = () => {
  const ui = useUI();
  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;
  const divider     = ui.bg;

  const sections = [
    {
      title: '1. Qué es Carpuling',
      text: 'Carpuling es una plataforma que pone en contacto a personas que van a hacer un mismo viaje para que lo compartan y dividan sus gastos.\n\nNo somos una empresa de transporte y no prestamos el servicio de traslado. No empleamos a los conductores ni tenemos vehículos. El viaje es un acuerdo entre particulares: nosotros ponemos la herramienta para que se encuentren.',
    },
    {
      title: '2. Quién puede usarla',
      text: 'Tenés que ser mayor de 18 años y usar datos reales. Una persona, una cuenta.\n\nPara publicar viajes como conductor necesitás además cargar tu licencia de conducir y la documentación del vehículo.',
    },
    {
      title: '3. El dinero: se comparten gastos, no se cobra por llevar',
      text: 'Al terminar el viaje el conductor carga lo que se gastó (combustible, peajes y demás) y ese total se divide entre TODOS los que viajaron, el conductor incluido. El conductor paga su parte como cualquiera.\n\nEsto no es una tarifa ni una ganancia. Si existiera un monto adicional para el conductor, tiene un tope máximo sobre los gastos que define la plataforma y que se valida al completar el viaje.\n\nEl precio que ves antes de viajar es una estimación calculada sobre la distancia. El monto final sale de los gastos reales que se carguen al terminar.',
    },
    {
      title: '4. Reservas y pagos',
      text: 'Al reservar un asiento se toma un pago a través de una pasarela de pagos externa. Nosotros no almacenamos los datos de tu tarjeta: los procesa la pasarela.\n\nEl conductor puede aceptar o rechazar cada solicitud. Si la rechaza, o si el viaje se cancela, la devolución se rige por las condiciones de la pasarela y por la política que se te informa al reservar.',
    },
    {
      title: '5. Cancelaciones',
      text: 'Cancelá lo antes posible si no vas a viajar: del otro lado hay alguien organizándose con ese asiento.\n\nEl conductor puede cancelar un viaje; en ese caso se notifica a los pasajeros con reserva. Cancelar de forma reiterada o sin aviso puede llevar a la suspensión de la cuenta.',
    },
    {
      title: '6. Obligaciones del conductor',
      text: '• Tener licencia de conducir vigente\n• Tener el seguro del vehículo al día\n• Tener la VTV o RTO vigente\n• Mantener el vehículo en condiciones seguras\n• Respetar las leyes de tránsito y no conducir bajo efectos de alcohol o drogas\n• No llevar más pasajeros que los asientos ofrecidos\n\nAl cargar un vehículo declarás bajo tu responsabilidad que esa documentación es de ese vehículo y está vigente. Carpuling no verifica pólizas, habilitaciones ni licencias ante ningún organismo: solo guarda lo que vos cargás.\n\nCuando una fecha de vencimiento se cumple, la app te bloquea la publicación de viajes nuevos hasta que la actualices.',
    },
    {
      title: '7. Obligaciones del pasajero',
      text: '• Estar a horario en el punto de encuentro acordado\n• Respetar al conductor, a los demás pasajeros y al vehículo\n• No llevar objetos peligrosos ni prohibidos\n• Avisar con tiempo si no vas a viajar',
    },
    {
      title: '8. Viajes solo para mujeres',
      text: 'Una conductora puede marcar su viaje como "solo mujeres". Esos viajes se muestran únicamente a usuarias registradas con sexo femenino en su perfil, y solo ellas pueden reservarlos.\n\nEs una opción de la conductora, no una obligación, y existe para que quien la necesite pueda viajar más tranquila.',
    },
    {
      title: '9. Calificaciones',
      text: 'Al terminar un viaje se te pide calificar. Es obligatorio: la calificación aparece la próxima vez que abrís la app hasta que la completes.\n\nLas calificaciones son de la persona, no del viaje: siguen existiendo aunque el viaje se borre. Buscamos que las estrellas que ves reflejen todos los viajes y no solo aquellos que alguien se acordó de puntuar.',
    },
    {
      title: '10. Conducta, reportes y suspensión',
      text: 'Podés bloquear y reportar a cualquier usuario desde su perfil.\n\nPodemos suspender o dar de baja una cuenta que incumpla estos términos, cargue documentación o datos falsos, maltrate a otros usuarios o use la plataforma para algo distinto de compartir un viaje.',
    },
    {
      title: '11. Hasta dónde llega nuestra responsabilidad',
      text: 'Carpuling no participa del viaje. No respondemos por:\n• Lo que pase durante el traslado, incluidos accidentes, demoras o daños\n• La conducta de conductores o pasajeros\n• La veracidad de la documentación que carga cada usuario\n• Los acuerdos que las partes hagan por fuera de la app\n\nCada conductor es responsable de su vehículo, su documentación, su manejo y su seguro. Te recomendamos verificar por tu cuenta con quién viajás.',
    },
    {
      title: '12. Tus datos',
      text: 'Cómo tratamos tu información está en la Política de Privacidad, dentro de esta misma sección. Ahí también está qué guardamos, por cuánto tiempo y cómo pedir que lo borremos.',
    },
    {
      title: '13. Cambios en estos términos',
      text: 'Podemos actualizarlos. Si el cambio es relevante, te avisamos dentro de la app. Seguir usando Carpuling después de un cambio implica aceptarlo.',
    },
    {
      title: '14. Ley aplicable',
      text: 'Estos términos se rigen por las leyes de la República Argentina. Ante cualquier controversia se someterán a los tribunales ordinarios competentes.',
    },
    {
      title: '15. Contacto',
      text: 'Escribinos desde la sección de Ayuda de la aplicación.',
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <Text style={[styles.date, { color: textMuted }]}>
            Última actualización: {ULTIMA_ACTUALIZACION}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: ui.border }]}>
          {sections.map((s, index) => (
            <View
              key={index}
              style={[
                styles.section,
                index < sections.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>{s.title}</Text>
              <Text style={[styles.sectionText, { color: textMuted }]}>{s.text}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40 },

  header: {
    marginBottom: 12,
    marginLeft: 4,
  },
  date: {
    fontSize: 13,
  },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Sora_600SemiBold',
  },
  sectionText: {
    fontSize: 13,
    lineHeight: 20,
  },
});

export default TermsScreen;
