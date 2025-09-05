# Multi-Station Impact Analysis for Unimplemented Stories

## Overview
This document identifies the changes needed in unimplemented stories to support the multi-station architecture.

## 🔴 Stories Requiring Major Updates

### Story 4.3: Current Prices & Competitor View
**Status**: Draft
**Impact Level**: HIGH

**Changes Needed**:
1. ✅ **Price cards must be station-specific**
   - Add station context to all price displays
   - Show station name/numero on price cards
   - Filter prices by selected station_numero

2. ✅ **Competitor analysis per station**
   - Use selected station's coordinates for distance calculation
   - Show "competitors near [station name]"
   - Recalculate when station switches

3. ✅ **Map view centered on selected station**
   - Plot selected station with special marker
   - Update center when station changes
   - Show selected station info in map legend

**Tasks to Add/Update**:
- Update PriceCard to accept station_numero prop
- Modify CompetitorTable to filter by station location
- Add station switcher integration to map view
- Clear cached competitor data on station change

---

### Story 4.4: Historical Trends Visualization
**Status**: Draft
**Impact Level**: HIGH

**Changes Needed**:
1. ✅ **Charts filtered by station**
   - All historical data queries need station_numero parameter
   - Chart titles should include station name
   - Comparison should be station-specific market average

2. ✅ **Multi-station comparison view** (New Feature)
   - Allow comparing trends across user's stations
   - Add station selector for comparison mode
   - Different line color per station

**Tasks to Add/Update**:
- Update TrendChart to accept station_numero
- Add station name to chart title/legend
- Create new MultiStationComparison component
- Update API calls to include station_numero

---

### Story 4.5: Analytics Dashboard
**Status**: Draft
**Impact Level**: HIGH

**Changes Needed**:
1. ✅ **KPIs per station**
   - Ranking position within station's market
   - Market position relative to station's competitors
   - Station-specific performance metrics

2. ✅ **Dashboard state per station**
   - Save widget layout per station
   - Different KPIs for different station roles
   - Station name prominent in dashboard header

3. ✅ **Multi-station overview mode** (New Feature)
   - Summary card showing all stations
   - Quick performance comparison
   - Best/worst performing stations

**Tasks to Add/Update**:
- Update all KPI calculations to be station-specific
- Modify localStorage keys to include station_numero
- Add station context to all analytics API calls
- Create MultiStationOverview widget

---

### Story 4.6: Mobile Optimization & PWA
**Status**: Draft
**Impact Level**: MEDIUM

**Changes Needed**:
1. ✅ **Mobile station switcher**
   - Optimize station switcher for mobile
   - Add swipe gestures to change stations
   - Show station in mobile header

2. ✅ **Offline station data**
   - Cache data per station
   - Sync selected station data first
   - Handle station switch offline gracefully

**Tasks to Add/Update**:
- Design mobile-optimized station switcher
- Update service worker cache keys with station_numero
- Add offline station data management

---

## 🟡 Epic 5: Alert System (All Stories)

### Story 5.1: Alert Rules Engine
**Impact Level**: HIGH

**Changes Needed**:
1. ✅ **Station-specific alerts**
   - Add station_numero to alert_rules table
   - Rules apply per station, not globally
   - Different thresholds per station

**Database Changes**:
```sql
ALTER TABLE alert_rules 
ADD COLUMN station_numero VARCHAR(50) REFERENCES stations(numero);
```

---

### Story 5.2: Automated Price Monitoring
**Impact Level**: HIGH

**Changes Needed**:
1. ✅ **Monitor each station independently**
   - Separate monitoring jobs per station
   - Station-specific schedules possible
   - Alert only for relevant station

---

### Story 5.3: AI-Powered Recommendations
**Impact Level**: MEDIUM

**Changes Needed**:
1. ✅ **Recommendations per station**
   - AI analyzes each station's market separately
   - Different strategies per station location
   - Consider multi-station portfolio optimization

---

### Story 5.4: Predictive Analytics
**Impact Level**: MEDIUM

**Changes Needed**:
1. ✅ **Predictions per station**
   - Separate models per geographic area
   - Station-specific historical patterns
   - Cross-station correlation analysis

---

### Story 5.5: Opportunity Detection
**Impact Level**: HIGH

**Changes Needed**:
1. ✅ **Opportunities per station**
   - Market gaps specific to station location
   - Different opportunities per station
   - Portfolio-wide opportunity analysis

---

### Story 5.6: Performance Analytics & Reporting
**Impact Level**: HIGH

**Changes Needed**:
1. ✅ **Reports per station and aggregated**
   - Individual station reports
   - Portfolio performance report
   - Comparative analysis across stations
   - Role-based report access

---

## 📋 Implementation Guidelines

### For All Frontend Stories (4.x)

**Standard Updates Required**:
1. Add station context to all API calls
2. Update cache keys to include station_numero
3. Show selected station in UI headers
4. Clear cached data on station switch
5. Handle no-station state gracefully

**Code Pattern**:
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

### For All Backend Stories (5.x)

**Standard Updates Required**:
1. Add station_numero foreign key to relevant tables
2. Filter all queries by station
3. Validate user has access to station
4. Update API responses with station context

**Code Pattern**:
```php
// Before
$alerts = Alert::where('user_id', auth()->id())->get();

// After
$alerts = Alert::where('user_id', auth()->id())
               ->where('station_numero', $request->station_numero)
               ->get();
```

## 🎯 Priority Recommendations

### High Priority Updates
1. **Story 4.3** - Current Prices (fundamental feature)
2. **Story 5.1** - Alert Rules (core functionality)
3. **Story 4.5** - Analytics Dashboard (high value)

### Medium Priority Updates
1. **Story 4.4** - Historical Trends
2. **Story 5.2** - Automated Monitoring
3. **Story 4.6** - Mobile Optimization

### Nice-to-Have Enhancements
1. Multi-station comparison views
2. Portfolio-wide analytics
3. Cross-station optimization

## ✅ Common Patterns to Apply

### Frontend Patterns
```typescript
// Station-aware component
const PriceCard = () => {
  const { selectedStation } = useStation();
  
  if (!selectedStation) {
    return <NoStationState />;
  }
  
  // Component logic with station context
};
```

### Backend Patterns
```php
// Station-aware middleware
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

## 📊 Impact Summary

| Story | Impact Level | Complexity | Priority |
|-------|-------------|------------|----------|
| 4.3 | HIGH | Medium | HIGH |
| 4.4 | HIGH | Medium | MEDIUM |
| 4.5 | HIGH | High | HIGH |
| 4.6 | MEDIUM | Low | LOW |
| 5.1 | HIGH | Medium | HIGH |
| 5.2 | HIGH | Medium | MEDIUM |
| 5.3 | MEDIUM | Low | LOW |
| 5.4 | MEDIUM | Medium | LOW |
| 5.5 | HIGH | Medium | MEDIUM |
| 5.6 | HIGH | High | MEDIUM |

## 🚀 Next Steps

1. **Update Story Files**: Modify each story file with station-specific requirements
2. **Database Migrations**: Add station_numero to alert tables
3. **API Updates**: Ensure all endpoints accept station_numero parameter
4. **Frontend Context**: Implement station context provider before other stories
5. **Testing Strategy**: Include multi-station scenarios in test cases