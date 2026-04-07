package se.openshoppinglist.lists.domain;

import java.math.BigDecimal;

public record ExternalArticleSnapshot(
        String provider,
        String articleId,
        String canonicalArticleId,
        String ean,
        String sku,
        String title,
        String subtitle,
        String imageUrl,
        String category,
        BigDecimal priceAmount,
        String currency,
        String rawPayloadJson
) {
}
