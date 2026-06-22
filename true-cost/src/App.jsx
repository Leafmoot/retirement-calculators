import { useState, useRef, useEffect } from "react";

// ── 2026 Federal Tax Brackets ──
const FEDERAL_BRACKETS = {
  single: [
    { limit: 11925, rate: 0.1 },
    { limit: 48475, rate: 0.12 },
    { limit: 103350, rate: 0.22 },
    { limit: 197300, rate: 0.24 },
    { limit: 250525, rate: 0.32 },
    { limit: 626350, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  married: [
    { limit: 23850, rate: 0.1 },
    { limit: 96950, rate: 0.12 },
    { limit: 206700, rate: 0.22 },
    { limit: 394600, rate: 0.24 },
    { limit: 501050, rate: 0.32 },
    { limit: 751600, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  hoh: [
    { limit: 17000, rate: 0.1 },
    { limit: 64850, rate: 0.12 },
    { limit: 103350, rate: 0.22 },
    { limit: 197300, rate: 0.24 },
    { limit: 250500, rate: 0.32 },
    { limit: 626350, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
};

const STANDARD_DEDUCTION = {
  single: 15000,
  married: 30000,
  hoh: 22500,
};

// Get marginal tax rate for a given income and filing status
function getMarginalRate(annualSalary, filingStatus) {
  const taxableIncome = Math.max(
    0,
    annualSalary - STANDARD_DEDUCTION[filingStatus]
  );
  const brackets = FEDERAL_BRACKETS[filingStatus];

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.limit) {
      return bracket.rate;
    }
  }

  return brackets[brackets.length - 1].rate;
}

function fc(val, decimals = 0) {
  return val.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function parse(str) {
  const v = parseFloat((str || "").replace(/,/g, ""));
  return isNaN(v) ? 0 : v;
}

// Inserts thousands separators into a raw numeric string (e.g. "1234.5" -> "1,234.5")
function formatThousands(raw) {
  if (raw === "") return "";
  const parts = raw.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

const EMPTY_ERR = {
  salary: "",
  filingStatus: "",
  payPeriods: "",
  preTaxPct: "",
  rothPct: "",
};

const T = {
  bg: "#F4F4F4",
  surface: "#FFFFFF",
  surfaceAlt: "#F8F8F8",
  border: "#DDE3E8",
  borderStrong: "#BCC5CE",
  text: "#1C1917",
  textSub: "#78716C",
  textMuted: "#A8A29E",
  amber: "#B45309",
  amberLight: "#FEF3C7",
  amberMid: "#F59E0B",
  amberDark: "#92400E",
  // Pre-Tax scheme — violet/indigo
  preTax: "#6D28D9",
  preTaxLight: "#F5F3FF",
  preTaxDark: "#4C1D95",
  preTaxBorder: "#DDD6FE",
  blue: "#1D4ED8",
  blueLight: "#EFF6FF",
  blueMid: "#3B82F6",
  red: "#DC2626",
  redLight: "#FEF2F2",
  green: "#16A34A",
  greenLight: "#F0FDF4",
  // Button + totals — Milliman brand blue
  btn: "#0078D4",
  btnHover: "#106EBE",
  btnLight: "#E8F0FD",
  // Darker variant of the brand blue — used as text/icon color on the light blue
  // background above, since the brand blue itself doesn't have enough contrast there
  btnText: "#005A9E",
  // Informational notice — calm slate blue
  info: "#1E40AF",
  infoLight: "#EFF6FF",
  infoBorder: "#BFDBFE",
  // Age 64+ reversion notice — soft teal
  teal: "#0F766E",
  tealLight: "#F0FDFA",
  tealBorder: "#99F6E4",
  shadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
  radius: "10px",
  radiusLg: "16px",
  font: "'Instrument Sans', 'DM Sans', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', 'Fira Code', monospace",
};

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
            position: "fixed", zIndex: 9999,
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

function Label({ children, sub, tooltip }) {
  return (
    <div
      style={{
        marginBottom: 4,
        minHeight: 20, // Ensures consistent height even with single-line labels
        display: "flex",
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontSize: "0.82rem",
          fontWeight: 600,
          color: T.text,
          fontFamily: T.font,
          letterSpacing: "-0.01em",
        }}
      >
        {children}
        {tooltip && <span style={{ fontSize: "14px", lineHeight: 1 }}><InfoTooltip text={tooltip} /></span>}
      </span>
      {sub && (
        <span
          style={{
            fontSize: "0.74rem",
            color: T.textMuted,
            marginLeft: 6,
            fontFamily: T.font,
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

function FieldErr({ msg }) {
  if (!msg) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginTop: 4,
        fontSize: "0.74rem",
        color: T.red,
        fontFamily: T.font,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5.5" stroke={T.red} />
        <path
          d="M6 3.5v3M6 8v.5"
          stroke={T.red}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
      {msg}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  prefix,
  err,
  min,
  max,
  inputRef,
  integersOnly = false,
}) {
  const handleChange = (e) => {
    const newValue = e.target.value;

    // For number inputs, only allow digits, one decimal point, and empty string
    if (type === "number") {
      // Allow empty string
      if (newValue === "") {
        onChange("");
        return;
      }

      // For integers only (like age), don't allow decimal point
      if (integersOnly) {
        if (!/^\d*$/.test(newValue)) {
          return; // Reject invalid input
        }
      } else {
        // Only allow numbers and one decimal point (strip commas first so formatted values pass)
        if (!/^[\d,]*\.?\d*$/.test(newValue)) {
          return; // Reject invalid input
        }
      }
    }

    onChange(newValue);
  };

  return (
    <div
      style={{ position: "relative" }}
      className={err ? "field-shake" : ""}
      key={err ? "err" : "ok"}
    >
      {prefix && (
        <span
          style={{
            position: "absolute",
            left: 11,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.85rem",
            color: err ? T.red : T.textSub,
            fontFamily: T.font,
            pointerEvents: "none",
          }}
        >
          {prefix}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode={type === "number" ? "numeric" : "text"}
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={(e) =>
          (e.target.style.boxShadow = `0 0 0 3px ${
            err ? "#FCA5A544" : "#F59E0B33"
          }`)
        }
        onBlur={(e) => (e.target.style.boxShadow = "none")}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: prefix ? "9px 12px 9px 22px" : "9px 12px",
          fontSize: "0.875rem",
          fontFamily: T.font,
          color: T.text,
          background: err ? T.redLight : T.surface,
          border: `1.5px solid ${err ? T.red : T.border}`,
          borderRadius: T.radius,
          outline: "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      />
    </div>
  );
}

function Select({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "9px 12px",
          fontSize: "0.8rem",
          fontFamily: T.font,
          color: T.text,
          fontWeight: 400,
          background: T.surface,
          border: `1.5px solid ${open ? T.btn : T.border}`,
          borderRadius: T.radius,
          outline: "none",
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transition: "all 0.15s",
          boxShadow: open ? `0 0 0 3px ${T.btnLight}` : "none",
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.background = T.surfaceAlt;
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = T.surface;
          }
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {selected?.label ?? ""}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            flexShrink: 0,
            marginLeft: 8,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        >
          <path
            d="M2 4l4 4 4-4"
            stroke={T.textSub}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: T.surface,
            border: `1.5px solid ${T.border}`,
            borderRadius: T.radius,
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            overflow: "auto",
            maxHeight: 200,
          }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={{
                width: "100%",
                padding: "7px 12px",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontFamily: T.font,
                fontWeight: o.value === value ? 600 : 400,
                color: o.value === value ? T.btn : T.text,
                background: o.value === value ? T.btnLight : T.surface,
                border: "none",
                outline: "none",
                display: "block",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (o.value !== value)
                  e.currentTarget.style.background = T.surfaceAlt;
              }}
              onMouseLeave={(e) => {
                if (o.value !== value)
                  e.currentTarget.style.background = T.surface;
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TogglePair({ options, value, onChange, err }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {options.map((opt) => {
        const sel = value === opt.val;
        return (
          <button
            key={String(opt.val)}
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

function Divider({ label }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: "14px 0 10px",
      }}
    >
      {label && (
        <span
          style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: T.textMuted,
            fontFamily: T.font,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      )}
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  );
}

function SummaryLine({ label, value, color, bold, indent, dimmed }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "4px 0",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <span
        style={{
          fontSize: "0.78rem",
          fontFamily: T.font,
          color: dimmed ? T.textMuted : T.textSub,
          paddingLeft: indent ? 12 : 0,
          fontWeight: bold ? 600 : 400,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: bold ? "0.84rem" : "0.8rem",
          fontFamily: T.font,
          fontWeight: bold ? 700 : 500,
          color: color || T.text,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function StatCard({ label, value, sub, subLines, color, small }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "8px",
        border: "1px solid #E5E7EB",
        padding: small ? "16px 18px" : "20px 24px",
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxShadow:
          "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
      }}
      className="mobile-padding-sm print-break-avoid"
    >
      <div style={{ width: "100%", textAlign: "center" }}>
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            letterSpacing: "0.01em",
            color: T.textSub,
            fontFamily: T.font,
            marginBottom: 6,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: small ? "1.8rem" : "2.5rem",
            fontWeight: 600,
            color: T.text,
            lineHeight: 1,
            fontFamily: T.font,
            letterSpacing: "-0.03em",
            fontVariantNumeric: "tabular-nums",
            marginBottom: 4,
          }}
          className="mobile-text-sm"
        >
          {value}
        </div>
        {sub && (
          <div
            style={{
              fontSize: "0.8rem",
              color: T.textSub,
              fontFamily: T.font,
              lineHeight: 1.5,
            }}
          >
            {sub}
          </div>
        )}
        {subLines && subLines.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginTop: sub ? 0 : 0,
            }}
          >
            {subLines.map((line, i) => {
              const text = typeof line === "string" ? line : line.text;
              return (
                <div
                  key={i}
                  style={{
                    fontSize: "0.85rem",
                    color: T.textSub,
                    fontFamily: T.font,
                    lineHeight: 1.5,
                  }}
                >
                  {text}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function NoteBox({ color, bg, border, children }) {
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: T.radius,
        padding: "10px 12px",
        fontSize: "0.8rem",
        color,
        lineHeight: 1.55,
        fontFamily: T.font,
      }}
    >
      {children}
    </div>
  );
}

function EmptyResults({ isCalculating }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 320,
        padding: 32,
      }}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: T.radiusLg,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
          padding: "28px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          maxWidth: 260,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: T.btnLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <style>{`
              @keyframes bar1 { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.4)} }
              @keyframes bar2 { 0%,100%{transform:scaleY(1)} 33%{transform:scaleY(1.25)} 66%{transform:scaleY(0.6)} }
              @keyframes bar3 { 0%,100%{transform:scaleY(1)} 25%{transform:scaleY(0.5)} 75%{transform:scaleY(1.2)} }
              @keyframes fieldShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
              .field-shake { animation: fieldShake 0.35s ease-in-out; }
            `}</style>
            <rect
              x="2"
              y="12"
              width="4"
              height="10"
              rx="1"
              fill={T.btn}
              opacity="0.5"
              style={
                isCalculating
                  ? {
                      transformOrigin: "center bottom",
                      animation: "bar1 0.9s ease-in-out infinite",
                    }
                  : {}
              }
            />
            <rect
              x="9"
              y="7"
              width="4"
              height="15"
              rx="1"
              fill={T.btn}
              opacity="0.75"
              style={
                isCalculating
                  ? {
                      transformOrigin: "center bottom",
                      animation: "bar2 0.9s ease-in-out infinite 0.15s",
                    }
                  : {}
              }
            />
            <rect
              x="16"
              y="3"
              width="4"
              height="19"
              rx="1"
              fill={T.btn}
              style={
                isCalculating
                  ? {
                      transformOrigin: "center bottom",
                      animation: "bar3 0.9s ease-in-out infinite 0.3s",
                    }
                  : {}
              }
            />
          </svg>
        </div>
        <div
          style={{
            fontSize: "0.9rem",
            fontWeight: 700,
            color: T.text,
            fontFamily: T.font,
            textAlign: "center",
          }}
        >
          {isCalculating
            ? "Calculating…"
            : "See What Your Contributions Really Cost"}
        </div>
        {!isCalculating && (
          <div
            style={{
              fontSize: "0.8rem",
              color: T.textSub,
              fontFamily: T.font,
              textAlign: "center",
              lineHeight: 1.55,
            }}
          >
            Enter your salary and contribution rates to see your per-paycheck cost — and how much pre-tax saving puts back in your pocket.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [salary, setSalary] = useState("");
  const [filingStatus, setFilingStatus] = useState("single");
  const [payPeriods, setPayPeriods] = useState("26");
  const [preTaxPct, setPreTaxPct] = useState("");
  const [rothPct, setRothPct] = useState("");

  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState(EMPTY_ERR);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showAnnual, setShowAnnual] = useState(false);

  const salaryRef = useRef(null);
  const preTaxPctRef = useRef(null);

  function markDirty() {
    if (calculated) setIsDirty(true);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Enter" && !e.shiftKey) calculate();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const ppOpts = [
    { label: "Weekly — 52 paychecks", value: "52" },
    { label: "Bi-Weekly — 26 paychecks", value: "26" },
    { label: "Bi-Weekly — 27 paychecks", value: "27" },
    { label: "Semi-Monthly — 24 paychecks", value: "24" },
    { label: "Monthly — 12 paychecks", value: "12" },
  ];

  const filingOpts = [
    { label: "Single", value: "single" },
    { label: "Married Filing Jointly", value: "married" },
    { label: "Head of Household", value: "hoh" },
  ];

  function calculate() {
    const errs = { ...EMPTY_ERR };
    let bad = false;

    const annualSalary = parse(salary);
    const pp = parseInt(payPeriods);
    const preTaxRate = parse(preTaxPct) / 100;
    const rothRate = parse(rothPct) / 100;

    if (!annualSalary || annualSalary <= 0) {
      errs.salary = "Enter your annual salary.";
      bad = true;
    } else if (annualSalary > 0 && annualSalary < 10000) {
      errs.salary = "This looks low for an annual salary.";
      bad = true;
    }

    if (preTaxRate + rothRate > 1) {
      errs.preTaxPct = "Combined contributions cannot exceed 100%.";
      errs.rothPct = "Combined contributions cannot exceed 100%.";
      bad = true;
    }

    if (preTaxRate === 0 && rothRate === 0) {
      errs.preTaxPct = "Enter at least one contribution percentage.";
      errs.rothPct = "Enter at least one contribution percentage.";
      bad = true;
    }

    setErrors(errs);
    setCalculated(true);
    setIsDirty(false);

    if (bad) {
      setResult(null);
      setTimeout(() => {
        if (errs.salary) {
          salaryRef.current?.focus();
          return;
        }
        if (errs.preTaxPct || errs.rothPct) {
          preTaxPctRef.current?.focus();
          return;
        }
      }, 50);
      return;
    }

    setResult(null);
    setIsCalculating(true);

    setTimeout(() => {
      setIsCalculating(false);

      const perPaycheck = annualSalary / pp;

      // Get marginal tax rate
      const marginalRate = getMarginalRate(annualSalary, filingStatus);

      // Pre-tax calculations
      const preTaxContribution = perPaycheck * preTaxRate;
      const preTaxTaxSavings = preTaxContribution * marginalRate;
      const preTaxTrueCost = preTaxContribution - preTaxTaxSavings;

      // Roth calculations (no tax benefit)
      const rothContribution = perPaycheck * rothRate;
      const rothTrueCost = rothContribution;

      // Totals
      const totalContribution = preTaxContribution + rothContribution;
      const totalTrueCost = preTaxTrueCost + rothTrueCost;
      const totalTaxSavings = preTaxTaxSavings;

      // Annual totals
      const annualTotalContribution = totalContribution * pp;
      const annualTrueCost = totalTrueCost * pp;
      const annualTaxSavings = totalTaxSavings * pp;

      const selectedPpOpt = ppOpts.find((o) => o.value === payPeriods);
      const payPeriodLabel = selectedPpOpt ? selectedPpOpt.label.split(" — ")[0] : "";

      setResult({
        perPaycheck,
        totalContribution,
        totalTrueCost,
        totalTaxSavings,
        preTaxContribution,
        preTaxTrueCost,
        preTaxTaxSavings,
        rothContribution,
        rothTrueCost,
        annualTotalContribution,
        annualTrueCost,
        annualTaxSavings,
        marginalRate,
        payPeriods: pp,
        payPeriodLabel,
      });
    }, 650);
  }

  function clearAll() {
    setSalary("");
    setFilingStatus("single");
    setPayPeriods("26");
    setPreTaxPct("");
    setRothPct("");
    setResult(null);
    setErrors(EMPTY_ERR);
    setCalculated(false);
    setIsDirty(false);
    setIsCalculating(false);
    setShowAnnual(false);
  }

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: T.bg,
        fontFamily: T.font,
        overflow: "auto",
        position: "relative",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style>
        {`
          input[type=number]::-webkit-inner-spin-button,
          input[type=number]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type=number] {
            -moz-appearance: textfield;
            appearance: textfield;
          }
          details[open] .details-arrow {
            transform: rotate(180deg);
          }
          
          @media (max-width: 1023px) {
            .mobile-stack {
              grid-template-columns: 1fr !important;
            }
            .mobile-text-sm {
              font-size: 1.6rem !important;
            }
            .mobile-padding-sm {
              padding: 16px 18px !important;
            }
          }
          
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              background: white !important;
            }
            .print-break-avoid {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            [style*="grid-template-columns"] {
              display: block !important;
            }
            h1 {
              font-size: 18pt !important;
              margin-bottom: 12pt !important;
            }
            [style*="borderRadius"] {
              border: 1px solid #ddd !important;
              box-shadow: none !important;
            }
            [style*="background: #F"] {
              background: white !important;
            }
          }
        `}
      </style>

      {/* Grain texture */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          opacity: 0.025,
          pointerEvents: "none",
          zIndex: 0,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Header */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          flexShrink: 0,
          padding: "12px 20px 10px",
          borderBottom: `1px solid ${T.borderStrong}`,
          background: T.btn,
          display: "flex",
          alignItems: "center",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: isMobile ? "1rem" : "1.1rem",
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: "-0.03em",
          }}
        >
          True Cost Calculator
        </h1>
      </div>

      {/* Body */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: isMobile ? "flex" : "grid",
          flexDirection: isMobile ? "column" : undefined,
          gridTemplateColumns: isMobile
            ? undefined
            : "minmax(0, 420px) minmax(632px, 680px)",
          gap: 12,
          padding: "12px 16px",
          maxWidth: 1140,
          width: "100%",
          margin: "0 auto",
          boxSizing: "border-box",
          alignItems: "start",
        }}
      >
        {/* LEFT: Inputs */}
        <div
          style={{
            background: isMobile ? T.surface : "#FAFAF9",
            borderRadius: T.radiusLg,
            border: `1px solid ${T.border}`,
            boxShadow: T.shadowMd,
            display: "flex",
            flexDirection: "column",
            minHeight: isMobile ? "auto" : 0,
          }}
        >
          <div
            style={{
              flex: 1,
              padding: "12px 16px",
            }}
          >
            {/* Annual Salary + Filing Status */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 6,
              }}
              className="mobile-stack"
            >
              <div>
                <Label tooltip="Your total annual salary before any deductions.">
                  Annual Salary
                </Label>
                <Input
                  value={salary}
                  onChange={(v) => {
                    // Strip existing commas, then re-insert them
                    const raw = v.replace(/,/g, "");
                    setSalary(formatThousands(raw));
                    markDirty();
                  }}
                  placeholder=""
                  prefix="$"
                  type="number"
                  err={errors.salary}
                  inputRef={salaryRef}
                  onEnter={calculate}
                />
                <FieldErr msg={errors.salary} />
              </div>
              <div>
                <Label tooltip="Your filing status determines your marginal tax rate and the tax savings from pre-tax contributions.">
                  Filing Status
                </Label>
                <Select
                  value={filingStatus}
                  onChange={(v) => {
                    setFilingStatus(v);
                    markDirty();
                  }}
                  options={filingOpts}
                />
              </div>
            </div>

            {/* Pay Frequency */}
            <div style={{ marginBottom: 10 }}>
              <Label tooltip="How often you receive paychecks.">
                Pay Frequency
              </Label>
              <Select
                value={payPeriods}
                onChange={(v) => {
                  setPayPeriods(v);
                  markDirty();
                }}
                options={ppOpts}
              />
            </div>

            <Divider label="Contribution Rates" />

            {/* Contribution Percentages */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 6,
              }}
              className="mobile-stack"
            >
              <div>
                <Label tooltip="Contributions are made before taxes, reducing your taxable income and lowering what's taken out of your paycheck. The money is taxed when you withdraw it in retirement, at whatever tax rate applies to you at that time.">
                  Pre-Tax %
                </Label>
                <Input
                  value={preTaxPct}
                  onChange={(v) => {
                    setPreTaxPct(v);
                    markDirty();
                  }}
                  placeholder="0"
                  suffix="%"
                  type="number"
                  err={errors.preTaxPct}
                  inputRef={preTaxPctRef}
                  onEnter={calculate}
                />
                <FieldErr msg={errors.preTaxPct} />
              </div>
              <div>
                <Label tooltip="Contributions are made after taxes, so the full contribution amount is taken out of your paycheck with no tax offset. To withdraw earnings tax-free, you must have a qualifying distribution event, be at least 59½, and your original Roth contribution must have been made at least five years prior.">
                  Roth % (After-Tax)
                </Label>
                <Input
                  value={rothPct}
                  onChange={(v) => {
                    setRothPct(v);
                    markDirty();
                  }}
                  placeholder="0"
                  suffix="%"
                  type="number"
                  err={errors.rothPct}
                  onEnter={calculate}
                />
                <FieldErr msg={errors.rothPct} />
              </div>
            </div>
          </div>

          {/* Sticky Actions Footer */}
          <div
            style={{
              flexShrink: 0,
              padding: "12px 16px",
              borderTop: `1px solid ${T.border}`,
              background: T.surface,
              display: "flex",
              gap: 6,
              borderRadius: `0 0 ${T.radiusLg} ${T.radiusLg}`,
            }}
            className="no-print"
          >
            <button
              onClick={calculate}
              style={{
                flex: 1,
                padding: "10px 14px",
                background: isDirty ? "#6B7280" : T.btn,
                color: "#FFF",
                border: "none",
                borderRadius: T.radius,
                fontSize: "0.85rem",
                fontWeight: 700,
                fontFamily: T.font,
                cursor: "pointer",
                letterSpacing: "-0.01em",
                transition: "background 0.2s",
                boxShadow: T.shadow,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = isDirty
                  ? "#4B5563"
                  : T.btnHover)
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.background = isDirty ? "#6B7280" : T.btn)
              }
            >
              {isDirty && (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 13 13"
                  fill="none"
                  style={{ flexShrink: 0 }}
                >
                  <circle
                    cx="6.5"
                    cy="6.5"
                    r="5.5"
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M6.5 3.5v3.2l2 1.2"
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              {isDirty ? "Recalculate" : "Calculate →"}
            </button>
            <button
              onClick={clearAll}
              style={{
                padding: "10px 14px",
                background: T.surfaceAlt,
                color: T.textSub,
                border: `1.5px solid ${T.border}`,
                borderRadius: T.radius,
                fontSize: "0.8rem",
                fontWeight: 600,
                fontFamily: T.font,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = T.border;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = T.surfaceAlt;
              }}
            >
              Clear
            </button>
          </div>

        </div>

        {/* RIGHT: Results */}
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div
          style={{
            background: T.surface,
            borderRadius: T.radiusLg,
            border: `1px solid ${T.border}`,
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {isDirty && result && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 10,
                background: "rgba(249,247,244,0.75)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: T.radiusLg,
              }}
            >
              <div
                style={{
                  background: T.surface,
                  borderRadius: T.radiusLg,
                  border: `1px solid ${T.border}`,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                  padding: "28px 32px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  maxWidth: 260,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: T.btnLight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                    <path d="M20 11A8 8 0 1 0 4.93 17" stroke={T.btn} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20 7v4h-4" stroke={T.btn} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: T.text, fontFamily: T.font, textAlign: "center" }}>
                  Your information has changed
                </div>
                <div style={{ fontSize: "0.78rem", color: T.textSub, fontFamily: T.font, textAlign: "center", lineHeight: 1.55 }}>
                  Click <strong>Recalculate</strong> to update your results based on the new values you've entered.
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              overflowY: (isMobile || !result) ? "hidden" : "auto",
              padding: "12px 16px 16px",
            }}
          >

            {!result && <EmptyResults isCalculating={isCalculating} />}

            {result && !isCalculating && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {/* Unified Summary Bar */}
                <div className="print-break-avoid">
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textSub, fontFamily: T.font, whiteSpace: "nowrap" }}>
                      Per Paycheck Summary
                    </span>
                    <div style={{ flex: 1, height: 1, background: T.border }} />
                  </div>
                  <div
                    style={{
                      background: T.surface,
                      borderRadius: T.radius,
                      border: `1px solid ${T.border}`,
                      boxShadow: T.shadow,
                      overflow: "hidden",
                    }}
                  >
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(210px, 1fr) 1px minmax(210px, 1fr) 1px minmax(210px, 1fr)",
                  }}
                  className="mobile-stack"
                  >
                  {/* Column 1 — Total Contribution */}
                  <div style={{ padding: "12px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: T.textSub, fontFamily: T.font, marginBottom: 4, letterSpacing: "0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                      {result.preTaxContribution > 0 && result.rothContribution > 0
                        ? "Total Contribution"
                        : result.preTaxContribution > 0
                        ? "Pre-Tax Contribution"
                        : "Roth Contribution"}
                      <InfoTooltip text="The amount going into your retirement account each paycheck." />
                    </div>
                    <div style={{ fontSize: "1.9rem", fontWeight: 600, color: T.text, lineHeight: 1, fontFamily: T.font, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", marginBottom: 4 }} className="mobile-text-sm">
                      {fc(result.totalContribution)}
                    </div>
                    {result.preTaxContribution > 0 && result.rothContribution > 0 && (
                      <div style={{ display: "flex", gap: 20, borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 10, justifyContent: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <span style={{ fontSize: "0.75rem", color: T.textMuted, fontFamily: T.font }}>Pre-Tax</span>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: T.text, fontFamily: T.font }}>{fc(result.preTaxContribution)}</span>
                        </div>
                        <div style={{ width: 1, background: T.border, alignSelf: "stretch" }} />
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <span style={{ fontSize: "0.75rem", color: T.textMuted, fontFamily: T.font }}>Roth</span>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: T.text, fontFamily: T.font }}>{fc(result.rothContribution)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Vertical Divider */}
                  <div style={{ background: T.border }} />

                  {/* Column 2 — Tax Savings */}
                  <div style={{ padding: "12px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: T.textSub, fontFamily: T.font, marginBottom: 4, letterSpacing: "0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                      Tax Savings
                      <InfoTooltip text="When you contribute pre-tax, your taxable income goes down — which means less taken out for federal taxes. This is how much you save." />
                    </div>
                    <div style={{ fontSize: "1.9rem", fontWeight: 600, color: T.green, lineHeight: 1, fontFamily: T.font, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", marginBottom: 4 }} className="mobile-text-sm">
                      {fc(result.totalTaxSavings)}
                    </div>
                    {result.preTaxContribution > 0 && result.rothContribution > 0 && (
                      <div style={{ display: "flex", gap: 20, borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 10, justifyContent: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <span style={{ fontSize: "0.75rem", color: T.textMuted, fontFamily: T.font }}>Pre-Tax</span>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: T.green, fontFamily: T.font }}>{fc(result.preTaxTaxSavings)}</span>
                        </div>
                        <div style={{ width: 1, background: T.border, alignSelf: "stretch" }} />
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <span style={{ fontSize: "0.75rem", color: T.textMuted, fontFamily: T.font }}>Roth</span>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: T.text, fontFamily: T.font }}>$0</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Vertical Divider */}
                  <div style={{ background: T.border }} />

                  {/* Column 3 — True Cost */}
                  <div style={{ padding: "12px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: T.textSub, fontFamily: T.font, marginBottom: 4, letterSpacing: "0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
                      True Cost
                      <InfoTooltip text="What contributing actually costs you out of pocket. It is lower than your total contribution because the tax savings offset part of it." />
                    </div>
                    <div style={{ fontSize: "1.9rem", fontWeight: 600, color: T.text, lineHeight: 1, fontFamily: T.font, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", marginBottom: 4 }} className="mobile-text-sm">
                      {fc(result.totalTrueCost)}
                    </div>
                    {result.preTaxContribution > 0 && result.rothContribution > 0 && (
                      <div style={{ display: "flex", gap: 20, borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 10, justifyContent: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <span style={{ fontSize: "0.75rem", color: T.textMuted, fontFamily: T.font }}>Pre-Tax</span>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: T.text, fontFamily: T.font }}>{fc(result.preTaxTrueCost)}</span>
                        </div>
                        <div style={{ width: 1, background: T.border, alignSelf: "stretch" }} />
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                          <span style={{ fontSize: "0.75rem", color: T.textMuted, fontFamily: T.font }}>Roth</span>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: T.text, fontFamily: T.font }}>{fc(result.rothTrueCost)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  </div>
                  </div>
                </div>

                {/* Collapsible Annual Totals */}
                <details
                  style={{
                    background: T.surfaceAlt,
                    borderRadius: T.radius,
                    border: `1px solid ${T.border}`,
                    overflow: "hidden",
                  }}
                  open={showAnnual}
                  onToggle={(e) => setShowAnnual(e.target.open)}
                >
                  <summary
                    style={{
                      padding: "10px 16px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: T.text,
                      fontFamily: T.font,
                      listStyle: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      userSelect: "none",
                      transition: "background 0.15s, color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = T.btnLight;
                      e.currentTarget.style.color = T.btnText;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = T.text;
                    }}
                  >
                    <span>Calculation Breakdown</span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      className="details-arrow"
                      style={{ transition: "transform 0.2s" }}
                    >
                      <path
                        d="M3 5l4 4 4-4"
                        stroke={T.textSub}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </summary>
                  <div style={{ padding: "0 14px 14px" }}>
                    {result.preTaxContribution > 0 && (
                      <>
                        <div
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: T.textSub,
                            fontFamily: T.font,
                            marginTop: 16,
                            marginBottom: 4,
                            paddingBottom: 4,
                            borderBottom: `1px solid ${T.border}`,
                          }}
                        >
                          Pre-Tax — Annual
                        </div>
                        <SummaryLine
                          label="Contribution"
                          value={fc(
                            result.preTaxContribution * result.payPeriods
                          )}
                          indent
                        />
                        <SummaryLine
                          label="True Cost"
                          value={fc(result.preTaxTrueCost * result.payPeriods)}
                          indent
                        />
                        <SummaryLine
                          label="Tax Savings"
                          value={fc(
                            result.preTaxTaxSavings * result.payPeriods
                          )}
                          color={T.green}
                          indent
                        />
                      </>
                    )}

                    {result.rothContribution > 0 && (
                      <>
                        <div
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: T.textSub,
                            fontFamily: T.font,
                            marginTop: 16,
                            marginBottom: 4,
                            paddingBottom: 4,
                            borderBottom: `1px solid ${T.border}`,
                          }}
                        >
                          Roth — Annual
                        </div>
                        <SummaryLine
                          label="Contribution"
                          value={fc(
                            result.rothContribution * result.payPeriods
                          )}
                          indent
                        />
                        <SummaryLine
                          label="True Cost"
                          value={fc(result.rothTrueCost * result.payPeriods)}
                          indent
                        />
                        <SummaryLine
                          label="Tax Savings"
                          value="$0"
                          indent
                        />
                      </>
                    )}

                    {result.preTaxContribution > 0 && result.rothContribution > 0 && (
                      <>
                        <div
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            color: T.textSub,
                            fontFamily: T.font,
                            marginTop: 16,
                            marginBottom: 4,
                            paddingBottom: 4,
                            borderBottom: `1px solid ${T.border}`,
                          }}
                        >
                          Combined — Annual
                        </div>
                        <SummaryLine
                          label="Contribution"
                          value={fc(result.annualTotalContribution)}
                          indent
                        />
                        <SummaryLine
                          label="True Cost"
                          value={fc(result.annualTrueCost)}
                          indent
                        />
                        <SummaryLine
                          label="Tax Savings"
                          value={fc(result.annualTaxSavings)}
                          color={T.green}
                          indent
                        />
                      </>
                    )}
                  </div>
                </details>

                {/* Informational note */}
                <NoteBox color={T.info} bg={T.infoLight} border={T.infoBorder}>
                  <strong>Note:</strong> Calculations use{" "}
                  {(result.marginalRate * 100).toFixed(0)}% federal marginal
                  rate based on your salary and filing status. State taxes not
                  included.
                </NoteBox>

              </div>
            )}
          </div>
        </div>{/* end right card */}

        {/* Footer disclaimer — right column, matches HPH */}
        <div
          style={{
            fontSize: "0.64rem",
            color: T.textMuted,
            lineHeight: 1.55,
            padding: "6px 4px 0",
            fontFamily: T.font,
          }}
          className="no-print"
        >
          Estimates are based on federal marginal tax rates and do not account for state or local taxes, Social Security or Medicare withholding, or other deductions. For educational use only — not financial or tax advice. Consult a qualified tax or financial professional for guidance specific to your situation.{" "}
          <br />Last updated: June 2026
        </div>
        </div>{/* end right column wrapper */}

      </div>
    </div>
  );
}
