package se.openshoppinglist.lists.application;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import se.openshoppinglist.common.events.DomainEvent;

@Component
class ListRealtimeProjector {

    private final ListRealtimePublisher listRealtimePublisher;

    ListRealtimeProjector(ListRealtimePublisher listRealtimePublisher) {
        this.listRealtimePublisher = listRealtimePublisher;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
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
