import { describe, it, expect } from 'vitest';

describe('Simple Unit Tests', () => {
  describe('Math operations', () => {
    it('should add numbers correctly', () => {
      expect(2 + 2).toBe(4);
    });

    it('should subtract numbers correctly', () => {
      expect(5 - 3).toBe(2);
    });
  });

  describe('String operations', () => {
    it('should concatenate strings', () => {
      expect('Hello' + ' ' + 'World').toBe('Hello World');
    });

    it('should check string length', () => {
      expect('FuelIntel'.length).toBe(9);
    });
  });

  describe('Array operations', () => {
    it('should create arrays', () => {
      const arr = [1, 2, 3];
      expect(arr).toHaveLength(3);
      expect(arr[0]).toBe(1);
    });

    it('should filter arrays', () => {
      const numbers = [1, 2, 3, 4, 5];
      const evenNumbers = numbers.filter(n => n % 2 === 0);
      expect(evenNumbers).toEqual([2, 4]);
    });
  });

  describe('Object operations', () => {
    it('should create objects', () => {
      const user = { id: 1, name: 'Test User' };
      expect(user.id).toBe(1);
      expect(user.name).toBe('Test User');
    });

    it('should check object properties', () => {
      const config = { theme: 'dark', sidebar: true };
      expect(config).toHaveProperty('theme');
      expect(config).toHaveProperty('sidebar');
      expect(config.theme).toBe('dark');
    });
  });

  describe('Function operations', () => {
    it('should execute functions', () => {
      const add = (a: number, b: number) => a + b;
      expect(add(3, 4)).toBe(7);
    });

    it('should handle async functions', async () => {
      const asyncAdd = async (a: number, b: number) => {
        return new Promise<number>(resolve => {
          setTimeout(() => resolve(a + b), 10);
        });
      };

      const result = await asyncAdd(5, 6);
      expect(result).toBe(11);
    });
  });
});