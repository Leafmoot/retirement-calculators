import { useState, useRef, useEffect } from "react";

// ── IRS limits — update this object each year when new limits are announced ──
const PLAN_YEAR = 2026;
const LIMITS = { standard: 24500, catchUp50: 8000, catchUp6063: 11250 };
// FICA wage threshold above which catch-up contributions must be Roth (SECURE 2.0)
// Verify annually — the IRS may adjust this threshold
const FICA_CATCHUP_THRESHOLD = 150000;
const FICA_THRESHOLD_DISPLAY = FICA_CATCHUP_THRESHOLD.toLocaleString("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function getCatchUp(age) {
  if (age >= 60 && age <= 63) return LIMITS.catchUp6063;
  if (age >= 50) return LIMITS.catchUp50;
  return 0;
}

function fc(val, decimals = 0) {
  return val.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}

function ceilPct(val) {
  return Math.ceil(val * 100);
}

// Dollar-cost-average amount: smallest cent that covers `target` across `periods` periods
function dcaAmount(target, periods) {
  if (periods <= 0 || target <= 0) return 0;
  return Math.ceil((target / periods) * 100) / 100;
}

// How many periods at a fixed dollar amount to reach the target
function periodsNeededDollar(target, dpc) {
  if (dpc <= 0 || target <= 0) return 0;
  return Math.ceil(target / dpc);
}

// Round up to nearest whole dollar for display only — keeps underlying math precise
function ceilDollar(val) {
  return Math.ceil(val);
}

function checksNeeded(target, perCheck, pct) {
  if (pct <= 0 || target <= 0) return 0;
  return Math.ceil(target / ((perCheck * pct) / 100));
}

function parse(str) {
  const v = parseFloat((str || "").replace(/,/g, ""));
  return isNaN(v) ? 0 : v;
}

const EMPTY_ERR = {
  salary: "",
  age: "",
  fica: "",
  period: "",
  ytdPre: "",
  ytdRoth: "",
  customLimit: "",
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
          fontWeight: bold ? 600 : 400,
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
            fontSize: small ? "1.8rem" : "2.5rem",
            fontWeight: 500,
            color: "#1E293B",
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
        {subLines && subLines.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
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

function Badge({ children, color, bg }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: "0.68rem",
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
          {isCalculating ? "Calculating…" : "Calculate Your Path to the Limit"}
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
            Enter your salary and current contributions to see exactly what
            percentage (or dollar amount) you need to contribute each paycheck
            to reach your 2026 IRS maximum.
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
          <strong>Full flexibility:</strong> Since your FICA wages were{" "}
          {FICA_THRESHOLD_DISPLAY}
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

// ── Main ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [salary, setSalary] = useState("");
  const [age, setAge] = useState("");
  const [payPeriods, setPayPeriods] = useState("26");
  const [curPeriod, setCurPeriod] = useState("");
  const [ytdPre, setYtdPre] = useState("");
  const [ytdRoth, setYtdRoth] = useState("");
  const [fica, setFica] = useState(null);
  const [contribMode, setContribMode] = useState("pct");

  // NEW: Contribution strategy and custom limit
  const [strategy, setStrategy] = useState("flexible"); // flexible, roth-only, or pretax-first
  const [useCustomLimit, setUseCustomLimit] = useState(false);
  const [customLimit, setCustomLimit] = useState("");

  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState(EMPTY_ERR);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const resultRef = useRef(null);
  // Refs for auto-focus on validation error
  const salaryRef = useRef(null);
  const ageRef = useRef(null);
  const periodRef = useRef(null);
  const ytdPreRef = useRef(null);
  const ytdRothRef = useRef(null);
  const customLimitRef = useRef(null);

  function markDirty() {
    if (calculated) setIsDirty(true);
  }

  // Enter key triggers Calculate
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Enter" && !e.shiftKey) calculate();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const parsedAge = parseInt(age);
  const catchUpAge = parsedAge >= 50;

  // Dynamic pay period estimate — used in both the tip and the error message
  const ppInt = parseInt(payPeriods);
  const _now = new Date();
  const _dayOfYear =
    Math.floor((_now - new Date(_now.getFullYear(), 0, 1)) / 86400000) + 1;
  const estimatedPeriodsCompleted = Math.max(
    0,
    Math.floor((_dayOfYear / 365) * ppInt) - 1
  );

  const ppOpts = [
    { label: "Weekly — 52 paychecks", value: "52" },
    { label: "Bi-Weekly — 26 paychecks", value: "26" },
    { label: "Bi-Weekly — 27 paychecks", value: "27" },
    { label: "Semi-Monthly — 24 paychecks", value: "24" },
    { label: "Monthly — 12 paychecks", value: "12" },
  ];

  function calculate() {
    const errs = { ...EMPTY_ERR };
    let bad = false;
    const w = parse(salary),
      a = parseInt(age),
      pp = parseInt(payPeriods);
    const cp = curPeriod === "" ? NaN : parseInt(curPeriod);
    const yPre = parse(ytdPre),
      yRoth = parse(ytdRoth);

    // Collect ALL validation errors before stopping
    if (!w || w <= 0) {
      errs.salary = "Enter your annual salary.";
      bad = true;
    }
    if (w > 0 && w < 10000) {
      errs.salary = `This looks low for an annual salary — did you mean to enter an hourly rate? If $${w.toFixed(
        0
      )} is correct, continue.`;
      bad = true;
    }
    if (!a || a < 18 || a > 100) {
      errs.age = "Enter a valid age (18–100).";
      bad = true;
    }
    if (curPeriod === "" || isNaN(cp) || cp < 0 || cp >= pp) {
      errs.period = `Enter a number from 0 to ${
        pp - 1
      }. Based on today's date, you've likely completed ~${estimatedPeriodsCompleted} pay period${
        estimatedPeriodsCompleted !== 1 ? "s" : ""
      }.`;
      bad = true;
    }
    if (yPre < 0) {
      errs.ytdPre = "Cannot be negative.";
      bad = true;
    }
    if (yRoth < 0) {
      errs.ytdRoth = "Cannot be negative.";
      bad = true;
    }

    // Validate custom limit
    if (useCustomLimit) {
      const customLimitVal = parse(customLimit);
      // Calculate catchUpAmt regardless of other errors for validation
      const catchUpAmtTemp =
        a >= 60 && a <= 63
          ? LIMITS.catchUp6063
          : a >= 50
          ? LIMITS.catchUp50
          : 0;
      const maxAllowedTemp = LIMITS.standard + catchUpAmtTemp;

      if (!customLimitVal || customLimitVal <= 0) {
        errs.customLimit = "Enter your custom contribution goal.";
        bad = true;
      } else if (customLimitVal > maxAllowedTemp) {
        errs.customLimit = `Cannot exceed IRS maximum of ${fc(
          maxAllowedTemp
        )} for your age.`;
        bad = true;
      }
    }

    // Check FICA regardless of other errors
    const catchUpAmt =
      a >= 60 && a <= 63 ? LIMITS.catchUp6063 : a >= 50 ? LIMITS.catchUp50 : 0;

    // If salary is below $150k, FICA is automatically false (can't have FICA wages over $150k)
    // If salary is >= $150k and they're catch-up eligible, they must answer the FICA question
    if (catchUpAmt > 0) {
      if (w >= FICA_CATCHUP_THRESHOLD && fica === null) {
        errs.fica = "Please select one.";
        bad = true;
      } else if (w < FICA_CATCHUP_THRESHOLD) {
        // Auto-set FICA to false if salary is below threshold
        // This prevents validation error and ensures correct calculation
        if (fica !== false) {
          setFica(false);
        }
      }
    }

    setErrors(errs);
    setCalculated(true);
    setIsDirty(false);

    if (bad) {
      setResult(null);
      setTimeout(() => {
        // Focus on first error in order of form appearance
        if (errs.salary) {
          salaryRef.current?.focus();
          return;
        }
        if (errs.age) {
          ageRef.current?.focus();
          return;
        }
        if (errs.fica) {
          // FICA is a toggle, can't focus - just scroll into view
          // The error message and visual state will be clear
          return;
        }
        if (errs.period) {
          periodRef.current?.focus();
          return;
        }
        if (errs.ytdPre) {
          ytdPreRef.current?.focus();
          return;
        }
        if (errs.ytdRoth) {
          ytdRothRef.current?.focus();
          return;
        }
        if (errs.customLimit) {
          customLimitRef.current?.focus();
          return;
        }
      }, 50);
      return;
    }

    // Show the bar animation briefly, then compute and display results
    setResult(null);
    setIsCalculating(true);

    setTimeout(() => {
      setIsCalculating(false);

      const is6063 = a >= 60 && a <= 63;
      const ageOver63 = a >= 64;
      const catchUpType = is6063 ? "Ages 60–63" : "Age 50+"; // REMOVED "(SECURE 2.0)"
      const rothRequired = catchUpAmt > 0 && fica === true;

      // NEW: Custom limit logic
      const maxAllowed = LIMITS.standard + catchUpAmt;
      const targetLimit =
        useCustomLimit && customLimit
          ? Math.min(parse(customLimit), maxAllowed)
          : maxAllowed;

      const annualLimit = targetLimit;
      const periodsLeft = pp - cp;
      const perCheck = w / pp;

      if (periodsLeft <= 0) {
        setErrors({
          ...EMPTY_ERR,
          period: "No pay periods remaining — all periods have already passed.",
        });
        return;
      }

      const totalYtdAll = yPre + yRoth;

      // Over-contribution check
      if (rothRequired) {
        const preOver = yPre > LIMITS.standard;
        const combOver = totalYtdAll > annualLimit;

        if (preOver || combOver) {
          const excess = preOver
            ? yPre - LIMITS.standard
            : totalYtdAll - annualLimit;
          const detail = preOver
            ? `Your pre-tax contributions (${fc(yPre)}) exceed the ${fc(
                LIMITS.standard
              )} base limit.`
            : null;

          setResult({
            overContrib: true,
            annualLimit,
            yPre,
            yRoth,
            totalYtdAll,
            excess,
            catchUpAmt,
            catchUpType,
            detail,
            usingCustomLimit: useCustomLimit && customLimit,
            maxAllowed,
          });
          return;
        }
      } else {
        if (totalYtdAll > annualLimit) {
          setResult({
            overContrib: true,
            annualLimit,
            yPre,
            yRoth,
            totalYtdAll,
            excess: totalYtdAll - annualLimit,
            catchUpAmt,
            catchUpType,
            detail: null,
            usingCustomLimit: useCustomLimit && customLimit,
            maxAllowed,
          });
          return;
        }
      }

      if (rothRequired) {
        // Roth contributions fill catch-up first, then excess goes to base
        const rothToCatchUp = Math.min(yRoth, catchUpAmt);
        const rothToBase = Math.max(yRoth - catchUpAmt, 0);

        let stdRem, cuRem, totRem;

        if (useCustomLimit && customLimit) {
          // With custom limit: just calculate total remaining from custom goal
          const totalYtd = yPre + yRoth;
          totRem = Math.max(annualLimit - totalYtd, 0);

          // For split display purposes, we still need to show stdRem and cuRem
          // but they're constrained by the custom limit
          const catchUpRemaining = Math.max(catchUpAmt - rothToCatchUp, 0);
          const baseRemaining = Math.max(
            LIMITS.standard - yPre - rothToBase,
            0
          );

          // Distribute remaining amount proportionally or prioritize catch-up
          if (totRem <= catchUpRemaining) {
            cuRem = totRem;
            stdRem = 0;
          } else {
            cuRem = catchUpRemaining;
            stdRem = totRem - catchUpRemaining;
          }
        } else {
          // Without custom limit: use IRS maximums
          stdRem = Math.max(LIMITS.standard - yPre - rothToBase, 0);
          cuRem = Math.max(catchUpAmt - rothToCatchUp, 0);
          totRem = stdRem + cuRem;
        }

        if (totRem <= 0) {
          setResult({
            maxed: true,
            annualLimit,
            yPre,
            yRoth,
            catchUpAmt,
            catchUpType,
            fica,
            usingCustomLimit: useCustomLimit && customLimit,
            maxAllowed,
          });
          return;
        }

        // Check if user selected Roth-only strategy
        if (strategy === "roth-only") {
          // For Roth-only: all remaining goes to Roth
          const totalRemaining = stdRem + cuRem;
          const pct = ceilPct(totalRemaining / periodsLeft / perCheck);
          const dpc =
            contribMode === "dollar"
              ? dcaAmount(totalRemaining, periodsLeft)
              : (perCheck * pct) / 100;
          const checks =
            contribMode === "dollar"
              ? periodsNeededDollar(totalRemaining, dpc)
              : checksNeeded(totalRemaining, perCheck, pct);

          setResult({
            maxed: false,
            split: false, // Not split when Roth-only
            annualLimit,
            periodsLeft,
            perCheck,
            yPre,
            yRoth,
            catchUpAmt,
            catchUpType,
            is6063,
            ageOver63,
            fica,
            rem: totalRemaining,
            totYtd: yPre + yRoth,
            pct,
            dpc,
            checks,
            highRate: pct > 50,
            contribMode,
            strategy,
            usingCustomLimit: useCustomLimit && customLimit,
            maxAllowed,
            rothOnlyMode: true,
          });
          return;
        }

        // Standard split calculation (Both strategy)
        const prePct = ceilPct(stdRem / periodsLeft / perCheck);
        const rPct = ceilPct(cuRem / periodsLeft / perCheck);
        const preDpc =
          contribMode === "dollar"
            ? dcaAmount(stdRem, periodsLeft)
            : (perCheck * prePct) / 100;
        const rDpc =
          contribMode === "dollar"
            ? dcaAmount(cuRem, periodsLeft)
            : (perCheck * rPct) / 100;
        const preChecks =
          contribMode === "dollar"
            ? periodsNeededDollar(stdRem, preDpc)
            : checksNeeded(stdRem, perCheck, prePct);
        const rChecks =
          contribMode === "dollar"
            ? periodsNeededDollar(cuRem, rDpc)
            : checksNeeded(cuRem, perCheck, rPct);

        setResult({
          maxed: false,
          split: true,
          annualLimit,
          periodsLeft,
          perCheck,
          yPre,
          yRoth,
          catchUpAmt,
          catchUpType,
          is6063,
          ageOver63,
          fica,
          stdRem,
          cuRem,
          totRem,
          prePct,
          rPct,
          preDpc,
          rDpc,
          preChecks,
          rChecks,
          totPct: prePct + rPct,
          highRate: prePct + rPct > 50,
          contribMode,
          strategy,
          usingCustomLimit: useCustomLimit && customLimit,
          maxAllowed,
        });
      } else {
        // NEW: Handle strategy for non-Roth-required scenarios
        const totYtd = yPre + yRoth;
        const rem = Math.max(annualLimit - totYtd, 0);
        if (rem <= 0) {
          setResult({
            maxed: true,
            annualLimit,
            yPre,
            yRoth,
            catchUpAmt,
            catchUpType,
            fica,
            strategy,
            usingCustomLimit: useCustomLimit && customLimit,
            maxAllowed,
          });
          return;
        }

        // Calculate based on strategy
        let resultData = {
          maxed: false,
          split: false,
          annualLimit,
          rem,
          periodsLeft,
          perCheck,
          yPre,
          yRoth,
          totYtd,
          catchUpAmt,
          catchUpType,
          is6063,
          ageOver63,
          fica,
          contribMode,
          strategy,
          usingCustomLimit: useCustomLimit && customLimit,
          maxAllowed,
        };

        if (strategy === "roth-only") {
          // All remaining goes to Roth
          const pct = ceilPct(rem / periodsLeft / perCheck);
          const dpc =
            contribMode === "dollar"
              ? dcaAmount(rem, periodsLeft)
              : (perCheck * pct) / 100;
          const checks =
            contribMode === "dollar"
              ? periodsNeededDollar(rem, dpc)
              : checksNeeded(rem, perCheck, pct);

          resultData = {
            ...resultData,
            pct,
            dpc,
            checks,
            highRate: pct > 50,
            rothOnlyMode: true,
          };
        } else {
          // Standard flexible calculation
          const pct = ceilPct(rem / periodsLeft / perCheck);
          const dpc =
            contribMode === "dollar"
              ? dcaAmount(rem, periodsLeft)
              : (perCheck * pct) / 100;
          const checks =
            contribMode === "dollar"
              ? periodsNeededDollar(rem, dpc)
              : checksNeeded(rem, perCheck, pct);

          resultData = {
            ...resultData,
            pct,
            dpc,
            checks,
            highRate: pct > 50,
          };
        }

        setResult(resultData);
      }
    }, 650);
  }

  function clearAll() {
    setSalary("");
    setAge("");
    setPayPeriods("26");
    setCurPeriod("");
    setYtdPre("");
    setYtdRoth("");
    setFica(null);
    setContribMode("pct");
    setStrategy("flexible");
    setUseCustomLimit(false);
    setCustomLimit("");
    setResult(null);
    setErrors(EMPTY_ERR);
    setCalculated(false);
    setIsDirty(false);
    setIsCalculating(false);
  }

  // Detect if we're on mobile
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
          /* Remove number input spinners */
          input[type=number]::-webkit-inner-spin-button,
          input[type=number]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type=number] {
            -moz-appearance: textfield;
            appearance: textfield;
          }
          
          /* Details arrow rotation */
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

      {/* ── Header ── */}
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
          {PLAN_YEAR} Contribution Limit Assistant
        </h1>
      </div>

      {/* ── Body: responsive layout ── */}
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
        {/* ── LEFT: Inputs ── */}
        <div
          style={{
            background: T.surface,
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
            {/* Salary + Age */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 10,
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
                <Label tooltip="Your age as of December 31. If you're 50 or older, you're eligible for additional catch-up contributions.">
                  Age
                </Label>
                <Input
                  value={age}
                  onChange={(v) => {
                    setAge(v);
                    markDirty();
                  }}
                  placeholder=""
                  type="number"
                  min={18}
                  max={100}
                  err={errors.age}
                  inputRef={ageRef}
                  integersOnly={true}
                />
                <FieldErr msg={errors.age} />
              </div>
            </div>

            {/* FICA — 50+ only AND salary high enough to possibly exceed $150k FICA */}
            {catchUpAge && parse(salary) >= FICA_CATCHUP_THRESHOLD && (
              <div style={{ marginBottom: 10 }}>
                <Label
                  tooltip="Your prior-year FICA wages determine whether catch-up contributions must be Roth. Find this on your W-2 Box 3."
                >
                  Were your {PLAN_YEAR - 1} FICA wages more than{" "}
                  {FICA_THRESHOLD_DISPLAY}?
                </Label>
                <TogglePair
                  options={[
                    {
                      label: `Yes — more than ${FICA_THRESHOLD_DISPLAY}`,
                      val: true,
                    },
                    {
                      label: `No — ${FICA_THRESHOLD_DISPLAY} or less`,
                      val: false,
                    },
                  ]}
                  value={fica}
                  onChange={(v) => {
                    setFica(v);
                    setErrors((e) => ({ ...e, fica: "" }));
                    markDirty();
                  }}
                  err={!!errors.fica}
                />
                <FieldErr msg={errors.fica} />
              </div>
            )}

            {/* Pay frequency + periods */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 10,
              }}
              className="mobile-stack"
            >
              <div>
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
              <div>
                <Label
                  tooltip={`How many paychecks you've already received this year. Based on today's date, you've likely completed ~${estimatedPeriodsCompleted} pay period${
                    estimatedPeriodsCompleted !== 1 ? "s" : ""
                  }.`}
                >
                  Periods Completed
                </Label>
                <Input
                  value={curPeriod}
                  onChange={(v) => {
                    setCurPeriod(v);
                    markDirty();
                  }}
                  placeholder=""
                  type="number"
                  min={0}
                  max={parseInt(payPeriods) - 1}
                  err={errors.period}
                  inputRef={periodRef}
                  integersOnly={true}
                />
                <FieldErr msg={errors.period} />
              </div>
            </div>

            {/* YTD contributions */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "14px 0 10px" }}>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textMuted, fontFamily: T.font, whiteSpace: "nowrap" }}>
                Year-to-Date Contributions
              </span>
              <span style={{ fontSize: "14px", lineHeight: 1 }}><InfoTooltip text="Only needed if you've already made contributions this year. Leave blank to calculate based on full annual limits." /></span>
              <div style={{ flex: 1, height: 1, background: T.border }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
                className="mobile-stack"
              >
                <div>
                  <div
                    style={{
                      fontSize: "0.71rem",
                      fontWeight: 600,
                      color: T.textSub,
                      marginBottom: 3,
                      fontFamily: T.font,
                    }}
                  >
                    Pre-Tax (Traditional)
                  </div>
                  <Input
                    value={ytdPre}
                    onChange={(v) => {
                      setYtdPre(v);
                      markDirty();
                    }}
                    placeholder=""
                    prefix="$"
                    type="number"
                    err={errors.ytdPre}
                    inputRef={ytdPreRef}
                  />
                  <FieldErr msg={errors.ytdPre} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.71rem",
                      fontWeight: 600,
                      color: T.textSub,
                      marginBottom: 3,
                      fontFamily: T.font,
                    }}
                  >
                    Roth (After-Tax)
                  </div>
                  <Input
                    value={ytdRoth}
                    onChange={(v) => {
                      setYtdRoth(v);
                      markDirty();
                    }}
                    placeholder=""
                    prefix="$"
                    type="number"
                    err={errors.ytdRoth}
                    inputRef={ytdRothRef}
                  />
                  <FieldErr msg={errors.ytdRoth} />
                </div>
              </div>
            </div>

            {/* Contribution Strategy - Different labels based on age */}
            {catchUpAge ? (
              <div style={{ marginBottom: 10 }}>
                <Label
                  tooltip={
                    fica === true
                      ? "Catch-up must be Roth since your FICA wages exceeded $150,000. Base contributions can still be any mix."
                      : fica === false
                      ? "Your FICA wages were $150,000 or less — you have full flexibility for both base and catch-up contributions."
                      : "If your FICA wages exceeded $150,000, catch-up must be Roth. Base contributions can always be any mix."
                  }
                >
                  How do you want to contribute?
                </Label>
                <TogglePair
                  options={[
                    { label: "Pre-Tax / Roth Catch-Up", val: "flexible" },
                    { label: "All Roth", val: "roth-only" },
                  ]}
                  value={strategy}
                  onChange={(v) => {
                    setStrategy(v);
                    markDirty();
                  }}
                />
              </div>
            ) : (
              <div style={{ marginBottom: 10 }}>
                <Label tooltip="Pre-Tax reduces taxable income now. Roth contributions are after-tax but grow tax-free.">
                  How do you want to contribute?
                </Label>
                <TogglePair
                  options={[
                    { label: "Pre-Tax (Traditional)", val: "flexible" },
                    { label: "Roth (After-Tax)", val: "roth-only" },
                  ]}
                  value={strategy}
                  onChange={(v) => {
                    setStrategy(v);
                    markDirty();
                  }}
                />
              </div>
            )}

            {/* Contribution Goal */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "14px 0 10px" }}>
              <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textMuted, fontFamily: T.font, whiteSpace: "nowrap" }}>
                Contribution Goal
              </span>
              <span style={{ fontSize: "14px", lineHeight: 1 }}><InfoTooltip text="Leave blank to calculate to the IRS maximum. Only use this if you want to contribute less than the maximum allowed." /></span>
              <div style={{ flex: 1, height: 1, background: T.border }} />
            </div>
            <button
              type="button"
              onClick={() => {
                setUseCustomLimit(v => {
                  if (v) { setCustomLimit(""); setErrors((prev) => ({ ...prev, customLimit: "" })); }
                  markDirty();
                  return !v;
                });
              }}
              style={{
                width: "100%", boxSizing: "border-box", padding: "9px 12px",
                fontSize: "0.875rem", fontFamily: T.font,
                color: useCustomLimit ? T.btn : T.text,
                fontWeight: useCustomLimit ? 600 : 400,
                background: useCustomLimit ? T.btnLight : T.surface,
                border: `1.5px solid ${useCustomLimit ? T.btn : T.border}`,
                borderRadius: T.radius, outline: "none", cursor: "pointer",
                textAlign: "left", display: "flex", alignItems: "center",
                justifyContent: "space-between", transition: "all 0.15s",
                boxShadow: useCustomLimit ? `0 0 0 3px ${T.btnLight}` : "none",
              }}
              onMouseEnter={(e) => { if (!useCustomLimit) e.currentTarget.style.background = T.surfaceAlt; }}
              onMouseLeave={(e) => { if (!useCustomLimit) e.currentTarget.style.background = T.surface; }}
            >
              <span>Set a target</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                style={{ flexShrink: 0, transform: useCustomLimit ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                <path d="M2 4l4 4 4-4" stroke={useCustomLimit ? T.btn : T.textSub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {useCustomLimit && (
              <div style={{ marginTop: 8, marginBottom: 4 }}>
                <Label tooltip="Enter your total annual contribution goal. Cannot exceed the IRS maximum for your age.">
                  Target annual contribution
                </Label>
                <Input
                  value={customLimit}
                  onChange={(v) => { setCustomLimit(v); setErrors((prev) => ({ ...prev, customLimit: "" })); markDirty(); }}
                  placeholder=""
                  prefix="$"
                  type="number"
                  err={errors.customLimit}
                  inputRef={customLimitRef}
                />
                <FieldErr msg={errors.customLimit} />
                <div style={{ fontSize: "0.67rem", color: T.textMuted, marginTop: 2, fontFamily: T.font, lineHeight: 1.3 }}>
                  Maximum allowed: {fc(LIMITS.standard + getCatchUp(parsedAge))}
                </div>
              </div>
            )}

            {/* Election type */}
            <div style={{ marginBottom: 10, marginTop: 14 }}>
              <Label tooltip="Check your plan's enrollment portal or ask HR if you're not sure.">
                How does your plan accept elections?
              </Label>
              <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                {[
                  { label: "Percentage (%)", val: "pct" },
                  { label: "Dollar amount ($)", val: "dollar" },
                ].map((opt) => {
                  const sel = contribMode === opt.val;
                  return (
                    <button
                      key={opt.val}
                      onClick={() => { setContribMode(opt.val); markDirty(); }}
                      style={{
                        flex: 1, padding: "8px 8px", cursor: "pointer",
                        fontSize: "0.8rem", fontWeight: sel ? 600 : 400, fontFamily: T.font,
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
        <div
          ref={resultRef}
          style={{
            background: T.surface,
            borderRadius: T.radiusLg,
            border: `1px solid ${T.border}`,
            boxShadow: T.shadowMd,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {result && result.overContrib && !isDirty && (
            <div style={{ padding: "8px 16px 0" }}>
              <Badge color={T.red} bg={T.redLight}>Over-Contribution</Badge>
            </div>
          )}

          <div
            style={{
              overflowY: (isMobile || !result) ? "hidden" : "auto",
              padding: "14px 16px",
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
                      <path d="M20 11A8 8 0 1 0 4.93 17" stroke={T.btn} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M20 7v4h-4" stroke={T.btn} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
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
            ) : result.overContrib ? (
              <div>
                <div
                  style={{
                    background: T.redLight,
                    border: `1px solid ${T.red}44`,
                    borderRadius: T.radius,
                    padding: "14px",
                    marginBottom: 12,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "1.6rem", marginBottom: 6 }}>⚠️</div>
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: 800,
                      color: T.red,
                      letterSpacing: "-0.02em",
                      marginBottom: 5,
                      fontFamily: T.font,
                    }}
                  >
                    Possible Over-Contribution
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "#7f1d1d",
                      lineHeight: 1.6,
                      fontFamily: T.font,
                    }}
                  >
                    Your combined YTD contributions of{" "}
                    <strong>{fc(result.totalYtdAll)}</strong> appear to exceed
                    your {PLAN_YEAR}{" "}
                    {result.usingCustomLimit ? "goal" : "annual limit"} of{" "}
                    <strong>{fc(result.annualLimit)}</strong> by{" "}
                    <strong>{fc(result.excess)}</strong>.
                    {result.detail && (
                      <>
                        <br />
                        <br />
                        {result.detail}
                      </>
                    )}
                  </div>
                </div>
                {result.usingCustomLimit && (
                  <NoteBox color="#1E40AF" bg="#F0F9FF" border="#BFDBFE">
                    <strong>Custom goal in use:</strong> You've set a custom
                    contribution goal of {fc(result.annualLimit)}. The IRS
                    maximum for your age is {fc(result.maxAllowed)}.
                  </NoteBox>
                )}
                <div
                  style={{
                    background: "#FFF7ED",
                    border: "1px solid #FDBA74",
                    borderRadius: T.radius,
                    padding: "10px 12px",
                    fontSize: "0.78rem",
                    color: "#7c2d12",
                    lineHeight: 1.6,
                    fontFamily: T.font,
                    marginTop: 12,
                  }}
                >
                  <strong>Action required:</strong> Over-contributions must be
                  corrected by your tax filing deadline to avoid a 6% IRS excise
                  tax penalty. Contact your plan administrator as soon as
                  possible to request a return of excess contributions.
                </div>
                <Divider label="Limit Summary" />
                <SummaryLine
                  label={`${PLAN_YEAR} ${
                    result.usingCustomLimit ? "Your Goal" : "Annual Limit"
                  }`}
                  value={fc(result.annualLimit)}
                  bold
                />
                {result.usingCustomLimit && (
                  <SummaryLine
                    label="IRS Maximum for Your Age"
                    value={fc(result.maxAllowed)}
                    indent
                    dimmed
                  />
                )}
                {!result.usingCustomLimit && (
                  <>
                    <SummaryLine
                      label="Base Limit"
                      value={fc(LIMITS.standard)}
                      indent
                      dimmed
                    />
                    {result.catchUpAmt > 0 && (
                      <SummaryLine
                        label={`Catch-Up — ${result.catchUpType}`}
                        value={fc(result.catchUpAmt)}
                        indent
                        dimmed
                      />
                    )}
                  </>
                )}
                <SummaryLine
                  label="Pre-Tax Contributed (YTD)"
                  value={fc(result.yPre)}
                  bold={false}
                  dimmed={result.yPre === 0}
                />
                <SummaryLine
                  label="Roth Contributed (YTD)"
                  value={fc(result.yRoth)}
                  bold={false}
                  dimmed={result.yRoth === 0}
                />
                <SummaryLine
                  label="Total Contributed (YTD)"
                  value={fc(result.totalYtdAll)}
                  bold
                  color={T.red}
                />
                <SummaryLine
                  label="Excess Amount"
                  value={fc(result.excess)}
                  bold
                  color={T.red}
                />
              </div>
            ) : result.maxed ? (
              <div>
                <div style={{ textAlign: "center", padding: "16px 0 12px" }}>
                  <div style={{ fontSize: "2rem", marginBottom: 6 }}>🎉</div>
                  <div
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 800,
                      color: "#1E293B",
                      letterSpacing: "-0.02em",
                      marginBottom: 5,
                    }}
                  >
                    {result.usingCustomLimit ? "Goal Reached" : "Limit Reached"}
                  </div>
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: T.textSub,
                      lineHeight: 1.55,
                    }}
                  >
                    Your YTD contributions of{" "}
                    <strong>{fc(result.yPre + result.yRoth)}</strong> have
                    reached your {PLAN_YEAR}{" "}
                    {result.usingCustomLimit ? "goal" : "limit"} of{" "}
                    <strong>{fc(result.annualLimit)}</strong>.
                  </div>
                </div>
                {result.usingCustomLimit && (
                  <NoteBox color="#1E40AF" bg="#F0F9FF" border="#BFDBFE">
                    <strong>Custom goal in use:</strong> You've reached your
                    custom contribution goal of {fc(result.annualLimit)}. The
                    IRS maximum for your age is {fc(result.maxAllowed)}, so you
                    could contribute{" "}
                    {fc(result.maxAllowed - result.annualLimit)} more if
                    desired.
                  </NoteBox>
                )}
                <Divider label="Limit Summary" />
                <SummaryLine
                  label={result.usingCustomLimit ? "Your Goal" : "Annual Limit"}
                  value={fc(result.annualLimit)}
                  bold
                />
                <SummaryLine
                  label="Total Contributed"
                  value={fc(result.yPre + result.yRoth)}
                  bold
                />
                <SummaryLine label="Remaining" value={fc(0)} bold />

                {/* Collapsible Details */}
                <details
                  style={{
                    background: "#F9FAFB",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    padding: "12px",
                    marginTop: 12,
                  }}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: "#1F2937",
                      padding: "8px 0",
                      userSelect: "none",
                      listStyle: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>View Calculation Details</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      style={{ flexShrink: 0, transition: "transform 0.2s" }}
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
                      marginTop: 8,
                    }}
                  >
                    {result.usingCustomLimit && (
                      <SummaryLine
                        label="IRS Maximum for Your Age"
                        value={fc(result.maxAllowed)}
                        indent
                        dimmed
                      />
                    )}
                    {!result.usingCustomLimit && (
                      <>
                        <SummaryLine
                          label="Base Limit"
                          value={fc(LIMITS.standard)}
                          indent
                          dimmed
                        />
                        {result.catchUpAmt > 0 && (
                          <SummaryLine
                            label={`Catch-Up — ${result.catchUpType}`}
                            value={fc(result.catchUpAmt)}
                            indent
                            dimmed
                          />
                        )}
                      </>
                    )}
                    <SummaryLine
                      label="Pre-Tax (YTD)"
                      value={fc(result.yPre)}
                      indent
                      dimmed
                    />
                    <SummaryLine
                      label="Roth (YTD)"
                      value={fc(result.yRoth)}
                      indent
                      dimmed
                    />
                  </div>
                </details>
              </div>
            ) : result.split ? (
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 12,
                    flexWrap: isMobile ? "wrap" : "nowrap",
                  }}
                >
                  <StatCard
                    label="Pre-Tax Contribution (Traditional)"
                    value={
                      result.contribMode === "dollar"
                        ? fc(ceilDollar(result.preDpc))
                        : `${result.prePct}%`
                    }
                    subLines={
                      result.contribMode === "dollar"
                        ? [
                            `${fc(ceilDollar(result.preDpc))} per paycheck`,
                            `${result.preChecks} paychecks to ${
                              result.usingCustomLimit ? "goal" : "limit"
                            }`,
                          ]
                        : [
                            `${fc(ceilDollar(result.preDpc))} per paycheck`,
                            `${result.preChecks} paychecks to ${
                              result.usingCustomLimit ? "goal" : "limit"
                            }`,
                          ]
                    }
                  />
                  <StatCard
                    label="Roth Catch-Up (After-Tax)"
                    value={
                      result.contribMode === "dollar"
                        ? fc(ceilDollar(result.rDpc))
                        : `${result.rPct}%`
                    }
                    subLines={
                      result.contribMode === "dollar"
                        ? [
                            `${fc(ceilDollar(result.rDpc))} per paycheck`,
                            `${result.rChecks} paychecks to ${
                              result.usingCustomLimit ? "goal" : "limit"
                            }`,
                          ]
                        : [
                            `${fc(ceilDollar(result.rDpc))} per paycheck`,
                            `${result.rChecks} paychecks to ${
                              result.usingCustomLimit ? "goal" : "limit"
                            }`,
                          ]
                    }
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  {result.usingCustomLimit && (
                    <NoteBox color="#1E40AF" bg="#F0F9FF" border="#BFDBFE">
                      <strong>Custom goal in use:</strong> You've set a custom
                      contribution goal of {fc(result.annualLimit)}. The IRS
                      maximum for your age is {fc(result.maxAllowed)}.
                    </NoteBox>
                  )}
                  {result.stdRem === 0 && result.yPre > 0 && (
                    <NoteBox color="#166534" bg="#F0FDF4" border="#BBF7D0">
                      <strong>Pre-tax base limit reached:</strong> You've
                      already contributed {fc(result.yPre)} in pre-tax, which
                      meets the {fc(LIMITS.standard)} base limit. Your remaining{" "}
                      {fc(result.cuRem)} can only go to Roth catch-up
                      contributions.
                    </NoteBox>
                  )}
                  {result.highRate && (
                    <NoteBox color="#78350F" bg="#FFFBEB" border="#FDE68A">
                      <strong>Important — high contribution rate:</strong> The
                      required combined rate of {result.totPct}% is a
                      significant portion of your pay. Confirm your plan allows
                      this election and that your net pay will cover your
                      expenses. Some plans cap deferral elections — check with
                      your plan administrator.
                    </NoteBox>
                  )}
                </div>
                {/* Collapsible Details */}
                <details
                  style={{
                    background: "#F9FAFB",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    padding: "12px",
                    marginTop: 12,
                  }}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: "#1F2937",
                      padding: "8px 0",
                      userSelect: "none",
                      listStyle: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>View Calculation Details</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      style={{ flexShrink: 0, transition: "transform 0.2s" }}
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
                      marginTop: 8,
                    }}
                  >
                    <SummaryLine
                      label={
                        result.usingCustomLimit
                          ? "Your Goal"
                          : "Total Annual Limit"
                      }
                      value={fc(result.annualLimit)}
                      bold
                      color={T.total}
                    />
                    <SummaryLine
                      label="Total Remaining"
                      value={fc(result.totRem)}
                      bold
                    />
                    <Divider />
                    {result.usingCustomLimit && (
                      <SummaryLine
                        label="IRS Maximum for Your Age"
                        value={fc(result.maxAllowed)}
                        indent
                        dimmed
                      />
                    )}
                    {!result.usingCustomLimit && (
                      <>
                        <SummaryLine
                          label="Base — pre-tax and/or Roth"
                          value={fc(LIMITS.standard)}
                          indent
                          dimmed
                        />
                        <SummaryLine
                          label={`Catch-Up (${result.catchUpType}) — Roth required`}
                          value={fc(result.catchUpAmt)}
                          indent
                          dimmed
                        />
                      </>
                    )}
                    <SummaryLine
                      label="Pre-Tax Contributed (YTD)"
                      value={fc(result.yPre)}
                      bold={false}
                      dimmed={result.yPre === 0}
                    />
                    <SummaryLine
                      label="Roth Contributed (YTD)"
                      value={fc(result.yRoth)}
                      bold={false}
                      dimmed={result.yRoth === 0}
                    />
                    <SummaryLine
                      label="Pre-Tax Remaining"
                      value={fc(result.stdRem)}
                      bold
                      dimmed={result.stdRem === 0}
                    />
                    <SummaryLine
                      label="Roth Remaining"
                      value={fc(result.cuRem)}
                      bold
                      dimmed={result.cuRem === 0}
                    />
                  </div>
                </details>

                <ResultNotices result={result} />
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 12,
                    flexWrap: isMobile ? "wrap" : "nowrap",
                  }}
                >
                  <StatCard
                    label={
                      result.rothOnlyMode
                        ? "Roth Contribution (After-Tax)"
                        : "Pre-Tax Contribution (Traditional)"
                    }
                    value={
                      result.contribMode === "dollar"
                        ? fc(ceilDollar(result.dpc))
                        : `${result.pct}%`
                    }
                    subLines={
                      result.contribMode === "dollar"
                        ? [
                            `${fc(ceilDollar(result.dpc))} per paycheck`,
                            `${result.checks} paychecks remaining`,
                          ]
                        : [
                            `${fc(ceilDollar(result.dpc))} per paycheck`,
                            `${result.checks} paychecks remaining`,
                          ]
                    }
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  {result.usingCustomLimit && (
                    <NoteBox color="#1E40AF" bg="#F0F9FF" border="#BFDBFE">
                      <strong>Custom goal in use:</strong> You've set a custom
                      contribution goal of {fc(result.annualLimit)}. The IRS
                      maximum for your age is {fc(result.maxAllowed)}.
                    </NoteBox>
                  )}
                  {result.rothOnlyMode && parse(ytdPre) > 0 && (
                    <NoteBox color="#78350F" bg="#FFFBEB" border="#FDE68A">
                      <strong>Mid-year switch to Roth:</strong> You've
                      contributed {fc(parse(ytdPre))} pre-tax so far this year.
                      Your remaining contributions of {fc(result.rem)} will go
                      entirely to Roth as selected. Combined, you'll reach{" "}
                      {fc(result.annualLimit)} for the year.
                    </NoteBox>
                  )}
                  {result.rothOnlyMode &&
                    parse(ytdPre) === 0 &&
                    !result.fica && (
                      <NoteBox color="#1E40AF" bg="#F0F9FF" border="#BFDBFE">
                        <strong>Roth-only strategy:</strong> All your
                        contributions will go to Roth (after-tax) as selected.
                        You have {fc(result.rem)} remaining to reach your{" "}
                        {result.usingCustomLimit ? "goal" : "limit"} of{" "}
                        {fc(result.annualLimit)}.
                      </NoteBox>
                    )}
                  {result.rothOnlyMode && result.fica === true && (
                    <NoteBox color="#1E40AF" bg="#F0F9FF" border="#BFDBFE">
                      <strong>Roth-only strategy:</strong> All your remaining{" "}
                      {fc(result.rem)} will go to Roth as selected. Note: Since
                      your FICA wages were more than {FICA_THRESHOLD_DISPLAY},
                      your {fc(result.catchUpAmt)} catch-up would have been
                      required to be Roth regardless, but your{" "}
                      {fc(LIMITS.standard)} base is Roth by your choice.
                    </NoteBox>
                  )}
                  {result.highRate && (
                    <NoteBox color="#78350F" bg="#FFFBEB" border="#FDE68A">
                      <strong>Important — high contribution rate:</strong>{" "}
                      Reaching the limit requires a {result.pct}% deferral rate,
                      which is a significant portion of your pay. Confirm your
                      plan allows this election and that your net pay will cover
                      your expenses. Some plans cap deferral elections — check
                      with your plan administrator.
                    </NoteBox>
                  )}
                </div>
                {/* Collapsible Details */}
                <details
                  style={{
                    background: "#F9FAFB",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    padding: "12px",
                    marginTop: 12,
                  }}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: "#1F2937",
                      padding: "8px 0",
                      userSelect: "none",
                      listStyle: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>View Calculation Details</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      style={{ flexShrink: 0, transition: "transform 0.2s" }}
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
                      marginTop: 8,
                    }}
                  >
                    <SummaryLine
                      label={
                        result.usingCustomLimit
                          ? "Your Goal"
                          : "Total Annual Limit"
                      }
                      value={fc(result.annualLimit)}
                      bold
                      color={T.total}
                    />
                    <SummaryLine
                      label="Total Remaining"
                      value={fc(result.rem)}
                      bold
                    />
                    <Divider />
                    {result.usingCustomLimit && (
                      <SummaryLine
                        label="IRS Maximum for Your Age"
                        value={fc(result.maxAllowed)}
                        indent
                        dimmed
                      />
                    )}
                    {!result.usingCustomLimit && (
                      <>
                        <SummaryLine
                          label="Base Limit"
                          value={fc(LIMITS.standard)}
                          indent
                          dimmed
                        />
                        {result.catchUpAmt > 0 && (
                          <SummaryLine
                            label={`Catch-Up — ${result.catchUpType}`}
                            value={fc(result.catchUpAmt)}
                            indent
                            dimmed
                          />
                        )}
                      </>
                    )}
                    <SummaryLine
                      label="Pre-Tax Contributed (YTD)"
                      value={fc(result.yPre)}
                      bold={false}
                      dimmed={result.yPre === 0}
                    />
                    <SummaryLine
                      label="Roth Contributed (YTD)"
                      value={fc(result.yRoth)}
                      bold={false}
                      dimmed={result.yRoth === 0}
                    />
                    <SummaryLine
                      label="Total Contributed (YTD)"
                      value={fc(result.totYtd)}
                      bold
                    />
                  </div>
                </details>

                <ResultNotices result={result} />
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
              {result?.contribMode === "dollar"
                ? "Dollar amounts rounded up to nearest whole dollar."
                : "Rates rounded up to nearest whole %."}{" "}
              Based on {PLAN_YEAR} IRS limits. For educational use only — not
              financial or tax advice. Consult your plan administrator or a tax
              professional for guidance specific to your situation.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
