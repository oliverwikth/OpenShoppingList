package se.openshoppinglist.retailer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import java.util.List;
import java.util.UUID;
import java.lang.reflect.Proxy;
import org.junit.jupiter.api.Test;
import se.openshoppinglist.actor.ActorDisplayName;
import se.openshoppinglist.lists.application.CheckedItemActivityPayload;
import se.openshoppinglist.lists.domain.ShoppingList;
import se.openshoppinglist.lists.domain.ShoppingListRepository;
import se.openshoppinglist.lists.infrastructure.ItemActivityLogEntry;
import se.openshoppinglist.lists.infrastructure.ItemActivityLogRepository;
import se.openshoppinglist.retailer.application.RetailerSearchPort;
import se.openshoppinglist.retailer.application.RetailerSearchService;
import se.openshoppinglist.retailer.application.RetailerSearchPurchaseHistoryService;
import se.openshoppinglist.lists.domain.ExternalArticleSnapshot;
import se.openshoppinglist.retailer.domain.RetailerArticleSearchResult;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

class RetailerSearchServiceTest {

    private static final Clock FIXED_CLOCK = Clock.fixed(Instant.parse("2026-03-28T13:00:00Z"), ZoneOffset.UTC);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

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
        ), purchaseHistoryService(emptyRepository()));

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
        RetailerSearchService retailerSearchService = new RetailerSearchService(port, purchaseHistoryService(emptyRepository()));

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

        RetailerSearchService retailerSearchService = new RetailerSearchService(port, purchaseHistoryService(repositoryWith(shoppingList)));

        RetailerSearchResponse response = retailerSearchService.search("halloumi", 0);

        assertThat(response.results())
                .extracting(RetailerArticleSearchResult::articleId)
                .containsExactly("202", "101", "303");
        assertThat(response.results().getFirst().purchaseCount()).isEqualTo(2);
    }

    @Test
    void ranksPreviouslyCheckedImportedLikeTitlesAheadOfUnseenStoreResults() {
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

        ShoppingList shoppingList = ShoppingList.create("Importerad Willys-list", new ActorDisplayName("anna"), FIXED_CLOCK);
        shoppingList.addManualItem("  Halloumi   favorit ", "Importerad mängd: 0.5 kg", new ActorDisplayName("anna"), FIXED_CLOCK);
        shoppingList.checkItem(shoppingList.getItems().getFirst().getId(), new ActorDisplayName("anna"), FIXED_CLOCK);
        shoppingList.uncheckItem(shoppingList.getItems().getFirst().getId(), new ActorDisplayName("anna"), FIXED_CLOCK);

        ItemActivityLogEntry checkedEntry = new ItemActivityLogEntry(
                UUID.randomUUID(),
                shoppingList.getId(),
                shoppingList.getItems().getFirst().getId(),
                "shopping-list-item.checked",
                "anna",
                checkedPayload("Halloumi favorit", 1, null, null),
                FIXED_CLOCK.instant()
        );
        RetailerSearchService retailerSearchService = new RetailerSearchService(
                port,
                purchaseHistoryService(repositoryWith(shoppingList), checkedEntry)
        );

        RetailerSearchResponse response = retailerSearchService.search("halloumi", 0);

        assertThat(response.results())
                .extracting(RetailerArticleSearchResult::articleId)
                .containsExactly("202", "101", "303");
        assertThat(response.results().getFirst().purchaseCount()).isEqualTo(1);
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
        ), purchaseHistoryService(emptyRepository()));

        assertThatThrownBy(() -> retailerSearchService.search("kaffe", -1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must not be negative");
    }

    private ShoppingListRepository emptyRepository() {
        return repositoryWith();
    }

    private RetailerSearchPurchaseHistoryService purchaseHistoryService(
            ShoppingListRepository shoppingListRepository,
            ItemActivityLogEntry... activityEntries
    ) {
        return new RetailerSearchPurchaseHistoryService(
                activityLogRepositoryWith(activityEntries),
                shoppingListRepository,
                OBJECT_MAPPER
        );
    }

    private ItemActivityLogRepository activityLogRepositoryWith(ItemActivityLogEntry... activityEntries) {
        return (ItemActivityLogRepository) Proxy.newProxyInstance(
                ItemActivityLogRepository.class.getClassLoader(),
                new Class<?>[] { ItemActivityLogRepository.class },
                (proxy, method, args) -> switch (method.getName()) {
                    case "findAllByEventTypeOrderByOccurredAtAsc" -> List.of(activityEntries);
                    case "findTop20ByListIdOrderByOccurredAtDesc" -> List.of();
                    case "toString" -> "InMemoryItemActivityLogRepository";
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == args[0];
                    default -> throw new UnsupportedOperationException(method.getName());
                }
        );
    }

    private String checkedPayload(String title, Integer quantity, String provider, String articleId) {
        try {
            return OBJECT_MAPPER.writeValueAsString(new CheckedItemActivityPayload(
                    "shopping-list-item.checked",
                    title,
                    quantity,
                    provider,
                    articleId
            ));
        } catch (Exception exception) {
            throw new RuntimeException(exception);
        }
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
