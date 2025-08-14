import { PoolClient } from "pg";
import { getPool, withTransaction } from "./connection";

export interface Station {
  numero: string;
  nombre: string;
  direccion: string;
  lat?: number;
  lng?: number;
  entidad_id: number;
  municipio_id: number;
  brand?: string;
  is_active?: boolean;
}

export interface PriceChange {
  station_numero: string;
  fuel_type: "regular" | "premium" | "diesel";
  subproducto: string;
  price: number;
  changed_at: Date;
}

export interface LastPrice {
  station_numero: string;
  fuel_type: string;
  price: number;
  changed_at: Date;
}

export async function getLastPricesByStation(
  stationNumero: string,
): Promise<LastPrice[]> {
  const query = `
    SELECT station_numero, fuel_type, price, changed_at
    FROM price_changes pc1
    WHERE station_numero = $1
      AND (station_numero, fuel_type, changed_at) IN (
        SELECT station_numero, fuel_type, MAX(changed_at)
        FROM price_changes
        WHERE station_numero = $1
        GROUP BY station_numero, fuel_type
      )
  `;

  const pool = getPool();
  const result = await pool.query(query, [stationNumero]);
  return result.rows;
}

export async function getAllLastPrices(): Promise<Map<string, LastPrice>> {
  const query = `
    SELECT DISTINCT ON (station_numero, fuel_type) 
      station_numero, fuel_type, price, changed_at
    FROM price_changes
    ORDER BY station_numero, fuel_type, changed_at DESC
  `;

  const pool = getPool();
  const result = await pool.query(query);

  const priceMap = new Map<string, LastPrice>();
  for (const row of result.rows) {
    const key = `${row.station_numero}:${row.fuel_type}`;
    priceMap.set(key, row);
  }
  return priceMap;
}

export async function upsertStation(station: Station): Promise<void> {
  const query = `
    INSERT INTO stations (numero, nombre, direccion, lat, lng, entidad_id, municipio_id, brand, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (numero) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      direccion = EXCLUDED.direccion,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      entidad_id = EXCLUDED.entidad_id,
      municipio_id = EXCLUDED.municipio_id,
      brand = EXCLUDED.brand,
      is_active = EXCLUDED.is_active
  `;

  const pool = getPool();
  await pool.query(query, [
    station.numero,
    station.nombre,
    station.direccion,
    station.lat || null,
    station.lng || null,
    station.entidad_id,
    station.municipio_id,
    station.brand || null,
    station.is_active !== false,
  ]);
}

export async function insertPriceChange(
  priceChange: PriceChange,
): Promise<void> {
  const query = `
    INSERT INTO price_changes (station_numero, fuel_type, subproducto, price, changed_at, detected_at)
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
  `;

  const pool = getPool();
  await pool.query(query, [
    priceChange.station_numero,
    priceChange.fuel_type,
    priceChange.subproducto,
    priceChange.price,
    priceChange.changed_at,
  ]);
}

export async function batchInsertPriceChanges(
  priceChanges: PriceChange[],
): Promise<void> {
  if (priceChanges.length === 0) return;

  await withTransaction(async (client: PoolClient) => {
    const query = `
      INSERT INTO price_changes (station_numero, fuel_type, subproducto, price, changed_at, detected_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `;

    for (const priceChange of priceChanges) {
      await client.query(query, [
        priceChange.station_numero,
        priceChange.fuel_type,
        priceChange.subproducto,
        priceChange.price,
        priceChange.changed_at,
      ]);
    }
  });
}

export async function batchUpsertStations(stations: Station[]): Promise<void> {
  if (stations.length === 0) return;

  await withTransaction(async (client: PoolClient) => {
    const query = `
      INSERT INTO stations (numero, nombre, direccion, lat, lng, entidad_id, municipio_id, brand, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (numero) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        direccion = EXCLUDED.direccion,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        entidad_id = EXCLUDED.entidad_id,
        municipio_id = EXCLUDED.municipio_id,
        brand = EXCLUDED.brand,
        is_active = EXCLUDED.is_active
    `;

    for (const station of stations) {
      await client.query(query, [
        station.numero,
        station.nombre,
        station.direccion,
        station.lat || null,
        station.lng || null,
        station.entidad_id,
        station.municipio_id,
        station.brand || null,
        station.is_active !== false,
      ]);
    }
  });
}
