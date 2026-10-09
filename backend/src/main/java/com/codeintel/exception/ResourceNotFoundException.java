package com.codeintel.exception;

/**
 * Thrown when a requested repository (or other resource) does not exist.
 *
 * <p>Without a dedicated type every lookup failure was a bare {@link RuntimeException},
 * which the global handler mapped to HTTP 500 — telling the client "the server broke"
 * when the truthful answer was 404 "that repository is not here".
 */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }

    public static ResourceNotFoundException repository(Long id) {
        return new ResourceNotFoundException("Repository not found: " + id);
    }
}
