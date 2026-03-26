package se.openshoppinglist.lists.application;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import se.openshoppinglist.common.events.DomainEvent;

@Component
class ListRealtimeProjector {

    private final ListRealtimePublisher listRealtimePublisher;

    ListRealtimeProjector(ListRealtimePublisher listRealtimePublisher) {
        this.listRealtimePublisher = listRealtimePublisher;
    }

    @EventListener
    public void onDomainEvent(DomainEvent event) {
        listRealtimePublisher.publish(new ListRealtimeUpdate(
                event.eventType(),
                event.listId(),
                event.itemId(),
                event.actorDisplayName(),
                event.occurredAt()
        ));
    }
}
