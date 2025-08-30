export const testUsers = {
  validUser: {
    email: "test@fuelintel.mx",
    password: "Test123!@#",
  },
  invalidUser: {
    email: "invalid@fuelintel.mx",
    password: "wrongpassword",
  },
  adminUser: {
    email: "admin@fuelintel.mx",
    password: "Admin123!@#",
  },
};

export const testStations = {
  station1: {
    id: "1",
    name: "Pemex Centro",
    brand: "PEMEX",
    location: {
      lat: 19.4326,
      lng: -99.1332,
    },
    prices: {
      regular: 22.59,
      premium: 24.89,
      diesel: 24.19,
    },
  },
  station2: {
    id: "2",
    name: "Shell Norte",
    brand: "SHELL",
    location: {
      lat: 19.4426,
      lng: -99.1432,
    },
    prices: {
      regular: 22.79,
      premium: 25.09,
      diesel: 24.39,
    },
  },
};

export const testAlerts = {
  priceDropAlert: {
    name: "Price Drop Alert",
    type: "price_drop",
    threshold: 0.5,
    stations: ["1", "2"],
    fuelType: "regular",
  },
  priceIncreaseAlert: {
    name: "Price Increase Alert",
    type: "price_increase",
    threshold: 1.0,
    stations: ["1"],
    fuelType: "diesel",
  },
};
