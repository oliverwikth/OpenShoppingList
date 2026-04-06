package se.openshoppinglist.lists;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import se.openshoppinglist.actor.ActorDisplayName;
import se.openshoppinglist.support.PostgresIntegrationTest;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ShoppingListRealtimeIntegrationTest extends PostgresIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void broadcastsListEventsOverWebSocketForActiveListClients() throws Exception {
        JsonNode list = postJson("/api/lists", "anna", Map.of(
                "name", "Realtime-lista",
                "provider", "willys"
        ));
        String listId = list.path("id").asText();

        BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        TestWebSocketListener listener = new TestWebSocketListener(messages);
        WebSocket webSocket = HttpClient.newHttpClient()
                .newWebSocketBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/lists/" + listId), listener)
                .join();

        listener.awaitOpen();

        postJson("/api/lists/" + listId + "/items/manual", "olle", Map.of(
                "title", "Mjölk",
                "note", ""
        ));

        String payload = messages.poll(5, TimeUnit.SECONDS);
        assertThat(payload).isNotBlank();

        JsonNode event = objectMapper.readTree(payload);
        assertThat(event.path("listId").asText()).isEqualTo(listId);
        assertThat(event.path("eventType").asText()).isEqualTo("shopping-list-item.added");
        assertThat(event.path("actorDisplayName").asText()).isEqualTo("olle");
        assertThat(event.path("occurredAt").asText()).isNotBlank();

        webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "done").join();
    }

    private JsonNode postJson(String path, String actorName, Map<String, Object> body) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(ActorDisplayName.HEADER_NAME, actorName);

        String responseBody = restTemplate.postForObject(path, new HttpEntity<>(body, headers), String.class);
        return objectMapper.readTree(responseBody);
    }

    private static final class TestWebSocketListener implements WebSocket.Listener {

        private final BlockingQueue<String> messages;
        private final CompletableFuture<Void> opened = new CompletableFuture<>();

        private TestWebSocketListener(BlockingQueue<String> messages) {
            this.messages = messages;
        }

        @Override
        public void onOpen(WebSocket webSocket) {
            webSocket.request(1);
            opened.complete(null);
        }

        @Override
        public java.util.concurrent.CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            messages.offer(data.toString());
            webSocket.request(1);
            return CompletableFuture.completedFuture(null);
        }

        void awaitOpen() {
            opened.join();
        }
    }
}
