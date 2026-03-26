package se.openshoppinglist;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class OpenShoppingListApplication {

    public static void main(String[] args) {
        SpringApplication.run(OpenShoppingListApplication.class, args);
    }

}
