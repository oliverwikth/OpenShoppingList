package se.openshoppinglist.settings.application;

import java.time.Clock;
import java.util.Comparator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.openshoppinglist.common.pricing.PricingMetadataService;
import se.openshoppinglist.lists.domain.ExternalArticleSnapshot;
import se.openshoppinglist.lists.domain.ShoppingList;
import se.openshoppinglist.lists.domain.ShoppingListItem;
import se.openshoppinglist.lists.domain.ShoppingListProvider;
import se.openshoppinglist.lists.domain.ShoppingListRepository;

@Service
public class SettingsBackupService {

    static final String BACKUP_FORMAT = "open-shopping-list-backup";
    static final int BACKUP_VERSION = 1;

    private final ShoppingListRepository shoppingListRepository;
    private final PricingMetadataService pricingMetadataService;
    private final Clock clock;

    public SettingsBackupService(
            ShoppingListRepository shoppingListRepository,
            PricingMetadataService pricingMetadataService,
            Clock clock
    ) {
        this.shoppingListRepository = shoppingListRepository;
        this.pricingMetadataService = pricingMetadataService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public SettingsBackupViews.SettingsBackupView exportBackup() {
        return new SettingsBackupViews.SettingsBackupView(
                BACKUP_FORMAT,
                BACKUP_VERSION,
                clock.instant(),
                shoppingListRepository.findAll().stream()
                        .sorted(Comparator.comparing(ShoppingList::getCreatedAt).thenComparing(ShoppingList::getId))
                        .map(this::toBackupList)
                        .toList()
        );
    }

    @Transactional
    public SettingsBackupViews.SettingsBackupImportResultView importBackup(SettingsBackupViews.SettingsBackupView backup) {
        validateBackup(backup);

        if (shoppingListRepository.count() > 0) {
            throw new IllegalArgumentException("Backup import requires an empty app. Remove existing lists before importing.");
        }

        int importedItems = 0;
        for (SettingsBackupViews.BackupListView listView : backup.lists()) {
            ShoppingList restoredList = ShoppingList.restore(
                    listView.id(),
                    listView.name(),
                    listView.provider() == null ? ShoppingListProvider.WILLYS : ShoppingListProvider.fromId(listView.provider()),
                    listView.status(),
                    listView.createdAt(),
                    listView.updatedAt(),
                    listView.archivedAt(),
                    listView.lastModifiedByDisplayName()
            );

            for (SettingsBackupViews.BackupItemView itemView : listView.items()) {
                restoredList.addRestoredItem(toRestoredItem(restoredList, itemView));
                importedItems += 1;
            }

            shoppingListRepository.save(restoredList);
        }

        return new SettingsBackupViews.SettingsBackupImportResultView(backup.lists().size(), importedItems);
    }

    private SettingsBackupViews.BackupListView toBackupList(ShoppingList shoppingList) {
        return new SettingsBackupViews.BackupListView(
                shoppingList.getId(),
                shoppingList.getName(),
                shoppingList.getProvider().id(),
                shoppingList.getStatus(),
                shoppingList.getCreatedAt(),
                shoppingList.getUpdatedAt(),
                shoppingList.getArchivedAt(),
                shoppingList.getLastModifiedByDisplayName(),
                shoppingList.getItems().stream()
                        .map(this::toBackupItem)
                        .toList()
        );
    }

    private SettingsBackupViews.BackupItemView toBackupItem(ShoppingListItem item) {
        ExternalArticleSnapshot snapshot = item.externalArticleSnapshot();
        return new SettingsBackupViews.BackupItemView(
                item.getId(),
                item.getItemType(),
                item.getTitle(),
                item.isChecked(),
                item.getCheckedAt(),
                item.getCheckedByDisplayName(),
                item.getClaimedAt(),
                item.getClaimedByDisplayName(),
                item.getLastModifiedByDisplayName(),
                item.getCreatedAt(),
                item.getUpdatedAt(),
                item.getPosition(),
                item.getQuantity(),
                item.getManualNote(),
                snapshot == null
                        ? null
                        : new SettingsBackupViews.BackupExternalSnapshotView(
                                snapshot.provider(),
                                snapshot.articleId(),
                                snapshot.canonicalArticleId(),
                                snapshot.ean(),
                                snapshot.sku(),
                                snapshot.subtitle(),
                                snapshot.imageUrl(),
                                snapshot.category(),
                                snapshot.priceAmount(),
                                snapshot.currency(),
                                pricingMetadataService.fromStoredMetadata(item.getTitle(), snapshot.subtitle(), snapshot.rawPayloadJson())
                        )
        );
    }

    private ShoppingListItem toRestoredItem(ShoppingList shoppingList, SettingsBackupViews.BackupItemView itemView) {
        if (itemView.itemType() == se.openshoppinglist.lists.domain.ShoppingListItemType.MANUAL) {
            return ShoppingListItem.restoreManual(
                    shoppingList,
                    itemView.id(),
                    itemView.title(),
                    itemView.checked(),
                    itemView.checkedAt(),
                    itemView.checkedByDisplayName(),
                    itemView.claimedAt(),
                    itemView.claimedByDisplayName(),
                    itemView.lastModifiedByDisplayName(),
                    itemView.createdAt(),
                    itemView.updatedAt(),
                    itemView.position(),
                    itemView.quantity(),
                    itemView.manualNote()
            );
        }

        SettingsBackupViews.BackupExternalSnapshotView snapshotView = itemView.externalSnapshot();
        if (snapshotView == null) {
            throw new IllegalArgumentException("External article items must include an external snapshot.");
        }

        ExternalArticleSnapshot snapshot = new ExternalArticleSnapshot(
                snapshotView.provider(),
                snapshotView.articleId(),
                snapshotView.canonicalArticleId(),
                snapshotView.ean(),
                snapshotView.sku(),
                itemView.title(),
                snapshotView.subtitle(),
                snapshotView.imageUrl(),
                snapshotView.category(),
                snapshotView.priceAmount(),
                snapshotView.currency(),
                pricingMetadataService.toMetadataJson(
                        pricingMetadataService.fromRequest(itemView.title(), snapshotView.subtitle(), snapshotView.pricing())
                )
        );
        return ShoppingListItem.restoreExternal(
                shoppingList,
                itemView.id(),
                snapshot,
                itemView.checked(),
                itemView.checkedAt(),
                itemView.checkedByDisplayName(),
                itemView.claimedAt(),
                itemView.claimedByDisplayName(),
                itemView.lastModifiedByDisplayName(),
                itemView.createdAt(),
                itemView.updatedAt(),
                itemView.position(),
                itemView.quantity()
        );
    }

    private void validateBackup(SettingsBackupViews.SettingsBackupView backup) {
        if (backup == null) {
            throw new IllegalArgumentException("Backup body must not be empty.");
        }
        if (!BACKUP_FORMAT.equals(backup.format())) {
            throw new IllegalArgumentException("Unsupported backup format: " + backup.format());
        }
        if (backup.version() != BACKUP_VERSION) {
            throw new IllegalArgumentException("Unsupported backup version: " + backup.version());
        }
        if (backup.lists() == null) {
            throw new IllegalArgumentException("Backup must include a lists array.");
        }
    }
}
