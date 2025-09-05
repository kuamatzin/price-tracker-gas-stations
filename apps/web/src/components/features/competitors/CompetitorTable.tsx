import React, { useState, useMemo } from "react";
import { FuelType } from "@fuelintel/shared";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  CaretSortIcon,
} from "@radix-ui/react-icons";

interface CompetitorStation {
  numero: string;
  nombre: string;
  brand?: string;
  direccion: string;
  lat: number;
  lng: number;
  prices: {
    [key in FuelType]?: number;
  };
  lastUpdated?: string;
}

interface CompetitorTableProps {
  selectedStation: {
    lat: number;
    lng: number;
    numero: string;
    prices: {
      [key in FuelType]?: number;
    };
  };
  competitors: CompetitorStation[];
  isLoading?: boolean;
  className?: string;
}

type SortField =
  | "nombre"
  | "brand"
  | "distance"
  | "regular"
  | "premium"
  | "diesel";
type SortOrder = "asc" | "desc";

export const CompetitorTable: React.FC<CompetitorTableProps> = ({
  selectedStation,
  competitors,
  isLoading,
  className,
}) => {
  const [sortField, setSortField] = useState<SortField>("distance");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const calculateDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const competitorsWithDistance = useMemo(() => {
    return competitors.map((competitor) => ({
      ...competitor,
      distance: calculateDistance(
        selectedStation.lat,
        selectedStation.lng,
        competitor.lat,
        competitor.lng,
      ),
    }));
  }, [competitors, selectedStation]);

  const sortedCompetitors = useMemo(() => {
    const sorted = [...competitorsWithDistance];
    sorted.sort((a, b) => {
      let valueA: string | number;
      let valueB: string | number;

      switch (sortField) {
        case "nombre":
          valueA = a.nombre.toLowerCase();
          valueB = b.nombre.toLowerCase();
          break;
        case "brand":
          valueA = (a.brand || "").toLowerCase();
          valueB = (b.brand || "").toLowerCase();
          break;
        case "distance":
          valueA = a.distance;
          valueB = b.distance;
          break;
        case "regular":
          valueA = a.prices.regular || Infinity;
          valueB = b.prices.regular || Infinity;
          break;
        case "premium":
          valueA = a.prices.premium || Infinity;
          valueB = b.prices.premium || Infinity;
          break;
        case "diesel":
          valueA = a.prices.diesel || Infinity;
          valueB = b.prices.diesel || Infinity;
          break;
        default:
          return 0;
      }

      if (valueA < valueB) return sortOrder === "asc" ? -1 : 1;
      if (valueA > valueB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [competitorsWithDistance, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <CaretSortIcon className="h-4 w-4" />;
    }
    return sortOrder === "asc" ? (
      <ChevronUpIcon className="h-4 w-4" />
    ) : (
      <ChevronDownIcon className="h-4 w-4" />
    );
  };

  const getPriceComparisonClass = (
    competitorPrice: number | undefined,
    selectedPrice: number | undefined,
  ) => {
    if (!competitorPrice || !selectedPrice) return "";

    const percentDiff =
      ((competitorPrice - selectedPrice) / selectedPrice) * 100;

    if (percentDiff < -2) return "text-green-600 font-medium";
    if (percentDiff > 2) return "text-red-600 font-medium";
    return "text-yellow-600";
  };

  const getPriceIndicator = (
    competitorPrice: number | undefined,
    selectedPrice: number | undefined,
  ) => {
    if (!competitorPrice || !selectedPrice) return null;

    const diff = competitorPrice - selectedPrice;
    if (Math.abs(diff) < 0.01) return null;

    return (
      <span className="text-xs ml-1">
        ({diff > 0 ? "+" : ""}
        {diff.toFixed(2)})
      </span>
    );
  };

  if (isLoading) {
    return <CompetitorTableSkeleton />;
  }

  return (
    <>
      <div className="hidden md:block">
        <Card className={className}>
          <CardHeader>
            <CardTitle>Competidores Cercanos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort("nombre")}
                    >
                      <div className="flex items-center gap-1">
                        Estación
                        {getSortIcon("nombre")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort("brand")}
                    >
                      <div className="flex items-center gap-1">
                        Marca
                        {getSortIcon("brand")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort("distance")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Distancia
                        {getSortIcon("distance")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort("regular")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Regular
                        {getSortIcon("regular")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort("premium")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Premium
                        {getSortIcon("premium")}
                      </div>
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort("diesel")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Diésel
                        {getSortIcon("diesel")}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCompetitors.map((station) => (
                    <TableRow
                      key={station.numero}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <TableCell className="font-medium">
                        {station.nombre}
                      </TableCell>
                      <TableCell>
                        <BrandLogo brand={station.brand} />
                      </TableCell>
                      <TableCell className="text-right">
                        {station.distance.toFixed(1)} km
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right",
                          getPriceComparisonClass(
                            station.prices.regular,
                            selectedStation.prices.regular,
                          ),
                        )}
                      >
                        {station.prices.regular ? (
                          <>
                            ${station.prices.regular.toFixed(2)}
                            {getPriceIndicator(
                              station.prices.regular,
                              selectedStation.prices.regular,
                            )}
                          </>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right",
                          getPriceComparisonClass(
                            station.prices.premium,
                            selectedStation.prices.premium,
                          ),
                        )}
                      >
                        {station.prices.premium ? (
                          <>
                            ${station.prices.premium.toFixed(2)}
                            {getPriceIndicator(
                              station.prices.premium,
                              selectedStation.prices.premium,
                            )}
                          </>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right",
                          getPriceComparisonClass(
                            station.prices.diesel,
                            selectedStation.prices.diesel,
                          ),
                        )}
                      >
                        {station.prices.diesel ? (
                          <>
                            ${station.prices.diesel.toFixed(2)}
                            {getPriceIndicator(
                              station.prices.diesel,
                              selectedStation.prices.diesel,
                            )}
                          </>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="md:hidden">
        {sortedCompetitors.map((station) => (
          <CompetitorCard
            key={station.numero}
            station={station}
            selectedStation={selectedStation}
          />
        ))}
      </div>
    </>
  );
};

const BrandLogo: React.FC<{ brand?: string }> = ({ brand }) => {
  if (!brand) return <span className="text-gray-400">-</span>;

  const brandLogos: Record<string, string> = {
    Pemex: "⛽",
    Shell: "🐚",
    BP: "🟢",
    Mobil: "🔴",
  };

  return (
    <span className="inline-flex items-center gap-1">
      <span>{brandLogos[brand] || "⛽"}</span>
      <span>{brand}</span>
    </span>
  );
};

const CompetitorCard: React.FC<{
  station: CompetitorStation & { distance: number };
  selectedStation: CompetitorTableProps["selectedStation"];
}> = ({ station }) => {
  return (
    <Card className="mb-3">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium">{station.nombre}</p>
            <p className="text-sm text-gray-500">
              <BrandLogo brand={station.brand} /> •{" "}
              {station.distance.toFixed(1)} km
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 text-sm">
          {station.prices.regular && (
            <div>
              <p className="text-gray-500">Regular</p>
              <p className="font-medium">
                ${station.prices.regular.toFixed(2)}
              </p>
            </div>
          )}
          {station.prices.premium && (
            <div>
              <p className="text-gray-500">Premium</p>
              <p className="font-medium">
                ${station.prices.premium.toFixed(2)}
              </p>
            </div>
          )}
          {station.prices.diesel && (
            <div>
              <p className="text-gray-500">Diésel</p>
              <p className="font-medium">${station.prices.diesel.toFixed(2)}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const CompetitorTableSkeleton: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default CompetitorTable;
