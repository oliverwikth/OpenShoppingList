package se.openshoppinglist.retailer.infrastructure;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import se.openshoppinglist.common.pricing.PricingDetails;
import se.openshoppinglist.common.pricing.PricingMetadataService;
import se.openshoppinglist.config.AppProperties;
import se.openshoppinglist.retailer.application.RetailerSearchPort;
import se.openshoppinglist.retailer.domain.RetailerArticleSearchResult;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

@Component
class IcaRetailerSearchAdapter implements RetailerSearchPort {

    private static final String PROVIDER = "ica";
    private static final String RETAILER_NAME = "ICA";
    private static final Pattern UNIT_PATTERN = Pattern.compile("(?i)\\b\\d+(?:[.,]\\d+)?\\s*(kg|g|mg|l|dl|cl|ml|st)\\b");
    private static final String SESSION_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
    private static final String ICA_IMAGE_UPLOAD_SEGMENT = "https://assets.icanet.se/image/upload/";
    private static final String ICA_OPTIMIZED_IMAGE_PREFIX = "https://assets.icanet.se/cs_srgb/t_product_medium_v1/dpr_1/";

    private final RestClient siteRestClient;
    private final RestClient searchRestClient;
    private final AppProperties.IcaProperties properties;
    private final PricingMetadataService pricingMetadataService;
    private final Object authorizationLock = new Object();

    private volatile IcaUserInformation cachedUserInformation;

    IcaRetailerSearchAdapter(
            @Qualifier("icaSiteRestClient") RestClient siteRestClient,
            @Qualifier("icaSearchRestClient") RestClient searchRestClient,
            AppProperties appProperties,
            PricingMetadataService pricingMetadataService
    ) {
        this.siteRestClient = siteRestClient;
        this.searchRestClient = searchRestClient;
        this.properties = appProperties.retailer().ica();
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
            IcaUserInformation userInformation = userInformation();
            IcaQuicksearchResponse response = searchRestClient.post()
                    .uri(builder -> builder.path(properties.quicksearchPath()).build())
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + userInformation.accessToken())
                    .body(new IcaQuicksearchRequest(
                            query,
                            pageSize,
                            offset,
                            properties.accountNumber(),
                            properties.searchDomain(),
                            sessionId()
                    ))
                    .retrieve()
                    .body(IcaQuicksearchResponse.class);

            List<RetailerArticleSearchResult> results = response == null || response.products() == null || response.products().documents() == null
                    ? List.of()
                    : response.products().documents().stream()
                    .map(this::toSearchResult)
                    .toList();
            int totalResults = response == null || response.products() == null || response.products().stats() == null
                    ? results.size()
                    : response.products().stats().totalHits();
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

    private RetailerArticleSearchResult toSearchResult(IcaProduct product) {
        String title = firstNonBlank(product.title(), product.displayName());
        BigDecimal priceAmount = decimalValue(product.price());
        String category = firstNonBlank(product.mainCategoryName(), product.categoryName());
        String unit = unitFromTitle(title);

        return new RetailerArticleSearchResult(
                PROVIDER,
                firstNonBlank(product.consumerItemId(), firstNonBlank(product.gtin(), title)),
                title,
                null,
                optimizeImageUrl(product.image()),
                category,
                priceAmount,
                priceAmount == null ? null : "SEK",
                pricingMetadataService.fromRequest(
                        title,
                        null,
                        new PricingDetails(unit, null, null, PricingMetadataService.DEFAULT_QUANTITY_FACTOR)
                ),
                0
        );
    }

    private IcaUserInformation userInformation() {
        IcaUserInformation cached = cachedUserInformation;
        if (hasUsableAccessToken(cached)) {
            return cached;
        }

        synchronized (authorizationLock) {
            cached = cachedUserInformation;
            if (hasUsableAccessToken(cached)) {
                return cached;
            }

            IcaUserInformation refreshed = siteRestClient.get()
                    .uri(builder -> builder.path(properties.userInformationPath()).build())
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(IcaUserInformation.class);
            if (refreshed == null || refreshed.accessToken() == null || refreshed.accessToken().isBlank()) {
                throw new RestClientException("ICA user information did not include an access token.");
            }
            cachedUserInformation = refreshed;
            return refreshed;
        }
    }

    private boolean hasUsableAccessToken(IcaUserInformation userInformation) {
        if (userInformation == null || userInformation.accessToken() == null || userInformation.accessToken().isBlank()) {
            return false;
        }
        try {
            return OffsetDateTime.parse(userInformation.tokenExpires()).toInstant().isAfter(Instant.now().plusSeconds(1));
        } catch (Exception ignored) {
            return false;
        }
    }

    private String unitFromTitle(String title) {
        if (title == null || title.isBlank()) {
            return null;
        }
        Matcher matcher = UNIT_PATTERN.matcher(title);
        if (!matcher.find()) {
            return null;
        }
        return matcher.group(1).toLowerCase();
    }

    private BigDecimal decimalValue(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(value.replace(',', '.'));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String sessionId() {
        StringBuilder builder = new StringBuilder()
                .append(System.currentTimeMillis())
                .append('-');
        ThreadLocalRandom random = ThreadLocalRandom.current();
        for (int index = 0; index < 7; index += 1) {
            builder.append(SESSION_ID_CHARS.charAt(random.nextInt(SESSION_ID_CHARS.length())));
        }
        return builder.toString();
    }

    private String optimizeImageUrl(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return null;
        }
        if (!imageUrl.startsWith(ICA_IMAGE_UPLOAD_SEGMENT)) {
            return imageUrl;
        }

        String path = imageUrl.substring(ICA_IMAGE_UPLOAD_SEGMENT.length());
        int extensionIndex = path.lastIndexOf('.');
        if (extensionIndex >= 0) {
            path = path.substring(0, extensionIndex);
        }
        return ICA_OPTIMIZED_IMAGE_PREFIX + path;
    }

    private String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        return fallback;
    }

    record IcaQuicksearchRequest(
            String queryString,
            int take,
            int offset,
            String accountNumber,
            String searchDomain,
            String sessionId
    ) {
    }

    record IcaQuicksearchResponse(IcaProducts products) {
    }

    record IcaProducts(List<IcaProduct> documents, IcaStats stats) {
    }

    record IcaStats(int totalHits) {
    }

    record IcaProduct(
            String id,
            String accountNumber,
            String consumerItemId,
            String gtin,
            String displayName,
            String price,
            String image,
            String title,
            String categoryName,
            String mainCategoryName,
            String meanWeight,
            String countryOfOriginName,
            String ageLimitid
    ) {
    }

    record IcaUserInformation(
            Integer loginState,
            String accessToken,
            String tokenExpires
    ) {
    }
}
