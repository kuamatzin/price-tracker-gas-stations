import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { X, Filter, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export interface PriceFilterState {
  fuelType: "all" | "regular" | "premium" | "diesel";
  radius: number;
  brands: string[];
}

export interface PriceFiltersProps {
  filters: PriceFilterState;
  onFiltersChange: (filters: PriceFilterState) => void;
  availableBrands?: string[];
  className?: string;
}

const PriceFilters: React.FC<PriceFiltersProps> = ({
  filters,
  onFiltersChange,
  availableBrands = [],
  className = "",
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Initialize from URL params on mount
  useEffect(() => {
    const urlFuelType = searchParams.get("fuelType") as
      | PriceFilterState["fuelType"]
      | null;
    const urlRadius = searchParams.get("radius");
    const urlBrands = searchParams.get("brands");

    if (urlFuelType || urlRadius || urlBrands) {
      const urlFilters: PriceFilterState = {
        fuelType: urlFuelType || "all",
        radius: urlRadius ? parseInt(urlRadius, 10) : 5,
        brands: urlBrands ? urlBrands.split(",").filter(Boolean) : [],
      };

      // Only update if different from current filters
      if (JSON.stringify(urlFilters) !== JSON.stringify(filters)) {
        onFiltersChange(urlFilters);
      }
    }
  }, []);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    if (filters.fuelType !== "all") {
      params.set("fuelType", filters.fuelType);
    } else {
      params.delete("fuelType");
    }

    if (filters.radius !== 5) {
      params.set("radius", filters.radius.toString());
    } else {
      params.delete("radius");
    }

    if (filters.brands.length > 0) {
      params.set("brands", filters.brands.join(","));
    } else {
      params.delete("brands");
    }

    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams, searchParams]);

  const handleFuelTypeChange = (fuelType: PriceFilterState["fuelType"]) => {
    onFiltersChange({
      ...filters,
      fuelType,
    });
  };

  const handleRadiusChange = (radius: number) => {
    onFiltersChange({
      ...filters,
      radius: Math.max(1, Math.min(50, radius)),
    });
  };

  const handleBrandToggle = (brand: string) => {
    const newBrands = filters.brands.includes(brand)
      ? filters.brands.filter((b) => b !== brand)
      : [...filters.brands, brand];

    onFiltersChange({
      ...filters,
      brands: newBrands,
    });
  };

  const handleReset = () => {
    const defaultFilters: PriceFilterState = {
      fuelType: "all",
      radius: 5,
      brands: [],
    };
    onFiltersChange(defaultFilters);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.fuelType !== "all") count++;
    if (filters.radius !== 5) count++;
    if (filters.brands.length > 0) count++;
    return count;
  };

  const formatFuelTypeLabel = (type: PriceFilterState["fuelType"]): string => {
    const labels = {
      all: "Todos los combustibles",
      regular: "Gasolina Regular",
      premium: "Gasolina Premium",
      diesel: "Diesel",
    };
    return labels[type];
  };

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <h3 className="font-medium text-gray-900 dark:text-white">
              Filtros
            </h3>
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary" className="text-xs">
                {getActiveFilterCount()}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {getActiveFilterCount() > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs h-7 px-2"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Limpiar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-7 px-2"
            >
              {isCollapsed ? "Mostrar" : "Ocultar"}
            </Button>
          </div>
        </div>

        {/* Active Filters Display */}
        {getActiveFilterCount() > 0 && !isCollapsed && (
          <div className="flex flex-wrap gap-2">
            {filters.fuelType !== "all" && (
              <Badge
                variant="outline"
                className="text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleFuelTypeChange("all")}
              >
                {formatFuelTypeLabel(filters.fuelType)}
                <X className="w-3 h-3 ml-1" />
              </Badge>
            )}
            {filters.radius !== 5 && (
              <Badge
                variant="outline"
                className="text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleRadiusChange(5)}
              >
                {filters.radius} km
                <X className="w-3 h-3 ml-1" />
              </Badge>
            )}
            {filters.brands.map((brand) => (
              <Badge
                key={brand}
                variant="outline"
                className="text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleBrandToggle(brand)}
              >
                {brand}
                <X className="w-3 h-3 ml-1" />
              </Badge>
            ))}
          </div>
        )}

        {/* Filter Controls */}
        {!isCollapsed && (
          <div className="space-y-4">
            {/* Fuel Type Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Tipo de Combustible
              </Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(["all", "regular", "premium", "diesel"] as const).map(
                  (type) => (
                    <Button
                      key={type}
                      variant={
                        filters.fuelType === type ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleFuelTypeChange(type)}
                      className="text-xs justify-start"
                    >
                      {formatFuelTypeLabel(type)}
                    </Button>
                  ),
                )}
              </div>
            </div>

            {/* Distance Radius Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Radio de Búsqueda
                </Label>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {filters.radius} km
                </span>
              </div>
              <div className="space-y-3">
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={filters.radius}
                  onChange={(e) =>
                    handleRadiusChange(parseInt(e.target.value, 10))
                  }
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>1 km</span>
                  <span>25 km</span>
                  <span>50 km</span>
                </div>
                {/* Quick radius buttons */}
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 5, 10, 15, 25].map((radius) => (
                    <Button
                      key={radius}
                      variant={
                        filters.radius === radius ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => handleRadiusChange(radius)}
                      className="text-xs h-6 px-2"
                    >
                      {radius}km
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Brand Multi-Select */}
            {availableBrands.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Marcas
                  </Label>
                  {filters.brands.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onFiltersChange({ ...filters, brands: [] })
                      }
                      className="text-xs h-6 px-2"
                    >
                      Limpiar
                    </Button>
                  )}
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {availableBrands.map((brand) => (
                    <div key={brand} className="flex items-center space-x-2">
                      <Checkbox
                        id={`brand-${brand}`}
                        checked={filters.brands.includes(brand)}
                        onCheckedChange={() => handleBrandToggle(brand)}
                      />
                      <Label
                        htmlFor={`brand-${brand}`}
                        className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex-1"
                      >
                        {brand}
                      </Label>
                      {filters.brands.includes(brand) && (
                        <Badge variant="secondary" className="text-xs">
                          ✓
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom slider styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider::-webkit-slider-thumb:hover {
          background: #2563eb;
        }

        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider::-moz-range-thumb:hover {
          background: #2563eb;
        }

        .dark .slider::-webkit-slider-track {
          background: #374151;
        }

        .dark .slider::-moz-range-track {
          background: #374151;
        }
      `}</style>
    </Card>
  );
};

export default PriceFilters;
