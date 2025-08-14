import { governmentAPI, StationPrice } from "./governmentApi";

export interface PriceScraperResult {
  municipioId: number;
  estadoId: number;
  stations: StationPrice[];
  success: boolean;
  error?: string;
}

export class PricesScraper {
  private results: PriceScraperResult[] = [];
  private totalStations = 0;
  private totalPrices = 0;
  private failedMunicipios: Array<{
    estadoId: number;
    municipioId: number;
    error: any;
  }> = [];

  async fetchForMunicipio(
    estadoId: number,
    municipioId: number,
  ): Promise<StationPrice[]> {
    try {
      console.log(
        `Fetching prices for municipio ${municipioId} in estado ${estadoId}...`,
      );
      const stations = await governmentAPI.fetchStationPrices(
        estadoId,
        municipioId,
      );

      this.results.push({
        municipioId,
        estadoId,
        stations,
        success: true,
      });

      if (stations.length > 0) {
        this.totalStations += stations.length;
        this.totalPrices += stations.length;
        console.log(
          `Found ${stations.length} stations in municipio ${municipioId}`,
        );
      }

      return stations;
    } catch (error) {
      console.error(
        `Failed to fetch prices for municipio ${municipioId}:`,
        error,
      );

      this.failedMunicipios.push({
        estadoId,
        municipioId,
        error,
      });

      this.results.push({
        municipioId,
        estadoId,
        stations: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  async fetchForMunicipios(
    municipios: Array<{ estadoId: number; municipioId: number }>,
  ): Promise<PriceScraperResult[]> {
    const results: PriceScraperResult[] = [];

    for (const { estadoId, municipioId } of municipios) {
      try {
        const stations = await this.fetchForMunicipio(estadoId, municipioId);
        results.push({
          municipioId,
          estadoId,
          stations,
          success: true,
        });
      } catch (error) {
        results.push({
          municipioId,
          estadoId,
          stations: [],
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (results.length % 100 === 0) {
        console.log(
          `Progress: ${results.length}/${municipios.length} municipios processed`,
        );
      }
    }

    return results;
  }

  getAllStations(): StationPrice[] {
    const allStations: StationPrice[] = [];

    for (const result of this.results) {
      if (result.success && result.stations) {
        allStations.push(...result.stations);
      }
    }

    return allStations;
  }

  getStationsForMunicipio(municipioId: number): StationPrice[] {
    const result = this.results.find((r) => r.municipioId === municipioId);
    return result?.stations || [];
  }

  getFailedMunicipios() {
    return this.failedMunicipios;
  }

  getStats() {
    const successfulMunicipios = this.results.filter((r) => r.success).length;
    const failedMunicipios = this.results.filter((r) => !r.success).length;
    const municipiosWithStations = this.results.filter(
      (r) => r.success && r.stations.length > 0,
    ).length;

    return {
      totalMunicipiosProcessed: this.results.length,
      successfulMunicipios,
      failedMunicipios,
      municipiosWithStations,
      municipiosWithoutStations: successfulMunicipios - municipiosWithStations,
      totalStations: this.totalStations,
      totalPrices: this.totalPrices,
      averageStationsPerMunicipio:
        municipiosWithStations > 0
          ? Math.round(this.totalStations / municipiosWithStations)
          : 0,
    };
  }

  reset() {
    this.results = [];
    this.totalStations = 0;
    this.totalPrices = 0;
    this.failedMunicipios = [];
  }
}

export const pricesScraper = new PricesScraper();
