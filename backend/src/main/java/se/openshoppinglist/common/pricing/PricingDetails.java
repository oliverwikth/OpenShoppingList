package se.openshoppinglist.common.pricing;

import java.math.BigDecimal;

public record PricingDetails(
        String unitPriceUnit,
        BigDecimal comparisonPriceAmount,
        String comparisonPriceUnit,
        BigDecimal assumedQuantityFactor
) {
}
