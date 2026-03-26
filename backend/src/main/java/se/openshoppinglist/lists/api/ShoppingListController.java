package se.openshoppinglist.lists.api;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import se.openshoppinglist.actor.ActorContextResolver;
import se.openshoppinglist.lists.application.ShoppingListCommandService;
import se.openshoppinglist.lists.application.ShoppingListQueryService;
import se.openshoppinglist.lists.application.ShoppingListViews;
import se.openshoppinglist.lists.domain.ExternalArticleSnapshot;

@RestController
@RequestMapping("/api/lists")
@Validated
public class ShoppingListController {

    private final ShoppingListCommandService shoppingListCommandService;
    private final ShoppingListQueryService shoppingListQueryService;
    private final ActorContextResolver actorContextResolver;

    public ShoppingListController(
            ShoppingListCommandService shoppingListCommandService,
            ShoppingListQueryService shoppingListQueryService,
            ActorContextResolver actorContextResolver
    ) {
        this.shoppingListCommandService = shoppingListCommandService;
        this.shoppingListQueryService = shoppingListQueryService;
        this.actorContextResolver = actorContextResolver;
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

    public record CreateListRequest(@NotBlank String name) {
    }

    public record RenameListRequest(@NotBlank String name) {
    }

    public record AddManualItemRequest(@NotBlank String title, String note) {
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
            String rawPayloadJson
    ) {
    }
}
