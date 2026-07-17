import { useState, useCallback } from 'react';

// Reglas de validación
const validationRules = {
  required: (value, fieldName) => {
    if (!value || value.toString().trim() === '') {
      const fieldLabels = {
        firstName: 'Nombre',
        lastName: 'Apellido',
        email: 'Email',
        password: 'Contraseña',
        confirmPassword: 'Confirmar contraseña',
        phone: 'Teléfono',
        age: 'Edad',
        city: 'Ciudad',
        province: 'Provincia',
        bio: 'Biografía',
        origin: 'Origen',
        destination: 'Destino',
        departureDate: 'Fecha de salida',
        departureTime: 'Hora de salida',
        availableSeats: 'Asientos disponibles',
        pricePerSeat: 'Precio por asiento',
        description: 'Descripción',
        make: 'Marca',
        model: 'Modelo',
        year: 'Año',
        color: 'Color',
        licensePlate: 'Placa',
        seats: 'Asientos',
        gender: 'Sexo',
      };
      const label = fieldLabels[fieldName] || fieldName;
      return `${label} es requerido`;
    }
    return null;
  },

  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      return 'Ingresa un email válido';
    }
    return null;
  },

  minLength: (value, min) => {
    if (value && value.length < min) {
      return `Debe tener al menos ${min} caracteres`;
    }
    return null;
  },

  maxLength: (value, max) => {
    if (value && value.length > max) {
      return `No puede exceder ${max} caracteres`;
    }
    return null;
  },

  phone: (value) => {
    if (!value) return null;

    // Permitir varios formatos de teléfono argentino
    const phoneRegex = /^(\+?54)?[\s\-]?(\(?11\)?|\(?[2-9]\d{1,3}\)?)[\s\-]?\d{3,4}[\s\-]?\d{3,4}$/;
    if (!phoneRegex.test(value.replace(/\s/g, ''))) {
      return 'Ingresa un número de teléfono válido';
    }
    return null;
  },

  age: (value) => {
    if (!value) return null;

    const ageNum = parseInt(value);
    if (isNaN(ageNum)) {
      return 'La edad debe ser un número';
    }
    if (ageNum < 18) {
      return 'Debes ser mayor de 18 años';
    }
    if (ageNum > 100) {
      return 'Ingresa una edad válida';
    }
    return null;
  },

  confirmPassword: (value, originalPassword) => {
    if (value && originalPassword && value !== originalPassword) {
      return 'Las contraseñas no coinciden';
    }
    return null;
  },

  strongPassword: (value) => {
    if (!value) return null;

    if (value.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres';
    }

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumbers = /\d/.test(value);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

    const missing = [];
    if (!hasUpperCase) missing.push('mayúscula');
    if (!hasLowerCase) missing.push('minúscula');
    if (!hasNumbers) missing.push('número');
    if (!hasSpecialChar) missing.push('carácter especial');

    if (missing.length > 0) {
      return `Incluye al menos una ${missing.join(', ')}`;
    }

    return null;
  },

  url: (value) => {
    if (!value) return null;

    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlRegex.test(value)) {
      return 'Ingresa una URL válida';
    }
    return null;
  },

  price: (value) => {
    if (!value) return null;

    const priceNum = parseFloat(value);
    if (isNaN(priceNum)) {
      return 'El precio debe ser un número';
    }
    if (priceNum < 0) {
      return 'El precio no puede ser negativo';
    }
    if (priceNum > 999999) {
      return 'El precio es demasiado alto';
    }
    return null;
  },

  seats: (value) => {
    if (!value) return null;

    const seatsNum = parseInt(value);
    if (isNaN(seatsNum)) {
      return 'Los asientos deben ser un número';
    }
    if (seatsNum < 1) {
      return 'Debe tener al menos 1 asiento';
    }
    if (seatsNum > 8) {
      return 'Máximo 8 asientos';
    }
    return null;
  },
};

// Hook principal de validación
export const useFormValidation = (initialValues = {}, validationSchema = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = useCallback((fieldName, value, allValues = values) => {
    const fieldSchema = validationSchema[fieldName];
    if (!fieldSchema) return null;

    for (const rule of fieldSchema) {
      let error = null;

      if (typeof rule === 'string') {
        // Regla simple como 'required'
        const ruleName = rule;
        if (validationRules[ruleName]) {
          error = validationRules[ruleName](value, fieldName);
        }
      } else if (typeof rule === 'object') {
        // Regla con parámetros como { type: 'minLength', value: 6 }
        const { type, value: ruleValue, message } = rule;
        if (validationRules[type]) {
          if (type === 'confirmPassword') {
            // Caso especial para confirmPassword
            const passwordField = rule.compareField || 'password';
            error = validationRules[type](value, allValues[passwordField]);
          } else {
            error = validationRules[type](value, ruleValue);
          }
        }
        // Permitir mensaje personalizado
        if (error && message) {
          error = message;
        }
      } else if (typeof rule === 'function') {
        // Regla personalizada
        error = rule(value, allValues);
      }

      if (error) {
        return error;
      }
    }

    return null;
  }, [validationSchema, values]);

  const validateAllFields = useCallback((valuesToValidate = values) => {
    const newErrors = {};
    let isValid = true;

    Object.keys(validationSchema).forEach(fieldName => {
      const error = validateField(fieldName, valuesToValidate[fieldName], valuesToValidate);
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return { isValid, errors: newErrors };
  }, [validationSchema, validateField, values]);

  const setValue = useCallback((fieldName, value) => {
    setValues(prev => {
      const newValues = { ...prev, [fieldName]: value };

      // Validar el campo en tiempo real si ya fue tocado
      if (touched[fieldName]) {
        const error = validateField(fieldName, value, newValues);
        setErrors(prev => ({
          ...prev,
          [fieldName]: error
        }));
      }

      return newValues;
    });
  }, [touched, validateField]);

  const setFieldTouched = useCallback((fieldName, isTouched = true) => {
    setTouched(prev => ({ ...prev, [fieldName]: isTouched }));

    if (isTouched) {
      // Se llama en el mismo handler que setValue (ej: onProvinceChange hace setValue +
      // setFieldTouched). Ahí `values` del closure todavía tiene el valor ANTERIOR, así que
      // validar contra eso marcaba "es requerido" un campo recién completado: el usuario veía
      // su provincia elegida en el select y el error debajo al mismo tiempo.
      // El updater sí recibe el estado pendiente, con lo que setValue ya dejó aplicado.
      setValues(current => {
        const error = validateField(fieldName, current[fieldName], current);
        setErrors(prev => ({ ...prev, [fieldName]: error }));
        return current;
      });
    }
  }, [validateField]);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  const getFieldProps = useCallback((fieldName) => ({
    value: values[fieldName] || '',
    onChangeText: (value) => setValue(fieldName, value),
    onBlur: () => setFieldTouched(fieldName, true),
    error: touched[fieldName] ? errors[fieldName] : null,
  }), [values, errors, touched, setValue, setFieldTouched]);

  return {
    values,
    errors,
    touched,
    setValue,
    setFieldTouched,
    validateField,
    validateAllFields,
    resetForm,
    getFieldProps,
    isValid: Object.keys(errors).length === 0,
  };
};

// Esquemas de validación predefinidos
export const validationSchemas = {
  register: {
    firstName: ['required', { type: 'maxLength', value: 50 }],
    lastName: ['required', { type: 'maxLength', value: 50 }],
    email: ['required', 'email'],
    password: ['required', 'strongPassword'],
    confirmPassword: ['required', { type: 'confirmPassword', compareField: 'password' }],
    gender: ['required'],
    phone: ['required', 'phone'],
    age: ['required', 'age'],
    city: ['required', { type: 'maxLength', value: 100 }],
    province: ['required'],
    bio: [{ type: 'maxLength', value: 500 }],
  },

  login: {
    email: ['required', 'email'],
    password: ['required'],
  },

  createTrip: {
    origin: ['required'],
    destination: ['required'],
    departureDate: ['required'],
    departureTime: ['required'],
    availableSeats: ['required', 'seats'],
    pricePerSeat: ['required', 'price'],
    description: [{ type: 'maxLength', value: 500 }],
  },

  createVehicle: {
    make: ['required', { type: 'maxLength', value: 50 }],
    model: ['required', { type: 'maxLength', value: 50 }],
    year: ['required', (value) => {
      const year = parseInt(value);
      const currentYear = new Date().getFullYear();
      if (isNaN(year)) return 'El año debe ser un número';
      if (year < 1900) return 'Año inválido';
      if (year > currentYear + 1) return 'El año no puede ser futuro';
      return null;
    }],
    color: ['required', { type: 'maxLength', value: 30 }],
    licensePlate: ['required', { type: 'maxLength', value: 50 }],
    seats: ['required', 'seats'],
    description: [{ type: 'maxLength', value: 500 }],
  },

  editProfile: {
    firstName: ['required', { type: 'maxLength', value: 50 }],
    lastName: ['required', { type: 'maxLength', value: 50 }],
    phone: ['required', 'phone'],
    age: ['required', 'age'],
    bio: [{ type: 'maxLength', value: 500 }],
    city: ['required', { type: 'maxLength', value: 100 }],
    province: ['required'],
  },
};

export default useFormValidation;