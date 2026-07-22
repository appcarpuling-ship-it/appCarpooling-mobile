import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchPlaces as searchPlacesApi, getPlaceDetails } from '../services/mapsService';

const SafePlacesAutocomplete = ({
  placeholder,
  onPress,
  inputRef,
  styles: customStyles = {},
  inputType, // 'origin' | 'destination'
  onFocusChange, // Callback cuando el input recibe/pierde el foco
  onResultsChange, // Callback cuando cambian los resultados
  externalResults, // Resultados externos (si se manejan desde el padre)
  externalLoading, // Loading externo
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef(null);
  const textInputRef = useRef(null);
  
  // Usar resultados externos si están disponibles (array), sino usar los internos
  const displayResults = Array.isArray(externalResults) ? externalResults : results;
  const displayLoading = typeof externalLoading === 'boolean' ? externalLoading : loading;
  const displayShowResults = Array.isArray(externalResults)
    ? (externalResults.length > 0 && showResults)
    : (results.length > 0 && showResults);

  const searchPlaces = async (text) => {
    if (!text || text.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 Buscando lugares:', text);

      const data = await searchPlacesApi(text);

      // Sin esto, "Jujuy" sugiere primero la PROVINCIA (administrative_area_level_1) y al
      // elegirla el punto queda en un centroide sin ruta calculable (Directions da
      // ZERO_RESULTS) — pasó dos veces con el mismo origen/destino. Se filtran provincia/país,
      // se deja ciudad/localidad/dirección puntual.
      const predictions = (data?.predictions || []).filter(
        (p) => !p.types?.includes('administrative_area_level_1') && !p.types?.includes('country')
      );

      // ✅ VALIDACIÓN SEGURA
      if (predictions.length > 0) {
        console.log('✅ Se encontraron', predictions.length, 'resultados');
        setResults(predictions);
        setShowResults(true);
        // Notificar al padre si hay callback y este input está activo
        if (onResultsChange) {
          onResultsChange(predictions);
        }
      } else {
        console.log('⚠️ No se encontraron resultados');
        setResults([]);
        setShowResults(false);
        // Notificar al padre que no hay resultados
        if (onResultsChange) {
          onResultsChange([]);
        }
      }
    } catch (error) {
      console.error('❌ Error searching places:', error);
      setResults([]);
      setShowResults(false);
      // Notificar al padre que no hay resultados
      if (onResultsChange) {
        onResultsChange([]);
      }
    } finally {
      setLoading(false);
      // Notificar el estado de loading al padre
      if (onResultsChange && externalLoading === undefined) {
        // El loading se maneja internamente
      }
    }
  };

  const handleChangeText = (text) => {
    setQuery(text);
    
    // Debounce
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (!text || text.length < 2) {
      setResults([]);
      setShowResults(false);
      // Notificar al padre que no hay resultados
      if (onResultsChange) {
        onResultsChange([]);
      }
      return;
    }
    
    timeoutRef.current = setTimeout(() => {
      searchPlaces(text);
    }, 1500);
  };

  const handleSelectPlace = async (place) => {
    console.log('📍 Lugar seleccionado:', place.description);
    setQuery(place.description);
    setShowResults(false);
    
    // Obtener detalles del lugar
    try {
      console.log('🔍 Obteniendo detalles del lugar...');

      const data = await getPlaceDetails(place.place_id);

      console.log('📦 Detalles del lugar:', data);
      
      if (data && data.result) {
        onPress({ description: place.description }, data.result);
      } else {
        console.error('⚠️ No se obtuvieron detalles del lugar');
      }
    } catch (error) {
      console.error('❌ Error fetching place details:', error);
    }
  };

  const setAddressText = (text) => {
    setQuery(text);
    setShowResults(false);
  };

  // Exponer métodos para el ref
  useEffect(() => {
    if (inputRef) {
      inputRef.current = {
        setAddressText,
        focus: () => textInputRef.current?.focus(),
      };
    }
  }, [inputRef]);

  const handleBlur = () => {
    // Ocultar resultados cuando el input pierde el foco
    setShowResults(false);
    // Notificar al padre que este input perdió el foco
    if (onFocusChange) {
      onFocusChange(null);
    }
  };

  const handleFocus = () => {
    // Notificar al padre que este input recibió el foco
    if (onFocusChange && inputType) {
      onFocusChange(inputType);
    }
    // Si hay query y resultados, mostrar resultados cuando el input recibe el foco
    if (query && query.length >= 2 && results.length > 0) {
      setShowResults(true);
      if (onResultsChange) {
        onResultsChange(results);
      }
    }
  };

  return (
    <View style={[styles.container, customStyles.container]}>
      <TextInput
        ref={textInputRef}
        value={query}
        onChangeText={handleChangeText}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        placeholderTextColor="#999"
        style={[styles.input, customStyles.textInput]}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        blurOnSubmit={false}
        onSubmitEditing={() => {}}
      />
      
      {displayLoading && (
        <ActivityIndicator 
          size="small" 
          color="#007AFF" 
          style={{ position: 'absolute', right: 10, top: 12 }} 
        />
      )}
      
      {/* No renderizar resultados aquí si se manejan externamente */}
      {externalResults === undefined && displayShowResults && (
        <View style={[styles.resultsContainer, customStyles.listView]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
          >
            {displayResults.map((item, index) => (
              <TouchableOpacity
                key={item.place_id}
                style={[styles.resultItem, customStyles.row]}
                onPress={() => handleSelectPlace(item)}
                activeOpacity={0.6}
              >
                <View style={styles.resultIconContainer}>
                  <Ionicons name="location-sharp" size={18} color="#666" />
                </View>
                <View style={styles.resultTextContainer}>
                  <Text style={[styles.resultText, customStyles.description]} numberOfLines={1}>
                    {item.structured_formatting?.main_text || item.description}
                  </Text>
                  <Text style={styles.resultSubtext} numberOfLines={1}>
                    {item.structured_formatting?.secondary_text || ''}
                </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  input: {
    height: 40,
    paddingHorizontal: 8,
    color: '#000',
    fontSize: 15,
  },
  resultsContainer: {
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 220,
    overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2',
  },
  resultIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  resultSubtext: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
});

export default SafePlacesAutocomplete;