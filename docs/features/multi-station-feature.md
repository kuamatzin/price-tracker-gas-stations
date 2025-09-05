# Multi-Station Feature Documentation

## Feature Overview

### Original Request
The system was originally designed with a one-to-one relationship between users and stations (one station per user). The new requirement is to support **multi-station management** where users can have multiple fuel stations assigned to their account with different roles (owner, manager, viewer).

### Business Context
- **Multi-station owners** need to manage multiple fuel station locations
- Each station needs independent monitoring, alerts, and analytics
- Users need both individual station views and portfolio-wide insights
- Stations are not created by users - they come from the PEMEX/CRE scraper
- Users search for and assign existing stations to their account

## Database Architecture

### Existing Infrastructure (Discovered)
The database already had the necessary tables in place:

```sql
-- user_stations table (pivot table)
CREATE TABLE user_stations (
    id BIGINT PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    station_numero VARCHAR(50) REFERENCES stations(numero),
    role ENUM('owner', 'manager', 'viewer'),
    assigned_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE KEY unique_user_station (user_id, station_numero)
);

-- stations table
CREATE TABLE stations (
    numero VARCHAR(50) PRIMARY KEY,  -- PEMEX/CRE format: E12345
    nombre VARCHAR(255),
    direccion TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    entidad_id INT,
    municipio_id INT,
    brand VARCHAR(100),
    is_active BOOLEAN
);
```

### Key Technical Decisions
1. **Foreign Key Type**: Use `station_numero` (string) not `station_id` (bigint)
2. **Station Assignment**: Users assign existing stations, don't create new ones
3. **Roles System**: owner, manager, viewer for different permission levels
4. **No Backwards Compatibility**: Development environment, no production users

## Stories Created for Multi-Station Feature

### New Stories (Epic 4)

#### Story 2.7: Backend Multi-Station Support
- **Status**: Created
- **Purpose**: Implement backend API and database relationships
- **Key Changes**: 
  - User model with `belongsToMany` relationship to stations
  - Station assignment endpoints
  - Role-based access control

#### Story 4.7: Station Management Interface
- **Status**: Created
- **Purpose**: Frontend UI for managing user's stations
- **Key Changes**:
  - Station search and assignment interface
  - Role management UI
  - Station removal functionality

#### Story 4.8: Dashboard Multi-Station Updates
- **Status**: Created
- **Purpose**: Update dashboard to support station context
- **Key Changes**:
  - Station switcher component
  - Station context provider
  - Cache keys with station_numero

## Stories Modified for Multi-Station Support

### Frontend Stories (Epic 4)

#### Story 4.3: Current Prices & Competitor View
- **Changes Made**:
  - Price cards display per selected station
  - Competitor analysis relative to selected station
  - Map centers on selected station
  - Station name/numero in all displays

#### Story 4.4: Historical Trends Visualization
- **Changes Made**:
  - Charts filter by station_numero
  - Multi-station comparison feature added
  - Station name in chart titles
  - Cross-station trend analysis

#### Story 4.5: Analytics Dashboard
- **Changes Made**:
  - KPIs calculated per station
  - Multi-station overview widget
  - Dashboard layouts saved per station
  - Station-specific market position

#### Story 4.6: Mobile Optimization & PWA
- **Changes Made**:
  - Mobile station switcher
  - Swipe gestures for station switching
  - Station-aware offline caching
  - Station context in service worker

### Backend Stories (Epic 5)

#### Story 5.1: Alert Rules Engine
- **Changes Made**:
  - Alert rules with station_numero foreign key
  - Different thresholds per station
  - Station-specific alert evaluation
  - Alert history per station

#### Story 5.2: Automated Price Monitoring
- **Changes Made**:
  - Monitoring per station
  - Station-specific thresholds
  - Daily summaries per station
  - Regional alerts per station area

#### Story 5.3: AI-Powered Recommendations
- **Changes Made**:
  - AI analysis per station's market
  - Portfolio-wide recommendations
  - Cross-station effectiveness tracking
  - Station context in all recommendations

#### Story 5.4: Predictive Analytics
- **Changes Made**:
  - Predictions per station
  - Cross-station pattern analysis
  - Portfolio trend predictions
  - Station-specific volatility

#### Story 5.5: Opportunity Detection
- **Changes Made**:
  - Opportunities per station location
  - Portfolio optimization recommendations
  - Cross-station opportunity analysis
  - Coordinated pricing strategies

#### Story 5.6: Performance Analytics & Reporting
- **Changes Made**:
  - Reports per station and portfolio
  - Cross-station performance metrics
  - Multi-station benchmarking
  - ROI analysis per station

## Implementation Patterns

### Frontend Patterns

#### API Calls with Station Context
```typescript
// Before
const { data } = useQuery(['prices'], () => api.getPrices());

// After
const { selectedStation } = useStation();
const { data } = useQuery(
  ['prices', selectedStation?.numero],
  () => api.getPrices(selectedStation?.numero),
  { enabled: !!selectedStation }
);
```

#### Cache Key Strategy
```typescript
// Include station_numero in all cache keys
const cacheKey = ['resource', stationNumero, userId, timestamp];
```

#### Station Context Provider
```typescript
interface StationContextValue {
  selectedStation: UserStation | null;
  stations: UserStation[];
  selectStation: (numero: string) => void;
  isLoading: boolean;
}
```

### Backend Patterns

#### API Endpoint Structure
```php
// Station-specific endpoints
Route::get('/api/v1/stations/{numero}/prices', [PriceController::class, 'getStationPrices']);
Route::get('/api/v1/stations/{numero}/alerts', [AlertController::class, 'getStationAlerts']);

// Portfolio endpoints
Route::get('/api/v1/portfolio/overview', [PortfolioController::class, 'getOverview']);
Route::get('/api/v1/portfolio/comparison', [PortfolioController::class, 'compareStations']);
```

#### Station Access Validation
```php
class EnsureStationAccess
{
    public function handle($request, Closure $next)
    {
        $stationNumero = $request->station_numero;
        
        if (!auth()->user()->stations()->where('numero', $stationNumero)->exists()) {
            abort(403, 'Unauthorized access to station');
        }
        
        return $next($request);
    }
}
```

#### Query Filtering
```php
// Filter by station
$prices = PriceChange::where('station_numero', $stationNumero)
                     ->where('fuel_type', $fuelType)
                     ->latest('changed_at')
                     ->get();
```

## Next Steps

### 1. Implementation Order
1. **Backend Foundation** (Story 2.7)
   - Implement User-Station relationships
   - Create station assignment API
   - Add role-based middleware

2. **Frontend Infrastructure** (Story 4.8)
   - Station context provider
   - Station switcher component
   - Update Zustand stores

3. **Station Management UI** (Story 4.7)
   - Station search interface
   - Assignment workflow
   - Role management

4. **Update Existing Features**
   - Current Prices (Story 4.3)
   - Historical Trends (Story 4.4)
   - Analytics Dashboard (Story 4.5)

5. **Backend Services**
   - Alert Rules (Story 5.1)
   - Price Monitoring (Story 5.2)
   - Remaining Epic 5 stories

### 2. Database Migrations Required
```sql
-- Add station_numero to alert_rules
ALTER TABLE alert_rules 
ADD COLUMN station_numero VARCHAR(50) REFERENCES stations(numero);

-- Add station_numero to alert_histories
ALTER TABLE alert_histories
ADD COLUMN station_numero VARCHAR(50) REFERENCES stations(numero);

-- Add indexes for performance
CREATE INDEX idx_alert_rules_station ON alert_rules(station_numero);
CREATE INDEX idx_alert_histories_station ON alert_histories(station_numero);
```

### 3. Testing Strategy
- **Unit Tests**: Test multi-station data isolation
- **Integration Tests**: Test station assignment workflow
- **E2E Tests**: Test station switching UI flow
- **Permission Tests**: Verify role-based access control
- **Performance Tests**: Test with users having 10+ stations

### 4. Development Guidelines
- Always include station_numero in API calls
- Update cache keys to include station context
- Show station name/numero in all UI displays
- Clear cached data when switching stations
- Handle no-station state gracefully
- Validate station access in all endpoints

### 5. UI/UX Considerations
- Station switcher accessible from all screens
- Clear indication of selected station
- Quick station switch shortcuts
- Station comparison views where relevant
- Portfolio overview for multi-station users
- Mobile-optimized station selection

### 6. Performance Optimizations
- Lazy load station data
- Cache station data with TTL
- Batch API calls per station
- Prioritize selected station in sync
- Background sync for other stations
- Pagination for users with many stations

## Technical Debt & Considerations

### Items to Address
1. **Station Limits**: Define max stations per user (suggest 20)
2. **Data Retention**: Policy for inactive station data
3. **Bulk Operations**: Batch assignment/removal of stations
4. **Export Features**: Include station context in all exports
5. **Notification Preferences**: Per-station notification settings
6. **API Rate Limiting**: Consider per-station rate limits

### Migration Risks
- No production data to migrate (development only)
- Ensure scraper continues populating stations table
- Validate station_numero format consistency
- Handle orphaned station assignments

## Success Metrics
- Users can manage multiple stations efficiently
- Station context is clear in all views
- Performance remains fast with multiple stations
- Alerts and monitoring work per station
- Portfolio insights provide value

## Resources & References
- Original multi-station analysis: `/docs/analysis/multi-station-story-updates.md`
- Station scraper documentation: Check scraper service docs
- PEMEX/CRE station ID format: E##### (e.g., E12345)
- Database schema: `/apps/api/database/migrations/`

---

**Document Version**: 1.0  
**Created**: 2025-01-04  
**Last Updated**: 2025-01-04  
**Author**: Development Team  
**Status**: Ready for Implementation