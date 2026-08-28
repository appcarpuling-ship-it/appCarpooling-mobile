import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';

const ROJO = '#EF4444';

/**
 * El campo de las pantallas de acceso: sin caja, sólo la línea de abajo.
 *
 * La línea es lo único que marca el campo, así que es la que carga los estados: gris en
 * reposo, del color del texto al enfocar (para que se vea dónde estás escribiendo, que es lo
 * que un campo sin caja pierde) y roja con el error. El mensaje de error reemplaza al de
 * ayuda en vez de sumarse: apilar los dos movía todo el formulario hacia abajo justo cuando
 * la persona está corrigiendo.
 */
const LineInput = ({
  label,
  icon,
  // `leftIcon` es como lo nombra FormInput: se acepta el alias para poder cambiar un
  // formulario entero sin tocar cada campo.
  leftIcon,
  error,
  helper,
  required,
  secureTextEntry,
  showPasswordToggle,
  style,
  ...props
}) => {
  const ui = useUI();
  const [enfocado, setEnfocado] = useState(false);
  const [oculto, setOculto] = useState(Boolean(secureTextEntry));

  const nombreIcono = icon || leftIcon;
  const colorLinea = error ? ROJO : enfocado ? ui.text : ui.border;
  const nota = error || helper;

  return (
    <View style={style}>
      {!!label && (
        <Text style={[styles.label, { color: error ? ROJO : ui.textMuted }]}>
          {label}{required ? ' *' : ''}
        </Text>
      )}

      <View style={[styles.linea, { borderBottomColor: colorLinea }, props.multiline && styles.lineaMultilinea]}>
        {!!nombreIcono && (
          <Ionicons name={nombreIcono} size={20} color={error ? ROJO : ui.textMuted} />
        )}
        {/* `props` va primero: lo que sigue tiene que ganarle, porque el color de la línea
            depende de saber cuándo hay foco. Con el spread al final, un onFocus/onBlur de
            quien usa el componente pisaba estos y la línea nunca se marcaba. */}
        <TextInput
          {...props}
          style={[styles.input, { color: ui.text }, props.style]}
          placeholderTextColor={props.placeholderTextColor ?? ui.textMuted}
          secureTextEntry={oculto}
          onFocus={(e) => { setEnfocado(true); props.onFocus?.(e); }}
          onBlur={(e) => { setEnfocado(false); props.onBlur?.(e); }}
        />
        {showPasswordToggle && secureTextEntry && (
          <TouchableOpacity
            onPress={() => setOculto((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={oculto ? 'Mostrar contraseña' : 'Ocultar contraseña'}
          >
            <Ionicons name={oculto ? 'eye-outline' : 'eye-off-outline'} size={20} color={ui.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {!!nota && (
        <Text style={[styles.nota, { color: error ? ROJO : ui.textMuted }]}>{nota}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 12.5,
    fontFamily: 'Sora_600SemiBold',
    letterSpacing: 0.1,
    marginBottom: 6,
  },
  linea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 50,
    paddingHorizontal: 2,
    borderBottomWidth: 1.5,
  },
  // Con varias líneas el ícono se centraba verticalmente respecto de todo el bloque y
  // quedaba flotando en el medio del texto.
  lineaMultilinea: { alignItems: 'flex-start', paddingTop: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Sora_400Regular',
    // Android le mete padding propio al TextInput y descentraba el texto respecto del ícono.
    paddingVertical: 0,
  },
  nota: {
    fontSize: 12,
    fontFamily: 'Sora_400Regular',
    lineHeight: 16,
    marginTop: 6,
  },
});

export default LineInput;
