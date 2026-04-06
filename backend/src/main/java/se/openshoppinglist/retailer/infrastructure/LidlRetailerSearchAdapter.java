package se.openshoppinglist.retailer.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.net.http.HttpTimeoutException;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import se.openshoppinglist.common.pricing.PricingMetadataService;
import se.openshoppinglist.config.AppProperties;
import se.openshoppinglist.retailer.application.RetailerSearchPort;
import se.openshoppinglist.retailer.domain.RetailerArticleSearchResult;
import se.openshoppinglist.retailer.domain.RetailerSearchResponse;

@Component
class LidlRetailerSearchAdapter implements RetailerSearchPort {
    private final AppProperties.LidlProperties properties;
    private final PricingMetadataService pricingMetadataService;
    private final ObjectMapper objectMapper;

    LidlRetailerSearchAdapter(
            AppProperties appProperties,
            PricingMetadataService pricingMetadataService,
            ObjectMapper objectMapper
    ) {
        this.properties = appProperties.retailer().lidl();
        this.pricingMetadataService = pricingMetadataService;
        this.objectMapper = objectMapper;
    }

    @Override
    public String provider() {
        return "lidl";
    }

    @Override
    public RetailerSearchResponse search(String query, int page) {
        int offset = Math.max(0, page) * properties.maxResults();

        try {
            CommandResponse response = executeSearch(query, offset);
            if (response.statusCode() >= 400) {
                return unavailableResponse(query, page, response.statusCode());
            }
            LidlSearchResponse responseBody = objectMapper.readValue(response.body(), LidlSearchResponse.class);

            List<RetailerArticleSearchResult> results = responseBody == null || responseBody.items() == null
                    ? List.of()
                    : responseBody.items().stream()
                    .filter(item -> item.gridbox() != null && item.gridbox().data() != null)
                    .map(this::toSearchResult)
                    .toList();

            int totalResults = responseBody == null ? results.size() : responseBody.numFound();
            int pageSize = responseBody == null || responseBody.fetchsize() <= 0 ? properties.maxResults() : responseBody.fetchsize();
            int currentOffset = responseBody == null ? offset : responseBody.offset();
            int currentPage = pageSize <= 0 ? page : currentOffset / pageSize;
            int totalPages = totalResults <= 0 ? 0 : (int) Math.ceil(totalResults / (double) pageSize);
            boolean hasMoreResults = currentPage + 1 < totalPages;

            return new RetailerSearchResponse("lidl", query, currentPage, totalPages, totalResults, hasMoreResults, true, null, results);
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return unavailableResponse(query, page, exception);
        }
    }

    private CommandResponse executeSearch(String query, int offset) throws IOException, InterruptedException {
        Path stdoutFile = Files.createTempFile("lidl-search-", ".json");
        Path stderrFile = Files.createTempFile("lidl-search-", ".stderr");
        try {
            Process process = new ProcessBuilder(buildWgetCommand(query, offset))
                    .redirectOutput(stdoutFile.toFile())
                    .redirectError(stderrFile.toFile())
                    .start();
            long timeoutMillis = properties.connectTimeout().plus(properties.readTimeout()).plusSeconds(1).toMillis();
            if (!process.waitFor(timeoutMillis, TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                throw new HttpTimeoutException("Lidl search command timed out.");
            }

            String stdout = Files.readString(stdoutFile, StandardCharsets.UTF_8);
            String stderr = Files.readString(stderrFile, StandardCharsets.UTF_8);
            int exitCode = process.exitValue();
            if (exitCode != 0) {
                throw wgetFailure(exitCode, stderr);
            }
            return new CommandResponse(200, stdout);
        } finally {
            Files.deleteIfExists(stdoutFile);
            Files.deleteIfExists(stderrFile);
        }
    }

    private List<String> buildWgetCommand(String query, int offset) {
        long connectTimeoutSeconds = Math.max(1L, properties.connectTimeout().toSeconds());
        long totalTimeoutSeconds = Math.max(1L, properties.connectTimeout().plus(properties.readTimeout()).toSeconds());
        return List.of(
                "wget",
                "-q",
                "-O", "-",
                "--timeout=" + totalTimeoutSeconds,
                "--connect-timeout=" + connectTimeoutSeconds,
                buildSearchUri(query, offset).toString()
        );
    }

    private IOException wgetFailure(int exitCode, String stderr) {
        String detail = stderr == null || stderr.isBlank()
                ? "wget exited with code " + exitCode + "."
                : stderr.trim();
        return switch (exitCode) {
            case 4 -> new IOException(detail);
            case 5 -> new UnknownHostException(detail);
            case 7 -> new IOException(detail);
            case 8 -> new IOException(detail);
            case 124 -> new HttpTimeoutException(detail);
            default -> new IOException(detail);
        };
    }

    private URI buildSearchUri(String query, int offset) {
        String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
        return URI.create(properties.baseUrl()
                + properties.searchPath()
                + "?q=" + encodedQuery
                + "&locale=" + properties.locale()
                + "&assortment=" + properties.assortment()
                + "&version=" + properties.version()
                + "&offset=" + offset
                + "&fetchsize=" + properties.maxResults());
    }

    private RetailerSearchResponse unavailableResponse(String query, int page, int statusCode) {
        return new RetailerSearchResponse(
                "lidl",
                query,
                page,
                0,
                0,
                false,
                false,
                failureMessageForStatus(HttpStatusCode.valueOf(statusCode)),
                List.of()
        );
    }

    private RetailerSearchResponse unavailableResponse(String query, int page, Exception exception) {
        return new RetailerSearchResponse(
                "lidl",
                query,
                page,
                0,
                0,
                false,
                false,
                failureMessage(exception),
                List.of()
        );
    }

    static String failureMessage(Exception exception) {
        Throwable cause = NestedExceptionUtils.getMostSpecificCause(exception);
        if (cause instanceof HttpTimeoutException || cause instanceof SocketTimeoutException) {
            return "Lidl search timed out while waiting for a response.";
        }
        if (cause instanceof ConnectException || cause instanceof UnknownHostException) {
            return "Lidl search failed before a response was received. Could not connect to Lidl.";
        }

        return "Lidl search failed before a response was received. Cause: unknown upstream error.";
    }

    private static String failureMessageForStatus(HttpStatusCode statusCode) {
        int value = statusCode.value();
        if (value == 429) {
            return "Lidl search was rate limited by Lidl (HTTP 429).";
        }
        if (value == HttpURLConnection.HTTP_FORBIDDEN || value == HttpURLConnection.HTTP_UNAUTHORIZED) {
            return "Lidl blocked the search request (HTTP " + value + ").";
        }
        if (value == HttpURLConnection.HTTP_CLIENT_TIMEOUT || value == HttpURLConnection.HTTP_GATEWAY_TIMEOUT) {
            return "Lidl search timed out upstream (HTTP " + value + ").";
        }
        if (statusCode.is5xxServerError()) {
            return "Lidl search failed at Lidl with a server error (HTTP " + value + ").";
        }
        return "Lidl search failed at Lidl (HTTP " + value + ").";
    }

    private RetailerArticleSearchResult toSearchResult(LidlSearchItem item) {
        LidlGridboxData product = item.gridbox().data();
        LidlPrice price = product.price();
        String category = product.keyfacts() == null ? null : topLevelCategory(product.keyfacts().wonCategoryPrimary());
        String subtitle = price == null || price.packaging() == null ? product.fullTitle() : price.packaging().text();
        String comparisonPriceText = price == null || price.basePrice() == null ? null : price.basePrice().text();

        return new RetailerArticleSearchResult(
                "lidl",
                item.code(),
                firstNonBlank(product.title(), product.fullTitle()),
                subtitle,
                product.image(),
                category,
                price == null ? null : price.price(),
                price == null || price.currencyCode() == null ? null : price.currencyCode(),
                pricingMetadataService.fromWillysProduct(
                        firstNonBlank(product.title(), product.fullTitle()),
                        subtitle,
                        price == null ? null : price.price() == null ? null : price.price().toPlainString(),
                        price == null || price.packaging() == null ? null : price.packaging().text(),
                        comparisonPriceText,
                        null
                ),
                0
        );
    }

    private String topLevelCategory(String categoryPath) {
        if (categoryPath == null || categoryPath.isBlank()) {
            return null;
        }

        String[] parts = categoryPath.split("/");
        for (int index = parts.length - 1; index >= 0; index -= 1) {
            String value = parts[index].trim();
            if (!value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String firstNonBlank(String primary, String fallback) {
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        return fallback;
    }

    record LidlSearchResponse(
            int numFound,
            int offset,
            int fetchsize,
            List<LidlSearchItem> items
    ) {
    }

    record LidlSearchItem(
            String code,
            LidlGridbox gridbox
    ) {
    }

    record LidlGridbox(LidlGridboxData data) {
    }

    record LidlGridboxData(
            String title,
            String fullTitle,
            String image,
            LidlPrice price,
            LidlKeyfacts keyfacts
    ) {
    }

    record LidlPrice(
            BigDecimal price,
            String currencyCode,
            LidlBasePrice basePrice,
            LidlPackaging packaging
    ) {
    }

    record LidlBasePrice(String text) {
    }

    record LidlPackaging(String text) {
    }

    record LidlKeyfacts(String wonCategoryPrimary) {
    }

    record CommandResponse(int statusCode, String body) {
    }
}
