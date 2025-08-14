import { governmentAPI, Municipio } from "./governmentApi";

export interface MunicipioWithEstado extends Municipio {
  estadoId: number;
}

export class MunicipiosScraper {
  private municipios: Map<number, Municipio[]> = new Map();
  private totalMunicipios = 0;

  async fetchForEstado(estadoId: number): Promise<Municipio[]> {
    try {
      console.log(`Fetching municipios for estado ${estadoId}...`);
      const municipios = await governmentAPI.fetchMunicipios(estadoId);

      this.municipios.set(estadoId, municipios);
      this.totalMunicipios += municipios.length;

      console.log(
        `Fetched ${municipios.length} municipios for estado ${estadoId}`,
      );
      return municipios;
    } catch (error) {
      console.error(
        `Failed to fetch municipios for estado ${estadoId}:`,
        error,
      );
      this.municipios.set(estadoId, []);
      throw error;
    }
  }

  async fetchAllForEstados(
    estadoIds: number[],
  ): Promise<Map<number, Municipio[]>> {
    const results = new Map<number, Municipio[]>();
    const errors: Array<{ estadoId: number; error: any }> = [];

    for (const estadoId of estadoIds) {
      try {
        const municipios = await this.fetchForEstado(estadoId);
        results.set(estadoId, municipios);
      } catch (error) {
        errors.push({ estadoId, error });
        results.set(estadoId, []);
      }
    }

    if (errors.length > 0) {
      console.warn(
        `Failed to fetch municipios for ${errors.length} estados:`,
        errors,
      );
    }

    console.log(`Total municipios fetched: ${this.totalMunicipios}`);
    return results;
  }

  getMunicipiosForEstado(estadoId: number): Municipio[] {
    return this.municipios.get(estadoId) || [];
  }

  getAllMunicipios(): MunicipioWithEstado[] {
    const allMunicipios: MunicipioWithEstado[] = [];

    for (const [estadoId, municipios] of this.municipios.entries()) {
      for (const municipio of municipios) {
        allMunicipios.push({
          ...municipio,
          estadoId,
        });
      }
    }

    return allMunicipios;
  }

  getTotalCount(): number {
    return this.totalMunicipios;
  }

  getEstadosWithMunicipios(): number[] {
    return Array.from(this.municipios.keys());
  }

  getStats() {
    return {
      totalEstadosProcessed: this.municipios.size,
      totalMunicipios: this.totalMunicipios,
      estadosWithNoMunicipios: Array.from(this.municipios.entries())
        .filter(([, municipios]) => municipios.length === 0)
        .map(([estadoId]) => estadoId),
    };
  }
}

export const municipiosScraper = new MunicipiosScraper();
