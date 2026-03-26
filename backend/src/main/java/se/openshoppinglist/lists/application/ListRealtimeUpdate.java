package se.openshoppinglist.lists.application;

import java.time.Instant;
import java.util.UUID;

public record ListRealtimeUpdate(
        String eventType,
        UUID listId,
        UUID itemId,
        String actorDisplayName,
        Instant occurredAt
) {
}
