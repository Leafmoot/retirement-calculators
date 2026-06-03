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

  // TDI Sky Blue — used for 401(k) plan
  sky: "#07A3DA", skyLight: "#DBF4FF", skyBorder: "#7DD3F0",

  // TDI Green — used for ESOP plan & totals
  green: "#3A8A4E", greenLight: "#E8F5EB", greenBorder: "#A3CFAe",

  // TDI Amber/Gold — warnings, spillover
  amber: "#E8A020", amberLight: "#FFF8E6", amberBorder: "#F5CE80",

  // Error
  red: "#DC2626", redLight: "#FEF2F2",

  // Button — TDI navy
  btn: "#1B3A6B", btnHover: "#152D55", btnLight: "#EAF2FB", btnBorder: "#B8D4F0",

  // SSEP supplemental — TDI amber/gold for clear differentiation from sky blue and green
  ssep: "#B8630A", ssepLight: "#FFF4E6", ssepBorder: "#F5C87A",

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
    <div style={{ marginBottom: 4, minHeight: 20, display: "flex", alignItems: "center" }}>
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

function Input({ value, onChange, placeholder, type = "text", prefix, suffix, err, inputRef, disabled, integersOnly = false }) {
  const handleChange = (e) => {
    if (disabled) return;
    const v = e.target.value;
    if (type === "number") {
      if (v === "") { onChange(""); return; }
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

function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 10px" }}>
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
          {isCalculating ? "Calculating…" : "See Your Contribution Limits"}
        </div>
        {!isCalculating && (
          <div style={{ fontSize: "0.78rem", color: T.textSub, fontFamily: T.font, textAlign: "center", lineHeight: 1.55 }}>
            Enter your compensation and contribution rates to see how much you can save across both plans.
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
      <div style={{ marginBottom: 4, minHeight: 20, display: "flex", alignItems: "center" }}>
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
          color: T.textSub, background: T.surfaceAlt, border: "none",
          outline: "none", cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          letterSpacing: "-0.01em",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = T.border)}
        onMouseLeave={(e) => (e.currentTarget.style.background = T.surfaceAlt)}
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
  const [incentive, setIncentive]   = useState("");
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
  const [show415cDetail, setShow415cDetail]   = useState(false);
  const [showTotalSummary, setShowTotalSummary] = useState(false);
  const [showLimitsGuide, setShowLimitsGuide] = useState(false);

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
  const parsedBase = parse(baseSalary) + parse(incentive);
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
  const p401kRoth = parsePct(r401kRoth);
  const pEsopPre  = parsePct(rEsopPre);
  const pEsopRoth = parsePct(rEsopRoth);
  const pSsepPre  = parsePct(rSsepPre);
  const pSsepEsop = parsePct(rSsepEsop);

  const used401k  = p401kPre + p401kRoth;
  const usedEsop  = pEsopPre + pEsopRoth;
  const usedQual  = used401k + usedEsop;
  const usedSsep  = pSsepPre + pSsepEsop;
  const usedTotal = usedQual + usedSsep;

  // ── Live dollar preview ─────────────────────────────────────────────────
  const liveComp        = parse(baseSalary) + parse(incentive);
  const liveSsepDollars = liveComp > 0 ? liveComp * (usedSsep / 100) : 0;
  const liveCatchUp     = parseInt(age) >= 50 ? getCatchUp(parseInt(age)) : 0;
  const liveElectiveLimit = LIMIT_402G + liveCatchUp;

  // YTD parsed amounts
  const ytd401kPreAmt  = parse(ytd401kPre);
  const ytd401kRothAmt = parse(ytd401kRoth);
  const ytdEsopPreAmt  = parse(ytdEsopPre);
  const ytdEsopRothAmt = parse(ytdEsopRoth);
  const ytdQualTotal   = ytd401kPreAmt + ytd401kRothAmt + ytdEsopPreAmt + ytdEsopRothAmt;

  // Remaining room under 402(g) after YTD, expressed as a percentage ceiling
  const effectiveElectiveLimit = Math.max(liveElectiveLimit - ytdQualTotal, 0);

  // 402(g) dollar ceiling expressed as a percentage of total comp.
  // When comp is zero or not entered, set to a large number so it never blocks input.
  const maxQualPct = liveComp > 0
    ? Math.floor((effectiveElectiveLimit / liveComp) * 10000) / 100
    : 9999;

  const lock401kPre  = (used401k >= MAX_401K_PCT) || (usedQual >= MAX_QUALIFIED_PCT) || (usedTotal >= MAX_TOTAL_PCT) || (usedQual >= maxQualPct);
  const lock401kRoth = (used401k >= MAX_401K_PCT) || (usedQual >= MAX_QUALIFIED_PCT) || (usedTotal >= MAX_TOTAL_PCT) || (usedQual >= maxQualPct);
  const lockEsopPre  = (usedEsop >= MAX_ESOP_PCT) || (usedQual >= MAX_QUALIFIED_PCT) || (usedTotal >= MAX_TOTAL_PCT) || (usedQual >= maxQualPct);
  const lockEsopRoth = (usedEsop >= MAX_ESOP_PCT) || (usedQual >= MAX_QUALIFIED_PCT) || (usedTotal >= MAX_TOTAL_PCT) || (usedQual >= maxQualPct);
  const lockSsepPre  = (usedSsep >= MAX_SSEP_PCT) || (usedTotal >= MAX_TOTAL_PCT);
  const lockSsepEsop = (usedSsep >= MAX_SSEP_PCT) || (usedTotal >= MAX_TOTAL_PCT);

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
  const ficaPreTaxCapActive = fica === true && liveCatchUp > 0;
  const ytdPreTaxOnly = ytd401kPreAmt + ytdEsopPreAmt;
  const effectivePreTaxLimit = Math.max(LIMIT_402G - ytdPreTaxOnly, 0);

  function handlePreTaxWithFicaCap(setter, fieldUsed, bucketChecks, newVal, otherPreTaxPct, rothSetter) {
    if (!ficaPreTaxCapActive) {
      handleRateChange(setter, fieldUsed, bucketChecks, newVal);
      return;
    }

    const raw = newVal === "" ? 0 : parsePct(newVal);

    // How much pre-tax room remains after the other pre-tax field's share?
    const otherPreTaxDollars = liveComp > 0 ? liveComp * (otherPreTaxPct / 100) : 0;
    const remainingPreTaxRoom = Math.max(effectivePreTaxLimit - otherPreTaxDollars, 0);
    // Floor — cannot let even one cent of catch-up go pre-tax
    const fieldPreTaxMaxPct = liveComp > 0
      ? Math.floor((remainingPreTaxRoom / liveComp) * 10000) / 100
      : 9999;

    let snappedPreTax = Math.min(raw, fieldPreTaxMaxPct);
    // Also enforce standard plan/total bucket checks
    for (const [bucketUsed, bucketMax] of bucketChecks) {
      const otherContrib = bucketUsed - fieldUsed;
      if (snappedPreTax + otherContrib > bucketMax) {
        const maxAllowed = Math.max(bucketMax - otherContrib, 0);
        snappedPreTax = Math.min(snappedPreTax, Math.ceil(maxAllowed));
      }
    }

    setter(snappedPreTax === 0 && newVal === "" ? "" : String(Math.floor(snappedPreTax)));

    // Overflow must go to Roth for the same plan
    if (raw > snappedPreTax && liveComp > 0) {
      const overflowDollars = (raw - snappedPreTax) * (liveComp / 100);
      const snappedPreTaxDollars = snappedPreTax * (liveComp / 100);
      const effectiveElectiveLimit = Math.max(liveElectiveLimit - ytdQualTotal, 0);
      const rothSpillDollars = Math.min(overflowDollars, effectiveElectiveLimit - snappedPreTaxDollars - otherPreTaxDollars);
      const rothSpillPct = Math.ceil((Math.max(rothSpillDollars, 0) / liveComp) * 10000) / 100;
      rothSetter(rothSpillPct <= 0 ? "" : String(Math.ceil(rothSpillPct)));
    }

    markDirty();
  }

  // ── Budget status label ──────────────────────────────────────────────────
  function BudgetPill({ used, max }) {
    const full = used >= max;
    const remaining = Math.max(max - used, 0);
    return (
      <span style={{
        fontSize: "0.68rem", fontFamily: T.font,
        color: full ? T.green : T.textMuted,
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
    const incv = parse(incentive);
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

      const totalComp     = base + incv;
      const catchUp       = getCatchUp(a);
      const is6063        = a >= 60 && a <= 63;
      const electiveLimit = LIMIT_402G + catchUp;

      const el401kPre  = Math.min(p401kPre,  MAX_401K_PCT);
      const el401kRoth = Math.min(p401kRoth, Math.max(MAX_401K_PCT - el401kPre, 0));
      const elEsopPre  = Math.min(pEsopPre,  MAX_ESOP_PCT);
      const elEsopRoth = Math.min(pEsopRoth, Math.max(MAX_ESOP_PCT - elEsopPre, 0));
      const el401kCombined = el401kPre + el401kRoth;
      const elEsopCombined = elEsopPre + elEsopRoth;
      const elQualTotal    = el401kCombined + elEsopCombined;
      const elSsepPre      = Math.min(pSsepPre,  MAX_SSEP_PCT);
      const elSsepEsop     = Math.min(pSsepEsop, Math.max(MAX_SSEP_PCT - elSsepPre, 0));
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
      // Scale individual field dollars proportionally if cap trims the total
      const qualScale     = dQualRaw > 0 ? dQualEmployee / dQualRaw : 1;
      const d401kPreFinal  = d401kPre  * qualScale;
      const d401kRothFinal = d401kRoth * qualScale;
      const dEsopPreFinal  = dEsopPre  * qualScale;
      const dEsopRothFinal = dEsopRoth * qualScale;
      const dSsepPre      = totalComp * (elSsepPre  / 100);
      const dSsepEsop     = totalComp * (elSsepEsop / 100);
      const dSsepTotal    = dSsepPre + dSsepEsop;
      const dEmployeeTotal = dQualEmployee + dSsepTotal;

      // SSEP YTD — informational only
      const ytdSsepPreAmt  = parse(ytdSsepPre);
      const ytdSsepEsopAmt = parse(ytdSsepEsop);
      const ytdSsepTotal   = ytdSsepPreAmt + ytdSsepEsopAmt;

      const electiveEmployee = dQualEmployee;
      const electiveOver402g = Math.max(electiveEmployee - effectiveQualLimit, 0);

      const dMatchQual  = dQualEmployee;
      const dMatchSsep  = dSsepTotal;
      const dMatchTotal = dMatchQual + dMatchSsep;

      const total415cQual        = dQualEmployee + dMatchQual;
      const over415c             = Math.max(total415cQual - LIMIT_415C, 0);
      const spilloverExcessBenefit = over415c;
      const qualMatchNet         = Math.max(dMatchQual - over415c, 0);
      const grandTotalSaved      = dEmployeeTotal + dMatchTotal;

      // ── FICA / Roth catch-up note ────────────────────────────────────────
      const d401kTotal        = d401kPreFinal + d401kRothFinal;
      const ficaRothRequired  = catchUp > 0 && fica === true;
      // Catch-up is in play when FICA requires Roth AND projected 401(k) dollars
      // (including what's already been contributed) exceed the standard limit
      const total401kWithYtd  = d401kTotal + ytd401kPreAmt + ytd401kRothAmt;
      const catchUpInPlay     = ficaRothRequired && total401kWithYtd > LIMIT_402G;
      const catchUpRemaining  = Math.max(catchUp - (ytd401kRothAmt), 0);
      const rothCatchUpPct    = totalComp > 0
        ? Math.ceil((catchUpRemaining / totalComp) * 10000) / 100
        : 0;

      setResult({
        base, incv, totalComp, age: a, catchUp, is6063, electiveLimit,
        el401kPre, el401kRoth, elEsopPre, elEsopRoth,
        el401kCombined, elEsopCombined, elQualTotal,
        elSsepPre, elSsepEsop, elSsepTotal, elGrandTotal,
        d401kPre: d401kPreFinal, d401kRoth: d401kRothFinal,
        dEsopPre: dEsopPreFinal, dEsopRoth: dEsopRothFinal,
        dQualEmployee, dSsepPre, dSsepEsop, dSsepTotal, dEmployeeTotal,
        dMatchQual, dMatchSsep, dMatchTotal, qualMatchNet,
        electiveEmployee, electiveOver402g,
        total415cQual, over415c, spilloverExcessBenefit,
        grandTotalSaved,
        // YTD values passed through for results display
        ytd401kPre: ytd401kPreAmt, ytd401kRoth: ytd401kRothAmt,
        ytdEsopPre: ytdEsopPreAmt, ytdEsopRoth: ytdEsopRothAmt,
        ytdQualTotal, ytdSsepPre: ytdSsepPreAmt, ytdSsepEsop: ytdSsepEsopAmt, ytdSsepTotal,
        effectiveQualLimit,
        has415cSpillover: over415c > 0,
        hasQualContribs: dQualEmployee > 0,
        hasSsepContribs: dSsepTotal > 0,
        fica,
        catchUpInPlay,
        rothCatchUpPct,
      });

      if (isMobile && resultsRef.current) {
        setTimeout(() => resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    }, 650);
  }

  function clearAll() {
    setBaseSalary(""); setIncentive(""); setAge("");
    setFica(null);
    setR401kPre(""); setR401kRoth(""); setREsopPre(""); setREsopRoth("");
    setRSsepPre(""); setRSsepEsop("");
    setYtd401kPre(""); setYtd401kRoth(""); setYtdEsopPre(""); setYtdEsopRoth("");
    setYtdSsepPre(""); setYtdSsepEsop("");
    setResult(null); setErrors({ base: "", age: "", fica: "", ytd401kPre: "", ytd401kRoth: "", ytdEsopPre: "", ytdEsopRoth: "" });
    setCalculated(false); setIsDirty(false); setIsCalculating(false);
    setShowQualDetail(false); setShowSsepDetail(false);
    setShow415cDetail(false); setShowTotalSummary(false);
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
        @media(max-width:640px){.mobile-stack{grid-template-columns:1fr!important}}
      `}</style>

      {/* Subtle noise */}
      <div style={{ position: "fixed", inset: 0, opacity: 0.02, pointerEvents: "none", zIndex: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 1, flexShrink: 0, padding: "10px 20px 8px", borderBottom: `1px solid ${T.border}`, background: T.navy, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? "1rem" : "1.1rem", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.02em" }}>
          TDIndustries Contribution Assistant
        </h1>
        <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", fontFamily: T.font }}>{PLAN_YEAR}</span>
      </div>

      {/* ── How the Limits Work — collapsible guide ── */}
      <div style={{ position: "relative", zIndex: 1, padding: "8px 16px 0", maxWidth: 1200, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <button
          type="button"
          onClick={() => setShowLimitsGuide(v => !v)}
          aria-expanded={showLimitsGuide}
          aria-label="How the Contribution Limits Work"
          style={{
            width: "100%", padding: "9px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: showLimitsGuide ? T.navy : T.surface,
            border: `1px solid ${showLimitsGuide ? T.navy : T.border}`,
            borderRadius: showLimitsGuide ? `${T.radius} ${T.radius} 0 0` : T.radius,
            cursor: "pointer", fontFamily: T.font, outline: "none",
            transition: "all 0.2s",
            boxShadow: showLimitsGuide ? "none" : T.shadow,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="4" width="4" height="8" rx="1" fill={showLimitsGuide ? "rgba(255,255,255,0.5)" : T.navyBorder} />
              <rect x="6" y="4" width="4" height="8" rx="1" fill={showLimitsGuide ? "rgba(255,255,255,0.7)" : T.borderStrong} />
              <rect x="11" y="4" width="4" height="8" rx="1" fill={showLimitsGuide ? "rgba(255,255,255,0.9)" : T.navy} />
            </svg>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: showLimitsGuide ? "#FFFFFF" : T.navy, letterSpacing: "-0.01em" }}>
              How the Contribution Limits Work
            </span>
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            style={{ flexShrink: 0, transform: showLimitsGuide ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            <path d="M2 4l4 4 4-4" stroke={showLimitsGuide ? "#FFFFFF" : T.navy} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {showLimitsGuide && (
          <div style={{
            background: T.navy,
            border: `1px solid ${T.navy}`,
            borderTop: "none",
            borderRadius: `0 0 ${T.radiusLg} ${T.radiusLg}`,
            padding: isMobile ? "16px 14px 20px" : "20px 24px 24px",
            boxShadow: T.shadowMd,
          }}>

            {/* Title */}
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: isMobile ? "0.95rem" : "1.05rem", fontWeight: 800, color: "#FFFFFF", fontFamily: T.font, letterSpacing: "-0.02em" }}>
                {PLAN_YEAR} Maximum Contribution Rates: Highly Compensated Employees
              </div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", fontFamily: T.font, marginTop: 4 }}>
                All limits expressed as a percentage of total compensation (W-2 wages)
              </div>
            </div>

            {/* Two-zone plan layout + full-width 20% bar below */}
            <div style={{ border: `1.5px solid ${T.border}`, borderRadius: T.radiusLg, overflow: "hidden" }}>

              {/* Plan cards row */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 0, background: T.navyBorder }}>

              {/* LEFT ZONE: 401(k)/ESOP Plan card */}
              <div style={{ border: "none", borderRadius: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ background: T.navyLight, borderBottom: `1px solid ${T.navyBorder}`, padding: "8px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.92rem", fontWeight: 800, color: T.navy, fontFamily: T.font, letterSpacing: "-0.01em" }}>401(k)/ESOP Plan</div>
                  <div style={{ fontSize: "0.62rem", color: T.textSub, fontFamily: T.font, marginTop: 3 }}>Subject to IRS dollar limits</div>
                </div>

                {/* 401(k) and ESOP side by side */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: T.navyBorder, flex: 1 }}>

                  {/* 401(k) column */}
                  <div style={{ background: T.surface, padding: "10px 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ background: T.navyLight, border: `1px solid ${T.navyBorder}`, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: "0.92rem", fontWeight: 800, color: T.navy, fontFamily: T.font, letterSpacing: "-0.01em" }}>401(k) Savings</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <div style={{ background: T.navyLight, border: `1px solid ${T.navyBorder}`, borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
                        <div style={{ fontSize: "0.6rem", color: T.navy, fontFamily: T.font, marginBottom: 3 }}>Pre-tax</div>
                        <div style={{ fontSize: "1.25rem", fontWeight: 800, color: T.navy, fontFamily: T.font, lineHeight: 1 }}>10%</div>
                        <div style={{ fontSize: "0.55rem", color: T.textMuted, fontFamily: T.font, marginTop: 1 }}>max</div>
                      </div>
                      <div style={{ background: T.navyLight, border: `1px solid ${T.navyBorder}`, borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
                        <div style={{ fontSize: "0.6rem", color: T.navy, fontFamily: T.font, marginBottom: 3 }}>Roth after-tax</div>
                        <div style={{ fontSize: "1.25rem", fontWeight: 800, color: T.navy, fontFamily: T.font, lineHeight: 1 }}>10%</div>
                        <div style={{ fontSize: "0.55rem", color: T.textMuted, fontFamily: T.font, marginTop: 1 }}>max</div>
                      </div>
                    </div>
                  </div>

                  {/* ESOP column */}
                  <div style={{ background: T.surface, padding: "10px 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: "0.92rem", fontWeight: 800, color: T.navy, fontFamily: T.font, letterSpacing: "-0.01em" }}>ESOP Savings</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <div style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
                        <div style={{ fontSize: "0.6rem", color: T.navy, fontFamily: T.font, marginBottom: 3 }}>Pre-tax</div>
                        <div style={{ fontSize: "1.25rem", fontWeight: 800, color: T.navy, fontFamily: T.font, lineHeight: 1 }}>10%</div>
                        <div style={{ fontSize: "0.55rem", color: T.textMuted, fontFamily: T.font, marginTop: 1 }}>max</div>
                      </div>
                      <div style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
                        <div style={{ fontSize: "0.6rem", color: T.navy, fontFamily: T.font, marginBottom: 3 }}>Roth after-tax</div>
                        <div style={{ fontSize: "1.25rem", fontWeight: 800, color: T.navy, fontFamily: T.font, lineHeight: 1 }}>10%</div>
                        <div style={{ fontSize: "0.55rem", color: T.textMuted, fontFamily: T.font, marginTop: 1 }}>max</div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Qualified combined footer — inside the card, ties both plans together */}
                <div style={{ background: T.navyLight, borderTop: `1px solid ${T.navyBorder}`, padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.63rem", color: T.textSub, fontFamily: T.font, marginBottom: 3 }}>
                    401(k)/ESOP combined: cannot exceed
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: T.navy, fontFamily: T.font, letterSpacing: "-0.02em", lineHeight: 1 }}>
                    10% maximum
                  </div>
                </div>
              </div>

              {/* RIGHT ZONE: SSEP card */}
              <div style={{ border: "none", borderLeft: `1px solid ${T.navyBorder}`, borderRadius: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ background: T.border, borderBottom: `1px solid ${T.borderStrong}`, padding: "8px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.92rem", fontWeight: 800, color: T.navy, fontFamily: T.font, letterSpacing: "-0.01em" }}>SSEP</div>
                  <div style={{ fontSize: "0.62rem", color: T.textSub, fontFamily: T.font, marginTop: 3 }}>No IRS dollar limits</div>
                </div>
                {/* SSEP cells side by side — matching the 401(k)/ESOP layout above */}
                <div style={{ background: T.surface, padding: "10px 12px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div style={{ background: T.border, border: `1px solid ${T.borderStrong}`, borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
                      <div style={{ fontSize: "0.6rem", color: T.navy, fontFamily: T.font, marginBottom: 3 }}>Pre-tax</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: T.navy, fontFamily: T.font, lineHeight: 1 }}>10%</div>
                      <div style={{ fontSize: "0.55rem", color: T.textMuted, fontFamily: T.font, marginTop: 1 }}>max</div>
                    </div>
                    <div style={{ background: T.border, border: `1px solid ${T.borderStrong}`, borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
                      <div style={{ fontSize: "0.6rem", color: T.navy, fontFamily: T.font, marginBottom: 3 }}>ESOP</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 800, color: T.navy, fontFamily: T.font, lineHeight: 1 }}>10%</div>
                      <div style={{ fontSize: "0.55rem", color: T.textMuted, fontFamily: T.font, marginTop: 1 }}>max</div>
                    </div>
                  </div>
                </div>
                <div style={{ background: T.border, borderTop: `1px solid ${T.borderStrong}`, padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: "0.63rem", color: T.textSub, fontFamily: T.font, marginBottom: 3 }}>
                    Pre-tax + ESOP combined
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 800, color: T.navy, fontFamily: T.font, letterSpacing: "-0.02em", lineHeight: 1 }}>
                    10% maximum
                  </div>
                </div>
              </div>

              </div>{/* end plan cards row */}

              {/* 20% total bar — single navy stripe */}
              <div style={{ background: T.surface }}>
                <div style={{ height: 5, background: T.navy, opacity: 0.18 }} />
                <div style={{
                  padding: "12px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: T.navy, fontFamily: T.font, letterSpacing: "0.01em" }}>
                    401(k)/ESOP Plan + SSEP Combined: cannot exceed
                  </div>
                  <div style={{ fontSize: "2.2rem", fontWeight: 800, color: T.navy, fontFamily: T.font, letterSpacing: "-0.04em", lineHeight: 1, flexShrink: 0 }}>
                    20%
                  </div>
                </div>
              </div>

            </div>

            {/* IRS dollar limit note */}
            <div style={{ marginTop: 10, padding: "9px 13px", background: "rgba(255,255,255,0.05)", border: `1px solid rgba(255,255,255,0.10)`, borderRadius: T.radius }}>
              <div style={{ fontSize: "0.71rem", color: "rgba(255,255,255,0.6)", fontFamily: T.font, lineHeight: 1.6 }}>
                The 401(k)/ESOP Plan is also subject to IRS dollar limits: <strong style={{ color: "rgba(255,255,255,0.85)" }}>{fc(LIMIT_402G)} in elective deferrals</strong> for {PLAN_YEAR}{parseInt(age) >= 50 ? `, plus a ${parseInt(age) >= 60 && parseInt(age) <= 63 ? fc(LIMIT_CATCHUP_6063) + " enhanced catch-up (ages 60\u201363)" : fc(LIMIT_CATCHUP_50) + " catch-up contribution"}` : " (a catch-up contribution is available after age 50)"}. The SSEP has no IRS dollar limits.
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
        <div style={{ background: T.surface, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, boxShadow: T.shadowMd }}>
          <div style={{ padding: "12px 16px" }}>

            {/* Compensation */}
            <Divider label="Compensation" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }} className="mobile-stack">
              <div>
                <Label tooltip="Your annual base compensation, not including bonuses or incentive pay.">Base Compensation</Label>
                <Input value={baseSalary} onChange={(v) => { setBaseSalary(v); markDirty(); }} prefix="$" type="number" err={errors.base} inputRef={baseRef} />
                <FieldErr msg={errors.base} />
              </div>
              <div>
                <Label tooltip="Any estimated bonus or incentive pay for this year. Included as eligible compensation for deferral calculations.">Estimated Incentive</Label>
                <Input value={incentive} onChange={(v) => { setIncentive(v); markDirty(); }} prefix="$" type="number" placeholder="0" />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <Label tooltip="Your age as of December 31 of this plan year. Ages 50–59 and 64+ are eligible for an $8,000 catch-up contribution. Ages 60–63 are eligible for an $11,250 enhanced catch-up.">Age</Label>
              <Input value={age} onChange={(v) => { setAge(v); markDirty(); }} type="number" integersOnly err={errors.age} inputRef={ageRef} placeholder="e.g. 45" />
              <FieldErr msg={errors.age} />
              {age && parseInt(age) >= 50 && (
                <div style={{ marginTop: 5, fontSize: "0.72rem", color: T.navy, fontFamily: T.font, fontWeight: 600 }}>
                  Catch-up eligible – {parseInt(age) >= 60 && parseInt(age) <= 63
                    ? `${fc(LIMIT_CATCHUP_6063)} enhanced catch-up (ages 60–63)`
                    : `${fc(LIMIT_CATCHUP_50)} catch-up`}
                </div>
              )}
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
                        disabledReason={usedQual >= maxQualPct ? "IRS deferral limit reached" : usedQual >= MAX_QUALIFIED_PCT ? "Qualified plan limit reached" : usedTotal >= MAX_TOTAL_PCT ? "Overall 20% limit reached" : "401(k) 10% limit reached"}
                        onChange={(v) => handlePreTaxWithFicaCap(setR401kPre, p401kPre, [[used401k, MAX_401K_PCT], [usedQual, MAX_QUALIFIED_PCT], [usedTotal, MAX_TOTAL_PCT], [usedQual, maxQualPct]], v, pEsopPre, setR401kRoth)}
                        tooltip="Reduces your taxable income now; pay taxes later when withdrawn as ordinary income."
                      />
                      <PctInput label="Roth after-tax" value={r401kRoth} accentColor={T.navy}
                        disabled={lock401kRoth && p401kRoth === 0}
                        disabledReason={usedQual >= maxQualPct ? "IRS deferral limit reached" : usedQual >= MAX_QUALIFIED_PCT ? "Qualified plan limit reached" : usedTotal >= MAX_TOTAL_PCT ? "Overall 20% limit reached" : "401(k) 10% limit reached"}
                        onChange={(v) => handleRateChange(setR401kRoth, p401kRoth, [[used401k, MAX_401K_PCT], [usedQual, MAX_QUALIFIED_PCT], [usedTotal, MAX_TOTAL_PCT], [usedQual, maxQualPct]], v)}
                        tooltip="Pay taxes now; earnings are tax-free if Roth account open for at least 5 years AND withdrawn after age 59½ or due to death or disability."
                      />
                    </div>
                    {liveComp > 0 && used401k > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 2px", marginBottom: 8 }}>
                        <span style={{ fontSize: "0.7rem", color: T.textSub, fontFamily: T.font }}>401(k) contributions</span>
                        <span style={{ fontSize: "0.7rem", fontFamily: T.font, fontWeight: 600, color: T.navy }}>≈ {fc(liveComp * (used401k / 100))}/yr</span>
                      </div>
                    )}
                    <Divider label="Year-to-date contributed" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="mobile-stack">
                      <div>
                        <div style={{ marginBottom: 4, fontSize: "0.78rem", fontWeight: 600, color: T.navy, fontFamily: T.font }}>Pre-tax</div>
                        <Input value={ytd401kPre} onChange={(v) => { setYtd401kPre(v); markDirty(); }} prefix="$" type="number" err={errors.ytd401kPre} inputRef={ytd401kPreRef} placeholder="0" />
                        <FieldErr msg={errors.ytd401kPre} />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: "0.78rem", fontWeight: 600, color: T.navy, fontFamily: T.font }}>Roth after-tax</div>
                        <Input value={ytd401kRoth} onChange={(v) => { setYtd401kRoth(v); markDirty(); }} prefix="$" type="number" err={errors.ytd401kRoth} inputRef={ytd401kRothRef} placeholder="0" />
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
                        disabledReason={usedQual >= maxQualPct ? "IRS deferral limit reached" : usedQual >= MAX_QUALIFIED_PCT ? "Qualified plan limit reached" : usedTotal >= MAX_TOTAL_PCT ? "Overall 20% limit reached" : "ESOP 10% limit reached"}
                        onChange={(v) => handlePreTaxWithFicaCap(setREsopPre, pEsopPre, [[usedEsop, MAX_ESOP_PCT], [usedQual, MAX_QUALIFIED_PCT], [usedTotal, MAX_TOTAL_PCT], [usedQual, maxQualPct]], v, p401kPre, setREsopRoth)}
                        tooltip="Reduces your taxable income now; pay taxes later when withdrawn as ordinary income."
                      />
                      <PctInput label="Roth after-tax" value={rEsopRoth} accentColor={T.navy}
                        disabled={lockEsopRoth && pEsopRoth === 0}
                        disabledReason={usedQual >= maxQualPct ? "IRS deferral limit reached" : usedQual >= MAX_QUALIFIED_PCT ? "Qualified plan limit reached" : usedTotal >= MAX_TOTAL_PCT ? "Overall 20% limit reached" : "ESOP 10% limit reached"}
                        onChange={(v) => handleRateChange(setREsopRoth, pEsopRoth, [[usedEsop, MAX_ESOP_PCT], [usedQual, MAX_QUALIFIED_PCT], [usedTotal, MAX_TOTAL_PCT], [usedQual, maxQualPct]], v)}
                        tooltip="Pay taxes now; earnings are tax-free if Roth account open for at least 5 years AND withdrawn after age 59½ or due to death or disability."
                      />
                    </div>
                    {liveComp > 0 && usedEsop > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 2px", marginBottom: 8 }}>
                        <span style={{ fontSize: "0.7rem", color: T.textSub, fontFamily: T.font }}>ESOP contributions</span>
                        <span style={{ fontSize: "0.7rem", fontFamily: T.font, fontWeight: 600, color: T.navy }}>≈ {fc(liveComp * (usedEsop / 100))}/yr</span>
                      </div>
                    )}
                    <Divider label="Year-to-date contributed" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="mobile-stack">
                      <div>
                        <div style={{ marginBottom: 4, fontSize: "0.78rem", fontWeight: 600, color: T.navy, fontFamily: T.font }}>Pre-tax</div>
                        <Input value={ytdEsopPre} onChange={(v) => { setYtdEsopPre(v); markDirty(); }} prefix="$" type="number" err={errors.ytdEsopPre} inputRef={ytdEsopPreRef} placeholder="0" />
                        <FieldErr msg={errors.ytdEsopPre} />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: "0.78rem", fontWeight: 600, color: T.navy, fontFamily: T.font }}>Roth after-tax</div>
                        <Input value={ytdEsopRoth} onChange={(v) => { setYtdEsopRoth(v); markDirty(); }} prefix="$" type="number" err={errors.ytdEsopRoth} inputRef={ytdEsopRothRef} placeholder="0" />
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
                        disabledReason={usedSsep >= MAX_SSEP_PCT ? "SSEP 10% limit reached" : "Overall 20% limit reached"}
                        onChange={(v) => handleRateChange(setRSsepPre, pSsepPre, [[usedSsep, MAX_SSEP_PCT], [usedTotal, MAX_TOTAL_PCT]], v)}
                        tooltip="Reduces your taxable income now; pay taxes later when withdrawn as ordinary income."
                      />
                      <PctInput label="ESOP" value={rSsepEsop} accentColor={T.navy}
                        disabled={lockSsepEsop && pSsepEsop === 0}
                        disabledReason={usedSsep >= MAX_SSEP_PCT ? "SSEP 10% limit reached" : "Overall 20% limit reached"}
                        onChange={(v) => handleRateChange(setRSsepEsop, pSsepEsop, [[usedSsep, MAX_SSEP_PCT], [usedTotal, MAX_TOTAL_PCT]], v)}
                        tooltip="Reduces your taxable income now; pay taxes later when withdrawn as ordinary income."
                      />
                    </div>
                    {liveComp > 0 && usedSsep > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 2px", marginBottom: 8 }}>
                        <span style={{ fontSize: "0.7rem", color: T.textSub, fontFamily: T.font }}>SSEP contributions</span>
                        <span style={{ fontSize: "0.7rem", fontFamily: T.font, fontWeight: 600, color: T.navy }}>≈ {fc(liveSsepDollars)}/yr</span>
                      </div>
                    )}
                    <Divider label="Year-to-date contributed" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="mobile-stack">
                      <div>
                        <div style={{ marginBottom: 4, fontSize: "0.78rem", fontWeight: 600, color: T.navy, fontFamily: T.font }}>Pre-tax</div>
                        <Input value={ytdSsepPre} onChange={(v) => { setYtdSsepPre(v); markDirty(); }} prefix="$" type="number" placeholder="0" />
                      </div>
                      <div>
                        <div style={{ marginBottom: 4, fontSize: "0.78rem", fontWeight: 600, color: T.navy, fontFamily: T.font }}>ESOP</div>
                        <Input value={ytdSsepEsop} onChange={(v) => { setYtdSsepEsop(v); markDirty(); }} prefix="$" type="number" placeholder="0" />
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
                  <span style={{ fontSize: "0.68rem", color: T.textSub, fontFamily: T.font }}>401(k)/ESOP Plan + SSEP Combined</span>
                  <BudgetPill used={usedTotal} max={MAX_TOTAL_PCT} />
                </div>
              </div>
            )}

            {/* Calculate */}
            <button
              type="button" onClick={calculate}
              style={{
                width: "100%", marginTop: 14, padding: "11px 16px",
                fontSize: "0.875rem", fontWeight: 700, fontFamily: T.font,
                color: "#FFFFFF", background: T.btn,
                border: "none", borderRadius: T.radius,
                cursor: "pointer", transition: "background 0.15s",
                letterSpacing: "-0.01em",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = T.btnHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = T.btn)}
            >
              Calculate
            </button>

            {calculated && (
              <button
                type="button" onClick={clearAll}
                style={{
                  width: "100%", marginTop: 6, padding: "8px 16px",
                  fontSize: "0.8rem", fontWeight: 500, fontFamily: T.font,
                  color: T.textSub, background: "transparent",
                  border: `1px solid ${T.border}`, borderRadius: T.radius,
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.surfaceAlt; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                Clear
              </button>
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

                {/* Summary stat cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }} className="mobile-stack">
                  <div style={{ background: T.navyLight, border: `1px solid ${T.navyBorder}`, borderRadius: T.radius, padding: "10px 12px" }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.navy, fontFamily: T.font, marginBottom: 4 }}>Your Contributions</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: T.navy, fontFamily: T.font, letterSpacing: "-0.03em", lineHeight: 1 }}>{fc(result.dEmployeeTotal)}</div>
                    <div style={{ fontSize: "0.7rem", color: T.textSub, fontFamily: T.font, marginTop: 3 }}>{result.elGrandTotal}% of compensation</div>
                  </div>
                  <div style={{ background: T.navyLight, border: `1px solid ${T.navyBorder}`, borderRadius: T.radius, padding: "10px 12px" }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.navy, fontFamily: T.font, marginBottom: 4 }}>Employer Match</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: T.navy, fontFamily: T.font, letterSpacing: "-0.03em", lineHeight: 1 }}>{fc(result.dMatchTotal)}</div>
                    <div style={{ fontSize: "0.7rem", color: T.textSub, fontFamily: T.font, marginTop: 3 }}>Dollar-for-dollar</div>
                  </div>
                  <div style={{ background: T.navyLight, border: `1px solid ${T.navyBorder}`, borderRadius: T.radius, padding: "10px 12px" }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.navy, fontFamily: T.font, marginBottom: 4 }}>Total Saved</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: T.navy, fontFamily: T.font, letterSpacing: "-0.03em", lineHeight: 1 }}>{fc(result.grandTotalSaved)}</div>
                    <div style={{ fontSize: "0.7rem", color: T.textSub, fontFamily: T.font, marginTop: 3 }}>Employee + employer</div>
                  </div>
                </div>

                {/* 402(g) warning */}
                {result.electiveOver402g > 0 && (
                  <NoteBox color={T.amber} bg={T.amberLight} border={T.amberBorder}>
                    <strong>IRS elective deferral limit:</strong> Your elected qualified plan contributions of {fc(result.electiveEmployee)} exceed the {result.catchUp > 0 ? `${fc(result.electiveLimit)} limit (${fc(LIMIT_402G)} + ${fc(result.catchUp)} catch-up)` : `${fc(LIMIT_402G)} limit`} for {PLAN_YEAR} by {fc(result.electiveOver402g)}. Please adjust your rates to stay within the IRS limit.
                  </NoteBox>
                )}

                {/* Qualified ESOP card */}
                {result.hasQualContribs && (
                  <div style={{ border: `1px solid ${T.navyBorder}`, borderRadius: T.radius, overflow: "hidden" }}>
                    <div style={{ padding: "8px 14px 6px", background: T.navyLight, borderBottom: `1px solid ${T.navyBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: T.navy, fontFamily: T.font }}>401(k)/ESOP Plan</span>
                    </div>
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
                          <SummaryLine label={`Catch-up (${result.is6063 ? "ages 60–63" : "age 50+"})`} value={fc(result.catchUp)} indent dimmed />
                          <SummaryLine label="Total limit" value={fc(result.electiveLimit)} bold />
                        </>
                      )}
                      {result.ytdQualTotal > 0 && (
                        <>
                          <SummaryLine label="Contributed (YTD)" value={fc(result.ytdQualTotal)} dimmed />
                          <SummaryLine label="Remaining this year" value={fc(result.effectiveQualLimit)} bold />
                        </>
                      )}

                      <Divider label="Employee Contributions" />
                      {result.ytdQualTotal > 0 && (
                        <>
                          <SummaryLine label="401(k) pre-tax (YTD)" value={fc(result.ytd401kPre)} indent dimmed />
                          <SummaryLine label="401(k) Roth after-tax (YTD)" value={fc(result.ytd401kRoth)} indent dimmed />
                          <SummaryLine label="ESOP pre-tax (YTD)" value={fc(result.ytdEsopPre)} indent dimmed />
                          <SummaryLine label="ESOP Roth after-tax (YTD)" value={fc(result.ytdEsopRoth)} indent dimmed />
                        </>
                      )}
                      <SummaryLine label="401(k) pre-tax" value={fc(result.d401kPre)} indent />
                      <SummaryLine label="401(k) Roth after-tax" value={fc(result.d401kRoth)} indent />
                      <SummaryLine label="ESOP pre-tax" value={fc(result.dEsopPre)} indent />
                      <SummaryLine label="ESOP Roth after-tax" value={fc(result.dEsopRoth)} indent />
                      <SummaryLine label="Total employee" value={fc(result.dQualEmployee)} bold />

                      <Divider label="Employer Match" />
                      <SummaryLine label="Dollar-for-dollar match" value={fc(result.dMatchQual)}
                        tooltip="TDIndustries matches 100% of your qualified plan contributions with no cap on the match rate." />
                      <SummaryLine label="Total contributions (employee + employer)" value={fc(result.total415cQual)} bold color={result.has415cSpillover ? T.amber : T.text} />
                      <SummaryLine label="Total contributions allowed" value={fc(LIMIT_415C)} dimmed />
                      {result.has415cSpillover
                        ? <SummaryLine label="Spillover to Excess Benefit Plan" value={fc(result.over415c)} bold color={T.amber} />
                        : <SummaryLine label="Room remaining" value={fc(LIMIT_415C - result.total415cQual)} dimmed />
                      }

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
                    </DetailPanel>
                  </div>
                )}

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
                      <Divider label="Employee Contributions" />
                      {result.ytdSsepTotal > 0 && (
                        <>
                          <SummaryLine label="SSEP pre-tax (YTD)" value={fc(result.ytdSsepPre)} indent dimmed />
                          <SummaryLine label="SSEP ESOP (YTD)" value={fc(result.ytdSsepEsop)} indent dimmed />
                        </>
                      )}
                      <SummaryLine label="SSEP pre-tax" value={fc(result.dSsepPre)} indent />
                      <SummaryLine label="SSEP ESOP" value={fc(result.dSsepEsop)} indent />
                      <SummaryLine label="Total employee" value={fc(result.dSsepTotal)} bold />

                      <Divider label="Employer Match" />
                      <SummaryLine label="Dollar-for-dollar match" value={fc(result.dMatchSsep)}
                        tooltip="TDIndustries matches SSEP contributions dollar-for-dollar. SSEP match amounts may be subject to different vesting schedules or discretionary treatment than the qualified plan match — confirm details with your plan administrator." />
                      <div style={{ marginTop: 8 }}>
                        <NoteBox color={T.amber} bg={T.amberLight} border={T.amberBorder}>
                          <strong>Note:</strong> The SSEP employer match shown is an estimate based on the dollar-for-dollar match rate. SSEP match contributions may be subject to vesting schedules or discretionary provisions that differ from the qualified plan. Confirm the terms with your plan administrator before making elections.
                        </NoteBox>
                      </div>

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

                {/* Excess Benefit Plan — only when 415(c) spills */}
                {result.has415cSpillover && (
                  <div style={{ background: T.amberLight, border: `1px solid ${T.amberBorder}`, borderRadius: T.radius, overflow: "hidden" }}>
                    <div style={{ padding: "8px 14px 6px", borderBottom: `1px solid ${T.amberBorder}` }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: T.amber, fontFamily: T.font }}>Excess Benefit Plan</span>
                    </div>
                    <div style={{ padding: "8px 12px 10px" }}>
                      <div style={{ fontSize: "0.78rem", color: T.amber, fontFamily: T.font, lineHeight: 1.55, marginBottom: 8 }}>
                        Your qualified plan contributions exceed the {PLAN_YEAR} IRS 415(c) limit of {fc(LIMIT_415C)}. The employer match that would have exceeded this limit is redirected here — a non-qualified plan with no IRS limits.
                      </div>
                      <SummaryLine label="415(c) limit" value={fc(LIMIT_415C)} />
                      <SummaryLine label="Qualified plan total" value={fc(result.total415cQual)} />
                      <SummaryLine label="Employer match redirected" value={fc(result.spilloverExcessBenefit)} bold color={T.amber} />

                      <DetailPanel
                        label="View Details"
                        isOpen={show415cDetail} onToggle={() => setShow415cDetail(v => !v)}
                      >
                        <SummaryLine label="Employee contributions (qualified)" value={fc(result.dQualEmployee)} indent />
                        <SummaryLine label="Employer match (qualified)" value={fc(result.dMatchQual)} indent />
                        <SummaryLine label="Combined before cap" value={fc(result.total415cQual)} bold />
                        <SummaryLine label="415(c) annual additions limit" value={fc(LIMIT_415C)} />
                        <SummaryLine label="Employer match redirected to Excess Benefit Plan" value={fc(result.spilloverExcessBenefit)} bold color={T.amber} />
                      </DetailPanel>
                    </div>
                  </div>
                )}

                {/* Collapsible total summary */}
                <SummaryPanel isOpen={showTotalSummary} onToggle={() => setShowTotalSummary(v => !v)}>
                  <SummaryLine label="Total compensation" value={fc(result.totalComp)} />
                  <SummaryLine label="Employee — 401(k)/ESOP" value={result.hasQualContribs ? fc(result.dQualEmployee) : "—"} indent />
                  <SummaryLine label="Employee — SSEP" value={result.hasSsepContribs ? fc(result.dSsepTotal) : "—"} indent />
                  <SummaryLine label="Total employee contributions" value={fc(result.dEmployeeTotal)} bold />
                  <SummaryLine label="Employer match — 401(k)/ESOP" value={result.hasQualContribs ? fc(result.qualMatchNet) : "—"} indent />
                  {result.has415cSpillover && (
                    <SummaryLine label="Employer match — Excess Benefit Plan" value={fc(result.spilloverExcessBenefit)} indent color={T.amber} />
                  )}
                  <SummaryLine label="Employer match — SSEP" value={result.hasSsepContribs ? fc(result.dMatchSsep) : "—"} indent />
                  <SummaryLine label="Total employer contributions" value={fc(result.dMatchTotal)} bold color={T.navy} />
                  <SummaryLine label="Grand total saved" value={fc(result.grandTotalSaved)} bold color={T.navy} />
                  <div style={{ marginTop: 8, fontSize: "0.68rem", color: T.textMuted, fontFamily: T.font, lineHeight: 1.5 }}>
                    Annual estimates based on {fc(result.base)} base compensation{result.incv > 0 ? ` plus ${fc(result.incv)} estimated incentive` : ""}. Actual contributions may vary.
                  </div>
                </SummaryPanel>

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
