package com.prabhix.mailroom;

import com.prabhix.mailroom.config.MailroomProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(MailroomProperties.class)
public class MailroomApplication {

    public static void main(String[] args) {
        SpringApplication.run(MailroomApplication.class, args);
    }
}
