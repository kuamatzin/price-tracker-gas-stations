import { useState, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { useAnalyticsStore } from '../../../stores/analyticsStore';
import { formatDate, startOfDay, endOfDay, addDays, subtractDays } from '../../../../../packages/shared/src/utils/date';

interface DateRangeSelectorProps {
  className?: string;
  showCustomPicker?: boolean;
}

const DATE_PRESETS = {
  '7d': {
    label: '7 días',
    getDates: () => ({
      from: formatDate(subtractDays(new Date(), 7), 'short'),
      to: formatDate(new Date(), 'short'),
    }),
  },
  '15d': {
    label: '15 días',
    getDates: () => ({
      from: formatDate(subtractDays(new Date(), 15), 'short'),
      to: formatDate(new Date(), 'short'),
    }),
  },
  '30d': {
    label: '30 días',
    getDates: () => ({
      from: formatDate(subtractDays(new Date(), 30), 'short'),
      to: formatDate(new Date(), 'short'),
    }),
  },
} as const;

type PresetKey = keyof typeof DATE_PRESETS;

export function DateRangeSelector({
  className = '',
  showCustomPicker = true,
}: DateRangeSelectorProps) {
  const { selectedDateRange, setDateRange } = useAnalyticsStore();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempFromDate, setTempFromDate] = useState('');
  const [tempToDate, setTempToDate] = useState('');
  const [validationError, setValidationError] = useState('');

  const handlePresetSelect = useCallback((preset: PresetKey) => {
    const presetConfig = DATE_PRESETS[preset];
    const dates = presetConfig.getDates();
    
    setDateRange({
      start: new Date(dates.from),
      end: new Date(dates.to),
    });
  }, [setDateRange]);

  const getCurrentDateRange = useCallback(() => {
    return {
      from: formatDate(selectedDateRange.start, 'short'),
      to: formatDate(selectedDateRange.end, 'short'),
    };
  }, [selectedDateRange]);

  const handlePreviousPeriod = useCallback(() => {
    const currentRange = getCurrentDateRange();
    const fromDate = new Date(currentRange.from);
    const toDate = new Date(currentRange.to);
    
    const daysDiff = Math.ceil(
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const newFromDate = subtractDays(fromDate, daysDiff);
    const newToDate = subtractDays(toDate, daysDiff);
    
    setDateRange({
      start: newFromDate,
      end: newToDate,
    });
  }, [getCurrentDateRange, setFilters]);

  const handleNextPeriod = useCallback(() => {
    const currentRange = getCurrentDateRange();
    const fromDate = new Date(currentRange.from);
    const toDate = new Date(currentRange.to);
    
    const daysDiff = Math.ceil(
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const newFromDate = addDays(fromDate, daysDiff);
    const newToDate = addDays(toDate, daysDiff);
    
    // Don't allow future dates beyond today
    if (newToDate > new Date()) {
      return;
    }
    
    setDateRange({
      start: newFromDate,
      end: newToDate,
    });
  }, [getCurrentDateRange, setFilters]);

  const validateDateRange = useCallback((fromStr: string, toStr: string): string => {
    if (!fromStr || !toStr) {
      return 'Ambas fechas son requeridas';
    }
    
    const fromDate = new Date(fromStr);
    const toDate = new Date(toStr);
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return 'Fechas inválidas';
    }
    
    if (fromDate > toDate) {
      return 'La fecha de inicio debe ser anterior a la fecha de fin';
    }
    
    if (toDate > new Date()) {
      return 'La fecha de fin no puede ser futura';
    }
    
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      return 'El rango máximo es de 90 días';
    }
    
    return '';
  }, []);

  const handleCustomDateSubmit = useCallback(() => {
    const error = validateDateRange(tempFromDate, tempToDate);
    
    if (error) {
      setValidationError(error);
      return;
    }
    
    const fromDate = startOfDay(new Date(tempFromDate));
    const toDate = endOfDay(new Date(tempToDate));
    
    setDateRange({
      start: fromDate,
      end: toDate,
    });
    
    setShowDatePicker(false);
    setValidationError('');
  }, [tempFromDate, tempToDate, validateDateRange, setDateRange]);

  const handleShowCustomPicker = useCallback(() => {
    const currentRange = getCurrentDateRange();
    setTempFromDate(new Date(currentRange.from).toISOString().split('T')[0]);
    setTempToDate(new Date(currentRange.to).toISOString().split('T')[0]);
    setValidationError('');
    setShowDatePicker(true);
  }, [getCurrentDateRange]);

  const formatDateRangeDisplay = useCallback(() => {
    const currentRange = getCurrentDateRange();
    const fromDate = new Date(currentRange.from);
    const toDate = new Date(currentRange.to);
    return `${formatDate(fromDate, 'short')} - ${formatDate(toDate, 'short')}`;
  }, [getCurrentDateRange]);

  const isNextDisabled = useCallback(() => {
    const currentRange = getCurrentDateRange();
    const toDate = new Date(currentRange.to);
    return addDays(toDate, 1) > new Date();
  }, [getCurrentDateRange]);

  const getActivePreset = useCallback((): PresetKey | null => {
    const currentRange = getCurrentDateRange();
    
    for (const [key, preset] of Object.entries(DATE_PRESETS)) {
      const presetRange = preset.getDates();
      if (presetRange.from === currentRange.from && presetRange.to === currentRange.to) {
        return key as PresetKey;
      }
    }
    return null;
  }, [getCurrentDateRange]);

  const activePreset = getActivePreset();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(DATE_PRESETS) as PresetKey[]).map((preset) => (
          <Button
            key={preset}
            variant={activePreset === preset ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetSelect(preset)}
            className="text-sm"
          >
            {DATE_PRESETS[preset].label}
          </Button>
        ))}
        
        {showCustomPicker && (
          <Button
            variant={activePreset === null ? 'default' : 'outline'}
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
          disabled={isNextDisabled()}
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
                  value={tempFromDate}
                  onChange={(e) => setTempFromDate(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Fecha de fin
                </label>
                <input
                  type="date"
                  value={tempToDate}
                  onChange={(e) => setTempToDate(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  max={new Date().toISOString().split('T')[0]}
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