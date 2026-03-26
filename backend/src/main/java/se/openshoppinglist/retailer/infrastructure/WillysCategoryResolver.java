package se.openshoppinglist.retailer.infrastructure;

import java.util.List;
import java.util.Locale;

final class WillysCategoryResolver {

    private WillysCategoryResolver() {
    }

    static String resolvePrimaryCategory(String googleAnalyticsCategory, List<String> breadcrumbNames) {
        String categoryFromAnalytics = topLevelAnalyticsCategory(googleAnalyticsCategory);
        if (categoryFromAnalytics != null) {
            return categoryFromAnalytics;
        }

        if (breadcrumbNames == null) {
            return null;
        }

        return breadcrumbNames.stream()
                .map(WillysCategoryResolver::normalizeBreadcrumbName)
                .filter(name -> name != null && !name.equalsIgnoreCase("Alla varor"))
                .findFirst()
                .orElse(null);
    }

    static String topLevelAnalyticsCategory(String googleAnalyticsCategory) {
        if (googleAnalyticsCategory == null || googleAnalyticsCategory.isBlank()) {
            return null;
        }

        String topLevel = googleAnalyticsCategory.split("\\|")[0].trim();
        if (topLevel.isEmpty()) {
            return null;
        }

        return formatCategory(topLevel);
    }

    private static String normalizeBreadcrumbName(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }

        return formatCategory(name.trim());
    }

    private static String formatCategory(String value) {
        String normalized = value
                .trim()
                .replace('-', ' ')
                .replace('_', ' ');

        if (normalized.isEmpty()) {
            return null;
        }

        return normalized.substring(0, 1).toUpperCase(Locale.forLanguageTag("sv-SE")) + normalized.substring(1);
    }
}
