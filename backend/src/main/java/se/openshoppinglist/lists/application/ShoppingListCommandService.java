package se.openshoppinglist.lists.application;

import jakarta.persistence.EntityNotFoundException;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.openshoppinglist.actor.ActorDisplayName;
import se.openshoppinglist.common.events.DomainEventPublisher;
import se.openshoppinglist.lists.domain.ExternalArticleSnapshot;
import se.openshoppinglist.lists.domain.ShoppingList;
import se.openshoppinglist.lists.domain.ShoppingListItem;
import se.openshoppinglist.lists.domain.ShoppingListRepository;
import se.openshoppinglist.retailer.application.RetailerArticleDetailsService;

@Service
public class ShoppingListCommandService {

    private final ShoppingListRepository shoppingListRepository;
    private final DomainEventPublisher domainEventPublisher;
    private final RetailerArticleDetailsService retailerArticleDetailsService;
    private final Clock clock;

    public ShoppingListCommandService(
            ShoppingListRepository shoppingListRepository,
            DomainEventPublisher domainEventPublisher,
            RetailerArticleDetailsService retailerArticleDetailsService,
            Clock clock
    ) {
        this.shoppingListRepository = shoppingListRepository;
        this.domainEventPublisher = domainEventPublisher;
        this.retailerArticleDetailsService = retailerArticleDetailsService;
        this.clock = clock;
    }

    @Transactional
    public ShoppingList createList(String name, ActorDisplayName actorDisplayName) {
        ShoppingList shoppingList = ShoppingList.create(name, actorDisplayName, clock);
        return persistAndPublish(shoppingList);
    }

    @Transactional
    public ShoppingList renameList(UUID listId, String name, ActorDisplayName actorDisplayName) {
        ShoppingList shoppingList = requireList(listId);
        shoppingList.rename(name, actorDisplayName, clock);
        return persistAndPublish(shoppingList);
    }

    @Transactional
    public ShoppingList archiveList(UUID listId, ActorDisplayName actorDisplayName) {
        ShoppingList shoppingList = requireList(listId);
        shoppingList.archive(actorDisplayName, clock);
        return persistAndPublish(shoppingList);
    }

    @Transactional
    public ShoppingListItem addManualItem(UUID listId, String title, String note, ActorDisplayName actorDisplayName) {
        return addManualItem(listId, title, note, 1, actorDisplayName);
    }

    @Transactional
    public ShoppingListItem addManualItem(UUID listId, String title, String note, int quantity, ActorDisplayName actorDisplayName) {
        ShoppingList shoppingList = requireList(listId);
        ShoppingListItem item = shoppingList.addManualItem(title, note, quantity, actorDisplayName, clock);
        persistAndPublish(shoppingList);
        return item;
    }

    @Transactional
    public ShoppingListItem addExternalItem(UUID listId, ExternalArticleSnapshot snapshot, ActorDisplayName actorDisplayName) {
        return addExternalItem(listId, snapshot, 1, actorDisplayName);
    }

    @Transactional
    public ShoppingListItem addExternalItem(UUID listId, ExternalArticleSnapshot snapshot, int quantity, ActorDisplayName actorDisplayName) {
        ShoppingList shoppingList = requireList(listId);
        ExternalArticleSnapshot enrichedSnapshot = retailerArticleDetailsService.enrichSnapshot(snapshot);
        ShoppingListItem item = shoppingList.addExternalItem(enrichedSnapshot, quantity, actorDisplayName, clock);
        persistAndPublish(shoppingList);
        return item;
    }

    @Transactional
    public ShoppingListItem checkItem(UUID listId, UUID itemId, ActorDisplayName actorDisplayName) {
        ShoppingList shoppingList = requireList(listId);
        ShoppingListItem item = shoppingList.checkItem(itemId, actorDisplayName, clock);
        persistAndPublish(shoppingList);
        return item;
    }

    @Transactional
    public ShoppingListItem uncheckItem(UUID listId, UUID itemId, ActorDisplayName actorDisplayName) {
        ShoppingList shoppingList = requireList(listId);
        ShoppingListItem item = shoppingList.uncheckItem(itemId, actorDisplayName, clock);
        persistAndPublish(shoppingList);
        return item;
    }

    @Transactional
    public ShoppingListItem toggleItemClaim(UUID listId, UUID itemId, ActorDisplayName actorDisplayName) {
        ShoppingList shoppingList = requireList(listId);
        ShoppingListItem item = shoppingList.toggleItemClaim(itemId, actorDisplayName, clock);
        persistAndPublish(shoppingList);
        return item;
    }

    @Transactional
    public void decreaseItemQuantity(UUID listId, UUID itemId, ActorDisplayName actorDisplayName) {
        ShoppingList shoppingList = requireList(listId);
        shoppingList.decreaseItemQuantity(itemId, actorDisplayName, clock);
        persistAndPublish(shoppingList);
    }

    private ShoppingList requireList(UUID listId) {
        return shoppingListRepository.findById(listId)
                .orElseThrow(() -> new EntityNotFoundException("Shopping list not found: " + listId));
    }

    private ShoppingList persistAndPublish(ShoppingList shoppingList) {
        ShoppingList persisted = shoppingListRepository.save(shoppingList);
        List<se.openshoppinglist.common.events.DomainEvent> events = shoppingList.pullDomainEvents();
        domainEventPublisher.publish(events);
        return persisted;
    }
}
