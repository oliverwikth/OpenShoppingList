package se.openshoppinglist.retailer.domain;

import java.util.List;

public record RetailerSearchResponse(
        String provider,
        String query,
        int currentPage,
        int totalPages,
        int totalResults,
        boolean hasMoreResults,
        boolean available,
        String message,
        List<RetailerArticleSearchResult> results
) {
}
