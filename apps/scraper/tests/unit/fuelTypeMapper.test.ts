import { FuelTypeMapper } from "../../src/utils/fuelTypeMapper";

describe("FuelTypeMapper", () => {
  describe("mapSubProductoToFuelType", () => {
    it("should map regular fuel types correctly", () => {
      expect(FuelTypeMapper.mapSubProductoToFuelType("Regular 87")).toBe(
        "regular",
      );
      expect(
        FuelTypeMapper.mapSubProductoToFuelType("Regular menos de 92 octanos"),
      ).toBe("regular");
      expect(FuelTypeMapper.mapSubProductoToFuelType("Regular")).toBe(
        "regular",
      );
      expect(FuelTypeMapper.mapSubProductoToFuelType("REGULAR")).toBe(
        "regular",
      );
    });

    it("should map premium fuel types correctly", () => {
      expect(FuelTypeMapper.mapSubProductoToFuelType("Premium 91")).toBe(
        "premium",
      );
      expect(
        FuelTypeMapper.mapSubProductoToFuelType("Premium 92 octanos"),
      ).toBe("premium");
      expect(FuelTypeMapper.mapSubProductoToFuelType("Premium")).toBe(
        "premium",
      );
      expect(FuelTypeMapper.mapSubProductoToFuelType("PREMIUM")).toBe(
        "premium",
      );
    });

    it("should map diesel fuel types correctly", () => {
      expect(FuelTypeMapper.mapSubProductoToFuelType("Diésel")).toBe("diesel");
      expect(FuelTypeMapper.mapSubProductoToFuelType("Diesel")).toBe("diesel");
      expect(FuelTypeMapper.mapSubProductoToFuelType("DIESEL")).toBe("diesel");
      expect(FuelTypeMapper.mapSubProductoToFuelType("DIÉSEL")).toBe("diesel");
    });

    it("should handle unknown fuel types", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      expect(
        FuelTypeMapper.mapSubProductoToFuelType("Unknown Fuel"),
      ).toBeNull();
      expect(FuelTypeMapper.mapSubProductoToFuelType("Gas Natural")).toBeNull();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown fuel type"),
      );
      consoleSpy.mockRestore();
    });

    it("should handle edge cases", () => {
      expect(FuelTypeMapper.mapSubProductoToFuelType("")).toBeNull();
      expect(FuelTypeMapper.mapSubProductoToFuelType(null as any)).toBeNull();
      expect(
        FuelTypeMapper.mapSubProductoToFuelType(undefined as any),
      ).toBeNull();
    });

    it("should trim whitespace", () => {
      expect(FuelTypeMapper.mapSubProductoToFuelType("  Regular  ")).toBe(
        "regular",
      );
      expect(FuelTypeMapper.mapSubProductoToFuelType("\tPremium\n")).toBe(
        "premium",
      );
      expect(FuelTypeMapper.mapSubProductoToFuelType(" Diesel ")).toBe(
        "diesel",
      );
    });
  });

  describe("isGasoline", () => {
    it("should identify gasoline products", () => {
      expect(FuelTypeMapper.isGasoline("Gasolina")).toBe(true);
      expect(FuelTypeMapper.isGasoline("GASOLINA")).toBe(true);
      expect(FuelTypeMapper.isGasoline("gasolina")).toBe(true);
      expect(FuelTypeMapper.isGasoline("Gasolina Regular")).toBe(true);
    });

    it("should reject non-gasoline products", () => {
      expect(FuelTypeMapper.isGasoline("Diesel")).toBe(false);
      expect(FuelTypeMapper.isGasoline("Diésel")).toBe(false);
      expect(FuelTypeMapper.isGasoline("")).toBe(false);
    });
  });

  describe("isDiesel", () => {
    it("should identify diesel products", () => {
      expect(FuelTypeMapper.isDiesel("Diesel")).toBe(true);
      expect(FuelTypeMapper.isDiesel("Diésel")).toBe(true);
      expect(FuelTypeMapper.isDiesel("DIESEL")).toBe(true);
      expect(FuelTypeMapper.isDiesel("DIÉSEL")).toBe(true);
    });

    it("should reject non-diesel products", () => {
      expect(FuelTypeMapper.isDiesel("Gasolina")).toBe(false);
      expect(FuelTypeMapper.isDiesel("Regular")).toBe(false);
      expect(FuelTypeMapper.isDiesel("")).toBe(false);
    });
  });

  describe("validateFuelType", () => {
    it("should validate correct fuel types", () => {
      expect(FuelTypeMapper.validateFuelType("regular")).toBe(true);
      expect(FuelTypeMapper.validateFuelType("premium")).toBe(true);
      expect(FuelTypeMapper.validateFuelType("diesel")).toBe(true);
    });

    it("should reject invalid fuel types", () => {
      expect(FuelTypeMapper.validateFuelType("REGULAR")).toBe(false);
      expect(FuelTypeMapper.validateFuelType("gasoline")).toBe(false);
      expect(FuelTypeMapper.validateFuelType("")).toBe(false);
      expect(FuelTypeMapper.validateFuelType("unknown")).toBe(false);
    });
  });
});
