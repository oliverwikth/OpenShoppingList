package se.openshoppinglist.lists;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import se.openshoppinglist.actor.ActorDisplayName;
import se.openshoppinglist.lists.domain.ShoppingList;
import se.openshoppinglist.lists.domain.ShoppingListItem;
import se.openshoppinglist.lists.domain.ShoppingListProvider;

class ShoppingListDomainTest {

    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-03-26T18:00:00Z"), ZoneOffset.UTC);

    @Test
    void addsManualItemsAndTracksCheckState() {
        ShoppingList shoppingList = ShoppingList.create("Veckohandling", ShoppingListProvider.WILLYS, new ActorDisplayName("anna"), FIXED_CLOCK);

        ShoppingListItem item = shoppingList.addManualItem("Mjölk", "Laktosfri", new ActorDisplayName("anna"), FIXED_CLOCK);

        assertThat(shoppingList.getItems()).hasSize(1);
        assertThat(item.getTitle()).isEqualTo("Mjölk");
        assertThat(item.getManualNote()).isEqualTo("Laktosfri");
        assertThat(item.isChecked()).isFalse();

        shoppingList.checkItem(item.getId(), new ActorDisplayName("olle"), FIXED_CLOCK);

        assertThat(item.isChecked()).isTrue();
        assertThat(item.getCheckedByDisplayName()).isEqualTo("olle");

        shoppingList.uncheckItem(item.getId(), new ActorDisplayName("anna"), FIXED_CLOCK);

        assertThat(item.isChecked()).isFalse();
        assertThat(item.getCheckedByDisplayName()).isNull();
        assertThat(shoppingList.pullDomainEvents())
                .extracting("eventType")
                .containsExactly(
                        "shopping-list.created",
                        "shopping-list-item.added",
                        "shopping-list-item.checked",
                        "shopping-list-item.unchecked"
                );
    }

    @Test
    void mergesRepeatedAddsIntoQuantityAndRemovesItemAtZero() {
        ShoppingList shoppingList = ShoppingList.create("Veckohandling", ShoppingListProvider.WILLYS, new ActorDisplayName("anna"), FIXED_CLOCK);

        ShoppingListItem item = shoppingList.addManualItem("Bananer", "", new ActorDisplayName("anna"), FIXED_CLOCK);
        ShoppingListItem sameItem = shoppingList.addManualItem("Bananer", "", new ActorDisplayName("anna"), FIXED_CLOCK);

        assertThat(shoppingList.getItems()).hasSize(1);
        assertThat(sameItem.getId()).isEqualTo(item.getId());
        assertThat(item.getQuantity()).isEqualTo(2);

        shoppingList.decreaseItemQuantity(item.getId(), new ActorDisplayName("anna"), FIXED_CLOCK);
        assertThat(item.getQuantity()).isEqualTo(1);

        shoppingList.decreaseItemQuantity(item.getId(), new ActorDisplayName("anna"), FIXED_CLOCK);
        assertThat(shoppingList.getItems()).isEmpty();
        assertThat(shoppingList.pullDomainEvents())
                .extracting("eventType")
                .containsExactly(
                        "shopping-list.created",
                        "shopping-list-item.added",
                        "shopping-list-item.quantity-increased",
                        "shopping-list-item.quantity-decreased",
                        "shopping-list-item.removed"
                );
    }

    @Test
    void addsBatchedQuantityInSingleOperation() {
        ShoppingList shoppingList = ShoppingList.create("Veckohandling", ShoppingListProvider.WILLYS, new ActorDisplayName("anna"), FIXED_CLOCK);

        ShoppingListItem item = shoppingList.addManualItem("Apelsiner", "", 5, new ActorDisplayName("anna"), FIXED_CLOCK);

        assertThat(shoppingList.getItems()).hasSize(1);
        assertThat(item.getQuantity()).isEqualTo(5);
        assertThat(shoppingList.pullDomainEvents())
                .extracting("eventType")
                .containsExactly(
                        "shopping-list.created",
                        "shopping-list-item.added"
                );
    }

    @Test
    void adjustsItemQuantityByDelta() {
        ShoppingList shoppingList = ShoppingList.create("Veckohandling", ShoppingListProvider.WILLYS, new ActorDisplayName("anna"), FIXED_CLOCK);

        ShoppingListItem item = shoppingList.addManualItem("Tacosås", "", 2, new ActorDisplayName("anna"), FIXED_CLOCK);

        ShoppingListItem increasedItem = shoppingList.adjustItemQuantity(item.getId(), 3, new ActorDisplayName("olle"), FIXED_CLOCK);
        assertThat(increasedItem).isNotNull();
        assertThat(increasedItem.getQuantity()).isEqualTo(5);

        ShoppingListItem decreasedItem = shoppingList.adjustItemQuantity(item.getId(), -4, new ActorDisplayName("olle"), FIXED_CLOCK);
        assertThat(decreasedItem).isNotNull();
        assertThat(decreasedItem.getQuantity()).isEqualTo(1);

        ShoppingListItem removedItem = shoppingList.adjustItemQuantity(item.getId(), -1, new ActorDisplayName("olle"), FIXED_CLOCK);
        assertThat(removedItem).isNull();
        assertThat(shoppingList.getItems()).isEmpty();
        assertThat(shoppingList.pullDomainEvents())
                .extracting("eventType")
                .containsExactly(
                        "shopping-list.created",
                        "shopping-list-item.added",
                        "shopping-list-item.quantity-increased",
                        "shopping-list-item.quantity-decreased",
                        "shopping-list-item.removed"
                );
    }
}
