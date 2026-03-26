package se.openshoppinglist.common.events;

import java.util.Collection;

public interface DomainEventPublisher {

    void publish(Collection<? extends DomainEvent> events);
}
