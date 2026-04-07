package se.openshoppinglist.lists;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import se.openshoppinglist.actor.ActorDisplayName;
import se.openshoppinglist.common.pricing.PricingMetadataService;
import se.openshoppinglist.lists.application.ShoppingStatsQueryService;
import se.openshoppinglist.lists.application.ShoppingListViews;
import se.openshoppinglist.lists.domain.ExternalArticleSnapshot;
import se.openshoppinglist.lists.domain.ShoppingList;
import se.openshoppinglist.lists.domain.ShoppingListProvider;
import se.openshoppinglist.lists.domain.ShoppingListRepository;

class ShoppingStatsQueryServiceTest {

    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-04-07T10:00:00Z"), ZoneOffset.UTC);

    @Test
    void mergesTopItemsBySemanticTitleWhenIdentityIsMissing() {
        ShoppingList willysList = ShoppingList.create("Willys", ShoppingListProvider.WILLYS, new ActorDisplayName("anna"), FIXED_CLOCK);
        willysList.addExternalItem(
                new ExternalArticleSnapshot(
                        "willys",
                        "w-1",
                        null,
                        null,
                        null,
                        "Normalsaltat Smör & Rapsolja 75%",
                        "500g",
                        null,
                        null,
                        new java.math.BigDecimal("51.86"),
                        "SEK",
                        "{}"
                ),
                1,
                new ActorDisplayName("anna"),
                FIXED_CLOCK
        );
        willysList.checkItem(willysList.getItems().getFirst().getId(), new ActorDisplayName("anna"), FIXED_CLOCK);

        ShoppingList lidlList = ShoppingList.create("Lidl", ShoppingListProvider.LIDL, new ActorDisplayName("anna"), FIXED_CLOCK);
        lidlList.addExternalItem(
                new ExternalArticleSnapshot(
                        "lidl",
                        "l-1",
                        null,
                        null,
                        null,
                        "Bredbart smör & raps mellan",
                        "500g",
                        null,
                        null,
                        new java.math.BigDecimal("37.76"),
                        "SEK",
                        "{}"
                ),
                2,
                new ActorDisplayName("anna"),
                FIXED_CLOCK
        );
        lidlList.checkItem(lidlList.getItems().getFirst().getId(), new ActorDisplayName("anna"), FIXED_CLOCK);

        ShoppingStatsQueryService service = new ShoppingStatsQueryService(
                repositoryWith(willysList, lidlList),
                FIXED_CLOCK,
                new PricingMetadataService(new ObjectMapper())
        );

        ShoppingListViews.ShoppingStatsView stats = service.getStats("all");

        assertThat(stats.topItems()).hasSize(1);
        assertThat(stats.topItems().getFirst().quantity()).isEqualTo(3);
    }

    private ShoppingListRepository repositoryWith(ShoppingList... shoppingLists) {
        return new ShoppingListRepository() {
            @Override
            public ShoppingList save(ShoppingList shoppingList) {
                return shoppingList;
            }

            @Override
            public List<ShoppingList> findAll() {
                return List.of(shoppingLists);
            }

            @Override
            public List<ShoppingList> findActive() {
                throw new UnsupportedOperationException("findActive");
            }

            @Override
            public List<ShoppingList> findPage(int pageNumber, int pageSize) {
                throw new UnsupportedOperationException("findPage");
            }

            @Override
            public List<ShoppingList> findActivePage(int pageNumber, int pageSize) {
                throw new UnsupportedOperationException("findActivePage");
            }

            @Override
            public long count() {
                return shoppingLists.length;
            }

            @Override
            public long countActive() {
                throw new UnsupportedOperationException("countActive");
            }

            @Override
            public Optional<ShoppingList> findById(UUID listId) {
                return List.of(shoppingLists).stream()
                        .filter(shoppingList -> shoppingList.getId().equals(listId))
                        .findFirst();
            }
        };
    }
}
