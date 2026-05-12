// =============================================================
// Setup screen — preset picker + tabbed form with tooltips
// =============================================================

const { useState } = React;

function HelpIcon({ text }) {
  return (
    <span className="help" tabIndex={0}>
      ?
      <span className="help-tip">{text}</span>
    </span>
  );
}
window.HelpIcon = HelpIcon;

function Field({ label, helpText, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">
        {label}
        {helpText ? <HelpIcon text={helpText} /> : null}
      </span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

function NumInput({ value, onChange, step = 1, min, max, unit }) {
  return (
    <div className="input-wrap">
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? 0 : parseFloat(v));
        }}
      />
      {unit ? <span className="unit">{unit}</span> : null}
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <div className="input-wrap">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleCard({ on, onChange, title, sub }) {
  return (
    <button type="button" className={`toggle ${on ? "on" : ""}`} onClick={() => onChange(!on)}>
      <span className="toggle-check">
        {on ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6.2L5 8.7L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : null}
      </span>
      <span className="toggle-body">
        <span className="toggle-title">{title}</span>
        {sub ? <span className="toggle-sub">{sub}</span> : null}
      </span>
    </button>
  );
}

function AssetChip({ sym, on, onChange, growth }) {
  return (
    <button type="button" className={`chip ${on ? "on" : ""}`} onClick={() => onChange(!on)}>
      <span className="chip-mark">
        {on ? (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4.2L3.3 6L6.5 2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : null}
      </span>
      <span style={{ fontWeight: 500 }}>{sym}</span>
      {growth != null ? <span className="chip-pct">{growth.toFixed(1)}%</span> : null}
    </button>
  );
}

// =============================================================
function PresetPicker({ activeKey, onPick, t }) {
  const keys = ["balanced", "conservative", "optimistic", "custom"];
  const tlFmt = (n) => "₺" + (n / 1_000_000).toFixed(n >= 1_000_000 ? 1 : 2) + "M";
  return (
    <div>
      <div className="hero" style={{ marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 20, letterSpacing: "-0.015em" }}>{t("presets_title")}</h3>
        <p style={{ margin: "4px 0 0", color: "var(--ink-soft)", fontSize: 14 }}>{t("presets_sub")}</p>
      </div>
      <div className="presets">
        {keys.map((k) => {
          const p = PRESETS[k];
          const meta = PRESET_META[k];
          return (
            <button
              key={k}
              type="button"
              className={`preset ${activeKey === k ? "active" : ""}`}
              onClick={() => onPick(k)}
              style={{ "--accent-tone": meta.hue }}
            >
              <span className="preset-icon">{meta.icon}</span>
              <h3>{t(`preset_${k}`)}</h3>
              <p>{t(`preset_${k}_sub`)}</p>
              <div className="preset-meta">
                <span>{p.years}{t("f_years_unit")}</span>
                <span>·</span>
                <span>{tlFmt(p.value_of_house_tl)}</span>
                <span>·</span>
                <span>{p.turkey_inflation}% TR</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
window.PresetPicker = PresetPicker;

// =============================================================
function FormTabs({ form, setForm, assetInfo, supportedAssets, selectedAssets, setSelectedAssets, t }) {
  const [tab, setTab] = useState("house");

  const setF = (patch) => setForm({ ...form, ...patch });
  const houseM = form.value_of_house_tl / 1_000_000;
  const downM = form.initial_noncredit_amount_tl / 1_000_000;
  const loan = form.value_of_house_tl - form.initial_noncredit_amount_tl;

  const tabs = [
    { id: "house", label: t("tab_house"), icon: "1" },
    { id: "macro", label: t("tab_macro"), icon: "2" },
    { id: "life", label: t("tab_life"), icon: "3" },
    { id: "costs", label: t("tab_costs"), icon: "4" },
    { id: "assets", label: t("tab_assets"), icon: "5" },
    { id: "advanced", label: t("tab_advanced"), icon: "6" },
  ];

  const fmtTL = (n) => n.toLocaleString("tr-TR") + " ₺";

  return (
    <div className="card card-pad">
      <div className="tabs">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            className={`tab ${tab === tb.id ? "active" : ""}`}
            onClick={() => setTab(tb.id)}
          >
            <span className="tab-icon">{tb.icon}</span>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "house" && (
        <div>
          <p className="section-label">{t("group_house")}</p>
          <div className="fields">
            <Field label={t("f_value")} helpText={t("f_value_help")} hint={<><strong>{fmtTL(form.value_of_house_tl)}</strong></>}>
              <NumInput value={houseM} step={0.05} min={0.1} unit={t("f_value_unit")}
                onChange={(v) => setF({ value_of_house_tl: Math.round(v * 1_000_000) })} />
            </Field>
            <Field label={t("f_down")} helpText={t("f_down_help")} hint={<><strong>{fmtTL(form.initial_noncredit_amount_tl)}</strong></>}>
              <NumInput value={downM} step={0.05} min={0} unit={t("f_down_unit")}
                onChange={(v) => setF({ initial_noncredit_amount_tl: Math.round(v * 1_000_000) })} />
            </Field>
            <Field label={t("f_loan_amount")} hint={<>≈ {(loan / form.start_dollar_tl).toLocaleString("en-US", { maximumFractionDigits: 0 })} USD</>}>
              <div className="input-wrap" style={{ background: "var(--surface-2)" }}>
                <input type="text" readOnly value={fmtTL(Math.max(0, loan))} style={{ color: "var(--ink-soft)" }} />
              </div>
            </Field>
            {form.transaction_cost_buy_pct > 0 && (
              <Field label={`+ ${t("f_buy_tx_summary")}`} hint={<>{form.transaction_cost_buy_pct}% × {t("f_value")}</>}>
                <div className="input-wrap" style={{ background: "var(--surface-2)" }}>
                  <input
                    type="text"
                    readOnly
                    value={fmtTL(Math.round(form.value_of_house_tl * form.transaction_cost_buy_pct / 100))}
                    style={{ color: "var(--ink-soft)" }}
                  />
                </div>
              </Field>
            )}
          </div>

          <p className="section-label" style={{ marginTop: 22 }}>{t("group_loan")}</p>
          <div className="fields">
            <Field label={t("f_years")} helpText={t("f_years_help")}>
              <NumInput value={form.years} step={1} min={1} max={30} unit={t("f_years_unit")}
                onChange={(v) => setF({ years: Math.round(v) })} />
            </Field>
            <Field label={t("f_interest")} helpText={t("f_interest_help")}>
              <NumInput value={form.interest_rate} step={0.01} min={0} unit={t("f_interest_unit")}
                onChange={(v) => setF({ interest_rate: v })} />
            </Field>
          </div>
        </div>
      )}

      {tab === "macro" && (
        <div>
          <p className="section-label">{t("group_macro")}</p>
          <div className="fields">
            <Field label={t("f_start_dollar")} helpText={t("f_start_dollar_help")}>
              <NumInput value={form.start_dollar_tl} step={0.1} min={1} unit={t("f_start_dollar_unit")}
                onChange={(v) => setF({ start_dollar_tl: v })} />
            </Field>
            <Field label={t("f_dollar_growth")} helpText={t("f_dollar_growth_help")}>
              <NumInput value={form.dollar_growth_rate} step={0.5} unit={t("f_dollar_growth_unit")}
                onChange={(v) => setF({ dollar_growth_rate: v })} />
            </Field>
          </div>
          <p className="section-label" style={{ marginTop: 22 }}>{t("group_inflation")}</p>
          <div className="fields">
            <Field label={t("f_tr_inflation")} helpText={t("f_tr_inflation_help")}>
              <NumInput value={form.turkey_inflation} step={0.5} unit={t("f_tr_inflation_unit")}
                onChange={(v) => setF({ turkey_inflation: v })} />
            </Field>
            <Field label={t("f_us_inflation")} helpText={t("f_us_inflation_help")}>
              <NumInput value={form.usa_inflation} step={0.1} unit={t("f_us_inflation_unit")}
                onChange={(v) => setF({ usa_inflation: v })} />
            </Field>
          </div>
        </div>
      )}

      {tab === "life" && (
        <div>
          <p className="section-label">{t("group_rent")}</p>
          <div className="fields">
            <Field label={t("f_rent")} helpText={t("f_rent_help")}>
              <NumInput value={form.initial_monthly_rent_tl} step={500} min={0} unit={t("f_rent_unit")}
                onChange={(v) => setF({ initial_monthly_rent_tl: v })} />
            </Field>
          </div>
          <p className="section-label" style={{ marginTop: 22 }}>{t("group_salary")}</p>
          <div className="fields">
            <Field label={t("f_salary_currency")} helpText={t("f_salary_help")}>
              <Select value={form.salary_currency} onChange={(v) => setF({ salary_currency: v })}
                options={[{ value: "USD", label: "USD ($)" }, { value: "EUR", label: "EUR (€)" }, { value: "TL", label: "TL (₺)" }]} />
            </Field>
            <Field label={t("f_salary_amount")} hint={form.salary_currency === "USD" ? "= " + (form.start_salary_base / 12).toFixed(0) + " $/ay" : ""}>
              <NumInput value={form.start_salary_base} step={1000} min={0}
                unit={form.salary_currency === "TL" ? "₺" : form.salary_currency === "USD" ? "$" : "€"}
                onChange={(v) => setF({ start_salary_base: v })} />
            </Field>
            <Field label={t("f_salary_growth")} helpText={t("f_salary_help")}>
              <NumInput value={form.salary_growth} step={0.5} unit={t("f_salary_growth_unit")}
                onChange={(v) => setF({ salary_growth: v })} />
            </Field>
            {form.salary_currency === "EUR" && (
              <Field label={t("f_eur_usd")}>
                <NumInput value={form.euro_dollar_rate} step={0.01} min={0.1} unit=""
                  onChange={(v) => setF({ euro_dollar_rate: v })} />
              </Field>
            )}
          </div>
        </div>
      )}

      {tab === "costs" && (
        <div>
          <p className="section-label">{t("group_carrying")}</p>
          <div className="fields">
            <Field label={t("f_annual_property_tax_rate")} helpText={t("f_annual_property_tax_rate_help")}>
              <NumInput value={form.annual_property_tax_rate} step={0.05} min={0} unit={t("f_annual_property_tax_rate_unit")}
                onChange={(v) => setF({ annual_property_tax_rate: v })} />
            </Field>
            <Field label={t("f_monthly_hoa_tl")} helpText={t("f_monthly_hoa_tl_help")}>
              <NumInput value={form.monthly_hoa_tl} step={100} min={0} unit={t("f_monthly_hoa_tl_unit")}
                onChange={(v) => setF({ monthly_hoa_tl: v })} />
            </Field>
            <Field label={t("f_annual_dask_tl")} helpText={t("f_annual_dask_tl_help")}>
              <NumInput value={form.annual_dask_tl} step={100} min={0} unit={t("f_annual_dask_tl_unit")}
                onChange={(v) => setF({ annual_dask_tl: v })} />
            </Field>
            <Field label={t("f_annual_maintenance_rate")} helpText={t("f_annual_maintenance_rate_help")}>
              <NumInput value={form.annual_maintenance_rate} step={0.1} min={0} unit={t("f_annual_maintenance_rate_unit")}
                onChange={(v) => setF({ annual_maintenance_rate: v })} />
            </Field>
          </div>

          <p className="section-label" style={{ marginTop: 22 }}>{t("group_transaction")}</p>
          <div className="fields">
            <Field label={t("f_transaction_cost_buy_pct")} helpText={t("f_transaction_cost_buy_pct_help")}>
              <NumInput value={form.transaction_cost_buy_pct} step={0.5} min={0} unit={t("f_transaction_cost_buy_pct_unit")}
                onChange={(v) => setF({ transaction_cost_buy_pct: v })} />
            </Field>
            <Field label={t("f_transaction_cost_sell_pct")} helpText={t("f_transaction_cost_sell_pct_help")}>
              <NumInput value={form.transaction_cost_sell_pct} step={0.5} min={0} unit={t("f_transaction_cost_sell_pct_unit")}
                onChange={(v) => setF({ transaction_cost_sell_pct: v })} />
            </Field>
          </div>
        </div>
      )}

      {tab === "assets" && (
        <div>
          <p className="section-label">{t("assets_title")}</p>
          <p style={{ marginTop: -4, marginBottom: 16, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.5 }}>
            {t("assets_sub")}
          </p>
          <div className="chips">
            {supportedAssets.map((sym) => (
              <AssetChip
                key={sym}
                sym={sym}
                growth={assetInfo[sym] ? assetInfo[sym].average_growth : null}
                on={selectedAssets.includes(sym)}
                onChange={(on) => {
                  setSelectedAssets(on
                    ? [...selectedAssets, sym]
                    : selectedAssets.filter((s) => s !== sym));
                }}
              />
            ))}
          </div>
        </div>
      )}

      {tab === "advanced" && (
        <div>
          <p className="section-label">{t("group_options")}</p>
          <div className="toggle-row">
            <ToggleCard on={form.use_months} onChange={(v) => setF({ use_months: v })}
              title={t("opt_months")} sub={t("opt_months_sub")} />
            <ToggleCard on={form.deflate_dollar_by_us_inflation} onChange={(v) => setF({ deflate_dollar_by_us_inflation: v })}
              title={t("opt_real_usd")} sub={t("opt_real_usd_sub")} />
            <ToggleCard on={form.generate_random} onChange={(v) => setF({ generate_random: v })}
              title={t("opt_random")} sub={t("opt_random_sub")} />
            <ToggleCard on={form.project_initial_money_with_asset} onChange={(v) => setF({ project_initial_money_with_asset: v })}
              title={t("opt_invest_down")} sub={t("opt_invest_down_sub")} />
          </div>
        </div>
      )}
    </div>
  );
}
window.FormTabs = FormTabs;
