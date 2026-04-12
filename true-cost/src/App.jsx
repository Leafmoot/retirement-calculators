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

const EMPTY_ERR = {
  salary: "",
  filingStatus: "",
  payPeriods: "",
  preTaxPct: "",
  rothPct: "",
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
  // Button + totals — deep forest green
  btn: "#166534",
  btnHover: "#14532D",
  btnLight: "#DCFCE7",
  btnBorder: "#BBF7D0",
  // Totals accent (Annual Limit, Total Remaining)
  total: "#166534",
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

// Tooltip component with smart positioning
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
              fontSize: "0.8rem",
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
        {tooltip && <InfoTooltip text={tooltip} />}
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
        // Only allow numbers and one decimal point
        if (!/^\d*\.?\d*$/.test(newValue)) {
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
            fontSize: "0.8rem",
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
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#64748B",
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
            color: "#1E293B",
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
              color: "#64748B",
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
                    fontSize: "0.8rem",
                    color: "#64748B",
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

function Badge({ children, color, bg }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: "0.8rem",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        background: bg,
        color,
        fontFamily: T.font,
      }}
    >
      {children}
    </span>
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
            Enter your salary and contribution rates to discover how much your
            retirement savings actually reduces your paycheck—it's less than you
            think.
          </div>
        )}
      </div>
    </div>
  );
}

// ── All result notices — grouped, rendered below limit summary ────────────────
function ResultNotices({ result }) {
  const notes = [];

  // Ages 60–63 enhanced catch-up (REMOVED "SECURE 2.0" JARGON)
  if (result.is6063) {
    notes.push(
      <NoteBox key="6063" color="#5B21B6" bg="#FAF5FF" border="#E9D5FF">
        <strong>Enhanced catch-up (ages 60–63):</strong> Because you're between
        ages 60 and 63, your catch-up limit is {fc(LIMITS.catchUp6063)} — higher
        than the standard {fc(LIMITS.catchUp50)} that applies at other catch-up
        eligible ages. This enhanced window closes the year you turn 64, at
        which point your catch-up reverts to {fc(LIMITS.catchUp50)}.{" "}
        <em>
          Note: not all plans have adopted this provision — confirm with your
          plan administrator before relying on the higher limit.
        </em>
      </NoteBox>
    );
  }

  // Age 50–59 standard catch-up notice
  if (
    result.catchUpAmt === LIMITS.catchUp50 &&
    !result.is6063 &&
    !result.ageOver63
  ) {
    notes.push(
      <NoteBox key="50plus" color="#166534" bg="#F0FDF4" border="#BBF7D0">
        <strong>Catch-up eligible (Age 50+):</strong> Your limit includes an
        additional {fc(LIMITS.catchUp50)} catch-up on top of the{" "}
        {fc(LIMITS.standard)} base.
      </NoteBox>
    );
  }

  // Age 64+ — back to standard catch-up after enhanced window closes
  if (result.ageOver63 && result.catchUpAmt === LIMITS.catchUp50) {
    notes.push(
      <NoteBox key="over63" color="#0F766E" bg="#F0FDFA" border="#99F6E4">
        <strong>Standard catch-up (Age 64+):</strong> Your limit includes the
        standard {fc(LIMITS.catchUp50)} catch-up. The enhanced{" "}
        {fc(LIMITS.catchUp6063)} limit available between ages 60–63 no longer
        applies — you've returned to the standard catch-up amount that continues
        from age 64 onward.
      </NoteBox>
    );
  }

  // Split path: base limit flexibility
  if (result.split) {
    notes.push(
      <NoteBox key="splitflex" color="#1E40AF" bg="#F0F9FF" border="#BFDBFE">
        <strong>Base limit flexibility:</strong> Your {fc(LIMITS.standard)} base
        can be any mix of pre-tax and Roth — only the {fc(result.catchUpAmt)}{" "}
        catch-up portion must be Roth.
      </NoteBox>
    );
  }

  // Single path: deferral type flexibility
  if (!result.split) {
    if (result.catchUpAmt > 0 && result.fica === false) {
      notes.push(
        <NoteBox key="fullflex" color="#1E40AF" bg="#F0F9FF" border="#BFDBFE">
          <strong>Full flexibility:</strong> Since your FICA wages were $150,000
          or less, your entire {fc(result.annualLimit)} — including the{" "}
          {fc(result.catchUpAmt)} catch-up — may be pre-tax, Roth, or any
          combination.
        </NoteBox>
      );
    } else if (result.catchUpAmt === 0) {
      // Only show this for people under 50 (no catch-up scenario)
      notes.push(
        <NoteBox key="flex" color="#1E40AF" bg="#F0F9FF" border="#BFDBFE">
          <strong>Deferral flexibility:</strong> Your {fc(result.annualLimit)}{" "}
          limit may be contributed as pre-tax (traditional), Roth, or any mix —
          whichever best suits your tax strategy.
        </NoteBox>
      );
    }
    // Don't show flexibility notice when FICA > 150k but using Roth-only strategy
    // (that scenario requires catch-up to be Roth, even though we're showing single card)
  }

  // Action step — always show at the bottom
  notes.push(
    <NoteBox key="action" color="#166534" bg="#F0FDF4" border="#BBF7D0">
      <strong>Next step:</strong> To update your contribution election, log into
      your benefits portal or contact your HR department. Changes typically take
      effect on the next available pay period.
    </NoteBox>
  );

  if (notes.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        marginTop: 14,
      }}
    >
      {notes}
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
              flexShrink: 0,
              padding: "10px 16px",
              borderBottom: `1px solid ${T.border}`,
              background: T.surfaceAlt,
            }}
          >
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.textSub,
              }}
            >
              Your Information
            </span>
          </div>
          <div
            style={{
              flex: 1,
              overflowY: isMobile ? "visible" : "auto",
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
                    setSalary(v);
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
                <Label tooltip="Your tax filing status affects your marginal tax rate and the tax savings you receive from pre-tax contributions.">
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
                <Label tooltip="Pre-tax contributions reduce your taxable income now, lowering the amount withheld from your paycheck.">
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
                <Label tooltip="Roth contributions are after-tax, so they don't reduce your current taxable income but grow tax-free.">
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
                    <circle cx="12" cy="12" r="9.5" stroke={T.btn} strokeWidth="1.5" />
                    <path d="M12 7v5.5l3.2 2" stroke={T.btn} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
              flexShrink: 0,
              padding: "10px 16px",
              borderBottom: `1px solid ${T.border}`,
              background: T.surfaceAlt,
            }}
          >
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.textSub,
              }}
            >
              Results
            </span>
          </div>

          <div
            style={{
              overflowY: (isMobile || !result) ? "hidden" : "auto",
              padding: "16px",
            }}
          >

            {!result && <EmptyResults isCalculating={isCalculating} />}

            {result && !isCalculating && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {/* Three Stat Cards with Breakdowns */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 12,
                  }}
                  className="mobile-stack"
                >
                  {/* Total Contribution Card */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow:
                        "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    className="mobile-padding-sm print-break-avoid"
                  >
                    <div
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "#64748B",
                        fontFamily: T.font,
                        marginBottom: 6,
                        textAlign: "center",
                      }}
                    >
                      {result.preTaxContribution > 0 &&
                      result.rothContribution > 0
                        ? "Total Contribution"
                        : result.preTaxContribution > 0
                        ? "Pre-Tax Contribution"
                        : "Roth Contribution"}
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div style={{ flex: 1, textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: "2rem",
                            fontWeight: 600,
                            color: "#1E293B",
                            lineHeight: 1,
                            fontFamily: T.font,
                            letterSpacing: "-0.03em",
                            fontVariantNumeric: "tabular-nums",
                            marginBottom: 4,
                          }}
                          className="mobile-text-sm"
                        >
                          {fc(result.totalContribution)}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#64748B",
                            fontFamily: T.font,
                            lineHeight: 1.5,
                          }}
                        >
                          per paycheck
                        </div>
                      </div>
                      {/* Breakdown - Right Side on Desktop */}
                      {result.preTaxContribution > 0 &&
                        result.rothContribution > 0 && (
                          <div
                            style={{
                              minWidth: 80,
                              paddingLeft: 10,
                              borderLeft: `1px solid ${T.border}`,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.8rem",
                                color: T.textSub,
                                fontFamily: T.font,
                              }}
                            >
                              <span
                                style={{
                                  color: T.textMuted,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Pre-Tax
                              </span>
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {fc(result.preTaxContribution)}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.8rem",
                                color: T.textSub,
                                fontFamily: T.font,
                              }}
                            >
                              <span
                                style={{
                                  color: T.textMuted,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Roth
                              </span>
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {fc(result.rothContribution)}
                              </span>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>

                  {/* True Cost Card */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow:
                        "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    className="mobile-padding-sm print-break-avoid"
                  >
                    <div
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "#64748B",
                        fontFamily: T.font,
                        marginBottom: 6,
                        textAlign: "center",
                      }}
                    >
                      True Cost
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div style={{ flex: 1, textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: "2rem",
                            fontWeight: 600,
                            color: "#1E293B",
                            lineHeight: 1,
                            fontFamily: T.font,
                            letterSpacing: "-0.03em",
                            fontVariantNumeric: "tabular-nums",
                            marginBottom: 4,
                          }}
                          className="mobile-text-sm"
                        >
                          {fc(result.totalTrueCost)}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#64748B",
                            fontFamily: T.font,
                            lineHeight: 1.5,
                          }}
                        >
                          per paycheck
                        </div>
                      </div>
                      {/* Breakdown - Right Side on Desktop */}
                      {result.preTaxContribution > 0 &&
                        result.rothContribution > 0 && (
                          <div
                            style={{
                              minWidth: 80,
                              paddingLeft: 10,
                              borderLeft: `1px solid ${T.border}`,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.8rem",
                                color: T.textSub,
                                fontFamily: T.font,
                              }}
                            >
                              <span
                                style={{
                                  color: T.textMuted,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Pre-Tax
                              </span>
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {fc(result.preTaxTrueCost)}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.8rem",
                                color: T.textSub,
                                fontFamily: T.font,
                              }}
                            >
                              <span
                                style={{
                                  color: T.textMuted,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Roth
                              </span>
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {fc(result.rothTrueCost)}
                              </span>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Tax Savings Card */}
                  <div
                    style={{
                      background: "#FFFFFF",
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow:
                        "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    className="mobile-padding-sm print-break-avoid"
                  >
                    <div
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "#64748B",
                        fontFamily: T.font,
                        marginBottom: 6,
                        textAlign: "center",
                      }}
                    >
                      Tax Savings
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div style={{ flex: 1, textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: "2rem",
                            fontWeight: 600,
                            color: T.green,
                            lineHeight: 1,
                            fontFamily: T.font,
                            letterSpacing: "-0.03em",
                            fontVariantNumeric: "tabular-nums",
                            marginBottom: 4,
                          }}
                          className="mobile-text-sm"
                        >
                          {fc(result.totalTaxSavings)}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#64748B",
                            fontFamily: T.font,
                            lineHeight: 1.5,
                          }}
                        >
                          per paycheck
                        </div>
                      </div>
                      {/* Breakdown - Right Side on Desktop */}
                      {result.preTaxContribution > 0 &&
                        result.rothContribution > 0 && (
                          <div
                            style={{
                              minWidth: 80,
                              paddingLeft: 10,
                              borderLeft: `1px solid ${T.border}`,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.8rem",
                                color: T.textSub,
                                fontFamily: T.font,
                              }}
                            >
                              <span
                                style={{
                                  color: T.textMuted,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Pre-Tax
                              </span>
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontVariantNumeric: "tabular-nums",
                                  color: T.green,
                                }}
                              >
                                {fc(result.preTaxTaxSavings)}
                              </span>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.8rem",
                                color: T.textMuted,
                                fontFamily: T.font,
                              }}
                            >
                              <span>Roth</span>
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                $0.00
                              </span>
                            </div>
                          </div>
                        )}
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
                      padding: "14px 16px",
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
                    }}
                  >
                    <span>Annual Totals</span>
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
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: T.textMuted,
                            fontFamily: T.font,
                            marginTop: 8,
                            marginBottom: 4,
                          }}
                        >
                          Pre-Tax
                        </div>
                        <SummaryLine
                          label={`Contribution (${result.payPeriods} paychecks)`}
                          value={fc(
                            result.preTaxContribution * result.payPeriods
                          )}
                        />
                        <SummaryLine
                          label="True Cost"
                          value={fc(result.preTaxTrueCost * result.payPeriods)}
                          color={T.total}
                        />
                        <SummaryLine
                          label="Tax Savings"
                          value={fc(
                            result.preTaxTaxSavings * result.payPeriods
                          )}
                          color={T.green}
                        />
                      </>
                    )}

                    {result.rothContribution > 0 && (
                      <>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: T.textMuted,
                            fontFamily: T.font,
                            marginTop: 12,
                            marginBottom: 4,
                          }}
                        >
                          Roth
                        </div>
                        <SummaryLine
                          label={`Contribution (${result.payPeriods} paychecks)`}
                          value={fc(
                            result.rothContribution * result.payPeriods
                          )}
                        />
                        <SummaryLine
                          label="True Cost"
                          value={fc(result.rothTrueCost * result.payPeriods)}
                          color={T.total}
                        />
                        <SummaryLine
                          label="Tax Savings"
                          value="$0.00"
                          color={T.textMuted}
                          dimmed
                        />
                      </>
                    )}

                    <div
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: T.textMuted,
                        fontFamily: T.font,
                        marginTop: 12,
                        marginBottom: 4,
                      }}
                    >
                      Combined
                    </div>
                    <SummaryLine
                      label={`Total Contribution (${result.payPeriods} paychecks)`}
                      value={fc(result.annualTotalContribution)}
                      bold
                    />
                    <SummaryLine
                      label="True Annual Cost"
                      value={fc(result.annualTrueCost)}
                      color={T.total}
                      bold
                    />
                    <SummaryLine
                      label="Annual Tax Savings"
                      value={fc(result.annualTaxSavings)}
                      color={T.green}
                      bold
                    />
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
        </div>
      </div>
    </div>
  );
}