import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Fuel } from 'lucide-react';
import { Button } from '../../ui/button';
import { FUEL_TYPES } from '../../../config/charts';
import type { FuelType } from '../../../types/charts';

interface FuelTypeToggleProps {
  selectedFuels: FuelType[];
  onFuelToggle: (fuel: FuelType) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  className?: string;
  variant?: 'tabs' | 'buttons' | 'checkboxes';
  showSelectAll?: boolean;
}

const fuelTypeOrder: FuelType[] = ['regular', 'premium', 'diesel'];

export function FuelTypeToggle({
  selectedFuels,
  onFuelToggle,
  onSelectAll,
  onDeselectAll,
  className = '',
  variant = 'tabs',
  showSelectAll = true,
}: FuelTypeToggleProps) {
  
  const isAllSelected = selectedFuels.length === fuelTypeOrder.length;
  const isNoneSelected = selectedFuels.length === 0;
  const isSomeSelected = selectedFuels.length > 0 && selectedFuels.length < fuelTypeOrder.length;

  const handleSelectAllToggle = useCallback(() => {
    if (isAllSelected) {
      onDeselectAll();
    } else {
      onSelectAll();
    }
  }, [isAllSelected, onSelectAll, onDeselectAll]);

  const getFuelLabel = (fuel: FuelType): string => {
    return FUEL_TYPES[fuel].label;
  };

  const getFuelColor = (fuel: FuelType): string => {
    return FUEL_TYPES[fuel].color;
  };

  // Tabs variant - Material Design style tabs
  if (variant === 'tabs') {
    return (
      <div className={`space-y-4 ${className}`}>
        {showSelectAll && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Tipos de combustible
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAllToggle}
              className="text-xs"
            >
              <Fuel className="w-3 h-3 mr-1" />
              {isAllSelected ? 'Desmarcar todos' : 'Todos los combustibles'}
            </Button>
          </div>
        )}
        
        <div className="relative">
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <AnimatePresence>
              {fuelTypeOrder.map((fuel) => {
                const isSelected = selectedFuels.includes(fuel);
                
                return (
                  <motion.button
                    key={fuel}
                    onClick={() => onFuelToggle(fuel)}
                    className={`
                      relative px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200
                      flex items-center space-x-2 flex-1 justify-center
                      ${isSelected 
                        ? 'text-white shadow-sm' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }
                    `}
                    style={{
                      backgroundColor: isSelected ? getFuelColor(fuel) : 'transparent',
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getFuelColor(fuel) }}
                    />
                    <span>{getFuelLabel(fuel)}</span>
                    
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="ml-1"
                      >
                        <Check className="w-3 h-3" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Status indicator */}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {isAllSelected && 'Mostrando todos los combustibles'}
          {isSomeSelected && `Mostrando ${selectedFuels.length} de ${fuelTypeOrder.length} combustibles`}
          {isNoneSelected && 'Ningún combustible seleccionado'}
        </div>
      </div>
    );
  }

  // Buttons variant - Individual toggle buttons
  if (variant === 'buttons') {
    return (
      <div className={`space-y-3 ${className}`}>
        {showSelectAll && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Combustibles
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAllToggle}
              className="text-xs"
            >
              {isAllSelected ? 'Limpiar' : 'Seleccionar todos'}
            </Button>
          </div>
        )}
        
        <div className="flex flex-wrap gap-2">
          {fuelTypeOrder.map((fuel) => {
            const isSelected = selectedFuels.includes(fuel);
            
            return (
              <motion.div key={fuel} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onFuelToggle(fuel)}
                  className="text-sm flex items-center space-x-2"
                  style={{
                    backgroundColor: isSelected ? getFuelColor(fuel) : undefined,
                    borderColor: getFuelColor(fuel),
                  }}
                >
                  <span 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getFuelColor(fuel) }}
                  />
                  <span>{getFuelLabel(fuel)}</span>
                  
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-1"
                    >
                      <Check className="w-3 h-3" />
                    </motion.div>
                  )}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // Checkboxes variant - Traditional checkboxes
  return (
    <div className={`space-y-3 ${className}`}>
      {showSelectAll && (
        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Seleccionar combustibles
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAllToggle}
            className="text-xs"
          >
            {isAllSelected ? 'Desmarcar todos' : 'Seleccionar todos'}
          </Button>
        </div>
      )}
      
      <div className="space-y-2">
        {fuelTypeOrder.map((fuel) => {
          const isSelected = selectedFuels.includes(fuel);
          
          return (
            <motion.label
              key={fuel}
              className="flex items-center space-x-3 cursor-pointer group"
              whileHover={{ x: 2 }}
              transition={{ duration: 0.1 }}
            >
              <div className="relative">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onFuelToggle(fuel)}
                  className="sr-only"
                />
                <div
                  className={`
                    w-4 h-4 rounded border-2 transition-all duration-200
                    ${isSelected 
                      ? 'border-transparent shadow-sm' 
                      : 'border-gray-300 dark:border-gray-600 group-hover:border-gray-400'
                    }
                  `}
                  style={{
                    backgroundColor: isSelected ? getFuelColor(fuel) : 'transparent',
                  }}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center justify-center h-full"
                    >
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </motion.div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getFuelColor(fuel) }}
                />
                <span className="text-sm text-gray-900 dark:text-white group-hover:text-gray-600 dark:group-hover:text-gray-300">
                  {getFuelLabel(fuel)}
                </span>
              </div>
            </motion.label>
          );
        })}
      </div>
    </div>
  );
}