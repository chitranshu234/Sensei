package com.sensei.exception;

/** Thrown when a request is well-formed but semantically invalid (e.g. unreadable path). */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}
