# OpenShoppingList

OpenShoppingList is a mobile-first household shopping checklist application built as a modular monolith. The checklist domain is the core of the system; Willys is an external article search adapter used only when a user wants to add a retailer-backed item snapshot to a list.

## What Is Implemented

- Shared household shopping lists with no accounts or authentication
- Route-based display identity, for example `/anna`
- Multiple named lists
- Manual list items
- Willys-backed item search with stored snapshot data
- Check and uncheck flows with actor attribution
- Internal domain events with an activity log projection
- PostgreSQL persistence with Flyway migrations
- Docker Compose local stack
- Backend and frontend automated tests
- End-to-end verification script for the main flows

## Intentional V1 Deferrals

- No authentication or authorization
- No offline mode
- WebSocket-based realtime list updates for active list views
- No template feature yet
- No price totals or price-based sorting
- No retailer catalog ingestion

## Architecture Overview

The backend is a modular monolith with these main modules:

- `lists`: shopping list aggregate, item behavior, use cases, read models, REST API
- `retailer`: retailer-agnostic search port plus the Willys adapter
- `actor`: route/header-derived display identity
- `common`: domain event primitives and shared API error handling

The frontend is a React + TypeScript app with feature-oriented folders:

- `features/lists`: list overview and list detail flows
- `features/retailer-search`: retailer search API access
- `features/actor`: current display-name routing support
- `shared`: API client and typed contracts
- `app`: top-level routing and shell

More detail is in [docs/architecture.md](./docs/architecture.md) and [docs/developer-guide.md](./docs/developer-guide.md).

## Identity Model

There is intentionally no login. The display name comes from the route:

- `http://localhost:8081/anna` means the current actor is `anna`
- Any display name is accepted
- All actors share the same household data and permissions

The frontend sends the actor as `X-Actor-Display-Name` when a mutating API call is made.

## Running With Docker Compose

Prerequisites:

- Docker Desktop or Docker Engine with Compose support
- `jq` if you want to run the verification script

Start the full stack:

```bash
docker compose up --build -d
```

Services:

- Frontend: [http://localhost:8081/anna](http://localhost:8081/anna)
- Backend API: [http://localhost:8080/api/lists](http://localhost:8080/api/lists)
- Backend health: [http://localhost:8080/actuator/health](http://localhost:8080/actuator/health)
- PostgreSQL: `localhost:5432`

Stop the stack:

```bash
docker compose down
```

## Running Without Docker

Start PostgreSQL separately and set the backend environment variables:

```bash
export DB_URL=jdbc:postgresql://localhost:5432/open_shopping_list
export DB_USERNAME=postgres
export DB_PASSWORD=postgres
```

Run the backend:

```bash
cd backend
./mvnw spring-boot:run
```

Run the frontend:

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on [http://localhost:5173/anna](http://localhost:5173/anna) and proxies `/api` to the backend.

## Tests And Verification

Backend:

```bash
cd backend
./mvnw test
./mvnw -DskipTests package
```

Frontend:

```bash
cd frontend
npm test -- --run
npm run build
```

End-to-end verification against the running Docker stack:

```bash
./scripts/verify-stack.sh
```

The script verifies:

- frontend route availability
- list creation
- manual item creation
- live Willys search
- adding an external snapshot item
- checking and unchecking an item
- persisted list state retrieval

## Willys Integration

Willys is isolated behind `RetailerSearchPort`. The current adapter performs live query-time search and maps the Willys response into a retailer-agnostic result model. When a result is added to a list, the backend stores a snapshot of the article fields needed for later display.

If Willys changes or another retailer is added later, the checklist domain does not need to change.

## Project Layout

```text
backend/   Spring Boot modular monolith
frontend/  React + TypeScript app
docs/      Architecture and developer documentation
scripts/   Local verification helpers
```

## Assumptions

- Swedish-only UI text is acceptable for v1
- Willys live search is available anonymously at query time
- Prices are stored as retailer snapshots when available
- The app is a single shared household, not a multi-tenant system
