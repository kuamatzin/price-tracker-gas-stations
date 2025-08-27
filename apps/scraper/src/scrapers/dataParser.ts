import { StationPrice } from "./governmentApi";
import { Station, PriceChange } from "../db/queries";
import { FuelTypeMapper, FuelType } from "../utils/fuelTypeMapper";

export interface ParsedStation {
  station: Station;
  prices: ParsedPrice[];
}

export interface ParsedPrice {
  station_numero: string;
  fuel_type: FuelType;
  subproducto: string;
  price: number;
  producto: string;
}

export class DataParser {
  static parseStationData(
    stationPrice: StationPrice,
    estadoId: number,
    municipioId: number,
  ): ParsedStation | null {
    try {
      // Create composite municipio ID: estadoId * 1000 + municipioId
      // Ensure municipioId is a number (it might come as a string from the API)
      const compositeMunicipioId = estadoId * 1000 + Number(municipioId);

      const station: Station = {
        numero: stationPrice.Numero,
        nombre: stationPrice.Nombre || "",
        direccion: stationPrice.Direccion || "",
        lat: stationPrice.Latitud || undefined,
        lng: stationPrice.Longitud || undefined,
        entidad_id: estadoId,
        municipio_id: compositeMunicipioId,
        is_active: true,
      };

      const prices: ParsedPrice[] = [];

      const fuelType = FuelTypeMapper.mapSubProductoToFuelType(
        stationPrice.SubProducto,
      );

      if (fuelType && stationPrice.PrecioVigente > 0) {
        prices.push({
          station_numero: stationPrice.Numero,
          fuel_type: fuelType,
          subproducto: stationPrice.SubProducto,
          price: parseFloat(stationPrice.PrecioVigente.toFixed(2)),
          producto: stationPrice.Producto,
        });
      }

      return {
        station,
        prices,
      };
    } catch (error) {
      console.error(
        `Error parsing station data for ${stationPrice.Numero}:`,
        error,
      );
      return null;
    }
  }

  static parseStationPrices(
    stationPrices: StationPrice[],
    estadoId: number,
    municipioId: number,
  ): ParsedStation[] {
    // Create composite municipio ID: estadoId * 1000 + municipioId
    // Ensure municipioId is a number (it might come as a string from the API)
    const compositeMunicipioId = estadoId * 1000 + Number(municipioId);
    const stationMap = new Map<string, ParsedStation>();

    for (const stationPrice of stationPrices) {
      const stationNumero = stationPrice.Numero;

      if (!stationMap.has(stationNumero)) {
        const parsed = this.parseStationData(
          stationPrice,
          estadoId,
          municipioId,
        );
        if (parsed) {
          stationMap.set(stationNumero, parsed);
        }
      } else {
        const existing = stationMap.get(stationNumero)!;
        const fuelType = FuelTypeMapper.mapSubProductoToFuelType(
          stationPrice.SubProducto,
        );

        if (fuelType && stationPrice.PrecioVigente > 0) {
          const alreadyHasFuelType = existing.prices.some(
            (p) => p.fuel_type === fuelType,
          );

          if (!alreadyHasFuelType) {
            existing.prices.push({
              station_numero: stationPrice.Numero,
              fuel_type: fuelType,
              subproducto: stationPrice.SubProducto,
              price: parseFloat(stationPrice.PrecioVigente.toFixed(2)),
              producto: stationPrice.Producto,
            });
          }
        }
      }
    }

    return Array.from(stationMap.values());
  }

  static createPriceChange(
    parsedPrice: ParsedPrice,
    changedAt: Date = new Date(),
  ): PriceChange {
    return {
      station_numero: parsedPrice.station_numero,
      fuel_type: parsedPrice.fuel_type,
      subproducto: parsedPrice.subproducto,
      price: parsedPrice.price,
      changed_at: changedAt,
    };
  }

  static validateStation(station: Station): boolean {
    if (!station.numero || station.numero.trim() === "") {
      return false;
    }

    if (!station.nombre || station.nombre.trim() === "") {
      return false;
    }

    if (!station.entidad_id || station.entidad_id <= 0) {
      return false;
    }

    if (!station.municipio_id || station.municipio_id <= 0) {
      return false;
    }

    if (station.lat !== undefined && (station.lat < -90 || station.lat > 90)) {
      return false;
    }

    if (
      station.lng !== undefined &&
      (station.lng < -180 || station.lng > 180)
    ) {
      return false;
    }

    return true;
  }

  static validatePrice(price: ParsedPrice): boolean {
    if (!price.station_numero || price.station_numero.trim() === "") {
      return false;
    }

    if (!FuelTypeMapper.validateFuelType(price.fuel_type)) {
      return false;
    }

    if (price.price <= 0 || price.price > 100) {
      console.warn(
        `Invalid price ${price.price} for station ${price.station_numero}`,
      );
      return false;
    }

    return true;
  }

  static getStats(parsedStations: ParsedStation[]) {
    const totalStations = parsedStations.length;
    let totalPrices = 0;
    const fuelTypeCounts = { regular: 0, premium: 0, diesel: 0 };

    for (const station of parsedStations) {
      totalPrices += station.prices.length;
      for (const price of station.prices) {
        fuelTypeCounts[price.fuel_type]++;
      }
    }

    return {
      totalStations,
      totalPrices,
      fuelTypeCounts,
      averagePricesPerStation:
        totalStations > 0 ? totalPrices / totalStations : 0,
    };
  }
}

export const dataParser = new DataParser();
