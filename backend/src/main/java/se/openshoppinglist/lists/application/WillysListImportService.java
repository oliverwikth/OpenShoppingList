package se.openshoppinglist.lists.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.openshoppinglist.actor.ActorDisplayName;
import se.openshoppinglist.common.events.DomainEventPublisher;
import se.openshoppinglist.common.pricing.PricingMetadataService;
import se.openshoppinglist.lists.domain.ExternalArticleSnapshot;
import se.openshoppinglist.lists.domain.ShoppingList;
import se.openshoppinglist.lists.domain.ShoppingListItem;
import se.openshoppinglist.lists.domain.ShoppingListProvider;
import se.openshoppinglist.lists.domain.ShoppingListRepository;

@Service
public class WillysListImportService {

    private static final String DEFAULT_LIST_NAME = "Importerad Willys-list";

    private final ShoppingListRepository shoppingListRepository;
    private final DomainEventPublisher domainEventPublisher;
    private final Clock clock;
    private final PricingMetadataService pricingMetadataService;

    public WillysListImportService(
            ShoppingListRepository shoppingListRepository,
            DomainEventPublisher domainEventPublisher,
            Clock clock,
            PricingMetadataService pricingMetadataService
    ) {
        this.shoppingListRepository = shoppingListRepository;
        this.domainEventPublisher = domainEventPublisher;
        this.clock = clock;
        this.pricingMetadataService = pricingMetadataService;
    }

    @Transactional
    public ShoppingList importList(ImportWillysListCommand command, ActorDisplayName actorDisplayName) {
        Clock importClock = resolveImportClock(command.modifiedTime());
        ShoppingList shoppingList = ShoppingList.create(
                resolveListName(command.name()),
                ShoppingListProvider.WILLYS,
                actorDisplayName,
                importClock
        );

        for (ImportWillysListEntryCommand entry : command.entries()) {
            importEntry(shoppingList, entry, actorDisplayName, importClock);
        }

        ShoppingList persisted = shoppingListRepository.save(shoppingList);
        domainEventPublisher.publish(shoppingList.pullDomainEvents());
        return persisted;
    }

    private void importEntry(
            ShoppingList shoppingList,
            ImportWillysListEntryCommand entry,
            ActorDisplayName actorDisplayName,
            Clock importClock
    ) {
        BigDecimal quantity = requirePositiveQuantity(entry.quantity());
        ShoppingListItem item;

        if ("PRODUCT".equals(entry.entryType())) {
            ImportWillysProductCommand product = requireProduct(entry.product());
            if (isWholeNumber(quantity)) {
                item = shoppingList.addExternalItem(
                        new ExternalArticleSnapshot(
                                "willys",
                                requireText(product.code(), "Willys product code is required for product entries."),
                                requireText(product.name(), "Willys product name is required for product entries."),
                                blankToNull(product.productLine2()),
                                product.imageUrl(),
                                blankToNull(entry.categoryName()),
                                product.priceValue(),
                                product.priceValue() == null ? null : "SEK",
                                pricingMetadataService.toMetadataJson(
                                        pricingMetadataService.fromWillysProduct(
                                                product.name(),
                                                product.productLine2(),
                                                null,
                                                product.priceUnit(),
                                                product.comparePrice(),
                                                product.comparePriceUnit()
                                        )
                                )
                        ),
                        quantity.intValueExact(),
                        actorDisplayName,
                        importClock
                );
            } else {
                item = shoppingList.addManualItem(
                        requireText(product.name(), "Willys product name is required for product entries."),
                        weightedQuantityNote(quantity, entry.pickUnit(), product.productLine2()),
                        actorDisplayName,
                        importClock
                );
            }
        } else if ("FREETEXT".equals(entry.entryType())) {
            String title = requireText(entry.freeTextProduct(), "Willys free text entry must include freeTextProduct.");
            if (isWholeNumber(quantity)) {
                item = shoppingList.addManualItem(title, "", quantity.intValueExact(), actorDisplayName, importClock);
            } else {
                item = shoppingList.addManualItem(title, weightedQuantityNote(quantity, entry.pickUnit(), null), actorDisplayName, importClock);
            }
        } else {
            throw new IllegalArgumentException("Unsupported Willys entry type: " + entry.entryType());
        }

        if (entry.checked()) {
            shoppingList.checkItem(item.getId(), actorDisplayName, importClock);
        }
    }

    private Clock resolveImportClock(LocalDate modifiedTime) {
        if (modifiedTime == null) {
            return clock;
        }
        return Clock.fixed(modifiedTime.atTime(LocalTime.NOON).atZone(clock.getZone()).toInstant(), clock.getZone());
    }

    private String resolveListName(String rawName) {
        return rawName == null || rawName.isBlank() ? DEFAULT_LIST_NAME : rawName.trim();
    }

    private BigDecimal requirePositiveQuantity(BigDecimal quantity) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Willys entry quantity must be greater than zero.");
        }
        return quantity;
    }

    private ImportWillysProductCommand requireProduct(ImportWillysProductCommand product) {
        if (product == null) {
            throw new IllegalArgumentException("Willys product entry must include product details.");
        }
        return product;
    }

    private String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    private boolean isWholeNumber(BigDecimal quantity) {
        return quantity.stripTrailingZeros().scale() <= 0;
    }

    private String weightedQuantityNote(BigDecimal quantity, String pickUnit, String detail) {
        StringBuilder note = new StringBuilder("Importerad mängd: ").append(quantity.stripTrailingZeros().toPlainString());
        if (pickUnit != null && !pickUnit.isBlank()) {
            note.append(" ").append(pickUnit.trim());
        }
        if (detail != null && !detail.isBlank()) {
            note.append(" • ").append(detail.trim());
        }
        return note.toString();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record ImportWillysListCommand(
            String name,
            LocalDate modifiedTime,
            List<ImportWillysListEntryCommand> entries
    ) {
    }

    public record ImportWillysListEntryCommand(
            BigDecimal quantity,
            String pickUnit,
            String categoryName,
            String entryType,
            String freeTextProduct,
            boolean checked,
            ImportWillysProductCommand product
    ) {
    }

    public record ImportWillysProductCommand(
            String code,
            String name,
            String productLine2,
            BigDecimal priceValue,
            String imageUrl,
            String priceUnit,
            String comparePrice,
            String comparePriceUnit
    ) {
    }
}
