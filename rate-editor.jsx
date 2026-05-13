// =============================================================
// YearlyRateEditor — per-year bar editor with drag, presets,
// and "preserve average" lock. Used for USD growth (and easily
// reused for inflation/salary/rent later).
// =============================================================

const { useState: useState_RE, useRef: useRef_RE, useEffect: useEffect_RE } = React;

// ---------- presets ----------

function rebalanceToAverage(arr, target) {
  if (!arr.length) return arr;
  const current = arr.reduce((s, x) => s + x, 0) / arr.length;
  const diff = target - current;
  return arr.map((x) => x + diff);
}

const PATTERN_FNS = {
  flat: (n, avg) => Array(n).fill(avg),
  front: (n, avg) => {
    if (n <= 1) return [avg];
    const arr = Array.from({ length: n }, (_, i) =>
      avg + Math.abs(avg) * 0.6 * (1 - (2 * i) / (n - 1))
    );
    return rebalanceToAverage(arr, avg);
  },
  back: (n, avg) => {
    if (n <= 1) return [avg];
    const arr = Array.from({ length: n }, (_, i) =>
      avg - Math.abs(avg) * 0.6 * (1 - (2 * i) / (n - 1))
    );
    return rebalanceToAverage(arr, avg);
  },
  vshape: (n, avg) => {
    if (n <= 1) return [avg];
    const mid = (n - 1) / 2;
    const arr = Array.from({ length: n }, (_, i) =>
      avg + (Math.abs(i - mid) / mid) * Math.abs(avg) * 0.5
    );
    return rebalanceToAverage(arr, avg);
  },
  random: (n, avg) => {
    // Each year is sampled uniformly within ±30% of the target average,
    // then the whole array is shifted by a constant so the arithmetic mean
    // lands on avg exactly. The user's target rate stays intact; the
    // year-to-year shape is genuinely random.
    if (n <= 1) return [avg];
    const arr = Array.from({ length: n }, () =>
      avg + (Math.random() - 0.5) * 2 * Math.abs(avg) * 0.3
    );
    return rebalanceToAverage(arr, avg);
  },
};

// Round to 0.5 to keep numbers tidy when dragging
function snap(v) { return Math.round(v * 2) / 2; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---------- single bar column ----------

function BarColumn({ value, top, year, color, unit, onChange, min, max }) {
  const barRef = useRef_RE(null);
  const [editing, setEditing] = useState_RE(false);
  const [draft, setDraft] = useState_RE(String(value));
  const [hover, setHover] = useState_RE(false);
  useEffect_RE(() => { if (!editing) setDraft(String(value)); }, [value, editing]);

  // Pointer-driven drag. We track movement on window so drags continue
  // outside the bar. Threshold prevents accidental drag on simple click.
  const handlePointerDown = (e) => {
    if (editing) return;
    if (e.target.closest(".bar-value-btn")) return;
    e.preventDefault();
    const rect = barRef.current.getBoundingClientRect();
    const startY = e.clientY;
    let dragged = false;
    const moveTo = (clientY) => {
      const yFromTop = clientY - rect.top;
      const midY = rect.height / 2;
      const raw = ((midY - yFromTop) / midY) * top;
      onChange(snap(clamp(raw, min, max)));
    };
    const onMove = (ev) => {
      if (!dragged && Math.abs(ev.clientY - startY) < 3) return;
      dragged = true;
      moveTo(ev.clientY);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Map value to a position relative to the zero line
  const pct = clamp(Math.abs(value) / top, 0, 1) * 50; // each half is 50%
  const isPos = value >= 0;

  const onArrow = (e) => {
    const step = e.shiftKey ? 5 : 1;
    if (e.key === "ArrowUp") { e.preventDefault(); onChange(snap(clamp(value + step, min, max))); }
    if (e.key === "ArrowDown") { e.preventDefault(); onChange(snap(clamp(value - step, min, max))); }
  };

  return (
    <div className="bar-col">
      <div
        ref={barRef}
        className={`bar-area ${hover ? "is-hover" : ""}`}
        onPointerDown={handlePointerDown}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        tabIndex={0}
        onKeyDown={onArrow}
        role="slider"
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={`Y${year}`}
      >
        <span className="bar-zero" aria-hidden="true"></span>
        {[25, 50, 75].map((p) => (
          <span key={p} className="bar-grid" style={{ top: `${p}%` }} aria-hidden="true"></span>
        ))}
        <span
          className={`bar-fill ${isPos ? "pos" : "neg"}`}
          style={{
            height: `${pct}%`,
            top: isPos ? `${50 - pct}%` : "50%",
            background: color,
          }}
        ></span>
        <span
          className="bar-handle"
          style={{
            top: `calc(${50 - (isPos ? pct : -pct)}% - 4px)`,
            background: color,
          }}
        ></span>
      </div>
      <div className="bar-foot">
        {editing ? (
          <input
            type="number"
            step="0.5"
            className="bar-value-input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const v = parseFloat(draft);
              onChange(isNaN(v) ? value : snap(clamp(v, min, max)));
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
              if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
            }}
          />
        ) : (
          <button
            type="button"
            className="bar-value-btn"
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title="Tıkla — düzenle"
          >
            {value > 0 ? "+" : ""}{value.toFixed(1)}{unit}
          </button>
        )}
        <div className="bar-year">Y{year}</div>
      </div>
    </div>
  );
}

// ---------- editor ----------

function YearlyRateEditor({
  years,
  values,
  setValues,
  targetAvg,
  lockAvg,
  setLockAvg,
  onMatchTarget,   // when avg drifts, allow "snap to target avg"
  unit = "%",
  min = -50,
  max = 100,
  color = "var(--accent)",
  t,
}) {
  // sync length when years change
  useEffect_RE(() => {
    if (!Array.isArray(values)) return;
    if (values.length === years) return;
    if (values.length < years) {
      const filler = values.length ? values[values.length - 1] : targetAvg;
      setValues([...values, ...Array(years - values.length).fill(filler)]);
    } else {
      setValues(values.slice(0, years));
    }
  }, [years, values, setValues, targetAvg]);

  if (!Array.isArray(values) || values.length === 0) return null;

  const sum = values.reduce((s, x) => s + x, 0);
  const avg = sum / values.length;
  const drift = avg - targetAvg;
  const onTarget = Math.abs(drift) < 0.06;

  // Compute display range: at least target × 1.4 or actual extremes
  const maxAbs = Math.max(
    Math.abs(targetAvg) * 1.5,
    ...values.map((v) => Math.abs(v))
  );
  const top = Math.max(5, Math.ceil(maxAbs / 5) * 5);

  // Compound (geometric) average for hint
  const compound = values.reduce((p, x) => p * (1 + x / 100), 1);
  const compoundAvg = (Math.pow(compound, 1 / values.length) - 1) * 100;

  const setOne = (i, v) => {
    const old = values[i];
    if (v === old) return;
    const next = values.slice();
    next[i] = v;
    if (lockAvg && values.length > 1) {
      const others = values.length - 1;
      const delta = v - old;
      // First pass: redistribute equally, then re-balance any clipped values
      let remainder = 0;
      for (let j = 0; j < next.length; j++) {
        if (j === i) continue;
        const want = next[j] - delta / others;
        const c = clamp(want, min, max);
        remainder += want - c;
        next[j] = snap(c);
      }
      // distribute any remainder evenly into non-clipped slots
      if (Math.abs(remainder) > 0.05) {
        for (let pass = 0; pass < 3 && Math.abs(remainder) > 0.05; pass++) {
          const eligible = next
            .map((_, j) => j)
            .filter((j) => j !== i && next[j] > min + 0.5 && next[j] < max - 0.5);
          if (!eligible.length) break;
          const share = remainder / eligible.length;
          for (const j of eligible) {
            const want = next[j] + share;
            const c = clamp(want, min, max);
            remainder -= c - next[j];
            next[j] = snap(c);
          }
        }
      }
    }
    setValues(next);
  };

  const applyPreset = (key) => setValues(PATTERN_FNS[key](years, targetAvg).map(snap));

  return (
    <div className="rate-editor">
      <div className="rate-editor-head">
        <div className="rate-editor-meta">
          <span className={`rate-editor-avg ${onTarget ? "ok" : "off"}`}>
            <span className="rate-editor-avg-label">{t("re_avg")}</span>
            <strong>{avg >= 0 ? "+" : ""}{avg.toFixed(1)}{unit}</strong>
            {onTarget ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : null}
          </span>
          {!onTarget ? (
            <button type="button" className="rate-editor-snap" onClick={onMatchTarget} title={t("re_match_target")}>
              {t("re_target")} {targetAvg.toFixed(1)}{unit} ←
            </button>
          ) : null}
          <span className="rate-editor-compound" title={t("re_compound_help")}>
            {t("re_compound")} <strong>{compoundAvg.toFixed(1)}{unit}</strong>
          </span>
        </div>
        <label className="rate-editor-lock" title={t("re_lock_help")}>
          <input
            type="checkbox"
            checked={lockAvg}
            onChange={(e) => setLockAvg(e.target.checked)}
          />
          <span className="rate-editor-lock-icon" aria-hidden="true">
            {lockAvg ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              </svg>
            )}
          </span>
          {t("re_lock_avg")}
        </label>
      </div>

      <div className="rate-editor-bars" style={{ "--bar-top": top }}>
        {values.map((v, i) => (
          <BarColumn
            key={i}
            value={v}
            top={top}
            year={i + 1}
            color={color}
            unit={unit}
            min={min}
            max={max}
            onChange={(nv) => setOne(i, nv)}
          />
        ))}
      </div>

      <div className="rate-editor-foot">
        <span className="rate-editor-presets-label">{t("re_quick")}</span>
        <div className="rate-editor-presets">
          <button type="button" onClick={() => applyPreset("flat")}>{t("re_p_flat")}</button>
          <button type="button" onClick={() => applyPreset("front")}>{t("re_p_front")}</button>
          <button type="button" onClick={() => applyPreset("back")}>{t("re_p_back")}</button>
          <button type="button" onClick={() => applyPreset("vshape")}>{t("re_p_v")}</button>
          <button type="button" onClick={() => applyPreset("random")} title={t("re_p_random_title")}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px", marginRight: "4px" }}>
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/>
              <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/>
              <circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/>
              <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/>
            </svg>
            {t("re_p_random")}
          </button>
        </div>
        <span className="rate-editor-hint">{t("re_hint")}</span>
      </div>
    </div>
  );
}

window.YearlyRateEditor = YearlyRateEditor;
window.PATTERN_FNS = PATTERN_FNS;
