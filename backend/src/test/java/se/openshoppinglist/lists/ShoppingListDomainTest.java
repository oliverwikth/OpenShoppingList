package se.openshoppinglist.lists;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import se.openshoppinglist.actor.ActorDisplayName;
import se.openshoppinglist.lists.domain.ShoppingList;
import se.openshoppinglist.lists.domain.ShoppingListItem;

class ShoppingListDomainTest {

    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-03-26T18:00:00Z"), ZoneOffset.UTC);

    @Test
    void addsManualItemsAndTracksCheckState() {
        ShoppingList shoppingList = ShoppingList.create("Veckohandling", new ActorDisplayName("anna"), FIXED_CLOCK);

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
}
