# Data Models

## Station Model

**Purpose:** Represents a gas station with its location and identification details

**Key Attributes:**

- numero: string - Government-assigned station ID (primary key)
- nombre: string - Station name
- direccion: string - Physical address
- lat: decimal - Latitude coordinate
- lng: decimal - Longitude coordinate
- entidad_id: number - State/entity ID
- municipio_id: number - Municipality ID
- brand: string (nullable) - Station brand (Pemex, Shell, etc.)
- is_active: boolean - Whether station is currently operating

**TypeScript Interface:**

```typescript
interface Station {
  numero: string;
  nombre: string;
  direccion: string;
  lat: number;
  lng: number;
  entidad_id: number;
  municipio_id: number;
  brand?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

**Relationships:**

- Has many PriceChanges
- Belongs to Entidad
- Belongs to Municipio
- Has one UserStation (for registered owners)

## PriceChange Model

**Purpose:** Stores only price changes to minimize storage while maintaining complete history

**Key Attributes:**

- id: bigint - Auto-incrementing primary key
- station_numero: string - Foreign key to Station
- fuel_type: enum - Type of fuel ('regular', 'premium', 'diesel')
- subproducto: string - Full government fuel description
- price: decimal(5,2) - Price in MXN
- changed_at: timestamp - When price changed at station
- detected_at: timestamp - When our scraper detected the change

**TypeScript Interface:**

```typescript
type FuelType = "regular" | "premium" | "diesel";

interface PriceChange {
  id: number;
  station_numero: string;
  fuel_type: FuelType;
  subproducto: string;
  price: number;
  changed_at: string;
  detected_at: string;
  created_at: string;
}
```

**Relationships:**

- Belongs to Station

## User Model

**Purpose:** Represents gas station owners/managers using the platform

**Key Attributes:**

- id: uuid - Primary key
- email: string - Login email
- name: string - User's full name
- telegram_chat_id: string (nullable) - For bot integration
- subscription_tier: enum - 'free', 'basic', 'premium'
- notification_preferences: jsonb - Detailed alert settings
- api_rate_limit: integer - Requests per hour based on tier

**TypeScript Interface:**

```typescript
type SubscriptionTier = "free" | "basic" | "premium";

interface User {
  id: string;
  email: string;
  name: string;
  telegram_chat_id?: string;
  subscription_tier: SubscriptionTier;
  notification_preferences: NotificationPreferences;
  api_rate_limit: number;
  created_at: string;
  updated_at: string;
}

interface NotificationPreferences {
  price_change_threshold: number; // percentage
  alert_radius_km: number;
  fuel_types: FuelType[];
  daily_summary_time?: string; // HH:mm format
  telegram_enabled: boolean;
  email_enabled: boolean;
}
```

**Relationships:**

- Has one UserStation
- Has many Alerts
- Has many ApiTokens

## Alert Model

**Purpose:** Configurable alerts for price changes and market conditions

**Key Attributes:**

- id: uuid - Primary key
- user_id: uuid - Foreign key to User
- name: string - User-defined alert name
- type: enum - 'price_change', 'competitor_move', 'market_trend'
- conditions: jsonb - Alert trigger conditions
- is_active: boolean - Whether alert is enabled
- last_triggered_at: timestamp - Last time alert fired

**TypeScript Interface:**

```typescript
type AlertType = "price_change" | "competitor_move" | "market_trend";

interface Alert {
  id: string;
  user_id: string;
  name: string;
  type: AlertType;
  conditions: AlertConditions;
  is_active: boolean;
  last_triggered_at?: string;
  created_at: string;
  updated_at: string;
}

interface AlertConditions {
  fuel_types?: FuelType[];
  threshold_percentage?: number;
  threshold_amount?: number;
  competitor_stations?: string[];
  radius_km?: number;
  comparison_type?: "above" | "below" | "any";
}
```

**Relationships:**

- Belongs to User
- Has many AlertNotifications (history)

## Entidad Model

**Purpose:** Mexican states/entities for geographic organization

**Key Attributes:**

- id: number - Government-assigned entity ID
- nombre: string - State name
- codigo: string - State code (e.g., 'CDMX')

**TypeScript Interface:**

```typescript
interface Entidad {
  id: number;
  nombre: string;
  codigo: string;
}
```

**Relationships:**

- Has many Municipios
- Has many Stations

## Municipio Model

**Purpose:** Municipalities within states for local competition analysis

**Key Attributes:**

- id: number - Government-assigned municipality ID
- entidad_id: number - Foreign key to Entidad
- nombre: string - Municipality name

**TypeScript Interface:**

```typescript
interface Municipio {
  id: number;
  entidad_id: number;
  nombre: string;
}
```

**Relationships:**

- Belongs to Entidad
- Has many Stations
