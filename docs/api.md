# API Documentation

This service exposes vehicle make data through GraphQL. It imports source data from the NHTSA vPIC API, normalizes it, and stores it in MongoDB. Ingestion is run as a command-line job; the GraphQL API is read-only.

## GraphQL API

The GraphQL endpoint is `POST /graphql`. GraphiQL is enabled unless `NODE_ENV=production`.

### `vehicleMakes`

Returns vehicle makes ordered by `makeId`. Pagination uses an offset and limit; `offset` defaults to `0`, `limit` defaults to `100`, and the allowed limit is `1` through `500`.

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

Negative offsets, non-safe integers, and limits outside the allowed range produce a GraphQL error originating from a `400 Bad Request` exception.

### `vehicleMake`

Looks up a make by its NHTSA make ID. Returns `null` when the ID is not present in MongoDB.

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

## Ingestion Pipeline

Run the one-off synchronization job with:

```bash
npm run ingest
```

The command builds the NestJS application and runs the ingestion script. The pipeline proceeds as follows:

1. Request the complete vehicle-makes XML document from NHTSA.
2. Validate XML syntax, parse the document, normalize make IDs and names, and discard duplicate make IDs.
3. Fetch the vehicle-types XML document for each make, with at most five concurrent make requests and bounded backpressure.
4. Validate, parse, and normalize each make's vehicle types.
5. Persist successful makes in MongoDB in batches of 100 using unordered bulk upserts keyed by `makeId`.
6. Log a final summary and exit successfully only if all makes were processed without per-make failures.

A rerun updates matching make documents rather than inserting duplicate records. The pipeline is not scheduled automatically by this service. A successful run logs counts for processed and persisted records and reports zero failures.

## Error Handling

Errors are handled at the source-client, parsing/normalization, and ingestion levels:

- **NHTSA HTTP requests:** Network errors, HTTP `408`, `429`, and `5xx` responses are considered retryable. Each request gets the initial attempt plus up to `NHTSA_MAX_RETRIES` retries, with exponential backoff and jitter. Exhausted retries produce a `503 Service Unavailable` error.
- **Non-retryable source failures:** Other HTTP errors and invalid/empty source responses produce a `502 Bad Gateway` error. Invalid XML syntax, unexpected response structures, missing fields, or invalid IDs are also treated as bad upstream data (`502`).
- **Per-make failures:** A failure while fetching or normalizing one make's vehicle types is logged with that make ID. Processing continues for other makes, and successful records are still persisted.
- **Partial ingestion:** After processing, any per-make failures cause the job to finish with a `502 Bad Gateway` exception. The log summary includes the failure count and up to the first 20 failed make IDs.
- **Persistence or initial-list failures:** Failures while writing a batch or obtaining/parsing the initial makes list are not treated as per-make failures. They abort the job and are logged by the ingestion script as a job failure.
- **Query validation:** Invalid pagination arguments on `vehicleMakes` produce a `400 Bad Request` exception surfaced as a GraphQL error.

The ingestion script sets a non-zero process exit code when the job throws, making it suitable for automation and CI job runners. It closes the Nest application in a `finally` block.

## Logging

The application uses Pino through `nestjs-pino`. Set `LOG_LEVEL` to control the HTTP logger level; it defaults to `info`. Use standard Pino levels such as `fatal`, `error`, `warn`, `info`, `debug`, or `trace` as required by the deployment.

Ingestion and NHTSA client logs are structured and include relevant context:

- Request retries log the URL, retry attempt, and backoff delay at `warn` level.
- Exhausted or non-retryable NHTSA requests log the URL and underlying error at `error` level.
- Per-make failures log the make ID and error message at `warn` level.
- Batch progress logs include processed and persisted counts, failures so far, elapsed time, and throughput at `info` level.
- Completion logs include total counts, duration, and a capped list of failed make IDs. The CLI entry point also logs whether ingestion completed or failed.

Avoid setting verbose log levels in production unless needed for diagnosis. Logs may contain upstream URLs and error details; route and retain them according to your operational logging policy.

## Configuration

Configuration is provided through environment variables. Nest's global `ConfigModule` loads `.env` in local development and environment variables supplied by the process/container. Do not commit secrets or machine-specific `.env` files.

| Variable            | Required | Default | Purpose                                                                                  |
| ------------------- | -------- | ------- | ---------------------------------------------------------------------------------------- |
| `MONGODB_URI`       | Yes      | None    | MongoDB connection URI. Application startup requires this value.                         |
| `BASE_URL`          | Yes      | None    | NHTSA vPIC vehicles API base URL, for example `https://vpic.nhtsa.dot.gov/api/vehicles`. |
| `PORT`              | No       | `3000`  | HTTP port used by the Nest application.                                                  |
| `NODE_ENV`          | No       | None    | Set to `production` to disable GraphiQL.                                                 |
| `LOG_LEVEL`         | No       | `info`  | Pino HTTP logger threshold.                                                              |
| `NHTSA_TIMEOUT_MS`  | No       | `10000` | Timeout in milliseconds for each NHTSA HTTP request.                                     |
| `NHTSA_MAX_RETRIES` | No       | `3`     | Number of retries after the initial attempt for retryable NHTSA errors.                  |

The client falls back to the documented timeout and retry defaults when those values are absent or invalid. `MONGODB_URI` is required at startup; configure `BASE_URL` for ingestion. Under Docker Compose, the MongoDB URI is set for the API container in `docker-compose.yml`, while the remaining values can be provided in `.env`.
