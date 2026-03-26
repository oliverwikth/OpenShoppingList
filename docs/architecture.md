# Architecture

## Why A Modular Monolith

The application is small enough that microservices would add operational cost without improving the core product. A modular monolith keeps deployment simple while still preserving strong internal boundaries:

- the checklist domain stays central
- the retailer adapter stays peripheral
- internal events are explicit and ready for future realtime work
- future agents can extend the system without tracing through framework-heavy coupling

## Bounded Modules

### `lists`

Owns the checklist domain.

- `domain`: `ShoppingList`, `ShoppingListItem`, snapshot and manual item value objects, domain events
- `application`: command orchestration, query/read-model assembly, activity projection
- `infrastructure`: JPA repositories and event projection persistence
- `api`: REST endpoints and request/response contracts

This is the heart of the system. It should continue to make sense even if all retailer integrations disappear.

### `retailer`

Owns retailer search abstractions and adapter implementations.

- `application`: `RetailerSearchPort`, `RetailerSearchService`
- `domain`: retailer-agnostic search result and response models
- `infrastructure`: `WillysRetailerSearchAdapter`
- `api`: search endpoint

The rest of the backend never depends on Willys-specific response objects.

### `actor`

Owns display identity resolution.

- `ActorDisplayName` value object
- `ActorContextResolver`

This module enforces the intentional v1 rule that a display name is a lightweight actor label, not an account.

### `common`

Owns shared technical primitives.

- aggregate base with domain event collection
- domain event publishing abstraction
- API error mapping

## Domain Model Summary

### `ShoppingList`

Aggregate root that owns:

- name
- status
- lifecycle timestamps
- last modifying actor
- ordered list items

Important behaviors:

- create
- rename
- archive
- add manual item
- add external snapshot item
- check item
- uncheck item

### `ShoppingListItem`

Entity inside a list aggregate.

Supports two kinds of content:

- manual item
- external article snapshot

Important fields:

- title
- checked state
- check attribution
- last modification attribution
- position
- manual note
- external snapshot fields

### `ExternalArticleSnapshot`

Stable snapshot of retailer-backed item data stored at the time of addition:

- provider
- article id
- title/subtitle
- image URL
- category
- price
- currency
- raw payload JSON

This preserves checklist rendering even if retailer data changes later.

## Event-Driven Design

Important mutations emit domain events from the aggregate, for example:

- `shopping-list.created`
- `shopping-list.renamed`
- `shopping-list.archived`
- `shopping-list-item.added`
- `shopping-list-item.checked`
- `shopping-list-item.unchecked`

The current projection listener writes these into `item_activity_log`, which powers the recent activity section in the list detail response.

This design keeps three future paths open:

1. add more internal projections without changing controllers
2. add an outbox if external delivery is needed later
3. publish realtime notifications from event handlers when websocket or SSE support is introduced

## Persistence Model

PostgreSQL tables:

- `shopping_list`
- `shopping_list_item`
- `item_activity_log`

Flyway owns schema evolution. Hibernate runs in `validate` mode so mapping drift is caught early rather than silently applied.

## API Shape

Main REST endpoints:

- `GET /api/lists`
- `POST /api/lists`
- `GET /api/lists/{listId}`
- `PATCH /api/lists/{listId}`
- `POST /api/lists/{listId}/archive`
- `POST /api/lists/{listId}/items/manual`
- `POST /api/lists/{listId}/items/external`
- `POST /api/lists/{listId}/items/{itemId}/check`
- `POST /api/lists/{listId}/items/{itemId}/uncheck`
- `GET /api/retailer-search?q=...`

Mutating endpoints derive actor attribution from `X-Actor-Display-Name`.

## Frontend Structure

The frontend is organized by feature rather than by technical layer only:

- list overview page for household list browsing and creation
- list detail page for checklist work
- retailer search API module isolated from list UI components
- shared typed API client

Routing is actor-first:

- `/:actorName`
- `/:actorName/lists/:listId`

This keeps the “who am I for attribution” concern visible without introducing authentication state.

## Extension Points

### Add Another Retailer

Implement a new adapter behind `RetailerSearchPort`, map its live response into `RetailerArticleSearchResult`, and keep snapshot creation unchanged.

### Add Realtime

Attach a publisher to domain event handling or an outbox table, then emit websocket or SSE updates without changing aggregate logic.

### Add Templates

Templates should become a separate module that can create or seed lists and items without changing retailer boundaries. The existing list aggregate already owns item creation rules, which is the correct place for template-driven instantiation to call into.
