package se.openshoppinglist.common.events;

import java.time.Instant;
import java.util.UUID;

public interface DomainEvent {

    String eventType();

    UUID listId();

    UUID itemId();

    String actorDisplayName();

    Instant occurredAt();
}
