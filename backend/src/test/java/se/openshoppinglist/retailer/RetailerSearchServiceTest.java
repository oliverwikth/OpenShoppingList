package se.openshoppinglist.retailer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Optional;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import se.openshoppinglist.actor.ActorDisplayName;
import se.openshoppinglist.lists.domain.ShoppingList;
import se.openshoppinglist.lists.domain.ShoppingListRepository;
import se.openshoppinglist.retailer.application.RetailerSearchPort;
import se.openshoppinglist.retailer.application.RetailerSearchService;
import se.openshoppinglist.lists.domain.ExternalArticleSnapshot;
import se.openshoppinglist.retailer.domain.RetailerArticleSearchResult;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

class RetailerSearchServiceTest {

    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-03-28T13:00:00Z"), ZoneOffset.UTC);

    @Test
    void rejectsBlankQueries() {
        RetailerSearchService retailerSearchService = new RetailerSearchService((query, page) -> new RetailerSearchResponse(
                "willys",
                query,
                page,
                0,
                0,
                false,
                true,
                null,
                List.of()
        ), emptyRepository());

        assertThatThrownBy(() -> retailerSearchService.search(" ", 0))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must not be blank");
    }

    @Test
    void delegatesToProviderPort() {
        RetailerArticleSearchResult result = new RetailerArticleSearchResult(
                "willys",
                "100",
                "Kaffe",
                "500g",
                null,
                null,
                null,
                null,
                "{}",
                0
        );
        RetailerSearchPort port = (query, page) -> new RetailerSearchResponse("willys", query, page, 3, 30, true, true, null, List.of(result));
        RetailerSearchService retailerSearchService = new RetailerSearchService(port, emptyRepository());

        RetailerSearchResponse response = retailerSearchService.search("kaffe", 1);

        assertThat(response.results()).containsExactly(result);
        assertThat(response.query()).isEqualTo("kaffe");
        assertThat(response.currentPage()).isEqualTo(1);
    }

    @Test
    void ranksPreviouslyBoughtExactArticlesBeforeOtherStoreResults() {
        RetailerSearchPort port = (query, page) -> new RetailerSearchResponse(
                "willys",
                query,
                page,
                1,
                3,
                false,
                true,
                null,
                List.of(
                        new RetailerArticleSearchResult("willys", "101", "Halloumi budget", "200g", null, null, null, null, "{}", 0),
                        new RetailerArticleSearchResult("willys", "202", "Halloumi favorit", "200g", null, null, null, null, "{}", 0),
                        new RetailerArticleSearchResult("willys", "303", "Halloumi premium", "200g", null, null, null, null, "{}", 0)
                )
        );

        ShoppingList shoppingList = ShoppingList.create("Veckohandling", new ActorDisplayName("anna"), FIXED_CLOCK);
        shoppingList.addExternalItem(
                new ExternalArticleSnapshot("willys", "202", "Halloumi favorit", "200g", null, null, null, null, "{}"),
                2,
                new ActorDisplayName("anna"),
                FIXED_CLOCK
        );
        shoppingList.checkItem(shoppingList.getItems().getFirst().getId(), new ActorDisplayName("anna"), FIXED_CLOCK);

        RetailerSearchService retailerSearchService = new RetailerSearchService(port, repositoryWith(shoppingList));

        RetailerSearchResponse response = retailerSearchService.search("halloumi", 0);

        assertThat(response.results())
                .extracting(RetailerArticleSearchResult::articleId)
                .containsExactly("202", "101", "303");
        assertThat(response.results().getFirst().purchaseCount()).isEqualTo(2);
    }

    @Test
    void rejectsNegativePages() {
        RetailerSearchService retailerSearchService = new RetailerSearchService((query, page) -> new RetailerSearchResponse(
                "willys",
                query,
                page,
                0,
                0,
                false,
                true,
                null,
                List.of()
        ), emptyRepository());

        assertThatThrownBy(() -> retailerSearchService.search("kaffe", -1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must not be negative");
    }

    private ShoppingListRepository emptyRepository() {
        return repositoryWith();
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
            public Optional<ShoppingList> findById(UUID listId) {
                return List.of(shoppingLists).stream()
                        .filter(shoppingList -> shoppingList.getId().equals(listId))
                        .findFirst();
            }
        };
    }
}
