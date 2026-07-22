import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useUI } from '../../../theme/ui';

const CookiesScreen = () => {
  const ui = useUI();
  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;
  const divider     = ui.bg; // separa las secciones dentro de la card gris

  const sections = [
    {
      title: '¿Qué son las cookies?',
      text: 'Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando usás nuestra aplicación. En apps móviles usamos mecanismos equivalentes como almacenamiento local y tokens de sesión.',
    },
    {
      title: 'Cookies esenciales',
      text: 'Son necesarias para el funcionamiento básico de la app:\n• Token de autenticación (sesión)\n• Preferencias de tema (claro/oscuro)\n• Configuración de notificaciones\n\nNo podés desactivarlas ya que la app no funciona sin ellas.',
    },
    {
      title: 'Almacenamiento de sesión',
      text: 'Guardamos tu sesión de forma segura para que no tengas que iniciar sesión cada vez que abrís la app. Este token caduca automáticamente y se elimina al cerrar sesión.',
    },
    {
      title: 'Preferencias del usuario',
      text: 'Guardamos tus preferencias localmente (como el modo oscuro o claro) para brindarte una mejor experiencia. Estos datos no se envían a nuestros servidores.',
    },
    {
      title: 'Analítica y mejora',
      text: 'Podemos usar herramientas de analítica para entender cómo se usa la app y mejorarla. Esta información es anónima y no incluye datos personales identificables.',
    },
    {
      title: 'Control de datos',
      text: 'Podés eliminar todos los datos almacenados localmente cerrando sesión o desinstalando la aplicación. Para más información, consultá nuestra Política de Privacidad.',
    },
    {
      title: 'Contacto',
      text: 'Si tenés preguntas sobre el uso de cookies o almacenamiento, contactanos a través de la sección de Ayuda.',
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
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
  card: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  section: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
  },
  sectionText: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
});

export default CookiesScreen;
