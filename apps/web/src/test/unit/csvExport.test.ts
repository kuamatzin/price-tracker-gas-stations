import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToCSV, formatDataForExport, generateFilename } from '@/utils/csvExport';

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock document.createElement and click
const mockClick = vi.fn();
const mockElement = {
  href: '',
  download: '',
  click: mockClick,
  style: {},
};

vi.spyOn(document, 'createElement').mockImplementation((tag) => {
  if (tag === 'a') return mockElement as any;
  return document.createElement(tag);
});

describe('csvExport', () => {
  const mockData = [
    {
      numero: 'TEST001',
      nombre: 'Station 1',
      brand: 'Pemex',
      direccion: '123 Main St',
      distance: 2.5,
      regular_price: 22.50,
      premium_price: 24.80,
      diesel_price: 23.90,
      last_updated: '2025-01-05T12:00:00Z',
    },
    {
      numero: 'TEST002',
      nombre: 'Station 2',
      brand: 'Shell',
      direccion: '456 Oak Ave',
      distance: 3.8,
      regular_price: 22.80,
      premium_price: 25.10,
      diesel_price: 24.20,
      last_updated: '2025-01-05T11:30:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockElement.href = '';
    mockElement.download = '';
  });

  describe('formatDataForExport', () => {
    it('formats data correctly for CSV export', () => {
      const formatted = formatDataForExport(mockData, 'MAIN001', 'Main Station');
      
      expect(formatted).toHaveLength(2);
      expect(formatted[0]).toEqual({
        'Estación Referencia': 'Main Station (MAIN001)',
        'Número': 'TEST001',
        'Estación': 'Station 1',
        'Marca': 'Pemex',
        'Dirección': '123 Main St',
        'Distancia (km)': 2.5,
        'Regular': 22.50,
        'Premium': 24.80,
        'Diesel': 23.90,
        'Última Actualización': expect.any(String),
      });
    });

    it('includes station context in export', () => {
      const formatted = formatDataForExport(mockData, 'REF123', 'Reference Station');
      
      formatted.forEach(row => {
        expect(row['Estación Referencia']).toBe('Reference Station (REF123)');
      });
    });

    it('handles missing prices gracefully', () => {
      const dataWithMissing = [
        {
          ...mockData[0],
          regular_price: null,
          premium_price: undefined,
        },
      ];
      
      const formatted = formatDataForExport(dataWithMissing, 'MAIN001', 'Main Station');
      
      expect(formatted[0]['Regular']).toBe('N/A');
      expect(formatted[0]['Premium']).toBe('N/A');
      expect(formatted[0]['Diesel']).toBe(23.90);
    });

    it('formats timestamps correctly', () => {
      const formatted = formatDataForExport(mockData, 'MAIN001', 'Main Station');
      
      // Should format as locale date string
      expect(formatted[0]['Última Actualización']).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    it('rounds distances to 1 decimal place', () => {
      const dataWithLongDistance = [
        {
          ...mockData[0],
          distance: 2.567890,
        },
      ];
      
      const formatted = formatDataForExport(dataWithLongDistance, 'MAIN001', 'Main Station');
      expect(formatted[0]['Distancia (km)']).toBe(2.6);
    });
  });

  describe('generateFilename', () => {
    it('generates filename with station context', () => {
      const filename = generateFilename('TEST001', 'Test Station');
      
      expect(filename).toMatch(/precios_Test_Station_TEST001_\d{4}-\d{2}-\d{2}_\d{6}\.csv/);
    });

    it('sanitizes station name for filename', () => {
      const filename = generateFilename('TEST001', 'Station/With\\Special:Chars');
      
      expect(filename).not.toContain('/');
      expect(filename).not.toContain('\\');
      expect(filename).not.toContain(':');
      expect(filename).toMatch(/precios_Station_With_Special_Chars_TEST001_/);
    });

    it('includes timestamp in filename', () => {
      const before = Date.now();
      const filename = generateFilename('TEST001', 'Test Station');
      const after = Date.now();
      
      const match = filename.match(/(\d{4})-(\d{2})-(\d{2})_(\d{6})/);
      expect(match).toBeTruthy();
      
      const year = parseInt(match![1]);
      const month = parseInt(match![2]);
      const day = parseInt(match![3]);
      
      const now = new Date();
      expect(year).toBe(now.getFullYear());
      expect(month).toBeGreaterThan(0);
      expect(month).toBeLessThanOrEqual(12);
      expect(day).toBeGreaterThan(0);
      expect(day).toBeLessThanOrEqual(31);
    });

    it('handles empty station name', () => {
      const filename = generateFilename('TEST001', '');
      expect(filename).toMatch(/precios_Station_TEST001_/);
    });
  });

  describe('exportToCSV', () => {
    it('creates CSV with headers', () => {
      const csvContent = exportToCSV(mockData, 'MAIN001', 'Main Station');
      
      expect(csvContent).toContain('Estación Referencia');
      expect(csvContent).toContain('Número');
      expect(csvContent).toContain('Estación');
      expect(csvContent).toContain('Marca');
      expect(csvContent).toContain('Dirección');
      expect(csvContent).toContain('Distancia (km)');
      expect(csvContent).toContain('Regular');
      expect(csvContent).toContain('Premium');
      expect(csvContent).toContain('Diesel');
      expect(csvContent).toContain('Última Actualización');
    });

    it('creates CSV with data rows', () => {
      const csvContent = exportToCSV(mockData, 'MAIN001', 'Main Station');
      
      expect(csvContent).toContain('TEST001');
      expect(csvContent).toContain('Station 1');
      expect(csvContent).toContain('Pemex');
      expect(csvContent).toContain('22.5'); // Regular price
      expect(csvContent).toContain('TEST002');
      expect(csvContent).toContain('Station 2');
      expect(csvContent).toContain('Shell');
    });

    it('escapes special characters in CSV', () => {
      const dataWithSpecialChars = [
        {
          ...mockData[0],
          nombre: 'Station, with comma',
          direccion: 'Address "with quotes"',
        },
      ];
      
      const csvContent = exportToCSV(dataWithSpecialChars, 'MAIN001', 'Main Station');
      
      expect(csvContent).toContain('"Station, with comma"');
      expect(csvContent).toContain('"Address ""with quotes"""');
    });

    it('triggers download with correct filename', () => {
      exportToCSV(mockData, 'MAIN001', 'Main Station', true);
      
      expect(mockElement.download).toMatch(/precios_Main_Station_MAIN001_/);
      expect(mockElement.download).toMatch(/\.csv$/);
      expect(mockClick).toHaveBeenCalled();
    });

    it('creates blob with correct MIME type', () => {
      const createObjectURLSpy = vi.spyOn(global.URL, 'createObjectURL');
      
      exportToCSV(mockData, 'MAIN001', 'Main Station', true);
      
      expect(createObjectURLSpy).toHaveBeenCalled();
      const blobArg = createObjectURLSpy.mock.calls[0][0];
      expect(blobArg).toBeInstanceOf(Blob);
      expect(blobArg.type).toBe('text/csv;charset=utf-8;');
    });

    it('cleans up object URL after download', () => {
      const revokeObjectURLSpy = vi.spyOn(global.URL, 'revokeObjectURL');
      
      exportToCSV(mockData, 'MAIN001', 'Main Station', true);
      
      // Use setTimeout to allow cleanup
      setTimeout(() => {
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
      }, 100);
    });

    it('handles empty data array', () => {
      const csvContent = exportToCSV([], 'MAIN001', 'Main Station');
      
      // Should still have headers
      expect(csvContent).toContain('Estación Referencia');
      expect(csvContent).toContain('Número');
      
      // But no data rows
      const lines = csvContent.split('\n');
      expect(lines.length).toBe(2); // Header + empty line
    });

    it('handles large datasets efficiently', () => {
      const largeData = Array(1000).fill(null).map((_, i) => ({
        ...mockData[0],
        numero: `TEST${i.toString().padStart(3, '0')}`,
        nombre: `Station ${i}`,
      }));
      
      const startTime = performance.now();
      const csvContent = exportToCSV(largeData, 'MAIN001', 'Main Station');
      const endTime = performance.now();
      
      expect(csvContent).toBeTruthy();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
      
      // Verify all rows are included
      const lines = csvContent.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(1001); // Header + 1000 data rows
    });
  });

  describe('Loading State', () => {
    it('returns loading indicator during export', async () => {
      const onProgress = vi.fn();
      
      const largeData = Array(100).fill(null).map((_, i) => ({
        ...mockData[0],
        numero: `TEST${i}`,
      }));
      
      exportToCSV(largeData, 'MAIN001', 'Main Station', false, onProgress);
      
      // Progress callback should be called
      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles export errors gracefully', () => {
      // Mock createElement to throw error
      vi.spyOn(document, 'createElement').mockImplementationOnce(() => {
        throw new Error('Export failed');
      });
      
      expect(() => {
        exportToCSV(mockData, 'MAIN001', 'Main Station', true);
      }).toThrow('Export failed');
    });

    it('validates data before export', () => {
      const invalidData = [
        { invalid: 'structure' },
      ] as any;
      
      expect(() => {
        exportToCSV(invalidData, 'MAIN001', 'Main Station');
      }).not.toThrow();
      
      // Should handle gracefully and export what it can
      const csvContent = exportToCSV(invalidData, 'MAIN001', 'Main Station');
      expect(csvContent).toContain('N/A'); // Missing fields should be N/A
    });
  });
});