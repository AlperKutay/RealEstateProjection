// =============================================================
// Real Estate Projection — friendly redesign main App
// =============================================================

const { useState: useState_A, useEffect: useEffect_A, useMemo: useMemo_A, useCallback } = React;

// Default tweakable values (in /*EDITMODE-BEGIN*/ block for host persistence)
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accent": "#c8703f",
  "showVerdict": true
}/*EDITMODE-END*/;

// Accent palette options (hex → CSS variables)
const ACCENT_PRESETS = {
  "#c8703f": { name: "Terracotta", hi: "#d8895c", lo: "#f7ede1", loDark: "#3d2a1d" },
  "#b8503b": { name: "Brick",      hi: "#cd6c54", lo: "#f8e6df", loDark: "#3e231b" },
  "#3a72b5": { name: "Slate blue", hi: "#5a8fcc", lo: "#e3edf7", loDark: "#1d2e3f" },
  "#2f8a5a": { name: "Forest",     hi: "#4ea876", lo: "#e0f0e6", loDark: "#1c2f24" },
  "#6e5fbd": { name: "Indigo",     hi: "#8d7fd1", lo: "#ece9f6", loDark: "#2a2540" },
};

// ----- Shareable URL state -----
// Pack the bits of state that describe a scenario into the URL hash so the
// user can copy the address and someone else opening it sees the same form.
// Hash prefix is versioned ("s1=") — if the schema ever changes we can branch
// on the prefix without breaking links in circulation.
function encodeState({ form, selectedAssets, lang }) {
  try {
    const payload = { form, selectedAssets, lang };
    // encodeURIComponent first so non-Latin-1 chars survive btoa.
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    return "s1=" + enc;
  } catch (_) { return null; }
}
function decodeState(hash) {
  if (!hash) return null;
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean.startsWith("s1=")) return null;
  try {
    const json = decodeURIComponent(escape(atob(clean.slice(3))));
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== "object" || !obj.form) return null;
    return obj;
  } catch (_) { return null; }
}

function App() {
  // ----- core state
  // Try to hydrate from the URL hash on first mount. If someone shared a link
  // like ".../#s1=...", their form + selected assets + language drop straight
  // into our initial state — no flash of default values.
  const _hashInit = typeof window !== "undefined" ? decodeState(window.location.hash) : null;
  const _initialForm = _hashInit && _hashInit.form
    ? { ...PRESETS.balanced, ..._hashInit.form }
    : { ...PRESETS.balanced };
  const _initialAssets = _hashInit && Array.isArray(_hashInit.selectedAssets)
    ? _hashInit.selectedAssets
    : [...PRESETS.balanced.assets];
  const _initialLang = _hashInit && (_hashInit.lang === "tr" || _hashInit.lang === "en")
    ? _hashInit.lang
    : "tr";
  const [lang, setLang] = useState_A(_initialLang);
  const [presetKey, setPresetKey] = useState_A(_hashInit ? "custom" : "balanced");
  const [form, setForm] = useState_A(_initialForm);
  const [selectedAssets, setSelectedAssets] = useState_A(_initialAssets);
  const [supportedAssets, setSupportedAssets] = useState_A(window.SUPPORTED_ASSETS || []);
  const [assetInfo, setAssetInfo] = useState_A({});
  const [allAssetData, setAllAssetData] = useState_A({});

  const [view, setView] = useState_A("setup"); // "setup" | "results" | "compare"
  const [result, setResult] = useState_A(null);
  const [loading, setLoading] = useState_A(false);
  const [error, setError] = useState_A("");

  // scenarios (saved + comparison)
  const { scenarios, add: addScn, update: updateScn, remove: removeScn } = window.useScenarios();
  const [activeScnId, setActiveScnId] = useState_A(null); // id of currently loaded scenario
  const [draftDirty, setDraftDirty] = useState_A(false);
  const [toast, setToast] = useState_A("");
  const [reportBusy, setReportBusy] = useState_A(false);

  // tweaks (useTweaks is provided by tweaks-panel.jsx which loads before this file)
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  // theme + accent
  useEffect_A(() => {
    const isDarkT = tweaks.theme === "dark";
    document.documentElement.setAttribute("data-theme", isDarkT ? "dark" : "light");
    const acc = tweaks.accent || "#c8703f";
    const preset = ACCENT_PRESETS[acc] || ACCENT_PRESETS["#c8703f"];
    document.documentElement.style.setProperty("--accent", acc);
    document.documentElement.style.setProperty("--accent-hi", preset.hi);
    document.documentElement.style.setProperty("--accent-lo", isDarkT ? preset.loDark : preset.lo);
  }, [tweaks.theme, tweaks.accent]);

  const isDark = tweaks.theme === "dark";

  // load assets.json
  useEffect_A(() => {
    fetch("assets.json")
      .then((r) => r.json())
      .then((j) => {
        setSupportedAssets(j.supported_assets || []);
        setAllAssetData(j.data || {});
      })
      .catch(() => setError("assets.json yüklenemedi"));
  }, []);

  // when selected assets change, pull their info
  useEffect_A(() => {
    const info = {};
    for (const sym of selectedAssets) {
      if (allAssetData[sym]) info[sym] = allAssetData[sym];
    }
    setAssetInfo(info);
  }, [selectedAssets, allAssetData]);

  // also fill assetInfo for all so we can show growth on chips
  const fullAssetInfo = useMemo_A(() => {
    const out = {};
    for (const sym of supportedAssets) if (allAssetData[sym]) out[sym] = allAssetData[sym];
    return out;
  }, [supportedAssets, allAssetData]);

  // translate helper
  const t = useCallback((k) => (I18N[lang] && I18N[lang][k]) || k, [lang]);
  window.tFor = t;

  // preset pick
  const pickPreset = (k) => {
    setPresetKey(k);
    const p = PRESETS[k];
    const { assets, ...rest } = p;
    setForm({ ...rest });
    setSelectedAssets([...assets]);
    setActiveScnId(null);
    setDraftDirty(false);
  };

  // when form / selected assets change after loading a scenario, mark dirty
  const markDirty = useCallback(() => {
    if (activeScnId != null) setDraftDirty(true);
  }, [activeScnId]);

  const setFormDirty = useCallback((f) => {
    setForm((prev) => {
      const next = typeof f === "function" ? f(prev) : f;
      if (activeScnId != null) setDraftDirty(true);
      return next;
    });
  }, [activeScnId]);

  const setSelectedAssetsDirty = useCallback((a) => {
    setSelectedAssets((prev) => {
      const next = typeof a === "function" ? a(prev) : a;
      if (activeScnId != null) setDraftDirty(true);
      return next;
    });
  }, [activeScnId]);

  // toast helper
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  };

  // ----- URL hash sync -----
  // Whenever form / selected assets / language change, write a fresh,
  // base64-encoded snapshot into the URL hash (debounced so we don't thrash
  // history while the user types). history.replaceState keeps the back
  // button from filling up with every keystroke.
  useEffect_A(() => {
    const id = setTimeout(() => {
      const enc = encodeState({ form, selectedAssets, lang });
      if (!enc) return;
      try {
        const next = window.location.pathname + window.location.search + "#" + enc;
        window.history.replaceState(null, "", next);
      } catch (_) {}
    }, 300);
    return () => clearTimeout(id);
  }, [form, selectedAssets, lang]);

  const handleShareLink = async () => {
    const enc = encodeState({ form, selectedAssets, lang });
    const url = enc
      ? `${window.location.origin}${window.location.pathname}#${enc}`
      : window.location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        showToast(t("share_copied"));
      } else {
        // Last-ditch fallback for browsers that don't expose the modern API.
        const ta = document.createElement("textarea");
        ta.value = url; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); showToast(t("share_copied")); }
        catch (_) { showToast(t("share_failed")); }
        finally { ta.remove(); }
      }
    } catch (_) {
      showToast(t("share_failed"));
    }
  };

  // ---- scenario actions ----
  const handleSaveScenario = () => {
    const defaultName = t("scn_save_default_name").replace("{n}", String(scenarios.length + 1));
    const name = (prompt(t("scn_save_prompt"), defaultName) || "").trim();
    if (!name) return;
    const item = addScn({
      name,
      form: { ...form },
      assets: [...selectedAssets],
    });
    setActiveScnId(item.id);
    setDraftDirty(false);
    showToast(t("scn_saved_toast").replace("{n}", name));
  };

  // Save the current draft back to the active scenario (in-place edit), no
  // name prompt. Used when the user loaded a saved scenario, tweaked the
  // form, and wants to update the original.
  const handleUpdateScenario = () => {
    if (activeScnId == null) return;
    const target = scenarios.find((s) => s.id === activeScnId);
    if (!target) return;
    updateScn(activeScnId, {
      form: { ...form },
      assets: [...selectedAssets],
    });
    setDraftDirty(false);
    showToast(t("scn_updated_toast").replace("{n}", target.name));
  };

  const handleLoadScenario = (scn) => {
    setForm({ ...scn.form });
    setSelectedAssets([...(scn.assets || [])]);
    setActiveScnId(scn.id);
    setDraftDirty(false);
    showToast(t("scn_loaded_toast").replace("{n}", scn.name));
    // auto-run when loading
    setTimeout(() => {
      try {
        const input = { ...scn.form, assets: {} };
        for (const sym of scn.assets || []) {
          if (allAssetData[sym]) {
            input.assets[sym] = {
              average_growth: allAssetData[sym].average_growth,
              current_price: allAssetData[sym].current_price,
            };
          }
        }
        const useMonteCarlo = input.generate_random
          && input.monte_carlo !== false
          && typeof runMonteCarlo === "function";
        const res = useMonteCarlo ? runMonteCarlo(input) : runProjection(input);
        setResult(res);
        setView("results");
      } catch (e) { console.warn(e); }
    }, 0);
  };

  const handleRenameScenario = (id, name) => updateScn(id, { name });
  const handleDeleteScenario = (id) => {
    removeScn(id);
    if (activeScnId === id) { setActiveScnId(null); setDraftDirty(false); }
  };

  // run
  const runIt = () => {
    setLoading(true);
    setError("");
    try {
      const input = { ...form };
      input.assets = {};
      for (const sym of selectedAssets) {
        if (allAssetData[sym]) {
          input.assets[sym] = {
            average_growth: allAssetData[sym].average_growth,
            current_price: allAssetData[sym].current_price,
          };
        }
      }
      const useMonteCarlo = input.generate_random
        && input.monte_carlo !== false
        && typeof runMonteCarlo === "function";
      const res = useMonteCarlo ? runMonteCarlo(input) : runProjection(input);
      setResult(res);
      setView("results");
      // scroll to top of results
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
    } catch (e) {
      console.error(e);
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const saveChart = () => {
    const cv = document.querySelector(".chart-wrap canvas");
    if (!cv) return;
    const tmp = document.createElement("canvas");
    tmp.width = cv.width;
    tmp.height = cv.height;
    const ctx = tmp.getContext("2d");
    ctx.fillStyle = isDark ? "#1f1d1a" : "#fcfaf6";
    ctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(cv, 0, 0);
    const a = document.createElement("a");
    a.href = tmp.toDataURL("image/png");
    a.download = "projection-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".png";
    a.click();
  };

  // Dump every yearly-resolution series to a CSV — one row per year, one
  // column per result field whose array length matches the yearly axis.
  // BOM prefix so Excel reads the UTF-8 column names correctly.
  const downloadCSV = () => {
    if (!result || !result.years_axis) return;
    const n = result.years_axis.length;
    if (!n) return;
    const cols = [];
    for (const [k, v] of Object.entries(result)) {
      if (Array.isArray(v) && v.length === n && typeof v[0] === "number") {
        cols.push([k, v]);
      }
    }
    cols.sort((a, b) => a[0].localeCompare(b[0]));
    const lines = [["year", ...cols.map((c) => c[0])].join(",")];
    for (let i = 0; i < n; i++) {
      const row = [result.years_axis[i]];
      for (const [, arr] of cols) {
        const x = arr[i];
        row.push(x == null || !isFinite(x) ? "" : x);
      }
      lines.push(row.join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "projection-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(t("csv_downloaded"));
  };

  const activeScenarioName = useMemo_A(() => {
    if (activeScnId == null) return null;
    const s = scenarios.find((x) => x.id === activeScnId);
    return s ? s.name : null;
  }, [activeScnId, scenarios]);

  const handleGenerateSingleReport = async (chartKeys) => {
    if (!result || !window.generateSingleReport) return;
    setReportBusy(true);
    try {
      await window.generateSingleReport({
        result,
        form,
        lang,
        t,
        scenarioName: activeScenarioName,
        allAssetData,
        chartKeys,
      });
    } finally {
      // small grace so user sees the spinner briefly even if pop-up opens fast
      setTimeout(() => setReportBusy(false), 600);
    }
  };

  // ---------- UI ----------
  const hasSalary = form.start_salary_base > 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">₺</div>
          <div className="brand-text">
            {t("brand_name")}
            <small>{t("brand_sub")}</small>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="lang-toggle">
            <button className={lang === "tr" ? "active" : ""} onClick={() => setLang("tr")}>TR</button>
            <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
          <button
            className="icon-btn"
            title={t("share_tooltip")}
            onClick={handleShareLink}
            aria-label={t("share_button")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
          <button
            className="icon-btn"
            title={isDark ? "Light" : "Dark"}
            onClick={() => setTweak({ theme: isDark ? "light" : "dark" })}
          >
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      <div className="hero">
        <h1>
          {t("hero_title_a")} <em>{t("hero_title_b")}</em>
        </h1>
        <p>{t("hero_p")}</p>
      </div>

      <div className="steps">
        <button className={`step ${view === "setup" ? "active" : "done"}`} onClick={() => setView("setup")}>
          <span className="step-num">1</span>{t("step1")} & {t("step2")}
        </button>
        <span className="step-divider">→</span>
        <button
          className={`step ${view === "results" ? "active" : !result ? "" : "done"}`}
          onClick={() => result && setView("results")}
          disabled={!result}
          style={!result ? { opacity: 0.55, cursor: "not-allowed" } : {}}
        >
          <span className="step-num">2</span>{t("step3")}
        </button>
        <span className="step-divider">→</span>
        <button
          className={`step ${view === "compare" ? "active" : (scenarios.length >= 1 ? "done" : "")}`}
          onClick={() => scenarios.length >= 1 && setView("compare")}
          disabled={scenarios.length < 1}
          style={scenarios.length < 1 ? { opacity: 0.55, cursor: "not-allowed" } : {}}
        >
          <span className="step-num">3</span>{t("step_compare")}
          {scenarios.length > 0 ? <span className="step-badge">{scenarios.length}</span> : null}
        </button>
      </div>

      {/* Scenarios bar — visible on setup + results */}
      {view !== "compare" && window.ScenarioBar ? (
        <window.ScenarioBar
          scenarios={scenarios}
          activeId={activeScnId}
          draftDirty={draftDirty}
          hasResult={!!result}
          onLoad={handleLoadScenario}
          onSave={handleSaveScenario}
          onUpdate={handleUpdateScenario}
          onRename={handleRenameScenario}
          onDelete={handleDeleteScenario}
          onOpenCompare={() => setView("compare")}
          t={t}
        />
      ) : null}

      {view === "setup" && (
        <div data-screen-label="01 Setup">
          <PresetPicker activeKey={presetKey} onPick={pickPreset} t={t} />

          <FormTabs
            form={form}
            setForm={setFormDirty}
            assetInfo={fullAssetInfo}
            supportedAssets={supportedAssets}
            selectedAssets={selectedAssets}
            setSelectedAssets={setSelectedAssetsDirty}
            t={t}
          />

          <div className="action-row">
            <button className="btn btn-primary" onClick={runIt} disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner"></span>
                  {t("calculating")}…
                </>
              ) : (
                <>
                  {t("generate")}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </button>
            {error ? <span className="error">{error}</span> : null}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-mute)" }}>
              <span className="kbd">Enter</span> {lang === "tr" ? "ile hesapla" : "to calculate"}
            </span>
          </div>
        </div>
      )}

      {view === "compare" && window.CompareView ? (
        <window.CompareView
          scenarios={scenarios}
          allAssetData={allAssetData}
          t={t}
          lang={lang}
          isDark={isDark}
          onClose={() => setView(result ? "results" : "setup")}
        />
      ) : null}

      {view === "results" && result && (
        <div data-screen-label="02 Results" className="results">
          <InsightCards result={result} form={form} t={t} lang={lang} />

          {tweaks.showVerdict !== false ? <Verdict result={result} t={t} /> : null}

          <ChartPanel
            result={result}
            form={form}
            t={t}
            lang={lang}
            hasSalary={hasSalary}
            isDark={isDark}
            onSave={saveChart}
          />

          <Details result={result} form={form} t={t} />

          <div className="action-row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => setView("setup")}>
              ← {t("edit")}
            </button>
            <button className="btn btn-ghost" onClick={handleSaveScenario}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              {t("scn_save_current")}
            </button>
            <button className="btn btn-ghost" onClick={downloadCSV} title={t("csv_tooltip")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/>
                <line x1="8" y1="17" x2="16" y2="17"/>
              </svg>
              {t("csv_button")}
            </button>
            {window.ReportLauncher ? (
              <window.ReportLauncher
                kind="single"
                onGenerate={handleGenerateSingleReport}
                busy={reportBusy}
                variant={scenarios.length >= 1 ? "ghost" : "primary"}
                t={t}
                lang={lang}
              />
            ) : window.ReportButton ? (
              <window.ReportButton
                onClick={() => handleGenerateSingleReport()}
                label={reportBusy ? t("rpt_busy") : t("rpt_button")}
                busy={reportBusy}
                variant={scenarios.length >= 1 ? "ghost" : "primary"}
              />
            ) : null}
            {scenarios.length >= 1 ? (
              <button className="btn btn-primary" onClick={() => setView("compare")}>
                {t("scn_compare")}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      )}

      <p className="footnote">{t("footer")}</p>

      {/* Toast */}
      {toast ? <div className="toast">{toast}</div> : null}

      {/* Tweaks panel */}
      {window.TweaksPanel ? (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label={lang === "tr" ? "Tema" : "Theme"}>
            <window.TweakRadio
              label={lang === "tr" ? "Görünüm" : "Mode"}
              value={tweaks.theme}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              onChange={(v) => setTweak({ theme: v })}
            />
          </window.TweakSection>
          <window.TweakSection label={lang === "tr" ? "Vurgu rengi" : "Accent"}>
            <window.TweakColor
              label={lang === "tr" ? "Renk" : "Color"}
              value={tweaks.accent}
              options={Object.keys(ACCENT_PRESETS)}
              onChange={(v) => setTweak({ accent: v })}
            />
          </window.TweakSection>
          <window.TweakSection label={lang === "tr" ? "Sonuç ekranı" : "Results"}>
            <window.TweakToggle
              label={lang === "tr" ? "Karar kartını göster" : "Show verdict card"}
              value={tweaks.showVerdict !== false}
              onChange={(v) => setTweak({ showVerdict: v })}
            />
          </window.TweakSection>
        </window.TweaksPanel>
      ) : null}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
