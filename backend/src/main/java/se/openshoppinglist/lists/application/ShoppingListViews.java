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
