package se.openshoppinglist.lists.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Repository;
import se.openshoppinglist.lists.domain.ShoppingList;
import se.openshoppinglist.lists.domain.ShoppingListRepository;

@Repository
class JpaShoppingListRepositoryAdapter implements ShoppingListRepository {

    private final SpringDataShoppingListRepository repository;

    JpaShoppingListRepositoryAdapter(SpringDataShoppingListRepository repository) {
        this.repository = repository;
    }

    @Override
    public ShoppingList save(ShoppingList shoppingList) {
        return repository.save(shoppingList);
    }

    @Override
    public List<ShoppingList> findAll() {
        return repository.findAll();
    }

    @Override
    public Optional<ShoppingList> findById(UUID listId) {
        return repository.findById(listId);
    }
}
