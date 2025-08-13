# External APIs

## Government Pricing API

**Purpose:** Primary data source for all Mexican gas station pricing information

**Documentation:** CNE (Comisión Nacional de Energía) public APIs
**Base URL(s):**

- Catalog API: `https://api-catalogo.cne.gob.mx/api/utiles`
- Pricing API: `https://api-reportediario.cne.gob.mx/api/EstacionServicio`
  **Authentication:** None (public API)
  **Rate Limits:** No documented limits, but implement respectful crawling with delays

**Key Endpoints Used:**

1. **GET `/entidadesfederativas`** - Fetch all Mexican states
   - Returns array of states with `EntidadFederativaId` and `Nombre`
   - Total: 32 states

2. **GET `/municipios?EntidadFederativaId={id}`** - Fetch municipalities for a state
   - Returns array with `MunicipioId`, `EntidadFederativaId`, `Nombre`
   - Average ~50-100 municipalities per state

3. **GET `EstacionServicio/Petroliferos?entidadId={estado}&municipioId={municipio}`** - Fetch station prices
   - Returns station pricing data with:
     - `Numero`: Station permit number (unique ID)
     - `Nombre`: Station name
     - `Direccion`: Physical address
     - `Producto`: Product type (Diésel/Gasolinas)
     - `SubProducto`: Detailed fuel specification
     - `PrecioVigente`: Current price
     - `EntidadFederativaId` & `MunicipioId`: Location IDs

**Integration Notes:**

- Scraper must iterate through all 32 states, then all municipalities within each state
- Total API calls per scraping run: ~2,500+ (32 states + ~2,400 municipalities)
- Implement exponential backoff for failed requests
- Map `SubProducto` variations to normalized fuel types (regular/premium/diesel)
- Handle missing lat/lng coordinates (not provided in this API)

## Fuel Type Mapping Logic

The government API uses verbose fuel descriptions that need normalization:

**Regular Gasoline Variants:**

- "Regular (con un índice de octano ([RON+MON]/2) mínimo de 87)"
- "Regular (con contenido menor a 92 octanos)"
- Maps to → `fuel_type: 'regular'`

**Premium Gasoline Variants:**

- "Premium (con un índice de octano ([RON+MON]/2) mínimo de 91)"
- "Premium (con contenido mínimo de 92 octanos)"
- Maps to → `fuel_type: 'premium'`

**Diesel Variants:**

- "Diésel Automotriz [contenido mayor de azufre a 15 mg/kg y contenido máximo de azufre de 500 mg/kg]"
- "Diésel"
- Maps to → `fuel_type: 'diesel'`

This mapping ensures consistent data storage while preserving the original `SubProducto` text for regulatory compliance.
