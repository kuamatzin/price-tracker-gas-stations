import { governmentAPI, Estado } from "./governmentApi";

export class EstadosScraper {
  private estados: Estado[] = [];

  async fetchAll(): Promise<Estado[]> {
    try {
      console.log("Fetching all estados from government API...");
      this.estados = await governmentAPI.fetchEstados();

      if (this.estados.length !== 32) {
        console.warn(`Expected 32 estados, but got ${this.estados.length}`);
      }

      console.log(`Successfully fetched ${this.estados.length} estados`);
      return this.estados;
    } catch (error) {
      console.error("Failed to fetch estados:", error);
      throw new Error(`Failed to fetch estados: ${error}`);
    }
  }

  getEstados(): Estado[] {
    return this.estados;
  }

  getEstadoById(id: number): Estado | undefined {
    return this.estados.find((e) => e.EntidadFederativaId === id);
  }

  getEstadoByName(name: string): Estado | undefined {
    return this.estados.find(
      (e) => e.Nombre.toLowerCase() === name.toLowerCase(),
    );
  }

  getTotalCount(): number {
    return this.estados.length;
  }
}

export const estadosScraper = new EstadosScraper();
