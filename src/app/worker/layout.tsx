import type { ReactNode } from "react";
import WorkerTbmNotificationListener from "@/components/WorkerTbmNotificationListener";

export default function WorkerLayout({ children }: { children: ReactNode }) {
  return <div className="admin-concept-theme worker-concept-theme min-h-screen"><WorkerTbmNotificationListener />{children}</div>;
}
