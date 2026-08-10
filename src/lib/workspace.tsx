import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getPreviousWeekStart } from "@/utils/weekUtils";

const STORAGE_KEY = "myntmore.workspace.v1";

type WorkspaceState = {
  selectedWeek: string;
  setSelectedWeek: (week: string) => void;
};

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [selectedWeek, setSelectedWeekState] = useState(() => {
    const reportingWeek = getPreviousWeekStart();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      // Keep a deliberate historical selection during the same real-life week,
      // but advance automatically when a new reporting week begins.
      return saved.reportingWeek === reportingWeek && saved.selectedWeek
        ? saved.selectedWeek
        : reportingWeek;
    } catch {
      return reportingWeek;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      selectedWeek,
      reportingWeek: getPreviousWeekStart(),
    }));
  }, [selectedWeek]);

  const value = useMemo(() => ({ selectedWeek, setSelectedWeek: setSelectedWeekState }), [selectedWeek]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
