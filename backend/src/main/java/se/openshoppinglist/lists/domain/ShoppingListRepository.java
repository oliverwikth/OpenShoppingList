package se.openshoppinglist.lists.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShoppingListRepository {

    ShoppingList save(ShoppingList shoppingList);

    List<ShoppingList> findAll();

    Optional<ShoppingList> findById(UUID listId);
}
