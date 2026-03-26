package se.openshoppinglist.lists.api;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import se.openshoppinglist.lists.application.ListRealtimePublisher;
import se.openshoppinglist.lists.application.ListRealtimeUpdate;

@Component
public class ListUpdatesWebSocketHandler extends TextWebSocketHandler implements ListRealtimePublisher {

    private static final Logger log = LoggerFactory.getLogger(ListUpdatesWebSocketHandler.class);

    private final ObjectMapper objectMapper;
    private final ConcurrentMap<UUID, Set<WebSocketSession>> sessionsByList = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, UUID> sessionListIds = new ConcurrentHashMap<>();

    public ListUpdatesWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        UUID listId = extractListId(session.getUri());
        if (listId == null) {
            session.close(CloseStatus.BAD_DATA.withReason("Missing list id"));
            return;
        }

        WebSocketSession concurrentSession = new ConcurrentWebSocketSessionDecorator(session, 5_000, 512 * 1024);
        sessionsByList.computeIfAbsent(listId, ignored -> ConcurrentHashMap.newKeySet()).add(concurrentSession);
        sessionListIds.put(session.getId(), listId);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        unregister(session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        unregister(session.getId());
        if (session.isOpen()) {
            session.close(CloseStatus.SERVER_ERROR);
        }
    }

    @Override
    public void publish(ListRealtimeUpdate update) {
        Set<WebSocketSession> sessions = sessionsByList.get(update.listId());
        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        String payload = toPayload(update);
        if (payload == null) {
            return;
        }

        for (WebSocketSession session : sessions) {
            if (!session.isOpen()) {
                unregister(session.getId());
                continue;
            }

            try {
                session.sendMessage(new TextMessage(payload));
            } catch (IOException exception) {
                log.debug("Failed to send realtime update for list {}", update.listId(), exception);
                unregister(session.getId());
            }
        }
    }

    private UUID extractListId(URI uri) {
        if (uri == null || uri.getPath() == null || uri.getPath().isBlank()) {
            return null;
        }

        String[] segments = uri.getPath().split("/");
        if (segments.length == 0) {
            return null;
        }

        String rawListId = segments[segments.length - 1];
        try {
            return UUID.fromString(rawListId);
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private void unregister(String sessionId) {
        UUID listId = sessionListIds.remove(sessionId);
        if (listId == null) {
            return;
        }

        sessionsByList.computeIfPresent(listId, (ignored, sessions) -> {
            sessions.removeIf(session -> sessionId.equals(session.getId()));
            return sessions.isEmpty() ? null : sessions;
        });
    }

    private String toPayload(ListRealtimeUpdate update) {
        try {
            return objectMapper.writeValueAsString(update);
        } catch (JsonProcessingException exception) {
            log.warn("Could not serialize realtime update for list {}", update.listId(), exception);
            return null;
        }
    }
}
