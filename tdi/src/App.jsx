import { useState, useRef, useEffect } from "react";

// ── IRS & Plan Constants ───────────────────────────────────────────────────────
const PLAN_YEAR = 2026;
const LIMIT_402G         = 24500;
const LIMIT_CATCHUP_50   = 8000;
const LIMIT_CATCHUP_6063 = 11250;
const LIMIT_415C         = 72000;

// ── TDI 2026 Payroll Calendar ─────────────────────────────────────────────────
// TDIndustries runs weekly payroll. Payday is every Friday.
// Cutoff for deferral changes is market close (3:00 PM CT) each Friday.
// Exception: when a Friday is a federal holiday, cutoff shifts to Thursday at 3:00 PM CT.
// Update PLAN_YEAR above and replace this array each January.
const TDI_PAYDAYS_2026 = [
  "2026-01-02", "2026-01-09", "2026-01-16", "2026-01-23", "2026-01-30",
  "2026-02-06", "2026-02-13", "2026-02-20", "2026-02-27",
  "2026-03-06", "2026-03-13", "2026-03-20", "2026-03-27",
  "2026-04-03", "2026-04-10", "2026-04-17", "2026-04-24",
  "2026-05-01", "2026-05-08", "2026-05-15", "2026-05-22", "2026-05-29",
  "2026-06-05", "2026-06-12",
  "2026-06-19", // Juneteenth — cutoff shifts to Thursday June 18
  "2026-06-26",
  "2026-07-03", // Independence Day observed — cutoff shifts to Thursday July 2
  "2026-07-10", "2026-07-17", "2026-07-24", "2026-07-31",
  "2026-08-07", "2026-08-14", "2026-08-21", "2026-08-28",
  "2026-09-04", "2026-09-11", "2026-09-18", "2026-09-25",
  "2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30",
  "2026-11-06", "2026-11-13", "2026-11-20", "2026-11-27",
  "2026-12-04", "2026-12-11", "2026-12-18",
  "2026-12-25", // Christmas — cutoff shifts to Thursday December 24
];

// Fridays that are federal holidays — cutoff shifts to Thursday for these weeks
const TDI_FRIDAY_HOLIDAYS = new Set([
  "2026-06-19", // Juneteenth
  "2026-07-03", // Independence Day observed
  "2026-12-25", // Christmas
]);

const TDI_CUTOFF_HOUR_CT = 15; // 3:00 PM CT = NYSE market close

function getCentralOffset(date) {
  const year = date.getUTCFullYear();
  const march = new Date(Date.UTC(year, 2, 1));
  const dstStart = new Date(Date.UTC(year, 2, (14 - march.getUTCDay()) % 7 + 8));
  const nov = new Date(Date.UTC(year, 10, 1));
  const dstEnd = new Date(Date.UTC(year, 10, (7 - nov.getUTCDay()) % 7 + 1));
  const isDST = date >= dstStart && date < dstEnd;
  return isDST ? -5 * 60 : -6 * 60;
}

function getTDICutoffForPayday(payday) {
  // Cutoff is one week before the payday (the prior Friday at 3 PM CT).
  // Exception: if that prior Friday is a federal holiday, cutoff shifts to Thursday at 3 PM CT.
  const priorFriday = new Date(payday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const priorFridayStr = `${priorFriday.getUTCFullYear()}-${String(priorFriday.getUTCMonth() + 1).padStart(2, "0")}-${String(priorFriday.getUTCDate()).padStart(2, "0")}`;
  const isHoliday = TDI_FRIDAY_HOLIDAYS.has(priorFridayStr);
  const cutoffDay = isHoliday
    ? new Date(priorFriday.getTime() - 24 * 60 * 60 * 1000) // Thursday before
    : priorFriday;
  const ctOffset = getCentralOffset(cutoffDay);
  const utcHour = TDI_CUTOFF_HOUR_CT - ctOffset / 60;
  return new Date(
    Date.UTC(cutoffDay.getUTCFullYear(), cutoffDay.getUTCMonth(), cutoffDay.getUTCDate()) +
    utcHour * 60 * 60 * 1000
  );
}

function computeTDIPeriods() {
  const nowUtcMs = Date.now();
  const nowDate = new Date(nowUtcMs);
  const nowDateStr = `${nowDate.getUTCFullYear()}-${String(nowDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nowDate.getUTCDate()).padStart(2, "0")}`;
  const periodsTotal = TDI_PAYDAYS_2026.length;
  let periodsCompleted = 0, nextPayday = null, nextPaydayStr = null, cutoffDate = null, cutoffPassed = false;

  for (let i = 0; i < TDI_PAYDAYS_2026.length; i++) {
    const pdStr = TDI_PAYDAYS_2026[i];
    if (pdStr <= nowDateStr) { periodsCompleted++; }
    else {
      nextPaydayStr = pdStr;
      nextPayday = new Date(`${pdStr}T12:00:00Z`);
      cutoffDate = getTDICutoffForPayday(nextPayday);
      cutoffPassed = nowUtcMs > cutoffDate.getTime();
      break;
    }
  }

  let firstEligiblePayday = cutoffPassed ? null : nextPayday;
  let firstEligiblePaydayStr = cutoffPassed ? null : nextPaydayStr;
  let firstEligibleCutoff = cutoffPassed ? null : cutoffDate;

  if (cutoffPassed && nextPayday) {
    const nextIdx = TDI_PAYDAYS_2026.findIndex((s) => s === nextPaydayStr);
    if (nextIdx >= 0 && nextIdx + 1 < TDI_PAYDAYS_2026.length) {
      firstEligiblePaydayStr = TDI_PAYDAYS_2026[nextIdx + 1];
      firstEligiblePayday = new Date(`${firstEligiblePaydayStr}T12:00:00Z`);
      firstEligibleCutoff = getTDICutoffForPayday(firstEligiblePayday);
    }
  }

  return {
    periodsLeft: Math.max(periodsTotal - periodsCompleted - (cutoffPassed ? 1 : 0), 0),
    periodsTotal, nextPayday, cutoffDate, cutoffPassed, firstEligiblePayday, firstEligibleCutoff,
  };
}

function ordinalSup(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return <>{n}<sup style={{ fontSize: "0.6em", verticalAlign: "super", lineHeight: 0 }}>{s[(v - 20) % 10] || s[v] || s[0]}</sup></>;
}

function fmtPayday(date) {
  const d = date.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" });
  const [month, day] = d.split(" ");
  return <>{month} {ordinalSup(parseInt(day))}</>;
}

function fmtCutoff(date) {
  const day = date.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric" });
  const parts = day.split(" ");
  // parts: ["Mon,", "Jan", "2"] or similar — extract month and day
  const month = parts[1];
  const dayNum = parseInt(parts[2]);
  return <>{month} {ordinalSup(dayNum)} at 3 PM CT</>;
}

// ── FICA Catch-Up Threshold ───────────────────────────────────────────────────
const FICA_CATCHUP_THRESHOLD = 150000;
const FICA_THRESHOLD_DISPLAY = FICA_CATCHUP_THRESHOLD.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// ── TDI Plan Rules (HCE only) ─────────────────────────────────────────────────
const MAX_QUALIFIED_PCT = 10;
const MAX_401K_PCT      = 10;
const MAX_ESOP_PCT      = 10;
const MAX_SSEP_PCT      = 10;
const MAX_TOTAL_PCT     = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCatchUp(age) {
  if (age >= 60 && age <= 63) return LIMIT_CATCHUP_6063;
  if (age >= 50) return LIMIT_CATCHUP_50;
  return 0;
}
function ceilPct(val) { return Math.ceil(val); }

// ── Next-year projection ──────────────────────────────────────────────────────
// Projects rates and dollars to max out the 401(k)/ESOP plan over a full
// 52-period year at the user's next age. Always recommends pre-tax unless
// FICA requires Roth catch-up.
function computeNextYearProjection(totalComp, age, fica) {
  const nextAge = age + 1;
  const currCatchUp = getCatchUp(age);
  const nextCatchUp = getCatchUp(nextAge);
  const currMax = LIMIT_402G + currCatchUp;
  const nextMax = LIMIT_402G + nextCatchUp;
  const limitDiff = nextMax - currMax;
  const limitChanged = limitDiff !== 0;
  const limitDirection = limitDiff > 0 ? "increases" : "decreases";
  const crossingCatchUpThreshold = currCatchUp === 0 && nextCatchUp > 0;
  const ficaUnknown = crossingCatchUpThreshold && fica === null;
  const nextIs6063 = nextAge >= 60 && nextAge <= 63;
  const nextCatchUpLabel = nextIs6063 ? "ages 60–63" : "age 50+";
  const rothRequired = nextCatchUp > 0 && fica === true;

  const fullPeriods = 52;
  const perCheck = totalComp / fullPeriods;
  if (perCheck <= 0) return null;

  if (rothRequired) {
    // Split: pre-tax up to base limit, Roth for catch-up portion
    const prePct = ceilPct(LIMIT_402G / fullPeriods / perCheck * 100);
    const rothPct = ceilPct(nextCatchUp / fullPeriods / perCheck * 100);
    return {
      split: true, nextAge, nextMax, nextCatchUp, nextCatchUpLabel,
      limitChanged, limitDirection, ficaUnknown,
      prePct, rothPct,
    };
  } else {
    const pct = ceilPct(nextMax / fullPeriods / perCheck * 100);
    return {
      split: false, nextAge, nextMax, nextCatchUp, nextCatchUpLabel,
      limitChanged, limitDirection, ficaUnknown,
      pct,
    };
  }
}

function ProjectionBlock({ totalComp, age, fica }) {
  const proj = computeNextYearProjection(totalComp, parseInt(age), fica);
  if (!proj) return null;
  return (
    <>
      <Divider label="Next Year Projection" />
      {proj.split ? (
        <>
          <SummaryLine label="Pre-tax" value={`${proj.prePct}%`} indent />
          <SummaryLine label={`Roth after-tax catch-up (${proj.nextCatchUpLabel})`} value={`${proj.rothPct}%`} indent />
        </>
      ) : (
        <SummaryLine label="Recommended pre-tax rate" value={`${proj.pct}%`} bold />
      )}
      <div style={{ fontSize: "0.72rem", color: T.textSub, fontFamily: T.font, lineHeight: 1.5, marginTop: 8, paddingLeft: 12 }}>
        Estimated rates to maximize the 401(k)/ESOP plan at age {proj.nextAge} over a full 52-period year, assuming current compensation and this year's IRS limits carry forward.
        {proj.limitChanged && (
          <span style={{ color: T.amber, fontWeight: 600 }}>
            {" "}The annual limit {proj.limitDirection} to {fc(proj.nextMax)} at age {proj.nextAge}.
          </span>
        )}
        {proj.ficaUnknown && (
          <span style={{ color: T.amber, fontWeight: 600 }}>
            {" "}You'll be catch-up eligible at age {proj.nextAge} — whether the catch-up must be Roth will depend on your {PLAN_YEAR} FICA wages.
          </span>
        )}
      </div>
    </>
  );
}

function fc(val, decimals = 0) {
  return val.toLocaleString("en-US", {
    style: "currency", currency: "USD",
    maximumFractionDigits: decimals, minimumFractionDigits: decimals,
  });
}
function parse(str) {
  const v = parseFloat((str || "").replace(/,/g, ""));
  return isNaN(v) ? 0 : v;
}
function parsePct(str) {
  const v = parseFloat((str || "").replace(/[^0-9.]/g, ""));
  return isNaN(v) ? 0 : v;
}

// ── TDIndustries Brand Theme ──────────────────────────────────────────────────
// Colors sourced from TDIndustries 2025 Partner Ownership Results presentation
const T = {
  // Base
  bg: "#F0F5FB", surface: "#FFFFFF", surfaceAlt: "#EAF2FB",
  border: "#C8D8EC", borderStrong: "#9BB5D4",
  text: "#1B3A6B", textSub: "#4A5568", textMuted: "#8A9BB5",

  // TDI Navy — primary brand color; used for Qualified ESOP plan
  navy: "#1B3A6B", navyLight: "#EAF2FB", navyBorder: "#B8D4F0",

  // TDI Sky Blue — FICA NoteBox only
  sky: "#07A3DA", skyLight: "#DBF4FF", skyBorder: "#7DD3F0",

  // TDI Amber/Gold — warnings, spillover
  amber: "#E8A020", amberLight: "#FFF8E6", amberBorder: "#F5CE80",

  // Available state — used in stat cards only
  green: "#1A7F4B", greenLight: "#EDFAF3", greenBorder: "#A8E6C4",

  // Button — TDI navy
  btn: "#1B3A6B", btnHover: "#152D55", btnLight: "#EAF2FB", btnBorder: "#B8D4F0",

  shadow: "0 1px 3px rgba(27,58,107,0.08)",
  shadowMd: "0 4px 12px rgba(27,58,107,0.10)",
  radius: "10px", radiusLg: "16px",
  font: "'Instrument Sans', 'DM Sans', system-ui, sans-serif",
};

// ── UI Components ─────────────────────────────────────────────────────────────
function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const handleShow = () => {
    if (buttonRef.current) {
      const br = buttonRef.current.getBoundingClientRect();
      const tooltipWidth = 240;
      let left = br.left + br.width / 2 - tooltipWidth / 2;
      if (left < 10) left = 10;
      if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;
      setCoords({ top: br.bottom + 8, left });
    }
    setShow(true);
  };

  return (
    <div style={{ position: "relative", display: "inline-block", marginLeft: 4 }}>
      <button type="button" ref={buttonRef} aria-label="More information"
        onMouseEnter={() => !isMobile && handleShow()}
        onMouseLeave={() => !isMobile && setShow(false)}
        onClick={() => isMobile && (show ? setShow(false) : handleShow())}
        style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", width: 16, height: 16 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke={T.textMuted} strokeWidth="1.2" />
          <path d="M7 6v3.5M7 4.5v.5" stroke={T.textMuted} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      {show && (
        <>
          {isMobile && <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setShow(false)} />}
          <div style={{
            position: "fixed", zIndex: 9999,
            top: isMobile ? "50%" : coords.top,
            left: isMobile ? "50%" : coords.left,
            transform: isMobile ? "translate(-50%, -50%)" : "none",
            background: T.navy, color: T.surface, padding: "9px 11px",
            borderRadius: T.radius, fontSize: "0.72rem", fontFamily: T.font,
            lineHeight: 1.55, width: isMobile ? "calc(100vw - 48px)" : "240px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          }}>{text}</div>
        </>
      )}
    </div>
  );
}

function Label({ children, tooltip }) {
  return (
    <div style={{ marginBottom: 4, display: "flex", alignItems: "center" }}>
      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: T.text, fontFamily: T.font, letterSpacing: "-0.01em" }}>
        {children}{tooltip && <InfoTooltip text={tooltip} />}
      </span>
    </div>
  );
}

function FieldErr({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: "0.74rem", color: T.red, fontFamily: T.font }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5.5" stroke={T.red} />
        <path d="M6 3.5v3M6 8v.5" stroke={T.red} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      {msg}
    </div>
  );
}

function formatWithCommas(str) {
  const digits = str.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("en-US");
}

function Input({ value, onChange, placeholder, type = "text", prefix, suffix, err, inputRef, disabled, integersOnly = false, commas = false }) {
  const handleChange = (e) => {
    if (disabled) return;
    const v = e.target.value;
    if (type === "number") {
      if (v === "") { onChange(""); return; }
      if (commas) {
        // Strip commas, allow digits only
        const stripped = v.replace(/,/g, "");
        if (!/^\d*$/.test(stripped)) return;
        onChange(formatWithCommas(stripped));
        return;
      }
      if (integersOnly && !/^\d*$/.test(v)) return;
      if (!integersOnly && !/^\d*\.?\d*$/.test(v)) return;
    }
    onChange(v);
  };
  return (
    <div style={{ position: "relative" }} className={err ? "field-shake" : ""}>
      {prefix && <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: "0.85rem", color: disabled ? T.textMuted : err ? T.red : T.textSub, fontFamily: T.font, pointerEvents: "none" }}>{prefix}</span>}
      {suffix && <span style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", fontSize: "0.85rem", color: disabled ? T.textMuted : T.textSub, fontFamily: T.font, pointerEvents: "none" }}>{suffix}</span>}
      <input ref={inputRef} type="text" inputMode={type === "number" ? "numeric" : "text"}
        value={disabled ? "0" : value} placeholder={disabled ? "" : placeholder}
        onChange={handleChange} readOnly={disabled}
        onFocus={(e) => { if (!disabled) e.target.style.boxShadow = `0 0 0 3px ${err ? "#FCA5A544" : "#07A3DA33"}`; }}
        onBlur={(e) => (e.target.style.boxShadow = "none")}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: prefix ? "9px 12px 9px 22px" : suffix ? "9px 28px 9px 12px" : "9px 12px",
          fontSize: "0.875rem", fontFamily: T.font,
          color: disabled ? T.textMuted : T.text,
          background: disabled ? T.surfaceAlt : err ? T.redLight : T.surface,
          border: `1.5px solid ${err ? T.red : T.border}`,
          borderRadius: T.radius, outline: "none",
          cursor: disabled ? "not-allowed" : "text",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }} />
    </div>
  );
}

function Divider({ label, tight }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: `${tight ? 8 : 14}px 0 10px` }}>
      {label && <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textMuted, fontFamily: T.font, whiteSpace: "nowrap" }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  );
}

function SummaryLine({ label, value, color, bold, indent, dimmed, tooltip }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: "0.78rem", fontFamily: T.font, color: dimmed ? T.textMuted : T.textSub, paddingLeft: indent ? 12 : 0, fontWeight: bold ? 600 : 400, display: "flex", alignItems: "center" }}>
        {label}{tooltip && <InfoTooltip text={tooltip} />}
      </span>
      <span style={{ fontSize: bold ? "0.84rem" : "0.8rem", fontFamily: T.font, fontWeight: bold ? 600 : 400, color: color || T.text, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

function NoteBox({ color, bg, border, children }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: T.radius, padding: "10px 12px", fontSize: "0.78rem", color, lineHeight: 1.55, fontFamily: T.font }}>
      {children}
    </div>
  );
}

function EmptyResults({ isCalculating }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 180, padding: 16 }}>
      <div style={{ background: T.surface, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, boxShadow: "0 4px 20px rgba(27,58,107,0.08)", padding: "20px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, maxWidth: 300 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.skyLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <style>{`
              @keyframes bar1{0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.4)}}
              @keyframes bar2{0%,100%{transform:scaleY(1)}33%{transform:scaleY(1.25)}66%{transform:scaleY(0.6)}}
              @keyframes bar3{0%,100%{transform:scaleY(1)}25%{transform:scaleY(0.5)}75%{transform:scaleY(1.2)}}
              @keyframes fieldShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
              .field-shake{animation:fieldShake 0.35s ease-in-out;}
            `}</style>
            <rect x="2" y="12" width="4" height="10" rx="1" fill={T.sky} opacity="0.5"
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar1 0.9s ease-in-out infinite" } : {}} />
            <rect x="9" y="7" width="4" height="15" rx="1" fill={T.sky} opacity="0.75"
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar2 0.9s ease-in-out infinite 0.15s" } : {}} />
            <rect x="16" y="3" width="4" height="19" rx="1" fill={T.sky}
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar3 0.9s ease-in-out infinite 0.3s" } : {}} />
          </svg>
        </div>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: T.text, fontFamily: T.font, textAlign: "center" }}>
          {isCalculating ? "Calculating…" : "Calculate Your Path to the Limit"}
        </div>
        {!isCalculating && (
          <div style={{ fontSize: "0.78rem", color: T.textSub, fontFamily: T.font, textAlign: "center", lineHeight: 1.55 }}>
            Enter your compensation and age to see your contribution limits and next-year projections.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Percentage Input ───────────────────────────────────────────────────────────
function PctInput({ value, onChange, label, tooltip, disabled, disabledReason, err, accentColor }) {
  const color = accentColor || T.text;
  return (
    <div>
      <div style={{ marginBottom: 4, display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: disabled ? T.textMuted : color, fontFamily: T.font, display: "flex", alignItems: "center" }}>
          {label}{tooltip && <InfoTooltip text={tooltip} />}
        </span>
      </div>
      <div style={{ position: "relative" }} className={err ? "field-shake" : ""}>
        <input
          type="text" inputMode="decimal"
          value={disabled ? "0" : value}
          placeholder={disabled ? "" : "0"}
          readOnly={disabled}
          onChange={(e) => {
            if (disabled) return;
            const v = e.target.value;
            if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) onChange(v);
          }}
          onFocus={(e) => { if (!disabled) e.target.style.boxShadow = `0 0 0 3px ${err ? "#FCA5A544" : "#07A3DA33"}`; }}
          onBlur={(e) => (e.target.style.boxShadow = "none")}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "9px 26px 9px 12px",
            fontSize: "0.875rem", fontFamily: T.font,
            color: disabled ? T.textMuted : T.text,
            background: disabled ? T.surfaceAlt : err ? T.redLight : T.surface,
            border: `1.5px solid ${err ? T.red : T.border}`,
            borderRadius: T.radius, outline: "none",
            cursor: disabled ? "not-allowed" : "text",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        />
        <span style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", fontSize: "0.85rem", color: disabled ? T.textMuted : T.textSub, fontFamily: T.font, pointerEvents: "none" }}>%</span>
      </div>
      {disabled && disabledReason && (
        <div style={{ fontSize: "0.67rem", color: T.textMuted, fontFamily: T.font, marginTop: 3, lineHeight: 1.4 }}>
          {disabledReason}
        </div>
      )}
      {err && !disabled && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: "0.74rem", color: T.red, fontFamily: T.font }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5.5" stroke={T.red} />
            <path d="M6 3.5v3M6 8v.5" stroke={T.red} strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {err}
        </div>
      )}
    </div>
  );
}

// ── Expand Row (accordion toggle with hasData indicator) ──────────────────────
function ExpandRow({ label, tooltip, isOpen, onToggle, colors, hasData, onClear, alwaysColor }) {
  const c = colors || { active: T.btn, activeBg: T.btnLight, activeBorder: T.btn };
  const showActive = isOpen || hasData || alwaysColor;
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: "100%", boxSizing: "border-box",
        padding: "9px 12px", fontSize: "0.8rem", fontFamily: T.font,
        color: showActive ? c.active : T.text,
        fontWeight: showActive ? 600 : 400,
        background: showActive ? c.activeBg : T.surface,
        border: `1.5px solid ${showActive ? c.activeBorder : T.border}`,
        borderRadius: T.radius, outline: "none", cursor: "pointer",
        textAlign: "left", display: "flex", alignItems: "center",
        justifyContent: "space-between", transition: "all 0.15s",
        boxShadow: isOpen ? `0 0 0 3px ${c.activeBg}` : "none",
      }}
      onMouseEnter={(e) => { if (!showActive) e.currentTarget.style.background = T.surfaceAlt; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = showActive ? c.activeBg : T.surface; }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span>{label}</span>
        {tooltip && (
          <span onClick={(e) => e.stopPropagation()}>
            <InfoTooltip text={tooltip} />
          </span>
        )}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!isOpen && hasData && onClear && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            style={{ fontSize: "0.68rem", color: c.active, fontWeight: 600, opacity: 0.7, textDecoration: "underline", cursor: "pointer", lineHeight: 1 }}
          >
            Clear
          </span>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M2 4l4 4 4-4" stroke={showActive ? c.active : T.textSub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

// ── Toggle Pair ───────────────────────────────────────────────────────────────
function TogglePair({ options, value, onChange, err }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {options.map((opt) => {
        const sel = value === opt.val;
        return (
          <button
            key={String(opt.val)}
            type="button"
            onClick={() => onChange(opt.val)}
            style={{
              flex: 1,
              padding: "9px 8px",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: sel ? 600 : 400,
              fontFamily: T.font,
              border: `1.5px solid ${sel ? T.btn : err ? T.red : T.border}`,
              borderRadius: T.radius,
              background: sel ? T.btnLight : err ? T.redLight : T.surface,
              color: sel ? T.btn : err ? T.red : T.textSub,
              transition: "all 0.15s",
              lineHeight: 1.4,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Detail Panel (expandable) ─────────────────────────────────────────────────
function DetailPanel({ label, isOpen, onToggle, children }) {
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 0 }}>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} aria-label={label}
        style={{
          width: "100%", boxSizing: "border-box", padding: "10px 14px",
          fontSize: "0.75rem", fontFamily: T.font, fontWeight: 700,
          color: T.textSub, background: T.surface, border: "none",
          outline: "none", cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          letterSpacing: "-0.01em",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = T.surfaceAlt)}
        onMouseLeave={(e) => (e.currentTarget.style.background = T.surface)}
      >
        <span>{label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M2 4l4 4 4-4" stroke={T.textSub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <div style={{
          background: "#F9FAFB", borderTop: `1px solid ${T.border}`,
          padding: "12px 14px",
        }}>
          {children}
        </div>
      )}
    </div>
  );
}



// ── Expandable Summary Panel ──────────────────────────────────────────────────
function SummaryPanel({ isOpen, onToggle, children }) {
  return (
    <div style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden" }}>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} aria-label="Total contributions summary"
        style={{
          width: "100%", boxSizing: "border-box", padding: "10px 14px",
          fontSize: "0.75rem", fontFamily: T.font, fontWeight: 700,
          color: T.textSub, background: T.surfaceAlt, border: "none",
          outline: "none", cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          letterSpacing: "-0.01em",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = T.border)}
        onMouseLeave={(e) => (e.currentTarget.style.background = T.surfaceAlt)}
      >
        <span>Total Contributions Summary</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M2 4l4 4 4-4" stroke={T.textSub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <div style={{ padding: "0 14px 12px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Plan Cell ─────────────────────────────────────────────────────────────────
function PlanCell({ label, pct, dollars, ytd, periodsLeft }) {
  const perCheck = periodsLeft > 0 ? Math.max(dollars - ytd, 0) / periodsLeft : null;
  return (
    <div style={{ background: T.surface, padding: "8px 12px" }}>
      <div style={{ fontSize: "0.68rem", fontWeight: 600, color: T.textSub, fontFamily: T.font, marginBottom: 3 }}>{label}</div>
      {pct === 0
        ? <div style={{ fontSize: "0.82rem", fontWeight: 600, color: T.textMuted, fontFamily: T.font }}>-</div>
        : <div>
            <div style={{ fontSize: "1.35rem", fontWeight: 700, color: T.navy, fontFamily: T.font, letterSpacing: "-0.02em", lineHeight: 1 }}>{pct}%</div>
            {perCheck !== null && <div style={{ fontSize: "0.72rem", color: T.textSub, fontFamily: T.font, marginTop: 2 }}>{fc(perCheck)}/paycheck</div>}
          </div>
      }
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { periodsLeft, periodsTotal, nextPayday, cutoffDate, cutoffPassed, firstEligiblePayday, firstEligibleCutoff } = computeTDIPeriods();

  const [baseSalary, setBaseSalary] = useState("");
  const [age, setAge]               = useState("");

  const [r401kPre,  setR401kPre]   = useState("");
  const [r401kRoth, setR401kRoth]  = useState("");
  const [rEsopPre,  setREsopPre]   = useState("");
  const [rEsopRoth, setREsopRoth]  = useState("");
  const [rSsepPre,  setRSsepPre]   = useState("");
  const [rSsepEsop, setRSsepEsop]  = useState("");

  const [ytd401kPre,  setYtd401kPre]  = useState("");
  const [ytd401kRoth, setYtd401kRoth] = useState("");
  const [ytdEsopPre,  setYtdEsopPre]  = useState("");
  const [ytdEsopRoth, setYtdEsopRoth] = useState("");
  const [ytdSsepPre,  setYtdSsepPre]  = useState("");
  const [ytdSsepEsop, setYtdSsepEsop] = useState("");
  const [show401k, setShow401k]       = useState(false);
  const [showEsop, setShowEsop]       = useState(false);
  const [showSsep, setShowSsep]       = useState(false);

  const [fica, setFica]                   = useState(null);

  const [result, setResult]               = useState(null);
  const [errors, setErrors]               = useState({ base: "", age: "", fica: "" });
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculated, setCalculated]       = useState(false);
  const [isDirty, setIsDirty]             = useState(false);
  const [isMobile, setIsMobile]           = useState(false);
  const [showQualDetail, setShowQualDetail]   = useState(false);
  const [showSsepDetail, setShowSsepDetail]   = useState(false);
  const [showTotalSummary, setShowTotalSummary] = useState(false);
  const [showLimitsGuide, setShowLimitsGuide] = useState(false);
  const [showExample, setShowExample] = useState(false);

  const baseRef    = useRef(null);
  const ageRef     = useRef(null);
  const resultsRef = useRef(null);
  const ytd401kPreRef  = useRef(null);
  const ytd401kRothRef = useRef(null);
  const ytdEsopPreRef  = useRef(null);
  const ytdEsopRothRef = useRef(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    function onKey(e) { if (e.key === "Enter" && !e.shiftKey) calculate(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function markDirty() { if (calculated) setIsDirty(true); }

  // ── FICA question visibility ──────────────────────────────────────────────
  const parsedAge  = parseInt(age) || 0;
  const parsedBase = parse(baseSalary);
  const catchUpAge = parsedAge >= 50;
  const ficaVisible = catchUpAge && parsedBase >= FICA_CATCHUP_THRESHOLD;

  // Reset fica if it no longer applies
  useEffect(() => {
    if (!ficaVisible && fica !== null) {
      setFica(null);
      setErrors((e) => ({ ...e, fica: "" }));
    }
  }, [ficaVisible, fica]);

  // ── Live budget values ────────────────────────────────────────────────────
  const p401kPre  = parsePct(r401kPre);
  const pEsopPre  = parsePct(rEsopPre);
  const pSsepPre  = parsePct(rSsepPre);
  const pSsepEsop = parsePct(rSsepEsop);

  // When FICA requires Roth catch-up, derive the Roth percentages directly
  const liveComp        = parse(baseSalary);
  const liveCatchUp     = parseInt(age) >= 50 ? getCatchUp(parseInt(age)) : 0;
  const liveElectiveLimit = LIMIT_402G + liveCatchUp;

  const p401kRoth = parsePct(r401kRoth);
  const pEsopRoth = parsePct(rEsopRoth);

  const used401k    = p401kPre + p401kRoth;
  const usedEsop    = pEsopPre + pEsopRoth;
  const usedQual    = used401k + usedEsop;
  const usedSsep    = pSsepPre + pSsepEsop;
  const usedTotal   = usedQual + usedSsep;
  // Column totals — shared across both plans
  const usedNonEsop = p401kPre + p401kRoth + pSsepPre;   // Non-ESOP column
  const usedEsopCol = pEsopPre + pEsopRoth + pSsepEsop;  // ESOP column

  // Lock conditions — each field checks every ceiling that applies to it
  const lock401kPre  = (used401k >= MAX_401K_PCT) || (usedQual >= MAX_QUALIFIED_PCT) || (usedNonEsop >= MAX_401K_PCT) || (usedTotal >= MAX_TOTAL_PCT);
  const lock401kRoth = (used401k >= MAX_401K_PCT) || (usedQual >= MAX_QUALIFIED_PCT) || (usedNonEsop >= MAX_401K_PCT) || (usedTotal >= MAX_TOTAL_PCT);
  const lockEsopPre  = (usedEsop >= MAX_ESOP_PCT) || (usedQual >= MAX_QUALIFIED_PCT) || (usedEsopCol >= MAX_ESOP_PCT) || (usedTotal >= MAX_TOTAL_PCT);
  const lockEsopRoth = (usedEsop >= MAX_ESOP_PCT) || (usedQual >= MAX_QUALIFIED_PCT) || (usedEsopCol >= MAX_ESOP_PCT) || (usedTotal >= MAX_TOTAL_PCT);
  const lockSsepPre  = (usedSsep >= MAX_SSEP_PCT) || (usedNonEsop >= MAX_401K_PCT)   || (usedTotal >= MAX_TOTAL_PCT);
  const lockSsepEsop = (usedSsep >= MAX_SSEP_PCT) || (usedEsopCol >= MAX_ESOP_PCT)   || (usedTotal >= MAX_TOTAL_PCT);

  // ── Live dollar preview ─────────────────────────────────────────────────

  // YTD parsed amounts
  const ytd401kPreAmt  = parse(ytd401kPre);
  const ytd401kRothAmt = parse(ytd401kRoth);
  const ytdEsopPreAmt  = parse(ytdEsopPre);
  const ytdEsopRothAmt = parse(ytdEsopRoth);
  const ytdQualTotal   = ytd401kPreAmt + ytd401kRothAmt + ytdEsopPreAmt + ytdEsopRothAmt;

  function handleRateChange(setter, fieldUsed, bucketChecks, newVal) {
    const raw = newVal === "" ? 0 : parsePct(newVal);
    for (const [bucketUsed, bucketMax] of bucketChecks) {
      const otherContrib = bucketUsed - fieldUsed;
      if (raw + otherContrib > bucketMax) {
        const maxAllowed = Math.max(bucketMax - otherContrib, 0);
        // Round up to next whole integer so the plan system can accept the value
        const rounded = maxAllowed === 0 ? 0 : Math.ceil(maxAllowed);
        setter(rounded === 0 ? "" : String(rounded));
        return;
      }
    }
    setter(newVal);
    markDirty();
  }

  // ── FICA pre-tax sub-cap ─────────────────────────────────────────────────
  // When FICA is Yes and catch-up applies, combined qualified pre-tax dollars
  // (401k pre-tax + ESOP pre-tax) cannot exceed the standard $24,500 limit.
  // Catch-up dollars above $24,500 must be Roth. No restriction when FICA is No.

  function handlePreTaxWithFicaCap(setter, fieldUsed, bucketChecks, newVal) {
    handleRateChange(setter, fieldUsed, bucketChecks, newVal);
  }

  // ── Budget status label ──────────────────────────────────────────────────
  function BudgetPill({ used, max }) {
    const full = used >= max;
    const remaining = Math.max(max - used, 0);
    return (
      <span style={{
        fontSize: "0.68rem", fontFamily: T.font,
        color: full ? T.navy : T.textMuted,
        fontWeight: full ? 700 : 400,
        whiteSpace: "nowrap",
      }}>
        {full ? "Limit reached" : `${Math.round(remaining)}% remaining`}
      </span>
    );
  }

  // ── Calculate ─────────────────────────────────────────────────────────────
  function calculate() {
    const errs = { base: "", age: "", fica: "", ytd401kPre: "", ytd401kRoth: "", ytdEsopPre: "", ytdEsopRoth: "" };
    let bad = false;
    const base = parse(baseSalary);
    const a    = parseInt(age);

    if (!base || base <= 0) { errs.base = "Enter your base compensation."; bad = true; }
    if (base > 0 && base < 10000) { errs.base = "This looks low — did you mean to enter an hourly rate?"; bad = true; }
    if (!a || a < 18 || a > 100) { errs.age = "Enter a valid age (18–100)."; bad = true; }
    if (ficaVisible && fica === null) { errs.fica = "Please select one."; bad = true; }
    if (ytd401kPreAmt < 0)  { errs.ytd401kPre  = "Cannot be negative."; bad = true; }
    if (ytd401kRothAmt < 0) { errs.ytd401kRoth = "Cannot be negative."; bad = true; }
    if (ytdEsopPreAmt < 0)  { errs.ytdEsopPre  = "Cannot be negative."; bad = true; }
    if (ytdEsopRothAmt < 0) { errs.ytdEsopRoth = "Cannot be negative."; bad = true; }

    setErrors(errs);
    setCalculated(true);
    setIsDirty(false);

    if (bad) {
      setResult(null);
      setTimeout(() => {
        if (errs.base)       { baseRef.current?.focus(); return; }
        if (errs.age)        { ageRef.current?.focus(); return; }
        if (errs.ytd401kPre) { ytd401kPreRef.current?.focus(); return; }
        if (errs.ytd401kRoth){ ytd401kRothRef.current?.focus(); return; }
        if (errs.ytdEsopPre) { ytdEsopPreRef.current?.focus(); return; }
        if (errs.ytdEsopRoth){ ytdEsopRothRef.current?.focus(); return; }
      }, 50);
      return;
    }

    setResult(null);
    setIsCalculating(true);

    setTimeout(() => {
      setIsCalculating(false);

      const totalComp     = base;
      const catchUp       = getCatchUp(a);
      const is6063        = a >= 60 && a <= 63;
      const electiveLimit = LIMIT_402G + catchUp;

      // When FICA requires Roth catch-up the 401(k) percentage cap is raised to
      // accommodate both the base limit and catch-up portion — the IRS dollar limit
      // governs what actually counts, not the plan percentage guardrail.
      const ficaRothRequired = catchUp > 0 && fica === true;
      const effective401kCap = ficaRothRequired
        ? Math.ceil((electiveLimit / totalComp) * 100)
        : MAX_401K_PCT;
      const effectiveEsopCap = ficaRothRequired
        ? Math.ceil((electiveLimit / totalComp) * 100)
        : MAX_ESOP_PCT;

      const el401kPre  = Math.min(p401kPre,  effective401kCap);
      const el401kRoth = Math.min(p401kRoth, Math.max(effective401kCap - el401kPre, 0));
      const elEsopPre  = Math.min(pEsopPre,  effectiveEsopCap);
      const elEsopRoth = Math.min(pEsopRoth, Math.max(effectiveEsopCap - elEsopPre, 0));
      const el401kCombined = el401kPre + el401kRoth;
      const elEsopCombined = elEsopPre + elEsopRoth;
      const elQualTotal    = el401kCombined + elEsopCombined;

      // SSEP elections are capped by the SSEP row AND the column limits
      // Non-ESOP column: 401k pre + 401k roth + SSEP pre cannot exceed 10%
      const nonEsopUsedByQual = el401kPre + el401kRoth;
      const nonEsopColRoomForSsep = Math.max(MAX_401K_PCT - nonEsopUsedByQual, 0);
      // ESOP column: ESOP pre + ESOP roth + SSEP ESOP cannot exceed 10%
      const esopUsedByQual = elEsopPre + elEsopRoth;
      const esopColRoomForSsep = Math.max(MAX_ESOP_PCT - esopUsedByQual, 0);

      const elSsepPre  = Math.min(pSsepPre,  MAX_SSEP_PCT, nonEsopColRoomForSsep);
      const elSsepEsop = Math.min(pSsepEsop, Math.max(MAX_SSEP_PCT - elSsepPre, 0), esopColRoomForSsep);
      const elSsepTotal    = elSsepPre + elSsepEsop;
      const elGrandTotal   = elQualTotal + elSsepTotal;

      const d401kPre      = totalComp * (el401kPre  / 100);
      const d401kRoth     = totalComp * (el401kRoth / 100);
      const dEsopPre      = totalComp * (elEsopPre  / 100);
      const dEsopRoth     = totalComp * (elEsopRoth / 100);
      const dQualRaw      = d401kPre + d401kRoth + dEsopPre + dEsopRoth;
      // Remaining room under 402(g) after YTD already contributed
      const effectiveQualLimit = Math.max(electiveLimit - ytdQualTotal, 0);
      const dQualEmployee = Math.min(dQualRaw, effectiveQualLimit);

      // When FICA requires Roth catch-up, pre-tax is hard-capped at LIMIT_402G
      let d401kPreFinal, d401kRothFinal, dEsopPreFinal, dEsopRothFinal;
      if (ficaRothRequired && dQualRaw > effectiveQualLimit) {
        const preTaxCap = Math.max(LIMIT_402G - (ytdQualTotal - ytd401kRothAmt - ytdEsopRothAmt), 0);
        const preTaxRaw = d401kPre + dEsopPre;
        const preTaxActual = Math.min(preTaxRaw, preTaxCap);
        const preTaxScale = preTaxRaw > 0 ? preTaxActual / preTaxRaw : 1;
        d401kPreFinal  = d401kPre  * preTaxScale;
        dEsopPreFinal  = dEsopPre  * preTaxScale;
        const rothActual = dQualEmployee - preTaxActual;
        const rothRaw  = d401kRoth + dEsopRoth;
        const rothScale = rothRaw > 0 ? rothActual / rothRaw : 1;
        d401kRothFinal = d401kRoth * rothScale;
        dEsopRothFinal = dEsopRoth * rothScale;
      } else {
        const qualScale = dQualRaw > 0 ? dQualEmployee / dQualRaw : 1;
        d401kPreFinal  = d401kPre  * qualScale;
        d401kRothFinal = d401kRoth * qualScale;
        dEsopPreFinal  = dEsopPre  * qualScale;
        dEsopRothFinal = dEsopRoth * qualScale;
      }
      const dSsepPre      = totalComp * (elSsepPre  / 100);
      const dSsepEsop     = totalComp * (elSsepEsop / 100);
      const dSsepTotal    = dSsepPre + dSsepEsop;
      const dEmployeeTotal = dQualEmployee + dSsepTotal;

      // SSEP YTD — informational only
      const ytdSsepPreAmt  = parse(ytdSsepPre);
      const ytdSsepEsopAmt = parse(ytdSsepEsop);
      const ytdSsepTotal   = ytdSsepPreAmt + ytdSsepEsopAmt;

      const electiveEmployee = dQualEmployee;
      const electiveOver402g = Math.max(electiveEmployee + ytdQualTotal - electiveLimit, 0);

      // ── Availability calculations for stat cards ─────────────────────────
      const overallRemaining = Math.max(MAX_TOTAL_PCT - elGrandTotal, 0);

      // Column totals derived from elected values
      const elNonEsopCol = el401kPre + el401kRoth + elSsepPre;
      const elEsopCol    = elEsopPre + elEsopRoth + elSsepEsop;
      const nonEsopColRemaining = Math.max(MAX_401K_PCT - elNonEsopCol, 0);
      const esopColRemaining    = Math.max(MAX_ESOP_PCT - elEsopCol, 0);

      // 401(k)/ESOP plan row remaining — plan % rules only, not IRS dollar ceiling
      const qualRowRemaining = Math.max(MAX_QUALIFIED_PCT - elQualTotal, 0);
      // 401(k) sub-cap remaining
      const qual401kSubRemaining = Math.max(MAX_401K_PCT - el401kCombined, 0);
      // ESOP sub-cap remaining
      const qualEsopSubRemaining = Math.max(MAX_ESOP_PCT - elEsopCombined, 0);

      // Each of the four qualified buckets: min of (plan row, sub-cap, column, overall)
      const avail401kPre  = Math.min(qualRowRemaining, qual401kSubRemaining, nonEsopColRemaining, overallRemaining);
      const avail401kRoth = Math.min(qualRowRemaining, qual401kSubRemaining, nonEsopColRemaining, overallRemaining);
      const availEsopPre  = Math.min(qualRowRemaining, qualEsopSubRemaining, esopColRemaining, overallRemaining);
      const availEsopRoth = Math.min(qualRowRemaining, qualEsopSubRemaining, esopColRemaining, overallRemaining);

      // SSEP: each bucket is the min of (SSEP row remaining, column remaining, overall remaining)
      const ssepRowRemaining = Math.max(MAX_SSEP_PCT - elSsepTotal, 0);
      const availSsepPre  = Math.min(ssepRowRemaining, nonEsopColRemaining, overallRemaining);
      const availSsepEsop = Math.min(ssepRowRemaining, esopColRemaining, overallRemaining);

      // Overall
      const availOverall = overallRemaining;

      // ── FICA / Roth catch-up note ────────────────────────────────────────
      const d401kTotal        = d401kPreFinal + d401kRothFinal;
      // Catch-up is in play when FICA requires Roth AND projected 401(k) dollars
      // (including what's already been contributed) exceed the standard limit
      const total401kWithYtd  = d401kTotal + ytd401kPreAmt + ytd401kRothAmt;
      const catchUpInPlay     = ficaRothRequired && total401kWithYtd > LIMIT_402G;
      const catchUpRemaining  = Math.max(catchUp - (ytd401kRothAmt), 0);
      const rothCatchUpPct    = totalComp > 0
        ? Math.ceil((catchUpRemaining / totalComp) * 100)
        : 0;

      // Effective display percentages — derived from final dollars, not raw input
      // These keep plan card % consistent with dollar amounts after FICA scaling
      const eff401kPre  = totalComp > 0 ? Math.round(d401kPreFinal  / totalComp * 100) : 0;
      const eff401kRoth = totalComp > 0 ? Math.round(d401kRothFinal / totalComp * 100) : 0;
      const effEsopPre  = totalComp > 0 ? Math.round(dEsopPreFinal  / totalComp * 100) : 0;
      const effEsopRoth = totalComp > 0 ? Math.round(dEsopRothFinal / totalComp * 100) : 0;

      setResult({
        base, totalComp, age: a, catchUp, is6063, electiveLimit,
        el401kPre, el401kRoth, elEsopPre, elEsopRoth,
        eff401kPre, eff401kRoth, effEsopPre, effEsopRoth,
        el401kCombined, elEsopCombined, elQualTotal,
        elSsepPre, elSsepEsop, elSsepTotal, elGrandTotal,
        d401kPre: d401kPreFinal, d401kRoth: d401kRothFinal,
        dEsopPre: dEsopPreFinal, dEsopRoth: dEsopRothFinal,
        dQualEmployee, dSsepPre, dSsepEsop, dSsepTotal, dEmployeeTotal,
        electiveEmployee, electiveOver402g,
        // YTD values passed through for results display
        ytd401kPre: ytd401kPreAmt, ytd401kRoth: ytd401kRothAmt,
        ytdEsopPre: ytdEsopPreAmt, ytdEsopRoth: ytdEsopRothAmt,
        ytdQualTotal, ytdSsepPre: ytdSsepPreAmt, ytdSsepEsop: ytdSsepEsopAmt, ytdSsepTotal,
        effectiveQualLimit,
        hasQualContribs: dQualEmployee > 0,
        hasSsepContribs: dSsepTotal > 0,
        fica,
        catchUpInPlay,
        rothCatchUpPct,
        // Availability for stat cards
        avail401kPre, avail401kRoth, availEsopPre, availEsopRoth,
        availSsepPre, availSsepEsop, availOverall,
      });

      if (isMobile && resultsRef.current) {
        setTimeout(() => resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    }, 650);
  }

  function clearAll() {
    setBaseSalary(""); setAge("");
    setFica(null);
    setR401kPre(""); setR401kRoth(""); setREsopPre(""); setREsopRoth("");
    setRSsepPre(""); setRSsepEsop("");
    setYtd401kPre(""); setYtd401kRoth(""); setYtdEsopPre(""); setYtdEsopRoth("");
    setYtdSsepPre(""); setYtdSsepEsop("");
    setResult(null); setErrors({ base: "", age: "", fica: "", ytd401kPre: "", ytd401kRoth: "", ytdEsopPre: "", ytdEsopRoth: "" });
    setCalculated(false); setIsDirty(false); setIsCalculating(false);
    setShowQualDetail(false); setShowSsepDetail(false);
    setShowTotalSummary(false);
    setShowLimitsGuide(false);
    setShow401k(false); setShowEsop(false); setShowSsep(false);
  }

  const anyRateEntered = usedTotal > 0;
  const has401kData  = p401kPre > 0 || p401kRoth > 0 || ytd401kPreAmt > 0 || ytd401kRothAmt > 0;
  const hasEsopData  = pEsopPre > 0 || pEsopRoth > 0 || ytdEsopPreAmt > 0 || ytdEsopRothAmt > 0;
  const hasSsepData  = pSsepPre > 0 || pSsepEsop > 0 || parse(ytdSsepPre) > 0 || parse(ytdSsepEsop) > 0;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: T.bg, fontFamily: T.font, overflow: "auto", position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        input::-webkit-inner-spin-button,input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0;}
        input[type=number]{-moz-appearance:textfield;appearance:textfield;}
        @media(max-width:1023px){.mobile-stack{grid-template-columns:1fr!important}}
      `}</style>

      {/* Subtle noise */}
      <div style={{ position: "fixed", inset: 0, opacity: 0.02, pointerEvents: "none", zIndex: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 1, flexShrink: 0, padding: "10px 20px 8px", borderBottom: `1px solid ${T.border}`, background: T.navy, display: "flex", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? "1rem" : "1.1rem", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
          TDIndustries Contribution Assistant
        </h1>
      </div>

      {/* ── How the Limits Work — collapsible guide ── */}
      <div style={{ position: "relative", zIndex: 1, padding: "8px 16px 0", maxWidth: 1200, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <button
          type="button"
          onClick={() => setShowLimitsGuide(v => !v)}
          aria-expanded={showLimitsGuide}
          aria-label="How the Contribution Limits Work"
          style={{
            width: "100%", padding: "10px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: showLimitsGuide ? `${T.radius} ${T.radius} 0 0` : T.radius,
            cursor: "pointer", fontFamily: T.font, outline: "none",
            transition: "all 0.15s",
            boxShadow: showLimitsGuide ? "none" : T.shadow,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = T.surfaceAlt; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = T.surface; }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="4" width="4" height="8" rx="1" fill={T.navyBorder} />
              <rect x="6" y="4" width="4" height="8" rx="1" fill={T.borderStrong} />
              <rect x="11" y="4" width="4" height="8" rx="1" fill={T.navy} />
            </svg>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: T.navy, letterSpacing: "-0.01em" }}>
              How the Contribution Limits Work
            </span>
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{ flexShrink: 0, transform: showLimitsGuide ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            <path d="M2 4l4 4 4-4" stroke={T.textSub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {showLimitsGuide && (
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderTop: "none",
            borderRadius: `0 0 ${T.radiusLg} ${T.radiusLg}`,
            padding: isMobile ? "16px 14px 20px" : "20px 24px 24px",
            boxShadow: T.shadowMd,
          }}>

            {/* Title */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: isMobile ? "0.95rem" : "1.05rem", fontWeight: 800, color: T.navy, fontFamily: T.font, letterSpacing: "-0.02em" }}>
                Maximum Contribution Rates: Highly Compensated Employees
              </div>
              <div style={{ fontSize: "0.72rem", color: T.textMuted, fontFamily: T.font, marginTop: 4 }}>
                Read by row for plan limits, by column for category limits, then confirm the overall total.
              </div>
            </div>

            {/* Matrix grid */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

              {/* ── Column headers ── */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "152px 1fr 1fr", border: `1.5px solid ${T.border}`, borderRadius: `${T.radius} ${T.radius} 0 0`, overflow: "hidden", margin: "0 8px" }}>
                <div style={{ background: T.bg }} />
                <div style={{ padding: "9px 14px", textAlign: "center", borderRight: `1px solid ${T.border}`, background: "#DCEEFF", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: T.navy, fontFamily: T.font, letterSpacing: "0.05em", textTransform: "uppercase" }}>Non-ESOP</span>
                  <InfoTooltip text="Includes 401(k) Pre-tax, 401(k) Roth, and SSEP Pre-tax. All three count toward a single combined limit of 10% — regardless of how elections are split across them." />
                </div>
                <div style={{ padding: "9px 14px", textAlign: "center", background: "#D4F5E4", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#1A6640", fontFamily: T.font, letterSpacing: "0.05em", textTransform: "uppercase" }}>ESOP</span>
                  <InfoTooltip text="ESOP contributions are invested in TDIndustries company stock. Includes ESOP Pre-tax, ESOP Roth, and SSEP ESOP. All three count toward a single combined limit of 10% across both plans." />
                </div>
              </div>

              {/* ── Row 1: 401(k)/ESOP Plan — full amber outline ── */}
              <div style={{ margin: "6px 8px 3px", border: `2px solid ${T.amberBorder}`, borderRadius: 7, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "152px 1fr 1fr" }}>
                  <div style={{ padding: "12px 10px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", borderRight: `1px solid ${T.amberBorder}`, background: T.amberLight }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: T.navy, fontFamily: T.font }}>401(k)/ESOP Plan</span>
                      <InfoTooltip text="A qualified plan subject to IRS dollar limits. All four buckets in this row share a single 10% plan cap — 401(k) elections and ESOP elections each have a 10% sub-limit, but the combined total across all four cannot exceed 10%." />
                    </div>
                    <div style={{ fontSize: "0.72rem", color: T.textMuted, fontFamily: T.font, marginBottom: 6 }}>Plan Maximum</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: T.navy, fontFamily: T.font, letterSpacing: "-0.02em", lineHeight: 1 }}>10%</div>
                  </div>
                  <div style={{ padding: "10px 10px", borderRight: `1px solid ${T.amberBorder}`, background: "#EEF6FF" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
                      {[{ label: "401(k) Pre-tax" }, { label: "401(k) Roth" }].map(b => (
                        <div key={b.label} style={{ background: "#DCEEFF", border: `1px solid #B8D8F8`, borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
                          <div style={{ fontSize: "0.72rem", color: T.navy, fontFamily: T.font, marginBottom: 4 }}>{b.label}</div>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 3 }}>
                            <span style={{ fontSize: "1.2rem", fontWeight: 800, color: T.navy, fontFamily: T.font, lineHeight: 1 }}>10%</span>
                            <span style={{ fontSize: "0.72rem", fontWeight: 400, color: T.textMuted, fontFamily: T.font }}>max</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ textAlign: "center", fontSize: "0.72rem", fontWeight: 600, color: T.navy, fontFamily: T.font }}>401(k) combined = 10%</div>
                  </div>
                  <div style={{ padding: "10px 10px", background: "#EDFAF3" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
                      {[{ label: "ESOP Pre-tax" }, { label: "ESOP Roth" }].map(b => (
                        <div key={b.label} style={{ background: "#D4F5E4", border: `1px solid #A8E6C4`, borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
                          <div style={{ fontSize: "0.72rem", color: "#1A6640", fontFamily: T.font, marginBottom: 4 }}>{b.label}</div>
                          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 3 }}>
                            <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1A6640", fontFamily: T.font, lineHeight: 1 }}>10%</span>
                            <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "#4A9968", fontFamily: T.font }}>max</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ textAlign: "center", fontSize: "0.72rem", fontWeight: 600, color: "#1A6640", fontFamily: T.font }}>ESOP combined = 10%</div>
                  </div>
                </div>
              </div>

              {/* ── Row 2: SSEP — full sky outline ── */}
              <div style={{ margin: "3px 8px 6px", border: `2px solid ${T.skyBorder}`, borderRadius: 7, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "152px 1fr 1fr" }}>
                  <div style={{ padding: "12px 10px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", borderRight: `1px solid ${T.skyBorder}`, background: T.skyLight }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: T.navy, fontFamily: T.font }}>SSEP</span>
                      <InfoTooltip text="A supplemental plan with no IRS dollar limits — only the plan's own percentage caps apply. SSEP Pre-tax and SSEP ESOP combined cannot exceed 10%. Note that SSEP elections also count toward the column totals: SSEP Pre-tax feeds the Non-ESOP column, and SSEP ESOP feeds the ESOP column." />
                    </div>
                    <div style={{ fontSize: "0.72rem", color: T.textMuted, fontFamily: T.font, marginBottom: 6 }}>Plan Maximum</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: T.navy, fontFamily: T.font, letterSpacing: "-0.02em", lineHeight: 1 }}>10%</div>
                  </div>
                  <div style={{ padding: "10px 10px", borderRight: `1px solid ${T.skyBorder}`, background: "#EEF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ background: "#DCEEFF", border: `1px solid #B8D8F8`, borderRadius: 6, padding: "10px", textAlign: "center", width: "100%" }}>
                      <div style={{ fontSize: "0.72rem", color: T.navy, fontFamily: T.font, marginBottom: 4 }}>SSEP Pre-tax</div>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 3 }}>
                        <span style={{ fontSize: "1.2rem", fontWeight: 800, color: T.navy, fontFamily: T.font, lineHeight: 1 }}>10%</span>
                        <span style={{ fontSize: "0.72rem", fontWeight: 400, color: T.textMuted, fontFamily: T.font }}>max</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: "10px 10px", background: "#EDFAF3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ background: "#D4F5E4", border: `1px solid #A8E6C4`, borderRadius: 6, padding: "10px", textAlign: "center", width: "100%" }}>
                      <div style={{ fontSize: "0.72rem", color: "#1A6640", fontFamily: T.font, marginBottom: 4 }}>SSEP ESOP</div>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 3 }}>
                        <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "#1A6640", fontFamily: T.font, lineHeight: 1 }}>10%</span>
                        <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "#4A9968", fontFamily: T.font }}>max</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Category totals ── */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "152px 1fr 1fr", border: `1.5px solid ${T.border}`, borderRadius: `0 0 ${T.radius} ${T.radius}`, overflow: "hidden", margin: "0 8px" }}>
                <div style={{ background: T.bg }} />
                <div style={{ padding: "10px 14px", textAlign: "center", borderRight: `1px solid ${T.border}`, background: "#DCEEFF" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: T.navy, fontFamily: T.font, marginBottom: 3 }}>Non-ESOP Total = 10%</div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 400, color: T.textSub, fontFamily: T.font, lineHeight: 1.5 }}>401(k) Pre-tax + 401(k) Roth + SSEP Pre-tax</div>
                </div>
                <div style={{ padding: "10px 14px", textAlign: "center", background: "#D4F5E4" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#1A6640", fontFamily: T.font, marginBottom: 3 }}>ESOP Total = 10%</div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 400, color: "#4A9968", fontFamily: T.font, lineHeight: 1.5 }}>ESOP Pre-tax + ESOP Roth + SSEP ESOP</div>
                </div>
              </div>

            </div>{/* end matrix grid */}

            {/* Overall 20% bar */}
            <div style={{ marginTop: 8, background: T.navy, borderRadius: T.radius, padding: "12px 24px", textAlign: "center" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "rgba(255,255,255,0.55)", fontFamily: T.font, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>
                401(k)/ESOP Plan + SSEP combined
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#FFFFFF", fontFamily: T.font, letterSpacing: "-0.03em", lineHeight: 1 }}>
                Overall Maximum = 20%
              </div>
            </div>

            {/* Collapsible example */}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => setShowExample(v => !v)}
                style={{
                  width: "100%", padding: "10px 14px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: T.surfaceAlt,
                  border: `1px solid ${T.border}`,
                  borderRadius: showExample ? `${T.radius} ${T.radius} 0 0` : T.radius,
                  cursor: "pointer", fontFamily: T.font, outline: "none",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.border; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = T.surfaceAlt; }}
              >
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: T.textSub, fontFamily: T.font }}>
                  See an Example
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                  style={{ flexShrink: 0, transform: showExample ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                  <path d="M2 4l4 4 4-4" stroke={T.textSub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {showExample && (
                <div style={{ background: "#F9FAFB", border: `1px solid ${T.border}`, borderTop: "none", borderRadius: `0 0 ${T.radius} ${T.radius}`, padding: "14px 16px" }}>

                  {/* What this example teaches */}
                  <div style={{ fontSize: "0.74rem", color: T.textMuted, fontFamily: T.font, lineHeight: 1.65, marginBottom: 10, fontStyle: "italic" }}>
                    This example shows how a column limit can be reached even when a plan row still has availability remaining.
                  </div>

                  {/* Scenario */}
                  <div style={{ fontSize: "0.74rem", color: T.textSub, fontFamily: T.font, lineHeight: 1.65, marginBottom: 14 }}>
                    An employee elects <strong style={{ color: T.text }}>6% to 401(k) Pre-tax</strong>, <strong style={{ color: T.text }}>4% to SSEP Pre-tax</strong>, and <strong style={{ color: T.text }}>5% to SSEP ESOP</strong>. Each limit is then checked independently.
                  </div>

                  {/* Check rows */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {[
                      { label: "401(k)/ESOP Plan row", used: 6, limit: 10, detail: "401(k) Pre-tax only", pass: true },
                      { label: "SSEP row", used: 9, limit: 10, detail: "SSEP Pre-tax (4%) + SSEP ESOP (5%)", pass: true },
                      { label: "Non-ESOP column", used: 10, limit: 10, detail: "401(k) Pre-tax (6%) + SSEP Pre-tax (4%)", pass: false },
                      { label: "ESOP column", used: 5, limit: 10, detail: "SSEP ESOP only", pass: true },
                      { label: "Overall total", used: 15, limit: 20, detail: "All elections combined", pass: true },
                    ].map((row, i, arr) => (
                      <div key={row.label} style={{
                        display: "flex", alignItems: "flex-start", gap: 10,
                        padding: "9px 0",
                        borderBottom: i < arr.length - 1 ? `1px solid ${T.border}` : "none",
                      }}>
                        <div style={{ flexShrink: 0, marginTop: 2, width: 14, height: 14, borderRadius: "50%", background: row.pass ? "rgba(26,102,64,0.1)" : "rgba(232,160,32,0.15)", border: `1.5px solid ${row.pass ? "#4A9968" : T.amber}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {row.pass
                            ? <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3.5 6L6.5 2" stroke="#1A6640" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            : <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M2 2L6 6M6 2L2 6" stroke={T.amber} strokeWidth="1.5" strokeLinecap="round"/></svg>
                          }
                        </div>
                        <div style={{ fontSize: "0.72rem", color: T.textSub, fontFamily: T.font, lineHeight: 1.6 }}>
                          <strong style={{ color: T.text }}>{row.label}:</strong>{" "}
                          {row.detail} — {row.used}% used of {row.limit}% allowed.{" "}
                          {row.pass
                            ? <span style={{ color: "#1A6640", fontWeight: 600 }}>{row.limit - row.used}% availability remains.</span>
                            : <span style={{ color: T.amber, fontWeight: 600 }}>Limit reached.</span>
                          }
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Conclusion callout */}
                  <div style={{ marginTop: 12, padding: "11px 13px", background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: T.radius }}>
                    <div style={{ fontSize: "0.72rem", color: T.textSub, fontFamily: T.font, lineHeight: 1.65 }}>
                      The SSEP row shows 1% of availability remaining — but that 1% cannot be used for SSEP Pre-tax, because SSEP Pre-tax is a Non-ESOP bucket and the Non-ESOP column is already at its limit.{" "}
                      <strong style={{ color: T.text }}>A row having availability does not mean you can use it. Column limits apply across both plans simultaneously.</strong>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* IRS dollar limit note */}
            <div style={{ marginTop: 8, padding: "9px 13px", background: T.skyLight, border: `1px solid ${T.skyBorder}`, borderRadius: T.radius }}>
              <div style={{ fontSize: "0.71rem", color: T.sky, fontFamily: T.font, lineHeight: 1.6 }}>
                <strong>Note:</strong> The 401(k)/ESOP Plan is also subject to IRS dollar limits — <strong>{fc(LIMIT_402G)} in elective deferrals</strong> for {PLAN_YEAR}{parseInt(age) >= 50 ? `, plus a ${parseInt(age) >= 60 && parseInt(age) <= 63 ? fc(LIMIT_CATCHUP_6063) + " enhanced catch-up (ages 60\u201363)" : fc(LIMIT_CATCHUP_50) + " catch-up contribution"}` : " (a catch-up contribution is available after age 50)"}. The SSEP has no IRS dollar limits.
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Layout */}
      <div style={{
        position: "relative", zIndex: 1,
        display: isMobile ? "flex" : "grid",
        flexDirection: isMobile ? "column" : undefined,
        gridTemplateColumns: isMobile ? undefined : "minmax(0, 440px) minmax(0, 1fr)",
        gap: 12, padding: "12px 16px", maxWidth: 1200, width: "100%",
        margin: "0 auto", boxSizing: "border-box", alignItems: "start",
      }}>

        {/* ── LEFT: Inputs ─────────────────────────────────────────────────── */}
        <div style={{ background: T.surface, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, boxShadow: T.shadowMd, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: isMobile ? "visible" : "auto", padding: "12px 16px 12px" }}>

            {/* Compensation */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textMuted, fontFamily: T.font, whiteSpace: "nowrap" }}>Compensation</span>
              <div style={{ flex: 1, height: 1, background: T.border }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }} className="mobile-stack">
              <div>
                <Label tooltip="Your annual base compensation, not including bonuses or other variable pay.">Base Compensation</Label>
                <Input value={baseSalary} onChange={(v) => { setBaseSalary(v); markDirty(); }} prefix="$" type="number" commas err={errors.base} inputRef={baseRef} />
                <FieldErr msg={errors.base} />
              </div>
              <div>
                <Label tooltip="Your age as of December 31 of this plan year. Ages 50–59 and 64+ are eligible for an $8,000 catch-up contribution. Ages 60–63 are eligible for an $11,250 enhanced catch-up.">Age</Label>
                <Input value={age} onChange={(v) => { setAge(v); markDirty(); }} type="number" integersOnly err={errors.age} inputRef={ageRef} placeholder="e.g. 45" />
                <FieldErr msg={errors.age} />
              </div>
            </div>

            {/* FICA question — 50+ and salary at or above $150,000 only */}
            {ficaVisible && (
              <div style={{ marginBottom: 10 }}>
                <Label tooltip={`Your prior-year FICA wages determine whether catch-up contributions must be Roth after-tax under IRS rules. You can find this amount in Box 3 of your ${PLAN_YEAR - 1} W-2.`}>
                  Were your {PLAN_YEAR - 1} FICA wages more than {FICA_THRESHOLD_DISPLAY}?
                </Label>
                <TogglePair
                  options={[
                    { label: `Yes — more than ${FICA_THRESHOLD_DISPLAY}`, val: true },
                    { label: `No — ${FICA_THRESHOLD_DISPLAY} or less`, val: false },
                  ]}
                  value={fica}
                  onChange={(v) => { setFica(v); markDirty(); }}
                  err={!!errors.fica}
                />
                <FieldErr msg={errors.fica} />
              </div>
            )}

            {/* ── Plan Accordions ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

              {/* 401(k) accordion */}
              <div>
                <ExpandRow
                  label="401(k) Savings"
                  tooltip="Your 401(k)/ESOP Plan is a qualified plan subject to IRS limits. Your 401(k) pre-tax and Roth after-tax contributions combined cannot exceed 10% of your compensation."
                  isOpen={show401k}
                  onToggle={() => setShow401k(v => !v)}
                  hasData={has401kData && !show401k}
                  onClear={() => {
                    setR401kPre(""); setR401kRoth("");
                    setYtd401kPre(""); setYtd401kRoth("");
                    markDirty();
                  }}
                  colors={{ active: T.navy, activeBg: T.navyLight, activeBorder: T.navyBorder }}
                  alwaysColor={true}
                />
                {show401k && (
                  <div style={{ border: `1.5px solid ${T.navyBorder}`, borderTop: "none", borderRadius: `0 0 ${T.radius} ${T.radius}`, padding: "10px 12px", background: T.surface }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }} className="mobile-stack">
                      <PctInput label="Pre-tax" value={r401kPre} accentColor={T.navy}
                        disabled={lock401kPre && p401kPre === 0}
                        disabledReason={usedQual >= MAX_QUALIFIED_PCT ? "Qualified plan limit reached" : usedNonEsop >= MAX_401K_PCT ? "Non-ESOP column limit reached" : usedTotal >= MAX_TOTAL_PCT ? "Overall 20% limit reached" : "401(k) 10% limit reached"}
                        onChange={(v) => handlePreTaxWithFicaCap(setR401kPre, p401kPre, [[used401k, MAX_401K_PCT], [usedQual, MAX_QUALIFIED_PCT], [usedNonEsop, MAX_401K_PCT], [usedTotal, MAX_TOTAL_PCT]], v)}
                        tooltip="Reduces your taxable income now; pay taxes later when withdrawn as ordinary income."
                      />
                      <PctInput label="Roth after-tax" value={r401kRoth} accentColor={T.navy}
                        disabled={lock401kRoth && p401kRoth === 0}
                        disabledReason={usedQual >= MAX_QUALIFIED_PCT ? "Qualified plan limit reached" : usedNonEsop >= MAX_401K_PCT ? "Non-ESOP column limit reached" : usedTotal >= MAX_TOTAL_PCT ? "Overall 20% limit reached" : "401(k) 10% limit reached"}
                        onChange={(v) => handleRateChange(setR401kRoth, p401kRoth, [[used401k, MAX_401K_PCT], [usedQual, MAX_QUALIFIED_PCT], [usedNonEsop, MAX_401K_PCT], [usedTotal, MAX_TOTAL_PCT]], v)}
                        tooltip="Pay taxes now; earnings are tax-free if Roth account open for at least 5 years AND withdrawn after age 59½ or due to death or disability."
                      />
                    </div>
                    <Divider label="Year-to-date contributed" tight />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="mobile-stack">
                      <div>
                        <div style={{ marginBottom: 4, fontSize: "0.78rem", fontWeight: 600, color: T.navy, fontFamily: T.font }}>Pre-tax</div>
                        <Input value={ytd401kPre} onChange={(v) => { setYtd401kPre(v); markDirty(); }} prefix="$" type="number" commas err={errors.ytd401kPre} inputRef={ytd401kPreRef} placeholder="0" />
                        <FieldErr msg={errors.ytd401kPre} />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: "0.78rem", fontWeight: 600, color: T.navy, fontFamily: T.font }}>Roth after-tax</div>
                        <Input value={ytd401kRoth} onChange={(v) => { setYtd401kRoth(v); markDirty(); }} prefix="$" type="number" commas err={errors.ytd401kRoth} inputRef={ytd401kRothRef} placeholder="0" />
                        <FieldErr msg={errors.ytd401kRoth} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ESOP accordion */}
              <div>
                <ExpandRow
                  label="ESOP Savings"
                  tooltip="Your ESOP pre-tax and Roth after-tax contributions combined cannot exceed 10% of your compensation. Your 401(k) and ESOP contributions also share an overall 10% combined limit for the 401(k)/ESOP Plan."
                  isOpen={showEsop}
                  onToggle={() => setShowEsop(v => !v)}
                  hasData={hasEsopData && !showEsop}
                  onClear={() => {
                    setREsopPre(""); setREsopRoth("");
                    setYtdEsopPre(""); setYtdEsopRoth("");
                    markDirty();
                  }}
                  colors={{ active: T.navy, activeBg: T.navyLight, activeBorder: T.navyBorder }}
                  alwaysColor={true}
                />
                {showEsop && (
                  <div style={{ border: `1.5px solid ${T.navyBorder}`, borderTop: "none", borderRadius: `0 0 ${T.radius} ${T.radius}`, padding: "10px 12px", background: T.surface }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }} className="mobile-stack">
                      <PctInput label="Pre-tax" value={rEsopPre} accentColor={T.navy}
                        disabled={lockEsopPre && pEsopPre === 0}
                        disabledReason={usedQual >= MAX_QUALIFIED_PCT ? "Qualified plan limit reached" : usedEsopCol >= MAX_ESOP_PCT ? "ESOP column limit reached" : usedTotal >= MAX_TOTAL_PCT ? "Overall 20% limit reached" : "ESOP 10% limit reached"}
                        onChange={(v) => handlePreTaxWithFicaCap(setREsopPre, pEsopPre, [[usedEsop, MAX_ESOP_PCT], [usedQual, MAX_QUALIFIED_PCT], [usedEsopCol, MAX_ESOP_PCT], [usedTotal, MAX_TOTAL_PCT]], v)}
                        tooltip="Reduces your taxable income now; pay taxes later when withdrawn as ordinary income."
                      />
                      <PctInput label="Roth after-tax" value={rEsopRoth} accentColor={T.navy}
                        disabled={lockEsopRoth && pEsopRoth === 0}
                        disabledReason={usedQual >= MAX_QUALIFIED_PCT ? "Qualified plan limit reached" : usedEsopCol >= MAX_ESOP_PCT ? "ESOP column limit reached" : usedTotal >= MAX_TOTAL_PCT ? "Overall 20% limit reached" : "ESOP 10% limit reached"}
                        onChange={(v) => handleRateChange(setREsopRoth, pEsopRoth, [[usedEsop, MAX_ESOP_PCT], [usedQual, MAX_QUALIFIED_PCT], [usedEsopCol, MAX_ESOP_PCT], [usedTotal, MAX_TOTAL_PCT]], v)}
                        tooltip="Pay taxes now; earnings are tax-free if Roth account open for at least 5 years AND withdrawn after age 59½ or due to death or disability."
                      />
                    </div>
                    <Divider label="Year-to-date contributed" tight />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="mobile-stack">
                      <div>
                        <div style={{ marginBottom: 4, fontSize: "0.78rem", fontWeight: 600, color: T.navy, fontFamily: T.font }}>Pre-tax</div>
                        <Input value={ytdEsopPre} onChange={(v) => { setYtdEsopPre(v); markDirty(); }} prefix="$" type="number" commas err={errors.ytdEsopPre} inputRef={ytdEsopPreRef} placeholder="0" />
                        <FieldErr msg={errors.ytdEsopPre} />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: "0.78rem", fontWeight: 600, color: T.navy, fontFamily: T.font }}>Roth after-tax</div>
                        <Input value={ytdEsopRoth} onChange={(v) => { setYtdEsopRoth(v); markDirty(); }} prefix="$" type="number" commas err={errors.ytdEsopRoth} inputRef={ytdEsopRothRef} placeholder="0" />
                        <FieldErr msg={errors.ytdEsopRoth} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SSEP accordion */}
              <div>
                <ExpandRow
                  label="Supplemental Savings and ESOP Plan (SSEP)"
                  tooltip="The SSEP is a non-qualified plan with no IRS limits. Your SSEP pre-tax and ESOP contributions combined cannot exceed 10% of compensation. Total deferral across all plans cannot exceed 20%."
                  isOpen={showSsep}
                  onToggle={() => setShowSsep(v => !v)}
                  hasData={hasSsepData && !showSsep}
                  onClear={() => {
                    setRSsepPre(""); setRSsepEsop("");
                    setYtdSsepPre(""); setYtdSsepEsop("");
                    markDirty();
                  }}
                  colors={{ active: T.navy, activeBg: T.navyLight, activeBorder: T.navyBorder }}
                  alwaysColor={true}
                />
                {showSsep && (
                  <div style={{ border: `1.5px solid ${T.navyBorder}`, borderTop: "none", borderRadius: `0 0 ${T.radius} ${T.radius}`, padding: "10px 12px", background: T.surface }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }} className="mobile-stack">
                      <PctInput label="Pre-tax" value={rSsepPre} accentColor={T.navy}
                        disabled={lockSsepPre && pSsepPre === 0}
                        disabledReason={usedSsep >= MAX_SSEP_PCT ? "SSEP 10% limit reached" : usedNonEsop >= MAX_401K_PCT ? "Non-ESOP column limit reached" : "Overall 20% limit reached"}
                        onChange={(v) => handleRateChange(setRSsepPre, pSsepPre, [[usedSsep, MAX_SSEP_PCT], [usedNonEsop, MAX_401K_PCT], [usedTotal, MAX_TOTAL_PCT]], v)}
                        tooltip="Reduces your taxable income now; pay taxes later when withdrawn as ordinary income."
                      />
                      <PctInput label="ESOP" value={rSsepEsop} accentColor={T.navy}
                        disabled={lockSsepEsop && pSsepEsop === 0}
                        disabledReason={usedSsep >= MAX_SSEP_PCT ? "SSEP 10% limit reached" : usedEsopCol >= MAX_ESOP_PCT ? "ESOP column limit reached" : "Overall 20% limit reached"}
                        onChange={(v) => handleRateChange(setRSsepEsop, pSsepEsop, [[usedSsep, MAX_SSEP_PCT], [usedEsopCol, MAX_ESOP_PCT], [usedTotal, MAX_TOTAL_PCT]], v)}
                        tooltip="Reduces your taxable income now; pay taxes later when withdrawn as ordinary income."
                      />
                    </div>
                    <Divider label="Year-to-date contributed" tight />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="mobile-stack">
                      <div>
                        <div style={{ marginBottom: 4, fontSize: "0.78rem", fontWeight: 600, color: T.navy, fontFamily: T.font }}>Pre-tax</div>
                        <Input value={ytdSsepPre} onChange={(v) => { setYtdSsepPre(v); markDirty(); }} prefix="$" type="number" commas placeholder="0" />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: "0.78rem", fontWeight: 600, color: T.navy, fontFamily: T.font }}>ESOP</div>
                        <Input value={ytdSsepEsop} onChange={(v) => { setYtdSsepEsop(v); markDirty(); }} prefix="$" type="number" commas placeholder="0" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Qualified combined + grand total status lines */}
            {anyRateEntered && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6, marginBottom: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 12px", background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: T.radius }}>
                  <span style={{ fontSize: "0.68rem", color: T.textSub, fontFamily: T.font }}>401(k)/ESOP Plan</span>
                  <BudgetPill used={usedQual} max={MAX_QUALIFIED_PCT} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 12px", background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: T.radius }}>
                  <span style={{ fontSize: "0.68rem", color: T.textSub, fontFamily: T.font }}>Non-ESOP column</span>
                  <BudgetPill used={usedNonEsop} max={MAX_401K_PCT} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 12px", background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: T.radius }}>
                  <span style={{ fontSize: "0.68rem", color: T.textSub, fontFamily: T.font }}>ESOP column</span>
                  <BudgetPill used={usedEsopCol} max={MAX_ESOP_PCT} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 12px", background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: T.radius }}>
                  <span style={{ fontSize: "0.68rem", color: T.textSub, fontFamily: T.font }}>All Plans Combined</span>
                  <BudgetPill used={usedTotal} max={MAX_TOTAL_PCT} />
                </div>
              </div>
            )}

          </div>{/* end scrollable padding div */}

          {/* Sticky Actions Footer */}
          <div style={{ flexShrink: 0, padding: "12px 16px", borderTop: `1px solid ${T.border}`, background: T.surface, display: "flex", gap: 6 }}>
            <button
              type="button" onClick={calculate}
              style={{
                flex: 1, padding: "10px 14px",
                background: isDirty ? "#6B7280" : T.btn, color: "#FFF",
                border: "none", borderRadius: T.radius, fontSize: "0.85rem",
                fontWeight: 700, fontFamily: T.font, cursor: "pointer",
                transition: "background 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = isDirty ? "#4B5563" : T.btnHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = isDirty ? "#6B7280" : T.btn)}
            >
              {isDirty
                ? (<><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" /><path d="M6.5 3.5v3.2l2 1.2" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round" /></svg> Recalculate</>)
                : "Calculate →"}
            </button>
            {calculated && (
              <button
                type="button" onClick={clearAll}
                style={{ padding: "10px 16px", background: T.surfaceAlt, color: T.textSub, border: `1.5px solid ${T.border}`, borderRadius: T.radius, fontSize: "0.8rem", fontWeight: 600, fontFamily: T.font, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.border; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = T.surfaceAlt; }}
              >Clear</button>
            )}
          </div>
        </div>

        {/* ── RIGHT: Results ────────────────────────────────────────────────── */}
        <div ref={resultsRef} style={{ position: "relative" }}>

          {/* Dirty overlay */}
          {isDirty && result && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 10,
              background: "rgba(240,245,251,0.88)", backdropFilter: "blur(3px)",
              borderRadius: T.radiusLg, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                background: T.surface, borderRadius: T.radiusLg, border: `1px solid ${T.border}`,
                boxShadow: T.shadowMd, padding: "20px 28px", textAlign: "center", maxWidth: 280,
              }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: T.text, fontFamily: T.font, marginBottom: 8 }}>
                  Your information has changed
                </div>
                <div style={{ fontSize: "0.78rem", color: T.textSub, fontFamily: T.font, marginBottom: 14, lineHeight: 1.5 }}>
                  Recalculate to update your results.
                </div>
                <button type="button" onClick={calculate}
                  style={{ padding: "9px 20px", fontSize: "0.85rem", fontWeight: 700, fontFamily: T.font, color: "#FFFFFF", background: T.btn, border: "none", borderRadius: T.radius, cursor: "pointer" }}>
                  Recalculate
                </button>
              </div>
            </div>
          )}

          {/* Pay Schedule card */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ background: T.surface, borderRadius: T.radius, border: `1px solid ${T.border}`, boxShadow: T.shadow, overflow: "hidden" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textSub, fontFamily: T.font, padding: "7px 16px 6px", borderBottom: `1px solid ${T.border}` }}>
                Pay Schedule
              </div>
              <div style={{ padding: "7px 16px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: T.font }}>
                  <span style={{ fontSize: "0.78rem", color: T.textSub }}>Paychecks remaining</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: T.text }}>{periodsLeft} of {periodsTotal}</span>
                </div>
                {nextPayday && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: T.font }}>
                    <span style={{ fontSize: "0.78rem", color: T.textSub }}>Next payday</span>
                    <span style={{ fontSize: "0.78rem", fontWeight: cutoffPassed ? 400 : 600, color: cutoffPassed ? T.textMuted : T.text }}>
                      {cutoffPassed
                        ? <>{fmtPayday(nextPayday)} <span style={{ fontWeight: 400, color: T.textMuted }}>{" — deadline passed"}</span></>
                        : fmtPayday(nextPayday)}
                    </span>
                  </div>
                )}
                {cutoffPassed && firstEligiblePayday && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: T.font }}>
                    <span style={{ fontSize: "0.78rem", color: T.textSub }}>Next available payday</span>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: T.text }}>{fmtPayday(firstEligiblePayday)}</span>
                  </div>
                )}
                {(cutoffPassed ? firstEligibleCutoff : cutoffDate) && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: T.font }}>
                    <span style={{ fontSize: "0.78rem", color: T.textSub }}>Change deadline</span>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: T.text }}>{fmtCutoff(cutoffPassed ? firstEligibleCutoff : cutoffDate)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ background: T.surface, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, boxShadow: T.shadowMd, padding: "12px 16px" }}>

            {!result || isCalculating ? (
              <EmptyResults isCalculating={isCalculating} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* Availability stat cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }} className="mobile-stack">

                  {/* Card 1: 401(k)/ESOP Plan */}
                  {(() => {
                    const buckets = [
                      { label: "401(k) Pre-tax",  avail: result.avail401kPre },
                      { label: "401(k) Roth",      avail: result.avail401kRoth },
                      { label: "ESOP Pre-tax",     avail: result.availEsopPre },
                      { label: "ESOP Roth",        avail: result.availEsopRoth },
                    ];
                    return (
                      <div style={{ background: T.surface, border: `1px solid ${T.navyBorder}`, borderRadius: T.radius, padding: "10px 12px" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: T.navy, fontFamily: T.font, marginBottom: 8, textAlign: "center" }}>401(k)/ESOP Plan</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {buckets.map(b => {
                            const atLimit = b.avail < 0.05;
                            return (
                              <div key={b.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                <span style={{ fontSize: "0.72rem", color: T.textSub, fontFamily: T.font }}>{b.label}</span>
                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: atLimit ? T.green : T.navy, fontFamily: T.font }}>
                                  {atLimit ? "Limit reached" : `${Math.floor(b.avail)}% available`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Card 2: SSEP */}
                  {(() => {
                    const rows = [
                      { label: "Pre-tax", avail: result.availSsepPre },
                      { label: "ESOP",    avail: result.availSsepEsop },
                    ];
                    return (
                      <div style={{ background: T.surface, border: `1px solid ${T.navyBorder}`, borderRadius: T.radius, padding: "10px 12px" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: T.navy, fontFamily: T.font, marginBottom: 8, textAlign: "center" }}>SSEP</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {rows.map(r => {
                            const atLimit = r.avail < 0.05;
                            return (
                              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                                <span style={{ fontSize: "0.72rem", color: T.textSub, fontFamily: T.font }}>{r.label}</span>
                                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: atLimit ? T.green : T.navy, fontFamily: T.font }}>
                                  {atLimit ? "Limit reached" : `${Math.floor(r.avail)}% available`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Card 3: All Plans Combined */}
                  {(() => {
                    const avail = result.availOverall;
                    const atLimit = avail < 0.05;
                    return (
                      <div style={{ background: T.surface, border: `1px solid ${T.navyBorder}`, borderRadius: T.radius, padding: "10px 12px" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: T.navy, fontFamily: T.font, marginBottom: 8, textAlign: "center" }}>All Plans Combined</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <span style={{ fontSize: "0.72rem", color: T.textSub, fontFamily: T.font }}>{result.elGrandTotal}% of {MAX_TOTAL_PCT}% used</span>
                            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: atLimit ? T.green : T.navy, fontFamily: T.font }}>
                              {atLimit ? "Limit reached" : `${Math.floor(avail)}% available`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>

                {/* 402(g) warning */}
                {result.electiveOver402g > 0 && (
                  <NoteBox color={T.amber} bg={T.amberLight} border={T.amberBorder}>
                    <strong>Annual contribution limit exceeded:</strong> Your elected qualified plan contributions of {fc(result.electiveEmployee + result.ytdQualTotal)} exceed the {result.catchUp > 0 ? `${fc(result.electiveLimit)} limit (${fc(LIMIT_402G)} base + ${fc(result.catchUp)} catch-up)` : `${fc(LIMIT_402G)} annual limit`} for {PLAN_YEAR} by {fc(result.electiveOver402g)}. Please adjust your rates to stay within the limit.
                  </NoteBox>
                )}

                {/* Qualified ESOP card — always shown after calculation */}
                <div style={{ border: `1px solid ${T.navyBorder}`, borderRadius: T.radius, overflow: "hidden" }}>
                  <div style={{ padding: "8px 14px 6px", background: T.navyLight, borderBottom: `1px solid ${T.navyBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 700, color: T.navy, fontFamily: T.font }}>401(k)/ESOP Plan</span>
                  </div>

                  {result.hasQualContribs && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, background: T.navyBorder }}>
                      {[
                        { label: "401(k) Pre-tax", pct: result.el401kPre, dollars: result.d401kPre, ytd: result.ytd401kPre },
                        { label: "401(k) Roth after-tax", pct: result.el401kRoth, dollars: result.d401kRoth, ytd: result.ytd401kRoth },
                        { label: "ESOP Pre-tax", pct: result.elEsopPre, dollars: result.dEsopPre, ytd: result.ytdEsopPre },
                        { label: "ESOP Roth after-tax", pct: result.elEsopRoth, dollars: result.dEsopRoth, ytd: result.ytdEsopRoth },
                      ].map((cell) => (
                        <PlanCell key={cell.label} {...cell} periodsLeft={periodsLeft} />
                      ))}
                    </div>
                  )}

                  {/* Roth catch-up required NoteBox - only when FICA catchup is in play */}
                  {result.catchUpInPlay && (
                    <div style={{ padding: "10px 12px" }}>
                      <NoteBox color={T.sky} bg={T.skyLight} border={T.skyBorder}>
                        <strong>Catch-up contributions must be Roth after-tax.</strong> Because your prior-year FICA wages exceeded {FICA_THRESHOLD_DISPLAY}, your {PLAN_YEAR} catch-up contributions of {fc(result.catchUp)} must be Roth. Your {fc(LIMIT_402G)} base limit may be any mix of pre-tax and Roth.
                      </NoteBox>
                    </div>
                  )}

                  <DetailPanel
                    label="View Calculation Details"
                    isOpen={showQualDetail} onToggle={() => setShowQualDetail(v => !v)}
                  >
                      <Divider label="Contribution Limits" />
                      <SummaryLine label="Annual limit" value={fc(LIMIT_402G)} />
                      {result.catchUp > 0 && (
                        <>
                          <SummaryLine label={`Catch-up (${result.is6063 ? "ages 60–63" : "age 50+"})`} value={fc(result.catchUp)} />
                          <SummaryLine label="Total limit" value={fc(result.electiveLimit)} bold />
                        </>
                      )}
                      {result.ytdQualTotal > 0 && (
                        <>
                          <SummaryLine label="Contributed (YTD)" value={fc(result.ytdQualTotal)} dimmed />
                          <SummaryLine label="Remaining this year" value={fc(result.effectiveQualLimit)} bold />
                        </>
                      )}

                      <Divider label="Contributions" />
                      {result.ytdQualTotal > 0 && (
                        <>
                          <SummaryLine label="401(k) pre-tax (YTD)" value={fc(result.ytd401kPre)} indent dimmed />
                          <SummaryLine label="401(k) Roth after-tax (YTD)" value={fc(result.ytd401kRoth)} indent dimmed />
                          <SummaryLine label="ESOP pre-tax (YTD)" value={fc(result.ytdEsopPre)} indent dimmed />
                          <SummaryLine label="ESOP Roth after-tax (YTD)" value={fc(result.ytdEsopRoth)} indent dimmed />
                        </>
                      )}
                      {result.hasQualContribs ? (
                        <>
                          {result.d401kPre > 0 && <SummaryLine label="401(k) pre-tax" value={fc(result.d401kPre)} indent />}
                          {result.d401kRoth > 0 && <SummaryLine label="401(k) Roth after-tax" value={fc(result.d401kRoth)} indent />}
                          {result.dEsopPre > 0 && <SummaryLine label="ESOP pre-tax" value={fc(result.dEsopPre)} indent />}
                          {result.dEsopRoth > 0 && <SummaryLine label="ESOP Roth after-tax" value={fc(result.dEsopRoth)} indent />}
                          <SummaryLine label="Total" value={fc(result.dQualEmployee)} bold />
                        </>
                      ) : (
                        <div style={{ fontSize: "0.72rem", color: T.textMuted, fontFamily: T.font, paddingLeft: 12, paddingBottom: 4 }}>
                          No contribution rates entered.
                        </div>
                      )}



                      {periodsLeft > 0 && result.dQualEmployee > 0 && (
                        <>
                          <Divider label="Per Paycheck" />
                          {result.d401kPre > 0 && <SummaryLine label="401(k) pre-tax" value={fc(Math.max(result.d401kPre - result.ytd401kPre, 0) / periodsLeft)} indent />}
                          {result.d401kRoth > 0 && <SummaryLine label="401(k) Roth after-tax" value={fc(Math.max(result.d401kRoth - result.ytd401kRoth, 0) / periodsLeft)} indent />}
                          {result.dEsopPre > 0 && <SummaryLine label="ESOP pre-tax" value={fc(Math.max(result.dEsopPre - result.ytdEsopPre, 0) / periodsLeft)} indent />}
                          {result.dEsopRoth > 0 && <SummaryLine label="ESOP Roth after-tax" value={fc(Math.max(result.dEsopRoth - result.ytdEsopRoth, 0) / periodsLeft)} indent />}
                          <SummaryLine label="Total per paycheck" value={fc(Math.max(result.dQualEmployee - result.ytdQualTotal, 0) / periodsLeft)} bold />
                        </>
                      )}

                      <ProjectionBlock totalComp={result.totalComp} age={result.age} fica={fica} />
                    </DetailPanel>
                </div>

                {/* SSEP card */}
                {result.hasSsepContribs && (
                  <div style={{ border: `1px solid ${T.navyBorder}`, borderRadius: T.radius, overflow: "hidden" }}>
                    <div style={{ padding: "8px 14px 6px", background: T.navyLight, borderBottom: `1px solid ${T.navyBorder}` }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: T.navy, fontFamily: T.font }}>Supplemental Savings Plan (SSEP)</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: T.navyBorder }}>
                      {[
                        { label: "SSEP Pre-tax", pct: result.elSsepPre, dollars: result.dSsepPre, ytd: result.ytdSsepPre },
                        { label: "SSEP ESOP", pct: result.elSsepEsop, dollars: result.dSsepEsop, ytd: result.ytdSsepEsop },
                      ].map((cell) => (
                        <PlanCell key={cell.label} {...cell} periodsLeft={periodsLeft} />
                      ))}
                    </div>

                    <DetailPanel
                      label="View Calculation Details"
                      isOpen={showSsepDetail} onToggle={() => setShowSsepDetail(v => !v)}
                    >
                      <Divider label="Contributions" />
                      {result.ytdSsepTotal > 0 && (
                        <>
                          <SummaryLine label="SSEP pre-tax (YTD)" value={fc(result.ytdSsepPre)} indent dimmed />
                          <SummaryLine label="SSEP ESOP (YTD)" value={fc(result.ytdSsepEsop)} indent dimmed />
                        </>
                      )}
                      <SummaryLine label="SSEP pre-tax" value={fc(result.dSsepPre)} indent />
                      <SummaryLine label="SSEP ESOP" value={fc(result.dSsepEsop)} indent />
                      <SummaryLine label="Total" value={fc(result.dSsepTotal)} bold />



                      {periodsLeft > 0 && result.dSsepTotal > 0 && (
                        <>
                          <Divider label="Per Paycheck" />
                          {result.dSsepPre > 0 && <SummaryLine label="SSEP pre-tax" value={fc(Math.max(result.dSsepPre - result.ytdSsepPre, 0) / periodsLeft)} indent />}
                          {result.dSsepEsop > 0 && <SummaryLine label="SSEP ESOP" value={fc(Math.max(result.dSsepEsop - result.ytdSsepEsop, 0) / periodsLeft)} indent />}
                          <SummaryLine label="Total per paycheck" value={fc(Math.max(result.dSsepTotal - result.ytdSsepTotal, 0) / periodsLeft)} bold />
                        </>
                      )}
                    </DetailPanel>
                  </div>
                )}

                {/* Collapsible total summary */}
                <SummaryPanel isOpen={showTotalSummary} onToggle={() => setShowTotalSummary(v => !v)}>
                  {result.hasQualContribs && <SummaryLine label="401(k)/ESOP" value={fc(result.dQualEmployee)} />}
                  {result.hasSsepContribs && <SummaryLine label="SSEP" value={fc(result.dSsepTotal)} />}
                  {result.dEmployeeTotal > 0 && <SummaryLine label="Total contributions" value={fc(result.dEmployeeTotal)} bold />}
                  <div style={{ marginTop: 8, fontSize: "0.68rem", color: T.textMuted, fontFamily: T.font, lineHeight: 1.5 }}>
                    Annual estimates based on {fc(result.base)} base compensation. Actual contributions may vary.
                  </div>
                </SummaryPanel>

              </div>
            )}
          </div>

          {/* Disclaimer footer */}
          <div style={{ padding: "8px 4px" }}>
            <div style={{ fontSize: "0.64rem", color: T.textMuted, lineHeight: 1.55, fontFamily: T.font }}>
              Pay schedule from the TDIndustries {PLAN_YEAR} weekly payroll calendar. Contribution amounts rounded to the nearest dollar. Rates rounded up to nearest whole %. Based on {PLAN_YEAR} IRS limits. For educational use only — not financial or tax advice.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
