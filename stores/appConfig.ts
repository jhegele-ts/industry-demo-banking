import { create } from "zustand";
import { persist } from "zustand/middleware";
import { syncAcrossTabs } from "@/stores/crossTab";

/** Which backend answers questions on /home. */
export type AgentExperience = "mcp" | "spotter";

interface AppConfigState {
  agentExperience: AgentExperience;
  setAgentExperience: (experience: AgentExperience) => void;
  resetToDefaults: () => void;
}

const DEFAULTS = { agentExperience: "mcp" as AgentExperience };

export const useAppConfig = create<AppConfigState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setAgentExperience: (agentExperience) => set({ agentExperience }),
      resetToDefaults: () => set({ ...DEFAULTS }),
    }),
    { name: "ledgerwise-app-config" },
  ),
);

// /config is usually open in its own tab; without this, changes made there
// don't reach the app until a reload.
syncAcrossTabs("ledgerwise-app-config", useAppConfig);
