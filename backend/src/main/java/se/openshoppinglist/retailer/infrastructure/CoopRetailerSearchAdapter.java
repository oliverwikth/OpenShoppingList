package se.openshoppinglist.retailer.infrastructure;

import java.math.BigDecimal;
import java.util.List;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import se.openshoppinglist.common.pricing.PricingMetadataService;
import se.openshoppinglist.config.AppProperties;
import se.openshoppinglist.retailer.application.RetailerSearchPort;
import se.openshoppinglist.retailer.domain.RetailerArticleIdentity;
import se.openshoppinglist.retailer.domain.RetailerArticleSearchResult;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

@Component
class CoopRetailerSearchAdapter implements RetailerSearchPort {

    private static final String PROVIDER = "coop";
    private static final String RETAILER_NAME = "Coop";
    private static final String CLOUDINARY_UPLOAD_SEGMENT = "/image/upload/";
    private static final String CLOUDINARY_SEARCH_IMAGE_SEGMENT =
            "/images/f_auto,fl_clip,fl_progressive,q_auto,c_lpad,g_center,h_370,w_370/";

    private final RestClient restClient;
    private final AppProperties.CoopProperties properties;
    private final PricingMetadataService pricingMetadataService;

    CoopRetailerSearchAdapter(
            @Qualifier("coopRestClient") RestClient restClient,
            AppProperties appProperties,
            PricingMetadataService pricingMetadataService
    ) {
        this.restClient = restClient;
        this.properties = appProperties.retailer().coop();
        this.pricingMetadataService = pricingMetadataService;
    }

    @Override
    public String provider() {
        return PROVIDER;
    }

    @Override
    public RetailerSearchResponse search(String query, int page) {
        int pageSize = properties.maxResults();
        int offset = Math.max(0, page) * pageSize;
        try {
            CoopSearchResponse response = restClient.post()
                    .uri(builder -> builder.path(properties.searchPath())
                            .queryParam("api-version", properties.apiVersion())
                            .queryParam("store", properties.store())
                            .queryParam("device", properties.device())
                            .queryParam("direct", false)
                            .build())
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .header("Ocp-Apim-Subscription-Key", properties.subscriptionKey())
                    .body(new CoopSearchRequest(
                            query,
                            new CoopResultsOptions(offset, pageSize, List.of(), List.of()),
                            new CoopRelatedResultsOptions(0, pageSize)
                    ))
                    .retrieve()
                    .body(CoopSearchResponse.class);

            List<RetailerArticleSearchResult> results = response == null || response.results() == null || response.results().items() == null
                    ? List.of()
                    : response.results().items().stream()
                    .map(this::toSearchResult)
                    .toList();
            int totalResults = response == null || response.results() == null ? results.size() : response.results().count();
            int totalPages = totalResults <= 0 ? 0 : (int) Math.ceil(totalResults / (double) pageSize);
            boolean hasMoreResults = page + 1 < totalPages;

            return new RetailerSearchResponse(PROVIDER, query, page, totalPages, totalResults, hasMoreResults, true, null, results);
        } catch (RestClientException exception) {
            return new RetailerSearchResponse(
                    PROVIDER,
                    query,
                    page,
                    0,
                    0,
                    false,
                    false,
                    RetailerSearchFailureMessages.fromException(RETAILER_NAME, exception),
                    List.of()
            );
        }
    }

    private RetailerArticleSearchResult toSearchResult(CoopSearchItem item) {
        String title = joinNonBlank(item.name(), item.manufacturerName());
        String subtitle = item.packageSizeInformation();
        String ean = item.ean();
        String sku = item.id();
        String canonicalArticleId = RetailerArticleIdentity.canonicalArticleId(ean, null, sku);
        return new RetailerArticleSearchResult(
                PROVIDER,
                firstNonBlank(item.ean(), item.id()),
                canonicalArticleId,
                ean,
                sku,
                title,
                subtitle,
                upgradeImageUrl(item.imageUrl()),
                topLevelCategory(item.navCategories()),
                item.salesPriceData() == null ? null : item.salesPriceData().b2cPrice(),
                item.salesPriceData() == null || item.salesPriceData().b2cPrice() == null ? null : "SEK",
                pricingMetadataService.fromRequest(
                        title,
                        subtitle,
                        new se.openshoppinglist.common.pricing.PricingDetails(
                                item.comparativePriceUnit() == null ? null : item.comparativePriceUnit().unit(),
                                item.comparativePriceData() == null ? null : item.comparativePriceData().b2cPrice(),
                                item.comparativePriceUnit() == null ? null : item.comparativePriceUnit().unit(),
                                null
                        )
                ),
                0
        );
    }

    private String topLevelCategory(List<CoopCategory> categories) {
        if (categories == null || categories.isEmpty()) {
            return null;
        }
        CoopCategory current = categories.getFirst();
        CoopCategory highest = current;
        while (current.superCategories() != null && !current.superCategories().isEmpty()) {
            highest = current.superCategories().getFirst();
            current = highest;
        }
        return highest.name();
    }

    private String upgradeImageUrl(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return null;
        }
        String normalizedUrl = imageUrl.startsWith("http://")
                ? "https://" + imageUrl.substring("http://".length())
                : imageUrl;
        if (!normalizedUrl.contains(CLOUDINARY_UPLOAD_SEGMENT)) {
            return normalizedUrl;
        }

        int uploadIndex = normalizedUrl.indexOf(CLOUDINARY_UPLOAD_SEGMENT);
        String prefix = normalizedUrl.substring(0, uploadIndex);
        String resourcePath = normalizedUrl.substring(uploadIndex + CLOUDINARY_UPLOAD_SEGMENT.length());
        int extensionIndex = resourcePath.lastIndexOf('.');
        if (extensionIndex < 0) {
            return normalizedUrl;
        }

        String pathWithoutExtension = resourcePath.substring(0, extensionIndex);
        String fileName = pathWithoutExtension.substring(pathWithoutExtension.lastIndexOf('/') + 1);
        return prefix + CLOUDINARY_SEARCH_IMAGE_SEGMENT + pathWithoutExtension + "/" + fileName + ".jpg";
    }

    private String joinNonBlank(String primary, String suffix) {
        if (primary == null || primary.isBlank()) {
            return suffix;
        }
        if (suffix == null || suffix.isBlank()) {
            return primary;
        }
        return primary + " " + suffix;
    }

    private String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        return fallback;
    }

    record CoopSearchRequest(
            String query,
            CoopResultsOptions resultsOptions,
            CoopRelatedResultsOptions relatedResultsOptions
    ) {
    }

    record CoopResultsOptions(
            int skip,
            int take,
            List<String> sortBy,
            List<String> facets
    ) {
    }

    record CoopRelatedResultsOptions(int skip, int take) {
    }

    record CoopSearchResponse(CoopResults results) {
    }

    record CoopResults(int count, List<CoopSearchItem> items) {
    }

    record CoopSearchItem(
            String id,
            String ean,
            String name,
            String manufacturerName,
            String imageUrl,
            String packageSizeInformation,
            boolean availableOnline,
            List<CoopCategory> navCategories,
            CoopPriceData salesPriceData,
            String comparativePriceText,
            CoopComparativePriceUnit comparativePriceUnit,
            CoopPriceData comparativePriceData
    ) {
    }

    record CoopCategory(String code, String name, List<CoopCategory> superCategories) {
    }

    record CoopPriceData(BigDecimal b2cPrice, BigDecimal b2bPrice) {
    }

    record CoopComparativePriceUnit(String unit, String text) {
    }
}
