package se.openshoppinglist.actor;

public record ActorDisplayName(String value) {

    public static final String HEADER_NAME = "X-Actor-Display-Name";
    private static final int MAX_LENGTH = 60;

    public ActorDisplayName {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Actor display name must not be blank.");
        }
        if (value.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("Actor display name must be at most " + MAX_LENGTH + " characters.");
        }
    }

    public static ActorDisplayName from(String rawValue) {
        return new ActorDisplayName(rawValue == null ? "" : rawValue.trim());
    }
}
