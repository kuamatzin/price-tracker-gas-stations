import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  exportStationsToCSV,
  exportFilteredStations,
  generateCSVPreview,
  validateExportData,
  type ExportableStation,
} from '../csvExport';

// Mock the DOM methods used for file download
const mockCreateElement = vi.fn();
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

beforeEach(() => {
  // Mock document.createElement
  const mockLink = {
    setAttribute: vi.fn(),
    click: mockClick,
    style: { visibility: '' },
  };
  mockCreateElement.mockReturnValue(mockLink);
  vi.stubGlobal('document', {
    createElement: mockCreateElement,
    body: {
      appendChild: mockAppendChild,
      removeChild: mockRemoveChild,
    },
  });

  // Mock URL methods
  mockCreateObjectURL.mockReturnValue('blob:mock-url');
  vi.stubGlobal('URL', {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  });

  // Mock Blob
  vi.stubGlobal('Blob', vi.fn().mockImplementation((content, options) => ({
    content,
    options,
  })));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('csvExport', () => {
  const mockStations: ExportableStation[] = [
    {
      numero: '001',
      nombre: 'Estación Centro',
      brand: 'Pemex',
      direccion: 'Av. Principal 123',
      distance: 1.5,
      regular: 22.50,
      premium: 24.80,
      diesel: 23.20,
      lastUpdated: '2024-01-01T12:00:00Z',
    },
    {
      numero: '002',
      nombre: 'Estación Norte',
      brand: 'Shell',
      direccion: 'Calle Norte 456',
      distance: 3.2,
      regular: 22.80,
      premium: 25.10,
      diesel: 23.50,
      lastUpdated: '2024-01-01T13:00:00Z',
    },
    {
      numero: '003',
      nombre: 'Estación Sur',
      direccion: 'Blvd. Sur 789',
      distance: 2.1,
      regular: 22.20,
      premium: 24.50,
      diesel: 22.90,
      lastUpdated: '2024-01-01T14:00:00Z',
    },
  ];

  describe('exportStationsToCSV', () => {
    it('should export stations successfully', async () => {
      const result = await exportStationsToCSV(mockStations);
      
      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(3);
      expect(result.message).toContain('3 estaciones exportadas');
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockClick).toHaveBeenCalled();
    });

    it('should handle empty station array', async () => {
      const result = await exportStationsToCSV([]);
      
      expect(result.success).toBe(false);
      expect(result.recordCount).toBe(0);
      expect(result.message).toBe('No hay datos para exportar');
    });

    it('should use custom filename with timestamp', async () => {
      const options = {
        filename: 'custom_export',
        includeTimestamp: true,
      };
      
      const result = await exportStationsToCSV(mockStations, options);
      expect(result.success).toBe(true);
      expect(result.message).toContain('custom_export');
    });

    it('should use filename without timestamp when specified', async () => {
      const options = {
        filename: 'no_timestamp',
        includeTimestamp: false,
      };
      
      const result = await exportStationsToCSV(mockStations, options);
      expect(result.success).toBe(true);
    });

    it('should handle export errors gracefully', async () => {
      // Mock Blob to throw an error
      vi.stubGlobal('Blob', vi.fn().mockImplementation(() => {
        throw new Error('Blob creation failed');
      }));

      const result = await exportStationsToCSV(mockStations);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Error en la exportación');
    });
  });

  describe('exportFilteredStations', () => {
    it('should filter by fuel type', async () => {
      const filters = { fuelType: 'regular' as const };
      const result = await exportFilteredStations(mockStations, filters);
      
      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(3); // All stations have regular fuel
    });

    it('should filter by brands', async () => {
      const filters = { brands: ['Pemex'] };
      const result = await exportFilteredStations(mockStations, filters);
      
      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(1); // Only one Pemex station
    });

    it('should filter by distance', async () => {
      const filters = { maxDistance: 2.0 };
      const result = await exportFilteredStations(mockStations, filters);
      
      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(1); // Only stations within 2km
    });

    it('should filter by price range', async () => {
      const filters = { minPrice: 22.30, maxPrice: 22.70 };
      const result = await exportFilteredStations(mockStations, filters);
      
      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(1); // Only stations within price range
    });

    it('should combine multiple filters', async () => {
      const filters = {
        brands: ['Pemex', 'Shell'],
        maxDistance: 4.0,
        minPrice: 22.00,
      };
      const result = await exportFilteredStations(mockStations, filters);
      
      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(2); // Pemex and Shell stations within criteria
    });
  });

  describe('generateCSVPreview', () => {
    it('should generate correct preview', () => {
      const preview = generateCSVPreview(mockStations, {}, 2);
      
      expect(preview.headers).toContain('Nombre de la Estación');
      expect(preview.headers).toContain('Marca');
      expect(preview.headers).toContain('Gasolina Regular (MXN)');
      expect(preview.rows).toHaveLength(2);
      expect(preview.totalRows).toBe(3);
    });

    it('should format values correctly in preview', () => {
      const preview = generateCSVPreview(mockStations, { dateFormat: 'date-only' }, 1);
      
      expect(preview.rows[0]).toContain('Estación Centro');
      expect(preview.rows[0]).toContain('22.50'); // Price formatted
      expect(preview.rows[0]).toContain('1.5'); // Distance formatted
    });

    it('should handle custom columns', () => {
      const options = {
        columns: ['nombre', 'regular'] as const,
      };
      const preview = generateCSVPreview(mockStations, options, 1);
      
      expect(preview.headers).toHaveLength(2);
      expect(preview.headers).toContain('Nombre de la Estación');
      expect(preview.headers).toContain('Gasolina Regular (MXN)');
    });

    it('should handle all columns selection', () => {
      const options = {
        columns: ['all'] as const,
      };
      const preview = generateCSVPreview(mockStations, options, 1);
      
      expect(preview.headers.length).toBeGreaterThan(5); // Should include all default columns
    });
  });

  describe('validateExportData', () => {
    it('should validate correct data', () => {
      const result = validateExportData(mockStations);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect invalid data types', () => {
      const result = validateExportData('not-an-array' as unknown as ExportableStation[]);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Los datos deben ser un arreglo de estaciones');
    });

    it('should warn about empty arrays', () => {
      const result = validateExportData([]);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('No hay estaciones para exportar');
    });

    it('should detect missing required fields', () => {
      const invalidStations = [
        {
          numero: '',
          nombre: '',
          direccion: 'Test Address',
          regular: 22.50,
          lastUpdated: '2024-01-01T12:00:00Z',
        },
      ] as ExportableStation[];
      
      const result = validateExportData(invalidStations);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Falta el nombre'))).toBe(true);
      expect(result.errors.some(error => error.includes('Falta el ID'))).toBe(true);
    });

    it('should warn about stations without prices', () => {
      const stationsNoPrices = [
        {
          numero: '001',
          nombre: 'Test Station',
          direccion: 'Test Address',
          lastUpdated: '2024-01-01T12:00:00Z',
        },
      ] as ExportableStation[];
      
      const result = validateExportData(stationsNoPrices);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(warning => warning.includes('No tiene precios'))).toBe(true);
    });

    it('should validate multiple stations', () => {
      const mixedStations = [
        mockStations[0], // Valid station
        {
          numero: '',
          nombre: 'Invalid Station',
          direccion: 'Test Address',
          lastUpdated: '2024-01-01T12:00:00Z',
        } as ExportableStation,
      ];
      
      const result = validateExportData(mixedStations);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('CSV content generation', () => {
    it('should handle special characters in CSV', async () => {
      const stationsWithSpecialChars: ExportableStation[] = [
        {
          numero: '001',
          nombre: 'Estación "Central"',
          brand: 'Pemex, S.A.',
          direccion: 'Av. Principal, 123\nCol. Centro',
          regular: 22.50,
          lastUpdated: '2024-01-01T12:00:00Z',
        },
      ];
      
      const result = await exportStationsToCSV(stationsWithSpecialChars);
      expect(result.success).toBe(true);
    });

    it('should format dates correctly', async () => {
      const options = {
        dateFormat: 'iso' as const,
      };
      
      const result = await exportStationsToCSV(mockStations, options);
      expect(result.success).toBe(true);
    });

    it('should include UTF-8 BOM for Excel compatibility', async () => {
      await exportStationsToCSV(mockStations);
      
      // Verify Blob was created with BOM
      expect(vi.mocked(Blob)).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringMatching(/^\uFEFF/)]),
        expect.objectContaining({ type: 'text/csv;charset=utf-8;' })
      );
    });
  });
});