import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToCSV } from '@/utils/csvExport';
import { usePricingStore } from '@/stores/pricingStore';

// Mock URL and document APIs
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

const mockClick = vi.fn();
const mockElement = {
  href: '',
  download: '',
  click: mockClick,
  style: {},
  remove: vi.fn(),
};

vi.spyOn(document, 'createElement').mockImplementation((tag) => {
  if (tag === 'a') return mockElement as any;
  return document.createElement(tag);
});

vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockElement as any);
vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockElement as any);

describe('CSV Download Integration', () => {
  const mockStationData = {
    numero: 'USER001',
    nombre: 'My Station',
    brand: 'Pemex',
    lat: 20.6597,
    lng: -103.3496,
  };

  const mockCompetitors = [
    {
      numero: 'COMP001',
      nombre: 'Competitor 1',
      brand: 'Shell',
      direccion: '123 Main St',
      lat: 20.6600,
      lng: -103.3500,
      distance: 0.5,
      regular_price: 22.50,
      premium_price: 24.80,
      diesel_price: 23.90,
      last_updated: '2025-01-05T12:00:00Z',
    },
    {
      numero: 'COMP002',
      nombre: 'Competitor 2',
      brand: 'BP',
      direccion: '456 Oak Ave',
      lat: 20.6590,
      lng: -103.3490,
      distance: 0.8,
      regular_price: 23.20,
      premium_price: 25.20,
      diesel_price: 24.10,
      last_updated: '2025-01-05T11:30:00Z',
    },
    {
      numero: 'COMP003',
      nombre: 'Competitor 3',
      brand: 'Pemex',
      direccion: '789 Elm St',
      lat: 20.6610,
      lng: -103.3510,
      distance: 1.5,
      regular_price: 22.80,
      premium_price: 24.90,
      diesel_price: null, // No diesel
      last_updated: '2025-01-05T11:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockElement.href = '';
    mockElement.download = '';
    
    // Initialize store with data
    usePricingStore.setState({
      selectedStation: mockStationData.numero,
      currentPrices: {
        [mockStationData.numero]: mockStationData,
      },
      competitors: mockCompetitors,
      filters: {
        fuelType: 'all',
        radius: 5,
        brands: [],
      },
    });
  });

  describe('Export Flow', () => {
    it('exports all competitors when no filters applied', () => {
      const csvContent = exportToCSV(
        mockCompetitors,
        mockStationData.numero,
        mockStationData.nombre
      );
      
      // Parse CSV to check content
      const lines = csvContent.split('\n');
      const headers = lines[0];
      
      // Check headers
      expect(headers).toContain('Estación Referencia');
      expect(headers).toContain('Número');
      expect(headers).toContain('Estación');
      expect(headers).toContain('Marca');
      
      // Check data rows (header + 3 competitors)
      expect(lines.length).toBeGreaterThanOrEqual(4);
      
      // Check station context is included
      expect(csvContent).toContain('My Station (USER001)');
      
      // Check all competitors are included
      expect(csvContent).toContain('COMP001');
      expect(csvContent).toContain('COMP002');
      expect(csvContent).toContain('COMP003');
    });

    it('exports only filtered data', () => {
      // Apply filters
      const filteredCompetitors = mockCompetitors.filter(c => c.brand === 'Shell');
      
      const csvContent = exportToCSV(
        filteredCompetitors,
        mockStationData.numero,
        mockStationData.nombre
      );
      
      // Should only include filtered competitor
      expect(csvContent).toContain('COMP001');
      expect(csvContent).toContain('Shell');
      expect(csvContent).not.toContain('COMP002');
      expect(csvContent).not.toContain('COMP003');
    });

    it('handles missing data gracefully', () => {
      const csvContent = exportToCSV(
        mockCompetitors,
        mockStationData.numero,
        mockStationData.nombre
      );
      
      // Check that missing diesel price is handled
      const lines = csvContent.split('\n');
      const comp3Line = lines.find(line => line.includes('COMP003'));
      
      expect(comp3Line).toContain('N/A'); // Missing diesel price
    });

    it('formats prices correctly', () => {
      const csvContent = exportToCSV(
        mockCompetitors,
        mockStationData.numero,
        mockStationData.nombre
      );
      
      // Check price formatting
      expect(csvContent).toContain('22.5'); // Regular price as number
      expect(csvContent).toContain('24.8'); // Premium price
      expect(csvContent).toContain('23.9'); // Diesel price
    });

    it('formats distances correctly', () => {
      const csvContent = exportToCSV(
        mockCompetitors,
        mockStationData.numero,
        mockStationData.nombre
      );
      
      // Check distance formatting
      expect(csvContent).toContain('0.5'); // 0.5 km
      expect(csvContent).toContain('0.8'); // 0.8 km
      expect(csvContent).toContain('1.5'); // 1.5 km
    });
  });

  describe('Download Trigger', () => {
    it('triggers browser download', () => {
      exportToCSV(
        mockCompetitors,
        mockStationData.numero,
        mockStationData.nombre,
        true // trigger download
      );
      
      expect(mockClick).toHaveBeenCalled();
      expect(mockElement.download).toMatch(/^precios_My_Station_USER001_\d{4}-\d{2}-\d{2}_\d{6}\.csv$/);
    });

    it('creates correct blob type', () => {
      const createObjectURLSpy = vi.spyOn(global.URL, 'createObjectURL');
      
      exportToCSV(
        mockCompetitors,
        mockStationData.numero,
        mockStationData.nombre,
        true
      );
      
      const blobArg = createObjectURLSpy.mock.calls[0][0];
      expect(blobArg).toBeInstanceOf(Blob);
      expect(blobArg.type).toBe('text/csv;charset=utf-8;');
    });

    it('cleans up resources after download', (done) => {
      const revokeObjectURLSpy = vi.spyOn(global.URL, 'revokeObjectURL');
      
      exportToCSV(
        mockCompetitors,
        mockStationData.numero,
        mockStationData.nombre,
        true
      );
      
      setTimeout(() => {
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
        done();
      }, 100);
    });
  });

  describe('Filename Generation', () => {
    it('includes station context in filename', () => {
      exportToCSV(
        mockCompetitors,
        mockStationData.numero,
        mockStationData.nombre,
        true
      );
      
      expect(mockElement.download).toContain('My_Station');
      expect(mockElement.download).toContain('USER001');
    });

    it('includes timestamp in filename', () => {
      const beforeTime = new Date();
      
      exportToCSV(
        mockCompetitors,
        mockStationData.numero,
        mockStationData.nombre,
        true
      );
      
      const afterTime = new Date();
      
      // Extract date from filename
      const match = mockElement.download.match(/(\d{4})-(\d{2})-(\d{2})/);
      expect(match).toBeTruthy();
      
      const fileDate = new Date(`${match![1]}-${match![2]}-${match![3]}`);
      expect(fileDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(fileDate.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000);
    });

    it('sanitizes special characters in filename', () => {
      exportToCSV(
        mockCompetitors,
        'TEST/001',
        'Station:With\\Special*Chars',
        true
      );
      
      expect(mockElement.download).not.toContain('/');
      expect(mockElement.download).not.toContain(':');
      expect(mockElement.download).not.toContain('\\');
      expect(mockElement.download).not.toContain('*');
    });
  });

  describe('Progress Indication', () => {
    it('calls progress callback during export', () => {
      const onProgress = vi.fn();
      
      exportToCSV(
        mockCompetitors,
        mockStationData.numero,
        mockStationData.nombre,
        false,
        onProgress
      );
      
      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        current: expect.any(Number),
        total: mockCompetitors.length,
      }));
    });

    it('completes progress at 100%', () => {
      const onProgress = vi.fn();
      
      exportToCSV(
        mockCompetitors,
        mockStationData.numero,
        mockStationData.nombre,
        false,
        onProgress
      );
      
      const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1];
      expect(lastCall[0].current).toBe(lastCall[0].total);
    });
  });

  describe('Large Dataset Handling', () => {
    it('handles export of 1000+ rows efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...mockCompetitors[0],
        numero: `COMP${i.toString().padStart(4, '0')}`,
        nombre: `Station ${i}`,
        distance: i * 0.01,
      }));
      
      const startTime = performance.now();
      
      const csvContent = exportToCSV(
        largeDataset,
        mockStationData.numero,
        mockStationData.nombre
      );
      
      const endTime = performance.now();
      
      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
      
      // Verify all rows are included
      const lines = csvContent.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(1001); // Header + 1000 data rows
    });

    it('batches large exports to prevent UI blocking', () => {
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
        ...mockCompetitors[0],
        numero: `COMP${i}`,
      }));
      
      const onProgress = vi.fn();
      
      exportToCSV(
        largeDataset,
        mockStationData.numero,
        mockStationData.nombre,
        false,
        onProgress
      );
      
      // Should call progress multiple times for batching
      expect(onProgress.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('Error Handling', () => {
    it('handles export errors gracefully', () => {
      // Mock createElement to throw error
      const originalCreateElement = document.createElement;
      document.createElement = vi.fn().mockImplementationOnce(() => {
        throw new Error('Export failed');
      });
      
      expect(() => {
        exportToCSV(
          mockCompetitors,
          mockStationData.numero,
          mockStationData.nombre,
          true
        );
      }).toThrow('Export failed');
      
      document.createElement = originalCreateElement;
    });

    it('handles blob creation errors', () => {
      const originalBlob = global.Blob;
      global.Blob = vi.fn().mockImplementationOnce(() => {
        throw new Error('Blob creation failed');
      });
      
      expect(() => {
        exportToCSV(
          mockCompetitors,
          mockStationData.numero,
          mockStationData.nombre,
          true
        );
      }).toThrow('Blob creation failed');
      
      global.Blob = originalBlob;
    });

    it('validates data before export', () => {
      const invalidData = [
        { invalid: 'structure' },
        null,
        undefined,
        { numero: 'VALID', nombre: 'Valid Station' },
      ] as any;
      
      // Should filter out invalid entries
      const csvContent = exportToCSV(
        invalidData,
        mockStationData.numero,
        mockStationData.nombre
      );
      
      const lines = csvContent.split('\n').filter(line => line.trim());
      // Should have header + 1 valid row
      expect(lines.length).toBe(2);
      expect(csvContent).toContain('VALID');
    });
  });

  describe('Browser Compatibility', () => {
    it('falls back to alternative download method if click fails', () => {
      mockClick.mockImplementationOnce(() => {
        throw new Error('Click failed');
      });
      
      // Should not throw, uses fallback
      expect(() => {
        exportToCSV(
          mockCompetitors,
          mockStationData.numero,
          mockStationData.nombre,
          true
        );
      }).not.toThrow();
    });

    it('handles missing Blob constructor', () => {
      const originalBlob = global.Blob;
      delete (global as any).Blob;
      
      expect(() => {
        exportToCSV(
          mockCompetitors,
          mockStationData.numero,
          mockStationData.nombre,
          true
        );
      }).toThrow();
      
      global.Blob = originalBlob;
    });
  });
});