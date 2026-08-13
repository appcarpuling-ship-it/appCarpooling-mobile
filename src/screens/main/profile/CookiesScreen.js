import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useUI } from '../../../theme/ui';

/**
 * Almacenamiento local ("cookies").
 *
 * En una app nativa no hay cookies: hay almacenamiento del dispositivo. El texto lo dice en
 * lugar de fingir lo contrario, y enumera lo que la app guarda de verdad en el teléfono. La
 * versión anterior hablaba en condicional ("podemos usar analítica") sobre cosas que sí o sí
 * pasan, que es la clase de vaguedad que no sirve ni para el usuario ni para una revisión.
 */
const ULTIMA_ACTUALIZACION = '12 de agosto de 2026';

const CookiesScreen = () => {
  const ui = useUI();
  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;
  const divider     = ui.bg;

  const sections = [
    {
      title: 'En una app no hay cookies',
      text: 'Las cookies son de los navegadores. Carpuling es una app nativa y no usa ninguna: lo que hace es guardar algunos datos en el almacenamiento de tu teléfono.\n\nAcá está todo lo que guarda y para qué. Si entrás desde la web, ahí sí aplican cookies y está explicado en la versión web de este documento.',
    },
    {
      title: 'Tu sesión',
      text: 'Cuando iniciás sesión se guarda un token en tu dispositivo para que no tengas que escribir la contraseña cada vez que abrís la app.\n\nEse token vence solo y se borra del teléfono cuando cerrás sesión. Sin esto la app no puede funcionar.',
    },
    {
      title: 'Tus preferencias',
      text: 'El tema claro u oscuro y algunas preferencias de pantalla quedan guardadas en tu teléfono. No se envían a nuestros servidores: son solo para que la app se vea como la dejaste.',
    },
    {
      title: 'Notificaciones',
      text: 'Si aceptás recibir notificaciones, el sistema operativo genera un identificador del dispositivo y lo guardamos asociado a tu cuenta. Es lo que permite avisarte de una reserva o un mensaje.\n\nNo identifica a tu persona ni sirve para rastrearte fuera de la app. Si desactivás las notificaciones desde los ajustes del teléfono, deja de usarse.',
    },
    {
      title: 'Datos en el teléfono para andar más rápido',
      text: 'La app guarda temporalmente cosas como tu último resultado de búsqueda o las imágenes ya descargadas, para no volver a pedirlas y consumirte datos de más. Se borran al desinstalar la app.',
    },
    {
      title: 'Errores',
      text: 'Cuando algo falla se envía un informe técnico del error (qué pantalla, qué versión, qué pasó) a Sentry, el servicio que usamos para detectarlos.\n\nSirve para arreglar fallas, no para analizar tu comportamiento. No usamos publicidad ni seguimiento entre aplicaciones.',
    },
    {
      title: 'Cómo lo borrás',
      text: 'Cerrando sesión se elimina el token y los datos de tu cuenta en el teléfono. Desinstalando la app se borra todo lo que haya quedado guardado localmente.\n\nPara borrar los datos que están en nuestros servidores, mirá la Política de Privacidad.',
    },
    {
      title: 'Contacto',
      text: 'Cualquier duda, escribinos desde la sección de Ayuda de la aplicación.',
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

export default CookiesScreen;
