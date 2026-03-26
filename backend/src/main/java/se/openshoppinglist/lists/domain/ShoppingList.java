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
        ensureActive();
        ShoppingListItem item = ShoppingListItem.manual(this, nextPosition(), title, note, actorDisplayName, clock);
        items.add(item);
        touch(actorDisplayName, clock);
        recordEvent(new ShoppingDomainEvent("shopping-list-item.added", id, item.getId(), actorDisplayName.value(), updatedAt));
        return item;
    }

    public ShoppingListItem addExternalItem(ExternalArticleSnapshot snapshot, ActorDisplayName actorDisplayName, Clock clock) {
        ensureActive();
        ShoppingListItem item = ShoppingListItem.external(this, nextPosition(), snapshot, actorDisplayName, clock);
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
