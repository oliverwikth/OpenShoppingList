package se.openshoppinglist.lists.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
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
    public List<ShoppingList> findPage(int pageNumber, int pageSize) {
        List<UUID> ids = repository.findPageOfIds(PageRequest.of(pageNumber, pageSize)).getContent();
        if (ids.isEmpty()) {
            return List.of();
        }

        java.util.Map<UUID, Integer> order = java.util.stream.IntStream.range(0, ids.size())
                .boxed()
                .collect(Collectors.toMap(ids::get, Function.identity()));

        return repository.findByIdIn(ids).stream()
                .sorted(java.util.Comparator.comparingInt(list -> order.getOrDefault(list.getId(), Integer.MAX_VALUE)))
                .toList();
    }

    @Override
    public long count() {
        return repository.count();
    }

    @Override
    public Optional<ShoppingList> findById(UUID listId) {
        return repository.findById(listId);
    }
}
