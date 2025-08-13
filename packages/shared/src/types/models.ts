export interface Station {
  id: string;
  cre_id: string;
  name: string;
  brand: string;
  address: string;
  latitude: number;
  longitude: number;
  estado: string;
  municipio: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PriceChange {
  id: string;
  station_id: string;
  fuel_type: FuelType;
  old_price: number | null;
  new_price: number;
  change_amount: number | null;
  change_percentage: number | null;
  detected_at: Date;
  created_at: Date;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  telegram_id?: string;
  preferred_notification: NotificationChannel;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Alert {
  id: string;
  user_id: string;
  type: AlertType;
  station_id?: string;
  fuel_type?: FuelType;
  radius_km?: number;
  latitude?: number;
  longitude?: number;
  threshold_percentage?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Competitor {
  id: string;
  scraper_id: string;
  name: string;
  url: string;
  selector_config: Record<string, any>;
  is_active: boolean;
  last_scraped_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PricePrediction {
  id: string;
  station_id?: string;
  fuel_type: FuelType;
  predicted_price: number;
  confidence_score: number;
  prediction_date: Date;
  horizon_days: number;
  created_at: Date;
}

export enum FuelType {
  REGULAR = "regular",
  PREMIUM = "premium",
  DIESEL = "diesel",
}

export enum NotificationChannel {
  EMAIL = "email",
  SMS = "sms",
  TELEGRAM = "telegram",
}

export enum AlertType {
  PRICE_DROP = "price_drop",
  PRICE_INCREASE = "price_increase",
  NEARBY_CHEAPEST = "nearby_cheapest",
  FAVORITE_STATION = "favorite_station",
  THRESHOLD = "threshold",
}
