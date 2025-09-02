export interface ExportableStation {
  numero: string;
  nombre: string;
  brand?: string;
  direccion: string;
  distance?: number;
  regular?: number;
  premium?: number;
  diesel?: number;
  lastUpdated: string;
}

export interface CSVExportOptions {
  filename?: string;
  includeTimestamp?: boolean;
  columns?: Array<keyof ExportableStation | "all">;
  dateFormat?: "iso" | "local" | "date-only";
}

const defaultColumns: Array<keyof ExportableStation> = [
  "nombre",
  "brand",
  "direccion",
  "distance",
  "regular",
  "premium",
  "diesel",
  "lastUpdated",
];

const columnHeaders: Record<keyof ExportableStation, string> = {
  numero: "ID Estación",
  nombre: "Nombre de la Estación",
  brand: "Marca",
  direccion: "Dirección",
  distance: "Distancia (km)",
  regular: "Gasolina Regular (MXN)",
  premium: "Gasolina Premium (MXN)",
  diesel: "Diesel (MXN)",
  lastUpdated: "Última Actualización",
};

/**
 * Format a value for CSV export
 */
const formatValue = (
  value: unknown,
  key: keyof ExportableStation,
  dateFormat: CSVExportOptions["dateFormat"] = "local",
): string => {
  if (value === null || value === undefined) {
    return "";
  }

  // Handle date formatting
  if (key === "lastUpdated" && typeof value === "string") {
    try {
      const date = new Date(value);
      switch (dateFormat) {
        case "iso":
          return date.toISOString();
        case "date-only":
          return date.toLocaleDateString("es-MX");
        case "local":
        default:
          return date.toLocaleString("es-MX");
      }
    } catch {
      return String(value);
    }
  }

  // Handle price formatting
  if (
    ["regular", "premium", "diesel"].includes(key) &&
    typeof value === "number"
  ) {
    return value.toFixed(2);
  }

  // Handle distance formatting
  if (key === "distance" && typeof value === "number") {
    return value.toFixed(1);
  }

  return String(value);
};

/**
 * Escape CSV values that contain special characters
 */
const escapeCSV = (value: string): string => {
  // If value contains comma, newline, or quote, wrap in quotes and escape quotes
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

/**
 * Generate CSV content from station data
 */
const generateCSVContent = (
  stations: ExportableStation[],
  options: CSVExportOptions = {},
): string => {
  const { columns = defaultColumns, dateFormat = "local" } = options;

  // Determine which columns to include
  const columnsToExport = columns.includes("all")
    ? defaultColumns
    : (columns as Array<keyof ExportableStation>);

  // Create header row
  const headers = columnsToExport.map((col) => columnHeaders[col]);
  const csvRows = [headers.map(escapeCSV).join(",")];

  // Create data rows
  stations.forEach((station) => {
    const row = columnsToExport.map((col) => {
      const value = formatValue(station[col], col, dateFormat);
      return escapeCSV(value);
    });
    csvRows.push(row.join(","));
  });

  return csvRows.join("\n");
};

/**
 * Generate filename with timestamp
 */
const generateFilename = (
  baseFilename: string = "estaciones_competencia",
  includeTimestamp: boolean = true,
): string => {
  if (!includeTimestamp) {
    return `${baseFilename}.csv`;
  }

  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
  return `${baseFilename}_${timestamp}.csv`;
};

/**
 * Trigger browser download of CSV file
 */
const downloadCSV = (content: string, filename: string): void => {
  // Add BOM for proper UTF-8 handling in Excel
  const BOM = "\uFEFF";
  const csvContent = BOM + content;

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
};

/**
 * Main export function - generates and downloads CSV file
 */
export const exportStationsToCSV = (
  stations: ExportableStation[],
  options: CSVExportOptions = {},
): Promise<{ success: boolean; message: string; recordCount: number }> => {
  return new Promise((resolve) => {
    try {
      if (!stations.length) {
        resolve({
          success: false,
          message: "No hay datos para exportar",
          recordCount: 0,
        });
        return;
      }

      const { filename: baseFilename, includeTimestamp = true } = options;

      const csvContent = generateCSVContent(stations, options);
      const filename = generateFilename(baseFilename, includeTimestamp);

      downloadCSV(csvContent, filename);

      resolve({
        success: true,
        message: `Exportación exitosa: ${stations.length} estaciones exportadas como ${filename}`,
        recordCount: stations.length,
      });
    } catch (error) {
      resolve({
        success: false,
        message: `Error en la exportación: ${error instanceof Error ? error.message : "Error desconocido"}`,
        recordCount: 0,
      });
    }
  });
};

/**
 * Export only filtered/visible stations
 */
export const exportFilteredStations = (
  allStations: ExportableStation[],
  filters: {
    fuelType?: "all" | "regular" | "premium" | "diesel";
    brands?: string[];
    maxDistance?: number;
    minPrice?: number;
    maxPrice?: number;
  } = {},
  options: CSVExportOptions = {},
): Promise<{ success: boolean; message: string; recordCount: number }> => {
  const filteredStations = allStations.filter((station) => {
    // Filter by fuel type availability
    if (filters.fuelType && filters.fuelType !== "all") {
      const price = station[filters.fuelType];
      if (!price || price <= 0) return false;
    }

    // Filter by brands
    if (filters.brands && filters.brands.length > 0) {
      if (!station.brand || !filters.brands.includes(station.brand)) {
        return false;
      }
    }

    // Filter by distance
    if (filters.maxDistance && station.distance) {
      if (station.distance > filters.maxDistance) return false;
    }

    // Filter by price range (using regular as default)
    const priceToCheck = station.regular || station.premium || station.diesel;
    if (filters.minPrice && priceToCheck && priceToCheck < filters.minPrice) {
      return false;
    }
    if (filters.maxPrice && priceToCheck && priceToCheck > filters.maxPrice) {
      return false;
    }

    return true;
  });

  return exportStationsToCSV(filteredStations, options);
};

/**
 * Generate preview of CSV content (first few rows)
 */
export const generateCSVPreview = (
  stations: ExportableStation[],
  options: CSVExportOptions = {},
  previewRows: number = 5,
): { headers: string[]; rows: string[][]; totalRows: number } => {
  const { columns = defaultColumns, dateFormat = "local" } = options;

  const columnsToExport = columns.includes("all")
    ? defaultColumns
    : (columns as Array<keyof ExportableStation>);
  const headers = columnsToExport.map((col) => columnHeaders[col]);

  const previewStations = stations.slice(0, previewRows);
  const rows = previewStations.map((station) => {
    return columnsToExport.map((col) => {
      return formatValue(station[col], col, dateFormat);
    });
  });

  return {
    headers,
    rows,
    totalRows: stations.length,
  };
};

/**
 * Validate data before export
 */
export const validateExportData = (
  stations: ExportableStation[],
): { isValid: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(stations)) {
    errors.push("Los datos deben ser un arreglo de estaciones");
  } else if (stations.length === 0) {
    warnings.push("No hay estaciones para exportar");
  } else {
    // Check for required fields
    stations.forEach((station, index) => {
      if (!station.nombre || typeof station.nombre !== "string") {
        errors.push(`Estación ${index + 1}: Falta el nombre`);
      }

      if (!station.numero || typeof station.numero !== "string") {
        errors.push(`Estación ${index + 1}: Falta el ID de estación`);
      }

      // Check if at least one price is available
      const hasPrices = Boolean(
        station.regular || station.premium || station.diesel,
      );
      if (!hasPrices) {
        warnings.push(
          `Estación ${index + 1} (${station.nombre}): No tiene precios`,
        );
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

export default {
  exportStationsToCSV,
  exportFilteredStations,
  generateCSVPreview,
  validateExportData,
};
