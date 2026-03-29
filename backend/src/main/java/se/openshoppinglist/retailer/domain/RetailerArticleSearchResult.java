package se.openshoppinglist.retailer.domain;

import java.math.BigDecimal;
import se.openshoppinglist.common.pricing.PricingDetails;

public record RetailerArticleSearchResult(
        String provider,
        String articleId,
        String title,
        String subtitle,
        String imageUrl,
        String category,
        BigDecimal priceAmount,
        String currency,
        PricingDetails pricing,
        int purchaseCount
) {
}
