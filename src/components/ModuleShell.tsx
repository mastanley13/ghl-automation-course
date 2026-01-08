"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useProgress } from "@/contexts/ProgressContext";
import { useCopilot } from "@/contexts/CopilotContext";
import { GLOSSARY } from "@/data/glossary";
import type { ScenarioDefinition } from "@/lib/scenarioTypes";
import type { NodeType } from "@/lib/workflowTypes";
import type { ValidationIssueWithContext } from "@/lib/validation";
import { MarkdownContent } from "@/components/MarkdownContent";
import { WorkflowBuilder } from "@/components/WorkflowBuilder";
import { ValidationPanel } from "@/components/ValidationPanel";
import { SimulationPanel } from "@/components/SimulationPanel";
import { GlossaryPanel } from "@/components/GlossaryPanel";
import { MIN_TEACH_BACK_WORDS, TEACH_BACK_RUBRIC } from "@/lib/rubric";
import { GHL_TERM_SUMMARY, getGhlTerm, getNodeDisplayName } from "@/lib/ghlTerms";

type ModuleShellProps = {
  moduleId: string;
  title: string;
  phase: string;
  learnMarkdown: string;
  teachBackPrompt: string;
  nextModuleId?: string;
  scenario?: ScenarioDefinition | null;
};

type TabKey = "Learn" | "Build" | "Validate" | "Simulate" | "Teach-back";

type MicroLessonCard = {
  title: string;
  text: string;
};

type ExpectedFieldHint = {
  label: string;
  values: string[];
  note?: string;
};

type ExpectedFieldHintsByNode = Partial<Record<NodeType, Record<string, ExpectedFieldHint>>>;

const tabs: { key: TabKey; label: string; helper: string }[] = [
  { key: "Learn", label: "Learn", helper: "Read this first" },
  { key: "Build", label: "Build", helper: "Practice" },
  { key: "Validate", label: "Validate", helper: "Check my work" },
  { key: "Simulate", label: "Simulate", helper: "Test run" },
  { key: "Teach-back", label: "Teach-back", helper: "Explain in your words" }
];

const getAllowedNodeTypes = (scenario?: ScenarioDefinition | null): NodeType[] | undefined => {
  if (!scenario || "workflows" in scenario) {
    return undefined;
  }
  return [
    ...scenario.allowedNodes.triggers,
    ...scenario.allowedNodes.actions,
    ...scenario.allowedNodes.logic
  ];
};

const formatRequirementSummary = (requirement: any) => {
  switch (requirement.type) {
    case "triggerIs":
      return `Trigger is ${getNodeDisplayName(requirement.value)}`;
    case "triggerConfigEquals":
      return `Trigger field ${requirement.field} equals ${String(requirement.value)}`;
    case "mustHaveNode":
      return `Includes ${getNodeDisplayName(requirement.value)}`;
    case "forbidNodeType":
      return `Does not include ${getNodeDisplayName(requirement.value)}`;
    case "nodeConfigRequired":
      return `${getNodeDisplayName(requirement.nodeType)} has ${requirement.fields.join(", ")}`;
    case "nodeOrder":
      return `Order: ${requirement.sequence.map(getNodeDisplayName).join(" -> ")}`;
    case "mustContainIfElse":
      return `Has at least ${requirement.minCount ?? 1} If/Else step`;
    case "branchCountAtLeast":
      return `If/Else has at least ${requirement.count} paths`;
    case "pathMustInclude":
      return `Includes ${requirement.nodeTypes.map(getNodeDisplayName).join(", ")}`;
    case "requireStopPath":
      return "Each path ends when there are no more steps";
    default:
      return "Requirement";
  }
};

const buildScenarioSummary = (scenario?: ScenarioDefinition | null) => {
  if (!scenario) {
    return null;
  }
  if ("workflows" in scenario) {
    return {
      moduleId: scenario.moduleId,
      title: scenario.title,
      workflows: scenario.workflows.map((workflow) => ({
        workflowId: workflow.workflowId,
        title: workflow.scenario.title,
        objectives: workflow.scenario.objectives,
        allowedSteps: [
          ...workflow.scenario.allowedNodes.triggers.map(getNodeDisplayName),
          ...workflow.scenario.allowedNodes.actions.map(getNodeDisplayName),
          ...workflow.scenario.allowedNodes.logic.map(getNodeDisplayName)
        ],
        requirements: workflow.scenario.requirements.map(formatRequirementSummary)
      }))
    };
  }
  return {
    moduleId: scenario.moduleId,
    title: scenario.title,
    objectives: scenario.objectives,
    allowedSteps: [
      ...scenario.allowedNodes.triggers.map(getNodeDisplayName),
      ...scenario.allowedNodes.actions.map(getNodeDisplayName),
      ...scenario.allowedNodes.logic.map(getNodeDisplayName)
    ],
    requirements: scenario.requirements.map(formatRequirementSummary)
  };
};

const buildExpectedFieldHints = (
  scenario?: ScenarioDefinition | null
): ExpectedFieldHintsByNode => {
  if (!scenario || "workflows" in scenario) {
    return {};
  }

  const hints: ExpectedFieldHintsByNode = {};

  const collectHint = (
    nodeType: NodeType,
    fieldKey: string,
    label: string,
    values: Array<string | number | boolean | null | undefined>,
    note?: string
  ) => {
    const cleaned = values
      .filter((value) => value !== null && value !== undefined)
      .map((value) => String(value))
      .filter((value) => value.trim().length > 0);
    if (!cleaned.length) {
      return;
    }
    const existing = hints[nodeType]?.[fieldKey];
    const merged = new Set([...(existing?.values ?? []), ...cleaned]);
    hints[nodeType] = {
      ...(hints[nodeType] ?? {}),
      [fieldKey]: {
        label,
        values: Array.from(merged),
        note: existing?.note ?? note
      }
    };
  };

  scenario.testCases.forEach((testCase) => {
    const expect = testCase.expect;
    expect.messages?.forEach((message) => {
      if (message.channel === "sms") {
        collectHint(
          "sms.send",
          "body",
          "Expected text to include",
          message.contains,
          "Use these words somewhere in the SMS."
        );
      }
      if (message.channel === "email") {
        collectHint(
          "email.send",
          "body",
          "Expected text to include",
          message.contains,
          "Use these words somewhere in the email."
        );
        collectHint(
          "email.send",
          "subject",
          "Suggested keyword",
          message.contains,
          "Short is ok. Use a key word from the body."
        );
      }
    });

    if (expect.tagsAdded?.length) {
      collectHint("tag.add", "tag", "Expected tag", expect.tagsAdded);
    }
    if (expect.tagsRemoved?.length) {
      collectHint("tag.remove", "tag", "Expected tag to remove", expect.tagsRemoved);
    }
    if (expect.fieldsEqual?.length) {
      collectHint(
        "field.update",
        "fieldKey",
        "Expected field name",
        expect.fieldsEqual.map((item) => item.fieldKey)
      );
      collectHint(
        "field.update",
        "value",
        "Expected value",
        expect.fieldsEqual.map((item) => item.value)
      );
    }
    if (expect.tasksCreated?.length) {
      expect.tasksCreated.forEach((task) => {
        collectHint("task.create", "title", "Expected words", task.contains);
      });
    }
    if (expect.systemTasksCreated?.length) {
      expect.systemTasksCreated.forEach((task) => {
        collectHint("task.create", "title", "Expected words", task.contains);
      });
    }
    if (expect.notifications?.length) {
      expect.notifications.forEach((notification) => {
        collectHint("user.notify", "message", "Expected words", notification.contains);
      });
    }
    if (expect.systemNotifications?.length) {
      expect.systemNotifications.forEach((notification) => {
        collectHint("user.notify", "message", "Expected words", notification.contains);
      });
    }
    if (expect.webhooksFired?.length) {
      expect.webhooksFired.forEach((webhook) => {
        collectHint(
          "webhook.send",
          "url",
          "Expected URL contains",
          webhook.urlContains
        );
      });
    }
  });

  return hints;
};

const buildMicroLessonCards = (
  scenario?: ScenarioDefinition | null
): MicroLessonCard[] => {
  if (!scenario) {
    return [];
  }

  if ("workflows" in scenario) {
    const titles = scenario.workflows.map((workflow) => workflow.scenario.title);
    const preview = titles.slice(0, 2).join(" / ");
    const extra = titles.length > 2 ? ` +${titles.length - 2} more` : "";
    return [
      {
        title: "Goal",
        text: `Build ${titles.length} workflows: ${preview}${extra}.`
      },
      {
        title: "Key steps",
        text: "Use the checklist in Check my work for each workflow."
      },
      {
        title: "Where in HighLevel",
        text: "HighLevel: Workflows -> Builder"
      }
    ];
  }

  const objective = scenario.objectives?.[0] ?? "Build the workflow for this lesson.";
  const requirements = scenario.requirements
    .slice(0, 2)
    .map(formatRequirementSummary)
    .join(" / ");
  const allowedSteps = [
    ...scenario.allowedNodes.triggers,
    ...scenario.allowedNodes.actions,
    ...scenario.allowedNodes.logic
  ]
    .map(getNodeDisplayName)
    .slice(0, 3)
    .join(", ");
  const triggerRequirement = scenario.requirements.find(
    (requirement) => requirement.type === "triggerIs"
  );
  const triggerType =
    triggerRequirement && "value" in triggerRequirement
      ? triggerRequirement.value
      : scenario.allowedNodes.triggers[0];
  const ghlWhere = triggerType ? getGhlTerm(triggerType)?.ghlWhere : null;

  return [
    {
      title: "Goal",
      text: objective
    },
    {
      title: "Key steps",
      text: requirements || allowedSteps || "Follow the checklist in Check my work."
    },
    {
      title: "Where in HighLevel",
      text: ghlWhere ?? "HighLevel: Workflows -> Builder"
    }
  ];
};

const MultiWorkflowBuilder = ({
  moduleId,
  scenario,
  focusNodeId,
  focusFieldKey,
  singleTriggerMode,
  onReadyForCheckChange,
  validationIssues,
  onFixNode
}: {
  moduleId: string;
  scenario: ScenarioDefinition | null | undefined;
  focusNodeId?: string | null;
  focusFieldKey?: string | null;
  singleTriggerMode?: boolean;
  onReadyForCheckChange?: (ready: boolean) => void;
  validationIssues?: ValidationIssueWithContext[];
  onFixNode?: (nodeId?: string, fieldKey?: string) => void;
}) => {
  if (!scenario || !("workflows" in scenario)) {
    return null;
  }
  const [activeWorkflowId, setActiveWorkflowId] = useState(
    scenario.workflows[0]?.workflowId ?? ""
  );
  const activeWorkflow = scenario.workflows.find(
    (workflow) => workflow.workflowId === activeWorkflowId
  );
  const activeIssues = validationIssues?.filter(
    (issue) => issue.workflowId === activeWorkflowId
  );
  const expectedFieldHints = useMemo(
    () => buildExpectedFieldHints(activeWorkflow?.scenario ?? null),
    [activeWorkflow]
  );
  const allowedTypes = activeWorkflow
    ? [
        ...activeWorkflow.scenario.allowedNodes.triggers,
        ...activeWorkflow.scenario.allowedNodes.actions,
        ...activeWorkflow.scenario.allowedNodes.logic
      ]
    : undefined;

  return (
    <div className="multi-workflow">
      <label className="field">
        <span className="field-label">Workflow</span>
        <select
          className="select-input"
          value={activeWorkflowId}
          onChange={(event) => setActiveWorkflowId(event.target.value)}
        >
          {scenario.workflows.map((workflow) => (
            <option key={workflow.workflowId} value={workflow.workflowId}>
              {workflow.scenario.title}
            </option>
          ))}
        </select>
      </label>
      {activeWorkflow ? (
        <WorkflowBuilder
          moduleId={moduleId}
          workflowId={activeWorkflow.workflowId}
          allowedNodeTypes={allowedTypes}
          focusNodeId={focusNodeId ?? undefined}
          focusFieldKey={focusFieldKey ?? undefined}
          singleTriggerMode={singleTriggerMode}
          onReadyForCheckChange={onReadyForCheckChange}
          validationIssues={activeIssues}
          onFixNode={onFixNode}
          expectedFieldHints={expectedFieldHints}
        />
      ) : (
        <div className="muted">Select a workflow to begin.</div>
      )}
    </div>
  );
};

export const ModuleShell = ({
  moduleId,
  title,
  phase,
  learnMarkdown,
  teachBackPrompt,
  nextModuleId,
  scenario
}: ModuleShellProps) => {
  const [activeTab, setActiveTab] = useState<TabKey>("Learn");
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [focusFieldKey, setFocusFieldKey] = useState<string | null>(null);
  const [guidedFlow, setGuidedFlow] = useState(true);
  const [buildReady, setBuildReady] = useState(false);
  const [validationPassed, setValidationPassed] = useState(false);
  const [simulationPassed, setSimulationPassed] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssueWithContext[]>([]);
  const { progress, updateTeachBack, markCompleted } = useProgress();
  const { send, setContext } = useCopilot();

  const moduleProgress = progress.modules[moduleId];
  const status = moduleProgress?.status ?? "available";
  const displayStatus = status === "locked" ? "available" : status;
  const teachBackText = moduleProgress?.teachBack ?? "";

  const wordCount = useMemo(() => {
    if (!teachBackText.trim()) {
      return 0;
    }
    return teachBackText.trim().split(/\s+/).filter(Boolean).length;
  }, [teachBackText]);

  const canSubmitTeachBack = wordCount >= MIN_TEACH_BACK_WORDS;
  const microLessonCards = useMemo(() => buildMicroLessonCards(scenario), [scenario]);
  const activeTabIndex = Math.max(0, tabs.findIndex((tab) => tab.key === activeTab));
  const isBundle = Boolean(scenario && "workflows" in scenario);
  const expectedFieldHints = useMemo(
    () => buildExpectedFieldHints(scenario),
    [scenario]
  );
  const singleTriggerMode = useMemo(() => {
    if (!scenario || "workflows" in scenario) {
      return false;
    }
    return scenario.requirements.some((requirement) => requirement.type === "triggerIs");
  }, [scenario]);
  const prevTab = tabs[activeTabIndex - 1]?.key ?? null;
  const buildNextDisabled = guidedFlow && !buildReady && !isBundle;
  const validateNextDisabled = guidedFlow && !validationPassed;
  const simulateNextDisabled = guidedFlow && !simulationPassed;

  useEffect(() => {
    setContext({
      moduleId,
      moduleTitle: title,
      scenario: buildScenarioSummary(scenario),
      ghlTerms: GHL_TERM_SUMMARY
    });
  }, [moduleId, scenario, setContext, title]);

  useEffect(() => {
    setBuildReady(false);
    setValidationPassed(false);
    setSimulationPassed(false);
    setValidationIssues([]);
  }, [moduleId, scenario]);

  useEffect(() => {
    if (activeTab === "Build") {
      setValidationPassed(false);
      setSimulationPassed(false);
    }
  }, [activeTab, buildReady]);

  useEffect(() => {
    if (guidedFlow && activeTab === "Validate" && validationPassed) {
      setActiveTab("Simulate");
    }
  }, [activeTab, guidedFlow, validationPassed]);

  useEffect(() => {
    if (guidedFlow && activeTab === "Simulate" && simulationPassed) {
      setActiveTab("Teach-back");
    }
  }, [activeTab, guidedFlow, simulationPassed]);

  const handleFixNode = (nodeId?: string, fieldKey?: string) => {
    if (!nodeId) {
      setActiveTab("Build");
      setFocusNodeId(null);
      setFocusFieldKey(null);
      return;
    }
    setActiveTab("Build");
    setFocusNodeId(nodeId);
    setFocusFieldKey(fieldKey ?? null);
  };

  const handleTeachBackSubmit = () => {
    if (!canSubmitTeachBack) {
      return;
    }
    markCompleted(moduleId);
  };

  return (
    <div className="page module-page">
      <header className="module-header">
        <div className="eyebrow">{phase}</div>
        <h1 className="page-title">{title}</h1>
        <div className="module-meta">
          <span className={`status-pill status-pill--${displayStatus}`}>
            {displayStatus === "completed" ? "Completed" : "In progress"}
          </span>
          <span className="meta-item">
            Checks run: {moduleProgress?.attempts.validate ?? 0}
          </span>
          <span className="meta-item">
            Test runs: {moduleProgress?.attempts.simulate ?? 0}
          </span>
        </div>
        <div className="module-actions">
          <GlossaryPanel />
        </div>
      </header>

      <div className="lesson-flow">
        <div className="lesson-flow-header">
          <div>
            <div className="lesson-flow-title">Lesson path</div>
            <div className="lesson-flow-meta">
              Step {activeTabIndex + 1} of {tabs.length}: {tabs[activeTabIndex]?.label}
            </div>
          </div>
          <label className="lesson-flow-toggle">
            <input
              type="checkbox"
              checked={guidedFlow}
              onChange={(event) => setGuidedFlow(event.target.checked)}
            />
            <span>Auto move</span>
          </label>
        </div>
        <div className="lesson-flow-note">
          Think of this lesson like a short recipe. We move one step at a time.
          Turn Auto move on to jump to the next step when you pass.
          You can always go back.
        </div>
        <div className="lesson-flow-steps">
          {tabs.map((tab, index) => {
            const status =
              index < activeTabIndex
                ? "done"
                : index === activeTabIndex
                  ? "active"
                  : "todo";
            const isFutureLocked = guidedFlow && index > activeTabIndex + 1;
            const disabled = isFutureLocked;
            return (
              <button
                key={tab.key}
                type="button"
                className={`flow-step flow-step--${status}`}
                onClick={() => setActiveTab(tab.key)}
                disabled={disabled}
              >
                <span className="flow-step-number">{index + 1}</span>
                <span className="flow-step-label">{tab.label}</span>
                <span className="flow-step-helper">{tab.helper}</span>
              </button>
            );
          })}
        </div>
      </div>

      {microLessonCards.length > 0 && (
        <div className="micro-lesson-grid">
          {microLessonCards.map((card) => (
            <div key={card.title} className="micro-lesson-card">
              <div className="micro-lesson-title">{card.title}</div>
              <div className="micro-lesson-text">{card.text}</div>
            </div>
          ))}
        </div>
      )}

      <div className="tab-panel">
        {activeTab === "Learn" && (
          <div className="card">
            <MarkdownContent content={learnMarkdown} />
            <div className="flow-actions">
              <button
                className="btn"
                onClick={() => setActiveTab("Build")}
              >
                Next: Practice in Build
              </button>
            </div>
          </div>
        )}

        {activeTab === "Build" && (
          <div className="card">
            <h2 className="card-title">Practice</h2>
            <p className="muted">
              Add steps and fill the required fields. We connect steps for you.
            </p>
            {"workflows" in (scenario ?? {}) ? (
              <MultiWorkflowBuilder
                moduleId={moduleId}
                scenario={scenario}
                focusNodeId={focusNodeId}
                focusFieldKey={focusFieldKey}
                singleTriggerMode={singleTriggerMode}
                onReadyForCheckChange={setBuildReady}
                validationIssues={validationIssues}
                onFixNode={handleFixNode}
              />
            ) : (
              <WorkflowBuilder
                moduleId={moduleId}
                allowedNodeTypes={getAllowedNodeTypes(scenario)}
                focusNodeId={focusNodeId}
                focusFieldKey={focusFieldKey}
                singleTriggerMode={singleTriggerMode}
                onReadyForCheckChange={setBuildReady}
                validationIssues={validationIssues}
                onFixNode={handleFixNode}
                expectedFieldHints={expectedFieldHints}
              />
            )}
            <div className="flow-actions">
              <button
                className="btn btn-secondary"
                onClick={() => prevTab && setActiveTab(prevTab)}
                disabled={!prevTab}
              >
                Back
              </button>
              <button
                className="btn"
                onClick={() => setActiveTab("Validate")}
                disabled={buildNextDisabled}
              >
                Next: Check my work
              </button>
            </div>
            {buildNextDisabled && (
              <div className="flow-hint">
                Add a trigger, add an action, and fill required fields first.
              </div>
            )}
          </div>
        )}

        {activeTab === "Validate" && (
          <div className="card">
            <h2 className="card-title">Check my work</h2>
            <p className="muted">
              Check the checklist and required fields.
            </p>
            <ValidationPanel
              moduleId={moduleId}
              scenario={scenario}
              onFixNode={handleFixNode}
              onStatusChange={setValidationPassed}
              onIssuesChange={setValidationIssues}
            />
            <div className="flow-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setActiveTab("Build")}
              >
                Back to Build
              </button>
              <button
                className="btn"
                onClick={() => setActiveTab("Simulate")}
                disabled={validateNextDisabled}
              >
                Next: Test run
              </button>
            </div>
            {validateNextDisabled && (
              <div className="flow-hint">
                Run the check and fix issues before moving on.
              </div>
            )}
          </div>
        )}

        {activeTab === "Simulate" && (
          <div className="card">
            <h2 className="card-title">Test run</h2>
            <p className="muted">
              Run a test to see what happens step by step.
            </p>
            <SimulationPanel
              moduleId={moduleId}
              scenario={scenario}
              onStatusChange={setSimulationPassed}
            />
            <div className="flow-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setActiveTab("Validate")}
              >
                Back to Check
              </button>
              <button
                className="btn"
                onClick={() => setActiveTab("Teach-back")}
                disabled={simulateNextDisabled}
              >
                Next: Teach-back
              </button>
            </div>
            {simulateNextDisabled && (
              <div className="flow-hint">
                Run the test run before moving on.
              </div>
            )}
          </div>
        )}

        {activeTab === "Teach-back" && (
          <div className="card">
            <h2 className="card-title">Explain in your words</h2>
            <p className="muted">{teachBackPrompt || "Explain the workflow in your own words."}</p>

            <textarea
              className="teachback-input"
              rows={10}
              placeholder="Write your teach-back here..."
              value={teachBackText}
              onChange={(event) => updateTeachBack(moduleId, event.target.value)}
            />
            <div className="teachback-meta">
              <span>
                Word count: {wordCount} / {MIN_TEACH_BACK_WORDS} minimum
              </span>
              {!canSubmitTeachBack && (
                <span className="muted">Add more detail to submit.</span>
              )}
            </div>

            <div className="rubric">
              <div className="rubric-title">Teach-back checklist</div>
              <ul>
                {TEACH_BACK_RUBRIC.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="teachback-actions">
              <button
                className="btn"
                onClick={handleTeachBackSubmit}
                disabled={!canSubmitTeachBack}
              >
                Submit teach-back
              </button>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  send({
                    mode: "teach_back",
                    question: "Coach my teach-back draft.",
                    hintLevel: 2,
                    context: {
                      teachBack: teachBackText,
                      rubric: TEACH_BACK_RUBRIC,
                      glossary: GLOSSARY
                    }
                  })
                }
                disabled={!teachBackText.trim()}
              >
                Coach my teach-back
              </button>
              {status === "completed" && nextModuleId && (
                <Link className="btn btn-secondary" href={`/modules/${nextModuleId}`}>
                  Next module
                </Link>
              )}
            </div>
            <div className="flow-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setActiveTab("Simulate")}
              >
                Back to Test run
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
