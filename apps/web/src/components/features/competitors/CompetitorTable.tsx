import { useState, useMemo } from "react";
import {
  ChevronUp,
  ChevronDown,
  MapPin,
  Clock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface CompetitorData {
  numero: string;
  nombre: string;
  brand?: string;
  direccion: string;
  lat: number;
  lng: number;
  distance?: number;
  regular?: number;
  premium?: number;
  diesel?: number;
  lastUpdated: string;
}

export interface CompetitorTableProps {
  competitors: CompetitorData[];
  isLoading?: boolean;
  onStationClick?: (station: CompetitorData) => void;
  marketAverages?: {
    regular?: number;
    premium?: number;
    diesel?: number;
  };
}

type SortField =
  | "nombre"
  | "brand"
  | "distance"
  | "regular"
  | "premium"
  | "diesel";
type SortOrder = "asc" | "desc";

const CompetitorTable: React.FC<CompetitorTableProps> = ({
  competitors,
  isLoading = false,
  onStationClick,
  marketAverages = {},
}) => {
  const [sortField, setSortField] = useState<SortField>("distance");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedCompetitors = useMemo(() => {
    if (!competitors.length) return [];

    return [...competitors].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "nombre":
          aValue = a.nombre.toLowerCase();
          bValue = b.nombre.toLowerCase();
          break;
        case "brand":
          aValue = (a.brand || "").toLowerCase();
          bValue = (b.brand || "").toLowerCase();
          break;
        case "distance":
          aValue = a.distance || 0;
          bValue = b.distance || 0;
          break;
        case "regular":
          aValue = a.regular || 0;
          bValue = b.regular || 0;
          break;
        case "premium":
          aValue = a.premium || 0;
          bValue = b.premium || 0;
          break;
        case "diesel":
          aValue = a.diesel || 0;
          bValue = b.diesel || 0;
          break;
        default:
          return 0;
      }

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });
  }, [competitors, sortField, sortOrder]);

  const formatPrice = (price: number | undefined): string => {
    if (!price || price === 0) return "N/A";
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatDistance = (distance: number | undefined): string => {
    if (!distance) return "N/A";
    return `${distance.toFixed(1)} km`;
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

      if (diffMinutes < 1) return "Hace un momento";
      if (diffMinutes < 60) return `${diffMinutes}m`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`;
      return date.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  const getPriceCompetitiveness = (
    price: number | undefined,
    marketAverage: number | undefined,
  ): "competitive" | "expensive" | "average" | null => {
    if (!price || !marketAverage || marketAverage === 0) return null;

    const difference = ((price - marketAverage) / marketAverage) * 100;
    if (difference < -2) return "competitive";
    if (difference > 2) return "expensive";
    return "average";
  };

  const getPriceStyles = (
    competitiveness: "competitive" | "expensive" | "average" | null,
  ): string => {
    switch (competitiveness) {
      case "competitive":
        return "text-green-600 dark:text-green-400 font-medium";
      case "expensive":
        return "text-red-600 dark:text-red-400 font-medium";
      case "average":
        return "text-yellow-600 dark:text-yellow-400 font-medium";
      default:
        return "text-gray-900 dark:text-white";
    }
  };

  const SortableHeader: React.FC<{
    field: SortField;
    children: React.ReactNode;
    align?: "left" | "right";
  }> = ({ field, children, align = "left" }) => (
    <TableHead
      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none ${align === "right" ? "text-right" : ""}`}
      onClick={() => handleSort(field)}
    >
      <div
        className={`flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}
      >
        <span>{children}</span>
        {sortField === field &&
          (sortOrder === "asc" ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          ))}
      </div>
    </TableHead>
  );

  if (isLoading) {
    return <CompetitorTableSkeleton />;
  }

  if (!competitors.length) {
    return (
      <Card className="p-8 text-center">
        <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No se encontraron competidores
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Intenta ampliar el radio de búsqueda o ajustar los filtros.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card className="overflow-hidden">
          <Table>
            <TableHeader className="sticky top-0 bg-white dark:bg-gray-800 z-10">
              <TableRow>
                <SortableHeader field="nombre">Estación</SortableHeader>
                <SortableHeader field="brand">Marca</SortableHeader>
                <SortableHeader field="distance" align="right">
                  Distancia
                </SortableHeader>
                <SortableHeader field="regular" align="right">
                  Regular
                </SortableHeader>
                <SortableHeader field="premium" align="right">
                  Premium
                </SortableHeader>
                <SortableHeader field="diesel" align="right">
                  Diesel
                </SortableHeader>
                <TableHead className="text-right">Actualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCompetitors.map((station) => (
                <TableRow
                  key={station.numero}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  onClick={() => onStationClick?.(station)}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {station.nombre}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                        {station.direccion}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {station.brand && (
                      <Badge variant="secondary" className="text-xs">
                        {station.brand}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm">
                      {formatDistance(station.distance)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-mono text-sm ${getPriceStyles(
                        getPriceCompetitiveness(
                          station.regular,
                          marketAverages.regular,
                        ),
                      )}`}
                    >
                      {formatPrice(station.regular)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-mono text-sm ${getPriceStyles(
                        getPriceCompetitiveness(
                          station.premium,
                          marketAverages.premium,
                        ),
                      )}`}
                    >
                      {formatPrice(station.premium)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-mono text-sm ${getPriceStyles(
                        getPriceCompetitiveness(
                          station.diesel,
                          marketAverages.diesel,
                        ),
                      )}`}
                    >
                      {formatPrice(station.diesel)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(station.lastUpdated)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {sortedCompetitors.map((station) => (
          <CompetitorCard
            key={station.numero}
            station={station}
            marketAverages={marketAverages}
            onClick={() => onStationClick?.(station)}
          />
        ))}
      </div>
    </div>
  );
};

const CompetitorCard: React.FC<{
  station: CompetitorData;
  marketAverages?: { regular?: number; premium?: number; diesel?: number };
  onClick?: () => void;
}> = ({ station, marketAverages = {}, onClick }) => {
  const formatPrice = (price: number | undefined): string => {
    if (!price || price === 0) return "N/A";
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatDistance = (distance: number | undefined): string => {
    if (!distance) return "N/A";
    return `${distance.toFixed(1)} km`;
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

      if (diffMinutes < 1) return "Hace un momento";
      if (diffMinutes < 60) return `${diffMinutes}m`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h`;
      return date.toLocaleDateString("es-MX");
    } catch {
      return timestamp;
    }
  };

  const getPriceCompetitiveness = (
    price: number | undefined,
    marketAverage: number | undefined,
  ): "competitive" | "expensive" | "average" | null => {
    if (!price || !marketAverage || marketAverage === 0) return null;

    const difference = ((price - marketAverage) / marketAverage) * 100;
    if (difference < -2) return "competitive";
    if (difference > 2) return "expensive";
    return "average";
  };

  const getPriceIcon = (
    competitiveness: "competitive" | "expensive" | "average" | null,
  ): React.ReactNode => {
    switch (competitiveness) {
      case "competitive":
        return <TrendingDown className="w-3 h-3 text-green-500" />;
      case "expensive":
        return <TrendingUp className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  const getPriceStyles = (
    competitiveness: "competitive" | "expensive" | "average" | null,
  ): string => {
    switch (competitiveness) {
      case "competitive":
        return "text-green-600 dark:text-green-400 font-semibold";
      case "expensive":
        return "text-red-600 dark:text-red-400 font-semibold";
      case "average":
        return "text-yellow-600 dark:text-yellow-400 font-semibold";
      default:
        return "text-gray-900 dark:text-white font-semibold";
    }
  };

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-white truncate">
              {station.nombre}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {station.direccion}
            </p>
          </div>
          {station.brand && (
            <Badge variant="secondary" className="text-xs ml-2">
              {station.brand}
            </Badge>
          )}
        </div>

        {/* Distance */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="w-4 h-4" />
            <span>{formatDistance(station.distance)}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3" />
            <span>{formatTimestamp(station.lastUpdated)}</span>
          </div>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-3 gap-3">
          {/* Regular */}
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Regular
            </div>
            <div
              className={`flex items-center justify-center gap-1 text-sm ${getPriceStyles(
                getPriceCompetitiveness(
                  station.regular,
                  marketAverages.regular,
                ),
              )}`}
            >
              {getPriceIcon(
                getPriceCompetitiveness(
                  station.regular,
                  marketAverages.regular,
                ),
              )}
              <span className="font-mono">{formatPrice(station.regular)}</span>
            </div>
          </div>

          {/* Premium */}
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Premium
            </div>
            <div
              className={`flex items-center justify-center gap-1 text-sm ${getPriceStyles(
                getPriceCompetitiveness(
                  station.premium,
                  marketAverages.premium,
                ),
              )}`}
            >
              {getPriceIcon(
                getPriceCompetitiveness(
                  station.premium,
                  marketAverages.premium,
                ),
              )}
              <span className="font-mono">{formatPrice(station.premium)}</span>
            </div>
          </div>

          {/* Diesel */}
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Diesel
            </div>
            <div
              className={`flex items-center justify-center gap-1 text-sm ${getPriceStyles(
                getPriceCompetitiveness(station.diesel, marketAverages.diesel),
              )}`}
            >
              {getPriceIcon(
                getPriceCompetitiveness(station.diesel, marketAverages.diesel),
              )}
              <span className="font-mono">{formatPrice(station.diesel)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

const CompetitorTableSkeleton: React.FC = () => {
  return (
    <div className="space-y-4">
      {/* Desktop Skeleton */}
      <div className="hidden md:block">
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estación</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead className="text-right">Distancia</TableHead>
                <TableHead className="text-right">Regular</TableHead>
                <TableHead className="text-right">Premium</TableHead>
                <TableHead className="text-right">Diesel</TableHead>
                <TableHead className="text-right">Actualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Mobile Skeleton */}
      <div className="md:hidden space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="text-center space-y-1">
                    <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CompetitorTable;
