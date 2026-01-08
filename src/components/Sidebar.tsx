"use client";

import Link from "next/link";
import type { ModuleManifestEntry } from "@/data/moduleManifest";
import { useProgress } from "@/contexts/ProgressContext";

type SidebarProps = {
  manifest: ModuleManifestEntry[];
  isOpen?: boolean;
  onClose?: () => void;
};

export const Sidebar = ({ manifest, isOpen, onClose }: SidebarProps) => {
  const { progress, ready } = useProgress();
  const completedCount = manifest.filter(
    (entry) => progress.modules[entry.moduleId]?.status === "completed"
  ).length;

  return (
    <aside className={`sidebar ${isOpen ? "sidebar--open" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="brand-title">GHL Workflow Mastery</div>
          <button
            type="button"
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            Close
          </button>
        </div>
        <div className="brand-subtitle">Beginner friendly HighLevel practice</div>
      </div>

      <div className="sidebar-section">
        <Link href="/" className="sidebar-link" onClick={onClose}>
          Course home
        </Link>
        <div className="progress-meta">
          {completedCount}/{manifest.length} done
        </div>
        {!ready && <div className="progress-note">Loading progress...</div>}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Modules</div>
        <div className="module-list">
          {manifest.map((entry) => {
            const module = progress.modules[entry.moduleId];
            const status = module?.status ?? "available";
            const displayStatus = status === "locked" ? "available" : status;
            const showModuleId = !entry.title.startsWith(entry.moduleId);
            const linkClass = [
              "module-link",
              displayStatus === "completed" ? "module-link--completed" : ""
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <Link
                key={entry.moduleId}
                href={`/modules/${entry.moduleId}`}
                className={linkClass}
                onClick={onClose}
              >
                {showModuleId && <span className="module-id">{entry.moduleId}</span>}
                <span className="module-title">{entry.title}</span>
                <span className={`status-badge status-badge--${displayStatus}`}>
                  {displayStatus === "completed" ? "Done" : "Open"}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
