import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface PriceCardProps {
  fuelType: "regular" | "premium" | "diesel";
  currentPrice: number;
  previousPrice?: number;
  marketAverage?: number;
  lastUpdated: string;
  isLoading?: boolean;
}

export const PriceCard: React.FC<PriceCardProps> = ({
  fuelType,
  currentPrice,
  previousPrice,
  marketAverage,
  lastUpdated,
  isLoading = false,
}) => {
  const priceData = useMemo(() => {
    const change = previousPrice ? currentPrice - previousPrice : 0;
    const changePercentage =
      previousPrice && previousPrice > 0 ? (change / previousPrice) * 100 : 0;

    let trend: "up" | "down" | "stable" = "stable";
    if (Math.abs(changePercentage) > 0.1) {
      trend = changePercentage > 0 ? "up" : "down";
    }

    // Calculate competitiveness if market average is provided
    let competitiveness: "competitive" | "average" | "expensive" | null = null;
    if (marketAverage && marketAverage > 0) {
      const difference = ((currentPrice - marketAverage) / marketAverage) * 100;
      if (difference < -2) {
        competitiveness = "competitive";
      } else if (difference > 2) {
        competitiveness = "expensive";
      } else {
        competitiveness = "average";
      }
    }

    return {
      change,
      changePercentage: Math.abs(changePercentage),
      trend,
      competitiveness,
    };
  }, [currentPrice, previousPrice, marketAverage]);

  const formatFuelType = (type: string): string => {
    const types = {
      regular: "Regular",
      premium: "Premium",
      diesel: "Diesel",
    };
    return types[type as keyof typeof types] || type;
  };

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

      if (diffMinutes < 1) return "Hace un momento";
      if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
      if (diffMinutes < 1440) return `Hace ${Math.floor(diffMinutes / 60)} h`;
      return date.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  const getTrendIcon = () => {
    switch (priceData.trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getCompetitivenessStyles = () => {
    switch (priceData.competitiveness) {
      case "competitive":
        return "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300";
      case "expensive":
        return "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300";
      case "average":
        return "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-300";
      default:
        return "bg-white border-gray-200 text-gray-800 dark:bg-gray-800 dark:border-gray-700 dark:text-white";
    }
  };

  const getCompetitivenessLabel = () => {
    switch (priceData.competitiveness) {
      case "competitive":
        return "Competitivo";
      case "expensive":
        return "Elevado";
      case "average":
        return "Promedio";
      default:
        return null;
    }
  };

  if (isLoading) {
    return <PriceCardSkeleton />;
  }

  return (
    <Card className={`p-4 ${getCompetitivenessStyles()}`}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-sm uppercase tracking-wide">
              {formatFuelType(fuelType)}
            </h3>
            {priceData.competitiveness && (
              <Badge
                variant={
                  priceData.competitiveness === "competitive"
                    ? "default"
                    : "secondary"
                }
                className="text-xs"
              >
                {getCompetitivenessLabel()}
              </Badge>
            )}
          </div>
          {getTrendIcon()}
        </div>

        {/* Main Price */}
        <div className="space-y-1">
          <div className="text-2xl font-bold">{formatPrice(currentPrice)}</div>

          {/* Price Change */}
          {previousPrice && priceData.changePercentage > 0 && (
            <div className="flex items-center space-x-2 text-sm">
              <span
                className={`font-medium ${
                  priceData.trend === "up"
                    ? "text-red-600 dark:text-red-400"
                    : priceData.trend === "down"
                      ? "text-green-600 dark:text-green-400"
                      : "text-gray-500"
                }`}
              >
                {priceData.trend === "up"
                  ? "+"
                  : priceData.trend === "down"
                    ? "-"
                    : ""}
                {formatPrice(Math.abs(priceData.change))}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                ({priceData.changePercentage.toFixed(1)}%)
              </span>
            </div>
          )}
        </div>

        {/* Market Comparison */}
        {marketAverage && (
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>Promedio de mercado:</span>
              <span className="font-medium">{formatPrice(marketAverage)}</span>
            </div>
            <div className="flex justify-between">
              <span>Diferencia:</span>
              <span
                className={`font-medium ${
                  currentPrice < marketAverage
                    ? "text-green-600 dark:text-green-400"
                    : currentPrice > marketAverage
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-500"
                }`}
              >
                {currentPrice < marketAverage
                  ? "-"
                  : currentPrice > marketAverage
                    ? "+"
                    : ""}
                {formatPrice(Math.abs(currentPrice - marketAverage))}
              </span>
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 border-t pt-2">
          <Clock className="w-3 h-3" />
          <span>Actualizado {formatTimestamp(lastUpdated)}</span>
        </div>
      </div>
    </Card>
  );
};

export const PriceCardSkeleton: React.FC = () => {
  return (
    <Card className="p-4 bg-white dark:bg-gray-800">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="space-y-1">
          <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="flex items-center space-x-1 border-t pt-2">
          <div className="h-3 w-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
    </Card>
  );
};

export default PriceCard;
