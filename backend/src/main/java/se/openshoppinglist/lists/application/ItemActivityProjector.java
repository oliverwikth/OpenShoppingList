package se.openshoppinglist.lists.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import se.openshoppinglist.common.events.DomainEvent;
import se.openshoppinglist.lists.domain.ShoppingListRepository;
import se.openshoppinglist.lists.infrastructure.ItemActivityLogEntry;
import se.openshoppinglist.lists.infrastructure.ItemActivityLogRepository;

@Component
class ItemActivityProjector {

    private final ItemActivityLogRepository itemActivityLogRepository;
    private final ShoppingListRepository shoppingListRepository;
    private final ObjectMapper objectMapper;

    ItemActivityProjector(
            ItemActivityLogRepository itemActivityLogRepository,
            ShoppingListRepository shoppingListRepository,
            ObjectMapper objectMapper
    ) {
        this.itemActivityLogRepository = itemActivityLogRepository;
        this.shoppingListRepository = shoppingListRepository;
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
                toJson(resolvePayload(event)),
                event.occurredAt()
        ));
    }

    private CheckedItemActivityPayload resolvePayload(DomainEvent event) {
        if (!"shopping-list-item.checked".equals(event.eventType()) || event.itemId() == null) {
            return CheckedItemActivityPayload.generic(event.eventType());
        }

        return shoppingListRepository.findById(event.listId())
                .flatMap(list -> list.getItems().stream()
                        .filter(item -> item.getId().equals(event.itemId()))
                        .findFirst())
                .map(CheckedItemActivityPayload::checked)
                .orElseGet(() -> CheckedItemActivityPayload.generic(event.eventType()));
    }

    private String toJson(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            return "{}";
        }
    }
}
