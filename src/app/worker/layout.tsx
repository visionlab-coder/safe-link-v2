import type { ReactNode } from "react";

export default function WorkerLayout({ children }: { children: ReactNode }) {
  return <div className="admin-concept-theme worker-concept-theme min-h-screen">{children}</div>;
}
