import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SafePlacesAutocomplete = ({ 
  placeholder, 
  onPress, 
  apiKey, 
  inputRef,
  styles: customStyles = {}
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef(null);

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

      console.log('📍 Resultados:', data);

      // ✅ VALIDACIÓN SEGURA
      if (data && Array.isArray(data.predictions) && data.predictions.length > 0) {
        console.log('✅ Se encontraron', data.predictions.length, 'resultados');
        setResults(data.predictions);
        setShowResults(true);
      } else {
        console.log('⚠️ No se encontraron resultados');
        setResults([]);
        setShowResults(false);
      }
    } catch (error) {
      console.error('❌ Error searching places:', error);
      setResults([]);
      setShowResults(false);
    } finally {
      setLoading(false);
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
      return;
    }
    
    timeoutRef.current = setTimeout(() => {
      searchPlaces(text);
    }, 2000);
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

  return (
    <View style={[styles.container, customStyles.container]}>
      <TextInput
        value={query}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        style={[styles.input, customStyles.textInput]}
        autoCapitalize="none"
        autoCorrect={false}
      />
      
      {loading && (
        <ActivityIndicator 
          size="small" 
          color="#007AFF" 
          style={{ position: 'absolute', right: 10, top: 12 }} 
        />
      )}
      
      {showResults && results.length > 0 && (
        <View style={[styles.resultsContainer, customStyles.listView]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
          >
            {results.map((item, index) => (
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