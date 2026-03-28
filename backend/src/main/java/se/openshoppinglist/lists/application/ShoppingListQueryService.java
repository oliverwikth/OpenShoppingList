package se.openshoppinglist.lists.application;

import jakarta.persistence.EntityNotFoundException;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.openshoppinglist.lists.domain.ShoppingList;
import se.openshoppinglist.lists.domain.ShoppingListItem;
import se.openshoppinglist.lists.domain.ShoppingListRepository;
import se.openshoppinglist.lists.infrastructure.ItemActivityLogEntry;
import se.openshoppinglist.lists.infrastructure.ItemActivityLogRepository;

import static se.openshoppinglist.lists.application.ShoppingListViews.ActivityView;
import static se.openshoppinglist.lists.application.ShoppingListViews.ExternalSnapshotView;
import static se.openshoppinglist.lists.application.ShoppingListViews.ShoppingListDetailView;
import static se.openshoppinglist.lists.application.ShoppingListViews.ShoppingListItemView;
import static se.openshoppinglist.lists.application.ShoppingListViews.ShoppingListOverviewPageView;
import static se.openshoppinglist.lists.application.ShoppingListViews.ShoppingListOverviewView;

@Service
public class ShoppingListQueryService {

    private final ShoppingListRepository shoppingListRepository;
    private final ItemActivityLogRepository itemActivityLogRepository;

    public ShoppingListQueryService(
            ShoppingListRepository shoppingListRepository,
            ItemActivityLogRepository itemActivityLogRepository
    ) {
        this.shoppingListRepository = shoppingListRepository;
        this.itemActivityLogRepository = itemActivityLogRepository;
    }

    @Transactional(readOnly = true)
    public List<ShoppingListOverviewView> findAllLists() {
        return shoppingListRepository.findAll().stream()
                .sorted(Comparator.comparing(ShoppingList::getUpdatedAt).reversed())
                .map(this::toOverviewView)
                .toList();
    }

    @Transactional(readOnly = true)
    public ShoppingListOverviewPageView findListsPage(Integer requestedPage, Integer requestedPageSize) {
        long totalItems = shoppingListRepository.count();
        int safePageSize = resolvePageSize(requestedPageSize, totalItems);
        int totalPages = Math.max(1, (int) Math.ceil(totalItems / (double) safePageSize));
        int page = requestedPage == null ? 1 : Math.max(1, Math.min(requestedPage, totalPages));

        List<ShoppingListOverviewView> items = shoppingListRepository.findPage(page - 1, safePageSize).stream()
                .map(this::toOverviewView)
                .toList();

        return new ShoppingListOverviewPageView(
                items,
                page,
                safePageSize,
                totalItems,
                totalPages,
                page > 1,
                page < totalPages
        );
    }

    @Transactional(readOnly = true)
    public ShoppingListDetailView getList(UUID listId) {
        ShoppingList shoppingList = shoppingListRepository.findById(listId)
                .orElseThrow(() -> new EntityNotFoundException("Shopping list not found: " + listId));
        List<ActivityView> activities = itemActivityLogRepository.findTop20ByListIdOrderByOccurredAtDesc(listId).stream()
                .map(this::toActivityView)
                .toList();
        return new ShoppingListDetailView(
                shoppingList.getId(),
                shoppingList.getName(),
                shoppingList.getStatus(),
                shoppingList.getCreatedAt(),
                shoppingList.getUpdatedAt(),
                shoppingList.getLastModifiedByDisplayName(),
                shoppingList.getItems().stream().map(this::toItemView).toList(),
                activities
        );
    }

    public ShoppingListOverviewView toOverviewView(ShoppingList shoppingList) {
        int itemCount = shoppingList.getItems().stream().mapToInt(ShoppingListItem::getQuantity).sum();
        int checkedCount = shoppingList.getItems().stream()
                .filter(ShoppingListItem::isChecked)
                .mapToInt(ShoppingListItem::getQuantity)
                .sum();
        return new ShoppingListOverviewView(
                shoppingList.getId(),
                shoppingList.getName(),
                shoppingList.getStatus(),
                itemCount,
                checkedCount,
                shoppingList.getUpdatedAt(),
                shoppingList.getLastModifiedByDisplayName()
        );
    }

    public ShoppingListItemView toItemView(ShoppingListItem item) {
        ExternalSnapshotView externalSnapshot = item.externalArticleSnapshot() == null
                ? null
                : new ExternalSnapshotView(
                        item.getSourceProvider(),
                        item.getSourceArticleId(),
                        item.getSourceSubtitle(),
                        item.getSourceImageUrl(),
                        item.getSourceCategory(),
                        item.getSourcePriceAmount(),
                        item.getSourceCurrency()
                );
        return new ShoppingListItemView(
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
                externalSnapshot
        );
    }

    private ActivityView toActivityView(ItemActivityLogEntry activityLogEntry) {
        return new ActivityView(
                activityLogEntry.getId(),
                activityLogEntry.getItemId(),
                activityLogEntry.getEventType(),
                activityLogEntry.getActorDisplayName(),
                activityLogEntry.getOccurredAt()
        );
    }

    private int resolvePageSize(Integer requestedPageSize, long totalItems) {
        if (requestedPageSize == null) {
            return Math.max(1, (int) totalItems);
        }

        if (requestedPageSize <= 0) {
            throw new IllegalArgumentException("List page size must be greater than zero.");
        }

        return requestedPageSize;
    }
}
