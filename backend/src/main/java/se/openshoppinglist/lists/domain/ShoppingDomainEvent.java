package se.openshoppinglist.lists.domain;

import java.time.Instant;
import java.util.UUID;
import se.openshoppinglist.common.events.DomainEvent;

public record ShoppingDomainEvent(
        String eventType,
        UUID listId,
        UUID itemId,
        String actorDisplayName,
        Instant occurredAt
) implements DomainEvent {
}
