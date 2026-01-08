"use client";

import Link from "next/link";
import type { ModuleManifestEntry } from "@/data/moduleManifest";
import { useProgress } from "@/contexts/ProgressContext";

type CourseHomeProps = {
  manifest: ModuleManifestEntry[];
};

export const CourseHome = ({ manifest }: CourseHomeProps) => {
  const { progress } = useProgress();
  const nextModule = manifest.find(
    (entry) => progress.modules[entry.moduleId]?.status === "available"
  );

  return (
    <div className="page">
      <header className="page-header">
        <div className="eyebrow">Course Overview</div>
        <h1 className="page-title">GHL Workflow Mastery</h1>
        <p className="page-subtitle">
          Learn workflows in simple steps. Practice in a safe builder that matches
          HighLevel.
        </p>
        {nextModule && (
          <Link href={`/modules/${nextModule.moduleId}`} className="btn">
            Continue {nextModule.moduleId}
          </Link>
        )}
      </header>

      <section className="grid-section">
        <div className="section-title">Course path</div>
        <div className="module-grid">
          {manifest.map((entry) => {
            const module = progress.modules[entry.moduleId];
            const status = module?.status ?? "available";
            const displayStatus = status === "locked" ? "available" : status;
            const showModuleId = !entry.title.startsWith(entry.moduleId);
            const linkClass = [
              "module-card",
              displayStatus === "completed" ? "module-card--completed" : ""
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div key={entry.moduleId} className={linkClass}>
                <div className="module-card-header">
                  {showModuleId && <span className="module-id">{entry.moduleId}</span>}
                  <span className={`status-pill status-pill--${displayStatus}`}>
                    {displayStatus === "completed" ? "Completed" : "Available"}
                  </span>
                </div>
                <div className="module-card-title">{entry.title}</div>
                <div className="module-card-phase">{entry.phase}</div>
                <Link className="module-card-action" href={`/modules/${entry.moduleId}`}>
                  Open lesson
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
