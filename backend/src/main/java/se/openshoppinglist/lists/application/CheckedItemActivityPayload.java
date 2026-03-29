package se.openshoppinglist.lists.application;

import se.openshoppinglist.lists.domain.ShoppingListItem;

public record CheckedItemActivityPayload(
        String eventType,
        String title,
        Integer quantity,
        String provider,
        String articleId
) {

    public static CheckedItemActivityPayload generic(String eventType) {
        return new CheckedItemActivityPayload(eventType, null, null, null, null);
    }

    public static CheckedItemActivityPayload checked(ShoppingListItem item) {
        return new CheckedItemActivityPayload(
                "shopping-list-item.checked",
                item.getTitle(),
                item.getQuantity(),
                item.getSourceProvider(),
                item.getSourceArticleId()
        );
    }

    public boolean hasPurchaseMetadata() {
        return title != null && !title.isBlank() && quantity != null && quantity > 0;
    }
}
