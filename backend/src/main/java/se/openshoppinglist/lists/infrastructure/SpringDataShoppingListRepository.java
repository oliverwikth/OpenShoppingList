package se.openshoppinglist.lists.infrastructure;

import java.util.Collection;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import se.openshoppinglist.lists.domain.ShoppingList;

interface SpringDataShoppingListRepository extends JpaRepository<ShoppingList, UUID> {

    @Override
    @EntityGraph(attributePaths = "items")
    java.util.List<ShoppingList> findAll();

    @EntityGraph(attributePaths = "items")
    @Query("select shoppingList from ShoppingList shoppingList where shoppingList.archivedAt is null")
    java.util.List<ShoppingList> findAllActive();

    @Override
    @EntityGraph(attributePaths = "items")
    java.util.Optional<ShoppingList> findById(UUID id);

    @Query("select shoppingList.id from ShoppingList shoppingList order by shoppingList.createdAt desc, shoppingList.id desc")
    Page<UUID> findPageOfIds(Pageable pageable);

    @Query("""
            select shoppingList.id
            from ShoppingList shoppingList
            where shoppingList.archivedAt is null
            order by shoppingList.createdAt desc, shoppingList.id desc
            """)
    Page<UUID> findActivePageOfIds(Pageable pageable);

    long countByArchivedAtIsNull();

    @EntityGraph(attributePaths = "items")
    java.util.List<ShoppingList> findByIdIn(Collection<UUID> ids);
}
