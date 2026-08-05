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
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return saved.selectedWeek || getPreviousWeekStart();
    } catch {
      return getPreviousWeekStart();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ selectedWeek }));
  }, [selectedWeek]);

  const value = useMemo(() => ({ selectedWeek, setSelectedWeek: setSelectedWeekState }), [selectedWeek]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
