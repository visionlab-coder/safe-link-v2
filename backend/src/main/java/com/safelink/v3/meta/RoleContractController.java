package com.safelink.v3.meta;

import com.safelink.v3.domain.Role;
import java.util.Arrays;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/meta")
public class RoleContractController {
    @GetMapping("/role-contract")
    public RoleContractResponse roleContract() {
        return new RoleContractResponse(Arrays.stream(Role.values()).map(Role::name).toList());
    }

    public record RoleContractResponse(List<String> roles) {}
}
