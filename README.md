# XML Data Service

An API that imports vehicle makes and vehicle types from the [NHTSA vPIC API](https://vpic.nhtsa.dot.gov/api/) and serves normalized data through GraphQL.

## Features

- Fetches NHTSA XML responses and validates/parses them before processing.
- Normalizes vehicle make and vehicle type identifiers and names.
- Stores results in MongoDB with bulk, idempotent upserts keyed by make ID.
- Exposes GraphQL queries for listing makes and looking up a make by ID.
- Logs ingestion progress and retries transient NHTSA request failures.

## Requirements

- Node.js 22 or later and npm
- MongoDB 8, either locally or through Docker Compose

## Tech stack

- Node.js + TypeScript
- NestJS for application structure and dependency injection
- GraphQL for querying normalized data
- MongoDB for persistence
- Mongoose for MongoDB models and operations
- fast-xml-parser for XML parsing
- p-map for bounded concurrency and incremental result processing
- nestjs-pino / Pino for structured logging
- Docker for containerization

## Configuration

Copy the sample environment file and set the NHTSA base URL:

```bash
cp .env.example .env
```

Ensure `.env` contains at least:

```dotenv
PORT=3000
MONGODB_URI=mongodb://localhost:27017/xml-data-service
BASE_URL=https://vpic.nhtsa.dot.gov/api/vehicles
```

| Variable            | Required | Default | Description                                    |
| ------------------- | -------- | ------- | ---------------------------------------------- |
| `MONGODB_URI`       | Yes      | None    | MongoDB connection string.                     |
| `BASE_URL`          | Yes      | None    | Base URL for the NHTSA vPIC vehicle API.       |
| `PORT`              | No       | `3000`  | HTTP port used by the service.                 |
| `NODE_ENV`          | No       | None    | GraphiQL is disabled when set to `production`. |
| `LOG_LEVEL`         | No       | `info`  | Pino HTTP log level.                           |
| `NHTSA_TIMEOUT_MS`  | No       | `10000` | Timeout for each NHTSA request.                |
| `NHTSA_MAX_RETRIES` | No       | `3`     | Retries after retryable NHTSA failures.        |

Retries use exponential backoff with jitter. `NHTSA_MAX_RETRIES` is the number of retries after the initial request.

## Run Locally

Install dependencies, start MongoDB, and launch the API:

```bash
npm install
npm run start:dev
```

The API listens on `http://localhost:3000` by default. The GraphQL endpoint is `http://localhost:3000/graphql`; GraphiQL is available outside production. The root route (`GET /`) returns a simple `Hello World!` response.

## Run With Docker Compose

Docker Compose starts the API and MongoDB. The Compose configuration supplies the MongoDB URI for the API container; `.env` is also loaded for settings such as `BASE_URL`.

```bash
cp .env.example .env
# Add BASE_URL=https://vpic.nhtsa.dot.gov/api/vehicles to .env
docker compose up --build
```

The API is exposed on port `3000`, and MongoDB data is persisted in the `mongo_data` volume. Set `PORT` in `.env` only if you also update the host port mapping in `docker-compose.yml`.

## Import NHTSA Data

With MongoDB running and `.env` configured, run the one-off ingestion command:

```bash
npm run ingest
```

The command builds the application, downloads the full makes list, then requests vehicle types for each make. Requests are processed with a concurrency of five and successful records are persisted in batches of 100. A make ID is used as the upsert key, so rerunning ingestion updates existing records rather than creating duplicates. Individual make failures are logged; ingestion continues processing other makes and exits with an error if any make failed.

## GraphQL API

Use `POST /graphql`. The `vehicleMakes` query is sorted by make ID and supports offset pagination. Its default offset is `0` and default limit is `100`; the maximum limit is `500`.

```graphql
query {
  vehicleMakes(offset: 0, limit: 20) {
    makeId
    makeName
    vehicleTypes {
      typeId
      typeName
    }
  }
}
```

Look up one make by its NHTSA make ID. The result is `null` when no matching record exists:

```graphql
query {
  vehicleMake(makeId: 440) {
    makeId
    makeName
    vehicleTypes {
      typeId
      typeName
    }
  }
}
```

The schema is generated at `src/schema.gql` when the application initializes.

## Technical Decisions

- **GraphQL for reads:** The service exposes focused queries instead of returning the full dataset from a REST endpoint.
- **MongoDB with Mongoose:** Vehicle makes and their vehicle types are stored as documents; make IDs provide a stable key for idempotent synchronization.
- **XML boundary validation:** NHTSA responses are syntax-validated and normalized into typed application data before persistence.
- **Bounded ingestion:** NHTSA calls use bounded concurrency, while Mongo writes are grouped into batches to limit resource use.
- **Resilience and visibility:** Retryable source failures use exponential backoff; Pino logs per-make errors and ingestion progress.

## Tests and Quality Checks

```bash
npm test
npm run test:e2e
npm run test:cov
npm run lint
```

## Project Structure

```text
src/
  modules/
    documents/   GraphQL resolver, persistence service, and Mongo schema
    ingestion/   NHTSA-to-MongoDB synchronization workflow
    sources/     NHTSA client, XML parser, and data normalizer
  scripts/       One-off ingestion entry point
test/            End-to-end tests
```
