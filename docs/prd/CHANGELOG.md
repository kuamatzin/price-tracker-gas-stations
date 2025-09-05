# PRD Changelog

## [2.0.0] - 2025-01-04

### Added - Multi-Station Feature Support

#### New Stories
- **Story 2.7**: Multi-Station Backend Support (Epic 2)
  - Backend API for managing multiple stations per user
  - User-station relationship with roles (owner, manager, viewer)
  - Station assignment and removal endpoints
  
- **Story 4.7**: Station Management Interface (Epic 4)
  - Frontend UI for searching and assigning stations
  - Station management dashboard
  - Role management interface
  
- **Story 4.8**: Dashboard Multi-Station Updates (Epic 4)
  - Station switcher component
  - Station context provider
  - Station-aware caching strategy

#### Updated Stories
All existing unimplemented stories in Epics 4 and 5 have been updated to support multi-station architecture:

**Epic 4 Updates:**
- Story 4.3: Current Prices & Competitor View - Added station context
- Story 4.4: Historical Trends - Added multi-station comparison
- Story 4.5: Analytics Dashboard - Added per-station KPIs and portfolio view
- Story 4.6: Mobile PWA - Added mobile station switcher

**Epic 5 Updates:**
- Story 5.1: Alert Rules Engine - Station-specific alerts
- Story 5.2: Automated Monitoring - Per-station monitoring
- Story 5.3: AI Recommendations - Station-aware AI analysis
- Story 5.4: Predictive Analytics - Cross-station predictions
- Story 5.5: Opportunity Detection - Portfolio optimization
- Story 5.6: Performance Reporting - Multi-station reports

### Changed
- Epic 2: Increased from 6 to 7 stories
- Epic 4: Increased from 6 to 8 stories
- Updated epic descriptions to reflect multi-station support
- Modified acceptance criteria across all affected stories

### Technical Impact
- Database: Utilizes existing `user_stations` pivot table
- API: New station-specific endpoints pattern `/api/v1/stations/{numero}/...`
- Frontend: Station context provider and switcher components
- Caching: Station-aware cache keys to prevent data mixing

### Documentation
- Created `/docs/features/multi-station-feature.md` for implementation reference
- Updated all PRD files to reflect multi-station architecture

---

## [1.0.0] - 2024-08-31

### Initial Release
- Original PRD with 5 epics and 33 stories
- Single station per user architecture
- Core features: data pipeline, API, Telegram bot, web dashboard, intelligence system

---

**Note**: Version 2.0.0 represents a major architectural change to support multi-station management while maintaining backward compatibility in development environment.