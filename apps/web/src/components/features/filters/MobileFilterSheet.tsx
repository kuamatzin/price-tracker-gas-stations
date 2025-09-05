import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, X } from "lucide-react";
import { FuelType } from "@fuelintel/shared";
import { usePricingStore } from "@/stores/pricingStore";

interface MobileFilterSheetProps {
  onFiltersApplied?: () => void;
}

export const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({
  onFiltersApplied,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { filters, setFilter, resetFilters } = usePricingStore();

  const [tempFilters, setTempFilters] = useState(filters);

  const brands = ["Pemex", "Shell", "Oxxo Gas", "Mobil", "G500", "BP"];

  const filterCount =
    (tempFilters.fuelType !== "all" ? 1 : 0) +
    (tempFilters.radius !== 10 ? 1 : 0) +
    tempFilters.brands.length;

  const handleApplyFilters = () => {
    setFilter("fuelType", tempFilters.fuelType);
    setFilter("radius", tempFilters.radius);
    setFilter("brands", tempFilters.brands);
    onFiltersApplied?.();
    setIsOpen(false);
  };

  const handleResetFilters = () => {
    const defaultFilters = {
      fuelType: "all" as const,
      radius: 10,
      brands: [],
    };
    setTempFilters(defaultFilters);
    resetFilters();
  };

  const handleBrandToggle = (brand: string) => {
    const newBrands = tempFilters.brands.includes(brand)
      ? tempFilters.brands.filter((b) => b !== brand)
      : [...tempFilters.brands, brand];
    setTempFilters({ ...tempFilters, brands: newBrands });
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="fixed bottom-4 right-4 z-40 md:hidden rounded-full shadow-lg"
          size="lg"
        >
          <Filter className="h-5 w-5" />
          {filterCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6 p-0 flex items-center justify-center"
            >
              {filterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-xl">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>
            Ajusta los filtros para encontrar las mejores opciones
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 overflow-y-auto max-h-[50vh]">
          {/* Fuel Type */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tipo de Combustible</Label>
            <RadioGroup
              value={tempFilters.fuelType}
              onValueChange={(value) =>
                setTempFilters({
                  ...tempFilters,
                  fuelType: value as typeof tempFilters.fuelType,
                })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all">Todos</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={FuelType.REGULAR} id="regular" />
                <Label htmlFor="regular">Regular</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={FuelType.PREMIUM} id="premium" />
                <Label htmlFor="premium">Premium</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={FuelType.DIESEL} id="diesel" />
                <Label htmlFor="diesel">Diésel</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Distance Radius */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <Label className="text-sm font-medium">Radio de Distancia</Label>
              <span className="text-sm text-gray-500">
                {tempFilters.radius} km
              </span>
            </div>
            <Slider
              value={[tempFilters.radius]}
              onValueChange={(value) =>
                setTempFilters({ ...tempFilters, radius: value[0] })
              }
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>1 km</span>
              <span>50 km</span>
            </div>
          </div>

          {/* Brand Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Marcas</Label>
            <div className="grid grid-cols-2 gap-3">
              {brands.map((brand) => (
                <div key={brand} className="flex items-center space-x-2">
                  <Checkbox
                    id={brand}
                    checked={tempFilters.brands.includes(brand)}
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
          </div>

          {/* Active Filters */}
          {filterCount > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Filtros Activos</Label>
              <div className="flex flex-wrap gap-2">
                {tempFilters.fuelType !== "all" && (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {tempFilters.fuelType}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() =>
                        setTempFilters({ ...tempFilters, fuelType: "all" })
                      }
                    />
                  </Badge>
                )}
                {tempFilters.radius !== 10 && (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {tempFilters.radius} km
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() =>
                        setTempFilters({ ...tempFilters, radius: 10 })
                      }
                    />
                  </Badge>
                )}
                {tempFilters.brands.map((brand) => (
                  <Badge
                    key={brand}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {brand}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleBrandToggle(brand)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t">
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              onClick={handleResetFilters}
              className="flex-1"
            >
              Limpiar
            </Button>
            <Button onClick={handleApplyFilters} className="flex-1">
              Aplicar Filtros
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
