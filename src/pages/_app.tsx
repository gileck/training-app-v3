import "@/client/styles/globals.css";
import "@/client/styles/project.css";  // Project-specific styles (ignored by template-sync)
import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/client/features/template/app-shell";
import { startPlanStalenessWatcher } from "@/client/features/project/plan-data";

/**
 * Project mount-time side-effect: re-check active-plan staleness on tab
 * focus / visibility-visible. Registers window/document listeners and cleans
 * them up on unmount — no React context required. Mounted via AppShell's
 * `wrapProviders` seam so it lives inside the app-root tree.
 */
function PlanStalenessWatcher({ children }: { children: ReactNode }) {
  useEffect(() => startPlanStalenessWatcher(), []);
  return <>{children}</>;
}

export default function App() {
  return (
    <AppShell wrapProviders={(children) => <PlanStalenessWatcher>{children}</PlanStalenessWatcher>} />
  );
}
