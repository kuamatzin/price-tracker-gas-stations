import Papa from "papaparse";
import { FuelType } from "@fuelintel/shared";

interface ExportRow {
  "Número de Estación": string;
  Estación: string;
  Marca: string;
  Dirección: string;
  "Distancia (km)": number | string;
  Regular: number | string;
  Premium: number | string;
  Diésel: number | string;
  "Última Actualización": string;
}

interface StationExportData {
  numero: string;
  nombre: string;
  brand?: string;
  direccion: string;
  distance?: number;
  prices: {
    [key in FuelType]?: number;
  };
  lastUpdated?: string;
}

interface ExportOptions {
  stationNumero?: string;
  stationName?: string;
  includeFiltered?: boolean;
  timestamp?: Date;
}

/**
 * Formats station data for CSV export
 */
export const formatDataForExport = (
  stations: StationExportData[],
): ExportRow[] => {
  return stations.map((station) => ({
    "Número de Estación": station.numero,
    Estación: station.nombre,
    Marca: station.brand || "Sin marca",
    Dirección: station.direccion,
    "Distancia (km)": station.distance ? station.distance.toFixed(1) : "N/A",
    Regular: station.prices.regular
      ? `$${station.prices.regular.toFixed(2)}`
      : "N/A",
    Premium: station.prices.premium
      ? `$${station.prices.premium.toFixed(2)}`
      : "N/A",
    Diésel: station.prices.diesel
      ? `$${station.prices.diesel.toFixed(2)}`
      : "N/A",
    "Última Actualización": station.lastUpdated
      ? new Date(station.lastUpdated).toLocaleString("es-MX")
      : "N/A",
  }));
};

/**
 * Generates CSV filename with station context and timestamp
 */
export const generateFilename = (
  baseFilename: string,
  options?: ExportOptions,
): string => {
  const parts = [baseFilename];

  if (options?.stationNumero) {
    parts.push(options.stationNumero);
  }

  const timestamp = options?.timestamp || new Date();
  const dateStr = timestamp
    .toISOString()
    .slice(0, 19)
    .replace(/:/g, "-")
    .replace("T", "_");
  parts.push(dateStr);

  return `${parts.join("_")}.csv`;
};

/**
 * Main export function that generates and downloads CSV
 */
export const exportToCSV = (
  data: StationExportData[],
  filename: string = "precios_competidores",
  options?: ExportOptions,
): void => {
  // Format data for export
  const formattedData = formatDataForExport(data);

  // Add metadata as comments at the beginning if station context exists
  const metadata: string[] = [];

  if (options?.stationName) {
    metadata.push(`# Estación Seleccionada: ${options.stationName}`);
  }

  if (options?.stationNumero) {
    metadata.push(`# Número de Estación: ${options.stationNumero}`);
  }

  const timestamp = options?.timestamp || new Date();
  metadata.push(`# Fecha de Exportación: ${timestamp.toLocaleString("es-MX")}`);
  metadata.push(`# Total de Competidores: ${data.length}`);

  if (options?.includeFiltered) {
    metadata.push("# Datos filtrados incluidos");
  }

  // Generate CSV with Papa Parse
  const csv = Papa.unparse(formattedData, {
    header: true,
    delimiter: ",",
    quotes: true,
  });

  // Combine metadata and CSV data
  const finalContent =
    metadata.length > 0 ? metadata.join("\n") + "\n\n" + csv : csv;

  // Create blob and trigger download
  const blob = new Blob([finalContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = generateFilename(filename, options);
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

/**
 * Export current view data with loading state
 */
export const exportWithLoadingState = async (
  getData: () => Promise<StationExportData[]>,
  filename: string,
  options?: ExportOptions,
  onLoadingChange?: (loading: boolean) => void,
): Promise<void> => {
  try {
    onLoadingChange?.(true);

    // Fetch data
    const data = await getData();

    // Export data
    exportToCSV(data, filename, options);
  } catch (error) {
    console.error("Error exporting data:", error);
    throw new Error("Failed to export data to CSV");
  } finally {
    onLoadingChange?.(false);
  }
};

/**
 * Helper to prepare competitor data for export
 */
export const prepareCompetitorData = (
  competitors: StationExportData[],
): StationExportData[] => {
  return competitors.map((competitor) => ({
    numero: competitor.numero,
    nombre: competitor.nombre,
    brand: competitor.brand,
    direccion: competitor.direccion,
    distance: competitor.distance,
    prices: {
      regular: competitor.prices?.regular,
      premium: competitor.prices?.premium,
      diesel: competitor.prices?.diesel,
    },
    lastUpdated: competitor.lastUpdated,
  }));
};
