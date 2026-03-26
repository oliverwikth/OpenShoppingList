# Developer Guide

## Codebase Structure

```text
backend/
  src/main/java/se/openshoppinglist/
    actor/
    common/
    config/
    lists/
      api/
      application/
      domain/
      infrastructure/
    retailer/
      api/
      application/
      domain/
      infrastructure/
  src/main/resources/
    application.yml
    db/migration/

frontend/
  src/
    app/
    components/ui/
    features/actor/
    features/lists/
    features/retailer-search/
    shared/api/
    shared/types/

scripts/
  verify-stack.sh
```

## Local Workflow

Backend:

```bash
cd backend
./mvnw test
./mvnw spring-boot:run
```

Frontend:

```bash
cd frontend
npm install
npm test -- --run
npm run dev
```

Docker stack:

```bash
docker compose up --build -d
./scripts/verify-stack.sh
```

## How To Add A New Retailer Adapter

1. Add a new infrastructure adapter inside `backend/src/main/java/se/openshoppinglist/retailer/infrastructure`.
2. Implement `RetailerSearchPort`.
3. Map the provider response into `RetailerArticleSearchResult`.
4. Keep provider-specific DTOs and HTTP logic inside the retailer module only.
5. Do not expose provider-specific payloads to the list aggregate except through `ExternalArticleSnapshot`.
6. Add tests for the adapter mapping and error handling.

Rules to preserve:

- the `lists` module must not call provider APIs directly
- item rendering must still work from stored snapshots alone
- provider failures should degrade search, not corrupt checklist behavior

## How To Add A New List Feature Safely

When adding a checklist feature:

1. Put invariants and state transitions in the `lists.domain` package first.
2. Orchestrate use cases in `lists.application`.
3. Keep controllers thin and DTO-focused in `lists.api`.
4. Add persistence wiring only in `lists.infrastructure`.
5. Emit a domain event if the feature represents an important state mutation.
6. Add read-model or projection updates through listeners rather than mixing reporting logic into the aggregate.

Examples of suitable future work:

- item reordering
- list duplication
- template application
- richer activity or audit views

## Testing Strategy

Backend tests cover:

- domain behavior and invariants
- API integration with PostgreSQL via Testcontainers
- retailer service behavior with mocked search ports

Frontend tests cover:

- list overview flow
- list detail flow and key user interactions

The repository-level smoke verification is `scripts/verify-stack.sh`, which runs the main user journey against the real Docker stack.

## Operational Notes

- Flyway owns schema changes
- Hibernate validates mappings against the migrated schema
- the backend exposes health at `/actuator/health`
- the frontend production container uses nginx and proxies `/api` to the backend service

## Current Assumptions Worth Preserving

- no auth is not a missing feature; it is a deliberate product choice
- actor identity comes from the route and request header only
- this is a single-household shared system
- retailer integrations are replaceable adapters
- event emission is part of the internal architecture, not optional decoration
