package se.openshoppinglist.lists.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import se.openshoppinglist.actor.ActorDisplayName;
import se.openshoppinglist.common.events.AggregateRoot;

@Entity
@Table(name = "shopping_list")
public class ShoppingList extends AggregateRoot {

    @Id
    private UUID id;

    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ShoppingListStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @Column(name = "last_modified_by_display_name", nullable = false, length = 60)
    private String lastModifiedByDisplayName;

    @OneToMany(mappedBy = "shoppingList", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<ShoppingListItem> items = new ArrayList<>();

    protected ShoppingList() {
    }

    public static ShoppingList restore(
            UUID id,
            String name,
            ShoppingListStatus status,
            Instant createdAt,
            Instant updatedAt,
            Instant archivedAt,
            String lastModifiedByDisplayName
    ) {
        ShoppingList list = new ShoppingList();
        list.id = id == null ? UUID.randomUUID() : id;
        list.name = normalizeName(name);
        list.status = status == null ? ShoppingListStatus.ACTIVE : status;
        list.createdAt = createdAt == null ? Instant.now() : createdAt;
        list.updatedAt = updatedAt == null ? list.createdAt : updatedAt;
        list.archivedAt = archivedAt;
        list.lastModifiedByDisplayName = lastModifiedByDisplayName == null || lastModifiedByDisplayName.isBlank()
                ? "import"
                : lastModifiedByDisplayName.trim();
        return list;
    }

    public static ShoppingList create(String name, ActorDisplayName actorDisplayName, Clock clock) {
        Instant now = clock.instant();
        ShoppingList list = new ShoppingList();
        list.id = UUID.randomUUID();
        list.name = normalizeName(name);
        list.status = ShoppingListStatus.ACTIVE;
        list.createdAt = now;
        list.updatedAt = now;
        list.lastModifiedByDisplayName = actorDisplayName.value();
        list.recordEvent(new ShoppingDomainEvent("shopping-list.created", list.id, null, actorDisplayName.value(), now));
        return list;
    }

    public void rename(String newName, ActorDisplayName actorDisplayName, Clock clock) {
        String normalizedName = normalizeName(newName);
        if (this.name.equals(normalizedName)) {
            return;
        }
        this.name = normalizedName;
        touch(actorDisplayName, clock);
        recordEvent(new ShoppingDomainEvent("shopping-list.renamed", id, null, actorDisplayName.value(), updatedAt));
    }

    public void archive(ActorDisplayName actorDisplayName, Clock clock) {
        if (status == ShoppingListStatus.ARCHIVED) {
            return;
        }
        status = ShoppingListStatus.ARCHIVED;
        archivedAt = clock.instant();
        touch(actorDisplayName, clock);
        recordEvent(new ShoppingDomainEvent("shopping-list.archived", id, null, actorDisplayName.value(), updatedAt));
    }

    public ShoppingListItem addManualItem(String title, String note, ActorDisplayName actorDisplayName, Clock clock) {
        return addManualItem(title, note, 1, actorDisplayName, clock);
    }

    public ShoppingListItem addManualItem(String title, String note, int quantity, ActorDisplayName actorDisplayName, Clock clock) {
        ensureActive();
        Optional<ShoppingListItem> existingItem = items.stream()
                .filter(item -> item.matchesManual(title, note))
                .findFirst();
        if (existingItem.isPresent()) {
            ShoppingListItem item = existingItem.get();
            item.increaseQuantity(actorDisplayName, clock, quantity);
            touch(actorDisplayName, clock);
            recordEvent(new ShoppingDomainEvent("shopping-list-item.quantity-increased", id, item.getId(), actorDisplayName.value(), updatedAt));
            return item;
        }
        ShoppingListItem item = ShoppingListItem.manual(this, nextPosition(), title, note, quantity, actorDisplayName, clock);
        items.add(item);
        touch(actorDisplayName, clock);
        recordEvent(new ShoppingDomainEvent("shopping-list-item.added", id, item.getId(), actorDisplayName.value(), updatedAt));
        return item;
    }

    public ShoppingListItem addExternalItem(ExternalArticleSnapshot snapshot, ActorDisplayName actorDisplayName, Clock clock) {
        return addExternalItem(snapshot, 1, actorDisplayName, clock);
    }

    public ShoppingListItem addExternalItem(ExternalArticleSnapshot snapshot, int quantity, ActorDisplayName actorDisplayName, Clock clock) {
        ensureActive();
        Optional<ShoppingListItem> existingItem = items.stream()
                .filter(item -> item.matchesExternal(snapshot))
                .findFirst();
        if (existingItem.isPresent()) {
            ShoppingListItem item = existingItem.get();
            item.increaseQuantity(actorDisplayName, clock, quantity);
            touch(actorDisplayName, clock);
            recordEvent(new ShoppingDomainEvent("shopping-list-item.quantity-increased", id, item.getId(), actorDisplayName.value(), updatedAt));
            return item;
        }
        ShoppingListItem item = ShoppingListItem.external(this, nextPosition(), snapshot, quantity, actorDisplayName, clock);
        items.add(item);
        touch(actorDisplayName, clock);
        recordEvent(new ShoppingDomainEvent("shopping-list-item.added", id, item.getId(), actorDisplayName.value(), updatedAt));
        return item;
    }

    public ShoppingListItem checkItem(UUID itemId, ActorDisplayName actorDisplayName, Clock clock) {
        ShoppingListItem item = getItem(itemId);
        if (item.check(actorDisplayName, clock)) {
            touch(actorDisplayName, clock);
            recordEvent(new ShoppingDomainEvent("shopping-list-item.checked", id, itemId, actorDisplayName.value(), updatedAt));
        }
        return item;
    }

    public ShoppingListItem uncheckItem(UUID itemId, ActorDisplayName actorDisplayName, Clock clock) {
        ShoppingListItem item = getItem(itemId);
        if (item.uncheck(actorDisplayName, clock)) {
            touch(actorDisplayName, clock);
            recordEvent(new ShoppingDomainEvent("shopping-list-item.unchecked", id, itemId, actorDisplayName.value(), updatedAt));
        }
        return item;
    }

    public ShoppingListItem toggleItemClaim(UUID itemId, ActorDisplayName actorDisplayName, Clock clock) {
        ensureActive();
        ShoppingListItem item = getItem(itemId);
        boolean claimed = item.toggleClaim(actorDisplayName, clock);
        touch(actorDisplayName, clock);
        recordEvent(new ShoppingDomainEvent(
                claimed ? "shopping-list-item.claimed" : "shopping-list-item.claim-released",
                id,
                itemId,
                actorDisplayName.value(),
                updatedAt
        ));
        return item;
    }

    public ShoppingListItem decreaseItemQuantity(UUID itemId, ActorDisplayName actorDisplayName, Clock clock) {
        ensureActive();
        ShoppingListItem item = getItem(itemId);
        boolean shouldRemove = item.decreaseQuantity(actorDisplayName, clock);
        if (shouldRemove) {
            items.remove(item);
            touch(actorDisplayName, clock);
            recordEvent(new ShoppingDomainEvent("shopping-list-item.removed", id, null, actorDisplayName.value(), updatedAt));
            return null;
        }

        touch(actorDisplayName, clock);
        recordEvent(new ShoppingDomainEvent("shopping-list-item.quantity-decreased", id, itemId, actorDisplayName.value(), updatedAt));
        return item;
    }

    public ShoppingListItem adjustItemQuantity(UUID itemId, int delta, ActorDisplayName actorDisplayName, Clock clock) {
        ensureActive();
        if (delta == 0) {
            throw new IllegalArgumentException("Item quantity delta must not be zero.");
        }

        ShoppingListItem item = getItem(itemId);
        if (delta > 0) {
            item.increaseQuantity(actorDisplayName, clock, delta);
            touch(actorDisplayName, clock);
            recordEvent(new ShoppingDomainEvent("shopping-list-item.quantity-increased", id, itemId, actorDisplayName.value(), updatedAt));
            return item;
        }

        int decreaseAmount = Math.abs(delta);
        if (decreaseAmount >= item.getQuantity()) {
            while (!item.decreaseQuantity(actorDisplayName, clock)) {
                // Drain the remaining quantity before removing the item from the list.
            }
            items.remove(item);
            touch(actorDisplayName, clock);
            recordEvent(new ShoppingDomainEvent("shopping-list-item.removed", id, null, actorDisplayName.value(), updatedAt));
            return null;
        }

        for (int index = 0; index < decreaseAmount; index += 1) {
            item.decreaseQuantity(actorDisplayName, clock);
        }
        touch(actorDisplayName, clock);
        recordEvent(new ShoppingDomainEvent("shopping-list-item.quantity-decreased", id, itemId, actorDisplayName.value(), updatedAt));
        return item;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public ShoppingListStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getArchivedAt() {
        return archivedAt;
    }

    public String getLastModifiedByDisplayName() {
        return lastModifiedByDisplayName;
    }

    public List<ShoppingListItem> getItems() {
        return items.stream()
                .sorted(Comparator.comparingInt(ShoppingListItem::getPosition))
                .toList();
    }

    public void addRestoredItem(ShoppingListItem item) {
        items.add(item);
    }

    private void ensureActive() {
        if (status == ShoppingListStatus.ARCHIVED) {
            throw new IllegalArgumentException("Archived lists cannot be modified.");
        }
    }

    private int nextPosition() {
        return items.stream()
                .map(ShoppingListItem::getPosition)
                .max(Integer::compareTo)
                .orElse(0) + 1;
    }

    private ShoppingListItem getItem(UUID itemId) {
        Optional<ShoppingListItem> item = items.stream()
                .filter(candidate -> candidate.getId().equals(itemId))
                .findFirst();
        return item.orElseThrow(() -> new IllegalArgumentException("Shopping list item not found: " + itemId));
    }

    private void touch(ActorDisplayName actorDisplayName, Clock clock) {
        this.updatedAt = clock.instant();
        this.lastModifiedByDisplayName = actorDisplayName.value();
    }

    private static String normalizeName(String rawName) {
        if (rawName == null || rawName.isBlank()) {
            throw new IllegalArgumentException("List name must not be blank.");
        }
        String normalized = rawName.trim();
        if (normalized.length() > 120) {
            throw new IllegalArgumentException("List name must be at most 120 characters.");
        }
        return normalized;
    }
}
