// Una imagen por tipo de vehículo. Compartido entre VehiclePickerScreen y
// VehicleOptionCard para que ambos flujos de selección se vean igual.
const VEHICLE_IMAGES = {
  sedan: require('../../assets/icons/pngwing.com (4).png'),
  hatchback: require('../../assets/icons/pngwing.com (4).png'),
  suv: require('../../assets/icons/pngwing.com (3).png'),
  pickup: require('../../assets/icons/pngwing.com (3).png'),
  van: require('../../assets/icons/pngwing.com (3).png'),
  otro: require('../../assets/icons/pngwing.com (4).png'),
};

export const imageForType = (type) => VEHICLE_IMAGES[type] || VEHICLE_IMAGES.sedan;

export default imageForType;
