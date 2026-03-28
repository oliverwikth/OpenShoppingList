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
            String lastModifiedByDisplayName
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
            BigDecimal spentAmount
    ) {
    }

    public record ExternalSnapshotView(
            String provider,
            String articleId,
            String subtitle,
            String imageUrl,
            String category,
            BigDecimal priceAmount,
            String currency
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
}
