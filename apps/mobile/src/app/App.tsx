import { useEffect, useMemo, useState } from "react";
import { getRuntimeConfig } from "../config/runtime";
import { getPlatformInfo } from "../lib/platform";
import { AdminAuthPanel } from "./AdminAuthPanel";
import { WorkerTbmPanel } from "./WorkerTbmPanel";
import { QrScanPanel } from "./QrScanPanel";

type NetworkState = "checking" | "online" | "offline";

function StatusRow({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "neutral";
}) {
  return (
    <div className="status-row">
      <span>{label}</span>
      <strong className={`tone-${tone}`}>{value}</strong>
    </div>
  );
}

export function App() {
  const config = useMemo(getRuntimeConfig, []);
  const platform = useMemo(getPlatformInfo, []);
  const [network, setNetwork] = useState<NetworkState>("checking");

  useEffect(() => {
    const update = () => setNetwork(navigator.onLine ? "online" : "offline");
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const ready =
    Boolean(config.apiBaseUrl) &&
    Boolean(config.supabaseUrl) &&
    config.supabasePublishableKeyConfigured;

  return (
    <main className="shell">
      <section className="hero">
        <div className="brand-mark">SL</div>
        <div>
          <p className="eyebrow">FIELD SAFETY OS</p>
          <h1>SAFE-LINK Mobile</h1>
          <p className="subtitle">Android/iOS 상용 앱 전환 진단 셸</p>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">M-003 DIAGNOSTICS</p>
            <h2>런타임 상태</h2>
          </div>
          <span className={`badge ${ready ? "ready" : "setup"}`}>
            {ready ? "CONFIG READY" : "SETUP REQUIRED"}
          </span>
        </div>

        <StatusRow label="Platform" value={platform.platform.toUpperCase()} tone="good" />
        <StatusRow label="Native runtime" value={platform.native ? "YES" : "WEB PREVIEW"} />
        <StatusRow
          label="Network"
          value={network.toUpperCase()}
          tone={network === "online" ? "good" : network === "offline" ? "warn" : "neutral"}
        />
        <StatusRow label="Environment" value={config.appEnv.toUpperCase()} />
        <StatusRow
          label="API base URL"
          value={config.apiBaseUrl ? "CONFIGURED" : "MISSING"}
          tone={config.apiBaseUrl ? "good" : "warn"}
        />
        <StatusRow
          label="Supabase URL"
          value={config.supabaseUrl ? "CONFIGURED" : "MISSING"}
          tone={config.supabaseUrl ? "good" : "warn"}
        />
        <StatusRow
          label="Publishable key"
          value={config.supabasePublishableKeyConfigured ? "CONFIGURED" : "MISSING"}
          tone={config.supabasePublishableKeyConfigured ? "good" : "warn"}
        />
      </section>

      <AdminAuthPanel />

      <WorkerTbmPanel />

      <QrScanPanel />

      <section className="notice">
        <strong>현재 범위</strong>
        <p>
          이 화면은 로컬 앱 번들, Capacitor 런타임, Android 빌드 체인을 검증합니다.
          운영 로그인과 현장 데이터는 다음 증분에서 연결합니다.
        </p>
      </section>
    </main>
  );
}
