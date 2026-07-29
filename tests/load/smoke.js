import http from "k6/http";
import { check, group, sleep } from "k6";
import { BASE_URL, commonThresholds, jsonParams } from "./lib/config.js";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: commonThresholds(),
  tags: { suite: "safelink-smoke" },
};

export default function smokeJourney() {
  group("public readiness", () => {
    const response = http.get(
      `${BASE_URL}/actuator/health/readiness`,
      jsonParams("GET /actuator/health/readiness"),
    );
    check(response, {
      "readiness is 200": (result) => result.status === 200,
      "readiness is UP": (result) => {
        try {
          return result.json("status") === "UP";
        } catch {
          return false;
        }
      },
    });
  });

  group("csrf bootstrap", () => {
    const response = http.get(
      `${BASE_URL}/api/v1/auth/csrf`,
      jsonParams("GET /api/v1/auth/csrf"),
    );
    check(response, {
      "csrf is 200": (result) => result.status === 200,
      "csrf token returned": (result) => {
        try {
          return typeof result.json("token") === "string" && result.json("token").length > 20;
        } catch {
          return false;
        }
      },
    });
  });

  sleep(1);
}
