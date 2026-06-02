export const ARGENTINA_PROVINCES = [
  'Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Ciudad Autónoma de Buenos Aires',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán'
];

export const ARGENTINA_CITIES = {
  'Buenos Aires': ['La Plata', 'Mar del Plata', 'Bahía Blanca', 'Quilmes', 'Lanús', 'Lomas de Zamora', 'Morón', 'Merlo', 'Tigre', 'San Isidro', 'General San Martín', 'Tres de Febrero', 'Florencio Varela', 'Berazategui', 'San Justo', 'Hurlingham', 'Avellaneda', 'Almirante Brown', 'Esteban Echeverría', 'Tandil', 'Junín', 'Pergamino', 'Olavarría', 'Necochea', 'Zárate'],
  'Ciudad Autónoma de Buenos Aires': ['Buenos Aires'],
  'Catamarca': ['San Fernando del Valle de Catamarca', 'Andalgalá', 'Belén', 'Santa María', 'Tinogasta', 'Recreo'],
  'Chaco': ['Resistencia', 'Barranqueras', 'Fontana', 'Presidencia Roque Sáenz Peña', 'Villa Ángela', 'Charata'],
  'Chubut': ['Rawson', 'Comodoro Rivadavia', 'Trelew', 'Puerto Madryn', 'Esquel', 'El Bolsón', 'Lago Puelo'],
  'Córdoba': ['Córdoba', 'Villa María', 'Río Cuarto', 'San Francisco', 'Villa Carlos Paz', 'Alta Gracia', 'Jesús María', 'Cosquín', 'Bell Ville', 'Marcos Juárez', 'La Falda', 'Villa General Belgrano', 'Laboulaye'],
  'Corrientes': ['Corrientes', 'Goya', 'Paso de los Libres', 'Mercedes', 'Curuzú Cuatiá', 'Bella Vista', 'Ituzaingó'],
  'Entre Ríos': ['Paraná', 'Concordia', 'Gualeguaychú', 'Concepción del Uruguay', 'Victoria', 'Colón', 'Villaguay', 'Federación'],
  'Formosa': ['Formosa', 'Clorinda', 'Pirané', 'El Colorado', 'Ingeniero Juárez'],
  'Jujuy': ['San Salvador de Jujuy', 'Palpalá', 'San Pedro', 'Libertador General San Martín', 'Humahuaca', 'Tilcara', 'Perico'],
  'La Pampa': ['Santa Rosa', 'General Pico', 'Toay', 'Eduardo Castex', 'Victorica', 'Realicó'],
  'La Rioja': ['La Rioja', 'Chilecito', 'Aimogasta', 'Chepes', 'Chamical', 'Famatina'],
  'Mendoza': ['Mendoza', 'San Rafael', 'Godoy Cruz', 'Guaymallén', 'Luján de Cuyo', 'Maipú', 'Las Heras', 'Rivadavia', 'Junín', 'Malargüe', 'General Alvear'],
  'Misiones': ['Posadas', 'Oberá', 'Eldorado', 'Puerto Iguazú', 'Apóstoles', 'Leandro N. Alem', 'Montecarlo'],
  'Neuquén': ['Neuquén', 'San Martín de los Andes', 'Villa La Angostura', 'Zapala', 'Cutral Có', 'Junín de los Andes', 'Centenario', 'Plottier'],
  'Río Negro': ['Viedma', 'San Carlos de Bariloche', 'General Roca', 'Cipolletti', 'Allen', 'El Bolsón', 'Jacobacci'],
  'Salta': ['Salta', 'San Ramón de la Nueva Orán', 'Tartagal', 'General Güemes', 'Cafayate', 'Rosario de la Frontera', 'Metán'],
  'San Juan': ['San Juan', 'Rivadavia', 'Caucete', 'Santa Lucía', 'Chimbas', 'Rawson', 'Pocito', 'Albardón'],
  'San Luis': ['San Luis', 'Villa Mercedes', 'Merlo', 'San Francisco del Monte de Oro', 'Quines'],
  'Santa Cruz': ['Río Gallegos', 'Caleta Olivia', 'El Calafate', 'Pico Truncado', 'Las Heras', 'Puerto Deseado'],
  'Santa Fe': ['Rosario', 'Santa Fe', 'Rafaela', 'Venado Tuerto', 'Villa Gobernador Gálvez', 'Santo Tomé', 'Reconquista', 'San Lorenzo', 'Esperanza', 'Cañada de Gómez'],
  'Santiago del Estero': ['Santiago del Estero', 'La Banda', 'Termas de Río Hondo', 'Añatuya', 'Frías', 'Loreto'],
  'Tierra del Fuego': ['Ushuaia', 'Río Grande', 'Tolhuin'],
  'Tucumán': ['San Miguel de Tucumán', 'Tafí Viejo', 'Yerba Buena', 'Banda del Río Salí', 'Concepción', 'Aguilares', 'Monteros', 'Famaillá'],
};

export const getCitiesForProvince = (province) => ARGENTINA_CITIES[province] || [];

export const getProvincesList = () => ARGENTINA_PROVINCES;

export const isValidProvince = (province) => ARGENTINA_PROVINCES.includes(province);
