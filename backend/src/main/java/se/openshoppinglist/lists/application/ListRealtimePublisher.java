package se.openshoppinglist.lists.application;

public interface ListRealtimePublisher {

    void publish(ListRealtimeUpdate update);
}
