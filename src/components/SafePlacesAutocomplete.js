import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, FlatList, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

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
          <FlatList
            data={results}
            keyExtractor={(item) => item.place_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.resultItem, customStyles.row]}
                onPress={() => handleSelectPlace(item)}
              >
                <Text style={[styles.resultText, customStyles.description]}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={[styles.separator, customStyles.separator]} />}
            keyboardShouldPersistTaps="handled"
          />
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
    position: 'absolute',
    top: 50,
    left: -40,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 8,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
    zIndex: 1000,
  },
  resultItem: {
    padding: 13,
    height: 50,
    justifyContent: 'center',
  },
  resultText: {
    fontSize: 14,
    color: '#000',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5E5',
  },
});

export default SafePlacesAutocomplete;