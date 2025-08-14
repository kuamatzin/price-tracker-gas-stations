import { httpClient } from "../utils/httpClient";
import config from "../config";

export interface Estado {
  EntidadFederativaId: number;
  Nombre: string;
  Abreviacion?: string;
}

export interface Municipio {
  MunicipioId: number;
  EntidadFederativaId: number;
  Nombre: string;
}

export interface StationPrice {
  Numero: string;
  Nombre: string;
  Direccion: string;
  Latitud?: number;
  Longitud?: number;
  Producto: string;
  SubProducto: string;
  PrecioVigente: number;
}

export interface APIErrorResponse {
  error?: string;
  message?: string;
}

export class GovernmentAPIClient {
  private catalogBase: string;
  private pricingBase: string;

  constructor() {
    this.catalogBase = config.api.catalogBase;
    this.pricingBase = config.api.pricingBase;
  }

  async fetchEstados(): Promise<Estado[]> {
    try {
      const url = `${this.catalogBase}/entidadesfederativas`;
      const response = await httpClient.get<Estado[] | APIErrorResponse>(url);

      if (Array.isArray(response)) {
        console.log(`Fetched ${response.length} estados`);
        return response;
      } else {
        throw new Error(`API Error: ${JSON.stringify(response)}`);
      }
    } catch (error) {
      console.error("Error fetching estados:", error);
      throw error;
    }
  }

  async fetchMunicipios(entidadId: number): Promise<Municipio[]> {
    try {
      const url = `${this.catalogBase}/municipios?EntidadFederativaId=${entidadId}`;
      const response = await httpClient.get<Municipio[] | APIErrorResponse>(
        url,
      );

      if (Array.isArray(response)) {
        console.log(
          `Fetched ${response.length} municipios for estado ${entidadId}`,
        );
        return response;
      } else {
        throw new Error(`API Error: ${JSON.stringify(response)}`);
      }
    } catch (error) {
      console.error(
        `Error fetching municipios for estado ${entidadId}:`,
        error,
      );
      throw error;
    }
  }

  async fetchStationPrices(
    entidadId: number,
    municipioId: number,
  ): Promise<StationPrice[]> {
    try {
      const url = `${this.pricingBase}/Petroliferos?entidadId=${entidadId}&municipioId=${municipioId}`;
      const response = await httpClient.get<StationPrice[] | APIErrorResponse>(
        url,
      );

      if (Array.isArray(response)) {
        console.log(
          `Fetched ${response.length} station prices for municipio ${municipioId}`,
        );
        return response;
      } else if (
        response &&
        typeof response === "object" &&
        "error" in response
      ) {
        console.warn(`No data for municipio ${municipioId}: ${response.error}`);
        return [];
      } else {
        console.warn(
          `Unexpected response for municipio ${municipioId}:`,
          response,
        );
        return [];
      }
    } catch (error) {
      console.error(
        `Error fetching prices for municipio ${municipioId}:`,
        error,
      );
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const estados = await this.fetchEstados();
      return estados.length > 0;
    } catch (error) {
      console.error("Government API connection test failed:", error);
      return false;
    }
  }
}

export const governmentAPI = new GovernmentAPIClient();
