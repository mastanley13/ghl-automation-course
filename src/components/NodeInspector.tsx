"use client";

import { useEffect, useRef, useState } from "react";
import type { ConfigField, ConfigFieldOption } from "@/lib/nodeCatalog";
import type { WorkflowNode } from "@/lib/workflowTypes";
import { getNodeDefinition } from "@/lib/nodeCatalog";
import { getGhlTerm } from "@/lib/ghlTerms";
import { IfElseEditor } from "@/components/IfElseEditor";

type NodeInspectorProps = {
  node: WorkflowNode | null;
  onChange: (nodeId: string, config: WorkflowNode["config"]) => void;
  focusFieldKey?: string | null;
  expectedFieldHints?: Record<string, { label: string; values: string[]; note?: string }>;
  onDelete?: (nodeId: string) => void;
  onMove?: (direction: "up" | "down") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  moveDisabledReason?: string | null;
};

const isFieldMissing = (value: unknown) => {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  return false;
};

export const NodeInspector = ({
  node,
  onChange,
  focusFieldKey,
  expectedFieldHints,
  onDelete,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
  moveDisabledReason = null
}: NodeInspectorProps) => {
  const fieldRefs = useRef<
    Record<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>
  >({});
  const lastFocusKeyRef = useRef<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const definition = node ? getNodeDefinition(node.type) : null;
  const term = node ? getGhlTerm(node.type) : null;
  const requiredFields =
    definition?.configFields?.filter((field) => field.required) ?? [];
  const advancedFields =
    definition?.configFields?.filter((field) => !field.required) ?? [];

  useEffect(() => {
    if (!node) {
      return;
    }
    setAdvancedOpen(false);
    lastFocusKeyRef.current = null;
  }, [node?.id]);

  useEffect(() => {
    if (!node || !focusFieldKey) {
      return;
    }
    if (advancedFields.some((field) => field.key === focusFieldKey)) {
      setAdvancedOpen(true);
    }
    const focusKey = `${node.id}:${focusFieldKey}`;
    if (lastFocusKeyRef.current === focusKey) {
      return;
    }
    const element = fieldRefs.current[focusFieldKey];
    if (element) {
      element.focus();
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      lastFocusKeyRef.current = focusKey;
    }
  }, [advancedFields, focusFieldKey, node]);

  if (!node) {
    return <div className="inspector-empty">Select a step to view settings.</div>;
  }

  if (!definition) {
    return <div className="inspector-empty">Unknown step type.</div>;
  }

  const renderField = (field: ConfigField, isFocused: boolean) => {
    const value = node.config[field.key] ?? "";
    const missing = field.required && isFieldMissing(value);
    const fieldClass = missing
      ? "text-input input-error"
      : "text-input";
    const inputClass = isFocused ? `${fieldClass} input-focus` : fieldClass;
    const selectClass = missing ? "select-input input-error" : "select-input";
    const selectClassName = isFocused ? `${selectClass} input-focus` : selectClass;
    const registerRef = (
      element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
    ) => {
      fieldRefs.current[field.key] = element;
    };
    const expected = expectedFieldHints?.[field.key];

    if (field.type === "select") {
      const options = (field.options ?? []).map((option) =>
        typeof option === "string" ? { value: option, label: option } : option
      ) as ConfigFieldOption[];
      return (
        <>
          {expected && (
            <div className="field-expected">
              <div className="field-expected-label">{expected.label}</div>
              <div className="field-expected-values">
                {expected.values.map((item) => `"${item}"`).join(" / ")}
              </div>
              {expected.note && <div className="field-expected-note">{expected.note}</div>}
            </div>
          )}
          <select
            className={selectClassName}
            value={String(value || options[0]?.value || "")}
            ref={registerRef}
            onChange={(event) =>
              onChange(node.id, { ...node.config, [field.key]: event.target.value })
            }
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      );
    }

    if (field.type === "number") {
      return (
        <>
          {expected && (
            <div className="field-expected">
              <div className="field-expected-label">{expected.label}</div>
              <div className="field-expected-values">
                {expected.values.map((item) => `"${item}"`).join(" / ")}
              </div>
              {expected.note && <div className="field-expected-note">{expected.note}</div>}
            </div>
          )}
          <input
            type="number"
            className={inputClass}
            value={typeof value === "number" ? value : ""}
            placeholder={field.placeholder}
            ref={registerRef}
            onChange={(event) =>
              onChange(node.id, {
                ...node.config,
                [field.key]: event.target.value === "" ? null : Number(event.target.value)
              })
            }
          />
        </>
      );
    }

    if (field.type === "boolean") {
      return (
        <>
          {expected && (
            <div className="field-expected">
              <div className="field-expected-label">{expected.label}</div>
              <div className="field-expected-values">
                {expected.values.map((item) => `"${item}"`).join(" / ")}
              </div>
              {expected.note && <div className="field-expected-note">{expected.note}</div>}
            </div>
          )}
          <input
            type="checkbox"
            checked={Boolean(value)}
            ref={registerRef}
            onChange={(event) =>
              onChange(node.id, { ...node.config, [field.key]: event.target.checked })
            }
          />
        </>
      );
    }

    return (
      <>
        {expected && (
          <div className="field-expected">
            <div className="field-expected-label">{expected.label}</div>
            <div className="field-expected-values">
              {expected.values.map((item) => `"${item}"`).join(" / ")}
            </div>
            {expected.note && <div className="field-expected-note">{expected.note}</div>}
          </div>
        )}
        <input
          className={inputClass}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          ref={registerRef}
          onChange={(event) =>
            onChange(node.id, { ...node.config, [field.key]: event.target.value })
          }
        />
      </>
    );
  };

  return (
    <div className="inspector">
      <div className="inspector-header">
        <div className="inspector-title">{definition.label}</div>
        <div className="inspector-subtitle">{definition.description}</div>
        {(onMove || onDelete) && (
          <div className="inspector-actions">
            {onMove && (
              <>
                <div className="inspector-action-row">
                  <button
                    type="button"
                    className="btn btn-secondary btn-inline"
                    disabled={!canMoveUp}
                    onClick={() => onMove("up")}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-inline"
                    disabled={!canMoveDown}
                    onClick={() => onMove("down")}
                  >
                    Move down
                  </button>
                </div>
                {!canMoveUp && !canMoveDown && moveDisabledReason && (
                  <div className="inspector-hint">{moveDisabledReason}</div>
                )}
              </>
            )}
            {onDelete && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary btn-inline"
                  onClick={() => onDelete(node.id)}
                >
                  Remove step
                </button>
                <div className="inspector-hint">
                  Removes this step and its lines.
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {term && (
        <div className="inspector-help">
          <div className="help-row">
            <span className="help-label">What this means</span>
            <span className="help-text">{term.whatItMeans}</span>
          </div>
          <div className="help-row">
            <span className="help-label">Why this matters</span>
            <span className="help-text">{term.whyItMatters}</span>
          </div>
          <div className="help-row">
            <span className="help-label">Where this is in HighLevel</span>
            <span className="help-text">{term.ghlWhere}</span>
          </div>
        </div>
      )}

      {definition.customEditor === "ifElse" ? (
        <IfElseEditor
          config={node.config as any}
          onChange={(config) => onChange(node.id, config)}
        />
      ) : (
        <>
          <div className="inspector-fields">
            {requiredFields.map((field) => (
              <label
                key={field.key}
                className={`field ${focusFieldKey === field.key ? "field--focus" : ""}`}
                data-field-key={field.key}
              >
                <span className="field-label">
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
                {renderField(field, focusFieldKey === field.key)}
                {field.helper && <span className="field-helper">{field.helper}</span>}
              </label>
            ))}
            {!definition.configFields?.length && (
              <div className="muted">No settings needed for this step.</div>
            )}
          </div>
          {advancedFields.length > 0 && (
            <details
              className="advanced-fields"
              open={advancedOpen}
              onToggle={(event) =>
                setAdvancedOpen((event.target as HTMLDetailsElement).open)
              }
            >
              <summary>Advanced (optional)</summary>
              <div className="inspector-fields">
                {advancedFields.map((field) => (
                  <label
                    key={field.key}
                    className={`field ${focusFieldKey === field.key ? "field--focus" : ""}`}
                    data-field-key={field.key}
                  >
                    <span className="field-label">{field.label}</span>
                    {renderField(field, focusFieldKey === field.key)}
                    {field.helper && <span className="field-helper">{field.helper}</span>}
                  </label>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
};
