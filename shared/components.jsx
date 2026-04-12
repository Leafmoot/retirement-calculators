// ── Shared UI Components ──────────────────────────────────────────────────────
// Import what you need in each calculator:
// import { Label, Input, TogglePair, Divider, SummaryLine, NoteBox, EmptyResults } from "../../shared/components";

import { useState, useRef, useEffect } from "react";
import { T } from "./theme";

// ── Formatting helpers ────────────────────────────────────────────────────────
export function fc(val, decimals = 0) {
  return val.toLocaleString("en-US", {
    style: "currency", currency: "USD",
    maximumFractionDigits: decimals, minimumFractionDigits: decimals,
  });
}

export function parse(str) {
  const v = parseFloat((str || "").replace(/,/g, ""));
  return isNaN(v) ? 0 : v;
}

export function ceilPct(val) { return Math.ceil(val * 100); }
export function ceilDollar(val) { return Math.ceil(val); }

export function ordinalSup(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return <>{n}<sup style={{ fontSize: "0.6em", verticalAlign: "super", lineHeight: 0 }}>{s[(v - 20) % 10] || s[v] || s[0]}</sup></>;
}

// ── InfoTooltip ───────────────────────────────────────────────────────────────
export function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const buttonRef = useRef(null);
  const tooltipRef = useRef(null);
  const [pos, setPos] = useState({ top: true, left: "center" });

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    if (show && !isMobile && buttonRef.current && tooltipRef.current) {
      const br = buttonRef.current.getBoundingClientRect();
      const tr = tooltipRef.current.getBoundingClientRect();
      setPos({
        top: br.top - tr.height - 8 > 10,
        left: br.left - tr.width / 2 < 10 ? false
          : br.left + tr.width / 2 > window.innerWidth - 10 ? true
          : "center",
      });
    }
  }, [show, isMobile]);

  const ts = () => {
    if (isMobile) return { left: "50%", top: "50%", transform: "translate(-50%,-50%)" };
    const s = { position: "absolute", zIndex: 999 };
    if (pos.top) s.bottom = "calc(100% + 8px)"; else s.top = "calc(100% + 8px)";
    if (pos.left === "center") { s.left = "50%"; s.transform = "translateX(-50%)"; }
    else if (pos.left === false) s.left = "0"; else s.right = "0";
    return s;
  };

  return (
    <div style={{ position: "relative", display: "inline-block", marginLeft: 4 }}>
      <button type="button" ref={buttonRef}
        onMouseEnter={() => !isMobile && setShow(true)}
        onMouseLeave={() => !isMobile && setShow(false)}
        onClick={() => isMobile && setShow(!show)}
        style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", width: 16, height: 16 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke={T.textMuted} strokeWidth="1.2" />
          <path d="M7 6v3.5M7 4.5v.5" stroke={T.textMuted} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      {show && (
        <>
          {isMobile && <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setShow(false)} />}
          <div ref={tooltipRef} style={{
            position: isMobile ? "fixed" : "absolute", zIndex: 999,
            background: T.text, color: T.surface, padding: "8px 10px",
            borderRadius: T.radius, fontSize: "0.72rem", fontFamily: T.font,
            lineHeight: 1.5, width: isMobile ? "calc(100vw - 48px)" : "220px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)", ...ts(),
          }}>{text}</div>
        </>
      )}
    </div>
  );
}

// ── Label ─────────────────────────────────────────────────────────────────────
export function Label({ children, tooltip }) {
  return (
    <div style={{ marginBottom: 4, minHeight: 20, display: "flex", alignItems: "center" }}>
      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: T.text, fontFamily: T.font, letterSpacing: "-0.01em" }}>
        {children}{tooltip && <InfoTooltip text={tooltip} />}
      </span>
    </div>
  );
}

// ── FieldErr ──────────────────────────────────────────────────────────────────
export function FieldErr({ msg }) {
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

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ value, onChange, placeholder, type = "text", prefix, suffix, err, inputRef, integersOnly = false }) {
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

// ── NativeSelect ──────────────────────────────────────────────────────────────
export function NativeSelect({ value, onChange, options }) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box", padding: "9px 32px 9px 12px",
          fontSize: "0.875rem", fontFamily: T.font, color: T.text,
          background: T.surface, border: `1.5px solid ${T.border}`,
          borderRadius: T.radius, outline: "none", cursor: "pointer",
          appearance: "none", WebkitAppearance: "none",
        }}
        onFocus={(e) => (e.target.style.boxShadow = `0 0 0 3px #F59E0B33`)}
        onBlur={(e) => (e.target.style.boxShadow = "none")}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
        <path d="M2 4l4 4 4-4" stroke={T.textSub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── TogglePair ────────────────────────────────────────────────────────────────
export function TogglePair({ options, value, onChange, small = false, err = false }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {options.map((opt) => {
        const sel = value === opt.val;
        return (
          <button key={String(opt.val)} onClick={() => onChange(opt.val)} style={{
            flex: 1, padding: small ? "6px 8px" : "9px 8px", cursor: "pointer",
            fontSize: small ? "0.75rem" : "0.8rem", fontWeight: sel ? 600 : 400, fontFamily: T.font,
            border: `1.5px solid ${sel ? T.btn : err ? T.red : T.border}`,
            borderRadius: T.radius,
            background: sel ? T.btnLight : err ? T.redLight : T.surface,
            color: sel ? T.btn : err ? T.red : T.textSub,
            transition: "all 0.15s", lineHeight: 1.4,
          }}>{opt.label}</button>
        );
      })}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 10px" }}>
      {label && <span style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textMuted, fontFamily: T.font, whiteSpace: "nowrap" }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  );
}

// ── SummaryLine ───────────────────────────────────────────────────────────────
export function SummaryLine({ label, value, color, bold, indent, dimmed }) {
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

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, subLines }) {
  return (
    <div style={{
      background: "#FFFFFF", borderRadius: "8px", border: "1px solid #E5E7EB",
      padding: "20px 24px", flex: 1, minWidth: 0, overflow: "hidden",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)",
    }} className="mobile-padding-sm print-break-avoid">
      <div style={{ width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748B", fontFamily: T.font, marginBottom: 12 }}>
          {label}
        </div>
        <div style={{ fontSize: "2.5rem", fontWeight: 500, color: "#1E293B", lineHeight: 1, fontFamily: T.font, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", marginBottom: 8 }} className="mobile-text-sm">
          {value}
        </div>
        {subLines && subLines.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {subLines.map((line, i) => (
              <div key={i} style={{ fontSize: "0.8rem", color: "#64748B", fontFamily: T.font, lineHeight: 1.5 }}>
                {typeof line === "string" ? line : line.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── NoteBox ───────────────────────────────────────────────────────────────────
export function NoteBox({ color, bg, border, children }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: T.radius, padding: "10px 12px", fontSize: "0.78rem", color, lineHeight: 1.55, fontFamily: T.font }}>
      {children}
    </div>
  );
}

// ── EmptyResults ──────────────────────────────────────────────────────────────
// Pass a custom title and description per calculator
export function EmptyResults({ isCalculating, title = "Calculate Your Results", description = "Enter your information to get started." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 180, padding: 16 }}>
      <div style={{ background: T.surface, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.07)", padding: "20px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, maxWidth: 300 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.btnLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="12" width="4" height="10" rx="1" fill={T.btn} opacity="0.5"
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar1 0.9s ease-in-out infinite" } : {}} />
            <rect x="9" y="7" width="4" height="15" rx="1" fill={T.btn} opacity="0.75"
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar2 0.9s ease-in-out infinite 0.15s" } : {}} />
            <rect x="16" y="3" width="4" height="19" rx="1" fill={T.btn}
              style={isCalculating ? { transformOrigin: "center bottom", animation: "bar3 0.9s ease-in-out infinite 0.3s" } : {}} />
          </svg>
        </div>
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: T.text, fontFamily: T.font, textAlign: "center" }}>
          {isCalculating ? "Calculating…" : title}
        </div>
        {!isCalculating && (
          <div style={{ fontSize: "0.78rem", color: T.textSub, fontFamily: T.font, textAlign: "center", lineHeight: 1.55 }}>
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

// ── DirtyOverlay ──────────────────────────────────────────────────────────────
// Drop inside the results panel outer div (position: relative) to show the
// "your information has changed" card when isDirty && result
export function DirtyOverlay() {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(249,247,244,0.75)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: T.radiusLg }}>
      <div style={{ background: T.surface, borderRadius: T.radiusLg, border: `1px solid ${T.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", padding: "28px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: 260 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.btnLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
  );
}

// ── Global CSS string ─────────────────────────────────────────────────────────
// Paste into a <style> tag at the top of each calculator's render
export const GLOBAL_CSS = `
  input::-webkit-inner-spin-button,
  input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; appearance: textfield; }
  details[open] .details-arrow { transform: rotate(180deg); }
  select { -webkit-appearance: none; appearance: none; }
  @keyframes bar1 { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(0.4)} }
  @keyframes bar2 { 0%,100%{transform:scaleY(1)} 33%{transform:scaleY(1.25)} 66%{transform:scaleY(0.6)} }
  @keyframes bar3 { 0%,100%{transform:scaleY(1)} 25%{transform:scaleY(0.5)} 75%{transform:scaleY(1.2)} }
  @keyframes fieldShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
  .field-shake { animation: fieldShake 0.35s ease-in-out; }
  @media(max-width:640px) {
    .mobile-stack { grid-template-columns: 1fr !important; }
    .mobile-text-sm { font-size: 1.6rem !important; }
    .mobile-padding-sm { padding: 16px 18px !important; }
  }
`;

// ── GOOGLE_FONTS_URL ──────────────────────────────────────────────────────────
export const GOOGLE_FONTS_URL = "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap";
