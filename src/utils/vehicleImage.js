// Una imagen por tipo de vehículo. Compartido entre VehiclePickerScreen y
// VehicleOptionCard para que ambos flujos de selección se vean igual.
const VEHICLE_IMAGES = {
  sedan: require('../../assets/icons/pngwing.com (4).png'),
  hatchback: require('../../assets/icons/pngwing.com (4).png'),
  suv: require('../../assets/icons/pngwing.com (3).png'),
  // Camioneta propia. Antes reusaban la imagen de la SUV, así que elegir "Camioneta" no
  // cambiaba nada en pantalla y los tres tipos se veían igual.
  pickup: require('../../assets/icons/camioneta.png'),
  van: require('../../assets/icons/camioneta.png'),
  otro: require('../../assets/icons/pngwing.com (4).png'),
};

export const imageForType = (type) => VEHICLE_IMAGES[type] || VEHICLE_IMAGES.sedan;

export default imageForType;
