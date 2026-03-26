package se.openshoppinglist.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import se.openshoppinglist.lists.api.ListUpdatesWebSocketHandler;

@Configuration
@EnableWebSocket
class WebSocketConfiguration implements WebSocketConfigurer {

    private final ListUpdatesWebSocketHandler listUpdatesWebSocketHandler;
    private final AppProperties properties;

    WebSocketConfiguration(ListUpdatesWebSocketHandler listUpdatesWebSocketHandler, AppProperties properties) {
        this.listUpdatesWebSocketHandler = listUpdatesWebSocketHandler;
        this.properties = properties;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(listUpdatesWebSocketHandler, "/ws/lists/*")
                .setAllowedOrigins(properties.cors().allowedOrigins().toArray(String[]::new));
    }
}
