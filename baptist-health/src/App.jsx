import { useState, useRef, useEffect } from "react";

// ── IRS Limits — update each year when new limits are announced ───────────────
const PLAN_YEAR = 2026;
const LIMIT_402G = 24500;
const LIMIT_CATCHUP_50 = 8000;
const LIMIT_CATCHUP_6063 = 11250;
const LIMIT_415C = 72000;
const LIMIT_457B = 24500;
const MATCH_RATE = 0.50;
const MATCH_CAP_PCT = 0.08;
const DISCRETIONARY_RATE = 0.03;
const COMP_LIMIT = 360000;

// ── Baptist Health 2026 Payroll Calendar ──────────────────────────────────────
const BH_PAYDAYS_2026 = [
  "2026-01-15", "2026-01-29",
  "2026-02-12", "2026-02-26",
  "2026-03-12", "2026-03-26",
  "2026-04-09", "2026-04-23",
  "2026-05-07", "2026-05-21",
  "2026-06-04", "2026-06-18",
  "2026-07-02", "2026-07-16",
  "2026-07-30", "2026-08-13",
  "2026-08-27", "2026-09-10",
  "2026-09-24", "2026-10-08",
  "2026-10-22", "2026-11-05",
  "2026-11-19", "2026-12-03",
  "2026-12-17", "2026-12-31",
];

const CUTOFF_HOUR_CT = 10;

function getCentralOffset(date) {
  const year = date.getUTCFullYear();
  const march = new Date(Date.UTC(year, 2, 1));
  const dstStart = new Date(Date.UTC(year, 2, (14 - march.getUTCDay()) % 7 + 8));
  const nov = new Date(Date.UTC(year, 10, 1));
  const dstEnd = new Date(Date.UTC(year, 10, (7 - nov.getUTCDay()) % 7 + 1));
  const isDST = date >= dstStart && date < dstEnd;
  return isDST ? -5 * 60 : -6 * 60;
}

function getCutoffForPayday(payday) {
  const pdDay = payday.getDay();
  const daysSinceThursday = (pdDay + 3) % 7;
  const daysBack = daysSinceThursday + 7;
  const thursdayMidnight = new Date(payday.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const ctOffset = getCentralOffset(thursdayMidnight);
  const utcHour = CUTOFF_HOUR_CT - ctOffset / 60;
  return new Date(thursdayMidnight.getTime() + utcHour * 60 * 60 * 1000);
}

function computeBHPeriods() {
  const nowUtcMs = Date.now();
  const nowDate = new Date(nowUtcMs);
  const nowDateStr = `${nowDate.getUTCFullYear()}-${String(nowDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nowDate.getUTCDate()).padStart(2, "0")}`;
  const periodsTotal = BH_PAYDAYS_2026.length;
  let periodsCompleted = 0, nextPayday = null, cutoffDate = null, cutoffPassed = false;

  for (let i = 0; i < BH_PAYDAYS_2026.length; i++) {
    const pdStr = BH_PAYDAYS_2026[i];
    if (pdStr <= nowDateStr) { periodsCompleted++; }
    else {
      nextPayday = new Date(`${pdStr}T00:00:00Z`);
      cutoffDate = getCutoffForPayday(nextPayday);
      cutoffPassed = nowUtcMs > cutoffDate.getTime();
      break;
    }
  }

  let firstEligiblePayday = cutoffPassed ? null : nextPayday;
  let firstEligibleCutoff = cutoffPassed ? null : cutoffDate;

  if (cutoffPassed && nextPayday) {
    const nextIdx = BH_PAYDAYS_2026.findIndex((pdStr) => new Date(`${pdStr}T00:00:00Z`).getTime() === nextPayday.getTime());
    if (nextIdx >= 0 && nextIdx + 1 < BH_PAYDAYS_2026.length) {
      firstEligiblePayday = new Date(`${BH_PAYDAYS_2026[nextIdx + 1]}T00:00:00Z`);
      firstEligibleCutoff = getCutoffForPayday(firstEligiblePayday);
    }
  }

  return {
    periodsLeft: Math.max(periodsTotal - periodsCompleted - (cutoffPassed ? 1 : 0), 0),
    periodsTotal, nextPayday, cutoffDate, cutoffPassed, firstEligiblePayday, firstEligibleCutoff,
  };
}

function getCatchUp(age) {
  if (age >= 60 && age <= 63) return LIMIT_CATCHUP_6063;
  if (age >= 50) return LIMIT_CATCHUP_50;
  return 0;
}

function fc(val, decimals = 0) {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function ceilPct(val) { return Math.ceil(val * 100); }
function ceilDollar(val) { return Math.ceil(val); }

function parse(str) {
  const v = parseFloat((str || "").replace(/,/g, ""));
  return isNaN(v) ? 0 : v;
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
  const d = date.toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" });
  const [month, day] = d.split(" ");
  return <>{month} {ordinalSup(parseInt(day))} at 10 AM CT</>;
}

const EMPTY_ERR = {
  salary: "", age: "",
  ytd403bPre: "", ytd403bRoth: "", ytd403bAfterTax: "",
  ytd401aAfterTax: "", ytd401aEmployer: "", ytd457b: "",
  targetAmount: "",
};

const T = {
  bg: "#F5F3EF", surface: "#FFFFFF", surfaceAlt: "#F9F7F4",
  border: "#E2DDD7", borderStrong: "#C8C0B5",
  text: "#1C1917", textSub: "#78716C", textMuted: "#A8A29E",
  amber: "#B45309", amberLight: "#FEF3C7",
  preTax: "#6D28D9", preTaxLight: "#F5F3FF", preTaxBorder: "#DDD6FE",
  blue: "#1D4ED8", blueLight: "#EFF6FF",
  red: "#DC2626", redLight: "#FEF2F2",
  green: "#16A34A", greenLight: "#F0FDF4",
  btn: "#166534", btnHover: "#14532D", btnLight: "#DCFCE7", btnBorder: "#BBF7D0",
  total: "#166534",
  shadow: "0 1px 3px rgba(0,0,0,0.08)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08)",
  radius: "10px", radiusLg: "16px",
  font: "'Instrument Sans', 'DM Sans', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', 'Fira Code', monospace",
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
      const tooltipWidth = 220;
      let left = br.left + br.width / 2 - tooltipWidth / 2;
      if (left < 10) left = 10;
      if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;
      setCoords({ top: br.bottom + 8, left });
    }
    setShow(true);
  };

  return (
    <div style={{ position: "relative", display: "inline-block", marginLeft: 4 }}>
      <button type="button" ref={buttonRef}
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
            position: "fixed",
            zIndex: 9999,
            top: isMobile ? "50%" : coords.top,
            left: isMobile ? "50%" : coords.left,
            transform: isMobile ? "translate(-50%, -50%)" : "none",
            background: T.text, color: T.surface, padding: "8px 10px",
            borderRadius: T.radius, fontSize: "0.72rem", fontFamily: T.font,
            lineHeight: 1.5, width: isMobile ? "calc(100vw - 48px)" : "220px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
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

function Input({ value, onChange, placeholder, type = "text", prefix, suffix, err, inputRef, integersOnly = false }) {
  const handleChange = (e) => {
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
      {prefix && <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: "0.85rem", color: err ? T.red : T.textSub, fontFamily: T.font, pointerEvents: "none" }}>{prefix}</span>}
      {suffix && <span style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", fontSize: "0.85rem", color: T.textSub, fontFamily: T.font, pointerEvents: "none" }}>{suffix}</span>}
      <input ref={inputRef} type="text" inputMode={type === "number" ? "numeric" : "text"}
        value={value} placeholder={placeholder} onChange={handleChange}
        onFocus={(e) => (e.target.style.boxShadow = `0 0 0 3px ${err ? "#FCA5A544" : "#F59E0B33"}`)}
        onBlur={(e) => (e.target.style.boxShadow = "none")}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: prefix ? "9px 12px 9px 22px" : suffix ? "9px 28px 9px 12px" : "9px 12px",
          fontSize: "0.875rem", fontFamily: T.font, color: T.text,
          background: err ? T.redLight : T.surface,
          border: `1.5px solid ${err ? T.red : T.border}`,
          borderRadius: T.radius, outline: "none",
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

function SummaryLine({ label, value, color, bold, indent, dimmed }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: "0.78rem", fontFamily: T.font, color: dimmed ? T.textMuted : T.textSub, paddingLeft: indent ? 12 : 0, fontWeight: bold ? 600 : 400 }}>
        {indent ? "↳ " : ""}{label}
      </span>
      <span style={{ fontSize: bold ? "0.84rem" : "0.8rem", fontFamily: T.font, fontWeight: bold ? 600 : 400, color: color || T.text, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

function PlanLine({ label, value, bold, highlight, dimmed }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "3px 0", borderBottom: `1px solid rgba(0,0,0,0.06)` }}>
      <span style={{ fontSize: "0.75rem", color: dimmed ? T.textMuted : T.textSub, fontFamily: T.font, fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span style={{ fontSize: bold ? "0.84rem" : "0.78rem", fontFamily: T.font, fontWeight: bold ? 700 : 400, color: highlight || T.text, fontVariantNumeric: "tabular-nums" }}>{value}</span>
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

// ── ExpandRow — styled like True Cost Select button ───────────────────────────
function ExpandRow({ label, hint, tooltip, isOpen, onToggle, marginTop = 0 }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "9px 12px",
        fontSize: "0.875rem",
        fontFamily: T.font,
        color: isOpen ? T.btn : T.text,
        fontWeight: isOpen ? 600 : 400,
        background: isOpen ? T.btnLight : T.surface,
        border: `1.5px solid ${isOpen ? T.btn : T.border}`,
        borderRadius: T.radius,
        outline: "none",
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        transition: "all 0.15s",
        marginTop,
        boxShadow: isOpen ? `0 0 0 3px ${T.btnLight}` : "none",
      }}
      onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = T.surfaceAlt; }}
      onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = T.surface; }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span>{label}</span>
        {tooltip && (
          <span onClick={(e) => e.stopPropagation()}>
            <InfoTooltip text={tooltip} />
          </span>
        )}
        {!isOpen && hint && (
          <span style={{ fontSize: "0.72rem", color: T.textMuted, fontWeight: 400 }}>{hint}</span>
        )}
      </span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
        style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
        <path d="M2 4l4 4 4-4" stroke={isOpen ? T.btn : T.textSub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function EmptyResults({ isCalculating }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 180, padding: 16 }}>
      <div style={{ background: T.surface, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.07)", padding: "20px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, maxWidth: 300 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.btnLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <style>{`
              @keyframes bar1{0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.4)}}
              @keyframes bar2{0%,100%{transform:scaleY(1)}33%{transform:scaleY(1.25)}66%{transform:scaleY(0.6)}}
              @keyframes bar3{0%,100%{transform:scaleY(1)}25%{transform:scaleY(0.5)}75%{transform:scaleY(1.2)}}
              @keyframes fieldShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
              .field-shake{animation:fieldShake 0.35s ease-in-out;}
            `}</style>
            <rect x="2" y="12" width="4" height="10" rx="1" fill={T.btn} opacity="0.5"
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar1 0.9s ease-in-out infinite" } : {}} />
            <rect x="9" y="7" width="4" height="15" rx="1" fill={T.btn} opacity="0.75"
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar2 0.9s ease-in-out infinite 0.15s" } : {}} />
            <rect x="16" y="3" width="4" height="19" rx="1" fill={T.btn}
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar3 0.9s ease-in-out infinite 0.3s" } : {}} />
          </svg>
        </div>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: T.text, fontFamily: T.font, textAlign: "center" }}>
          {isCalculating ? "Calculating…" : "Calculate Your Maximum Contributions"}
        </div>
        {!isCalculating && (
          <div style={{ fontSize: "0.78rem", color: T.textSub, fontFamily: T.font, textAlign: "center", lineHeight: 1.55 }}>
            Enter your salary and current contributions to see your maximum election rates across all three plans.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [salary, setSalary] = useState("");
  const [age, setAge] = useState("");
  const [ytd403bPre, setYtd403bPre] = useState("");
  const [ytd403bRoth, setYtd403bRoth] = useState("");
  const [ytd403bAfterTax, setYtd403bAfterTax] = useState("");
  const [ytd401aAfterTax, setYtd401aAfterTax] = useState("");
  const [ytd401aEmployer, setYtd401aEmployer] = useState("");
  const [ytd457b, setYtd457b] = useState("");
  const [show403bYtd, setShow403bYtd] = useState(false);
  const [show401aYtd, setShow401aYtd] = useState(false);
  const [show457bYtd, setShow457bYtd] = useState(false);
  const [useTarget, setUseTarget] = useState(false);
  const [targetAmount, setTargetAmount] = useState("");
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState(EMPTY_ERR);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const salaryRef = useRef(null);
  const ageRef = useRef(null);

  const bhSchedule = computeBHPeriods();
  const { periodsLeft, periodsTotal, nextPayday, cutoffDate, cutoffPassed, firstEligiblePayday, firstEligibleCutoff } = bhSchedule;

  function markDirty() { if (calculated) setIsDirty(true); }

  useEffect(() => {
    function onKey(e) { if (e.key === "Enter" && !e.shiftKey) calculate(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function calculate() {
    const errs = { ...EMPTY_ERR };
    let bad = false;
    const w = parse(salary);
    const a = parseInt(age);

    if (!w || w <= 0) { errs.salary = "Enter your annual salary."; bad = true; }
    if (w > 0 && w < 10000) { errs.salary = `This looks low for an annual salary — did you mean to enter an hourly rate?`; bad = true; }
    if (!a || a < 18 || a > 100) { errs.age = "Enter a valid age (18–100)."; bad = true; }
    if (useTarget) {
      const t = parse(targetAmount);
      if (!t || t <= 0) { errs.targetAmount = "Enter a target contribution amount."; bad = true; }
    }

    setErrors(errs);
    setCalculated(true);
    setIsDirty(false);

    if (bad) {
      setResult(null);
      setTimeout(() => {
        if (errs.salary) { salaryRef.current?.focus(); return; }
        if (errs.age) { ageRef.current?.focus(); return; }
      }, 50);
      return;
    }

    setResult(null);
    setIsCalculating(true);

    setTimeout(() => {
      setIsCalculating(false);

      const catchUp = getCatchUp(a);
      const is6063 = a >= 60 && a <= 63;
      const catchUpType = is6063 ? "Ages 60–63" : "Age 50+";
      const compBasis = Math.min(w, COMP_LIMIT);
      const perCheck = w / periodsTotal;

      const ytd403bPreAmt = parse(ytd403bPre);
      const ytd403bRothAmt = parse(ytd403bRoth);
      const ytd403bElective = ytd403bPreAmt + ytd403bRothAmt;
      const ytd403bAfterTaxAmt = parse(ytd403bAfterTax);
      const ytd401aAfterTaxAmt = parse(ytd401aAfterTax);
      const ytd401aEmployerAmt = parse(ytd401aEmployer);
      const ytd457bAmt = parse(ytd457b);

      // Full-year employer estimate (used for display and summary)
      const empMatchAmt = compBasis * MATCH_CAP_PCT * MATCH_RATE;
      const empDiscAmt = compBasis * DISCRETIONARY_RATE;
      const totalEmployer401a = empMatchAmt + empDiscAmt;

      // Projected employer for 415(c) calculation:
      // If user provided YTD employer contributions, use those + what the employer
      // will contribute for remaining paychecks. This correctly handles mid-year hires.
      // If no YTD provided, fall back to full-year estimate.
      const empPerCheck = totalEmployer401a / periodsTotal;
      const projectedEmployer401a = ytd401aEmployerAmt > 0
        ? ytd401aEmployerAmt + (empPerCheck * periodsLeft)
        : totalEmployer401a;

      const electiveLimit = LIMIT_402G + catchUp;
      const afterTax403bLimit = Math.max(LIMIT_415C - LIMIT_402G, 0);
      const afterTax401aLimit = Math.max(LIMIT_415C - projectedEmployer401a, 0);

      const totalYtdEmployee = ytd403bElective + ytd403bAfterTaxAmt + ytd401aAfterTaxAmt + ytd457bAmt;
      const maxEmployee = electiveLimit + afterTax403bLimit + afterTax401aLimit + LIMIT_457B;

      let budget, usingTarget = false;
      if (useTarget && parse(targetAmount) > 0) {
        budget = Math.max(parse(targetAmount) - totalYtdEmployee, 0);
        usingTarget = true;
      } else {
        budget = maxEmployee - totalYtdEmployee;
      }

      const electiveRemMax = Math.max(electiveLimit - ytd403bElective, 0);
      const electiveAllocated = Math.min(budget, electiveRemMax);
      budget -= electiveAllocated;
      const electiveRem = electiveAllocated;
      const electivePct = electiveRem > 0 ? ceilPct(electiveRem / periodsLeft / perCheck) : 0;
      const electiveDpc = (perCheck * electivePct) / 100;
      const electiveChecks = electiveRem > 0 ? Math.ceil(electiveRem / ((perCheck * electivePct) / 100)) : 0;
      const electiveNotNeeded = usingTarget && electiveAllocated === 0 && electiveRemMax > 0;

      // Projected 402(g)-only elective = YTD already contributed + what will be contributed going forward
      // capped at LIMIT_402G (catch-up is above 415(c) and does not reduce after-tax room)
      const projectedElective402g = Math.min(
        ytd403bElective + Math.min(electiveDpc * electiveChecks, electiveRem),
        LIMIT_402G
      );
      const afterTax403bRemMax = Math.max(LIMIT_415C - projectedElective402g - ytd403bAfterTaxAmt, 0);
      const afterTax403bAllocated = Math.min(budget, afterTax403bRemMax);
      budget -= afterTax403bAllocated;
      const afterTax403bRemFinal = afterTax403bAllocated;
      const afterTax403bPct = afterTax403bRemFinal > 0 ? ceilPct(afterTax403bRemFinal / periodsLeft / perCheck) : 0;
      const afterTax403bDpc = (perCheck * afterTax403bPct) / 100;
      const afterTax403bChecks = afterTax403bRemFinal > 0 ? Math.ceil(afterTax403bRemFinal / ((perCheck * afterTax403bPct) / 100)) : 0;
      const afterTax403bNotNeeded = usingTarget && afterTax403bAllocated === 0 && afterTax403bRemMax > 0;

      const afterTax401aRemMax = Math.max(afterTax401aLimit - ytd401aAfterTaxAmt, 0);
      const afterTax401aAllocated = Math.min(budget, afterTax401aRemMax);
      budget -= afterTax401aAllocated;
      const afterTax401aRem = afterTax401aAllocated;
      const afterTax401aPct = afterTax401aRem > 0 ? ceilPct(afterTax401aRem / periodsLeft / perCheck) : 0;
      const afterTax401aDpc = (perCheck * afterTax401aPct) / 100;
      const afterTax401aChecks = afterTax401aRem > 0 ? Math.ceil(afterTax401aRem / ((perCheck * afterTax401aPct) / 100)) : 0;
      const afterTax401aNotNeeded = usingTarget && afterTax401aAllocated === 0 && afterTax401aRemMax > 0;

      const rem457bMax = Math.max(LIMIT_457B - ytd457bAmt, 0);
      const allocated457b = Math.min(budget, rem457bMax);
      const rem457b = allocated457b;
      const dpc457b = periodsLeft > 0 && rem457b > 0 ? Math.ceil((rem457b / periodsLeft) * 100) / 100 : 0;
      const checks457b = dpc457b > 0 ? Math.ceil(rem457b / dpc457b) : 0;
      const notNeeded457b = usingTarget && allocated457b === 0 && rem457bMax > 0;

      setResult({
        salary: w, age: a, catchUp, is6063, catchUpType,
        compBasis, perCheck, periodsLeft, periodsTotal,
        usingTarget, targetAmount: parse(targetAmount),
        electiveLimit, electiveRem, electivePct, electiveDpc, electiveChecks, electiveNotNeeded,
        ytd403bElective, ytd403bPreAmt, ytd403bRothAmt,
        afterTax403bLimit,
        afterTax403bRem: afterTax403bRemFinal,
        afterTax403bPct, afterTax403bDpc, afterTax403bChecks, afterTax403bNotNeeded,
        ytd403bAfterTaxAmt,
        empMatchAmt, empDiscAmt, totalEmployer401a, projectedEmployer401a, ytd401aEmployerAmt,
        afterTax401aLimit, afterTax401aRem,
        afterTax401aPct, afterTax401aDpc, afterTax401aChecks, afterTax401aNotNeeded,
        ytd401aAfterTaxAmt,
        rem457b, dpc457b, checks457b, notNeeded457b, ytd457bAmt,
        totalAnnualEmployee: maxEmployee,
      });
    }, 650);
  }

  function clearAll() {
    setSalary(""); setAge("");
    setYtd403bPre(""); setYtd403bRoth(""); setYtd403bAfterTax("");
    setYtd401aAfterTax(""); setYtd401aEmployer(""); setYtd457b("");
    setShow403bYtd(false); setShow401aYtd(false); setShow457bYtd(false);
    setUseTarget(false); setTargetAmount("");
    setResult(null); setErrors(EMPTY_ERR);
    setCalculated(false); setIsDirty(false); setIsCalculating(false);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: T.bg, fontFamily: T.font, overflow: "auto", position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
      <style>{`
        input::-webkit-inner-spin-button,input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0;}
        input[type=number]{-moz-appearance:textfield;appearance:textfield;}
        details[open] .details-arrow{transform:rotate(180deg);}
        @media(max-width:640px){.mobile-stack{grid-template-columns:1fr!important}.mobile-text-sm{font-size:1.6rem!important}.mobile-padding-sm{padding:16px 18px!important}}
      `}</style>

      <div style={{ position: "fixed", inset: 0, opacity: 0.025, pointerEvents: "none", zIndex: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      <div style={{ position: "relative", zIndex: 1, flexShrink: 0, padding: "10px 20px 8px", borderBottom: `1px solid ${T.border}`, background: T.surfaceAlt, display: "flex", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: isMobile ? "1rem" : "1.1rem", fontWeight: 800, color: T.text, letterSpacing: "-0.03em" }}>
          Baptist Health Contribution Limit Assistant
        </h1>
      </div>

      <div style={{
        position: "relative", zIndex: 1,
        display: isMobile ? "flex" : "grid", flexDirection: isMobile ? "column" : undefined,
        gridTemplateColumns: isMobile ? undefined : "minmax(0, 440px) minmax(0, 1fr)",
        gap: 12, padding: "12px 16px", maxWidth: 1200, width: "100%",
        margin: "0 auto", boxSizing: "border-box", alignItems: "start",
      }}>

        {/* ── LEFT: Inputs ── */}
        <div style={{ background: T.surface, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, boxShadow: T.shadowMd, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ overflowY: isMobile ? "visible" : "auto", padding: "12px 16px" }}>

            {/* Salary + Age */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }} className="mobile-stack">
              <div>
                <Label tooltip="Your total annual salary before any deductions.">Annual Salary</Label>
                <Input value={salary} onChange={(v) => { setSalary(v); markDirty(); }} prefix="$" type="number" err={errors.salary} inputRef={salaryRef} />
                <FieldErr msg={errors.salary} />
              </div>
              <div>
                <Label tooltip="Your age as of December 31 of this year. Ages 50+ are eligible for catch-up contributions.">Age</Label>
                <Input value={age} onChange={(v) => { setAge(v); markDirty(); }} type="number" err={errors.age} inputRef={ageRef} integersOnly />
                <FieldErr msg={errors.age} />
              </div>
            </div>

            {/* YTD Section */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "14px 0 10px" }}>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textMuted, fontFamily: T.font, whiteSpace: "nowrap" }}>
                Year-to-Date Contributions
              </span>
              <span style={{ fontSize: "14px", lineHeight: 1 }}><InfoTooltip text="Only needed if you've already made contributions this year. Leave blank to calculate based on full annual limits." /></span>
              <div style={{ flex: 1, height: 1, background: T.border }} />
            </div>

            {/* 403(b) YTD */}
            <ExpandRow
              label="403(b)"
              isOpen={show403bYtd}
              onToggle={() => {
                setShow403bYtd(v => {
                  if (v) { setYtd403bPre(""); setYtd403bRoth(""); setYtd403bAfterTax(""); }
                  markDirty();
                  return !v;
                });
              }}
            />
            {show403bYtd && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8, marginBottom: 4 }} className="mobile-stack">
                <div>
                  <div style={{ fontSize: "0.71rem", fontWeight: 600, color: T.textSub, marginBottom: 3, fontFamily: T.font }}>Pre-Tax</div>
                  <Input value={ytd403bPre} onChange={(v) => { setYtd403bPre(v); markDirty(); }} prefix="$" type="number" err={errors.ytd403bPre} />
                  <FieldErr msg={errors.ytd403bPre} />
                </div>
                <div>
                  <div style={{ fontSize: "0.71rem", fontWeight: 600, color: T.textSub, marginBottom: 3, fontFamily: T.font }}>Roth</div>
                  <Input value={ytd403bRoth} onChange={(v) => { setYtd403bRoth(v); markDirty(); }} prefix="$" type="number" err={errors.ytd403bRoth} />
                  <FieldErr msg={errors.ytd403bRoth} />
                </div>
                <div>
                  <div style={{ fontSize: "0.71rem", fontWeight: 600, color: T.textSub, marginBottom: 3, fontFamily: T.font }}>After-Tax</div>
                  <Input value={ytd403bAfterTax} onChange={(v) => { setYtd403bAfterTax(v); markDirty(); }} prefix="$" type="number" err={errors.ytd403bAfterTax} />
                  <FieldErr msg={errors.ytd403bAfterTax} />
                </div>
              </div>
            )}

            {/* 401(a) YTD */}
            <ExpandRow
              label="401(a)"
              isOpen={show401aYtd}
              onToggle={() => {
                setShow401aYtd(v => {
                  if (v) { setYtd401aAfterTax(""); setYtd401aEmployer(""); }
                  markDirty();
                  return !v;
                });
              }}
              marginTop={6}
            />
            {show401aYtd && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8, marginBottom: 4 }} className="mobile-stack">
                <div>
                  <div style={{ fontSize: "0.71rem", fontWeight: 600, color: T.textSub, marginBottom: 3, fontFamily: T.font }}>After-Tax (employee)</div>
                  <Input value={ytd401aAfterTax} onChange={(v) => { setYtd401aAfterTax(v); markDirty(); }} prefix="$" type="number" err={errors.ytd401aAfterTax} />
                  <FieldErr msg={errors.ytd401aAfterTax} />
                </div>
                <div>
                  <div style={{ fontSize: "0.71rem", fontWeight: 600, color: T.textSub, marginBottom: 3, fontFamily: T.font }}>Employer contributions</div>
                  <Input value={ytd401aEmployer} onChange={(v) => { setYtd401aEmployer(v); markDirty(); }} prefix="$" type="number" err={errors.ytd401aEmployer} />
                  <FieldErr msg={errors.ytd401aEmployer} />
                </div>
              </div>
            )}

            {/* 457(b) YTD */}
            <ExpandRow
              label="457(b)"
              isOpen={show457bYtd}
              onToggle={() => {
                setShow457bYtd(v => {
                  if (v) setYtd457b("");
                  markDirty();
                  return !v;
                });
              }}
              marginTop={6}
            />
            {show457bYtd && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8, marginBottom: 4 }} className="mobile-stack">
                <div>
                  <div style={{ fontSize: "0.71rem", fontWeight: 600, color: T.textSub, marginBottom: 3, fontFamily: T.font }}>Pre-Tax</div>
                  <Input value={ytd457b} onChange={(v) => { setYtd457b(v); markDirty(); }} prefix="$" type="number" err={errors.ytd457b} />
                  <FieldErr msg={errors.ytd457b} />
                </div>
              </div>
            )}

            {/* Contribution Goal */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "14px 0 10px" }}>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textMuted, fontFamily: T.font, whiteSpace: "nowrap" }}>
                Contribution Goal
              </span>
              <span style={{ fontSize: "14px", lineHeight: 1 }}><InfoTooltip text="Leave blank to maximize all plans. Only enter a value if you have a specific dollar target in mind." /></span>
              <div style={{ flex: 1, height: 1, background: T.border }} />
            </div>
            <ExpandRow
              label="Set a target"
              isOpen={useTarget}
              onToggle={() => {
                setUseTarget(v => {
                  if (v) { setTargetAmount(""); setErrors((p) => ({ ...p, targetAmount: "" })); }
                  markDirty();
                  return !v;
                });
              }}
            />
            {useTarget && (
              <div style={{ marginTop: 8, marginBottom: 4 }}>
                <Label tooltip={`Enter your total employee contribution goal for ${PLAN_YEAR}. Plans are filled in order — 403(b) elective first, then 403(b) after-tax, then 401(a) after-tax, then 457(b). Employer contributions are not counted toward your target.`}>
                  Target annual contribution
                </Label>
                <Input value={targetAmount} onChange={(v) => { setTargetAmount(v); setErrors((p) => ({ ...p, targetAmount: "" })); markDirty(); }} prefix="$" type="number" err={errors.targetAmount} />
                <FieldErr msg={errors.targetAmount} />
              </div>
            )}

          </div>

          {/* Sticky Actions Footer */}
          <div style={{ flexShrink: 0, padding: "12px 16px", borderTop: `1px solid ${T.border}`, background: T.surface, display: "flex", gap: 6 }}>
            <button onClick={calculate} style={{
              flex: 1, padding: "10px 14px",
              background: isDirty ? "#6B7280" : T.btn, color: "#FFF",
              border: "none", borderRadius: T.radius, fontSize: "0.85rem",
              fontWeight: 700, fontFamily: T.font, cursor: "pointer",
              transition: "background 0.2s", boxShadow: T.shadow,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
              onMouseOver={(e) => (e.currentTarget.style.background = isDirty ? "#4B5563" : T.btnHover)}
              onMouseOut={(e) => (e.currentTarget.style.background = isDirty ? "#6B7280" : T.btn)}
            >
              {isDirty ? (<><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" /><path d="M6.5 3.5v3.2l2 1.2" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round" /></svg> Recalculate</>) : "Calculate →"}
            </button>
            <button onClick={clearAll} style={{ padding: "10px 16px", background: T.surfaceAlt, color: T.textSub, border: `1.5px solid ${T.border}`, borderRadius: T.radius, fontSize: "0.8rem", fontWeight: 600, fontFamily: T.font, cursor: "pointer", transition: "all 0.15s" }}
              onMouseOver={(e) => (e.currentTarget.style.background = T.border)}
              onMouseOut={(e) => (e.currentTarget.style.background = T.surfaceAlt)}
            >Clear</button>
          </div>
        </div>

        {/* ── RIGHT: Results ── */}
        <div style={{ background: T.surface, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, boxShadow: T.shadowMd, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

          {isDirty && result && (
            <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(249,247,244,0.75)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: T.radiusLg }}>
              <div style={{ background: T.surface, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", padding: "28px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: 260 }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.btnLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path d="M20 11A8 8 0 1 0 4.93 17" stroke={T.btn} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20 7v4h-4" stroke={T.btn} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: T.text, fontFamily: T.font, textAlign: "center" }}>Your information has changed</div>
                <div style={{ fontSize: "0.78rem", color: T.textSub, fontFamily: T.font, textAlign: "center", lineHeight: 1.55 }}>
                  Click <strong>Recalculate</strong> to update your results.
                </div>
              </div>
            </div>
          )}

          <div style={{ overflowY: (isMobile || !result) ? "hidden" : "auto", padding: "14px 16px" }}>

            <div style={{ marginBottom: 14 }}>
              <Divider label="Pay Schedule" />
              <SummaryLine label="Paychecks remaining" value={`${periodsLeft} of ${periodsTotal}`} bold />
              {nextPayday && (
                <SummaryLine
                  label="Next payday"
                  value={cutoffPassed ? <>{fmtPayday(nextPayday)} <span style={{ fontWeight: 400, color: T.textMuted }}>— deadline passed</span></> : fmtPayday(nextPayday)}
                  color={cutoffPassed ? T.textMuted : undefined}
                />
              )}
              {cutoffPassed && firstEligiblePayday && <SummaryLine label="Next available payday" value={fmtPayday(firstEligiblePayday)} bold />}
              {(cutoffPassed ? firstEligibleCutoff : cutoffDate) && <SummaryLine label="Change deadline" value={fmtCutoff(cutoffPassed ? firstEligibleCutoff : cutoffDate)} />}
            </div>

            {!result || isCalculating ? (
              <EmptyResults isCalculating={isCalculating} />
            ) : (
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>

                  {/* 403(b) Card */}
                  <div style={{ background: T.greenLight, border: `1px solid ${T.btnBorder}`, borderRadius: T.radius, overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.btn, fontFamily: T.font }}>403(b)</span>
                      {result.usingTarget && <span style={{ fontSize: "0.65rem", color: T.textMuted, fontFamily: T.font }}>Priority 1 &amp; 2</span>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: T.btnBorder }}>
                      <div style={{ background: T.greenLight, padding: "10px 14px" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textSub, fontFamily: T.font, marginBottom: 4 }}>Elective (Pre-Tax/Roth)</div>
                        {result.electiveNotNeeded
                          ? <div style={{ fontSize: "0.82rem", fontWeight: 600, color: T.textMuted, fontFamily: T.font, lineHeight: 1.4 }}>Not needed — goal met by other plans</div>
                          : result.electiveRem <= 0
                          ? <div style={{ fontSize: "1.1rem", fontWeight: 700, color: T.green, fontFamily: T.font }}>Limit reached ✓</div>
                          : <>
                              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: T.btn, fontFamily: T.font, letterSpacing: "-0.02em", lineHeight: 1 }}>{result.electivePct}%</div>
                              <div style={{ fontSize: "0.78rem", color: T.textSub, fontFamily: T.font, marginTop: 3 }}>{fc(ceilDollar(result.electiveDpc))} per paycheck</div>
                            </>
                        }
                      </div>
                      <div style={{ background: T.greenLight, padding: "10px 14px" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textSub, fontFamily: T.font, marginBottom: 4 }}>After-Tax (Mega Roth)</div>
                        {result.afterTax403bNotNeeded
                          ? <div style={{ fontSize: "0.82rem", fontWeight: 600, color: T.textMuted, fontFamily: T.font, lineHeight: 1.4 }}>Not needed — goal met</div>
                          : result.afterTax403bRem <= 0
                          ? <div style={{ fontSize: "1.1rem", fontWeight: 700, color: T.green, fontFamily: T.font }}>Limit reached ✓</div>
                          : <>
                              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: T.btn, fontFamily: T.font, letterSpacing: "-0.02em", lineHeight: 1 }}>{result.afterTax403bPct}%</div>
                              <div style={{ fontSize: "0.78rem", color: T.textSub, fontFamily: T.font, marginTop: 3 }}>{fc(ceilDollar(result.afterTax403bDpc))} per paycheck</div>
                            </>
                        }
                      </div>
                    </div>
                    <details style={{ borderTop: `1px solid ${T.btnBorder}` }}>
                      <summary style={{ cursor: "pointer", padding: "8px 14px", fontSize: "0.75rem", fontWeight: 600, color: T.btn, fontFamily: T.font, userSelect: "none", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>View details</span>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transition: "transform 0.2s" }} className="details-arrow">
                          <path d="M3 4.5l3 3 3-3" stroke={T.btn} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </summary>
                      <div style={{ padding: "4px 14px 12px" }}>
                        <PlanLine label="Elective allocated toward goal" value={fc(result.electiveRem)} />
                        <PlanLine label="Paychecks to elective limit" value={result.electiveNotNeeded ? "—" : `${result.electiveChecks}`} />
                        <PlanLine label={`Elective limit (402(g)${result.catchUp > 0 ? ` + catch-up` : ""})`} value={fc(result.electiveLimit)} dimmed />
                        <PlanLine label="After-tax allocated toward goal" value={fc(result.afterTax403bRem)} />
                        <PlanLine label="Paychecks to after-tax limit" value={result.afterTax403bNotNeeded ? "—" : `${result.afterTax403bChecks}`} />
                        <PlanLine label="415(c) after-tax room" value={fc(result.afterTax403bLimit)} dimmed />
                        <PlanLine label="Elective contributed (YTD)" value={fc(result.ytd403bElective)} dimmed />
                        <PlanLine label="After-tax contributed (YTD)" value={fc(result.ytd403bAfterTaxAmt)} dimmed />
                      </div>
                    </details>
                  </div>

                  {/* 401(a) Card */}
                  <div style={{ background: T.blueLight, border: `1px solid #BFDBFE`, borderRadius: T.radius, overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.blue, fontFamily: T.font }}>401(a)</span>
                      {result.usingTarget && <span style={{ fontSize: "0.65rem", color: T.textMuted, fontFamily: T.font }}>Priority 3</span>}
                    </div>
                    <div style={{ padding: "0 14px 10px" }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textSub, fontFamily: T.font, marginBottom: 4 }}>After-Tax Employee (Mega Roth)</div>
                      {result.afterTax401aNotNeeded
                        ? <div style={{ fontSize: "0.82rem", fontWeight: 600, color: T.textMuted, fontFamily: T.font, lineHeight: 1.4 }}>Not needed — goal met by 403(b)</div>
                        : result.afterTax401aRem <= 0
                        ? <div style={{ fontSize: "1.1rem", fontWeight: 700, color: T.green, fontFamily: T.font }}>Limit reached ✓</div>
                        : <>
                            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: T.blue, fontFamily: T.font, letterSpacing: "-0.02em", lineHeight: 1 }}>{result.afterTax401aPct}%</div>
                            <div style={{ fontSize: "0.78rem", color: T.textSub, fontFamily: T.font, marginTop: 3 }}>{fc(ceilDollar(result.afterTax401aDpc))} per paycheck</div>
                          </>
                      }
                    </div>
                    <details style={{ borderTop: `1px solid #BFDBFE` }}>
                      <summary style={{ cursor: "pointer", padding: "8px 14px", fontSize: "0.75rem", fontWeight: 600, color: T.blue, fontFamily: T.font, userSelect: "none", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>View details</span>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transition: "transform 0.2s" }} className="details-arrow">
                          <path d="M3 4.5l3 3 3-3" stroke={T.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </summary>
                      <div style={{ padding: "4px 14px 12px" }}>
                        <PlanLine label="After-tax allocated toward goal" value={fc(result.afterTax401aRem)} />
                        <PlanLine label="Paychecks to limit" value={result.afterTax401aNotNeeded ? "—" : `${result.afterTax401aChecks}`} />
                        <PlanLine label="415(c) after-tax room" value={fc(result.afterTax401aLimit)} dimmed />
                        <PlanLine label="Employer match (50% × 8%)" value={fc(result.empMatchAmt)} dimmed />
                        <PlanLine label="Employer discretionary (3%)" value={fc(result.empDiscAmt)} dimmed />
                        <PlanLine label="Employer contributions (projected)" value={fc(result.projectedEmployer401a)} dimmed />
                        <PlanLine label="Employer contributions (YTD)" value={fc(result.ytd401aEmployerAmt)} dimmed />
                        <PlanLine label="After-tax contributed (YTD)" value={fc(result.ytd401aAfterTaxAmt)} dimmed />
                      </div>
                    </details>
                  </div>

                  {/* 457(b) Card */}
                  <div style={{ background: T.preTaxLight, border: `1px solid ${T.preTaxBorder}`, borderRadius: T.radius, overflow: "hidden" }}>
                    <div style={{ padding: "10px 14px 6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.preTax, fontFamily: T.font }}>457(b)</span>
                      {result.usingTarget && <span style={{ fontSize: "0.65rem", color: T.textMuted, fontFamily: T.font }}>Priority 4</span>}
                    </div>
                    <div style={{ padding: "0 14px 10px" }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: T.textSub, fontFamily: T.font, marginBottom: 4 }}>Pre-Tax — Dollar Amount Election</div>
                      {result.notNeeded457b
                        ? <div style={{ fontSize: "0.82rem", fontWeight: 600, color: T.textMuted, fontFamily: T.font, lineHeight: 1.4 }}>Not needed — goal met by higher-priority plans</div>
                        : result.rem457b <= 0
                        ? <div style={{ fontSize: "1.1rem", fontWeight: 700, color: T.green, fontFamily: T.font }}>Limit reached ✓</div>
                        : <>
                            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: T.preTax, fontFamily: T.font, letterSpacing: "-0.02em", lineHeight: 1 }}>{fc(result.dpc457b, 2)}</div>
                            <div style={{ fontSize: "0.78rem", color: T.textSub, fontFamily: T.font, marginTop: 3 }}>per paycheck</div>
                          </>
                      }
                    </div>
                    <details style={{ borderTop: `1px solid ${T.preTaxBorder}` }}>
                      <summary style={{ cursor: "pointer", padding: "8px 14px", fontSize: "0.75rem", fontWeight: 600, color: T.preTax, fontFamily: T.font, userSelect: "none", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>View details</span>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transition: "transform 0.2s" }} className="details-arrow">
                          <path d="M3 4.5l3 3 3-3" stroke={T.preTax} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </summary>
                      <div style={{ padding: "4px 14px 12px" }}>
                        <PlanLine label="Allocated toward goal" value={fc(result.rem457b)} />
                        <PlanLine label="Paychecks to limit" value={result.notNeeded457b ? "—" : `${result.checks457b}`} />
                        <PlanLine label="457(b) annual limit" value={fc(LIMIT_457B)} dimmed />
                        <PlanLine label="Contributed (YTD)" value={fc(result.ytd457bAmt)} dimmed />
                      </div>
                    </details>
                  </div>
                </div>

                {result.catchUp > 0 && (
                  <NoteBox color={result.is6063 ? "#5B21B6" : T.btn} bg={result.is6063 ? "#FAF5FF" : T.greenLight} border={result.is6063 ? "#E9D5FF" : T.btnBorder}>
                    <strong>{result.is6063 ? "Enhanced catch-up (ages 60–63):" : "Catch-up eligible (age 50+):"}</strong>{" "}
                    Your {fc(result.catchUp)} catch-up is added above the 415(c) limit in the 403(b) elective bucket.
                    {result.is6063 && ` This enhanced window closes the year you turn 64, at which point catch-up reverts to ${fc(LIMIT_CATCHUP_50)}.`}
                  </NoteBox>
                )}

                {(() => {
                  const proj403bElective = result.ytd403bElective + Math.min(result.electiveRem > 0 ? result.electiveDpc * result.electiveChecks : 0, result.electiveRem);
                  const proj403bAfterTax = result.ytd403bAfterTaxAmt + Math.min(result.afterTax403bRem > 0 ? result.afterTax403bDpc * result.afterTax403bChecks : 0, result.afterTax403bRem);
                  const proj401aAfterTax = result.ytd401aAfterTaxAmt + Math.min(result.afterTax401aRem > 0 ? result.afterTax401aDpc * result.afterTax401aChecks : 0, result.afterTax401aRem);
                  const proj457b = result.ytd457bAmt + Math.min(result.rem457b > 0 ? result.dpc457b * result.checks457b : 0, result.rem457b);
                  const totalEmployee = proj403bElective + proj403bAfterTax + proj401aAfterTax + proj457b;
                  const totalAll = totalEmployee + result.totalEmployer401a;

                  return (
                    <details style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "12px", marginTop: 12 }}>
                      <summary style={{ cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, color: "#1F2937", padding: "8px 0", userSelect: "none", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>Projected Full Year Summary</span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transition: "transform 0.2s" }} className="details-arrow">
                          <path d="M3 4.5l3 3 3-3" stroke={T.textSub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </summary>
                      <div style={{ paddingTop: 8, marginTop: 8 }}>
                        <Divider label="Employee Contributions" />
                        <SummaryLine label="403(b) elective (pre-tax / Roth)" value={fc(proj403bElective)} />
                        <SummaryLine label="403(b) after-tax (Mega Roth)" value={fc(proj403bAfterTax)} />
                        <SummaryLine label="401(a) after-tax (Mega Roth)" value={fc(proj401aAfterTax)} />
                        <SummaryLine label="457(b) pre-tax" value={fc(proj457b)} />
                        <SummaryLine label="Total employee" value={fc(totalEmployee)} bold />
                        <Divider label="Employer Contributions" />
                        <SummaryLine label={`Match — 50% × 8% of ${fc(result.compBasis)}`} value={fc(result.empMatchAmt)} dimmed indent />
                        <SummaryLine label={`Discretionary — 3% of ${fc(result.compBasis)}`} value={fc(result.empDiscAmt)} dimmed indent />
                        <SummaryLine label="Total employer" value={fc(result.totalEmployer401a)} bold />
                        <Divider />
                        <SummaryLine label="Total retirement compensation" value={fc(totalAll)} bold color={T.total} />
                      </div>
                    </details>
                  );
                })()}
              </div>
            )}
          </div>

          <div style={{ flexShrink: 0, padding: "8px 16px", borderTop: `1px solid ${T.border}`, background: T.surfaceAlt }}>
            <div style={{ fontSize: "0.64rem", color: T.textMuted, lineHeight: 1.55 }}>
              Pay schedule from the Baptist Health {PLAN_YEAR} bi-weekly payroll calendar. Rates rounded up to nearest whole %. Based on {PLAN_YEAR} IRS limits. Employer contributions estimated from plan design — actual amounts may vary. For educational use only — not financial or tax advice.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
