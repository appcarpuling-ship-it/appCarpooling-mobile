# 📖 Documentación de API - Backend Carpooling Argentina

> Documentación completa de todas las rutas y endpoints del sistema de carpooling

## 🏗️ Estructura General

**Base URL:** `http://localhost:5000/api/`

**Formato de Respuesta Estándar:**
```json
{
  "success": true|false,
  "message": "Mensaje descriptivo",
  "data": {}, // Datos opcionales
  "error": "string" // Solo en caso de error
}
```

**Headers Requeridos para Rutas Protegidas:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

---

## 🔐 1. Authentication Routes (`/api/auth/`)

### 📝 Registro de Usuario
**`POST /api/auth/register`**
- **Descripción:** Registra un nuevo usuario y envía código de verificación por email
- **Acceso:** Público
- **Content-Type:** `multipart/form-data`

**Parámetros (Body):**
```json
{
  "firstName": "string", // Requerido
  "lastName": "string", // Requerido
  "email": "string", // Requerido, formato email
  "password": "string", // Requerido, mínimo 6 caracteres
  "phone": "string", // Requerido
  "age": "number", // Requerido, entre 18-100
  "city": "string", // Requerido
  "province": "string", // Requerido
  "bio": "string", // Opcional
  "avatar": "file" // Opcional, imagen
}
```

**Respuesta Exitosa (201):**
```json
{
  "success": true,
  "message": "Usuario registrado. Por favor verifica tu email con el código enviado.",
  "data": {
    "userId": "string",
    "email": "string",
    "requiresVerification": true
  }
}
```

### ✉️ Verificación de Email
**`POST /api/auth/verify-email`**
- **Descripción:** Verifica el email del usuario con código de 6 dígitos
- **Acceso:** Público

**Parámetros (Body):**
```json
{
  "email": "string", // Email del usuario
  "verificationCode": "string" // Código de 6 dígitos
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "¡Email verificado exitosamente! Bienvenido a Carpooling Argentina",
  "data": {
    "token": "string",
    "user": {
      "_id": "string",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      // ... perfil del usuario
    }
  }
}
```

### 🔄 Reenviar Código de Verificación
**`POST /api/auth/resend-code`**
- **Descripción:** Reenvía código de verificación (límite: 3 por 2 minutos)
- **Acceso:** Público

**Parámetros (Body):**
```json
{
  "userId": "string", // ID del usuario
  "email": "string", // Opcional, alternativo a userId
  "type": "email" // Opcional, por defecto "email"
}
```

### 🚪 Login de Usuario
**`POST /api/auth/login`**
- **Descripción:** Autentica usuario y genera token JWT
- **Acceso:** Público

**Parámetros (Body):**
```json
{
  "email": "string", // Requerido, formato email
  "password": "string" // Requerido
}
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Login exitoso",
  "data": {
    "token": "string",
    "user": {
      "_id": "string",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "avatar": "string",
      "rating": "number",
      "totalTrips": "number",
      // ... más datos del perfil
    }
  }
}
```

### 👤 Obtener Usuario Actual
**`GET /api/auth/me`**
- **Descripción:** Obtiene información del usuario autenticado
- **Acceso:** Protegido

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "_id": "string",
    "firstName": "string",
    "lastName": "string",
    // ... perfil completo del usuario
  }
}
```

### ✏️ Actualizar Perfil
**`PUT /api/auth/profile`**
- **Descripción:** Actualiza información del perfil del usuario
- **Acceso:** Protegido
- **Content-Type:** `multipart/form-data`

**Parámetros (Body):**
```json
{
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "age": "number",
  "bio": "string",
  "city": "string",
  "province": "string",
  "avatar": "file" // Opcional, imagen
}
```

### 🔒 Recuperar Contraseña
**`POST /api/auth/forgot-password`**
- **Descripción:** Envía código de recuperación de contraseña por email
- **Acceso:** Público

**Parámetros (Body):**
```json
{
  "email": "string" // Requerido, formato email
}
```

---

## 👥 2. User Routes (`/api/users/`)

### 🔍 Buscar Usuarios
**`GET /api/users/search`**
- **Descripción:** Busca usuarios por nombre o ciudad
- **Acceso:** Público

**Query Parameters:**
```
?q=string // Término de búsqueda
&city=string // Filtrar por ciudad
&page=number // Número de página (default: 1)
&limit=number // Elementos por página (default: 10)
```

### ⭐ Usuarios Destacados
**`GET /api/users/featured`**
- **Descripción:** Obtiene usuarios con mejor rating
- **Acceso:** Público

### 👤 Perfil de Usuario por ID
**`GET /api/users/:id/profile`**
- **Descripción:** Obtiene perfil público de usuario específico
- **Acceso:** Público

**Parámetros de URL:**
- `id`: ID del usuario

### 🚗 Viajes de Usuario
**`GET /api/users/:id/trips`**
- **Descripción:** Obtiene viajes públicos de un usuario
- **Acceso:** Público

**Parámetros de URL:**
- `id`: ID del usuario

**Query Parameters:**
```
?status=string // Filtrar por estado (active, completed, cancelled)
&limit=number // Límite de resultados
```

### 📊 Mis Estadísticas
**`GET /api/users/my-stats`**
- **Descripción:** Obtiene estadísticas del usuario autenticado
- **Acceso:** Protegido

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "totalTripsAsDriver": "number",
    "totalTripsAsPassenger": "number",
    "totalEarnings": "number",
    "averageRating": "number",
    "totalReviews": "number"
  }
}
```

### 🔐 Cambiar Contraseña
**`PUT /api/users/change-password`**
- **Descripción:** Cambia la contraseña del usuario
- **Acceso:** Protegido

**Parámetros (Body):**
```json
{
  "currentPassword": "string", // Requerido
  "newPassword": "string" // Requerido, mínimo 6 caracteres
}
```

### 📱 Gestión de Push Tokens
**`PUT /api/users/push-token`**
- **Descripción:** Guarda token para notificaciones push
- **Acceso:** Protegido

**`DELETE /api/users/push-token`**
- **Descripción:** Elimina token de notificaciones push
- **Acceso:** Protegido

---

## 🚗 3. Trip Routes (`/api/trips/`)

### 📍 Geocodificación (Públicas)

**`POST /api/trips/geocode`**
- **Descripción:** Convierte dirección en coordenadas

**`POST /api/trips/geocode-trip`**
- **Descripción:** Geocodifica origen y destino de viaje

**`POST /api/trips/reverse-geocode`**
- **Descripción:** Convierte coordenadas en dirección

### 📋 Obtener Todos los Viajes
**`GET /api/trips/`**
- **Descripción:** Lista todos los viajes disponibles
- **Acceso:** Público

**Query Parameters:**
```
?page=number // Página (default: 1)
&limit=number // Elementos por página (default: 10)
&origin=string // Filtrar por ciudad origen
&destination=string // Filtrar por ciudad destino
&date=string // Filtrar por fecha (YYYY-MM-DD)
&minSeats=number // Mínimo asientos disponibles
&maxPrice=number // Precio máximo por asiento
```

### 🔍 Buscar Viajes
**`GET /api/trips/search`**
- **Descripción:** Búsqueda avanzada de viajes
- **Acceso:** Público

**Query Parameters:**
```
?origin=string // Ciudad origen (requerido)
&destination=string // Ciudad destino (requerido)
&date=string // Fecha (YYYY-MM-DD)
&passengers=number // Número de pasajeros
&sortBy=string // Ordenar por: price, date, rating
&order=string // Orden: asc, desc
```

### 🆔 Obtener Viaje por ID
**`GET /api/trips/:id`**
- **Descripción:** Obtiene detalles de viaje específico
- **Acceso:** Público

### ➕ Crear Viaje
**`POST /api/trips/`**
- **Descripción:** Crea un nuevo viaje (requiere verificar estado operativo del conductor)
- **Acceso:** Protegido

**Parámetros (Body):**
```json
{
  "vehicle": "string", // ID del vehículo (requerido)
  "origin": {
    "address": "string", // Requerido
    "city": "string", // Requerido
    "country": "string", // Requerido
    "coordinates": [longitude, latitude]
  },
  "destination": {
    "address": "string", // Requerido
    "city": "string", // Requerido
    "country": "string", // Requerido
    "coordinates": [longitude, latitude]
  },
  "departureDate": "string", // Fecha ISO (requerido)
  "departureTime": "string", // Hora HH:mm (requerido)
  "availableSeats": "number", // Mínimo 1 (requerido)
  "pricePerSeat": "number", // Mínimo 0 (requerido)
  "description": "string", // Opcional
  "allowInstantBooking": "boolean", // Opcional
  "restrictions": "string" // Opcional
}
```

**Respuesta Exitosa (201):**
```json
{
  "success": true,
  "message": "Viaje creado exitosamente",
  "data": {
    "_id": "string",
    "driver": {
      "_id": "string",
      "firstName": "string",
      "lastName": "string",
      "avatar": "string",
      "rating": "number"
    },
    "vehicle": {
      "_id": "string",
      "make": "string",
      "model": "string",
      "color": "string"
    },
    "origin": {},
    "destination": {},
    "departureDate": "string",
    "departureTime": "string",
    "availableSeats": "number",
    "pricePerSeat": "number",
    "status": "active",
    "createdAt": "string"
  }
}
```

### 📚 Mis Viajes

**`GET /api/trips/my-trips/driver`**
- **Descripción:** Obtiene viajes donde el usuario es conductor
- **Acceso:** Protegido

**`GET /api/trips/my-trips/passenger`**
- **Descripción:** Obtiene viajes donde el usuario es pasajero
- **Acceso:** Protegido

### ✏️ Actualizar Viaje
**`PUT /api/trips/:id`**
- **Descripción:** Actualiza información del viaje
- **Acceso:** Protegido (solo el conductor)

### ❌ Cancelar Viaje
**`PUT /api/trips/:id/cancel`**
- **Descripción:** Cancela el viaje
- **Acceso:** Protegido (solo el conductor)

### ✅ Completar Viaje
**`PUT /api/trips/:id/complete`**
- **Descripción:** Marca el viaje como completado
- **Acceso:** Protegido (solo el conductor)

### 🗑️ Eliminar Viaje
**`DELETE /api/trips/:id`**
- **Descripción:** Elimina el viaje
- **Acceso:** Protegido (solo el conductor)

---

## 🎫 4. Booking Routes (`/api/bookings/`)

> **Nota:** Todas las rutas de bookings requieren autenticación

### ➕ Crear Reserva
**`POST /api/bookings/`**
- **Descripción:** Crea una nueva reserva en un viaje
- **Acceso:** Protegido

**Parámetros (Body):**
```json
{
  "trip": "string", // ID del viaje (requerido)
  "seatsBooked": "number" // Mínimo 1 (requerido)
}
```

**Respuesta Exitosa (201):**
```json
{
  "success": true,
  "message": "Reserva creada exitosamente",
  "data": {
    "_id": "string",
    "trip": "string",
    "passenger": "string",
    "seatsBooked": "number",
    "status": "pending",
    "totalPrice": "number",
    "createdAt": "string"
  }
}
```

### 📋 Mis Reservas
**`GET /api/bookings/my-bookings`**
- **Descripción:** Obtiene todas las reservas del usuario autenticado
- **Acceso:** Protegido

**Query Parameters:**
```
?status=string // Filtrar por estado (pending, confirmed, cancelled, completed)
&page=number
&limit=number
```

### 🚗 Reservas de un Viaje
**`GET /api/bookings/trip/:tripId`**
- **Descripción:** Obtiene todas las reservas de un viaje específico
- **Acceso:** Protegido (solo el conductor del viaje)

**Parámetros de URL:**
- `tripId`: ID del viaje

### 🆔 Obtener Reserva por ID
**`GET /api/bookings/:id`**
- **Descripción:** Obtiene detalles de una reserva específica
- **Acceso:** Protegido (conductor o pasajero involucrado)

### ✅ Confirmar Reserva
**`PUT /api/bookings/:id/confirm`**
- **Descripción:** Confirma una reserva pendiente
- **Acceso:** Protegido (solo el conductor)

### ❌ Rechazar Reserva
**`PUT /api/bookings/:id/reject`**
- **Descripción:** Rechaza una reserva pendiente
- **Acceso:** Protegido (solo el conductor)

### 🚫 Cancelar Reserva
**`PUT /api/bookings/:id/cancel`**
- **Descripción:** Cancela una reserva (por conductor o pasajero)
- **Acceso:** Protegido (conductor o pasajero)

---

## 🚙 5. Vehicle Routes (`/api/vehicles/`)

### ➕ Crear Vehículo
**`POST /api/vehicles/`**
- **Descripción:** Registra un nuevo vehículo del usuario
- **Acceso:** Protegido
- **Content-Type:** `multipart/form-data`

**Parámetros (Body):**
```json
{
  "make": "string", // Marca (requerido)
  "model": "string", // Modelo (requerido)
  "year": "number", // Año (requerido)
  "color": "string", // Color (requerido)
  "licensePlate": "string", // Patente (requerido)
  "seats": "number", // Número de asientos (requerido)
  "description": "string", // Opcional
  "photos": "file[]" // Máximo 10 fotos
}
```

### 📋 Mis Vehículos
**`GET /api/vehicles/my-vehicles`**
- **Descripción:** Obtiene todos los vehículos del usuario
- **Acceso:** Protegido

### 🆔 Obtener Vehículo por ID
**`GET /api/vehicles/:id`**
- **Descripción:** Obtiene detalles de un vehículo específico
- **Acceso:** Público

### ✏️ Actualizar Vehículo
**`PUT /api/vehicles/:id`**
- **Descripción:** Actualiza información del vehículo
- **Acceso:** Protegido (solo el propietario)
- **Content-Type:** `multipart/form-data`

### 🗑️ Eliminar Vehículo
**`DELETE /api/vehicles/:id`**
- **Descripción:** Elimina un vehículo
- **Acceso:** Protegido (solo el propietario)

---

## 💬 6. Chat Routes (`/api/chat/`)

> **Nota:** Todas las rutas de chat requieren autenticación e integran WebSocket para tiempo real

### ➕ Crear/Obtener Conversación
**`POST /api/chat/conversation`**
- **Descripción:** Crea una nueva conversación o obtiene una existente
- **Acceso:** Protegido

**Parámetros (Body):**
```json
{
  "participantId": "string" // ID del otro usuario (requerido)
}
```

### 📋 Obtener Conversaciones
**`GET /api/chat/conversations`**
- **Descripción:** Lista todas las conversaciones del usuario
- **Acceso:** Protegido

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "string",
      "participants": [
        {
          "_id": "string",
          "firstName": "string",
          "lastName": "string",
          "avatar": "string"
        }
      ],
      "lastMessage": {
        "content": "string",
        "sender": "string",
        "timestamp": "string"
      },
      "unreadCount": "number",
      "updatedAt": "string"
    }
  ]
}
```

### 💬 Mensajes de Conversación
**`GET /api/chat/conversation/:conversationId/messages`**
- **Descripción:** Obtiene mensajes de una conversación específica
- **Acceso:** Protegido (solo participantes)

**Query Parameters:**
```
?page=number
&limit=number // Máximo 50
```

### 📨 Enviar Mensaje
**`POST /api/chat/message`**
- **Descripción:** Envía un mensaje en una conversación
- **Acceso:** Protegido

**Parámetros (Body):**
```json
{
  "conversationId": "string", // Requerido
  "content": "string", // Requerido, máximo 1000 caracteres
  "type": "text" // Opcional, por defecto "text"
}
```

### 👁️ Marcar como Leído
**`PUT /api/chat/conversation/:conversationId/read`**
- **Descripción:** Marca todos los mensajes de la conversación como leídos
- **Acceso:** Protegido

### 📊 Contador de No Leídos
**`GET /api/chat/unread-count`**
- **Descripción:** Obtiene el número total de mensajes no leídos
- **Acceso:** Protegido

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "unreadCount": "number"
  }
}
```

---

## ⭐ 7. Review Routes (`/api/reviews/`)

### ➕ Crear Reseña
**`POST /api/reviews/`**
- **Descripción:** Crea una reseña para un usuario después de un viaje
- **Acceso:** Protegido

**Parámetros (Body):**
```json
{
  "trip": "string", // ID del viaje (requerido)
  "reviewedUser": "string", // ID del usuario reseñado (requerido)
  "rating": "number", // 1-5 estrellas (requerido)
  "comment": "string", // Comentario (requerido)
  "type": "driver|passenger" // Tipo de reseña (requerido)
}
```

### 👤 Reseñas de Usuario
**`GET /api/reviews/user/:userId`**
- **Descripción:** Obtiene todas las reseñas de un usuario específico
- **Acceso:** Público

**Query Parameters:**
```
?type=string // Filtrar por tipo (driver, passenger)
&page=number
&limit=number
```

### 🚗 Reseñas de Viaje
**`GET /api/reviews/trip/:tripId`**
- **Descripción:** Obtiene todas las reseñas de un viaje específico
- **Acceso:** Público

### 📋 Mis Reseñas
**`GET /api/reviews/my-reviews`**
- **Descripción:** Obtiene todas las reseñas del usuario autenticado
- **Acceso:** Protegido

### 👍 Marcar Reseña como Útil
**`PUT /api/reviews/:id/helpful`**
- **Descripción:** Marca una reseña como útil
- **Acceso:** Protegido

### 🗑️ Eliminar Reseña
**`DELETE /api/reviews/:id`**
- **Descripción:** Elimina una reseña (solo el autor)
- **Acceso:** Protegido

---

## 🔔 8. Notification Routes (`/api/notifications/`)

> **Nota:** Todas las rutas de notificaciones requieren autenticación e integran WebSocket

### 📋 Obtener Notificaciones
**`GET /api/notifications/`**
- **Descripción:** Lista todas las notificaciones del usuario
- **Acceso:** Protegido

**Query Parameters:**
```
?read=boolean // Filtrar por leídas/no leídas
&type=string // Filtrar por tipo
&page=number
&limit=number
```

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "string",
      "type": "string",
      "title": "string",
      "message": "string",
      "isRead": "boolean",
      "relatedTrip": "string", // Opcional
      "relatedUser": "string", // Opcional
      "actionUrl": "string", // Opcional
      "createdAt": "string"
    }
  ]
}
```

### 📊 Contador de No Leídas
**`GET /api/notifications/unread-count`**
- **Descripción:** Obtiene el número de notificaciones no leídas
- **Acceso:** Protegido

### ✅ Marcar Todas como Leídas
**`PUT /api/notifications/read-all`**
- **Descripción:** Marca todas las notificaciones como leídas
- **Acceso:** Protegido

**`PUT /api/notifications/mark-all-read`**
- **Descripción:** Alias móvil para marcar todas como leídas
- **Acceso:** Protegido

### 🗑️ Eliminar Notificaciones Leídas
**`DELETE /api/notifications/clear-read`**
- **Descripción:** Elimina todas las notificaciones ya leídas
- **Acceso:** Protegido

### 👁️ Marcar Notificación como Leída
**`PUT /api/notifications/:id/read`**
- **Descripción:** Marca una notificación específica como leída
- **Acceso:** Protegido

### 🗑️ Eliminar Notificación
**`DELETE /api/notifications/:id`**
- **Descripción:** Elimina una notificación específica
- **Acceso:** Protegido

---

## 💰 9. Payment Routes (`/api/payments/`)

### ➕ Crear Pago
**`POST /api/payments/`**
- **Descripción:** Crea un pago para una reserva confirmada
- **Acceso:** Protegido

**Parámetros (Body):**
```json
{
  "booking": "string", // ID de la reserva (requerido)
  "paymentMethod": "mercadopago|transfer|cash", // Método de pago (requerido)
  "amount": "number" // Monto (requerido)
}
```

### 📤 Pagos Enviados
**`GET /api/payments/sent`**
- **Descripción:** Obtiene pagos realizados por el usuario
- **Acceso:** Protegido

### 📥 Pagos Recibidos
**`GET /api/payments/received`**
- **Descripción:** Obtiene pagos recibidos por el usuario
- **Acceso:** Protegido

### 📊 Resumen de Pagos
**`GET /api/payments/summary`**
- **Descripción:** Resumen financiero del usuario
- **Acceso:** Protegido

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "totalSent": "number",
    "totalReceived": "number",
    "pendingPayments": "number",
    "completedPayments": "number"
  }
}
```

### ✅ Confirmar Pago
**`PUT /api/payments/:id/confirm`**
- **Descripción:** Confirma la recepción de un pago
- **Acceso:** Protegido

### 🔄 Solicitar Reembolso
**`PUT /api/payments/:id/refund`**
- **Descripción:** Solicita reembolso de un pago
- **Acceso:** Protegido

### 🔗 Webhook MercadoPago
**`POST /api/payments/webhook/mercadopago`**
- **Descripción:** Endpoint para webhooks de MercadoPago
- **Acceso:** Público (sin autenticación)

---

## 🎯 10. Recommendation Routes (`/api/recommendations/`)

### 🚗 Viajes Recomendados
**`GET /api/recommendations/trips`**
- **Descripción:** Obtiene viajes recomendados para el usuario
- **Acceso:** Protegido

### 👥 Conductores Recomendados
**`GET /api/recommendations/drivers`**
- **Descripción:** Obtiene conductores recomendados
- **Acceso:** Protegido

### 📈 Rutas Populares
**`GET /api/recommendations/popular-routes`**
- **Descripción:** Obtiene las rutas más populares
- **Acceso:** Público

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": [
    {
      "origin": "string",
      "destination": "string",
      "tripCount": "number",
      "averagePrice": "number"
    }
  ]
}
```

### 🏙️ Demanda por Ciudad
**`GET /api/recommendations/city-demand`**
- **Descripción:** Obtiene datos de demanda por ciudad
- **Acceso:** Público

### 🔗 Viajes Similares
**`GET /api/recommendations/similar/:tripId`**
- **Descripción:** Obtiene viajes similares a uno específico
- **Acceso:** Público

---

## 💼 11. Commission Routes (`/api/commissions/`)

> **Nota:** Sistema de comisiones para conductores frecuentes

### 📋 Mis Comisiones
**`GET /api/commissions/my-commissions`**
- **Descripción:** Obtiene comisiones del conductor autenticado
- **Acceso:** Protegido

**Query Parameters:**
```
?status=string // Filtrar por estado (pending, paid, waived)
&month=number // Filtrar por mes
&year=number // Filtrar por año
```

### 📊 Estadísticas de Comisiones
**`GET /api/commissions/my-stats`**
- **Descripción:** Estadísticas de comisiones del conductor
- **Acceso:** Protegido

### ⚡ Estado Operativo
**`GET /api/commissions/operation-status`**
- **Descripción:** Verifica si el conductor puede crear viajes
- **Acceso:** Protegido

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "canCreateTrips": "boolean",
    "reason": "string", // Si no puede crear viajes
    "pendingCommissions": "number",
    "totalOwed": "number"
  }
}
```

### 💳 Pagar Comisión
**`PUT /api/commissions/:id/pay`**
- **Descripción:** Marca comisión como pagada con comprobante
- **Acceso:** Protegido
- **Content-Type:** `multipart/form-data`

**Parámetros (Body):**
```json
{
  "paymentMethod": "transfer|cash", // Requerido
  "receipt": "file" // Comprobante (opcional)
}
```

### 🆔 Obtener Comisión por ID
**`GET /api/commissions/:id`**
- **Descripción:** Obtiene detalles de comisión específica
- **Acceso:** Protegido

### 🔧 Rutas de Administración

**`GET /api/commissions/admin/summary`**
- **Descripción:** Resumen de comisiones para admin
- **Acceso:** Admin

**`GET /api/commissions/admin/all`**
- **Descripción:** Todas las comisiones para admin
- **Acceso:** Admin

**`POST /api/commissions/admin/calculate`**
- **Descripción:** Calcular comisiones mensualmente
- **Acceso:** Admin

**`POST /api/commissions/admin/send-notifications`**
- **Descripción:** Enviar notificaciones de comisiones
- **Acceso:** Admin

**`PUT /api/commissions/admin/:id/waive`**
- **Descripción:** Eximir comisión específica
- **Acceso:** Admin

---

## 👑 12. Admin Routes (`/api/admin/`)

> **Nota:** Todas las rutas requieren rol de administrador

### 👥 Gestión de Usuarios

**`GET /api/admin/users`**
- **Descripción:** Lista todos los usuarios del sistema

**`GET /api/admin/users/:id`**
- **Descripción:** Obtiene usuario específico por ID

**`PUT /api/admin/users/:id`**
- **Descripción:** Actualiza información de usuario

**`DELETE /api/admin/users/:id`**
- **Descripción:** Desactiva un usuario

**`PUT /api/admin/users/:id/activate`**
- **Descripción:** Reactiva un usuario desactivado

**`PUT /api/admin/users/:id/verify`**
- **Descripción:** Verifica manualmente un usuario

### 🚗 Gestión de Viajes

**`GET /api/admin/trips`**
- **Descripción:** Lista todos los viajes del sistema

**`PUT /api/admin/trips/:id/cancel`**
- **Descripción:** Cancela un viaje como administrador

**`DELETE /api/admin/trips/:id`**
- **Descripción:** Elimina un viaje como administrador

### 🎫 Gestión de Reservas

**`GET /api/admin/bookings`**
- **Descripción:** Lista todas las reservas del sistema

**`PUT /api/admin/bookings/:id/cancel`**
- **Descripción:** Cancela una reserva como administrador

### 📊 Estadísticas de la Plataforma

**`GET /api/admin/stats`**
- **Descripción:** Estadísticas generales de la plataforma

**Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "totalUsers": "number",
    "activeUsers": "number",
    "totalTrips": "number",
    "activeTrips": "number",
    "totalBookings": "number",
    "totalRevenue": "number",
    "growthMetrics": {
      "usersThisMonth": "number",
      "tripsThisMonth": "number"
    }
  }
}
```

---

## 🏠 13. Server Routes

### 🏁 Endpoint Principal
**`GET /`**
- **Descripción:** Información de bienvenida de la API
- **Acceso:** Público

**Respuesta:**
```json
{
  "message": "Carpooling Argentina API",
  "version": "1.0",
  "status": "running",
  "endpoints": "https://api.carpooling.com/docs"
}
```

### 💓 Health Check
**`GET /health`**
- **Descripción:** Verificación de estado del servidor
- **Acceso:** Público

**`POST /`**
- **Descripción:** Health check para POST requests
- **Acceso:** Público

---

## 📱 WebSocket Events

El sistema utiliza WebSocket para comunicación en tiempo real:

### Eventos de Chat:
- `joinConversation` - Unirse a conversación
- `sendMessage` - Enviar mensaje
- `messageReceived` - Mensaje recibido
- `typing` - Usuario escribiendo

### Eventos de Notificaciones:
- `notification` - Nueva notificación
- `tripUpdate` - Actualización de viaje
- `bookingUpdate` - Actualización de reserva

---

## 📸 Upload de Archivos

### Configuraciones de Upload:

**Avatares de Usuario:**
- Ruta: `/uploads/avatars/`
- Formatos: JPG, JPEG, PNG
- Tamaño máximo: 5MB
- Campo: `avatar`

**Fotos de Vehículos:**
- Ruta: `/uploads/vehicles/`
- Formatos: JPG, JPEG, PNG
- Tamaño máximo: 5MB por foto
- Máximo: 10 fotos por vehículo
- Campo: `photos`

**Comprobantes de Comisiones:**
- Ruta: `/uploads/receipts/`
- Formatos: JPG, JPEG, PNG, PDF
- Tamaño máximo: 10MB
- Campo: `receipt`

---

## 🔐 Códigos de Estado HTTP

### Exitosos (2xx):
- `200` - OK: Operación exitosa
- `201` - Created: Recurso creado exitosamente

### Errores del Cliente (4xx):
- `400` - Bad Request: Datos inválidos
- `401` - Unauthorized: No autenticado
- `403` - Forbidden: No autorizado
- `404` - Not Found: Recurso no encontrado
- `429` - Too Many Requests: Límite de peticiones excedido

### Errores del Servidor (5xx):
- `500` - Internal Server Error: Error interno del servidor

---

## 🚀 Middleware Utilizados

### 🔐 Autenticación:
- `protect`: Verifica JWT token
- `checkDriverOperationStatus`: Verifica estado operativo del conductor

### 📝 Validación:
- `express-validator`: Validación de datos de entrada

### 📤 Upload:
- `multer`: Manejo de archivos multipart

### 🛡️ Seguridad:
- Rate limiting para prevenir abuso
- Validación de tipos MIME para archivos
- Sanitización de datos de entrada

---

## 📞 Contacto y Soporte

Para soporte técnico o consultas sobre la API:
- Email: soporte@carpooling.com.ar
- Documentación: https://docs.carpooling.com.ar
- Status: https://status.carpooling.com.ar

---

*Documentación generada el: ${new Date().toLocaleString('es-AR')}*