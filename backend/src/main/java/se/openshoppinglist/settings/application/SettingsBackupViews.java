package se.openshoppinglist.settings.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import se.openshoppinglist.common.pricing.PricingDetails;
import se.openshoppinglist.lists.domain.ShoppingListItemType;
import se.openshoppinglist.lists.domain.ShoppingListStatus;

public final class SettingsBackupViews {

    private SettingsBackupViews() {
    }

    public record SettingsBackupView(
            String format,
            int version,
            Instant exportedAt,
            List<BackupListView> lists
    ) {
    }

    public record BackupListView(
            UUID id,
            String name,
            String provider,
            ShoppingListStatus status,
            Instant createdAt,
            Instant updatedAt,
            Instant archivedAt,
            String lastModifiedByDisplayName,
            List<BackupItemView> items
    ) {
    }

    public record BackupItemView(
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
            BackupExternalSnapshotView externalSnapshot
    ) {
    }

    public record BackupExternalSnapshotView(
            String provider,
            String articleId,
            String canonicalArticleId,
            String ean,
            String sku,
            String subtitle,
            String imageUrl,
            String category,
            java.math.BigDecimal priceAmount,
            String currency,
            PricingDetails pricing
    ) {
    }

    public record SettingsBackupImportResultView(
            int importedLists,
            int importedItems
    ) {
    }
}
