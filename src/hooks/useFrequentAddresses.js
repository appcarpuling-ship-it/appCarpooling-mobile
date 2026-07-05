import { useState, useEffect, useRef } from 'react';
import { get_withauth } from '../services/apiService';
import { ENDPOINTS } from '../config/api';

// Cache en memoria durante la sesión: evita repetir el pedido cada vez que se abre un buscador de direcciones.
let cache = null;

export const useFrequentAddresses = () => {
  const [addresses, setAddresses] = useState(cache || []);
  const fetched = useRef(Boolean(cache));

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    get_withauth(ENDPOINTS.FREQUENT_ADDRESSES)
      .then((res) => {
        cache = res?.data || [];
        setAddresses(cache);
      })
      .catch(() => {});
  }, []);

  return addresses;
};
