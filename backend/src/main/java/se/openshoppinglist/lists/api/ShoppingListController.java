package se.openshoppinglist.lists.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import se.openshoppinglist.actor.ActorContextResolver;
import se.openshoppinglist.lists.application.ShoppingListCommandService;
import se.openshoppinglist.lists.application.ShoppingListQueryService;
import se.openshoppinglist.lists.application.ShoppingStatsQueryService;
import se.openshoppinglist.lists.application.ShoppingListViews;
import se.openshoppinglist.lists.application.WillysListImportService;
import se.openshoppinglist.lists.domain.ExternalArticleSnapshot;

@RestController
@RequestMapping("/api/lists")
@Validated
public class ShoppingListController {

    private final ShoppingListCommandService shoppingListCommandService;
    private final ShoppingListQueryService shoppingListQueryService;
    private final ShoppingStatsQueryService shoppingStatsQueryService;
    private final WillysListImportService willysListImportService;
    private final ActorContextResolver actorContextResolver;
    private final ObjectMapper objectMapper;

    public ShoppingListController(
            ShoppingListCommandService shoppingListCommandService,
            ShoppingListQueryService shoppingListQueryService,
            ShoppingStatsQueryService shoppingStatsQueryService,
            WillysListImportService willysListImportService,
            ActorContextResolver actorContextResolver,
            ObjectMapper objectMapper
    ) {
        this.shoppingListCommandService = shoppingListCommandService;
        this.shoppingListQueryService = shoppingListQueryService;
        this.shoppingStatsQueryService = shoppingStatsQueryService;
        this.willysListImportService = willysListImportService;
        this.actorContextResolver = actorContextResolver;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    List<ShoppingListViews.ShoppingListOverviewView> getLists() {
        return shoppingListQueryService.findAllLists();
    }

    @PostMapping
    ShoppingListViews.ShoppingListOverviewView createList(
            @Valid @RequestBody CreateListRequest request,
            HttpServletRequest httpServletRequest
    ) {
        return shoppingListQueryService.toOverviewView(shoppingListCommandService.createList(
                request.name(),
                actorContextResolver.resolve(httpServletRequest)
        ));
    }

    @GetMapping("/{listId}")
    ShoppingListViews.ShoppingListDetailView getList(@PathVariable UUID listId) {
        return shoppingListQueryService.getList(listId);
    }

    @GetMapping("/stats")
    ShoppingListViews.ShoppingStatsView getStats(@RequestParam(defaultValue = "month") String range) {
        return shoppingStatsQueryService.getStats(range);
    }

    @PostMapping("/imports/willys")
    Object importWillysList(
            @RequestBody JsonNode requestBody,
            HttpServletRequest httpServletRequest
    ) {
        if (requestBody == null || requestBody.isNull()) {
            throw new IllegalArgumentException("Willys import body must not be empty.");
        }

        if (requestBody.isArray()) {
            return streamOf(requestBody.elements())
                    .map(node -> objectMapper.convertValue(node, ImportWillysListRequest.class))
                    .map(this::toImportCommand)
                    .map(command -> willysListImportService.importList(command, actorContextResolver.resolve(httpServletRequest)))
                    .map(importedList -> shoppingListQueryService.getList(importedList.getId()))
                    .toList();
        }

        if (requestBody.isObject()) {
            return shoppingListQueryService.getList(willysListImportService.importList(
                    toImportCommand(objectMapper.convertValue(requestBody, ImportWillysListRequest.class)),
                    actorContextResolver.resolve(httpServletRequest)
            ).getId());
        }

        throw new IllegalArgumentException("Willys import body must be either an object or an array of objects.");
    }

    private WillysListImportService.ImportWillysListCommand toImportCommand(ImportWillysListRequest request) {
        return new WillysListImportService.ImportWillysListCommand(
                request.name(),
                request.modifiedTime(),
                request.entries() == null
                        ? List.of()
                        : request.entries().stream()
                        .map(entry -> new WillysListImportService.ImportWillysListEntryCommand(
                                entry.quantity(),
                                entry.pickUnit(),
                                entry.categoryName(),
                                entry.entryType(),
                                entry.freeTextProduct(),
                                entry.checked(),
                                entry.product() == null
                                        ? null
                                        : new WillysListImportService.ImportWillysProductCommand(
                                                entry.product().code(),
                                                entry.product().name(),
                                                entry.product().productLine2(),
                                                entry.product().priceValue(),
                                                entry.product().image() == null ? null : entry.product().image().url()
                                        )
                        ))
                        .toList()
        );
    }

    private <T> java.util.stream.Stream<T> streamOf(java.util.Iterator<T> iterator) {
        Iterable<T> iterable = () -> iterator;
        return java.util.stream.StreamSupport.stream(iterable.spliterator(), false);
    }

    @PatchMapping("/{listId}")
    ShoppingListViews.ShoppingListOverviewView renameList(
            @PathVariable UUID listId,
            @Valid @RequestBody RenameListRequest request,
            HttpServletRequest httpServletRequest
    ) {
        return shoppingListQueryService.toOverviewView(shoppingListCommandService.renameList(
                listId,
                request.name(),
                actorContextResolver.resolve(httpServletRequest)
        ));
    }

    @PostMapping("/{listId}/archive")
    ShoppingListViews.ShoppingListOverviewView archiveList(@PathVariable UUID listId, HttpServletRequest request) {
        return shoppingListQueryService.toOverviewView(shoppingListCommandService.archiveList(
                listId,
                actorContextResolver.resolve(request)
        ));
    }

    @PostMapping("/{listId}/items/manual")
    ShoppingListViews.ShoppingListItemView addManualItem(
            @PathVariable UUID listId,
            @Valid @RequestBody AddManualItemRequest request,
            HttpServletRequest httpServletRequest
    ) {
        return shoppingListQueryService.toItemView(shoppingListCommandService.addManualItem(
                listId,
                request.title(),
                request.note(),
                request.quantity() == null ? 1 : request.quantity(),
                actorContextResolver.resolve(httpServletRequest)
        ));
    }

    @PostMapping("/{listId}/items/external")
    ShoppingListViews.ShoppingListItemView addExternalItem(
            @PathVariable UUID listId,
            @Valid @RequestBody AddExternalItemRequest request,
            HttpServletRequest httpServletRequest
    ) {
        ExternalArticleSnapshot snapshot = new ExternalArticleSnapshot(
                request.provider(),
                request.articleId(),
                request.title(),
                request.subtitle(),
                request.imageUrl(),
                request.category(),
                request.priceAmount(),
                request.currency(),
                request.rawPayloadJson()
        );
        return shoppingListQueryService.toItemView(shoppingListCommandService.addExternalItem(
                listId,
                snapshot,
                request.quantity() == null ? 1 : request.quantity(),
                actorContextResolver.resolve(httpServletRequest)
        ));
    }

    @PostMapping("/{listId}/items/{itemId}/check")
    ShoppingListViews.ShoppingListItemView checkItem(
            @PathVariable UUID listId,
            @PathVariable UUID itemId,
            HttpServletRequest request
    ) {
        return shoppingListQueryService.toItemView(shoppingListCommandService.checkItem(
                listId,
                itemId,
                actorContextResolver.resolve(request)
        ));
    }

    @PostMapping("/{listId}/items/{itemId}/uncheck")
    ShoppingListViews.ShoppingListItemView uncheckItem(
            @PathVariable UUID listId,
            @PathVariable UUID itemId,
            HttpServletRequest request
    ) {
        return shoppingListQueryService.toItemView(shoppingListCommandService.uncheckItem(
                listId,
                itemId,
                actorContextResolver.resolve(request)
        ));
    }

    @PostMapping("/{listId}/items/{itemId}/claim")
    ShoppingListViews.ShoppingListItemView toggleItemClaim(
            @PathVariable UUID listId,
            @PathVariable UUID itemId,
            HttpServletRequest request
    ) {
        return shoppingListQueryService.toItemView(shoppingListCommandService.toggleItemClaim(
                listId,
                itemId,
                actorContextResolver.resolve(request)
        ));
    }

    @PostMapping("/{listId}/items/{itemId}/decrement")
    ShoppingListViews.ItemQuantityChangeView decrementItem(
            @PathVariable UUID listId,
            @PathVariable UUID itemId,
            HttpServletRequest request
    ) {
        ShoppingListCommandService.ItemQuantityChange result = shoppingListCommandService.decreaseItemQuantity(
                listId,
                itemId,
                actorContextResolver.resolve(request)
        );
        return new ShoppingListViews.ItemQuantityChangeView(
                result.itemId(),
                result.removed(),
                result.item() == null ? null : shoppingListQueryService.toItemView(result.item())
        );
    }

    @PostMapping("/{listId}/items/{itemId}/quantity-adjust")
    ShoppingListViews.ItemQuantityChangeView adjustItemQuantity(
            @PathVariable UUID listId,
            @PathVariable UUID itemId,
            @RequestBody AdjustItemQuantityRequest request,
            HttpServletRequest httpServletRequest
    ) {
        if (request.delta() == null || request.delta() == 0) {
            throw new IllegalArgumentException("Item quantity delta must not be zero.");
        }

        ShoppingListCommandService.ItemQuantityChange result = shoppingListCommandService.adjustItemQuantity(
                listId,
                itemId,
                request.delta(),
                actorContextResolver.resolve(httpServletRequest)
        );
        return new ShoppingListViews.ItemQuantityChangeView(
                result.itemId(),
                result.removed(),
                result.item() == null ? null : shoppingListQueryService.toItemView(result.item())
        );
    }

    public record CreateListRequest(@NotBlank String name) {
    }

    public record RenameListRequest(@NotBlank String name) {
    }

    public record AddManualItemRequest(@NotBlank String title, String note, @Positive Integer quantity) {
    }

    public record AddExternalItemRequest(
            @NotBlank String provider,
            @NotBlank String articleId,
            @NotBlank String title,
            String subtitle,
            String imageUrl,
            String category,
            java.math.BigDecimal priceAmount,
            String currency,
            String rawPayloadJson,
            @Positive Integer quantity
    ) {
    }

    public record AdjustItemQuantityRequest(Integer delta) {
    }

    public record ImportWillysListRequest(String name, LocalDate modifiedTime, List<ImportWillysEntryRequest> entries) {
    }

    public record ImportWillysEntryRequest(
            java.math.BigDecimal quantity,
            String pickUnit,
            String categoryName,
            String entryType,
            String freeTextProduct,
            boolean checked,
            ImportWillysProductRequest product
    ) {
    }

    public record ImportWillysProductRequest(
            String code,
            String name,
            String productLine2,
            java.math.BigDecimal priceValue,
            ImportWillysImageRequest image
    ) {
    }

    public record ImportWillysImageRequest(String url) {
    }
}
