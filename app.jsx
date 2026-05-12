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

function App() {
  // ----- core state
  const [lang, setLang] = useState_A("tr");
  const [presetKey, setPresetKey] = useState_A("balanced");
  const [form, setForm] = useState_A({ ...PRESETS.balanced });
  const [selectedAssets, setSelectedAssets] = useState_A([...PRESETS.balanced.assets]);
  const [supportedAssets, setSupportedAssets] = useState_A(window.SUPPORTED_ASSETS || []);
  const [assetInfo, setAssetInfo] = useState_A({});
  const [allAssetData, setAllAssetData] = useState_A({});

  const [view, setView] = useState_A("setup"); // "setup" | "results"
  const [result, setResult] = useState_A(null);
  const [loading, setLoading] = useState_A(false);
  const [error, setError] = useState_A("");

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
      const res = runProjection(input);
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
      </div>

      {view === "setup" && (
        <div data-screen-label="01 Setup">
          <PresetPicker activeKey={presetKey} onPick={pickPreset} t={t} />

          <FormTabs
            form={form}
            setForm={setForm}
            assetInfo={fullAssetInfo}
            supportedAssets={supportedAssets}
            selectedAssets={selectedAssets}
            setSelectedAssets={setSelectedAssets}
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
          </div>
        </div>
      )}

      <p className="footnote">{t("footer")}</p>

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
