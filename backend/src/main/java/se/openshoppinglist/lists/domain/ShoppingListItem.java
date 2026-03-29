package se.openshoppinglist.lists.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import se.openshoppinglist.actor.ActorDisplayName;

@Entity
@Table(name = "shopping_list_item")
public class ShoppingListItem {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "list_id", nullable = false)
    private ShoppingList shoppingList;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 20)
    private ShoppingListItemType itemType;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private boolean checked;

    @Column(name = "checked_at")
    private Instant checkedAt;

    @Column(name = "checked_by_display_name", length = 60)
    private String checkedByDisplayName;

    @Column(name = "claimed_at")
    private Instant claimedAt;

    @Column(name = "claimed_by_display_name", length = 60)
    private String claimedByDisplayName;

    @Column(name = "last_modified_by_display_name", nullable = false, length = 60)
    private String lastModifiedByDisplayName;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "manual_note")
    private String manualNote;

    @Column(name = "source_provider", length = 40)
    private String sourceProvider;

    @Column(name = "source_article_id", length = 120)
    private String sourceArticleId;

    @Column(name = "source_image_url")
    private String sourceImageUrl;

    @Column(name = "source_category", length = 120)
    private String sourceCategory;

    @Column(name = "source_price_amount", precision = 10, scale = 2)
    private BigDecimal sourcePriceAmount;

    @Column(name = "source_currency", length = 3)
    private String sourceCurrency;

    @Column(name = "source_subtitle")
    private String sourceSubtitle;

    @Column(name = "source_payload_json", nullable = false)
    private String sourcePayloadJson;

    protected ShoppingListItem() {
    }

    public static ShoppingListItem restoreManual(
            ShoppingList shoppingList,
            UUID id,
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
            String manualNote
    ) {
        ShoppingListItem item = new ShoppingListItem();
        item.id = id == null ? UUID.randomUUID() : id;
        item.shoppingList = shoppingList;
        item.itemType = ShoppingListItemType.MANUAL;
        item.title = normalizeTitle(title);
        item.checked = checked;
        item.checkedAt = checkedAt;
        item.checkedByDisplayName = checkedByDisplayName;
        item.claimedAt = claimedAt;
        item.claimedByDisplayName = claimedByDisplayName;
        item.lastModifiedByDisplayName = normalizeActor(lastModifiedByDisplayName);
        item.createdAt = createdAt == null ? Instant.now() : createdAt;
        item.updatedAt = updatedAt == null ? item.createdAt : updatedAt;
        item.position = position;
        item.quantity = normalizeQuantity(quantity);
        item.manualNote = manualNote == null || manualNote.isBlank() ? null : manualNote.trim();
        item.sourcePayloadJson = "{}";
        return item;
    }

    public static ShoppingListItem restoreExternal(
            ShoppingList shoppingList,
            UUID id,
            ExternalArticleSnapshot snapshot,
            boolean checked,
            Instant checkedAt,
            String checkedByDisplayName,
            Instant claimedAt,
            String claimedByDisplayName,
            String lastModifiedByDisplayName,
            Instant createdAt,
            Instant updatedAt,
            int position,
            int quantity
    ) {
        ShoppingListItem item = new ShoppingListItem();
        item.id = id == null ? UUID.randomUUID() : id;
        item.shoppingList = shoppingList;
        item.itemType = ShoppingListItemType.EXTERNAL_ARTICLE;
        item.title = normalizeTitle(snapshot.title());
        item.checked = checked;
        item.checkedAt = checkedAt;
        item.checkedByDisplayName = checkedByDisplayName;
        item.claimedAt = claimedAt;
        item.claimedByDisplayName = claimedByDisplayName;
        item.lastModifiedByDisplayName = normalizeActor(lastModifiedByDisplayName);
        item.createdAt = createdAt == null ? Instant.now() : createdAt;
        item.updatedAt = updatedAt == null ? item.createdAt : updatedAt;
        item.position = position;
        item.quantity = normalizeQuantity(quantity);
        item.sourceProvider = snapshot.provider();
        item.sourceArticleId = snapshot.articleId();
        item.sourceImageUrl = snapshot.imageUrl();
        item.sourceCategory = snapshot.category();
        item.sourcePriceAmount = snapshot.priceAmount();
        item.sourceCurrency = snapshot.currency();
        item.sourceSubtitle = snapshot.subtitle();
        item.sourcePayloadJson = snapshot.rawPayloadJson() == null || snapshot.rawPayloadJson().isBlank()
                ? "{}"
                : snapshot.rawPayloadJson();
        return item;
    }

    static ShoppingListItem manual(
            ShoppingList shoppingList,
            int position,
            String title,
            String note,
            ActorDisplayName actorDisplayName,
            Clock clock
    ) {
        return manual(shoppingList, position, title, note, 1, actorDisplayName, clock);
    }

    static ShoppingListItem manual(
            ShoppingList shoppingList,
            int position,
            String title,
            String note,
            int quantity,
            ActorDisplayName actorDisplayName,
            Clock clock
    ) {
        Instant now = clock.instant();
        ShoppingListItem item = new ShoppingListItem();
        item.id = UUID.randomUUID();
        item.shoppingList = shoppingList;
        item.itemType = ShoppingListItemType.MANUAL;
        item.title = normalizeTitle(title);
        item.manualNote = note == null || note.isBlank() ? null : note.trim();
        item.checked = false;
        item.lastModifiedByDisplayName = actorDisplayName.value();
        item.createdAt = now;
        item.updatedAt = now;
        item.position = position;
        item.quantity = normalizeQuantity(quantity);
        item.sourcePayloadJson = "{}";
        return item;
    }

    static ShoppingListItem external(
            ShoppingList shoppingList,
            int position,
            ExternalArticleSnapshot snapshot,
            ActorDisplayName actorDisplayName,
            Clock clock
    ) {
        return external(shoppingList, position, snapshot, 1, actorDisplayName, clock);
    }

    static ShoppingListItem external(
            ShoppingList shoppingList,
            int position,
            ExternalArticleSnapshot snapshot,
            int quantity,
            ActorDisplayName actorDisplayName,
            Clock clock
    ) {
        Instant now = clock.instant();
        ShoppingListItem item = new ShoppingListItem();
        item.id = UUID.randomUUID();
        item.shoppingList = shoppingList;
        item.itemType = ShoppingListItemType.EXTERNAL_ARTICLE;
        item.title = normalizeTitle(snapshot.title());
        item.checked = false;
        item.lastModifiedByDisplayName = actorDisplayName.value();
        item.createdAt = now;
        item.updatedAt = now;
        item.position = position;
        item.quantity = normalizeQuantity(quantity);
        item.sourceProvider = snapshot.provider();
        item.sourceArticleId = snapshot.articleId();
        item.sourceImageUrl = snapshot.imageUrl();
        item.sourceCategory = snapshot.category();
        item.sourcePriceAmount = snapshot.priceAmount();
        item.sourceCurrency = snapshot.currency();
        item.sourceSubtitle = snapshot.subtitle();
        item.sourcePayloadJson = snapshot.rawPayloadJson() == null || snapshot.rawPayloadJson().isBlank()
                ? "{}"
                : snapshot.rawPayloadJson();
        return item;
    }

    boolean check(ActorDisplayName actorDisplayName, Clock clock) {
        if (checked) {
            return false;
        }
        clearClaimState();
        checked = true;
        checkedAt = clock.instant();
        checkedByDisplayName = actorDisplayName.value();
        lastModifiedByDisplayName = actorDisplayName.value();
        updatedAt = checkedAt;
        return true;
    }

    boolean uncheck(ActorDisplayName actorDisplayName, Clock clock) {
        if (!checked) {
            return false;
        }
        checked = false;
        checkedAt = null;
        checkedByDisplayName = null;
        lastModifiedByDisplayName = actorDisplayName.value();
        updatedAt = clock.instant();
        return true;
    }

    void increaseQuantity(ActorDisplayName actorDisplayName, Clock clock) {
        increaseQuantity(actorDisplayName, clock, 1);
    }

    void increaseQuantity(ActorDisplayName actorDisplayName, Clock clock, int amount) {
        quantity += normalizeQuantity(amount);
        clearCheckState();
        lastModifiedByDisplayName = actorDisplayName.value();
        updatedAt = clock.instant();
    }

    boolean decreaseQuantity(ActorDisplayName actorDisplayName, Clock clock) {
        if (quantity <= 1) {
            quantity = 0;
            clearCheckState();
            lastModifiedByDisplayName = actorDisplayName.value();
            updatedAt = clock.instant();
            return true;
        }

        quantity -= 1;
        lastModifiedByDisplayName = actorDisplayName.value();
        updatedAt = clock.instant();
        return false;
    }

    boolean toggleClaim(ActorDisplayName actorDisplayName, Clock clock) {
        if (checked) {
            throw new IllegalStateException("Checked items cannot be claimed.");
        }

        Instant now = clock.instant();
        if (actorDisplayName.value().equals(claimedByDisplayName)) {
            clearClaimState();
            lastModifiedByDisplayName = actorDisplayName.value();
            updatedAt = now;
            return false;
        }

        claimedAt = now;
        claimedByDisplayName = actorDisplayName.value();
        lastModifiedByDisplayName = actorDisplayName.value();
        updatedAt = now;
        return true;
    }

    boolean matchesManual(String title, String note) {
        return itemType == ShoppingListItemType.MANUAL
                && this.title.equals(normalizeTitle(title))
                && normalizeNote(manualNote).equals(normalizeNote(note));
    }

    boolean matchesExternal(ExternalArticleSnapshot snapshot) {
        return itemType == ShoppingListItemType.EXTERNAL_ARTICLE
                && normalizeValue(sourceProvider).equals(normalizeValue(snapshot.provider()))
                && normalizeValue(sourceArticleId).equals(normalizeValue(snapshot.articleId()));
    }

    public ManualItemDetails manualDetails() {
        return itemType == ShoppingListItemType.MANUAL ? new ManualItemDetails(manualNote) : null;
    }

    public ExternalArticleSnapshot externalArticleSnapshot() {
        if (itemType != ShoppingListItemType.EXTERNAL_ARTICLE) {
            return null;
        }
        return new ExternalArticleSnapshot(
                sourceProvider,
                sourceArticleId,
                title,
                sourceSubtitle,
                sourceImageUrl,
                sourceCategory,
                sourcePriceAmount,
                sourceCurrency,
                sourcePayloadJson
        );
    }

    public UUID getId() {
        return id;
    }

    public ShoppingListItemType getItemType() {
        return itemType;
    }

    public String getTitle() {
        return title;
    }

    public boolean isChecked() {
        return checked;
    }

    public Instant getCheckedAt() {
        return checkedAt;
    }

    public String getCheckedByDisplayName() {
        return checkedByDisplayName;
    }

    public Instant getClaimedAt() {
        return claimedAt;
    }

    public String getClaimedByDisplayName() {
        return claimedByDisplayName;
    }

    public String getLastModifiedByDisplayName() {
        return lastModifiedByDisplayName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public int getPosition() {
        return position;
    }

    public int getQuantity() {
        return quantity;
    }

    public String getManualNote() {
        return manualNote;
    }

    public String getSourceProvider() {
        return sourceProvider;
    }

    public String getSourceArticleId() {
        return sourceArticleId;
    }

    public String getSourceImageUrl() {
        return sourceImageUrl;
    }

    public String getSourceCategory() {
        return sourceCategory;
    }

    public BigDecimal getSourcePriceAmount() {
        return sourcePriceAmount;
    }

    public String getSourceCurrency() {
        return sourceCurrency;
    }

    public String getSourceSubtitle() {
        return sourceSubtitle;
    }

    public String getSourcePayloadJson() {
        return sourcePayloadJson;
    }

    private void clearCheckState() {
        checked = false;
        checkedAt = null;
        checkedByDisplayName = null;
    }

    private void clearClaimState() {
        claimedAt = null;
        claimedByDisplayName = null;
    }

    private static String normalizeTitle(String rawTitle) {
        if (rawTitle == null || rawTitle.isBlank()) {
            throw new IllegalArgumentException("Item title must not be blank.");
        }
        String normalized = rawTitle.trim();
        if (normalized.length() > 255) {
            throw new IllegalArgumentException("Item title must be at most 255 characters.");
        }
        return normalized;
    }

    private static String normalizeNote(String rawNote) {
        return rawNote == null || rawNote.isBlank() ? "" : rawNote.trim();
    }

    private static String normalizeValue(String rawValue) {
        return rawValue == null ? "" : rawValue.trim();
    }

    private static int normalizeQuantity(int quantity) {
        if (quantity < 1) {
            throw new IllegalArgumentException("Item quantity must be at least 1.");
        }
        return quantity;
    }

    private static String normalizeActor(String actorDisplayName) {
        return actorDisplayName == null || actorDisplayName.isBlank() ? "import" : actorDisplayName.trim();
    }
}
