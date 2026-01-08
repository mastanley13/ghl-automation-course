"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ModuleManifestEntry } from "@/data/moduleManifest";

export type ModuleStatus = "locked" | "available" | "completed";

export type ModuleProgress = {
  status: ModuleStatus;
  attempts: {
    validate: number;
    simulate: number;
  };
  teachBack: string;
};

export type ProgressState = {
  modules: Record<string, ModuleProgress>;
};

type ProgressContextValue = {
  progress: ProgressState;
  ready: boolean;
  markValidateAttempt: (moduleId: string) => void;
  markSimulateAttempt: (moduleId: string) => void;
  updateTeachBack: (moduleId: string, text: string) => void;
  markCompleted: (moduleId: string) => void;
  unlockModule: (moduleId: string) => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);
const STORAGE_KEY = "ghlwm:progress:v1";

const buildDefaultProgress = (manifest: ModuleManifestEntry[]): ProgressState => {
  const modules: Record<string, ModuleProgress> = {};
  manifest.forEach((entry) => {
    modules[entry.moduleId] = {
      status: "available",
      attempts: { validate: 0, simulate: 0 },
      teachBack: ""
    };
  });
  return { modules };
};

const mergeProgress = (
  manifest: ModuleManifestEntry[],
  saved?: ProgressState
): ProgressState => {
  const baseline = buildDefaultProgress(manifest);
  if (!saved) {
    return baseline;
  }

  const merged: ProgressState = { modules: { ...baseline.modules } };
  for (const entry of manifest) {
    const savedModule = saved.modules?.[entry.moduleId];
    if (savedModule) {
      const savedStatus =
        savedModule.status === "locked" ? "available" : savedModule.status;
      merged.modules[entry.moduleId] = {
        status: savedStatus ?? baseline.modules[entry.moduleId].status,
        attempts: savedModule.attempts ?? baseline.modules[entry.moduleId].attempts,
        teachBack: savedModule.teachBack ?? ""
      };
    }
  }

  return merged;
};

export const ProgressProvider = ({
  manifest,
  children
}: {
  manifest: ModuleManifestEntry[];
  children: React.ReactNode;
}) => {
  const [progress, setProgress] = useState<ProgressState>(() =>
    buildDefaultProgress(manifest)
  );
  const [ready, setReady] = useState(false);

  const moduleOrder = useMemo(
    () => manifest.map((entry) => entry.moduleId),
    [manifest]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as ProgressState) : undefined;
    setProgress(mergeProgress(manifest, saved));
    setReady(true);
  }, [manifest]);

  useEffect(() => {
    if (!ready || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress, ready]);

  const updateModule = (
    moduleId: string,
    updater: (current: ModuleProgress) => ModuleProgress
  ) => {
    setProgress((current) => {
      const existing = current.modules[moduleId];
      if (!existing) {
        return current;
      }
      return {
        modules: {
          ...current.modules,
          [moduleId]: updater(existing)
        }
      };
    });
  };

  const unlockModule = (moduleId: string) => {
    updateModule(moduleId, (current) => {
      if (current.status !== "locked") {
        return current;
      }
      return { ...current, status: "available" };
    });
  };

  const markCompleted = (moduleId: string) => {
    updateModule(moduleId, (current) => ({
      ...current,
      status: "completed"
    }));

    const index = moduleOrder.indexOf(moduleId);
    if (index >= 0 && index < moduleOrder.length - 1) {
      unlockModule(moduleOrder[index + 1]);
    }
  };

  const markValidateAttempt = (moduleId: string) => {
    updateModule(moduleId, (current) => ({
      ...current,
      attempts: {
        ...current.attempts,
        validate: current.attempts.validate + 1
      }
    }));
  };

  const markSimulateAttempt = (moduleId: string) => {
    updateModule(moduleId, (current) => ({
      ...current,
      attempts: {
        ...current.attempts,
        simulate: current.attempts.simulate + 1
      }
    }));
  };

  const updateTeachBack = (moduleId: string, text: string) => {
    updateModule(moduleId, (current) => ({
      ...current,
      teachBack: text
    }));
  };

  const value: ProgressContextValue = {
    progress,
    ready,
    markValidateAttempt,
    markSimulateAttempt,
    updateTeachBack,
    markCompleted,
    unlockModule
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgress = () => {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error("useProgress must be used within ProgressProvider");
  }
  return ctx;
};
