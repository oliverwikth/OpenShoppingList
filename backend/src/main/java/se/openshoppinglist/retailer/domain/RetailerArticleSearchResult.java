package se.openshoppinglist.retailer.domain;

import java.math.BigDecimal;

public record RetailerArticleSearchResult(
        String provider,
        String articleId,
        String title,
        String subtitle,
        String imageUrl,
        String category,
        BigDecimal priceAmount,
        String currency,
        String rawPayloadJson
) {
}
