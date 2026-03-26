package se.openshoppinglist.lists.infrastructure;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemActivityLogRepository extends JpaRepository<ItemActivityLogEntry, UUID> {

    List<ItemActivityLogEntry> findTop20ByListIdOrderByOccurredAtDesc(UUID listId);
}
