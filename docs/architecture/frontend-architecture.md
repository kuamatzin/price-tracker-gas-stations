# Frontend Architecture

## Component Architecture

### Component Organization

```
/apps/web/src/
├── components/
│   ├── ui/              # shadcn/ui base components
│   ├── common/          # Shared components
│   │   ├── Layout/
│   │   ├── Navigation/
│   │   └── LoadingStates/
│   ├── features/        # Feature-specific components
│   │   ├── pricing/
│   │   │   ├── PriceCard.tsx
│   │   │   ├── PriceComparison.tsx
│   │   │   └── PriceHistory.tsx
│   │   ├── stations/
│   │   │   ├── StationCard.tsx
│   │   │   └── StationMap.tsx
│   │   └── alerts/
│   │       ├── AlertForm.tsx
│   │       └── AlertList.tsx
│   └── charts/         # Chart components
│       ├── TrendChart.tsx
│       └── ComparisonChart.tsx
├── pages/              # Route components
├── hooks/              # Custom React hooks
├── services/           # API service layer
├── stores/             # Zustand stores
└── utils/              # Utilities
```

### Component Template

```typescript
// components/features/pricing/PriceCard.tsx
import { FC, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FuelType, PriceData } from '@/types';

interface PriceCardProps {
  fuelType: FuelType;
  currentPrice: number;
  previousPrice?: number;
  marketAverage?: number;
  lastUpdated: string;
  className?: string;
}

export const PriceCard: FC<PriceCardProps> = memo(({
  fuelType,
  currentPrice,
  previousPrice,
  marketAverage,
  lastUpdated,
  className
}) => {
  const priceChange = previousPrice ? currentPrice - previousPrice : 0;
  const percentChange = previousPrice ? (priceChange / previousPrice) * 100 : 0;
  const trend = priceChange > 0 ? 'up' : priceChange < 0 ? 'down' : 'stable';

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>{fuelType.toUpperCase()}</span>
          {trend === 'up' && <TrendingUp className="h-5 w-5 text-red-500" />}
          {trend === 'down' && <TrendingDown className="h-5 w-5 text-green-500" />}
          {trend === 'stable' && <Minus className="h-5 w-5 text-gray-500" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">${currentPrice.toFixed(2)}</div>
        {percentChange !== 0 && (
          <div className={cn(
            'text-sm mt-1',
            trend === 'up' ? 'text-red-500' : 'text-green-500'
          )}>
            {priceChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%
          </div>
        )}
        {marketAverage && (
          <div className="text-sm text-gray-500 mt-2">
            Promedio: ${marketAverage.toFixed(2)}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
```

## State Management Architecture

### State Structure

```typescript
// stores/types.ts
interface AppState {
  // User state
  user: {
    profile: User | null;
    station: Station | null;
    preferences: UserPreferences;
  };

  // Pricing state
  pricing: {
    currentPrices: Record<FuelType, number>;
    competitors: Station[];
    history: PriceChange[];
    lastUpdated: string;
  };

  // UI state
  ui: {
    sidebarOpen: boolean;
    activeFilters: FilterState;
    loading: Set<string>;
    errors: Record<string, Error>;
  };

  // Alerts state
  alerts: {
    list: Alert[];
    unreadCount: number;
  };
}
```

### State Management Patterns

- Single source of truth with Zustand stores
- Optimistic updates for better UX
- Normalized data structures for efficient updates
- Computed values using selectors
- Middleware for persistence and logging

## Routing Architecture

### Route Organization

```
/                         # Dashboard home
/login                    # Authentication
/register                 # User registration
/prices                   # Price management
  /current               # Current prices view
  /history               # Historical trends
  /compare               # Competitor comparison
/alerts                   # Alert management
  /new                   # Create alert
  /:id                   # Alert details
/analytics               # Analytics dashboard
/settings                # User settings
  /profile              # Profile management
  /station              # Station configuration
  /subscription         # Plan management
```

### Protected Route Pattern

```typescript
// components/common/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

export const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
```

## Frontend Services Layer

### API Client Setup

```typescript
// services/api-client.ts
import axios, { AxiosInstance } from "axios";
import { useAuthStore } from "@/stores/auth";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Request interceptor for auth
    this.client.interceptors.request.use((config) => {
      const token = useAuthStore.getState().token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          useAuthStore.getState().logout();
        }
        return Promise.reject(error);
      },
    );
  }

  get<T>(url: string, config?: any) {
    return this.client.get<T>(url, config);
  }

  post<T>(url: string, data?: any, config?: any) {
    return this.client.post<T>(url, data, config);
  }

  put<T>(url: string, data?: any, config?: any) {
    return this.client.put<T>(url, data, config);
  }

  delete<T>(url: string, config?: any) {
    return this.client.delete<T>(url, config);
  }
}

export const apiClient = new ApiClient();
```

### Service Example

```typescript
// services/pricing.service.ts
import { apiClient } from "./api-client";
import { Station, PriceHistory } from "@/types";

export const pricingService = {
  async getCurrentPrices(filters?: PriceFilters) {
    const { data } = await apiClient.get<{ data: Station[] }>(
      "/prices/current",
      {
        params: filters,
      },
    );
    return data.data;
  },

  async getNearbyPrices(lat: number, lng: number, radiusKm = 5) {
    const { data } = await apiClient.get<{ data: Station[] }>(
      "/prices/nearby",
      {
        params: { lat, lng, radius_km: radiusKm },
      },
    );
    return data.data;
  },

  async getPriceHistory(stationId: string, days = 7) {
    const { data } = await apiClient.get<PriceHistory>(
      `/prices/history/${stationId}`,
      { params: { days } },
    );
    return data;
  },

  async getCompetitorAnalysis(radiusKm = 5) {
    const { data } = await apiClient.get("/competitors", {
      params: { radius_km: radiusKm },
    });
    return data;
  },
};
```
