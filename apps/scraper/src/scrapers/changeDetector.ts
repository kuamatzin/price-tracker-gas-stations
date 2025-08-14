import {
  getAllLastPrices,
  LastPrice,
  PriceChange,
  Station,
} from "../db/queries";
import { ParsedStation, ParsedPrice } from "./dataParser";

export interface ChangeDetectionResult {
  newStations: Station[];
  updatedStations: Station[];
  priceChanges: PriceChange[];
  unchangedPrices: number;
  newPrices: number;
  stats: {
    totalStationsProcessed: number;
    newStationsFound: number;
    updatedStationsFound: number;
    priceChangesDetected: number;
    newPricesAdded: number;
    unchangedPricesSkipped: number;
  };
}

export class ChangeDetector {
  private lastPricesMap: Map<string, LastPrice> = new Map();
  private existingStations: Set<string> = new Set();

  async loadExistingData(): Promise<void> {
    try {
      console.log("Loading existing price data from database...");
      this.lastPricesMap = await getAllLastPrices();

      for (const [key] of this.lastPricesMap) {
        const stationNumero = key.split(":")[0];
        this.existingStations.add(stationNumero);
      }

      console.log(
        `Loaded ${this.lastPricesMap.size} existing prices for ${this.existingStations.size} stations`,
      );
    } catch (error) {
      console.error("Failed to load existing data:", error);
      throw error;
    }
  }

  detectChanges(parsedStations: ParsedStation[]): ChangeDetectionResult {
    const newStations: Station[] = [];
    const updatedStations: Station[] = [];
    const priceChanges: PriceChange[] = [];
    let unchangedPrices = 0;
    let newPrices = 0;

    for (const parsedStation of parsedStations) {
      const isNewStation = !this.existingStations.has(
        parsedStation.station.numero,
      );

      if (isNewStation) {
        newStations.push(parsedStation.station);
      } else {
        updatedStations.push(parsedStation.station);
      }

      for (const price of parsedStation.prices) {
        const key = `${price.station_numero}:${price.fuel_type}`;
        const lastPrice = this.lastPricesMap.get(key);

        if (!lastPrice) {
          newPrices++;
          priceChanges.push({
            station_numero: price.station_numero,
            fuel_type: price.fuel_type,
            subproducto: price.subproducto,
            price: price.price,
            changed_at: new Date(),
          });
        } else if (Math.abs(lastPrice.price - price.price) > 0.001) {
          priceChanges.push({
            station_numero: price.station_numero,
            fuel_type: price.fuel_type,
            subproducto: price.subproducto,
            price: price.price,
            changed_at: new Date(),
          });
        } else {
          unchangedPrices++;
        }
      }
    }

    const stats = {
      totalStationsProcessed: parsedStations.length,
      newStationsFound: newStations.length,
      updatedStationsFound: updatedStations.length,
      priceChangesDetected: priceChanges.length,
      newPricesAdded: newPrices,
      unchangedPricesSkipped: unchangedPrices,
    };

    console.log("Change detection results:", stats);

    return {
      newStations,
      updatedStations,
      priceChanges,
      unchangedPrices,
      newPrices,
      stats,
    };
  }

  hasExistingPrice(stationNumero: string, fuelType: string): boolean {
    const key = `${stationNumero}:${fuelType}`;
    return this.lastPricesMap.has(key);
  }

  getLastPrice(stationNumero: string, fuelType: string): LastPrice | undefined {
    const key = `${stationNumero}:${fuelType}`;
    return this.lastPricesMap.get(key);
  }

  isNewStation(stationNumero: string): boolean {
    return !this.existingStations.has(stationNumero);
  }

  isPriceChanged(parsedPrice: ParsedPrice): boolean {
    const key = `${parsedPrice.station_numero}:${parsedPrice.fuel_type}`;
    const lastPrice = this.lastPricesMap.get(key);

    if (!lastPrice) {
      return true;
    }

    return Math.abs(lastPrice.price - parsedPrice.price) > 0.001;
  }

  reset(): void {
    this.lastPricesMap.clear();
    this.existingStations.clear();
  }
}

export const changeDetector = new ChangeDetector();
