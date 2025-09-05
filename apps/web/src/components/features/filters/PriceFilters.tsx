import React, { useEffect } from "react";
import { FuelType } from "@fuelintel/shared";
import { usePricingStore } from "@/stores/pricingStore";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RotateCcw, Filter } from "lucide-react";

const AVAILABLE_BRANDS = [
  "Pemex",
  "Shell",
  "BP",
  "Mobil",
  "Chevron",
  "Total",
  "G500",
  "Oxxo Gas",
  "Arco",
];

interface PriceFiltersProps {
  className?: string;
  onFiltersChange?: () => void;
}

export const PriceFilters: React.FC<PriceFiltersProps> = ({
  className,
  onFiltersChange,
}) => {
  const { filters, setFilter, resetFilters } = usePricingStore();

  const handleFuelTypeChange = (value: string) => {
    setFilter("fuelType", value as "all" | FuelType);
    onFiltersChange?.();
  };

  const handleRadiusChange = (value: number[]) => {
    setFilter("radius", value[0]);
    onFiltersChange?.();
  };

  const handleBrandToggle = (brand: string) => {
    const newBrands = filters.brands.includes(brand)
      ? filters.brands.filter((b) => b !== brand)
      : [...filters.brands, brand];
    setFilter("brands", newBrands);
    onFiltersChange?.();
  };

  const handleResetFilters = () => {
    resetFilters();
    onFiltersChange?.();
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.fuelType && filters.fuelType !== "all") count++;
    if (filters.radius !== 10) count++; // 10 is the default
    if (filters.brands.length > 0) count += filters.brands.length;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  // Persist filters in URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.fuelType && filters.fuelType !== "all") {
      params.set("fuel", filters.fuelType);
    }
    if (filters.radius !== 10) {
      params.set("radius", filters.radius.toString());
    }
    if (filters.brands.length > 0) {
      params.set("brands", filters.brands.join(","));
    }

    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, [filters]);

  // Load filters from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fuel = params.get("fuel");
    const radius = params.get("radius");
    const brands = params.get("brands");

    if (fuel) {
      setFilter("fuelType", fuel as FuelType);
    }
    if (radius) {
      setFilter("radius", parseInt(radius, 10));
    }
    if (brands) {
      setFilter("brands", brands.split(","));
    }
  }, [setFilter]);

  return (
    <Card className={className}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <h3 className="font-medium">Filtros</h3>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </div>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Limpiar
            </Button>
          )}
        </div>

        {/* Fuel Type Filter */}
        <div className="space-y-2">
          <Label htmlFor="fuel-type">Tipo de combustible</Label>
          <Select value={filters.fuelType} onValueChange={handleFuelTypeChange}>
            <SelectTrigger id="fuel-type">
              <SelectValue placeholder="Selecciona tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value={FuelType.REGULAR}>Regular</SelectItem>
              <SelectItem value={FuelType.PREMIUM}>Premium</SelectItem>
              <SelectItem value={FuelType.DIESEL}>Diésel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Distance Radius Filter */}
        <div className="space-y-2">
          <Label htmlFor="radius">
            Radio de distancia: {filters.radius} km
          </Label>
          <Slider
            id="radius"
            min={1}
            max={50}
            step={1}
            value={[filters.radius]}
            onValueChange={handleRadiusChange}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>1 km</span>
            <span>50 km</span>
          </div>
        </div>

        {/* Brand Multi-Select */}
        <div className="space-y-2">
          <Label>Marcas</Label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {AVAILABLE_BRANDS.map((brand) => (
              <div key={brand} className="flex items-center space-x-2">
                <Checkbox
                  id={brand}
                  checked={filters.brands.includes(brand)}
                  onCheckedChange={() => handleBrandToggle(brand)}
                />
                <Label
                  htmlFor={brand}
                  className="text-sm font-normal cursor-pointer"
                >
                  {brand}
                </Label>
              </div>
            ))}
          </div>
          {filters.brands.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {filters.brands.map((brand) => (
                <Badge
                  key={brand}
                  variant="secondary"
                  className="text-xs cursor-pointer"
                  onClick={() => handleBrandToggle(brand)}
                >
                  {brand}
                  <span className="ml-1">×</span>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Active Filter Summary */}
        {activeFilterCount > 0 && (
          <div className="text-xs text-gray-600 pt-2 border-t">
            Mostrando resultados con {activeFilterCount} filtro
            {activeFilterCount !== 1 && "s"} aplicado
            {activeFilterCount !== 1 && "s"}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
