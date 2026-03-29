package se.openshoppinglist.retailer.application;

import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import se.openshoppinglist.retailer.domain.RetailerArticleSearchResult;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

@Service
public class RetailerSearchService {

    private final RetailerSearchPort retailerSearchPort;
    private final RetailerSearchPurchaseHistoryService purchaseHistoryService;

    public RetailerSearchService(
            RetailerSearchPort retailerSearchPort,
            RetailerSearchPurchaseHistoryService purchaseHistoryService
    ) {
        this.retailerSearchPort = retailerSearchPort;
        this.purchaseHistoryService = purchaseHistoryService;
    }

    public RetailerSearchResponse search(String query, int page) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("Search query must not be blank.");
        }
        if (page < 0) {
            throw new IllegalArgumentException("Search page must not be negative.");
        }

        RetailerSearchResponse providerResponse = retailerSearchPort.search(query.trim(), page);
        RetailerSearchPurchaseHistoryService.PurchaseSignals purchaseSignals = purchaseHistoryService.purchaseSignals();
        List<RetailerArticleSearchResult> rankedResults = providerResponse.results().stream()
                .map(result -> {
                    int articlePurchaseCount = purchaseSignals.articleCountFor(result.provider(), result.articleId());
                    int titlePurchaseCount = purchaseSignals.titleCountFor(result.title());
                    int purchaseCount = articlePurchaseCount > 0 ? articlePurchaseCount : titlePurchaseCount;

                    return new RankedResult(
                            new RetailerArticleSearchResult(
                                    result.provider(),
                                    result.articleId(),
                                    result.title(),
                                    result.subtitle(),
                                    result.imageUrl(),
                                    result.category(),
                                    result.priceAmount(),
                                    result.currency(),
                                    result.rawPayloadJson(),
                                    purchaseCount
                            ),
                            articlePurchaseCount,
                            titlePurchaseCount
                    );
                })
                .sorted(Comparator
                        .comparingInt(RankedResult::articlePurchaseCount).reversed()
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
            int titlePurchaseCount
    ) {
    }
}
