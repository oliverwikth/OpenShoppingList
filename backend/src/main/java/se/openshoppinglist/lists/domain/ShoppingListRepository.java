package se.openshoppinglist.lists.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShoppingListRepository {

    ShoppingList save(ShoppingList shoppingList);

    List<ShoppingList> findAll();

    List<ShoppingList> findActive();

    List<ShoppingList> findPage(int pageNumber, int pageSize);

    List<ShoppingList> findActivePage(int pageNumber, int pageSize);

    long count();

    long countActive();

    Optional<ShoppingList> findById(UUID listId);
}
