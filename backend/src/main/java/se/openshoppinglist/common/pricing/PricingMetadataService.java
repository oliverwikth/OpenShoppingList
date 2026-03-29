package se.openshoppinglist.common.pricing;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.Locale;
import org.springframework.stereotype.Component;

@Component
public class PricingMetadataService {

    public static final BigDecimal DEFAULT_QUANTITY_FACTOR = BigDecimal.ONE;
    public static final BigDecimal ASSUMED_WEIGHTED_ITEM_KILOGRAMS = new BigDecimal("0.1");

    private final ObjectMapper objectMapper;

    public PricingMetadataService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public PricingDetails fromRequest(String title, String subtitle, PricingDetails requestPricing) {
        return normalize(
                title,
                subtitle,
                requestPricing == null ? null : requestPricing.unitPriceUnit(),
                requestPricing == null ? null : requestPricing.comparisonPriceAmount(),
                requestPricing == null ? null : requestPricing.comparisonPriceUnit(),
                null
        );
    }

    public PricingDetails fromWillysProduct(
            String title,
            String subtitle,
            String price,
            String priceUnit,
            String comparePrice,
            String comparePriceUnit
    ) {
        return normalize(title, subtitle, priceUnit, parseLocalizedPrice(comparePrice), comparePriceUnit, price);
    }

    public PricingDetails fromStoredMetadata(String title, String subtitle, String metadataJson) {
        if (metadataJson == null || metadataJson.isBlank()) {
            return normalize(title, subtitle, null, null, null, null);
        }

        try {
            StoredPricingMetadata stored = objectMapper.readValue(metadataJson, StoredPricingMetadata.class);
            if (stored.hasStructuredFields()) {
                return normalize(
                        title,
                        subtitle,
                        stored.unitPriceUnit(),
                        stored.comparisonPriceAmount(),
                        stored.comparisonPriceUnit(),
                        null
                );
            }

            return normalize(
                    title,
                    subtitle,
                    stored.priceUnit(),
                    parseLocalizedPrice(stored.comparePrice()),
                    stored.comparePriceUnit(),
                    stored.price()
            );
        } catch (JsonProcessingException exception) {
            return normalize(title, subtitle, null, null, null, null);
        }
    }

    public String toMetadataJson(PricingDetails pricing) {
        StoredPricingMetadata stored = pricing == null
                ? new StoredPricingMetadata(null, null, null, null, null, null, null, null)
                : new StoredPricingMetadata(
                        normalizeUnit(pricing.unitPriceUnit()),
                        pricing.comparisonPriceAmount(),
                        normalizeUnit(pricing.comparisonPriceUnit()),
                        pricing.assumedQuantityFactor(),
                        null,
                        null,
                        null,
                        null
                );

        try {
            return objectMapper.writeValueAsString(stored);
        } catch (JsonProcessingException exception) {
            return "{}";
        }
    }

    private PricingDetails normalize(
            String title,
            String subtitle,
            String unitPriceUnit,
            BigDecimal comparisonPriceAmount,
            String comparisonPriceUnit,
            String priceText
    ) {
        String normalizedUnitPriceUnit = normalizeUnit(firstNonBlank(unitPriceUnit, extractUnitFromPriceText(priceText)));
        String normalizedComparisonUnit = normalizeUnit(comparisonPriceUnit);
        BigDecimal quantityFactor = isPerKilogramUnit(normalizedUnitPriceUnit) || looksLikeKilogramPrice(title, subtitle, priceText)
                ? ASSUMED_WEIGHTED_ITEM_KILOGRAMS
                : DEFAULT_QUANTITY_FACTOR;

        return new PricingDetails(
                normalizedUnitPriceUnit,
                comparisonPriceAmount,
                normalizedComparisonUnit,
                quantityFactor
        );
    }

    private boolean looksLikeKilogramPrice(String title, String subtitle, String priceText) {
        String normalized = normalizeForDetection(title) + " " + normalizeForDetection(subtitle) + " " + normalizeForDetection(priceText);
        return normalized.contains("kr/kg") || normalized.contains("/kg") || normalized.contains("perkg");
    }

    private boolean isPerKilogramUnit(String unit) {
        return "kg".equals(unit);
    }

    private String normalizeUnit(String unit) {
        if (unit == null || unit.isBlank()) {
            return null;
        }

        String normalized = unit.trim().toLowerCase(Locale.ROOT);
        if (normalized.startsWith("kr/")) {
            normalized = normalized.substring(3);
        }
        return normalized.isBlank() ? null : normalized;
    }

    private String extractUnitFromPriceText(String priceText) {
        String normalized = normalizeForDetection(priceText);
        if (normalized.contains("/kg") || normalized.contains("kr/kg")) {
            return "kg";
        }
        if (normalized.contains("/st") || normalized.contains("kr/st")) {
            return "st";
        }
        if (normalized.contains("/l") || normalized.contains("kr/l")) {
            return "l";
        }
        return null;
    }

    private String normalizeForDetection(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }

        return value.trim().toLowerCase(Locale.ROOT).replace(" ", "");
    }

    private BigDecimal parseLocalizedPrice(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String normalized = value.replaceAll("[^\\d,.-]", "").replace(',', '.');
        if (normalized.isBlank()) {
            return null;
        }

        try {
            return new BigDecimal(normalized);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        return fallback;
    }

    private record StoredPricingMetadata(
            String unitPriceUnit,
            BigDecimal comparisonPriceAmount,
            String comparisonPriceUnit,
            BigDecimal assumedQuantityFactor,
            String price,
            String priceUnit,
            String comparePrice,
            String comparePriceUnit
    ) {
        boolean hasStructuredFields() {
            return unitPriceUnit != null || comparisonPriceAmount != null || comparisonPriceUnit != null || assumedQuantityFactor != null;
        }
    }
}
