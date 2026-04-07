package se.openshoppinglist.retailer.domain;

import java.util.Locale;
import java.util.Set;
import java.util.LinkedHashSet;
import java.util.Collections;

public final class RetailerArticleIdentity {

    private RetailerArticleIdentity() {
    }

    public static String canonicalArticleId(String ean, String articleNumber, String sku) {
        String normalizedEan = normalizeEan(ean);
        if (!normalizedEan.isBlank()) {
            return "ean:" + normalizedEan;
        }

        String normalizedArticleNumber = normalizeCode(articleNumber);
        if (!normalizedArticleNumber.isBlank()) {
            return "article:" + normalizedArticleNumber;
        }

        String normalizedSku = normalizeCode(sku);
        if (!normalizedSku.isBlank()) {
            return "sku:" + normalizedSku;
        }

        return null;
    }

    public static String identityKey(
            String provider,
            String articleId,
            String canonicalArticleId,
            String ean,
            String sku
    ) {
        return identityKeys(provider, articleId, canonicalArticleId, ean, sku).stream().findFirst().orElse("");
    }

    public static Set<String> identityKeys(
            String provider,
            String articleId,
            String canonicalArticleId,
            String ean,
            String sku
    ) {
        LinkedHashSet<String> keys = new LinkedHashSet<>();

        String normalizedCanonical = normalizeCanonical(canonicalArticleId);
        if (!normalizedCanonical.isBlank()) {
            keys.add(normalizedCanonical);
        }

        String normalizedEan = normalizeEan(ean);
        if (!normalizedEan.isBlank()) {
            keys.add("ean:" + normalizedEan);
        }

        String providerArticle = providerArticleKey(provider, articleId);
        if (!providerArticle.isBlank()) {
            keys.add(providerArticle);
        }

        String normalizedSku = normalizeCode(sku);
        if (!normalizedSku.isBlank()) {
            keys.add("sku:" + normalizedSku);
        }

        return Collections.unmodifiableSet(keys);
    }

    private static String providerArticleKey(String provider, String articleId) {
        if (provider == null || provider.isBlank() || articleId == null || articleId.isBlank()) {
            return "";
        }
        return "provider:" + provider.trim().toLowerCase(Locale.ROOT) + ":" + articleId.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeCanonical(String canonicalArticleId) {
        if (canonicalArticleId == null || canonicalArticleId.isBlank()) {
            return "";
        }
        return canonicalArticleId.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeCode(String code) {
        if (code == null || code.isBlank()) {
            return "";
        }
        return code.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeEan(String rawEan) {
        if (rawEan == null || rawEan.isBlank()) {
            return "";
        }
        String digitsOnly = rawEan.chars()
                .filter(Character::isDigit)
                .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append)
                .toString();
        if (digitsOnly.length() < 8 || digitsOnly.length() > 14) {
            return "";
        }
        return digitsOnly;
    }
}
