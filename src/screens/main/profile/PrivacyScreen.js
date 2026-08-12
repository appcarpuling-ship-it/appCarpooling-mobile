import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useUI } from '../../../theme/ui';

/**
 * Política de privacidad.
 *
 * Enumera lo que la app realmente recolecta y con quién realmente lo comparte. Los proveedores
 * están nombrados a propósito: el cuestionario de privacidad de App Store pregunta exactamente
 * eso, y una política que no coincide con lo declarado ahí es motivo de rechazo.
 *
 * Los plazos de retención salen de los TTL que existen en la base, no de una estimación.
 */
const ULTIMA_ACTUALIZACION = '12 de agosto de 2026';

const PrivacyScreen = () => {
  const ui = useUI();
  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;
  const divider     = ui.bg;

  const sections = [
    {
      title: '1. Quién trata tus datos',
      text: 'Carpuling trata los datos que cargás en la aplicación para que puedas publicar viajes, reservar asientos y contactarte con otros usuarios.\n\nEsta política explica qué guardamos, para qué, con quién lo compartimos y cómo pedir que lo borremos.',
    },
    {
      title: '2. Qué datos recolectamos',
      text: 'De tu cuenta:\n• Nombre y apellido, correo, teléfono, edad y sexo\n• Ciudad y provincia\n• Foto de perfil y descripción, si las cargás\n\nDocumentación (solo si la subís):\n• DNI, frente y dorso\n• Licencia de conducir y su vencimiento\n• Cédula del vehículo, seguro y VTV, con sus vencimientos\n\nDe tus viajes:\n• Origen, destino y paradas, con sus coordenadas\n• Fecha, hora, asientos y gastos cargados\n• Reservas, pagos y calificaciones\n\nDe uso:\n• Mensajes del chat\n• Ubicación en tiempo real, únicamente mientras un viaje está en curso\n• Identificador para enviarte notificaciones\n• Informes de errores cuando algo falla',
    },
    {
      title: '3. La ubicación',
      text: 'Usamos tu ubicación de dos formas y ninguna corre en segundo plano.\n\nAl elegir un punto en el mapa, para centrarlo donde estás.\n\nDurante un viaje en curso, la posición del conductor se comparte con los pasajeros de ESE viaje para que puedan seguirlo. Se deja de compartir cuando el viaje termina.\n\nPodés negar el permiso: la app funciona igual, con la comodidad justa menos.',
    },
    {
      title: '4. Para qué usamos tus datos',
      text: '• Mostrar tu perfil y tus viajes a los demás usuarios\n• Conectar conductores con pasajeros y calcular recorridos\n• Procesar las reservas y sus pagos\n• Avisarte de reservas, mensajes y viajes que puedan interesarte\n• Sostener el sistema de calificaciones\n• Prevenir fraudes y hacer cumplir los Términos\n• Cumplir obligaciones legales',
    },
    {
      title: '5. Qué ven los demás usuarios',
      text: 'Tu nombre, foto, calificación y los datos del viaje los ven quienes participan de ese viaje o lo están mirando para reservar.\n\nNo se muestran nunca: tu correo, tu teléfono, tu DNI ni la documentación del vehículo. El chat existe justamente para que puedas coordinar sin dar tu teléfono.',
    },
    {
      title: '6. Con qué proveedores compartimos datos',
      text: 'No vendemos tus datos. Los compartimos solo con los servicios que hacen funcionar la app:\n\n• Google Maps: direcciones y recorridos\n• Cloudinary: almacenamiento de las imágenes que subís\n• Brevo: envío de correos, como el código de verificación\n• Expo: envío de notificaciones al teléfono\n• Pasarela de pagos: cobro de las reservas. Los datos de tu tarjeta los procesa ella, nosotros no los recibimos ni los guardamos\n• Sentry: informes de errores, para detectar fallas\n\nTambién podemos compartirlos si nos lo exige una autoridad competente.',
    },
    {
      title: '7. Cuánto tiempo los guardamos',
      text: '• Tu cuenta y su documentación: mientras la cuenta exista\n• Viajes ya terminados: se eliminan automáticamente a las dos semanas\n• Notificaciones: 30 días\n• Mensajes del chat: se eliminan pasado un plazo desde el final del viaje\n• Calificaciones: se conservan aunque el viaje se elimine, porque son la reputación de la persona y no un dato del viaje\n\nAlgunos registros de pagos se conservan más tiempo por obligaciones contables.',
    },
    {
      title: '8. Tus derechos',
      text: 'Podés acceder a tus datos, corregirlos, actualizarlos y pedir que los borremos, además de oponerte a su tratamiento.\n\nLa mayoría los ejercés desde la app: editás tu perfil, cambiás tu documentación o eliminás tu cuenta. Para el resto, escribinos desde la sección de Ayuda.\n\nComo titular de los datos, tenés derecho a presentar un reclamo ante la Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326 de Protección de Datos Personales.',
    },
    {
      title: '9. Seguridad',
      text: 'Las contraseñas se guardan cifradas y nunca en texto plano. La comunicación con nuestros servidores viaja cifrada.\n\nNingún sistema es infalible: cuidá tu contraseña y no la compartas.',
    },
    {
      title: '10. Menores de edad',
      text: 'Carpuling es para mayores de 18 años. No recolectamos datos de menores a sabiendas. Si detectamos una cuenta de un menor, la damos de baja.',
    },
    {
      title: '11. Cambios',
      text: 'Si actualizamos esta política te avisamos dentro de la app. La fecha de arriba indica la última versión.',
    },
    {
      title: '12. Contacto',
      text: 'Por cualquier consulta sobre tus datos, escribinos desde la sección de Ayuda de la aplicación.',
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

        <View style={[styles.card, { backgroundColor: cardBg }]}>
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

export default PrivacyScreen;
