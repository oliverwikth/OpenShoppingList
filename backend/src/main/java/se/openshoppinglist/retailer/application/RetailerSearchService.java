package se.openshoppinglist.retailer.application;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.stereotype.Service;
import se.openshoppinglist.lists.domain.ShoppingList;
import se.openshoppinglist.lists.domain.ShoppingListRepository;
import se.openshoppinglist.retailer.domain.RetailerArticleSearchResult;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

@Service
public class RetailerSearchService {

    private final Map<String, RetailerSearchPort> portsByProvider;
    private final RetailerSearchPurchaseHistoryService purchaseHistoryService;
    private final ShoppingListRepository shoppingListRepository;

    public RetailerSearchService(
            List<RetailerSearchPort> retailerSearchPorts,
            RetailerSearchPurchaseHistoryService purchaseHistoryService,
            ShoppingListRepository shoppingListRepository
    ) {
        this.portsByProvider = retailerSearchPorts.stream()
                .collect(java.util.stream.Collectors.toMap(RetailerSearchPort::provider, Function.identity()));
        this.purchaseHistoryService = purchaseHistoryService;
        this.shoppingListRepository = shoppingListRepository;
    }

    public RetailerSearchResponse search(UUID listId, String query, int page) {
        if (listId == null) {
            throw new IllegalArgumentException("List id must not be null.");
        }
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Search query must not be blank.");
        }
        if (page < 0) {
            throw new IllegalArgumentException("Search page must not be negative.");
        }

        ShoppingList shoppingList = shoppingListRepository.findById(listId)
                .orElseThrow(() -> new jakarta.persistence.EntityNotFoundException("Shopping list not found: " + listId));
        String provider = shoppingList.getProvider().id();
        RetailerSearchPort retailerSearchPort = portsByProvider.get(provider);
        if (retailerSearchPort == null) {
            throw new IllegalArgumentException("Unsupported retailer provider for list: " + provider);
        }

        RetailerSearchResponse providerResponse = retailerSearchPort.search(query.trim(), page);
        RetailerSearchPurchaseHistoryService.PurchaseSignals purchaseSignals = purchaseHistoryService.purchaseSignals();
        List<RetailerArticleSearchResult> rankedResults = providerResponse.results().stream()
                .map(result -> {
                    int articlePurchaseCount = purchaseSignals.articleCountFor(
                            result.provider(),
                            result.articleId(),
                            result.canonicalArticleId(),
                            result.ean(),
                            result.sku()
                    );
                    int keywordMatchTokenCount = purchaseSignals.keywordMatchTokenCountFor(result.title());
                    int keywordPurchaseCount = purchaseSignals.keywordCountFor(result.title());
                    int titlePurchaseCount = purchaseSignals.titleCountFor(result.title());
                    int purchaseCount = articlePurchaseCount > 0
                            ? articlePurchaseCount
                            : (keywordPurchaseCount > 0 ? keywordPurchaseCount : titlePurchaseCount);

                    return new RankedResult(
                            new RetailerArticleSearchResult(
                                    result.provider(),
                                    result.articleId(),
                                    result.canonicalArticleId(),
                                    result.ean(),
                                    result.sku(),
                                    result.title(),
                                    result.subtitle(),
                                    result.imageUrl(),
                                    result.category(),
                                    result.priceAmount(),
                                    result.currency(),
                                    result.pricing(),
                                    purchaseCount
                            ),
                            articlePurchaseCount,
                            keywordMatchTokenCount,
                            keywordPurchaseCount,
                            titlePurchaseCount
                    );
                })
                .sorted(Comparator
                        .comparingInt(RankedResult::articlePurchaseCount).reversed()
                        .thenComparing(Comparator.comparingInt(RankedResult::keywordMatchTokenCount).reversed())
                        .thenComparing(Comparator.comparingInt(RankedResult::keywordPurchaseCount).reversed())
                        .thenComparing(Comparator.comparingInt(RankedResult::titlePurchaseCount).reversed()))
                .map(RankedResult::result)
                .toList();

        return new RetailerSearchResponse(
                providerResponse.provider(),
                providerResponse.query(),
                providerResponse.currentPage(),
                providerResponse.totalPages(),
                providerResponse.totalResults(),
                providerResponse.hasMoreResults(),
                providerResponse.available(),
                providerResponse.message(),
                rankedResults
        );
    }

    private record RankedResult(
            RetailerArticleSearchResult result,
            int articlePurchaseCount,
            int keywordMatchTokenCount,
            int keywordPurchaseCount,
            int titlePurchaseCount
    ) {
    }
}
