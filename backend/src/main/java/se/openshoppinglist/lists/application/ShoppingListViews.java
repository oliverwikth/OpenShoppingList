package se.openshoppinglist.lists.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import se.openshoppinglist.lists.domain.ShoppingListItemType;
import se.openshoppinglist.lists.domain.ShoppingListStatus;

public final class ShoppingListViews {

    private ShoppingListViews() {
    }

    public record ShoppingListOverviewView(
            UUID id,
            String name,
            ShoppingListStatus status,
            int itemCount,
            int checkedItemCount,
            Instant updatedAt,
            Instant archivedAt,
            String lastModifiedByDisplayName
    ) {
    }

    public record ShoppingListOverviewPageView(
            List<ShoppingListOverviewView> items,
            int page,
            int pageSize,
            long totalItems,
            int totalPages,
            boolean hasPreviousPage,
            boolean hasNextPage
    ) {
    }

    public record ShoppingListDetailView(
            UUID id,
            String name,
            ShoppingListStatus status,
            Instant createdAt,
            Instant updatedAt,
            String lastModifiedByDisplayName,
            List<ShoppingListItemView> items,
            List<ActivityView> recentActivities
    ) {
    }

    public record ShoppingListItemView(
            UUID id,
            ShoppingListItemType itemType,
            String title,
            boolean checked,
            Instant checkedAt,
            String checkedByDisplayName,
            Instant claimedAt,
            String claimedByDisplayName,
            String lastModifiedByDisplayName,
            Instant createdAt,
            Instant updatedAt,
            int position,
            int quantity,
            String manualNote,
            ExternalSnapshotView externalSnapshot
    ) {
    }

    public record ItemQuantityChangeView(
            UUID itemId,
            boolean removed,
            ShoppingListItemView item
    ) {
    }

    public record ShoppingStatsView(
            String range,
            Instant rangeStart,
            Instant rangeEnd,
            String currentPeriodLabel,
            String previousPeriodLabel,
            BigDecimal spentAmount,
            BigDecimal previousSpentAmount,
            String currency,
            Integer purchasedQuantity,
            Integer previousPurchasedQuantity,
            Integer activeListCount,
            Integer previousActiveListCount,
            BigDecimal averagePricedItemAmount,
            BigDecimal previousAveragePricedItemAmount,
            List<ShoppingStatsPointView> spendSeries,
            List<TopPurchasedItemView> topItems
    ) {
    }

    public record ShoppingStatsPointView(
            String label,
            Instant bucketStart,
            BigDecimal amount,
            BigDecimal cumulativeAmount,
            int quantity
    ) {
    }

    public record TopPurchasedItemView(
            String title,
            Integer quantity,
            BigDecimal spentAmount,
            String imageUrl
    ) {
    }

    public record ExternalSnapshotView(
            String provider,
            String articleId,
            String subtitle,
            String imageUrl,
            String category,
            BigDecimal priceAmount,
            String currency,
            String rawPayloadJson
    ) {
    }

    public record ActivityView(
            UUID id,
            UUID itemId,
            String eventType,
            String actorDisplayName,
            Instant occurredAt
    ) {
    }

    public record SettingsSnapshotView(
            List<ShoppingListOverviewView> archivedLists,
            SettingsActivityPageView recentActivities,
            AppErrorLogPageView errorLogs
    ) {
    }

    public record SettingsActivityView(
            UUID id,
            UUID listId,
            String listName,
            UUID itemId,
            String eventType,
            String actorDisplayName,
            Instant occurredAt
    ) {
    }

    public record AppErrorLogView(
            UUID id,
            String level,
            String source,
            String code,
            String message,
            String path,
            String httpMethod,
            String actorDisplayName,
            String detailsJson,
            Instant occurredAt
    ) {
    }

    public record SettingsActivityPageView(
            List<SettingsActivityView> items,
            int page,
            int pageSize,
            long totalItems,
            boolean hasNextPage
    ) {
    }

    public record AppErrorLogPageView(
            List<AppErrorLogView> items,
            int page,
            int pageSize,
            long totalItems,
            boolean hasNextPage
    ) {
    }
}
