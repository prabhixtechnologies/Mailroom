package com.prabhix.mailroom;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Mailroom API process. Mailbox routes are not here yet — see {@code README.md} for the extraction
 * order from oneOps. Until then this process only proves packaging and health.
 */
@SpringBootApplication
public class MailroomApplication {

    public static void main(String[] args) {
        SpringApplication.run(MailroomApplication.class, args);
    }
}
