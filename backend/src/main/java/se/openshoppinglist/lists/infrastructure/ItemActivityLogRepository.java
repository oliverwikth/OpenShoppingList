package se.openshoppinglist.lists.infrastructure;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemActivityLogRepository extends JpaRepository<ItemActivityLogEntry, UUID> {

    List<ItemActivityLogEntry> findAllByEventTypeOrderByOccurredAtAsc(String eventType);

    Page<ItemActivityLogEntry> findAllByOrderByOccurredAtDesc(Pageable pageable);

    List<ItemActivityLogEntry> findTop20ByListIdOrderByOccurredAtDesc(UUID listId);
}
