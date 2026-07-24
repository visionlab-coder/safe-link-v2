package com.safelink.v3.support;

import java.util.Map;
import com.safelink.v3.auth.AuthService.WorkerQuickLoginConflictException;
import com.safelink.v3.auth.AuthService.WorkerQuickLoginNotFoundException;
import com.safelink.v3.auth.AuthService.UserAlreadyExistsException;
import com.safelink.v3.auth.AuthService.AccountPendingApprovalException;
import com.safelink.v3.auth.LoginAttemptRateLimiter.LoginRateLimitExceededException;
import com.safelink.v3.incentive.IncentiveController.AlreadyGrantedException;
import com.safelink.v3.quiz.QuizController.AlreadyAnsweredException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Map<String, String>> accessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(BadCredentialsException.class)
    ResponseEntity<Map<String, String>> badCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(AccountPendingApprovalException.class)
    ResponseEntity<Map<String, String>> accountPendingApproval(AccountPendingApprovalException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(LoginRateLimitExceededException.class)
    ResponseEntity<Map<String, String>> loginRateLimited(LoginRateLimitExceededException ex) {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(NotFoundException.class)
    ResponseEntity<Map<String, String>> notFound(NotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(WorkerQuickLoginNotFoundException.class)
    ResponseEntity<Map<String, String>> workerQuickLoginNotFound(WorkerQuickLoginNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(WorkerQuickLoginConflictException.class)
    ResponseEntity<Map<String, String>> workerQuickLoginConflict(WorkerQuickLoginConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(UserAlreadyExistsException.class)
    ResponseEntity<Map<String, String>> userAlreadyExists(UserAlreadyExistsException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(ServiceUnavailableException.class)
    ResponseEntity<Map<String, String>> unavailable(ServiceUnavailableException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(AlreadyGrantedException.class)
    ResponseEntity<Map<String, Object>> alreadyGranted(AlreadyGrantedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage(), "grantId", String.valueOf(ex.grantId())));
    }

    @ExceptionHandler(AlreadyAnsweredException.class)
    ResponseEntity<Map<String, Object>> alreadyAnswered(AlreadyAnsweredException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", ex.getMessage(), "score_pct", ex.scorePct() == null ? 0 : ex.scorePct()));
    }


    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, String>> validation(MethodArgumentNotValidException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", "validation_failed"));
    }
}
