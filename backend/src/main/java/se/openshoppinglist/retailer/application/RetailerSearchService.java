package se.openshoppinglist.retailer.application;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import se.openshoppinglist.lists.domain.ShoppingListRepository;
import se.openshoppinglist.retailer.domain.RetailerArticleSearchResult;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

@Service
public class RetailerSearchService {

    private final RetailerSearchPort retailerSearchPort;
    private final ShoppingListRepository shoppingListRepository;

    public RetailerSearchService(RetailerSearchPort retailerSearchPort, ShoppingListRepository shoppingListRepository) {
        this.retailerSearchPort = retailerSearchPort;
        this.shoppingListRepository = shoppingListRepository;
    }

    public RetailerSearchResponse search(String query, int page) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Search query must not be blank.");
        }
        if (page < 0) {
            throw new IllegalArgumentException("Search page must not be negative.");
        }

        RetailerSearchResponse providerResponse = retailerSearchPort.search(query.trim(), page);
        Map<String, Integer> purchaseCountsByArticle = purchaseCountsByArticle();
        List<RetailerArticleSearchResult> rankedResults = providerResponse.results().stream()
                .map(result -> new RetailerArticleSearchResult(
                        result.provider(),
                        result.articleId(),
                        result.title(),
                        result.subtitle(),
                        result.imageUrl(),
                        result.category(),
                        result.priceAmount(),
                        result.currency(),
                        result.rawPayloadJson(),
                        purchaseCountsByArticle.getOrDefault(articleKey(result.provider(), result.articleId()), 0)
                ))
                .sorted(Comparator.comparingInt(RetailerArticleSearchResult::purchaseCount).reversed())
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

    private Map<String, Integer> purchaseCountsByArticle() {
        return shoppingListRepository.findAll().stream()
                .flatMap(list -> list.getItems().stream())
                .filter(item -> item.isChecked() && item.externalArticleSnapshot() != null)
                .collect(java.util.stream.Collectors.toMap(
                        item -> articleKey(item.getSourceProvider(), item.getSourceArticleId()),
                        se.openshoppinglist.lists.domain.ShoppingListItem::getQuantity,
                        Integer::sum
                ));
    }

    private String articleKey(String provider, String articleId) {
        return (provider == null ? "" : provider.trim()) + ":" + (articleId == null ? "" : articleId.trim());
    }
}
