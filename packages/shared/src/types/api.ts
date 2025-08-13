import { Station, PriceChange, User, Alert, FuelType } from "./models";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ApiMeta {
  page?: number;
  per_page?: number;
  total?: number;
  total_pages?: number;
  timestamp?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
    from: number;
    to: number;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  expires_at: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone?: string;
}

export interface NearbyStationsRequest {
  latitude: number;
  longitude: number;
  radius_km?: number;
  fuel_type?: FuelType;
  sort_by?: "distance" | "price";
  limit?: number;
}

export interface NearbyStationsResponse {
  stations: StationWithPrice[];
  center: {
    latitude: number;
    longitude: number;
  };
  radius_km: number;
}

export interface StationWithPrice extends Station {
  current_prices: {
    regular?: number;
    premium?: number;
    diesel?: number;
  };
  distance_km?: number;
  last_update?: Date;
}

export interface PriceHistoryRequest {
  station_id: string;
  fuel_type?: FuelType;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface PriceStatistics {
  fuel_type: FuelType;
  current_price: number;
  min_price: number;
  max_price: number;
  avg_price: number;
  median_price: number;
  std_deviation: number;
  price_changes_count: number;
  last_change_date: Date;
  trend: "up" | "down" | "stable";
}

export interface CreateAlertRequest {
  type: string;
  station_id?: string;
  fuel_type?: FuelType;
  radius_km?: number;
  latitude?: number;
  longitude?: number;
  threshold_percentage?: number;
}

export interface WebhookPayload {
  event: WebhookEvent;
  data: Record<string, any>;
  timestamp: string;
  signature: string;
}

export enum WebhookEvent {
  PRICE_UPDATED = "price.updated",
  STATION_ADDED = "station.added",
  STATION_DEACTIVATED = "station.deactivated",
  ALERT_TRIGGERED = "alert.triggered",
}
