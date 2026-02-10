import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SafePlacesAutocomplete = ({ 
  placeholder, 
  onPress, 
  apiKey, 
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
      // ✅ FIX: Usar JSONP o proxy para evitar CORS
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${apiKey}&language=es&components=country:ar`;
      
      console.log('🔍 Buscando lugares:', text);
      
      const response = await fetch(url);
      const data = await response.json();


      // ✅ VALIDACIÓN SEGURA
      if (data && Array.isArray(data.predictions) && data.predictions.length > 0) {
        console.log('✅ Se encontraron', data.predictions.length, 'resultados');
        setResults(data.predictions);
        setShowResults(true);
        // Notificar al padre si hay callback y este input está activo
        if (onResultsChange) {
          onResultsChange(data.predictions);
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
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&key=${apiKey}&language=es&fields=address_components,geometry,formatted_address`;
      
      console.log('🔍 Obteniendo detalles del lugar...');
      
      const response = await fetch(detailsUrl);
      const data = await response.json();
      
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

  // Exponer método para el ref
  useEffect(() => {
    if (inputRef) {
      inputRef.current = { setAddressText };
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
        onSubmitEditing={() => {
          // Evitar que el teclado se cierre al presionar intro
          // Las predicciones permanecen visibles
        }}
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