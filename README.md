# Hotel Offer Orchestrator

Aggregates overlapping hotel offers from two mock suppliers, deduplicates
hotels by name, and picks the best (cheapest) offer per hotel. Supports
filtering the result by price range, with that filtering done inside Redis.

## Stack

- **Node.js + TypeScript + Express** – HTTP API and mock supplier endpoints
- **Temporal.io** – orchestrates the parallel supplier calls, dedupe, and cache step
- **Redis** – stores the deduplicated list per city and serves price-range queries via `ZRANGEBYSCORE`
- **Docker Compose** – runs the whole stack (API, Temporal worker, Temporal server, Postgres, Redis, Temporal Web UI)

## Architecture

```
Client
  │  GET /api/hotels?city=delhi&minPrice=&maxPrice=
  ▼
Express API (api service)
  │  starts a Temporal workflow
  ▼
Temporal Server  ──schedules──▶  Temporal Worker (worker service)
                                    │
                                    ├─ Activity: call GET /supplierA/hotels (parallel)
                                    ├─ Activity: call GET /supplierB/hotels (parallel)
                                    ├─ dedupe by name, keep cheaper price
                                    └─ Activity: cache result in Redis
                                         (sorted set: score=price, member=name
                                          + one JSON hash per hotel)
  ▼
Express API reads the (optionally price-filtered) list back out of Redis
via ZRANGEBYSCORE and returns it to the client
```

Both mock supplier endpoints (`/supplierA/hotels`, `/supplierB/hotels`) are
served by the same Express app, and the Temporal activities call them over
real HTTP — so the "supplier down" simulation and network-style error
handling behave like they would against real third-party APIs.

## Project layout

```
src/
  app.ts                 Express app: mounts all routers, error handling
  server.ts               HTTP entrypoint (runs the API)
  config.ts               Env var configuration
  logger.ts                Tiny timestamped logger
  types.ts                 Shared TS types
  suppliers/
    data.ts                 Static mock hotel data for Supplier A & B
    router.ts                /supplierA, /supplierB, /admin/supplier/:s/toggle
  redis/
    client.ts                ioredis connection + health ping
    hotelCache.ts             cacheHotels() + getHotelsByPriceRange() (ZRANGEBYSCORE)
  temporal/
    activities.ts             fetchSupplierAHotels / B / cacheHotelsActivity
    workflows.ts               getHotelsWorkflow: parallel calls -> dedupe -> cache
    client.ts                  starts the workflow from the API process
    worker.ts                  Temporal worker entrypoint (separate process)
  routes/
    hotels.ts                 GET /api/hotels
    health.ts                  GET /health
postman/
  Hotel-Offer-Orchestrator.postman_collection.json
```

## Running locally with Docker (recommended)

Requires Docker + Docker Compose.

```bash
docker compose up --build
```

This starts: `redis`, `postgresql` + `temporal` (server) + `temporal-ui`
(http://localhost:8080), and two app containers built from the same image —
`api` (the HTTP server, port 3000) and `worker` (the Temporal worker, no
exposed port). Give it a few seconds after startup for Temporal and the API
to finish initializing before the first request.

Then:

```bash
curl "http://localhost:3000/api/hotels?city=delhi"
curl "http://localhost:3000/api/hotels?city=delhi&minPrice=4000&maxPrice=12000"
curl "http://localhost:3000/health"
```

## Running without Docker (two terminals)

You'll need a local Redis and a local Temporal dev server running
(`temporal server start-dev`, from the [Temporal CLI](https://docs.temporal.io/cli)),
or point `TEMPORAL_ADDRESS` / `REDIS_URL` at remote ones.

```bash
cp .env.example .env   # adjust if needed
npm install

# terminal 1 – the API
npm run dev

# terminal 2 – the Temporal worker
npm run dev:worker
```

## API

### `GET /api/hotels?city=<city>`

Runs the Temporal workflow (parallel supplier calls → dedupe → cache in
Redis) and returns the deduplicated, cheapest-per-hotel list.

```json
[
  { "name": "Holtin", "price": 5340, "supplier": "Supplier B", "commissionPct": 20 },
  { "name": "Radison", "price": 5900, "supplier": "Supplier A", "commissionPct": 13 }
]
```

### `GET /api/hotels?city=<city>&minPrice=<min>&maxPrice=<max>`

Same as above, but the response is additionally filtered to hotels whose
price falls in `[minPrice, maxPrice]`. The filtering happens inside Redis
(`ZRANGEBYSCORE hotels:<city>:index <min> <max>`), not in application code.
Either bound can be omitted.

Mock data is defined for `delhi` and `mumbai` (see `src/suppliers/data.ts`);
any other city returns `[]`.

### `GET /supplierA/hotels?city=<city>` / `GET /supplierB/hotels?city=<city>`

The two mock supplier endpoints, callable directly for debugging/testing.

### `GET /health`

Reports the health of both suppliers and Redis:

```json
{
  "status": "ok",
  "timestamp": "2026-09-18T10:00:00.000Z",
  "dependencies": { "supplierA": "up", "supplierB": "up", "redis": "up" }
}
```

`status` is `ok` (all up), `degraded` (one supplier down but Redis and the
other supplier are fine), or `down` (both suppliers unreachable).

### `POST /admin/supplier/:supplier/toggle`

Test helper to simulate a supplier outage without restarting anything.
`:supplier` is `A` or `B`, body `{ "down": true }` / `{ "down": false }`.
While a supplier is marked down, its mock endpoint returns `503`, and the
workflow gracefully falls back to the other supplier's offers.

## Postman collection

Import `postman/Hotel-Offer-Orchestrator.postman_collection.json`. It covers:

- Health check
- Raw supplier mock data
- Valid city with overlapping hotels (Delhi) — asserts dedupe/cheapest-price behavior
- A second valid city (Mumbai)
- City with no results (Goa)
- Price-range filtering
- Missing `city` parameter (400)
- Simulating Supplier A being down, confirming the API still returns
  Supplier B's offers, then restoring Supplier A

Requests use a `baseUrl` collection variable, defaulting to
`http://localhost:3000`.

## Design notes

- **Dedupe rule**: for each hotel name seen from either supplier, the
  cheaper price wins; if only one supplier returned a given hotel, that
  offer is used as-is.
- **Resilience**: the workflow calls both suppliers with `Promise.allSettled`
  and a Temporal retry policy per activity; if one supplier fails (or is
  toggled down), the workflow continues with the other supplier's data
  instead of failing the whole request. It only fails if both suppliers are
  unavailable.
- **Redis as the source of truth for reads**: after the workflow caches the
  deduped list, the API always reads the response back out of Redis (via
  `ZRANGEBYSCORE`, unbounded when no price filter is given) rather than
  returning the workflow's in-memory result directly — this is what makes
  price filtering "inside Redis" rather than in the API layer, and gives a
  short (`REDIS_TTL_SECONDS`, default 300s) cache for repeat requests.
- **Logging & error handling**: activities and routes log through a small
  timestamped logger; supplier HTTP failures are caught and re-thrown as
  descriptive errors so Temporal's retry/history shows what happened;
  Express has a centralized error-handling middleware.

## Environment variables

See `.env.example`. Key ones: `PORT`, `REDIS_URL`, `REDIS_TTL_SECONDS`,
`TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, `TEMPORAL_TASK_QUEUE`,
`SUPPLIER_A_URL`, `SUPPLIER_B_URL`.
