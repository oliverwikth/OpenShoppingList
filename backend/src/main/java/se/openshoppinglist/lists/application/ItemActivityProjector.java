package se.openshoppinglist.lists.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import se.openshoppinglist.common.events.DomainEvent;
import se.openshoppinglist.lists.infrastructure.ItemActivityLogEntry;
import se.openshoppinglist.lists.infrastructure.ItemActivityLogRepository;

@Component
class ItemActivityProjector {

    private final ItemActivityLogRepository itemActivityLogRepository;
    private final ObjectMapper objectMapper;

    ItemActivityProjector(ItemActivityLogRepository itemActivityLogRepository, ObjectMapper objectMapper) {
        this.itemActivityLogRepository = itemActivityLogRepository;
        this.objectMapper = objectMapper;
    }

    @EventListener
    public void onDomainEvent(DomainEvent event) {
        itemActivityLogRepository.save(new ItemActivityLogEntry(
                UUID.randomUUID(),
                event.listId(),
                event.itemId(),
                event.eventType(),
                event.actorDisplayName(),
                toJson(Map.of("eventType", event.eventType())),
                event.occurredAt()
        ));
    }

    private String toJson(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            return "{}";
        }
    }
}
