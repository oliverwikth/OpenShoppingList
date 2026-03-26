package se.openshoppinglist.actor;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

@Component
public class ActorContextResolver {

    public ActorDisplayName resolve(HttpServletRequest request) {
        String header = request.getHeader(ActorDisplayName.HEADER_NAME);
        if (header == null || header.isBlank()) {
            return new ActorDisplayName("anonymous");
        }
        return ActorDisplayName.from(header);
    }
}
