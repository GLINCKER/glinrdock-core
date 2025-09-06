package com.glinrdock.sample.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;
import java.util.Map;
import java.util.HashMap;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api")
public class SampleController {
    
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("timestamp", LocalDateTime.now());
        response.put("service", "Sample Spring Boot App");
        response.put("version", "1.0.0");
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/hello")
    public ResponseEntity<Map<String, String>> hello() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "Hello from GLINRDOCK deployed Spring Boot app!");
        response.put("timestamp", LocalDateTime.now().toString());
        return ResponseEntity.ok(response);
    }
    
    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> info() {
        Map<String, Object> response = new HashMap<>();
        response.put("app", "Sample Spring Boot Application");
        response.put("description", "Test application deployed via GLINRDOCK");
        response.put("version", "1.0.0");
        response.put("java", System.getProperty("java.version"));
        response.put("spring-boot", "3.2.1");
        response.put("profiles", System.getProperty("spring.profiles.active", "default"));
        
        Map<String, Object> runtime = new HashMap<>();
        Runtime rt = Runtime.getRuntime();
        runtime.put("processors", rt.availableProcessors());
        runtime.put("memory-max", rt.maxMemory() / 1024 / 1024 + " MB");
        runtime.put("memory-total", rt.totalMemory() / 1024 / 1024 + " MB");
        runtime.put("memory-free", rt.freeMemory() / 1024 / 1024 + " MB");
        response.put("runtime", runtime);
        
        return ResponseEntity.ok(response);
    }
}