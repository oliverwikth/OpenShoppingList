package se.openshoppinglist.lists.infrastructure;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "item_activity_log")
public class ItemActivityLogEntry {

    @Id
    private UUID id;

    @Column(name = "list_id", nullable = false)
    private UUID listId;

    @Column(name = "item_id")
    private UUID itemId;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "actor_display_name", nullable = false)
    private String actorDisplayName;

    @Column(name = "payload_json", nullable = false)
    private String payloadJson;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected ItemActivityLogEntry() {
    }

    public ItemActivityLogEntry(
            UUID id,
            UUID listId,
            UUID itemId,
            String eventType,
            String actorDisplayName,
            String payloadJson,
            Instant occurredAt
    ) {
        this.id = id;
        this.listId = listId;
        this.itemId = itemId;
        this.eventType = eventType;
        this.actorDisplayName = actorDisplayName;
        this.payloadJson = payloadJson;
        this.occurredAt = occurredAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getListId() {
        return listId;
    }

    public UUID getItemId() {
        return itemId;
    }

    public String getEventType() {
        return eventType;
    }

    public String getActorDisplayName() {
        return actorDisplayName;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }
}
