package se.openshoppinglist.retailer.domain;

import java.util.List;

public record RetailerSearchResponse(
        String provider,
        String query,
        boolean available,
        String message,
        List<RetailerArticleSearchResult> results
) {
}
