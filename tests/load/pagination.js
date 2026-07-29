import http from "k6/http";
import { check, group, sleep } from "k6";
import {
  BASE_URL,
  commonThresholds,
  jsonParams,
  queryString,
  requireProductionApproval,
} from "./lib/config.js";
import {
  ADMIN_ACCOUNTS,
  accountForVu,
  loginAdmin,
} from "./lib/auth.js";

requireProductionApproval();
if (ADMIN_ACCOUNTS.length === 0) {
  throw new Error("K6_ADMIN_ACCOUNTS_JSON is required");
}

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    ...commonThresholds(),
    "http_req_duration{name:GET /api/v1/admin/workers max page}": ["p(95)<1200"],
    "http_req_duration{name:GET /api/v1/tbm/compat/notices max page}": ["p(95)<1200"],
    "http_req_duration{name:GET /api/v1/chat/compat/messages page}": ["p(95)<1200"],
  },
  tags: { suite: "safelink-pagination" },
};

function get(path, name) {
  return http.get(`${BASE_URL}${path}`, jsonParams(name));
}

export default function paginationJourney() {
  const account = accountForVu(ADMIN_ACCOUNTS);
  loginAdmin(account);

  group("maximum list sizes", () => {
    const workerQuery = queryString({
      limit: 200,
      active: 0,
      site_id: account.site_id,
    });
    const workers = get(
      `/api/v1/admin/workers?${workerQuery}`,
      "GET /api/v1/admin/workers max page",
    );
    check(workers, {
      "workers max page is 200": (result) => result.status === 200,
      "workers response is bounded": (result) => {
        try {
          return (result.json("workers") || []).length <= 200;
        } catch {
          return false;
        }
      },
    });

    const noticeQuery = queryString({
      limit: 100,
      site_id: account.site_id,
    });
    const notices = get(
      `/api/v1/tbm/compat/notices?${noticeQuery}`,
      "GET /api/v1/tbm/compat/notices max page",
    );
    check(notices, {
      "TBM max page is 200": (result) => result.status === 200,
      "TBM response is bounded": (result) => {
        try {
          return (result.json("notices") || []).length <= 100;
        } catch {
          return false;
        }
      },
    });
  });

  group("chat cursor traversal up to 1000 records", () => {
    const peers = get(
      "/api/v1/chat/compat/admin/workers",
      "GET /api/v1/chat/compat/admin/workers",
    );
    check(peers, { "chat peers is 200": (result) => result.status === 200 });
    const peer = (peers.json("workers") || [])[0];
    if (!peer) return;

    let before = null;
    let total = 0;
    for (let page = 0; page < 10; page += 1) {
      const query = queryString({
        peer_id: peer.id,
        limit: 100,
        before,
      });
      const response = get(
        `/api/v1/chat/compat/messages?${query}`,
        "GET /api/v1/chat/compat/messages page",
      );
      const pageOk = check(response, {
        "chat page is 200": (result) => result.status === 200,
      });
      if (!pageOk) break;
      const messages = response.json("messages") || [];
      total += messages.length;
      if (messages.length < 100) break;
      before = messages[messages.length - 1].created_at;
      sleep(0.2);
    }
    check(total, {
      "chat traversal is bounded to 1000": (count) => count <= 1000,
    });
  });
}
