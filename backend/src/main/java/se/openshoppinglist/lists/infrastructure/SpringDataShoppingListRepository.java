package se.openshoppinglist.lists.infrastructure;

import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import se.openshoppinglist.lists.domain.ShoppingList;

interface SpringDataShoppingListRepository extends JpaRepository<ShoppingList, UUID> {

    @Override
    @EntityGraph(attributePaths = "items")
    java.util.List<ShoppingList> findAll();

    @Override
    @EntityGraph(attributePaths = "items")
    java.util.Optional<ShoppingList> findById(UUID id);
}
