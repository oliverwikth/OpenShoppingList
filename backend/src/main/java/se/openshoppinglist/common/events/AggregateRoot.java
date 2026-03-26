package se.openshoppinglist.common.events;

import jakarta.persistence.Transient;
import java.util.ArrayList;
import java.util.List;

public abstract class AggregateRoot {

    @Transient
    private final List<DomainEvent> domainEvents = new ArrayList<>();

    protected void recordEvent(DomainEvent event) {
        domainEvents.add(event);
    }

    public List<DomainEvent> pullDomainEvents() {
        List<DomainEvent> pending = List.copyOf(domainEvents);
        domainEvents.clear();
        return pending;
    }
}
