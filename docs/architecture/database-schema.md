# Database Schema

```sql
-- Estados (Mexican states)
CREATE TABLE entidades (
    id INTEGER PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    codigo VARCHAR(10)
);

-- Municipios (Municipalities)
CREATE TABLE municipios (
    id INTEGER PRIMARY KEY,
    entidad_id INTEGER NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    FOREIGN KEY (entidad_id) REFERENCES entidades(id),
    INDEX idx_entidad (entidad_id)
);

-- Gas Stations
CREATE TABLE stations (
    numero VARCHAR(50) PRIMARY KEY, -- Government permit number
    nombre VARCHAR(255) NOT NULL,
    direccion TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    entidad_id INTEGER NOT NULL,
    municipio_id INTEGER NOT NULL,
    brand VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (entidad_id) REFERENCES entidades(id),
    FOREIGN KEY (municipio_id) REFERENCES municipios(id),
    INDEX idx_location (entidad_id, municipio_id),
    INDEX idx_coords (lat, lng)
);

-- Price changes (only stores when price changes)
CREATE TABLE price_changes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    station_numero VARCHAR(50) NOT NULL,
    fuel_type ENUM('regular', 'premium', 'diesel') NOT NULL,
    subproducto TEXT, -- Original government description
    price DECIMAL(5,2) NOT NULL,
    changed_at TIMESTAMP NOT NULL, -- When price actually changed
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- When we detected it
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (station_numero) REFERENCES stations(numero),
    INDEX idx_station_fuel (station_numero, fuel_type),
    INDEX idx_changed (changed_at),
    INDEX idx_station_fuel_changed (station_numero, fuel_type, changed_at DESC)
);

-- Users
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    telegram_chat_id VARCHAR(50) UNIQUE,
    subscription_tier ENUM('free', 'basic', 'premium') DEFAULT 'free',
    notification_preferences JSON,
    api_rate_limit INTEGER DEFAULT 100,
    email_verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_telegram (telegram_chat_id)
);

-- User-Station relationship
CREATE TABLE user_stations (
    user_id CHAR(36) PRIMARY KEY,
    station_numero VARCHAR(50) NOT NULL,
    role ENUM('owner', 'manager', 'viewer') DEFAULT 'owner',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (station_numero) REFERENCES stations(numero)
);

-- Alerts
CREATE TABLE alerts (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type ENUM('price_change', 'competitor_move', 'market_trend') NOT NULL,
    conditions JSON NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_active (user_id, is_active)
);

-- Alert notifications history
CREATE TABLE alert_notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    alert_id CHAR(36) NOT NULL,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    channel ENUM('telegram', 'email', 'web') NOT NULL,
    delivered BOOLEAN DEFAULT false,
    content TEXT,
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE,
    INDEX idx_alert_time (alert_id, triggered_at DESC)
);

-- Scraper runs history
CREATE TABLE scraper_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP NULL,
    status ENUM('running', 'completed', 'failed') DEFAULT 'running',
    estados_processed INTEGER DEFAULT 0,
    municipios_processed INTEGER DEFAULT 0,
    stations_found INTEGER DEFAULT 0,
    price_changes_detected INTEGER DEFAULT 0,
    errors JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API tokens for service communication
CREATE TABLE api_tokens (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36),
    name VARCHAR(255) NOT NULL,
    token VARCHAR(80) UNIQUE NOT NULL,
    abilities JSON,
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token)
);
```
