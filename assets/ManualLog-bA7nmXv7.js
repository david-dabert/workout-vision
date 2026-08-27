import { u as useT, r as reactExports, j as jsxRuntimeExports, E as EXERCISES, b as EXERCISE_GROUPS, s as saveWorkout } from "./index-C01m8qLM.js";
import { l as logEvent } from "./telemetry-DzSBVjfT.js";
function getCategoryLabel(key, t) {
  const map = { compound: "compound", isolation: "isolation", bodyweight: "bodyweight" };
  return map[key] ? t(map[key]) : key;
}
const categoryOrder = ["compound", "bodyweight", "isolation"];
const sortedCategories = categoryOrder.filter((c) => EXERCISE_GROUPS[c]);
for (const c of Object.keys(EXERCISE_GROUPS)) {
  if (!sortedCategories.includes(c)) sortedCategories.push(c);
}
function emptyEntry() {
  return { exerciseKey: "", sets: [{ reps: "", weight: "" }] };
}
function ManualLog({ onClose }) {
  const { t, tExercise } = useT();
  const [entries, setEntries] = reactExports.useState([emptyEntry()]);
  const [saving, setSaving] = reactExports.useState(false);
  const [saved, setSaved] = reactExports.useState(false);
  const savingRef = reactExports.useRef(false);
  const [pickerOpen, setPickerOpen] = reactExports.useState(null);
  const [searchTerm, setSearchTerm] = reactExports.useState("");
  function updateEntry(idx, field, value) {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }
  function updateSet(entryIdx, setIdx, field, value) {
    setEntries((prev) => prev.map((e, i) => {
      if (i !== entryIdx) return e;
      const newSets = e.sets.map((s, si) => si === setIdx ? { ...s, [field]: value } : s);
      return { ...e, sets: newSets };
    }));
  }
  function addSet(entryIdx) {
    setEntries((prev) => prev.map((e, i) => {
      if (i !== entryIdx) return e;
      return { ...e, sets: [...e.sets, { reps: "", weight: "" }] };
    }));
  }
  function removeSet(entryIdx, setIdx) {
    setEntries((prev) => prev.map((e, i) => {
      if (i !== entryIdx) return e;
      if (e.sets.length <= 1) return e;
      return { ...e, sets: e.sets.filter((_, si) => si !== setIdx) };
    }));
  }
  function addExercise() {
    setEntries((prev) => [...prev, emptyEntry()]);
  }
  function removeExercise(idx) {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }
  function selectExercise(entryIdx, key) {
    updateEntry(entryIdx, "exerciseKey", key);
    setPickerOpen(null);
    setSearchTerm("");
  }
  function filteredCategories() {
    if (!searchTerm.trim()) return sortedCategories.map((c) => [c, EXERCISE_GROUPS[c]]);
    const term = searchTerm.toLowerCase();
    return sortedCategories.map((c) => [c, EXERCISE_GROUPS[c].filter((ex) => ex.name.toLowerCase().includes(term))]).filter(([, exs]) => exs.length > 0);
  }
  const canSave = entries.some(
    (e) => e.exerciseKey && e.sets.some((s) => s.reps && parseInt(s.reps) > 0)
  );
  async function handleSave() {
    if (!canSave || saving || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      for (const entry of entries) {
        if (!entry.exerciseKey) continue;
        const exData = EXERCISES[entry.exerciseKey];
        for (const set of entry.sets) {
          const reps = parseInt(set.reps);
          if (!reps || reps <= 0) continue;
          const weight = parseFloat(set.weight) || 0;
          await saveWorkout({
            exercise: entry.exerciseKey,
            exerciseName: exData?.name || entry.exerciseKey,
            reps,
            weight,
            formScore: null,
            duration: 0,
            source: "manual",
            date: now
          });
        }
      }
      logEvent("session_complete", { exercise: entries[0]?.exerciseKey, reps: entries.reduce((s, e) => s + e.sets.reduce((ss, set) => ss + (parseInt(set.reps) || 0), 0), 0), source: "manual" });
      setSaved(true);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      console.error("Failed to save workout:", err);
    }
    setSaving(false);
    savingRef.current = false;
  }
  if (saved) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "page", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 20px",
      gap: 12
    }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { fontSize: "2rem", color: "var(--accent)" }, children: t("saved") }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted", children: t("workout_saved") })
    ] }) });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "page", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "page-header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: t("log_workout") }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-ghost btn-sm", onClick: onClose, children: t("close") })
    ] }),
    entries.map((entry, entryIdx) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "card", style: { marginBottom: 12, padding: 14 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "btn btn-ghost",
            style: {
              flex: 1,
              textAlign: "left",
              minHeight: 44,
              color: entry.exerciseKey ? "#fff" : "var(--muted)",
              fontWeight: entry.exerciseKey ? 700 : 400,
              fontSize: "0.88rem",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 12px"
            },
            onClick: () => {
              setPickerOpen(pickerOpen === entryIdx ? null : entryIdx);
              setSearchTerm("");
            },
            children: entry.exerciseKey ? tExercise(entry.exerciseKey, EXERCISES[entry.exerciseKey]?.name) : t("select_exercise")
          }
        ),
        entries.length > 1 && /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "btn btn-ghost btn-sm",
            style: { color: "var(--red)", marginLeft: 8, minWidth: 44, minHeight: 44 },
            onClick: () => removeExercise(entryIdx),
            children: "X"
          }
        )
      ] }),
      pickerOpen === entryIdx && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
        background: "var(--card-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        maxHeight: 280,
        overflowY: "auto",
        marginBottom: 10
      }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { padding: "8px 10px", position: "sticky", top: 0, background: "var(--card-elevated)", zIndex: 1 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            type: "text",
            placeholder: t("search_exercises"),
            value: searchTerm,
            onChange: (e) => setSearchTerm(e.target.value),
            style: {
              width: "100%",
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: "0.82rem",
              outline: "none"
            },
            autoFocus: true
          }
        ) }),
        filteredCategories().map(([cat, exercises]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: {
            padding: "6px 12px",
            fontSize: "0.68rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: "var(--muted)",
            background: "var(--card)"
          }, children: getCategoryLabel(cat, t) }),
          exercises.map((ex) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => selectExercise(entryIdx, ex.key),
              style: {
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                background: entry.exerciseKey === ex.key ? "var(--accent-glow)" : "transparent",
                color: entry.exerciseKey === ex.key ? "var(--accent)" : "var(--text)",
                border: "none",
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
                fontSize: "0.82rem",
                minHeight: 44
              },
              children: tExercise(ex.key, ex.name)
            },
            ex.key
          ))
        ] }, cat)),
        filteredCategories().length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted", style: { padding: 16, textAlign: "center" }, children: t("no_exercises_found") })
      ] }),
      entry.exerciseKey && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
          display: "grid",
          gridTemplateColumns: "36px 1fr 1fr 44px",
          gap: 6,
          alignItems: "center",
          marginBottom: 6
        }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted", style: { textAlign: "center" }, children: t("set") }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted", children: t("reps") }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted", children: t("weight_kg_short") }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", {})
        ] }),
        entry.sets.map((set, setIdx) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "36px 1fr 1fr 44px",
              gap: 6,
              alignItems: "center",
              marginBottom: 4
            },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm", style: { textAlign: "center", color: "var(--muted)" }, children: setIdx + 1 }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "input",
                {
                  type: "number",
                  inputMode: "numeric",
                  min: "0",
                  placeholder: "0",
                  value: set.reps,
                  onChange: (e) => updateSet(entryIdx, setIdx, "reps", e.target.value),
                  style: {
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    fontSize: "0.88rem",
                    minHeight: 44,
                    width: "100%"
                  }
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "input",
                {
                  type: "number",
                  inputMode: "decimal",
                  min: "0",
                  step: "0.5",
                  placeholder: "0",
                  value: set.weight,
                  onChange: (e) => updateSet(entryIdx, setIdx, "weight", e.target.value),
                  style: {
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    fontSize: "0.88rem",
                    minHeight: 44,
                    width: "100%"
                  }
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  className: "btn btn-ghost btn-sm",
                  style: { color: "var(--muted)", minWidth: 44, minHeight: 44 },
                  onClick: () => removeSet(entryIdx, setIdx),
                  disabled: entry.sets.length <= 1,
                  children: "-"
                }
              )
            ]
          },
          setIdx
        )),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            className: "btn btn-ghost btn-sm",
            style: { marginTop: 6, fontSize: "0.78rem", minHeight: 44 },
            onClick: () => addSet(entryIdx),
            children: t("add_set")
          }
        )
      ] })
    ] }, entryIdx)),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        className: "btn btn-ghost",
        style: { width: "100%", marginBottom: 16, minHeight: 44 },
        onClick: addExercise,
        children: t("add_exercise")
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        className: "btn btn-primary",
        style: { width: "100%", minHeight: 48, fontSize: "0.95rem", fontWeight: 700 },
        onClick: handleSave,
        disabled: !canSave || saving,
        children: saving ? t("saving") : t("log_workout")
      }
    )
  ] });
}
export {
  ManualLog as default
};
