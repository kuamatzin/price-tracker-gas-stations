import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from "@radix-ui/react-icons";
import { FuelType } from "@fuelintel/shared";
import { cn } from "@/lib/utils";

interface PriceCardProps {
  station_numero: string;
  stationName: string;
  fuelType: FuelType;
  currentPrice: number;
  previousPrice?: number;
  lastUpdated: string;
  marketAverage?: number;
  isLoading?: boolean;
}

export const PriceCard: React.FC<PriceCardProps> = ({
  station_numero,
  stationName,
  fuelType,
  currentPrice,
  previousPrice,
  lastUpdated,
  marketAverage,
  isLoading,
}) => {
  const priceChange = useMemo(() => {
    if (!previousPrice) return null;
    return currentPrice - previousPrice;
  }, [currentPrice, previousPrice]);

  const percentageChange = useMemo(() => {
    if (!previousPrice || previousPrice === 0) return null;
    return ((currentPrice - previousPrice) / previousPrice) * 100;
  }, [currentPrice, previousPrice]);

  const priceCompetitiveness = useMemo(() => {
    if (!marketAverage) return "average";
    const percentDiff = ((currentPrice - marketAverage) / marketAverage) * 100;
    if (percentDiff < -2) return "competitive";
    if (percentDiff > 2) return "expensive";
    return "average";
  }, [currentPrice, marketAverage]);

  const getTrendIcon = () => {
    if (!priceChange) return <MinusIcon className="h-4 w-4" />;
    if (priceChange > 0) return <ArrowUpIcon className="h-4 w-4" />;
    if (priceChange < 0) return <ArrowDownIcon className="h-4 w-4" />;
    return <MinusIcon className="h-4 w-4" />;
  };

  const getTrendColor = () => {
    if (!priceChange) return "text-gray-500";
    return priceChange > 0 ? "text-red-500" : "text-green-500";
  };

  const getCompetitivenessStyles = () => {
    switch (priceCompetitiveness) {
      case "competitive":
        return "border-green-500 bg-green-50";
      case "expensive":
        return "border-red-500 bg-red-50";
      default:
        return "border-yellow-500 bg-yellow-50";
    }
  };

  const getFuelTypeLabel = () => {
    switch (fuelType) {
      case FuelType.REGULAR:
        return "Regular";
      case FuelType.PREMIUM:
        return "Premium";
      case FuelType.DIESEL:
        return "Diésel";
      default:
        return fuelType;
    }
  };

  if (isLoading) {
    return <PriceCardSkeleton />;
  }

  return (
    <Card
      className={cn("relative overflow-hidden", getCompetitivenessStyles())}
    >
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-gray-500 font-mono">#{station_numero}</p>
            <CardTitle className="text-lg">{stationName}</CardTitle>
          </div>
          <span className="text-sm font-medium px-2 py-1 bg-gray-100 rounded">
            {getFuelTypeLabel()}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              ${currentPrice.toFixed(2)}
            </span>
            <span className="text-sm text-gray-500">MXN/L</span>
          </div>

          {priceChange !== null && (
            <div className={cn("flex items-center gap-2", getTrendColor())}>
              {getTrendIcon()}
              <span className="text-sm font-medium">
                {priceChange > 0 ? "+" : ""}
                {priceChange.toFixed(2)}
              </span>
              {percentageChange !== null && (
                <span className="text-xs">
                  ({percentageChange > 0 ? "+" : ""}
                  {percentageChange.toFixed(1)}%)
                </span>
              )}
            </div>
          )}

          {marketAverage && (
            <div className="text-xs text-gray-500">
              Promedio del mercado: ${marketAverage.toFixed(2)}
            </div>
          )}

          <div className="text-xs text-gray-400">
            Actualizado: {new Date(lastUpdated).toLocaleString("es-MX")}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const PriceCardSkeleton: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-36 bg-gray-200 rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
};
