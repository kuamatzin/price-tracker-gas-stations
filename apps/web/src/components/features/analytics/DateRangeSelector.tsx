import { useState, useCallback, useEffect } from 'react';
import { format, isValid, startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DateRange } from '../../../types/charts';
import { DATE_PRESETS } from '../../../config/charts';

interface DateRangeSelectorProps {
  selectedRange: DateRange;
  onRangeChange: (range: DateRange) => void;
  className?: string;
  showCustomPicker?: boolean;
}

type PresetKey = keyof typeof DATE_PRESETS;

export function DateRangeSelector({
  selectedRange,
  onRangeChange,
  className = '',
  showCustomPicker = true,
}: DateRangeSelectorProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const [validationError, setValidationError] = useState('');

  // Update URL params when range changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const url = new URL(window.location.href);
    const searchParams = url.searchParams;
    
    if (selectedRange.preset && selectedRange.preset !== 'custom') {
      searchParams.set('range', selectedRange.preset);
      searchParams.delete('start');
      searchParams.delete('end');
    } else {
      searchParams.set('range', 'custom');
      searchParams.set('start', format(selectedRange.startDate, 'yyyy-MM-dd'));
      searchParams.set('end', format(selectedRange.endDate, 'yyyy-MM-dd'));
    }
    
    const newUrl = url.toString();
    window.history.replaceState({}, '', newUrl);
  }, [selectedRange]);

  // Load range from URL params on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const searchParams = new URLSearchParams(window.location.search);
    const rangeParam = searchParams.get('range') as PresetKey | 'custom' | null;
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    
    if (rangeParam && rangeParam in DATE_PRESETS) {
      const preset = DATE_PRESETS[rangeParam];
      const dates = preset.getDates();
      onRangeChange({
        preset: rangeParam,
        ...dates,
      });
    } else if (rangeParam === 'custom' && startParam && endParam) {
      const startDate = new Date(startParam);
      const endDate = new Date(endParam);
      
      if (isValid(startDate) && isValid(endDate)) {
        onRangeChange({
          preset: 'custom',
          startDate,
          endDate,
        });
      }
    }
  }, [onRangeChange]);

  const handlePresetSelect = useCallback((preset: PresetKey) => {
    const presetConfig = DATE_PRESETS[preset];
    const dates = presetConfig.getDates();
    
    onRangeChange({
      preset,
      ...dates,
    });
  }, [onRangeChange]);

  const handlePreviousPeriod = useCallback(() => {
    const daysDiff = Math.ceil(
      (selectedRange.endDate.getTime() - selectedRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const newStartDate = subDays(selectedRange.startDate, daysDiff);
    const newEndDate = subDays(selectedRange.endDate, daysDiff);
    
    onRangeChange({
      preset: 'custom',
      startDate: newStartDate,
      endDate: newEndDate,
    });
  }, [selectedRange, onRangeChange]);

  const handleNextPeriod = useCallback(() => {
    const daysDiff = Math.ceil(
      (selectedRange.endDate.getTime() - selectedRange.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const newStartDate = addDays(selectedRange.startDate, daysDiff);
    const newEndDate = addDays(selectedRange.endDate, daysDiff);
    
    // Don't allow future dates beyond today
    if (newEndDate > new Date()) {
      return;
    }
    
    onRangeChange({
      preset: 'custom',
      startDate: newStartDate,
      endDate: newEndDate,
    });
  }, [selectedRange, onRangeChange]);

  const validateDateRange = useCallback((startStr: string, endStr: string): string => {
    if (!startStr || !endStr) {
      return 'Ambas fechas son requeridas';
    }
    
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    
    if (!isValid(startDate) || !isValid(endDate)) {
      return 'Fechas inválidas';
    }
    
    if (startDate > endDate) {
      return 'La fecha de inicio debe ser anterior a la fecha de fin';
    }
    
    if (endDate > new Date()) {
      return 'La fecha de fin no puede ser futura';
    }
    
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      return 'El rango máximo es de 90 días';
    }
    
    return '';
  }, []);

  const handleCustomDateSubmit = useCallback(() => {
    const error = validateDateRange(tempStartDate, tempEndDate);
    
    if (error) {
      setValidationError(error);
      return;
    }
    
    const startDate = startOfDay(new Date(tempStartDate));
    const endDate = endOfDay(new Date(tempEndDate));
    
    onRangeChange({
      preset: 'custom',
      startDate,
      endDate,
    });
    
    setShowDatePicker(false);
    setValidationError('');
  }, [tempStartDate, tempEndDate, validateDateRange, onRangeChange]);

  const handleShowCustomPicker = useCallback(() => {
    setTempStartDate(format(selectedRange.startDate, 'yyyy-MM-dd'));
    setTempEndDate(format(selectedRange.endDate, 'yyyy-MM-dd'));
    setValidationError('');
    setShowDatePicker(true);
  }, [selectedRange]);

  const formatDateRangeDisplay = useCallback(() => {
    return `${format(selectedRange.startDate, 'dd MMM', { locale: es })} - ${format(
      selectedRange.endDate,
      'dd MMM yyyy',
      { locale: es }
    )}`;
  }, [selectedRange]);

  const isNextDisabled = addDays(selectedRange.endDate, 1) > new Date();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(DATE_PRESETS) as PresetKey[]).map((preset) => (
          <Button
            key={preset}
            variant={selectedRange.preset === preset ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetSelect(preset)}
            className="text-sm"
          >
            {DATE_PRESETS[preset].label}
          </Button>
        ))}
        
        {showCustomPicker && (
          <Button
            variant={selectedRange.preset === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={handleShowCustomPicker}
            className="text-sm"
          >
            <Calendar className="w-4 h-4 mr-1" />
            Personalizar
          </Button>
        )}
      </div>

      {/* Quick Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreviousPeriod}
          className="text-sm"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Anterior
        </Button>
        
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {formatDateRangeDisplay()}
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextPeriod}
          disabled={isNextDisabled}
          className="text-sm"
        >
          Siguiente
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Custom Date Picker Modal */}
      {showDatePicker && (
        <Card className="absolute z-10 p-4 mt-2 bg-white dark:bg-gray-800 border shadow-lg">
          <div className="space-y-3">
            <div className="text-sm font-medium">Seleccionar rango personalizado</div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Fecha de inicio
                </label>
                <input
                  type="date"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  max={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Fecha de fin
                </label>
                <input
                  type="date"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  max={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
            </div>
            
            {validationError && (
              <div className="text-xs text-red-600 dark:text-red-400">
                {validationError}
              </div>
            )}
            
            <div className="flex justify-end space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDatePicker(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleCustomDateSubmit}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}