import { useState, useRef, useEffect } from "react";

// ── 2026 Federal Tax Brackets ──
const TAX_YEAR = 2026;

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

const FICA_SS_RATE = 0.062;
const FICA_SS_LIMIT = 176100; // 2026 wage base limit
const FICA_MEDICARE_RATE = 0.0145;
const FICA_MEDICARE_ADDITIONAL_RATE = 0.009;
const FICA_MEDICARE_ADDITIONAL_THRESHOLD = 200000;

function calculateFederalTax(annualTaxableIncome, filingStatus) {
  const brackets = FEDERAL_BRACKETS[filingStatus];
  let tax = 0;
  let previousLimit = 0;

  for (const bracket of brackets) {
    if (annualTaxableIncome <= previousLimit) break;

    const taxableInBracket = Math.min(
      annualTaxableIncome - previousLimit,
      bracket.limit - previousLimit
    );

    tax += taxableInBracket * bracket.rate;
    previousLimit = bracket.limit;
  }

  return tax;
}

function getFederalMarginalRate(annualTaxableIncome, filingStatus) {
  const brackets = FEDERAL_BRACKETS[filingStatus];

  for (const bracket of brackets) {
    if (annualTaxableIncome <= bracket.limit) {
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

const EMPTY_ERR = {
  salary: "",
  filingStatus: "",
  stateRate: "",
  payPeriods: "",
  preTaxPct: "",
  rothPct: "",
  healthInsurance: "",
  hsa: "",
  fsa: "",
  otherPreTax: "",
};

const T = {
  bg: "#F5F3EF",
  surface: "#FFFFFF",
  surfaceAlt: "#F9F7F4",
  border: "#E2DDD7",
  borderStrong: "#C8C0B5",
  text: "#1C1917",
  textSub: "#78716C",
  textMuted: "#A8A29E",
  amber: "#B45309",
  amberLight: "#FEF3C7",
  amberMid: "#F59E0B",
  amberDark: "#92400E",
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
  btn: "#166534",
  btnHover: "#14532D",
  btnLight: "#DCFCE7",
  btnBorder: "#BBF7D0",
  total: "#166534",
  info: "#1E40AF",
  infoLight: "#EFF6FF",
  infoBorder: "#BFDBFE",
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

// Tooltip component
function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [position, setPosition] = useState({ top: true, left: true });
  const buttonRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (show && !isMobile && buttonRef.current && tooltipRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // Find the scrollable parent container
      let scrollParent = buttonRef.current.parentElement;
      while (scrollParent && scrollParent !== document.body) {
        const overflow = window.getComputedStyle(scrollParent).overflowY;
        if (overflow === "auto" || overflow === "scroll") {
          break;
        }
        scrollParent = scrollParent.parentElement;
      }

      // Get container boundaries
      const containerRect = scrollParent
        ? scrollParent.getBoundingClientRect()
        : {
            left: 0,
            right: window.innerWidth,
            top: 0,
            bottom: window.innerHeight,
          };

      // Check if tooltip would go off container or screen
      const wouldOverflowRight =
        buttonRect.left + tooltipRect.width / 2 > containerRect.right - 10;
      const wouldOverflowLeft =
        buttonRect.left - tooltipRect.width / 2 < containerRect.left + 10;
      const wouldOverflowTop =
        buttonRect.top - tooltipRect.height - 8 < containerRect.top + 10;

      setPosition({
        top: !wouldOverflowTop,
        left: wouldOverflowLeft ? false : wouldOverflowRight ? true : "center",
      });
    }
  }, [show, isMobile]);

  const getTooltipStyle = () => {
    if (isMobile) {
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const baseStyle = {
      position: "absolute",
      zIndex: 999,
    };

    if (position.top) {
      baseStyle.bottom = "calc(100% + 8px)";
    } else {
      baseStyle.top = "calc(100% + 8px)";
    }

    if (position.left === "center") {
      baseStyle.left = "50%";
      baseStyle.transform = "translateX(-50%)";
    } else if (position.left === false) {
      baseStyle.left = "0";
    } else {
      baseStyle.right = "0";
    }

    return baseStyle;
  };

  const getArrowStyle = () => {
    const baseStyle = {
      position: "absolute",
      width: 8,
      height: 8,
      background: T.text,
    };

    if (position.top) {
      baseStyle.bottom = -4;
      baseStyle.clipPath = "polygon(50% 100%, 0% 0%, 100% 0%)";
    } else {
      baseStyle.top = -4;
      baseStyle.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
    }

    if (position.left === "center") {
      baseStyle.left = "50%";
      baseStyle.transform = "translateX(-50%)";
    } else if (position.left === false) {
      baseStyle.left = "12px";
    } else {
      baseStyle.right = "12px";
    }

    return baseStyle;
  };

  return (
    <div
      style={{ position: "relative", display: "inline-block", marginLeft: 4 }}
    >
      <button
        ref={buttonRef}
        type="button"
        onMouseEnter={() => !isMobile && setShow(true)}
        onMouseLeave={() => !isMobile && setShow(false)}
        onClick={() => isMobile && setShow(!show)}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke={T.textMuted} strokeWidth="1.2" />
          <path
            d="M7 6v3.5M7 4.5v.5"
            stroke={T.textMuted}
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {show && (
        <>
          {isMobile && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 998,
              }}
              onClick={() => setShow(false)}
            />
          )}
          <div
            ref={tooltipRef}
            style={{
              position: isMobile ? "fixed" : "absolute",
              zIndex: 999,
              background: T.text,
              color: T.surface,
              padding: "8px 10px",
              borderRadius: T.radius,
              fontSize: "0.72rem",
              fontFamily: T.font,
              lineHeight: 1.5,
              width: isMobile ? "calc(100vw - 48px)" : "220px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              ...getTooltipStyle(),
            }}
          >
            {text}
            {!isMobile && <div style={getArrowStyle()} />}
          </div>
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
        gap: 4,
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
  suffix,
  err,
  min,
  max,
  inputRef,
  integersOnly = false,
  onEnter,
}) {
  const handleChange = (e) => {
    const newValue = e.target.value;

    if (type === "number") {
      if (newValue === "") {
        onChange("");
        return;
      }

      if (integersOnly) {
        if (!/^\d*$/.test(newValue)) {
          return;
        }
      } else {
        if (!/^\d*\.?\d*$/.test(newValue)) {
          return;
        }
      }
    }

    onChange(newValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && onEnter) {
      onEnter();
    }
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
      {suffix && (
        <span
          style={{
            position: "absolute",
            right: 11,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.85rem",
            color: err ? T.red : T.textSub,
            fontFamily: T.font,
            pointerEvents: "none",
          }}
        >
          {suffix}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode={type === "number" ? "numeric" : "text"}
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={(e) =>
          (e.target.style.boxShadow = `0 0 0 3px ${
            err ? "#FCA5A544" : "#F59E0B33"
          }`)
        }
        onBlur={(e) => (e.target.style.boxShadow = "none")}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: prefix
            ? "9px 12px 9px 22px"
            : suffix
            ? "9px 30px 9px 12px"
            : "9px 12px",
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
            overflow: "hidden",
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
                padding: "9px 12px",
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
        {indent ? "↳ " : ""}
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

function StatCard({ label, value, sub, color }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "8px",
        border: "1px solid #E5E7EB",
        padding: "20px 24px",
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxShadow:
          "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
      }}
      className="mobile-padding-sm print-break-avoid"
    >
      <div style={{ width: "100%", textAlign: "center" }}>
        <div
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.01em",
            color: "#64748B",
            fontFamily: T.font,
            marginBottom: 12,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: "2.5rem",
            fontWeight: 600,
            color: color || "#1E293B",
            lineHeight: 1,
            fontFamily: T.font,
            letterSpacing: "-0.03em",
            fontVariantNumeric: "tabular-nums",
            marginBottom: 8,
          }}
          className="mobile-text-sm"
        >
          {value}
        </div>
        {sub && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "#64748B",
              fontFamily: T.font,
              lineHeight: 1.5,
            }}
          >
            {sub}
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
        fontSize: "0.78rem",
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
        minHeight: 180,
        padding: 16,
      }}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: T.radiusLg,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
          padding: "20px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          maxWidth: 280,
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
            <rect x="2" y="12" width="4" height="10" rx="1" fill={T.btn} opacity="0.5"
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar1 0.9s ease-in-out infinite" } : {}} />
            <rect x="9" y="7" width="4" height="15" rx="1" fill={T.btn} opacity="0.75"
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar2 0.9s ease-in-out infinite 0.15s" } : {}} />
            <rect x="16" y="3" width="4" height="19" rx="1" fill={T.btn}
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar3 0.9s ease-in-out infinite 0.3s" } : {}} />
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
          {isCalculating ? "Calculating…" : "See Your Take-Home Pay"}
        </div>
        {!isCalculating && (
          <div
            style={{
              fontSize: "0.78rem",
              color: T.textSub,
              fontFamily: T.font,
              textAlign: "center",
              lineHeight: 1.55,
            }}
          >
            Enter your salary, filing status, and deductions to see exactly what lands in your paycheck each pay period.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [salaryMode, setSalaryMode] = useState("annual"); // "annual" or "hourly"
  const [incomeType, setIncomeType] = useState("regular"); // "regular" or "bonus"
  const [salary, setSalary] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [overtimeHours, setOvertimeHours] = useState(""); // Weekly overtime hours for hourly workers
  const [age, setAge] = useState(""); // For 401k limit calculations
  const [filingStatus, setFilingStatus] = useState("single");
  const [stateRate, setStateRate] = useState("");
  const [payPeriods, setPayPeriods] = useState("26");

  // W-4 Withholding
  const [showW4Options, setShowW4Options] = useState(false);
  const [dependents, setDependents] = useState("");
  const [additionalWithholding, setAdditionalWithholding] = useState("");

  const [preTaxPct, setPreTaxPct] = useState("");
  const [rothPct, setRothPct] = useState("");

  // Additional deductions
  const [showAdditionalDeductions, setShowAdditionalDeductions] =
    useState(false);
  const [healthInsurance, setHealthInsurance] = useState("");
  const [medicalAccount, setMedicalAccount] = useState(""); // HSA/FSA - treated identically for tax purposes
  const [otherPreTax, setOtherPreTax] = useState("");
  const [afterTaxDeductions, setAfterTaxDeductions] = useState("");

  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState(EMPTY_ERR);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const resultRef = useRef(null);

  const salaryRef = useRef(null);
  const hourlyRateRef = useRef(null);
  const ageRef = useRef(null);
  const stateRateRef = useRef(null);
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

  // Calculate annual salary from hourly rate
  // Standard full-time: 40 hours/week + optional overtime
  function getAnnualSalaryFromHourly(
    hourlyRate,
    payPeriods,
    overtimeHours = 0
  ) {
    const rate = parse(hourlyRate);
    const otHours = parse(overtimeHours);

    // Regular hours: 40 hours/week = 2080 hours/year
    const regularPay = rate * 2080;

    // Overtime: 1.5x rate for overtime hours per week * 52 weeks
    const overtimePay = otHours > 0 ? rate * 1.5 * otHours * 52 : 0;

    return regularPay + overtimePay;
  }

  function calculate() {
    const errs = { ...EMPTY_ERR };
    let bad = false;

    // Determine annual salary based on input mode
    let annualSalary = 0;
    if (salaryMode === "annual") {
      annualSalary = parse(salary);
      if (!annualSalary || annualSalary <= 0) {
        errs.salary = "Enter your annual salary.";
        bad = true;
      } else if (annualSalary > 0 && annualSalary < 10000) {
        errs.salary = `This looks low for an annual salary — did you mean to use hourly rate?`;
        bad = true;
      }
    } else {
      // Hourly mode
      const hourly = parse(hourlyRate);
      if (!hourly || hourly <= 0) {
        errs.salary = "Enter your hourly rate.";
        bad = true;
      } else if (hourly > 500) {
        errs.salary = `This hourly rate seems unusually high — did you mean to use annual salary?`;
        bad = true;
      } else {
        annualSalary = getAnnualSalaryFromHourly(
          hourlyRate,
          payPeriods,
          overtimeHours
        );
      }
    }

    const pp = parseInt(payPeriods);
    const stateTaxRate = parse(stateRate) / 100;
    const preTaxRate = parse(preTaxPct) / 100;
    const rothRate = parse(rothPct) / 100;
    const healthIns = parse(healthInsurance);
    const medicalAcct = parse(medicalAccount);
    const otherAmt = parse(otherPreTax);
    const afterTaxAmt = parse(afterTaxDeductions);

    // W-4 withholding
    const numDependents = parse(dependents);
    const addlWithholding = parse(additionalWithholding);

    // Validation

    if (stateRate !== "" && (stateTaxRate < 0 || stateTaxRate > 0.2)) {
      errs.stateRate = "Enter a rate between 0% and 20%.";
      bad = true;
    }

    if (preTaxRate + rothRate > 1) {
      errs.preTaxPct = "Combined retirement contributions cannot exceed 100%.";
      errs.rothPct = "Combined retirement contributions cannot exceed 100%.";
      bad = true;
    }

    // Track 401k limit info (non-blocking) for informational notice
    const userAge = parseInt(age);
    let show401kNotice = false;
    let annual401kAmount = 0;
    let limit401k = 24500; // 2026 base limit
    let limit401kLabel = "$24,500";

    if (
      userAge &&
      !isNaN(userAge) &&
      annualSalary > 0 &&
      (preTaxRate > 0 || rothRate > 0)
    ) {
      annual401kAmount = annualSalary * (preTaxRate + rothRate);

      if (userAge >= 60 && userAge <= 63) {
        limit401k = 35750; // $24,500 base + $11,250 enhanced catch-up
        limit401kLabel = "$35,750 ($24,500 base + $11,250 enhanced catch-up)";
      } else if (userAge >= 50) {
        limit401k = 32500; // $24,500 base + $8,000 catch-up
        limit401kLabel = "$32,500 ($24,500 base + $8,000 catch-up)";
      }

      show401kNotice = annual401kAmount > limit401k;
    }

    setErrors(errs);
    setCalculated(true);
    setIsDirty(false);

    if (bad) {
      setResult(null);
      setTimeout(() => {
        if (errs.salary) {
          if (salaryMode === "annual") {
            salaryRef.current?.focus();
          } else {
            hourlyRateRef.current?.focus();
          }
          return;
        }
        if (errs.stateRate) {
          stateRateRef.current?.focus();
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

      // Calculate pre-tax deductions per paycheck
      const healthInsPerCheck = healthIns; // Already per-paycheck
      const medicalAcctPerCheck = medicalAcct / pp; // HSA/FSA is annual, convert to per-check
      const otherPerCheck = otherAmt; // Already per-paycheck
      const preTaxRetirementPerCheck = perPaycheck * preTaxRate;

      const totalPreTaxDeductions =
        healthInsPerCheck +
        medicalAcctPerCheck +
        otherPerCheck +
        preTaxRetirementPerCheck;

      // Taxable income per paycheck (after pre-tax deductions)
      const taxableIncomePerCheck = perPaycheck - totalPreTaxDeductions;
      const annualTaxableIncome = taxableIncomePerCheck * pp;

      // Calculate federal tax
      const standardDed = STANDARD_DEDUCTION[filingStatus];

      // Dependent credit reduces tax liability
      // 2026: $2000 per dependent child under 17
      const dependentCredit = numDependents * 2000;

      const federalTaxableIncome = Math.max(
        0,
        annualTaxableIncome - standardDed
      );

      let federalTaxPerCheck;

      // Bonus/supplemental income uses flat 22% federal withholding (IRS rule)
      if (incomeType === "bonus") {
        // Flat 22% on taxable income per paycheck
        federalTaxPerCheck = taxableIncomePerCheck * 0.22;
      } else {
        // Regular income uses progressive tax brackets
        const annualFederalTaxBeforeCredit = calculateFederalTax(
          federalTaxableIncome,
          filingStatus
        );
        const annualFederalTax = Math.max(
          0,
          annualFederalTaxBeforeCredit - dependentCredit
        );
        federalTaxPerCheck = annualFederalTax / pp;
      }

      // Add additional withholding if specified
      federalTaxPerCheck += addlWithholding;

      // Calculate state tax
      const stateTaxPerCheck = taxableIncomePerCheck * stateTaxRate;

      // Calculate FICA
      // Medicare is based on W-2 wages (gross - pre-tax deductions), not gross income
      const annualW2Wages = annualTaxableIncome; // This already excludes pre-tax deductions
      const w2WagesPerCheck = taxableIncomePerCheck;

      let socialSecurityPerCheck = 0;
      let medicarePerCheck = 0;

      // Social Security (capped at wage base, calculated on gross)
      const annualGross = annualSalary;
      if (annualGross <= FICA_SS_LIMIT) {
        socialSecurityPerCheck = perPaycheck * FICA_SS_RATE;
      } else {
        const annualSS = FICA_SS_LIMIT * FICA_SS_RATE;
        socialSecurityPerCheck = annualSS / pp;
      }

      // Medicare (no cap, but additional tax over threshold)
      // Calculated on W-2 wages (after pre-tax deductions like 401k, HSA, etc.)
      // Threshold varies by filing status: $250k for married, $200k for single/HOH
      const medicareAdditionalThreshold =
        filingStatus === "married" ? 250000 : 200000;
      medicarePerCheck = w2WagesPerCheck * FICA_MEDICARE_RATE;
      if (annualW2Wages > medicareAdditionalThreshold) {
        const additionalMedicareBase =
          annualW2Wages - medicareAdditionalThreshold;
        const additionalMedicareAnnual =
          additionalMedicareBase * FICA_MEDICARE_ADDITIONAL_RATE;
        medicarePerCheck += additionalMedicareAnnual / pp;
      }

      const ficaTotalPerCheck = socialSecurityPerCheck + medicarePerCheck;

      // Roth contributions (post-tax)
      const rothRetirementPerCheck = perPaycheck * rothRate;

      // After-tax deductions (already per-paycheck)
      const afterTaxPerCheck = afterTaxAmt;

      // Calculate net pay
      const totalDeductionsPerCheck =
        totalPreTaxDeductions +
        federalTaxPerCheck +
        stateTaxPerCheck +
        ficaTotalPerCheck +
        rothRetirementPerCheck +
        afterTaxPerCheck;

      const netPayPerCheck = perPaycheck - totalDeductionsPerCheck;

      // Calculate effective tax rate
      const totalTaxPerCheck =
        federalTaxPerCheck + stateTaxPerCheck + ficaTotalPerCheck;
      const effectiveTaxRate = (totalTaxPerCheck / perPaycheck) * 100;

      // Calculate true cost of pre-tax contributions
      const federalMarginalRate =
        incomeType === "bonus"
          ? 0.22
          : getFederalMarginalRate(federalTaxableIncome, filingStatus);
      const totalMarginalRate = federalMarginalRate + stateTaxRate;
      const preTaxTaxSavings = preTaxRetirementPerCheck * totalMarginalRate;
      const preTaxTrueCost = preTaxRetirementPerCheck - preTaxTaxSavings;

      setResult({
        perPaycheck,
        netPayPerCheck,
        federalTaxPerCheck,
        stateTaxPerCheck,
        socialSecurityPerCheck,
        medicarePerCheck,
        ficaTotalPerCheck,
        healthInsPerCheck,
        medicalAcctPerCheck,
        otherPerCheck,
        preTaxRetirementPerCheck,
        rothRetirementPerCheck,
        afterTaxPerCheck,
        totalPreTaxDeductions,
        totalDeductionsPerCheck,
        taxableIncomePerCheck,
        filingStatus,
        stateRate: stateTaxRate * 100,
        effectiveTaxRate,
        totalTaxPerCheck,
        payPeriods: pp,
        show401kNotice,
        annual401kAmount,
        limit401k,
        limit401kLabel,
        totalAnnualIncome: annualSalary,
        preTaxTaxSavings,
        preTaxTrueCost,
      });
    }, 650);
  }

  function clearAll() {
    setSalaryMode("annual");
    setSalary("");
    setHourlyRate("");
    setOvertimeHours("");
    setAge("");
    setFilingStatus("single");
    setStateRate("");
    setPayPeriods("26");
    setShowW4Options(false);
    setDependents("");
    setAdditionalWithholding("");
    setPreTaxPct("");
    setRothPct("");
    setShowAdditionalDeductions(false);
    setHealthInsurance("");
    setMedicalAccount("");
    setOtherPreTax("");
    setAfterTaxDeductions("");
    setResult(null);
    setErrors(EMPTY_ERR);
    setCalculated(false);
    setIsDirty(false);
    setIsCalculating(false);
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
        href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap"
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
          
          /* Mobile responsive styles */
          @media (max-width: 640px) {
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
          
          /* Print styles */
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
            /* Force single column layout for print */
            [style*="grid-template-columns"] {
              display: block !important;
            }
            /* Optimize spacing for print */
            h1 {
              font-size: 18pt !important;
              margin-bottom: 12pt !important;
            }
            /* Ensure cards print well */
            [style*="borderRadius"] {
              border: 1px solid #ddd !important;
              box-shadow: none !important;
            }
            /* Remove backgrounds for print */
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
          padding: "10px 20px 8px",
          borderBottom: `1px solid ${T.border}`,
          background: T.surfaceAlt,
          display: "flex",
          alignItems: "center",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: isMobile ? "1rem" : "1.1rem",
            fontWeight: 800,
            color: T.text,
            letterSpacing: "-0.03em",
          }}
        >
          {TAX_YEAR} Take-Home Pay Calculator
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
            : "minmax(0, 420px) minmax(0, 1fr)",
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
            overflow: "hidden",
            minHeight: isMobile ? "auto" : 0,
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: isMobile ? "visible" : "auto",
              padding: "12px 16px",
            }}
          >
            {/* Income Type Toggle - Regular vs Bonus */}
            <div style={{ marginBottom: 10 }}>
              <Label tooltip="Regular income uses standard withholding. Bonus/supplemental income (bonuses, commissions, etc.) uses flat 22% federal withholding.">
                Income Type
              </Label>
              <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                {[
                  { label: "Regular Pay", val: "regular" },
                  { label: "Bonus/Supplemental", val: "bonus" },
                ].map((opt) => {
                  const sel = incomeType === opt.val;
                  return (
                    <button
                      key={opt.val}
                      onClick={() => {
                        setIncomeType(opt.val);
                        markDirty();
                      }}
                      style={{
                        flex: 1,
                        padding: "8px 8px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: sel ? 600 : 400,
                        fontFamily: T.font,
                        border: `1.5px solid ${sel ? T.btn : T.border}`,
                        borderRadius: T.radius,
                        background: sel ? T.btnLight : T.surface,
                        color: sel ? T.btn : T.textSub,
                        transition: "all 0.15s",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Salary Input Mode Toggle */}
            <div style={{ marginBottom: 10 }}>
              <Label tooltip="Choose whether to enter your annual salary or hourly rate. We'll calculate based on standard full-time hours (40 hours/week).">
                Payment Basis
              </Label>
              <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                {[
                  { label: "Annual Salary", val: "annual" },
                  { label: "Hourly Rate", val: "hourly" },
                ].map((opt) => {
                  const sel = salaryMode === opt.val;
                  return (
                    <button
                      key={opt.val}
                      onClick={() => {
                        setSalaryMode(opt.val);
                        setErrors((e) => ({ ...e, salary: "" }));
                        markDirty();
                      }}
                      style={{
                        flex: 1,
                        padding: "8px 8px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: sel ? 600 : 400,
                        fontFamily: T.font,
                        border: `1.5px solid ${sel ? T.btn : T.border}`,
                        borderRadius: T.radius,
                        background: sel ? T.btnLight : T.surface,
                        color: sel ? T.btn : T.textSub,
                        transition: "all 0.15s",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Salary or Hourly Rate Input + Age */}
            {salaryMode === "annual" ? (
              <div style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    alignItems: "start",
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
                        setSalary(v);
                        markDirty();
                      }}
                      placeholder=""
                      prefix="$"
                      type="number"
                      err={errors.salary}
                      inputRef={salaryRef}
                    />
                    <FieldErr msg={errors.salary} />
                  </div>
                  <div>
                    <Label tooltip="Your age helps calculate 401(k) contribution limits. Age 50+ qualifies for catch-up contributions.">
                      Age (optional)
                    </Label>
                    <Input
                      value={age}
                      onChange={(v) => {
                        setAge(v);
                        markDirty();
                      }}
                      placeholder=""
                      type="number"
                      integersOnly={true}
                      inputRef={ageRef}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 10 }}>
                {/* Hourly Rate - full width */}
                <div style={{ marginBottom: 10 }}>
                  <Label tooltip="Your hourly pay rate. We'll calculate annual salary based on 40 hours/week (2,080 hours/year) plus any overtime.">
                    Hourly Rate
                  </Label>
                  <Input
                    value={hourlyRate}
                    onChange={(v) => {
                      setHourlyRate(v);
                      markDirty();
                    }}
                    placeholder=""
                    prefix="$"
                    type="number"
                    err={errors.salary}
                    inputRef={hourlyRateRef}
                  />
                  <FieldErr msg={errors.salary} />
                </div>

                {/* Overtime hours - full width */}
                <div style={{ marginBottom: 10 }}>
                  <Label tooltip="Average weekly overtime hours at 1.5x pay rate. Leave blank if none.">
                    Overtime Hours (optional)
                  </Label>
                  <Input
                    value={overtimeHours}
                    onChange={(v) => {
                      setOvertimeHours(v);
                      markDirty();
                    }}
                    placeholder="0"
                    type="number"
                  />
                </div>

                {/* Age - full width */}
                <div>
                  <Label tooltip="Your age helps calculate 401(k) contribution limits. Age 50+ qualifies for catch-up contributions.">
                    Age (optional)
                  </Label>
                  <Input
                    value={age}
                    onChange={(v) => {
                      setAge(v);
                      markDirty();
                    }}
                    placeholder=""
                    type="number"
                    integersOnly={true}
                    inputRef={ageRef}
                  />
                </div>

                {hourlyRate && parse(hourlyRate) > 0 && (
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: T.textSub,
                      marginTop: 4,
                      fontFamily: T.font,
                    }}
                  >
                    ≈{" "}
                    {fc(
                      getAnnualSalaryFromHourly(
                        hourlyRate,
                        payPeriods,
                        overtimeHours
                      ),
                      0
                    )}{" "}
                    annually
                    {parse(overtimeHours) > 0 && (
                      <span style={{ color: T.textMuted }}>
                        {" "}
                        (includes {parse(overtimeHours)} hrs/week OT)
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Filing Status + Pay Frequency */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 10,
                alignItems: "start",
              }}
              className="mobile-stack"
            >
              <div>
                <Label tooltip="Your tax filing status affects your federal tax calculation.">
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
              <div>
                <Label tooltip="How often you receive paychecks. Bi-weekly = every 2 weeks (26 or 27 paychecks/year - some years have an extra pay period). Semi-monthly = twice per month on set dates (always 24 paychecks/year, like 1st and 15th). Most hourly workers are bi-weekly; most salaried workers are semi-monthly.">
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
            </div>

            {/* W-4 Withholding Options - Collapsible */}
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <input
                  type="checkbox"
                  id="w4OptionsCheck"
                  checked={showW4Options}
                  onChange={(e) => {
                    setShowW4Options(e.target.checked);
                    if (!e.target.checked) {
                      setDependents("");
                      setAdditionalWithholding("");
                      markDirty();
                    }
                  }}
                  style={{
                    width: 16,
                    height: 16,
                    cursor: "pointer",
                    accentColor: T.btn,
                  }}
                />
                <label
                  htmlFor="w4OptionsCheck"
                  style={{
                    marginLeft: 8,
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: T.text,
                    cursor: "pointer",
                    userSelect: "none",
                    fontFamily: T.font,
                  }}
                >
                  I have dependents or extra withholding
                </label>
              </div>

              {showW4Options && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    alignItems: "start",
                  }}
                  className="mobile-stack"
                >
                  <div>
                    <Label tooltip="Number of dependents under age 17. Each reduces your federal tax by $2,000/year.">
                      Dependents
                    </Label>
                    <Input
                      value={dependents}
                      onChange={(v) => {
                        setDependents(v);
                        markDirty();
                      }}
                      placeholder="0"
                      type="number"
                      integersOnly={true}
                    />
                  </div>
                  <div>
                    <Label tooltip="Extra federal tax withheld each paycheck (beyond standard withholding).">
                      Extra Withholding
                    </Label>
                    <Input
                      value={additionalWithholding}
                      onChange={(v) => {
                        setAdditionalWithholding(v);
                        markDirty();
                      }}
                      placeholder="0"
                      prefix="$"
                      type="number"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* State Tax Rate */}
            <div style={{ marginBottom: 10 }}>
              <Label tooltip="Your state income tax rate. Leave blank if your state has no income tax.">
                State Tax Rate (optional)
              </Label>
              <Input
                value={stateRate}
                onChange={(v) => {
                  setStateRate(v);
                  markDirty();
                }}
                placeholder="0"
                suffix="%"
                type="number"
                err={errors.stateRate}
                inputRef={stateRateRef}
              />
              <FieldErr msg={errors.stateRate} />
              <div
                style={{
                  fontSize: "0.68rem",
                  color: T.textMuted,
                  marginTop: 2,
                  fontFamily: T.font,
                }}
              >
                No state income tax: AK, FL, NV, SD, TN, TX, WA, WY
              </div>
            </div>

            <Divider label="Retirement Contributions" />

            {/* Retirement Contributions */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 10,
                alignItems: "start",
              }}
              className="mobile-stack"
            >
              <div>
                <Label tooltip="Pre-tax contributions reduce your taxable income now.">
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
                />
                <FieldErr msg={errors.preTaxPct} />
              </div>
              <div>
                <Label tooltip="Roth contributions are after-tax but grow tax-free.">
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
                />
                <FieldErr msg={errors.rothPct} />
              </div>
            </div>

            {/* Additional Deductions Toggle */}
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <input
                  type="checkbox"
                  id="additionalDeductionsCheck"
                  checked={showAdditionalDeductions}
                  onChange={(e) => {
                    setShowAdditionalDeductions(e.target.checked);
                    markDirty();
                  }}
                  style={{
                    marginRight: 8,
                    width: 16,
                    height: 16,
                    cursor: "pointer",
                    accentColor: T.btn,
                  }}
                />
                <label
                  htmlFor="additionalDeductionsCheck"
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: T.text,
                    cursor: "pointer",
                    fontFamily: T.font,
                  }}
                >
                  I have additional deductions
                  <InfoTooltip text="Include health insurance, HSA/FSA, and other pre-tax or after-tax deductions." />
                </label>
              </div>

              {/* Collapsible Additional Deductions Section */}
              {showAdditionalDeductions && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "12px",
                    background: T.surfaceAlt,
                    borderRadius: T.radius,
                    border: `1px solid ${T.border}`,
                    animation: "slideDown 0.2s ease-out",
                  }}
                >
                  <style>
                    {`
                      @keyframes slideDown {
                        from {
                          opacity: 0;
                          transform: translateY(-10px);
                        }
                        to {
                          opacity: 1;
                          transform: translateY(0);
                        }
                      }
                    `}
                  </style>

                  <div
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: T.textMuted,
                      marginBottom: 10,
                    }}
                  >
                    Pre-Tax Deductions
                  </div>

                  {/* Health Insurance + Medical Account in 2x2 grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      marginBottom: 10,
                      alignItems: "start",
                    }}
                    className="mobile-stack"
                  >
                    <div>
                      <Label tooltip="Amount deducted from each paycheck for health insurance premiums.">
                        Health Insurance
                      </Label>
                      <Input
                        value={healthInsurance}
                        onChange={(v) => {
                          setHealthInsurance(v);
                          markDirty();
                        }}
                        placeholder="0"
                        prefix="$"
                        type="number"
                      />
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: T.textMuted,
                          marginTop: 2,
                          fontFamily: T.font,
                        }}
                      >
                        per paycheck
                      </div>
                    </div>

                    <div>
                      <Label tooltip="Annual HSA or FSA contributions. Both are pre-tax and reduce your taxable income equally.">
                        HSA/FSA (annual)
                      </Label>
                      <Input
                        value={medicalAccount}
                        onChange={(v) => {
                          setMedicalAccount(v);
                          markDirty();
                        }}
                        placeholder="0"
                        prefix="$"
                        type="number"
                      />
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: T.textMuted,
                          marginTop: 2,
                          fontFamily: T.font,
                        }}
                      >
                        annual total
                      </div>
                    </div>
                  </div>

                  {/* Other Pre-Tax + After-Tax in 2x2 grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      marginBottom: 0,
                      alignItems: "start",
                    }}
                    className="mobile-stack"
                  >
                    <div>
                      <Label tooltip="Any other pre-tax deductions per paycheck (e.g., commuter benefits, dependent care FSA).">
                        Other Pre-Tax
                      </Label>
                      <Input
                        value={otherPreTax}
                        onChange={(v) => {
                          setOtherPreTax(v);
                          markDirty();
                        }}
                        placeholder="0"
                        prefix="$"
                        type="number"
                      />
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: T.textMuted,
                          marginTop: 2,
                          fontFamily: T.font,
                        }}
                      >
                        per paycheck
                      </div>
                    </div>

                    <div>
                      <Label tooltip="Deductions taken after taxes from each paycheck (e.g., union dues, parking, wage garnishments).">
                        After-Tax
                      </Label>
                      <Input
                        value={afterTaxDeductions}
                        onChange={(v) => {
                          setAfterTaxDeductions(v);
                          markDirty();
                        }}
                        placeholder="0"
                        prefix="$"
                        type="number"
                      />
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: T.textMuted,
                          marginTop: 2,
                          fontFamily: T.font,
                        }}
                      >
                        per paycheck
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
              gap: 8,
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
        <div
          ref={resultRef}
          style={{
            background: T.surface,
            borderRadius: T.radiusLg,
            border: `1px solid ${T.border}`,
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              padding: "10px 16px",
              borderBottom: `1px solid ${T.border}`,
              background: T.surfaceAlt,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.textSub,
              }}
            >
              Results
            </span>
            {result && !isDirty && (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => {
                    const summary = `TAKE-HOME PAY CALCULATOR RESULTS

Net Pay: ${fc(result.netPayPerCheck, 2)} per paycheck
Gross Pay: ${fc(result.perPaycheck, 2)} per paycheck
Retirement Contributions: ${fc(
                      result.preTaxRetirementPerCheck +
                        result.rothRetirementPerCheck,
                      2
                    )} per paycheck (${(
                      parseFloat(preTaxPct || 0) + parseFloat(rothPct || 0)
                    ).toFixed(1)}%)
${
  result.preTaxRetirementPerCheck > 0
    ? `  - Pre-Tax: ${fc(result.preTaxRetirementPerCheck, 2)}`
    : ""
}
${
  result.rothRetirementPerCheck > 0
    ? `  - Roth: ${fc(result.rothRetirementPerCheck, 2)}`
    : ""
}

Effective Tax Rate: ${result.effectiveTaxRate}%

ANNUAL TOTALS:
Gross Income: ${fc(result.totalAnnualIncome, 2)}
Net Pay: ${fc(result.netPayPerCheck * parseFloat(payPeriods), 2)}
Federal Tax: ${fc(result.fedTaxPerCheck * parseFloat(payPeriods), 2)}
${
  parseFloat(stateRate || 0) > 0
    ? `State Tax: ${fc(result.stateTaxPerCheck * parseFloat(payPeriods), 2)}`
    : ""
}
FICA: ${fc(
                      (result.socialSecurityPerCheck +
                        result.medicarePerCheck) *
                        parseFloat(payPeriods),
                      2
                    )}
Retirement: ${fc(
                      (result.preTaxRetirementPerCheck +
                        result.rothRetirementPerCheck) *
                        parseFloat(payPeriods),
                      2
                    )}

Generated by Take-Home Pay Calculator`;

                    navigator.clipboard.writeText(summary).then(() => {
                      // Visual feedback
                      const btn = event.currentTarget;
                      const originalText = btn.innerHTML;
                      btn.innerHTML = "✓ Copied!";
                      btn.style.background = "#10B981";
                      btn.style.color = "#fff";
                      btn.style.borderColor = "#10B981";
                      setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.style.background = T.surface;
                        btn.style.color = T.textSub;
                        btn.style.borderColor = T.border;
                      }, 1500);
                    });
                  }}
                  className="no-print"
                  style={{
                    padding: "6px 10px",
                    background: T.surface,
                    color: T.textSub,
                    border: `1px solid ${T.border}`,
                    borderRadius: T.radius,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = T.surfaceAlt;
                    e.currentTarget.style.borderColor = T.textMuted;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = T.surface;
                    e.currentTarget.style.borderColor = T.border;
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="9"
                      y="9"
                      width="13"
                      height="13"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                    <path
                      d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                  Copy
                </button>
                <button
                  onClick={() => window.print()}
                  className="no-print"
                  style={{
                    padding: "6px 10px",
                    background: T.surface,
                    color: T.textSub,
                    border: `1px solid ${T.border}`,
                    borderRadius: T.radius,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = T.surfaceAlt;
                    e.currentTarget.style.borderColor = T.textMuted;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = T.surface;
                    e.currentTarget.style.borderColor = T.border;
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 9V2h12v7M6 18H4c-1.1 0-2-.9-2-2v-5c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v5c0 1.1-.9 2-2 2h-2M6 14h12v8H6v-8z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  Print
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              overflowY: (isMobile || !result) ? "hidden" : "auto",
              padding: "12px 16px",
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
                  borderRadius: T.radius,
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
                      <circle
                        cx="12"
                        cy="12"
                        r="9.5"
                        stroke={T.btn}
                        strokeWidth="1.5"
                      />
                      <path
                        d="M20 11A8 8 0 1 0 4.93 17" stroke={T.btn} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20 7v4h-4" stroke={T.btn} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
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
                    Your information has changed
                  </div>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: T.textSub,
                      fontFamily: T.font,
                      textAlign: "center",
                      lineHeight: 1.55,
                    }}
                  >
                    Click <strong>Recalculate</strong> to update your results
                    based on the new values you've entered.
                  </div>
                </div>
              </div>
            )}

            {!result || isCalculating ? (
              <EmptyResults isCalculating={isCalculating} />
            ) : (
              <div>
                {/* Net Pay Cards - Per Paycheck and Annual */}
                {/* Net Pay Per Paycheck + Retirement Contributions Side-by-Side */}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 10,
                    flexWrap: isMobile ? "wrap" : "nowrap",
                    alignItems: "stretch",
                  }}
                >
                  <StatCard
                    label="Net Pay Per Paycheck"
                    value={fc(result.netPayPerCheck, 2)}
                    sub={`from ${fc(result.perPaycheck, 2)} gross`}
                  />

                  {/* Retirement Contributions Card - Only show if contributions > 0 */}
                  {(result.preTaxRetirementPerCheck > 0 ||
                    result.rothRetirementPerCheck > 0) && (
                    <div
                      style={{
                        background: "#FFFFFF",
                        borderRadius: "8px",
                        border: "1px solid #E5E7EB",
                        padding: "20px 24px",
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        boxShadow:
                          "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
                      }}
                      className="mobile-padding-sm print-break-avoid"
                    >
                      <div style={{ width: "100%", textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            letterSpacing: "0.01em",
                            color: "#64748B",
                            fontFamily: T.font,
                            marginBottom: 12,
                          }}
                        >
                          {result.preTaxRetirementPerCheck > 0 && result.rothRetirementPerCheck > 0
                            ? "Retirement Contributions"
                            : result.preTaxRetirementPerCheck > 0
                            ? "Pre-Tax Contribution (Traditional)"
                            : "Roth Contribution (After-Tax)"}
                        </div>
                        <div
                          style={{
                            fontSize: "2.5rem",
                            fontWeight: 600,
                            color: "#1E293B",
                            lineHeight: 1,
                            fontFamily: T.font,
                            letterSpacing: "-0.03em",
                            fontVariantNumeric: "tabular-nums",
                            marginBottom: 8,
                          }}
                          className="mobile-text-sm"
                        >
                          {fc(
                            result.preTaxRetirementPerCheck +
                              result.rothRetirementPerCheck,
                            2
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#64748B",
                            fontFamily: T.font,
                            lineHeight: 1.5,
                            marginBottom: 8,
                          }}
                        >
                          per paycheck (
                          {(parseFloat(preTaxPct || 0) +
                            parseFloat(rothPct || 0)) %
                            1 ===
                          0
                            ? Math.round(
                                parseFloat(preTaxPct || 0) +
                                  parseFloat(rothPct || 0)
                              )
                            : (
                                parseFloat(preTaxPct || 0) +
                                parseFloat(rothPct || 0)
                              ).toFixed(1)}
                          % total)
                        </div>
                        {result.preTaxRetirementPerCheck > 0 &&
                        result.rothRetirementPerCheck > 0 ? (
                          <>
                            <div
                              style={{
                                fontSize: "0.8rem",
                                color: "#64748B",
                                fontFamily: T.font,
                                display: "flex",
                                justifyContent: "center",
                                gap: 16,
                                flexWrap: "wrap",
                                marginBottom: 4,
                              }}
                            >
                              <span>
                                {fc(result.preTaxRetirementPerCheck, 2)} Pre-Tax
                              </span>
                              <span style={{ color: "#CBD5E1" }}>•</span>
                              <span>
                                {fc(result.rothRetirementPerCheck, 2)} Roth
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: "0.8rem",
                                color: "#64748B",
                                fontFamily: T.font,
                              }}
                            >
                              {fc(
                                (result.preTaxRetirementPerCheck +
                                  result.rothRetirementPerCheck) *
                                  result.payPeriods,
                                0
                              )}{" "}
                              annually
                            </div>
                          </>
                        ) : (
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "#64748B",
                              fontFamily: T.font,
                            }}
                          >
                            {fc(
                              (result.preTaxRetirementPerCheck +
                                result.rothRetirementPerCheck) *
                                result.payPeriods,
                              0
                            )}{" "}
                            annually
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 401k Annual Limit Notice (informational, non-blocking) */}
                {result.show401kNotice && (
                  <div style={{ marginBottom: 10 }}>
                    <NoteBox color="#1E40AF" bg="#F0F9FF" border="#BFDBFE">
                      <strong>ℹ️ Annual Contribution Notice:</strong> Your
                      current contribution rate projects to{" "}
                      {fc(result.annual401kAmount, 0)} annually, which exceeds
                      the 2026 IRS limit of {result.limit401kLabel} for your
                      age. This is OK if you're front-loading contributions,
                      catching up mid-year, or letting your employer auto-stop
                      at the limit. Most plans automatically stop contributions
                      when you hit the limit.
                    </NoteBox>
                  </div>
                )}

                {/* FICA Social Security Wage Limit Indicator */}
                {result.totalAnnualIncome > FICA_SS_LIMIT && (
                  <div style={{ marginBottom: 10 }}>
                    <NoteBox color="#059669" bg="#F0FDF4" border="#BBF7D0">
                      <strong>✓ Social Security Cap Reached:</strong> Your
                      annual income ({fc(result.totalAnnualIncome, 0)}) exceeds
                      the 2026 Social Security wage base of{" "}
                      {fc(FICA_SS_LIMIT, 0)}. Social Security tax stops after
                      you earn {fc(FICA_SS_LIMIT, 0)}, so you'll save{" "}
                      {fc(
                        (result.totalAnnualIncome - FICA_SS_LIMIT) *
                          FICA_SS_RATE,
                        0
                      )}{" "}
                      in FICA annually. Medicare tax continues on all earnings.
                    </NoteBox>
                  </div>
                )}

                {/* Collapsible Tax & Deduction Breakdown */}
                <details
                  style={{
                    marginBottom: 12,
                    background: "#F9FAFB",
                    border: `1px solid ${T.border}`,
                    borderRadius: T.radius,
                  }}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      color: T.text,
                      padding: "10px 12px",
                      userSelect: "none",
                      listStyle: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.15s",
                    }}
                  >
                    <span>View Tax &amp; Deduction Details</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      style={{
                        flexShrink: 0,
                        transition: "transform 0.2s",
                      }}
                      className="details-arrow"
                    >
                      <path
                        d="M3 4.5l3 3 3-3"
                        stroke={T.textSub}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </summary>

                  <div
                    style={{
                      paddingTop: 8,
                      padding: "8px 12px 12px",
                    }}
                  >
                    {/* Effective Tax Rate — inline SummaryLine style */}
                    <SummaryLine
                      label={
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          Effective tax rate
                          <InfoTooltip text="Your effective tax rate is the percentage of your gross pay that goes to taxes (federal, state, and FICA). This is different from your tax bracket — it's the actual average rate you pay across all your income." />
                        </span>
                      }
                      value={`${result.effectiveTaxRate.toFixed(1)}%`}
                      bold
                    />

                    <Divider label="Per Paycheck Breakdown" />

                    {/* Pre-Tax Deductions (excluding retirement - now shown above) */}
                    {result.totalPreTaxDeductions -
                      result.preTaxRetirementPerCheck >
                      0 && (
                      <>
                        <SummaryLine
                          label="Other Pre-Tax Deductions"
                          value={fc(
                            result.totalPreTaxDeductions -
                              result.preTaxRetirementPerCheck,
                            2
                          )}
                          bold
                        />
                        {result.healthInsPerCheck > 0 && (
                          <SummaryLine
                            label="Health Insurance"
                            value={fc(result.healthInsPerCheck, 2)}
                            indent
                          />
                        )}
                        {result.medicalAcctPerCheck > 0 && (
                          <SummaryLine
                            label="HSA/FSA"
                            value={fc(result.medicalAcctPerCheck, 2)}
                            indent
                          />
                        )}
                        {result.otherPerCheck > 0 && (
                          <SummaryLine
                            label="Other Pre-Tax"
                            value={fc(result.otherPerCheck, 2)}
                            indent
                          />
                        )}
                      </>
                    )}

                    {/* Taxes */}
                    <SummaryLine
                      label="Federal Income Tax"
                      value={fc(result.federalTaxPerCheck, 2)}
                      bold={false}
                    />
                    {result.stateRate > 0 && (
                      <SummaryLine
                        label={`State Income Tax (${result.stateRate}%)`}
                        value={fc(result.stateTaxPerCheck, 2)}
                        bold={false}
                      />
                    )}
                    <SummaryLine
                      label="FICA Taxes"
                      value={fc(result.ficaTotalPerCheck, 2)}
                      bold={false}
                    />
                    <SummaryLine
                      label="Social Security (6.2%)"
                      value={fc(result.socialSecurityPerCheck, 2)}
                      indent
                      dimmed
                    />
                    <SummaryLine
                      label="Medicare (1.45%+)"
                      value={fc(result.medicarePerCheck, 2)}
                      indent
                      dimmed
                    />

                    {/* After-Tax Deductions (excluding Roth retirement - now shown above) */}
                    {result.afterTaxPerCheck > 0 && (
                      <SummaryLine
                        label="After-Tax Deductions"
                        value={fc(result.afterTaxPerCheck, 2)}
                        bold={false}
                      />
                    )}

                    <Divider />

                    {/* Totals */}
                    <SummaryLine
                      label="Total Deductions"
                      value={fc(result.totalDeductionsPerCheck, 2)}
                      bold
                      color={T.red}
                    />
                    <SummaryLine
                      label="Net Pay (Take-Home)"
                      value={fc(result.netPayPerCheck, 2)}
                      bold
                      color={T.green}
                    />

                    {/* True Cost of Retirement Contribution */}
                    {result.preTaxRetirementPerCheck > 0 && (
                      <>
                        <Divider />
                        <div
                          style={{
                            background: "#F0FDF4",
                            border: "1px solid #BBF7D0",
                            borderRadius: T.radius,
                            padding: "12px 14px",
                            marginTop: 8,
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                              color: "#059669",
                              fontFamily: T.font,
                              marginBottom: 8,
                            }}
                          >
                            💰 True Cost of Retirement Savings
                          </div>
                          <SummaryLine
                            label="Your pre-tax contribution"
                            value={fc(result.preTaxRetirementPerCheck, 2)}
                            bold={false}
                          />
                          <SummaryLine
                            label="True cost to your paycheck"
                            value={fc(result.preTaxTrueCost, 2)}
                            bold
                            color={T.green}
                          />
                          <SummaryLine
                            label="Tax Savings"
                            value={fc(result.preTaxTaxSavings, 2)}
                            bold={false}
                          />
                          <div
                            style={{
                              fontSize: "0.78rem",
                              color: "#059669",
                              fontFamily: T.font,
                              marginTop: 10,
                              lineHeight: 1.5,
                              fontWeight: 500,
                            }}
                          >
                            💡 Your {fc(result.preTaxRetirementPerCheck, 2)}{" "}
                            contribution only costs you{" "}
                            {fc(result.preTaxTrueCost, 2)} from your paycheck
                          </div>
                        </div>
                      </>
                    )}

                    <Divider label="Annual Totals" />

                    <SummaryLine
                      label="Annual Gross Pay"
                      value={fc(result.perPaycheck * result.payPeriods, 0)}
                      bold={false}
                    />
                    <SummaryLine
                      label="Annual Total Deductions"
                      value={fc(
                        result.totalDeductionsPerCheck * result.payPeriods,
                        0
                      )}
                      bold={false}
                    />
                    <SummaryLine
                      label="Annual Net Pay"
                      value={fc(result.netPayPerCheck * result.payPeriods, 0)}
                      bold
                      color={T.green}
                    />
                  </div>
                </details>

                {/* Info Box */}
                <div style={{ marginTop: 12 }}>
                  <NoteBox color="#1E40AF" bg="#F0F9FF" border="#BFDBFE">
                    <strong>Note:</strong> This estimate uses {TAX_YEAR} federal
                    tax brackets and your W-4 inputs. Actual withholding may
                    vary based on additional income, deductions, credits, and
                    other factors not captured here. Consult a tax professional
                    for personalized advice.
                  </NoteBox>
                </div>
              </div>
            )}
          </div>

          {/* Footer disclaimer */}
          <div
            style={{
              flexShrink: 0,
              padding: "8px 16px",
              borderTop: `1px solid ${T.border}`,
              background: T.surfaceAlt,
            }}
          >
            <div
              style={{
                fontSize: "0.64rem",
                color: T.textMuted,
                lineHeight: 1.55,
              }}
            >
              Based on {TAX_YEAR} IRS tax brackets and FICA rates. For
              educational use only — not financial or tax advice.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
        gap: 4,
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
  suffix,
  err,
  min,
  max,
  inputRef,
  integersOnly = false,
  onEnter,
}) {
  const handleChange = (e) => {
    const newValue = e.target.value;

    if (type === "number") {
      if (newValue === "") {
        onChange("");
        return;
      }

      if (integersOnly) {
        if (!/^\d*$/.test(newValue)) {
          return;
        }
      } else {
        if (!/^\d*\.?\d*$/.test(newValue)) {
          return;
        }
      }
    }

    onChange(newValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && onEnter) {
      onEnter();
    }
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
      {suffix && (
        <span
          style={{
            position: "absolute",
            right: 11,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.85rem",
            color: err ? T.red : T.textSub,
            fontFamily: T.font,
            pointerEvents: "none",
          }}
        >
          {suffix}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode={type === "number" ? "numeric" : "text"}
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={(e) =>
          (e.target.style.boxShadow = `0 0 0 3px ${
            err ? "#FCA5A544" : "#F59E0B33"
          }`)
        }
        onBlur={(e) => (e.target.style.boxShadow = "none")}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: prefix
            ? "9px 12px 9px 22px"
            : suffix
            ? "9px 30px 9px 12px"
            : "9px 12px",
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
            overflow: "hidden",
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
                padding: "9px 12px",
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
        {indent ? "↳ " : ""}
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

function StatCard({ label, value, sub, color }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "8px",
        border: "1px solid #E5E7EB",
        padding: "20px 24px",
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxShadow:
          "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
      }}
      className="mobile-padding-sm print-break-avoid"
    >
      <div style={{ width: "100%", textAlign: "center" }}>
        <div
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.01em",
            color: "#64748B",
            fontFamily: T.font,
            marginBottom: 12,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: "2.5rem",
            fontWeight: 600,
            color: color || "#1E293B",
            lineHeight: 1,
            fontFamily: T.font,
            letterSpacing: "-0.03em",
            fontVariantNumeric: "tabular-nums",
            marginBottom: 8,
          }}
          className="mobile-text-sm"
        >
          {value}
        </div>
        {sub && (
          <div
            style={{
              fontSize: "0.8rem",
              color: "#64748B",
              fontFamily: T.font,
              lineHeight: 1.5,
            }}
          >
            {sub}
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
        fontSize: "0.78rem",
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
        minHeight: 180,
        padding: 16,
      }}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: T.radiusLg,
          border: `1px solid ${T.border}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
          padding: "20px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          maxWidth: 280,
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
            <rect x="2" y="12" width="4" height="10" rx="1" fill={T.btn} opacity="0.5"
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar1 0.9s ease-in-out infinite" } : {}} />
            <rect x="9" y="7" width="4" height="15" rx="1" fill={T.btn} opacity="0.75"
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar2 0.9s ease-in-out infinite 0.15s" } : {}} />
            <rect x="16" y="3" width="4" height="19" rx="1" fill={T.btn}
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar3 0.9s ease-in-out infinite 0.3s" } : {}} />
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
          {isCalculating ? "Calculating…" : "See Your Take-Home Pay"}
        </div>
        {!isCalculating && (
          <div
            style={{
              fontSize: "0.78rem",
              color: T.textSub,
              fontFamily: T.font,
              textAlign: "center",
              lineHeight: 1.55,
            }}
          >
            Enter your salary, filing status, and deductions to see exactly what lands in your paycheck each pay period.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [salaryMode, setSalaryMode] = useState("annual"); // "annual" or "hourly"
  const [incomeType, setIncomeType] = useState("regular"); // "regular" or "bonus"
  const [salary, setSalary] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [overtimeHours, setOvertimeHours] = useState(""); // Weekly overtime hours for hourly workers
  const [age, setAge] = useState(""); // For 401k limit calculations
  const [filingStatus, setFilingStatus] = useState("single");
  const [stateRate, setStateRate] = useState("");
  const [payPeriods, setPayPeriods] = useState("26");

  // W-4 Withholding
  const [showW4Options, setShowW4Options] = useState(false);
  const [dependents, setDependents] = useState("");
  const [additionalWithholding, setAdditionalWithholding] = useState("");

  const [preTaxPct, setPreTaxPct] = useState("");
  const [rothPct, setRothPct] = useState("");

  // Additional deductions
  const [showAdditionalDeductions, setShowAdditionalDeductions] =
    useState(false);
  const [healthInsurance, setHealthInsurance] = useState("");
  const [medicalAccount, setMedicalAccount] = useState(""); // HSA/FSA - treated identically for tax purposes
  const [otherPreTax, setOtherPreTax] = useState("");
  const [afterTaxDeductions, setAfterTaxDeductions] = useState("");

  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState(EMPTY_ERR);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const resultRef = useRef(null);

  const salaryRef = useRef(null);
  const hourlyRateRef = useRef(null);
  const ageRef = useRef(null);
  const stateRateRef = useRef(null);
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

  // Calculate annual salary from hourly rate
  // Standard full-time: 40 hours/week + optional overtime
  function getAnnualSalaryFromHourly(
    hourlyRate,
    payPeriods,
    overtimeHours = 0
  ) {
    const rate = parse(hourlyRate);
    const otHours = parse(overtimeHours);

    // Regular hours: 40 hours/week = 2080 hours/year
    const regularPay = rate * 2080;

    // Overtime: 1.5x rate for overtime hours per week * 52 weeks
    const overtimePay = otHours > 0 ? rate * 1.5 * otHours * 52 : 0;

    return regularPay + overtimePay;
  }

  function calculate() {
    const errs = { ...EMPTY_ERR };
    let bad = false;

    // Determine annual salary based on input mode
    let annualSalary = 0;
    if (salaryMode === "annual") {
      annualSalary = parse(salary);
      if (!annualSalary || annualSalary <= 0) {
        errs.salary = "Enter your annual salary.";
        bad = true;
      } else if (annualSalary > 0 && annualSalary < 10000) {
        errs.salary = `This looks low for an annual salary — did you mean to use hourly rate?`;
        bad = true;
      }
    } else {
      // Hourly mode
      const hourly = parse(hourlyRate);
      if (!hourly || hourly <= 0) {
        errs.salary = "Enter your hourly rate.";
        bad = true;
      } else if (hourly > 500) {
        errs.salary = `This hourly rate seems unusually high — did you mean to use annual salary?`;
        bad = true;
      } else {
        annualSalary = getAnnualSalaryFromHourly(
          hourlyRate,
          payPeriods,
          overtimeHours
        );
      }
    }

    const pp = parseInt(payPeriods);
    const stateTaxRate = parse(stateRate) / 100;
    const preTaxRate = parse(preTaxPct) / 100;
    const rothRate = parse(rothPct) / 100;
    const healthIns = parse(healthInsurance);
    const medicalAcct = parse(medicalAccount);
    const otherAmt = parse(otherPreTax);
    const afterTaxAmt = parse(afterTaxDeductions);

    // W-4 withholding
    const numDependents = parse(dependents);
    const addlWithholding = parse(additionalWithholding);

    // Validation

    if (stateRate !== "" && (stateTaxRate < 0 || stateTaxRate > 0.2)) {
      errs.stateRate = "Enter a rate between 0% and 20%.";
      bad = true;
    }

    if (preTaxRate + rothRate > 1) {
      errs.preTaxPct = "Combined retirement contributions cannot exceed 100%.";
      errs.rothPct = "Combined retirement contributions cannot exceed 100%.";
      bad = true;
    }

    // Track 401k limit info (non-blocking) for informational notice
    const userAge = parseInt(age);
    let show401kNotice = false;
    let annual401kAmount = 0;
    let limit401k = 24500; // 2026 base limit
    let limit401kLabel = "$24,500";

    if (
      userAge &&
      !isNaN(userAge) &&
      annualSalary > 0 &&
      (preTaxRate > 0 || rothRate > 0)
    ) {
      annual401kAmount = annualSalary * (preTaxRate + rothRate);

      if (userAge >= 60 && userAge <= 63) {
        limit401k = 35750; // $24,500 base + $11,250 enhanced catch-up
        limit401kLabel = "$35,750 ($24,500 base + $11,250 enhanced catch-up)";
      } else if (userAge >= 50) {
        limit401k = 32500; // $24,500 base + $8,000 catch-up
        limit401kLabel = "$32,500 ($24,500 base + $8,000 catch-up)";
      }

      show401kNotice = annual401kAmount > limit401k;
    }

    setErrors(errs);
    setCalculated(true);
    setIsDirty(false);

    if (bad) {
      setResult(null);
      setTimeout(() => {
        if (errs.salary) {
          if (salaryMode === "annual") {
            salaryRef.current?.focus();
          } else {
            hourlyRateRef.current?.focus();
          }
          return;
        }
        if (errs.stateRate) {
          stateRateRef.current?.focus();
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

      // Calculate pre-tax deductions per paycheck
      const healthInsPerCheck = healthIns; // Already per-paycheck
      const medicalAcctPerCheck = medicalAcct / pp; // HSA/FSA is annual, convert to per-check
      const otherPerCheck = otherAmt; // Already per-paycheck
      const preTaxRetirementPerCheck = perPaycheck * preTaxRate;

      const totalPreTaxDeductions =
        healthInsPerCheck +
        medicalAcctPerCheck +
        otherPerCheck +
        preTaxRetirementPerCheck;

      // Taxable income per paycheck (after pre-tax deductions)
      const taxableIncomePerCheck = perPaycheck - totalPreTaxDeductions;
      const annualTaxableIncome = taxableIncomePerCheck * pp;

      // Calculate federal tax
      const standardDed = STANDARD_DEDUCTION[filingStatus];

      // Dependent credit reduces tax liability
      // 2026: $2000 per dependent child under 17
      const dependentCredit = numDependents * 2000;

      const federalTaxableIncome = Math.max(
        0,
        annualTaxableIncome - standardDed
      );

      let federalTaxPerCheck;

      // Bonus/supplemental income uses flat 22% federal withholding (IRS rule)
      if (incomeType === "bonus") {
        // Flat 22% on taxable income per paycheck
        federalTaxPerCheck = taxableIncomePerCheck * 0.22;
      } else {
        // Regular income uses progressive tax brackets
        const annualFederalTaxBeforeCredit = calculateFederalTax(
          federalTaxableIncome,
          filingStatus
        );
        const annualFederalTax = Math.max(
          0,
          annualFederalTaxBeforeCredit - dependentCredit
        );
        federalTaxPerCheck = annualFederalTax / pp;
      }

      // Add additional withholding if specified
      federalTaxPerCheck += addlWithholding;

      // Calculate state tax
      const stateTaxPerCheck = taxableIncomePerCheck * stateTaxRate;

      // Calculate FICA
      // Medicare is based on W-2 wages (gross - pre-tax deductions), not gross income
      const annualW2Wages = annualTaxableIncome; // This already excludes pre-tax deductions
      const w2WagesPerCheck = taxableIncomePerCheck;

      let socialSecurityPerCheck = 0;
      let medicarePerCheck = 0;

      // Social Security (capped at wage base, calculated on gross)
      const annualGross = annualSalary;
      if (annualGross <= FICA_SS_LIMIT) {
        socialSecurityPerCheck = perPaycheck * FICA_SS_RATE;
      } else {
        const annualSS = FICA_SS_LIMIT * FICA_SS_RATE;
        socialSecurityPerCheck = annualSS / pp;
      }

      // Medicare (no cap, but additional tax over threshold)
      // Calculated on W-2 wages (after pre-tax deductions like 401k, HSA, etc.)
      // Threshold varies by filing status: $250k for married, $200k for single/HOH
      const medicareAdditionalThreshold =
        filingStatus === "married" ? 250000 : 200000;
      medicarePerCheck = w2WagesPerCheck * FICA_MEDICARE_RATE;
      if (annualW2Wages > medicareAdditionalThreshold) {
        const additionalMedicareBase =
          annualW2Wages - medicareAdditionalThreshold;
        const additionalMedicareAnnual =
          additionalMedicareBase * FICA_MEDICARE_ADDITIONAL_RATE;
        medicarePerCheck += additionalMedicareAnnual / pp;
      }

      const ficaTotalPerCheck = socialSecurityPerCheck + medicarePerCheck;

      // Roth contributions (post-tax)
      const rothRetirementPerCheck = perPaycheck * rothRate;

      // After-tax deductions (already per-paycheck)
      const afterTaxPerCheck = afterTaxAmt;

      // Calculate net pay
      const totalDeductionsPerCheck =
        totalPreTaxDeductions +
        federalTaxPerCheck +
        stateTaxPerCheck +
        ficaTotalPerCheck +
        rothRetirementPerCheck +
        afterTaxPerCheck;

      const netPayPerCheck = perPaycheck - totalDeductionsPerCheck;

      // Calculate effective tax rate
      const totalTaxPerCheck =
        federalTaxPerCheck + stateTaxPerCheck + ficaTotalPerCheck;
      const effectiveTaxRate = (totalTaxPerCheck / perPaycheck) * 100;

      // Calculate true cost of pre-tax contributions
      const federalMarginalRate =
        incomeType === "bonus"
          ? 0.22
          : getFederalMarginalRate(federalTaxableIncome, filingStatus);
      const totalMarginalRate = federalMarginalRate + stateTaxRate;
      const preTaxTaxSavings = preTaxRetirementPerCheck * totalMarginalRate;
      const preTaxTrueCost = preTaxRetirementPerCheck - preTaxTaxSavings;

      setResult({
        perPaycheck,
        netPayPerCheck,
        federalTaxPerCheck,
        stateTaxPerCheck,
        socialSecurityPerCheck,
        medicarePerCheck,
        ficaTotalPerCheck,
        healthInsPerCheck,
        medicalAcctPerCheck,
        otherPerCheck,
        preTaxRetirementPerCheck,
        rothRetirementPerCheck,
        afterTaxPerCheck,
        totalPreTaxDeductions,
        totalDeductionsPerCheck,
        taxableIncomePerCheck,
        filingStatus,
        stateRate: stateTaxRate * 100,
        effectiveTaxRate,
        totalTaxPerCheck,
        payPeriods: pp,
        show401kNotice,
        annual401kAmount,
        limit401k,
        limit401kLabel,
        totalAnnualIncome: annualSalary,
        preTaxTaxSavings,
        preTaxTrueCost,
      });
    }, 650);
  }

  function clearAll() {
    setSalaryMode("annual");
    setSalary("");
    setHourlyRate("");
    setOvertimeHours("");
    setAge("");
    setFilingStatus("single");
    setStateRate("");
    setPayPeriods("26");
    setShowW4Options(false);
    setDependents("");
    setAdditionalWithholding("");
    setPreTaxPct("");
    setRothPct("");
    setShowAdditionalDeductions(false);
    setHealthInsurance("");
    setMedicalAccount("");
    setOtherPreTax("");
    setAfterTaxDeductions("");
    setResult(null);
    setErrors(EMPTY_ERR);
    setCalculated(false);
    setIsDirty(false);
    setIsCalculating(false);
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
        href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap"
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
          
          /* Mobile responsive styles */
          @media (max-width: 640px) {
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
          
          /* Print styles */
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
            /* Force single column layout for print */
            [style*="grid-template-columns"] {
              display: block !important;
            }
            /* Optimize spacing for print */
            h1 {
              font-size: 18pt !important;
              margin-bottom: 12pt !important;
            }
            /* Ensure cards print well */
            [style*="borderRadius"] {
              border: 1px solid #ddd !important;
              box-shadow: none !important;
            }
            /* Remove backgrounds for print */
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
          padding: "10px 20px 8px",
          borderBottom: `1px solid ${T.border}`,
          background: T.surfaceAlt,
          display: "flex",
          alignItems: "center",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: isMobile ? "1rem" : "1.1rem",
            fontWeight: 800,
            color: T.text,
            letterSpacing: "-0.03em",
          }}
        >
          {TAX_YEAR} Take-Home Pay Calculator
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
            : "minmax(0, 420px) minmax(0, 1fr)",
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
            overflow: "hidden",
            minHeight: isMobile ? "auto" : 0,
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: isMobile ? "visible" : "auto",
              padding: "12px 16px",
            }}
          >
            {/* Income Type Toggle - Regular vs Bonus */}
            <div style={{ marginBottom: 10 }}>
              <Label tooltip="Regular income uses standard withholding. Bonus/supplemental income (bonuses, commissions, etc.) uses flat 22% federal withholding.">
                Income Type
              </Label>
              <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                {[
                  { label: "Regular Pay", val: "regular" },
                  { label: "Bonus/Supplemental", val: "bonus" },
                ].map((opt) => {
                  const sel = incomeType === opt.val;
                  return (
                    <button
                      key={opt.val}
                      onClick={() => {
                        setIncomeType(opt.val);
                        markDirty();
                      }}
                      style={{
                        flex: 1,
                        padding: "8px 8px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: sel ? 600 : 400,
                        fontFamily: T.font,
                        border: `1.5px solid ${sel ? T.btn : T.border}`,
                        borderRadius: T.radius,
                        background: sel ? T.btnLight : T.surface,
                        color: sel ? T.btn : T.textSub,
                        transition: "all 0.15s",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Salary Input Mode Toggle */}
            <div style={{ marginBottom: 10 }}>
              <Label tooltip="Choose whether to enter your annual salary or hourly rate. We'll calculate based on standard full-time hours (40 hours/week).">
                Payment Basis
              </Label>
              <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                {[
                  { label: "Annual Salary", val: "annual" },
                  { label: "Hourly Rate", val: "hourly" },
                ].map((opt) => {
                  const sel = salaryMode === opt.val;
                  return (
                    <button
                      key={opt.val}
                      onClick={() => {
                        setSalaryMode(opt.val);
                        setErrors((e) => ({ ...e, salary: "" }));
                        markDirty();
                      }}
                      style={{
                        flex: 1,
                        padding: "8px 8px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: sel ? 600 : 400,
                        fontFamily: T.font,
                        border: `1.5px solid ${sel ? T.btn : T.border}`,
                        borderRadius: T.radius,
                        background: sel ? T.btnLight : T.surface,
                        color: sel ? T.btn : T.textSub,
                        transition: "all 0.15s",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Salary or Hourly Rate Input + Age */}
            {salaryMode === "annual" ? (
              <div style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    alignItems: "start",
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
                        setSalary(v);
                        markDirty();
                      }}
                      placeholder=""
                      prefix="$"
                      type="number"
                      err={errors.salary}
                      inputRef={salaryRef}
                    />
                    <FieldErr msg={errors.salary} />
                  </div>
                  <div>
                    <Label tooltip="Your age helps calculate 401(k) contribution limits. Age 50+ qualifies for catch-up contributions.">
                      Age (optional)
                    </Label>
                    <Input
                      value={age}
                      onChange={(v) => {
                        setAge(v);
                        markDirty();
                      }}
                      placeholder=""
                      type="number"
                      integersOnly={true}
                      inputRef={ageRef}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 10 }}>
                {/* Hourly Rate - full width */}
                <div style={{ marginBottom: 10 }}>
                  <Label tooltip="Your hourly pay rate. We'll calculate annual salary based on 40 hours/week (2,080 hours/year) plus any overtime.">
                    Hourly Rate
                  </Label>
                  <Input
                    value={hourlyRate}
                    onChange={(v) => {
                      setHourlyRate(v);
                      markDirty();
                    }}
                    placeholder=""
                    prefix="$"
                    type="number"
                    err={errors.salary}
                    inputRef={hourlyRateRef}
                  />
                  <FieldErr msg={errors.salary} />
                </div>

                {/* Overtime hours - full width */}
                <div style={{ marginBottom: 10 }}>
                  <Label tooltip="Average weekly overtime hours at 1.5x pay rate. Leave blank if none.">
                    Overtime Hours (optional)
                  </Label>
                  <Input
                    value={overtimeHours}
                    onChange={(v) => {
                      setOvertimeHours(v);
                      markDirty();
                    }}
                    placeholder="0"
                    type="number"
                  />
                </div>

                {/* Age - full width */}
                <div>
                  <Label tooltip="Your age helps calculate 401(k) contribution limits. Age 50+ qualifies for catch-up contributions.">
                    Age (optional)
                  </Label>
                  <Input
                    value={age}
                    onChange={(v) => {
                      setAge(v);
                      markDirty();
                    }}
                    placeholder=""
                    type="number"
                    integersOnly={true}
                    inputRef={ageRef}
                  />
                </div>

                {hourlyRate && parse(hourlyRate) > 0 && (
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: T.textSub,
                      marginTop: 4,
                      fontFamily: T.font,
                    }}
                  >
                    ≈{" "}
                    {fc(
                      getAnnualSalaryFromHourly(
                        hourlyRate,
                        payPeriods,
                        overtimeHours
                      ),
                      0
                    )}{" "}
                    annually
                    {parse(overtimeHours) > 0 && (
                      <span style={{ color: T.textMuted }}>
                        {" "}
                        (includes {parse(overtimeHours)} hrs/week OT)
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Filing Status + Pay Frequency */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 10,
                alignItems: "start",
              }}
              className="mobile-stack"
            >
              <div>
                <Label tooltip="Your tax filing status affects your federal tax calculation.">
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
              <div>
                <Label tooltip="How often you receive paychecks. Bi-weekly = every 2 weeks (26 or 27 paychecks/year - some years have an extra pay period). Semi-monthly = twice per month on set dates (always 24 paychecks/year, like 1st and 15th). Most hourly workers are bi-weekly; most salaried workers are semi-monthly.">
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
            </div>

            {/* W-4 Withholding Options - Collapsible */}
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <input
                  type="checkbox"
                  id="w4OptionsCheck"
                  checked={showW4Options}
                  onChange={(e) => {
                    setShowW4Options(e.target.checked);
                    if (!e.target.checked) {
                      setDependents("");
                      setAdditionalWithholding("");
                      markDirty();
                    }
                  }}
                  style={{
                    width: 16,
                    height: 16,
                    cursor: "pointer",
                    accentColor: T.btn,
                  }}
                />
                <label
                  htmlFor="w4OptionsCheck"
                  style={{
                    marginLeft: 8,
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: T.text,
                    cursor: "pointer",
                    userSelect: "none",
                    fontFamily: T.font,
                  }}
                >
                  I have dependents or extra withholding
                </label>
              </div>

              {showW4Options && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    alignItems: "start",
                  }}
                  className="mobile-stack"
                >
                  <div>
                    <Label tooltip="Number of dependents under age 17. Each reduces your federal tax by $2,000/year.">
                      Dependents
                    </Label>
                    <Input
                      value={dependents}
                      onChange={(v) => {
                        setDependents(v);
                        markDirty();
                      }}
                      placeholder="0"
                      type="number"
                      integersOnly={true}
                    />
                  </div>
                  <div>
                    <Label tooltip="Extra federal tax withheld each paycheck (beyond standard withholding).">
                      Extra Withholding
                    </Label>
                    <Input
                      value={additionalWithholding}
                      onChange={(v) => {
                        setAdditionalWithholding(v);
                        markDirty();
                      }}
                      placeholder="0"
                      prefix="$"
                      type="number"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* State Tax Rate */}
            <div style={{ marginBottom: 10 }}>
              <Label tooltip="Your state income tax rate. Leave blank if your state has no income tax.">
                State Tax Rate (optional)
              </Label>
              <Input
                value={stateRate}
                onChange={(v) => {
                  setStateRate(v);
                  markDirty();
                }}
                placeholder="0"
                suffix="%"
                type="number"
                err={errors.stateRate}
                inputRef={stateRateRef}
              />
              <FieldErr msg={errors.stateRate} />
              <div
                style={{
                  fontSize: "0.68rem",
                  color: T.textMuted,
                  marginTop: 2,
                  fontFamily: T.font,
                }}
              >
                No state income tax: AK, FL, NV, SD, TN, TX, WA, WY
              </div>
            </div>

            <Divider label="Retirement Contributions" />

            {/* Retirement Contributions */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 10,
                alignItems: "start",
              }}
              className="mobile-stack"
            >
              <div>
                <Label tooltip="Pre-tax contributions reduce your taxable income now.">
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
                />
                <FieldErr msg={errors.preTaxPct} />
              </div>
              <div>
                <Label tooltip="Roth contributions are after-tax but grow tax-free.">
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
                />
                <FieldErr msg={errors.rothPct} />
              </div>
            </div>

            {/* Additional Deductions Toggle */}
            <div style={{ marginBottom: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <input
                  type="checkbox"
                  id="additionalDeductionsCheck"
                  checked={showAdditionalDeductions}
                  onChange={(e) => {
                    setShowAdditionalDeductions(e.target.checked);
                    markDirty();
                  }}
                  style={{
                    marginRight: 8,
                    width: 16,
                    height: 16,
                    cursor: "pointer",
                    accentColor: T.btn,
                  }}
                />
                <label
                  htmlFor="additionalDeductionsCheck"
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: T.text,
                    cursor: "pointer",
                    fontFamily: T.font,
                  }}
                >
                  I have additional deductions
                  <InfoTooltip text="Include health insurance, HSA/FSA, and other pre-tax or after-tax deductions." />
                </label>
              </div>

              {/* Collapsible Additional Deductions Section */}
              {showAdditionalDeductions && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "12px",
                    background: T.surfaceAlt,
                    borderRadius: T.radius,
                    border: `1px solid ${T.border}`,
                    animation: "slideDown 0.2s ease-out",
                  }}
                >
                  <style>
                    {`
                      @keyframes slideDown {
                        from {
                          opacity: 0;
                          transform: translateY(-10px);
                        }
                        to {
                          opacity: 1;
                          transform: translateY(0);
                        }
                      }
                    `}
                  </style>

                  <div
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: T.textMuted,
                      marginBottom: 10,
                    }}
                  >
                    Pre-Tax Deductions
                  </div>

                  {/* Health Insurance + Medical Account in 2x2 grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      marginBottom: 10,
                      alignItems: "start",
                    }}
                    className="mobile-stack"
                  >
                    <div>
                      <Label tooltip="Amount deducted from each paycheck for health insurance premiums.">
                        Health Insurance
                      </Label>
                      <Input
                        value={healthInsurance}
                        onChange={(v) => {
                          setHealthInsurance(v);
                          markDirty();
                        }}
                        placeholder="0"
                        prefix="$"
                        type="number"
                      />
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: T.textMuted,
                          marginTop: 2,
                          fontFamily: T.font,
                        }}
                      >
                        per paycheck
                      </div>
                    </div>

                    <div>
                      <Label tooltip="Annual HSA or FSA contributions. Both are pre-tax and reduce your taxable income equally.">
                        HSA/FSA (annual)
                      </Label>
                      <Input
                        value={medicalAccount}
                        onChange={(v) => {
                          setMedicalAccount(v);
                          markDirty();
                        }}
                        placeholder="0"
                        prefix="$"
                        type="number"
                      />
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: T.textMuted,
                          marginTop: 2,
                          fontFamily: T.font,
                        }}
                      >
                        annual total
                      </div>
                    </div>
                  </div>

                  {/* Other Pre-Tax + After-Tax in 2x2 grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      marginBottom: 0,
                      alignItems: "start",
                    }}
                    className="mobile-stack"
                  >
                    <div>
                      <Label tooltip="Any other pre-tax deductions per paycheck (e.g., commuter benefits, dependent care FSA).">
                        Other Pre-Tax
                      </Label>
                      <Input
                        value={otherPreTax}
                        onChange={(v) => {
                          setOtherPreTax(v);
                          markDirty();
                        }}
                        placeholder="0"
                        prefix="$"
                        type="number"
                      />
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: T.textMuted,
                          marginTop: 2,
                          fontFamily: T.font,
                        }}
                      >
                        per paycheck
                      </div>
                    </div>

                    <div>
                      <Label tooltip="Deductions taken after taxes from each paycheck (e.g., union dues, parking, wage garnishments).">
                        After-Tax
                      </Label>
                      <Input
                        value={afterTaxDeductions}
                        onChange={(v) => {
                          setAfterTaxDeductions(v);
                          markDirty();
                        }}
                        placeholder="0"
                        prefix="$"
                        type="number"
                      />
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: T.textMuted,
                          marginTop: 2,
                          fontFamily: T.font,
                        }}
                      >
                        per paycheck
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
              gap: 8,
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
        <div
          ref={resultRef}
          style={{
            background: T.surface,
            borderRadius: T.radiusLg,
            border: `1px solid ${T.border}`,
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              padding: "10px 16px",
              borderBottom: `1px solid ${T.border}`,
              background: T.surfaceAlt,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.textSub,
              }}
            >
              Results
            </span>
            {result && !isDirty && (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => {
                    const summary = `TAKE-HOME PAY CALCULATOR RESULTS

Net Pay: ${fc(result.netPayPerCheck, 2)} per paycheck
Gross Pay: ${fc(result.perPaycheck, 2)} per paycheck
Retirement Contributions: ${fc(
                      result.preTaxRetirementPerCheck +
                        result.rothRetirementPerCheck,
                      2
                    )} per paycheck (${(
                      parseFloat(preTaxPct || 0) + parseFloat(rothPct || 0)
                    ).toFixed(1)}%)
${
  result.preTaxRetirementPerCheck > 0
    ? `  - Pre-Tax: ${fc(result.preTaxRetirementPerCheck, 2)}`
    : ""
}
${
  result.rothRetirementPerCheck > 0
    ? `  - Roth: ${fc(result.rothRetirementPerCheck, 2)}`
    : ""
}

Effective Tax Rate: ${result.effectiveTaxRate}%

ANNUAL TOTALS:
Gross Income: ${fc(result.totalAnnualIncome, 2)}
Net Pay: ${fc(result.netPayPerCheck * parseFloat(payPeriods), 2)}
Federal Tax: ${fc(result.fedTaxPerCheck * parseFloat(payPeriods), 2)}
${
  parseFloat(stateRate || 0) > 0
    ? `State Tax: ${fc(result.stateTaxPerCheck * parseFloat(payPeriods), 2)}`
    : ""
}
FICA: ${fc(
                      (result.socialSecurityPerCheck +
                        result.medicarePerCheck) *
                        parseFloat(payPeriods),
                      2
                    )}
Retirement: ${fc(
                      (result.preTaxRetirementPerCheck +
                        result.rothRetirementPerCheck) *
                        parseFloat(payPeriods),
                      2
                    )}

Generated by Take-Home Pay Calculator`;

                    navigator.clipboard.writeText(summary).then(() => {
                      // Visual feedback
                      const btn = event.currentTarget;
                      const originalText = btn.innerHTML;
                      btn.innerHTML = "✓ Copied!";
                      btn.style.background = "#10B981";
                      btn.style.color = "#fff";
                      btn.style.borderColor = "#10B981";
                      setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.style.background = T.surface;
                        btn.style.color = T.textSub;
                        btn.style.borderColor = T.border;
                      }, 1500);
                    });
                  }}
                  className="no-print"
                  style={{
                    padding: "6px 10px",
                    background: T.surface,
                    color: T.textSub,
                    border: `1px solid ${T.border}`,
                    borderRadius: T.radius,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = T.surfaceAlt;
                    e.currentTarget.style.borderColor = T.textMuted;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = T.surface;
                    e.currentTarget.style.borderColor = T.border;
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="9"
                      y="9"
                      width="13"
                      height="13"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                    <path
                      d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                    />
                  </svg>
                  Copy
                </button>
                <button
                  onClick={() => window.print()}
                  className="no-print"
                  style={{
                    padding: "6px 10px",
                    background: T.surface,
                    color: T.textSub,
                    border: `1px solid ${T.border}`,
                    borderRadius: T.radius,
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    fontFamily: T.font,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = T.surfaceAlt;
                    e.currentTarget.style.borderColor = T.textMuted;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = T.surface;
                    e.currentTarget.style.borderColor = T.border;
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6 9V2h12v7M6 18H4c-1.1 0-2-.9-2-2v-5c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v5c0 1.1-.9 2-2 2h-2M6 14h12v8H6v-8z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  Print
                </button>
              </div>
            )}
          </div>

          <div
            style={{
              overflowY: (isMobile || !result) ? "hidden" : "auto",
              padding: "12px 16px",
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
                  borderRadius: T.radius,
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
                      <circle
                        cx="12"
                        cy="12"
                        r="9.5"
                        stroke={T.btn}
                        strokeWidth="1.5"
                      />
                      <path
                        d="M20 11A8 8 0 1 0 4.93 17" stroke={T.btn} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20 7v4h-4" stroke={T.btn} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
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
                    Your information has changed
                  </div>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: T.textSub,
                      fontFamily: T.font,
                      textAlign: "center",
                      lineHeight: 1.55,
                    }}
                  >
                    Click <strong>Recalculate</strong> to update your results
                    based on the new values you've entered.
                  </div>
                </div>
              </div>
            )}

            {!result || isCalculating ? (
              <EmptyResults isCalculating={isCalculating} />
            ) : (
              <div>
                {/* Net Pay Cards - Per Paycheck and Annual */}
                {/* Net Pay Per Paycheck + Retirement Contributions Side-by-Side */}
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 10,
                    flexWrap: isMobile ? "wrap" : "nowrap",
                    alignItems: "stretch",
                  }}
                >
                  <StatCard
                    label="Net Pay Per Paycheck"
                    value={fc(result.netPayPerCheck, 2)}
                    sub={`from ${fc(result.perPaycheck, 2)} gross`}
                  />

                  {/* Retirement Contributions Card - Only show if contributions > 0 */}
                  {(result.preTaxRetirementPerCheck > 0 ||
                    result.rothRetirementPerCheck > 0) && (
                    <div
                      style={{
                        background: "#FFFFFF",
                        borderRadius: "8px",
                        border: "1px solid #E5E7EB",
                        padding: "20px 24px",
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        boxShadow:
                          "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
                      }}
                      className="mobile-padding-sm print-break-avoid"
                    >
                      <div style={{ width: "100%", textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            letterSpacing: "0.01em",
                            color: "#64748B",
                            fontFamily: T.font,
                            marginBottom: 12,
                          }}
                        >
                          {result.preTaxRetirementPerCheck > 0 && result.rothRetirementPerCheck > 0
                            ? "Retirement Contributions"
                            : result.preTaxRetirementPerCheck > 0
                            ? "Pre-Tax Contribution (Traditional)"
                            : "Roth Contribution (After-Tax)"}
                        </div>
                        <div
                          style={{
                            fontSize: "2.5rem",
                            fontWeight: 600,
                            color: "#1E293B",
                            lineHeight: 1,
                            fontFamily: T.font,
                            letterSpacing: "-0.03em",
                            fontVariantNumeric: "tabular-nums",
                            marginBottom: 8,
                          }}
                          className="mobile-text-sm"
                        >
                          {fc(
                            result.preTaxRetirementPerCheck +
                              result.rothRetirementPerCheck,
                            2
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#64748B",
                            fontFamily: T.font,
                            lineHeight: 1.5,
                            marginBottom: 8,
                          }}
                        >
                          per paycheck (
                          {(parseFloat(preTaxPct || 0) +
                            parseFloat(rothPct || 0)) %
                            1 ===
                          0
                            ? Math.round(
                                parseFloat(preTaxPct || 0) +
                                  parseFloat(rothPct || 0)
                              )
                            : (
                                parseFloat(preTaxPct || 0) +
                                parseFloat(rothPct || 0)
                              ).toFixed(1)}
                          % total)
                        </div>
                        {result.preTaxRetirementPerCheck > 0 &&
                        result.rothRetirementPerCheck > 0 ? (
                          <>
                            <div
                              style={{
                                fontSize: "0.8rem",
                                color: "#64748B",
                                fontFamily: T.font,
                                display: "flex",
                                justifyContent: "center",
                                gap: 16,
                                flexWrap: "wrap",
                                marginBottom: 4,
                              }}
                            >
                              <span>
                                {fc(result.preTaxRetirementPerCheck, 2)} Pre-Tax
                              </span>
                              <span style={{ color: "#CBD5E1" }}>•</span>
                              <span>
                                {fc(result.rothRetirementPerCheck, 2)} Roth
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: "0.8rem",
                                color: "#64748B",
                                fontFamily: T.font,
                              }}
                            >
                              {fc(
                                (result.preTaxRetirementPerCheck +
                                  result.rothRetirementPerCheck) *
                                  result.payPeriods,
                                0
                              )}{" "}
                              annually
                            </div>
                          </>
                        ) : (
                          <div
                            style={{
                              fontSize: "0.8rem",
                              color: "#64748B",
                              fontFamily: T.font,
                            }}
                          >
                            {fc(
                              (result.preTaxRetirementPerCheck +
                                result.rothRetirementPerCheck) *
                                result.payPeriods,
                              0
                            )}{" "}
                            annually
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 401k Annual Limit Notice (informational, non-blocking) */}
                {result.show401kNotice && (
                  <div style={{ marginBottom: 10 }}>
                    <NoteBox color="#1E40AF" bg="#F0F9FF" border="#BFDBFE">
                      <strong>ℹ️ Annual Contribution Notice:</strong> Your
                      current contribution rate projects to{" "}
                      {fc(result.annual401kAmount, 0)} annually, which exceeds
                      the 2026 IRS limit of {result.limit401kLabel} for your
                      age. This is OK if you're front-loading contributions,
                      catching up mid-year, or letting your employer auto-stop
                      at the limit. Most plans automatically stop contributions
                      when you hit the limit.
                    </NoteBox>
                  </div>
                )}

                {/* FICA Social Security Wage Limit Indicator */}
                {result.totalAnnualIncome > FICA_SS_LIMIT && (
                  <div style={{ marginBottom: 10 }}>
                    <NoteBox color="#059669" bg="#F0FDF4" border="#BBF7D0">
                      <strong>✓ Social Security Cap Reached:</strong> Your
                      annual income ({fc(result.totalAnnualIncome, 0)}) exceeds
                      the 2026 Social Security wage base of{" "}
                      {fc(FICA_SS_LIMIT, 0)}. Social Security tax stops after
                      you earn {fc(FICA_SS_LIMIT, 0)}, so you'll save{" "}
                      {fc(
                        (result.totalAnnualIncome - FICA_SS_LIMIT) *
                          FICA_SS_RATE,
                        0
                      )}{" "}
                      in FICA annually. Medicare tax continues on all earnings.
                    </NoteBox>
                  </div>
                )}

                {/* Collapsible Tax & Deduction Breakdown */}
                <details
                  style={{
                    marginBottom: 12,
                    background: "#F9FAFB",
                    border: `1px solid ${T.border}`,
                    borderRadius: T.radius,
                  }}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      color: T.text,
                      padding: "10px 12px",
                      userSelect: "none",
                      listStyle: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.15s",
                    }}
                  >
                    <span>View Tax &amp; Deduction Details</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      style={{
                        flexShrink: 0,
                        transition: "transform 0.2s",
                      }}
                      className="details-arrow"
                    >
                      <path
                        d="M3 4.5l3 3 3-3"
                        stroke={T.textSub}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </summary>

                  <div
                    style={{
                      paddingTop: 8,
                      padding: "8px 12px 12px",
                    }}
                  >
                    {/* Effective Tax Rate — inline SummaryLine style */}
                    <SummaryLine
                      label={
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          Effective tax rate
                          <InfoTooltip text="Your effective tax rate is the percentage of your gross pay that goes to taxes (federal, state, and FICA). This is different from your tax bracket — it's the actual average rate you pay across all your income." />
                        </span>
                      }
                      value={`${result.effectiveTaxRate.toFixed(1)}%`}
                      bold
                    />

                    <Divider label="Per Paycheck Breakdown" />

                    {/* Pre-Tax Deductions (excluding retirement - now shown above) */}
                    {result.totalPreTaxDeductions -
                      result.preTaxRetirementPerCheck >
                      0 && (
                      <>
                        <SummaryLine
                          label="Other Pre-Tax Deductions"
                          value={fc(
                            result.totalPreTaxDeductions -
                              result.preTaxRetirementPerCheck,
                            2
                          )}
                          bold
                        />
                        {result.healthInsPerCheck > 0 && (
                          <SummaryLine
                            label="Health Insurance"
                            value={fc(result.healthInsPerCheck, 2)}
                            indent
                          />
                        )}
                        {result.medicalAcctPerCheck > 0 && (
                          <SummaryLine
                            label="HSA/FSA"
                            value={fc(result.medicalAcctPerCheck, 2)}
                            indent
                          />
                        )}
                        {result.otherPerCheck > 0 && (
                          <SummaryLine
                            label="Other Pre-Tax"
                            value={fc(result.otherPerCheck, 2)}
                            indent
                          />
                        )}
                      </>
                    )}

                    {/* Taxes */}
                    <SummaryLine
                      label="Federal Income Tax"
                      value={fc(result.federalTaxPerCheck, 2)}
                      bold={false}
                    />
                    {result.stateRate > 0 && (
                      <SummaryLine
                        label={`State Income Tax (${result.stateRate}%)`}
                        value={fc(result.stateTaxPerCheck, 2)}
                        bold={false}
                      />
                    )}
                    <SummaryLine
                      label="FICA Taxes"
                      value={fc(result.ficaTotalPerCheck, 2)}
                      bold={false}
                    />
                    <SummaryLine
                      label="Social Security (6.2%)"
                      value={fc(result.socialSecurityPerCheck, 2)}
                      indent
                      dimmed
                    />
                    <SummaryLine
                      label="Medicare (1.45%+)"
                      value={fc(result.medicarePerCheck, 2)}
                      indent
                      dimmed
                    />

                    {/* After-Tax Deductions (excluding Roth retirement - now shown above) */}
                    {result.afterTaxPerCheck > 0 && (
                      <SummaryLine
                        label="After-Tax Deductions"
                        value={fc(result.afterTaxPerCheck, 2)}
                        bold={false}
                      />
                    )}

                    <Divider />

                    {/* Totals */}
                    <SummaryLine
                      label="Total Deductions"
                      value={fc(result.totalDeductionsPerCheck, 2)}
                      bold
                      color={T.red}
                    />
                    <SummaryLine
                      label="Net Pay (Take-Home)"
                      value={fc(result.netPayPerCheck, 2)}
                      bold
                      color={T.green}
                    />

                    {/* True Cost of Retirement Contribution */}
                    {result.preTaxRetirementPerCheck > 0 && (
                      <>
                        <Divider />
                        <div
                          style={{
                            background: "#F0FDF4",
                            border: "1px solid #BBF7D0",
                            borderRadius: T.radius,
                            padding: "12px 14px",
                            marginTop: 8,
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                              color: "#059669",
                              fontFamily: T.font,
                              marginBottom: 8,
                            }}
                          >
                            💰 True Cost of Retirement Savings
                          </div>
                          <SummaryLine
                            label="Your pre-tax contribution"
                            value={fc(result.preTaxRetirementPerCheck, 2)}
                            bold={false}
                          />
                          <SummaryLine
                            label="True cost to your paycheck"
                            value={fc(result.preTaxTrueCost, 2)}
                            bold
                            color={T.green}
                          />
                          <SummaryLine
                            label="Tax Savings"
                            value={fc(result.preTaxTaxSavings, 2)}
                            bold={false}
                          />
                          <div
                            style={{
                              fontSize: "0.78rem",
                              color: "#059669",
                              fontFamily: T.font,
                              marginTop: 10,
                              lineHeight: 1.5,
                              fontWeight: 500,
                            }}
                          >
                            💡 Your {fc(result.preTaxRetirementPerCheck, 2)}{" "}
                            contribution only costs you{" "}
                            {fc(result.preTaxTrueCost, 2)} from your paycheck
                          </div>
                        </div>
                      </>
                    )}

                    <Divider label="Annual Totals" />

                    <SummaryLine
                      label="Annual Gross Pay"
                      value={fc(result.perPaycheck * result.payPeriods, 0)}
                      bold={false}
                    />
                    <SummaryLine
                      label="Annual Total Deductions"
                      value={fc(
                        result.totalDeductionsPerCheck * result.payPeriods,
                        0
                      )}
                      bold={false}
                    />
                    <SummaryLine
                      label="Annual Net Pay"
                      value={fc(result.netPayPerCheck * result.payPeriods, 0)}
                      bold
                      color={T.green}
                    />
                  </div>
                </details>

                {/* Info Box */}
                <div style={{ marginTop: 12 }}>
                  <NoteBox color="#1E40AF" bg="#F0F9FF" border="#BFDBFE">
                    <strong>Note:</strong> This estimate uses {TAX_YEAR} federal
                    tax brackets and your W-4 inputs. Actual withholding may
                    vary based on additional income, deductions, credits, and
                    other factors not captured here. Consult a tax professional
                    for personalized advice.
                  </NoteBox>
                </div>
              </div>
            )}
          </div>

          {/* Footer disclaimer */}
          <div
            style={{
              flexShrink: 0,
              padding: "8px 16px",
              borderTop: `1px solid ${T.border}`,
              background: T.surfaceAlt,
            }}
          >
            <div
              style={{
                fontSize: "0.64rem",
                color: T.textMuted,
                lineHeight: 1.55,
              }}
            >
              Based on {TAX_YEAR} IRS tax brackets and FICA rates. For
              educational use only — not financial or tax advice.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
