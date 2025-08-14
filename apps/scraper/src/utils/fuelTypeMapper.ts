export type FuelType = "regular" | "premium" | "diesel";

export class FuelTypeMapper {
  private static regularPatterns = [
    /Regular.*87/i,
    /Regular.*menos.*92/i,
    /Regular/i,
  ];

  private static premiumPatterns = [/Premium.*91/i, /Premium.*92/i, /Premium/i];

  private static dieselPatterns = [/Di[eé]sel/i, /Diesel/i];

  static mapSubProductoToFuelType(subProducto: string): FuelType | null {
    if (!subProducto) {
      return null;
    }

    const normalized = subProducto.trim();

    for (const pattern of this.regularPatterns) {
      if (pattern.test(normalized)) {
        return "regular";
      }
    }

    for (const pattern of this.premiumPatterns) {
      if (pattern.test(normalized)) {
        return "premium";
      }
    }

    for (const pattern of this.dieselPatterns) {
      if (pattern.test(normalized)) {
        return "diesel";
      }
    }

    console.warn(`Unknown fuel type for SubProducto: "${subProducto}"`);
    return null;
  }

  static isGasoline(producto: string): boolean {
    return /Gasolina/i.test(producto);
  }

  static isDiesel(producto: string): boolean {
    return /Di[eé]sel/i.test(producto);
  }

  static validateFuelType(fuelType: string): fuelType is FuelType {
    return ["regular", "premium", "diesel"].includes(fuelType);
  }
}
