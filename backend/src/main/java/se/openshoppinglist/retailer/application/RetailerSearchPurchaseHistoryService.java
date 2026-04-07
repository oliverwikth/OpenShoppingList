package se.openshoppinglist.retailer.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.openshoppinglist.common.catalog.ArticleTextSignals;
import se.openshoppinglist.lists.application.CheckedItemActivityPayload;
import se.openshoppinglist.lists.domain.ShoppingListRepository;
import se.openshoppinglist.lists.infrastructure.ItemActivityLogEntry;
import se.openshoppinglist.lists.infrastructure.ItemActivityLogRepository;
import se.openshoppinglist.retailer.domain.RetailerArticleIdentity;

@Service
public class RetailerSearchPurchaseHistoryService {

    private static final String CHECKED_EVENT_TYPE = "shopping-list-item.checked";

    private final ItemActivityLogRepository itemActivityLogRepository;
    private final ShoppingListRepository shoppingListRepository;
    private final ObjectMapper objectMapper;

    public RetailerSearchPurchaseHistoryService(
            ItemActivityLogRepository itemActivityLogRepository,
            ShoppingListRepository shoppingListRepository,
            ObjectMapper objectMapper
    ) {
        this.itemActivityLogRepository = itemActivityLogRepository;
        this.shoppingListRepository = shoppingListRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public PurchaseSignals purchaseSignals() {
        Map<String, Integer> identityCounts = new HashMap<>();
        Map<String, Integer> keywordCounts = new HashMap<>();
        Map<String, Integer> titleCounts = new HashMap<>();
        Set<UUID> itemIdsWithDetailedHistory = new HashSet<>();

        for (ItemActivityLogEntry entry : itemActivityLogRepository.findAllByEventTypeOrderByOccurredAtAsc(CHECKED_EVENT_TYPE)) {
            CheckedItemActivityPayload payload = parsePayload(entry.getPayloadJson());
            if (payload == null || !payload.hasPurchaseMetadata()) {
                continue;
            }

            if (entry.getItemId() != null) {
                itemIdsWithDetailedHistory.add(entry.getItemId());
            }
            mergeSignals(
                    identityCounts,
                    keywordCounts,
                    titleCounts,
                    payload.provider(),
                    payload.articleId(),
                    payload.canonicalArticleId(),
                    payload.ean(),
                    payload.sku(),
                    payload.title(),
                    payload.quantity()
            );
        }

        shoppingListRepository.findAll().stream()
                .flatMap(list -> list.getItems().stream())
                .filter(item -> item.isChecked() && !itemIdsWithDetailedHistory.contains(item.getId()))
                .forEach(item -> mergeSignals(
                        identityCounts,
                        keywordCounts,
                        titleCounts,
                        item.getSourceProvider(),
                        item.getSourceArticleId(),
                        item.getSourceCanonicalArticleId(),
                        item.getSourceEan(),
                        item.getSourceSku(),
                        item.getTitle(),
                        item.getQuantity()
                ));

        return new PurchaseSignals(Map.copyOf(identityCounts), Map.copyOf(keywordCounts), Map.copyOf(titleCounts));
    }

    private CheckedItemActivityPayload parsePayload(String payloadJson) {
        if (payloadJson == null || payloadJson.isBlank()) {
            return null;
        }

        try {
            return objectMapper.readValue(payloadJson, CheckedItemActivityPayload.class);
        } catch (JsonProcessingException exception) {
            return null;
        }
    }

    private void mergeSignals(
            Map<String, Integer> identityCounts,
            Map<String, Integer> keywordCounts,
            Map<String, Integer> titleCounts,
            String provider,
            String articleId,
            String canonicalArticleId,
            String ean,
            String sku,
            String title,
            Integer quantity
    ) {
        if (quantity == null || quantity <= 0) {
            return;
        }

        String normalizedTitle = normalizeTitle(title);
        if (!normalizedTitle.isBlank()) {
            titleCounts.merge(normalizedTitle, quantity, Integer::sum);
        }
        mergeKeywordSignals(keywordCounts, title, quantity);

        Set<String> identityKeys = RetailerArticleIdentity.identityKeys(provider, articleId, canonicalArticleId, ean, sku);
        for (String identityKey : identityKeys) {
            if (!identityKey.isBlank()) {
                identityCounts.merge(identityKey, quantity, Integer::sum);
            }
        }
    }

    private void mergeKeywordSignals(Map<String, Integer> keywordCounts, String title, Integer quantity) {
        for (String token : ArticleTextSignals.significantTokens(title)) {
            keywordCounts.merge(token, quantity, Integer::sum);
        }
    }

    private static String normalizeTitle(String title) {
        return title == null ? "" : title.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    public record PurchaseSignals(
            Map<String, Integer> identityCounts,
            Map<String, Integer> keywordCounts,
            Map<String, Integer> titleCounts
    ) {
        public int articleCountFor(String provider, String articleId, String canonicalArticleId, String ean, String sku) {
            return RetailerArticleIdentity.identityKeys(provider, articleId, canonicalArticleId, ean, sku).stream()
                    .mapToInt(key -> identityCounts.getOrDefault(key, 0))
                    .max()
                    .orElse(0);
        }

        public int keywordCountFor(String title) {
            List<String> tokens = ArticleTextSignals.significantTokens(title);
            if (tokens.isEmpty()) {
                return 0;
            }
            return tokens.stream()
                    .mapToInt(token -> keywordCounts.getOrDefault(token, 0))
                    .max()
                    .orElse(0);
        }

        public int keywordMatchTokenCountFor(String title) {
            List<String> tokens = ArticleTextSignals.significantTokens(title);
            if (tokens.isEmpty()) {
                return 0;
            }
            return (int) tokens.stream()
                    .filter(token -> keywordCounts.getOrDefault(token, 0) > 0)
                    .count();
        }

        public int titleCountFor(String title) {
            return titleCounts.getOrDefault(normalizeTitle(title), 0);
        }
    }
}
