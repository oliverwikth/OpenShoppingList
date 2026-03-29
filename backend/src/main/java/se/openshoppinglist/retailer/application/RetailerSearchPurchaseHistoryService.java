package se.openshoppinglist.retailer.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.openshoppinglist.lists.application.CheckedItemActivityPayload;
import se.openshoppinglist.lists.domain.ShoppingListRepository;
import se.openshoppinglist.lists.infrastructure.ItemActivityLogEntry;
import se.openshoppinglist.lists.infrastructure.ItemActivityLogRepository;

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
        Map<String, Integer> articleCounts = new HashMap<>();
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
            mergeSignals(articleCounts, titleCounts, payload.provider(), payload.articleId(), payload.title(), payload.quantity());
        }

        shoppingListRepository.findAll().stream()
                .flatMap(list -> list.getItems().stream())
                .filter(item -> item.isChecked() && !itemIdsWithDetailedHistory.contains(item.getId()))
                .forEach(item -> mergeSignals(
                        articleCounts,
                        titleCounts,
                        item.getSourceProvider(),
                        item.getSourceArticleId(),
                        item.getTitle(),
                        item.getQuantity()
                ));

        return new PurchaseSignals(Map.copyOf(articleCounts), Map.copyOf(titleCounts));
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
            Map<String, Integer> articleCounts,
            Map<String, Integer> titleCounts,
            String provider,
            String articleId,
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

        String articleKey = articleKey(provider, articleId);
        if (!articleKey.isBlank()) {
            articleCounts.merge(articleKey, quantity, Integer::sum);
        }
    }

    private static String normalizeTitle(String title) {
        return title == null ? "" : title.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static String articleKey(String provider, String articleId) {
        if (provider == null || provider.isBlank() || articleId == null || articleId.isBlank()) {
            return "";
        }
        return provider.trim() + ":" + articleId.trim();
    }

    public record PurchaseSignals(
            Map<String, Integer> articleCounts,
            Map<String, Integer> titleCounts
    ) {
        public int articleCountFor(String provider, String articleId) {
            return articleCounts.getOrDefault(articleKey(provider, articleId), 0);
        }

        public int titleCountFor(String title) {
            return titleCounts.getOrDefault(normalizeTitle(title), 0);
        }
    }
}
