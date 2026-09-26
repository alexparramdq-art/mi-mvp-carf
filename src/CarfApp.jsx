import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { LOGO_PLACEHOLDER, MVP_LOGO_B64, MVP_FULL_LOGO_B64 } from "./assets.js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const c = {
  bg: "#0A0A0A",
  card: "#161616",
  card2: "#1D1D1D",
  cardEdge: "rgba(255,255,255,0.08)",
  text: "#F5F5F0",
  textDim: "rgba(245,245,240,0.55)",
  yellow: "#FFE500",
  red: "#E30613",
  celeste: "#6DCFF6",
  orange: "#F7941D",
  white: "#FFFFFF",
  correct: "#3FA34D",
  failed: "#E30613",
};

const NUM_INTENTOS = 10;
const emptyAttempts = () => Array(NUM_INTENTOS).fill("pending");
const countStates = (states) => ({
  correct: states.filter((s) => s === "correct").length,
  failed: states.filter((s) => s === "failed").length,
});
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayISO = () => new Date().toISOString().slice(0, 10);

// ---------- storage helpers (conectadas a Supabase, backend real) ----------
async function loadPlayers() {
  try {
    const { data, error } = await supabase.from("players").select("id, data").order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map((row) => ({ ...row.data, id: row.id }));
  } catch (e) {
    console.error("error cargando jugadores", e);
    return [];
  }
}
async function savePlayers(players, ownerId) {
  try {
    const rows = players.map(({ id, ...rest }) => ({ id, owner_id: ownerId, data: rest }));
    const { error } = await supabase.from("players").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  } catch (e) {
    console.error("error guardando jugadores", e);
  }
}
async function deletePlayer(playerId) {
  const { data, error } = await supabase.from("players").delete().eq("id", playerId).select("id");
  if (error) {
    console.error("error borrando jugador", error);
    throw error;
  }
  if (!data || data.length === 0) {
    // La base de datos no rechazó el pedido con un error, pero tampoco
    // borró ninguna fila (suele pasar si la sesión venció o no hay
    // permiso). Avisamos en vez de dar por hecho que funcionó.
    throw new Error("No se pudo eliminar (probá cerrar sesión y volver a entrar).");
  }
}
async function loadEntries(playerId) {
  try {
    const { data, error } = await supabase
      .from("entries")
      .select("id, payload")
      .eq("player_id", playerId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map((row) => row.payload);
  } catch (e) {
    console.error("error cargando entradas", e);
    return [];
  }
}
async function saveEntries(playerId, entries, createdBy) {
  const last = entries[entries.length - 1];
  if (!last) return;
  const { error } = await supabase
    .from("entries")
    .upsert({ id: last.id, player_id: playerId, created_by: createdBy, type: last.tipo, payload: last }, { onConflict: "id" });
  if (error) {
    console.error("error guardando entradas", error);
    throw error;
  }
}

// Sólo el entrenador puede ver esto (lo permite la RLS de profiles).
async function loadFamilias() {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, subscription_status")
      .eq("role", "padre")
      .order("full_name", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("error cargando familias", e);
    return [];
  }
}
async function setFamiliaSubscription(profileId, status) {
  const { error } = await supabase.from("profiles").update({ subscription_status: status }).eq("id", profileId);
  if (error) throw error;
}

// ---------- UI primitives ----------
function Logo({ size = 90, variant = "mvp" }) {
  if (variant === "carf") {
    return (
      <img
        src={LOGO_PLACEHOLDER}
        alt="C.A.R.F."
        style={{ width: size, height: "auto", display: "block", margin: "0 auto" }}
      />
    );
  }
  // logo completo de Mi MVP (wordmark + corredor + tagline) — el ícono
  // cuadrado (MVP_LOGO_B64) queda reservado solo para el ícono del
  // teléfono, no se usa dentro de la app
  return (
    <img
      src={MVP_FULL_LOGO_B64}
      alt="Mi MVP — Seguimiento. Análisis. Rendimiento. by C.A.R.F."
      style={{ width: size, height: "auto", display: "block", margin: "0 auto" }}
    />
  );
}

function Chip({ label, active, accent, onClick, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? "Reservado para el entrenador" : undefined}
      style={{
        border: `1.5px solid ${active ? accent : "rgba(255,255,255,0.18)"}`,
        background: active ? accent : "transparent",
        color: disabled ? "rgba(245,245,240,0.35)" : active ? "#0A0A0A" : c.text,
        fontWeight: active ? 700 : 500,
        fontSize: 13,
        borderRadius: 20,
        padding: "6px 13px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        background: c.card,
        border: `1px solid ${c.cardEdge}`,
        borderRadius: 8,
        color: c.text,
        fontSize: 13.5,
        padding: "9px 11px",
        outline: "none",
        boxSizing: "border-box",
        ...(props.style || {}),
      }}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        background: c.card,
        border: `1px solid ${c.cardEdge}`,
        borderRadius: 8,
        color: c.text,
        fontSize: 13,
        padding: "9px 11px",
        outline: "none",
        resize: "none",
        boxSizing: "border-box",
        fontFamily: "inherit",
        ...(props.style || {}),
      }}
    />
  );
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 11, color: c.textDim, marginBottom: 5 }}>{children}</div>;
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 12, letterSpacing: 0.4, color: c.yellow, fontWeight: 700, marginTop: 18, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function TopBar({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      {onBack && (
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: `1px solid ${c.cardEdge}`,
            color: c.text,
            borderRadius: 8,
            fontSize: 14,
            padding: "5px 10px",
            cursor: "pointer",
          }}
        >
          ←
        </button>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{title}</div>
    </div>
  );
}

function PrimaryButton({ children, onClick, saved, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: "100%",
        background: saved ? c.correct : c.yellow,
        border: "none",
        borderRadius: 10,
        color: "#0A0A0A",
        fontSize: 14.5,
        fontWeight: 800,
        padding: "13px 0",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        marginTop: 20,
      }}
    >
      {children}
    </button>
  );
}

function MiniCount({ correct, failed }) {
  const marked = correct + failed;
  if (marked === 0) return null;
  const pct = Math.round((correct / marked) * 100);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
      {correct > 0 && <span style={{ fontSize: 11, color: c.correct, fontWeight: 700 }}>{correct}✓</span>}
      {failed > 0 && <span style={{ fontSize: 11, color: c.failed, fontWeight: 700 }}>{failed}✗</span>}
      <span style={{ fontSize: 11, color: c.yellow, fontWeight: 700 }}>{pct}%</span>
    </span>
  );
}

// círculos: clic = verde/vacío · doble clic = rojo
function AttemptDots({ states, onSetState }) {
  return (
    <div style={{ display: "flex", width: "100%", gap: 3 }}>
      {states.map((s, i) => {
        const fill = s === "correct" ? c.correct : s === "failed" ? c.failed : "transparent";
        const border = s === "pending" ? "rgba(255,255,255,0.35)" : fill;
        const pattern = s === "pending" ? "rgba(255,255,255,0.4)" : "#0A0A0A";
        return (
          <button
            key={i}
            onClick={() => onSetState(i, s === "correct" ? "pending" : "correct")}
            onDoubleClick={(e) => {
              e.preventDefault();
              onSetState(i, "failed");
            }}
            style={{
              flex: 1,
              aspectRatio: "1 / 1",
              maxHeight: 18,
              minWidth: 0,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <svg viewBox="0 0 24 24" width="100%" height="100%" style={{ display: "block" }}>
              <circle cx="12" cy="12" r="10.5" fill={fill} stroke={border} strokeWidth="1.5" />
              <polygon points="12,5.8 17.9,10.08 15.64,17.02 8.36,17.02 6.1,10.08" fill={pattern} />
              <line x1="12" y1="5.8" x2="12" y2="1.7" stroke={pattern} strokeWidth="1.2" />
              <line x1="17.9" y1="10.08" x2="21.79" y2="8.82" stroke={pattern} strokeWidth="1.2" />
              <line x1="15.64" y1="17.02" x2="18.06" y2="20.33" stroke={pattern} strokeWidth="1.2" />
              <line x1="8.36" y1="17.02" x2="5.94" y2="20.33" stroke={pattern} strokeWidth="1.2" />
              <line x1="6.1" y1="10.08" x2="2.21" y2="8.82" stroke={pattern} strokeWidth="1.2" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function ItemRow({ label, states, onSetState }) {
  const { correct, failed } = countStates(states);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12.5, color: c.text, marginBottom: 5 }}>
        {label}
        <MiniCount correct={correct} failed={failed} />
      </div>
      <AttemptDots states={states} onSetState={onSetState} />
    </div>
  );
}

const Card = ({ children, style }) => (
  <div
    style={{
      background: c.card,
      border: `1px solid ${c.cardEdge}`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      ...style,
    }}
  >
    {children}
  </div>
);

// ---------- Screen shell ----------
function Shell({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: c.bg,
        display: "flex",
        justifyContent: "center",
        padding: "24px 12px",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: c.bg,
          border: `1px solid ${c.cardEdge}`,
          borderRadius: 24,
          padding: "20px 14px 24px",
          boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function FeatureIcon({ type, color }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (type === "padres") {
    return (
      <svg {...common}>
        <circle cx="8" cy="7" r="3" />
        <path d="M2 21v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2" />
        <circle cx="17" cy="8" r="2.3" />
        <path d="M15.5 21v-1.5a4 4 0 0 1 4-4h0a4 4 0 0 1 3 1.4" />
      </svg>
    );
  }
  if (type === "entrenadores") {
    return (
      <svg {...common}>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 3v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V3" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }
  if (type === "datos") {
    return (
      <svg {...common}>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M20 20V13" />
        <path d="M3 20h18" />
      </svg>
    );
  }
  if (type === "enfoque") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="0.6" fill={color} />
      </svg>
    );
  }
  // confiable
  return (
    <svg {...common}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

const appFeatures = [
  { type: "padres", titulo: "Para padres", desc: "Conectados con el crecimiento de sus hijos.", accent: c.celeste },
  { type: "entrenadores", titulo: "Para entrenadores", desc: "Herramientas profesionales para potenciar el rendimiento de cada jugador.", accent: c.orange },
  { type: "datos", titulo: "Datos que suman", desc: "Seguimiento y análisis para una mejora continua.", accent: c.yellow },
  { type: "enfoque", titulo: "Enfoque en el jugador", desc: "Cada dato cuenta. Cada jugador importa.", accent: c.red },
  { type: "confiable", titulo: "Confiable y seguro", desc: "Información clara, segura y siempre disponible.", accent: c.celeste },
];

function FeatureRow({ f }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `${f.accent}1E`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <FeatureIcon type={f.type} color={f.accent} />
      </div>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: c.text }}>{f.titulo}</div>
        <div style={{ fontSize: 11.5, color: c.textDim, lineHeight: 1.4 }}>{f.desc}</div>
      </div>
    </div>
  );
}

// =====================================================================
// HOME — lista de jugadores
// =====================================================================
function HomeScreen({ players, onOpenPlayer, onNewPlayer, onOpenMetodo, onOpenFamilias, onOpenEvaluacionCarf, loading, isCoach, canWrite, subscriptionStatus, userId, userEmail }) {
  const ALIAS_TRANSFERENCIA = "chueco.madero.basico";
  const [mostrarTransferencia, setMostrarTransferencia] = useState(false);
  const [moneda, setMoneda] = useState("usd"); // "usd" | "ars"
  const [periodo, setPeriodo] = useState("mensual"); // "mensual" | "anual"
  const [pagando, setPagando] = useState(false);
  const [pagoError, setPagoError] = useState("");
  const PRECIOS = {
    usd: { mensual: "USD 9 / mes", anual: "USD 90 / año" },
    ars: { mensual: "$14.000 / mes", anual: "$140.000 / año" },
  };

  const pagarConMercadoPago = async () => {
    setPagoError("");
    setPagando(true);
    try {
      const resp = await fetch("/api/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: userId, email: userEmail, periodo }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.init_point) throw new Error(data.error || "No se pudo iniciar el pago");
      window.location.href = data.init_point;
    } catch (e) {
      console.error(e);
      setPagoError("No se pudo iniciar el pago. Probá de nuevo en un momento.");
      setPagando(false);
    }
  };

  return (
    <Shell>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <Logo size={280} />
        <div style={{ fontStyle: "italic", fontSize: 11, color: "rgba(245,245,240,0.35)", marginTop: 4 }}>
          creado por Alex Parra
        </div>
      </div>

      <div
        style={{
          background: c.card,
          border: `1px solid ${c.cardEdge}`,
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
        }}
      >
        {appFeatures.map((f) => (
          <FeatureRow key={f.type} f={f} />
        ))}
      </div>

      <button
        onClick={onOpenMetodo}
        style={{
          width: "100%",
          background: "rgba(255,229,0,0.08)",
          border: `1px solid rgba(255,229,0,0.3)`,
          color: c.yellow,
          borderRadius: 10,
          fontSize: 12.5,
          fontWeight: 700,
          padding: "10px 0",
          cursor: "pointer",
          marginBottom: 18,
        }}
      >
        ⭐ Conocé el Método C.A.R.F.
      </button>

      {isCoach && (
        <button
          onClick={onOpenFamilias}
          style={{
            width: "100%",
            background: "rgba(109,207,246,0.08)",
            border: `1px solid rgba(109,207,246,0.3)`,
            color: c.celeste,
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 700,
            padding: "10px 0",
            cursor: "pointer",
            marginBottom: 8,
          }}
        >
          👨‍👩‍👧 Familias (marcar alumnos C.A.R.F.)
        </button>
      )}

      {isCoach && (
        <button
          onClick={onOpenEvaluacionCarf}
          style={{
            width: "100%",
            background: "rgba(63,163,77,0.1)",
            border: `1px solid rgba(63,163,77,0.35)`,
            color: c.correct,
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 700,
            padding: "10px 0",
            cursor: "pointer",
            marginBottom: 18,
          }}
        >
          📋 Evaluación C.A.R.F.
        </button>
      )}

      {!isCoach && (
        <div
          style={{
            background: c.card,
            border: `1px solid ${c.cardEdge}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ color: c.text, fontSize: 12.5, fontWeight: 700 }}>Mi suscripción</div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color:
                  subscriptionStatus === "alumno_carf" || subscriptionStatus === "active"
                    ? c.correct
                    : !canWrite
                    ? c.failed
                    : c.yellow,
                border: `1px solid ${
                  subscriptionStatus === "alumno_carf" || subscriptionStatus === "active"
                    ? c.correct
                    : !canWrite
                    ? c.failed
                    : c.yellow
                }`,
                borderRadius: 6,
                padding: "2px 8px",
              }}
            >
              {subscriptionStatus === "alumno_carf"
                ? "ALUMNO C.A.R.F."
                : subscriptionStatus === "active"
                ? "SUSCRIPCIÓN ACTIVA"
                : !canWrite
                ? "PRUEBA VENCIDA"
                : "PRUEBA GRATUITA"}
            </div>
          </div>
          {subscriptionStatus === "alumno_carf" ? (
            <div style={{ color: c.textDim, fontSize: 11 }}>
              Acceso completo incluido, sin costo, por entrenar en el C.A.R.F. 🎉
            </div>
          ) : subscriptionStatus === "active" ? (
            <div style={{ color: c.textDim, fontSize: 11 }}>
              ¡Gracias! Tu pago está confirmado y tenés acceso completo. 🎉
            </div>
          ) : (
            <>
              <div style={{ color: c.textDim, fontSize: 11, marginBottom: 10 }}>
                {canWrite
                  ? "Elegí tu medio de pago para acceder a las evaluaciones del entrenador."
                  : "Se venció tu prueba de 7 días. Podés seguir viendo lo ya cargado, pero para agregar jugadores o cargas nuevas hace falta activar un medio de pago."}
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <Chip label="🌎 Resto del mundo (USD)" active={moneda === "usd"} accent={c.celeste} onClick={() => setMoneda("usd")} />
                <Chip label="🇦🇷 Argentina (ARS)" active={moneda === "ars"} accent={c.celeste} onClick={() => setMoneda("ars")} />
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <Chip label="Mensual" active={periodo === "mensual"} accent={c.yellow} onClick={() => setPeriodo("mensual")} />
                <Chip label="Anual (2 meses gratis)" active={periodo === "anual"} accent={c.yellow} onClick={() => setPeriodo("anual")} />
              </div>
              <div style={{ color: c.text, fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
                {PRECIOS[moneda][periodo]}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <Chip label="💳 Tarjeta" accent={c.celeste} disabled />
                <Chip
                  label={pagando ? "Abriendo Mercado Pago..." : "🇦🇷 Mercado Pago"}
                  accent={c.orange}
                  disabled={moneda !== "ars" || pagando}
                  onClick={pagarConMercadoPago}
                />
                <Chip
                  label="🏦 Transferencia"
                  accent={c.correct}
                  active={mostrarTransferencia}
                  disabled={moneda !== "ars"}
                  onClick={() => setMostrarTransferencia((v) => !v)}
                />
              </div>
              {mostrarTransferencia && moneda === "ars" && (
                <div style={{ background: c.card2, border: `1px solid ${c.cardEdge}`, borderRadius: 10, padding: 10, marginTop: 8 }}>
                  <div style={{ color: c.textDim, fontSize: 11, marginBottom: 4 }}>Transferí</div>
                  <div style={{ color: c.text, fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{PRECIOS.ars[periodo]}</div>
                  <div style={{ color: c.textDim, fontSize: 11, marginBottom: 4 }}>al alias</div>
                  <div style={{ color: c.correct, fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{ALIAS_TRANSFERENCIA}</div>
                  <div style={{ color: c.textDim, fontSize: 10.5, lineHeight: 1.5, marginBottom: 10 }}>
                    Después, enviale el comprobante de pago a Alejandro por WhatsApp para que active tu cuenta.
                  </div>
                  <a
                    href={`https://wa.me/5492235974246?text=${encodeURIComponent(
                      "Hola Alejandro! Te mando el comprobante de la transferencia de Mi MVP:"
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "block",
                      textAlign: "center",
                      background: "#25D366",
                      color: "#0A0A0A",
                      fontWeight: 800,
                      fontSize: 12.5,
                      borderRadius: 8,
                      padding: "9px 0",
                      textDecoration: "none",
                    }}
                  >
                    💬 Enviar comprobante por WhatsApp
                  </a>
                </div>
              )}
              {moneda !== "ars" && (
                <div style={{ color: c.textDim, fontSize: 10, marginTop: 6 }}>
                  Mercado Pago y transferencia sólo cobran en pesos argentinos — elegí "Argentina (ARS)" para usarlos. Tarjeta internacional: próximamente.
                </div>
              )}
              {pagoError && <div style={{ color: c.failed, fontSize: 11, marginTop: 6 }}>{pagoError}</div>}
            </>
          )}
        </div>
      )}

      <SectionTitle>{isCoach ? "Jugadores del CARF" : "Mis jugadores"}</SectionTitle>

      {loading && <div style={{ color: c.textDim, fontSize: 13 }}>Cargando...</div>}

      {!loading && players.length === 0 && (
        <div style={{ color: c.textDim, fontSize: 13, marginBottom: 10 }}>
          Todavía no hay jugadores cargados.
        </div>
      )}

      {players.map((p) => (
        <div
          key={p.id}
          onClick={() => onOpenPlayer(p.id)}
          style={{
            background: c.card,
            border: `1px solid ${c.cardEdge}`,
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 8,
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{p.nombre || "Sin nombre"}</div>
            <div style={{ fontSize: 11.5, color: c.textDim }}>
              {p.posicionPrincipal || "Posición no cargada"} {p.clubActual ? `· ${p.clubActual}` : ""}
            </div>
          </div>
          <span style={{ color: c.textDim }}>›</span>
        </div>
      ))}

      {!isCoach && canWrite && (
        <button
          onClick={onNewPlayer}
          style={{
            width: "100%",
            background: "none",
            border: `1px dashed ${c.cardEdge}`,
            color: c.yellow,
            borderRadius: 10,
            fontSize: 13.5,
            fontWeight: 700,
            padding: "12px 0",
            cursor: "pointer",
            marginTop: 8,
          }}
        >
          + Nuevo jugador
        </button>
      )}
      {!isCoach && !canWrite && (
        <div style={{ color: c.textDim, fontSize: 11, textAlign: "center", padding: "8px 4px" }}>
          Tu prueba gratuita venció. Activá un medio de pago para volver a cargar.
        </div>
      )}
    </Shell>
  );
}

// =====================================================================
// FICHA DE JUGADOR (crear / ver)
// =====================================================================
const nivelesIniciales = ["Escuela", "Preliga", "Liga", "AFA"];
const situaciones = ["Titular constante", "Suplente", "Citación alternada"];
const pieHabilOpts = ["Diestro", "Zurdo"];
const plazos = ["Corto plazo", "Largo plazo"];
const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function emptyClubHist() {
  return { id: uid(), club: "", desde: "", hasta: "" };
}
function emptyHorario() {
  return { id: uid(), dia: "Lun", horario: "" };
}

function emptyPlayer() {
  return {
    id: uid(),
    nombre: "",
    fechaNacimiento: "",
    posicionPrincipal: "",
    posicionAlternativa: "",
    clubActual: "",
    nivelInicial: null,
    situacionActual: null,
    pieHabil: null,
    plazoObjetivo: [],
    objetivoCorto: "",
    objetivoLargo: "",
    clubesAnteriores: [emptyClubHist()],
    horariosClub: [emptyHorario()],
    horariosCarf: [emptyHorario()],
  };
}

function PlayerFormScreen({ initial, onBack, onSave, onDelete }) {
  const [p, setP] = useState(initial || emptyPlayer());
  const set = (field, value) => setP((prev) => ({ ...prev, [field]: value }));

  return (
    <Shell>
      <TopBar title={initial ? "Editar jugador" : "Nuevo jugador"} onBack={onBack} />

      <FieldLabel>Nombre del jugador/a</FieldLabel>
      <TextInput value={p.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Nombre y apellido" />

      <div style={{ marginTop: 12 }}>
        <FieldLabel>Fecha de nacimiento</FieldLabel>
        <TextInput type="date" value={p.fechaNacimiento} onChange={(e) => set("fechaNacimiento", e.target.value)} />
      </div>

      <div style={{ marginTop: 12 }}>
        <FieldLabel>Posición principal</FieldLabel>
        <TextInput value={p.posicionPrincipal} onChange={(e) => set("posicionPrincipal", e.target.value)} placeholder="Ej: Volante central" />
      </div>

      <div style={{ marginTop: 12 }}>
        <FieldLabel>Posición alternativa</FieldLabel>
        <TextInput value={p.posicionAlternativa} onChange={(e) => set("posicionAlternativa", e.target.value)} placeholder="Ej: Lateral derecho" />
      </div>

      <div style={{ marginTop: 12 }}>
        <FieldLabel>Club actual</FieldLabel>
        <TextInput value={p.clubActual} onChange={(e) => set("clubActual", e.target.value)} placeholder="Club donde juega hoy" />
      </div>

      <SectionTitle>Nivel inicial</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {nivelesIniciales.map((n) => (
          <Chip key={n} label={n} active={p.nivelInicial === n} accent={c.celeste} onClick={() => set("nivelInicial", n)} />
        ))}
      </div>

      <SectionTitle>Situación actual</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {situaciones.map((s) => (
          <Chip key={s} label={s} active={p.situacionActual === s} accent={c.orange} onClick={() => set("situacionActual", s)} />
        ))}
      </div>

      <SectionTitle>Pie hábil</SectionTitle>
      <div style={{ display: "flex", gap: 6 }}>
        {pieHabilOpts.map((ph) => (
          <Chip key={ph} label={ph} active={p.pieHabil === ph} accent={c.celeste} onClick={() => set("pieHabil", ph)} />
        ))}
      </div>

      <SectionTitle>Objetivo</SectionTitle>
      <div style={{ fontSize: 10.5, color: c.textDim, marginBottom: 8 }}>
        Se pueden marcar los dos a la vez
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {plazos.map((pl) => {
          const active = (p.plazoObjetivo || []).includes(pl);
          return (
            <Chip
              key={pl}
              label={pl}
              active={active}
              accent={c.yellow}
              onClick={() =>
                set(
                  "plazoObjetivo",
                  active ? p.plazoObjetivo.filter((x) => x !== pl) : [...(p.plazoObjetivo || []), pl]
                )
              }
            />
          );
        })}
      </div>
      {(p.plazoObjetivo || []).includes("Corto plazo") && (
        <div style={{ marginBottom: 10 }}>
          <FieldLabel>Objetivo de corto plazo</FieldLabel>
          <TextArea rows={2} value={p.objetivoCorto} onChange={(e) => set("objetivoCorto", e.target.value)} placeholder="Ej: consolidarse como titular en el club" />
        </div>
      )}
      {(p.plazoObjetivo || []).includes("Largo plazo") && (
        <div style={{ marginBottom: 10 }}>
          <FieldLabel>Objetivo de largo plazo</FieldLabel>
          <TextArea rows={2} value={p.objetivoLargo} onChange={(e) => set("objetivoLargo", e.target.value)} placeholder="Ej: ser citado a una categoría de selección" />
        </div>
      )}

      {/* Clubes donde jugó */}
      <SectionTitle>Clubes donde jugó (con fecha)</SectionTitle>
      {(p.clubesAnteriores || []).map((cl) => (
        <div key={cl.id} style={{ background: c.card, border: `1px solid ${c.cardEdge}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <TextInput
              value={cl.club}
              onChange={(e) =>
                set("clubesAnteriores", p.clubesAnteriores.map((x) => (x.id === cl.id ? { ...x, club: e.target.value } : x)))
              }
              placeholder="Nombre del club"
              style={{ flex: 1 }}
            />
            {p.clubesAnteriores.length > 1 && (
              <button
                onClick={() => set("clubesAnteriores", p.clubesAnteriores.filter((x) => x.id !== cl.id))}
                style={{ background: "none", border: "none", color: c.textDim, fontSize: 16, cursor: "pointer", padding: "0 6px" }}
              >
                ×
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Desde</FieldLabel>
              <TextInput
                type="date"
                value={cl.desde}
                onChange={(e) =>
                  set("clubesAnteriores", p.clubesAnteriores.map((x) => (x.id === cl.id ? { ...x, desde: e.target.value } : x)))
                }
              />
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>Hasta</FieldLabel>
              <TextInput
                type="date"
                value={cl.hasta}
                onChange={(e) =>
                  set("clubesAnteriores", p.clubesAnteriores.map((x) => (x.id === cl.id ? { ...x, hasta: e.target.value } : x)))
                }
                placeholder="Actualidad si sigue"
              />
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={() => set("clubesAnteriores", [...(p.clubesAnteriores || []), emptyClubHist()])}
        style={{ background: "none", border: `1px dashed ${c.cardEdge}`, color: c.textDim, borderRadius: 8, fontSize: 12.5, padding: "7px 0", width: "100%", cursor: "pointer", marginBottom: 6 }}
      >
        + Agregar club
      </button>

      {/* Días de entrenamiento en club */}
      <SectionTitle>Días de entrenamiento en club y horario</SectionTitle>
      {(p.horariosClub || []).map((h) => (
        <div key={h.id} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
          <select
            value={h.dia}
            onChange={(e) => set("horariosClub", p.horariosClub.map((x) => (x.id === h.id ? { ...x, dia: e.target.value } : x)))}
            style={{ background: c.card, border: `1px solid ${c.cardEdge}`, borderRadius: 8, color: c.text, fontSize: 13, padding: "9px 8px", outline: "none" }}
          >
            {diasSemana.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <TextInput
            value={h.horario}
            onChange={(e) => set("horariosClub", p.horariosClub.map((x) => (x.id === h.id ? { ...x, horario: e.target.value } : x)))}
            placeholder="Ej: 18:00 a 19:30"
            style={{ flex: 1 }}
          />
          {p.horariosClub.length > 1 && (
            <button
              onClick={() => set("horariosClub", p.horariosClub.filter((x) => x.id !== h.id))}
              style={{ background: "none", border: "none", color: c.textDim, fontSize: 16, cursor: "pointer", padding: "0 4px" }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        onClick={() => set("horariosClub", [...(p.horariosClub || []), emptyHorario()])}
        style={{ background: "none", border: `1px dashed ${c.cardEdge}`, color: c.textDim, borderRadius: 8, fontSize: 12.5, padding: "7px 0", width: "100%", cursor: "pointer", marginBottom: 6 }}
      >
        + Agregar día
      </button>

      {/* Días de entrenamiento en C.A.R.F. */}
      <SectionTitle>Días de entrenamiento en C.A.R.F. y horario</SectionTitle>
      {(p.horariosCarf || []).map((h) => (
        <div key={h.id} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
          <select
            value={h.dia}
            onChange={(e) => set("horariosCarf", p.horariosCarf.map((x) => (x.id === h.id ? { ...x, dia: e.target.value } : x)))}
            style={{ background: c.card, border: `1px solid ${c.cardEdge}`, borderRadius: 8, color: c.text, fontSize: 13, padding: "9px 8px", outline: "none" }}
          >
            {diasSemana.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <TextInput
            value={h.horario}
            onChange={(e) => set("horariosCarf", p.horariosCarf.map((x) => (x.id === h.id ? { ...x, horario: e.target.value } : x)))}
            placeholder="Ej: 17:00 a 18:00"
            style={{ flex: 1 }}
          />
          {p.horariosCarf.length > 1 && (
            <button
              onClick={() => set("horariosCarf", p.horariosCarf.filter((x) => x.id !== h.id))}
              style={{ background: "none", border: "none", color: c.textDim, fontSize: 16, cursor: "pointer", padding: "0 4px" }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        onClick={() => set("horariosCarf", [...(p.horariosCarf || []), emptyHorario()])}
        style={{ background: "none", border: `1px dashed ${c.cardEdge}`, color: c.textDim, borderRadius: 8, fontSize: 12.5, padding: "7px 0", width: "100%", cursor: "pointer" }}
      >
        + Agregar día
      </button>

      <PrimaryButton onClick={() => onSave(p)}>{initial ? "Guardar cambios" : "Crear jugador"}</PrimaryButton>

      {initial && onDelete && (
        <button
          onClick={() => {
            if (window.confirm(`¿Seguro que querés eliminar a ${p.nombre || "este jugador"}? Se borran también sus entrenamientos, partidos y videos. Esto no se puede deshacer.`)) {
              onDelete(initial.id);
            }
          }}
          style={{
            width: "100%",
            background: "none",
            border: `1px solid ${c.failed}`,
            color: c.failed,
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 700,
            padding: "10px 0",
            cursor: "pointer",
            marginTop: 10,
          }}
        >
          🗑 Eliminar jugador
        </button>
      )}
    </Shell>
  );
}

// =====================================================================
// DETALLE DE JUGADOR — historial + accesos a nuevas entradas
// =====================================================================
function tipoLabel(tipo) {
  if (tipo === "sesion") return "Sesión de entrenamiento";
  if (tipo === "partido") return "Competencia";
  if (tipo === "zona") return "Zona de movimiento";
  if (tipo === "evaluacion_carf") return "Evaluación C.A.R.F.";
  return tipo;
}
function tipoColor(tipo) {
  if (tipo === "sesion") return c.celeste;
  if (tipo === "partido") return c.orange;
  if (tipo === "zona") return c.yellow;
  if (tipo === "evaluacion_carf") return c.correct;
  return c.text;
}

// =====================================================================
// AGREGACIÓN DE ESTADÍSTICAS — semanal / mensual / anual, Club vs C.A.R.F.
// =====================================================================
function startOfWeek(d) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function inCurrentWeek(fechaStr) {
  const d = new Date(fechaStr + "T00:00:00");
  const now = new Date();
  const monday = startOfWeek(now);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return d >= monday && d <= sunday;
}
function inCurrentMonth(fechaStr) {
  const d = new Date(fechaStr + "T00:00:00");
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}
function inCurrentYear(fechaStr) {
  const d = new Date(fechaStr + "T00:00:00");
  const now = new Date();
  return d.getFullYear() === now.getFullYear();
}

function aggregateStats(entries, periodo, lugarFiltro) {
  const filterFn = periodo === "Semanal" ? inCurrentWeek : periodo === "Mensual" ? inCurrentMonth : inCurrentYear;
  const filtered = entries.filter(
    (e) => e.tipo === "sesion" && filterFn(e.fecha) && (lugarFiltro === "Todos" || e.data.lugar === lugarFiltro)
  );
  // los partidos son siempre actividad de Club (no se juegan partidos oficiales en el C.A.R.F.)
  const filteredPartidos = entries.filter(
    (e) => e.tipo === "partido" && filterFn(e.fecha) && (lugarFiltro === "Todos" || lugarFiltro === "Club")
  );
  // las Evaluaciones C.A.R.F. son siempre actividad del propio C.A.R.F.
  const filteredEvalCarf = entries.filter(
    (e) => e.tipo === "evaluacion_carf" && filterFn(e.fecha) && (lugarFiltro === "Todos" || lugarFiltro === "C.A.R.F.")
  );

  const result = {};
  const addCounts = (categoria, label, states) => {
    if (!states) return;
    const { correct, failed } = countStates(states);
    if (correct === 0 && failed === 0) return;
    result[categoria] = result[categoria] || {};
    result[categoria][label] = result[categoria][label] || { correct: 0, failed: 0 };
    result[categoria][label].correct += correct;
    result[categoria][label].failed += failed;
  };

  filtered.forEach((e) => {
    const d = e.data;
    fisicoItems.forEach((item) => addCounts("Físico", item, d.fisicoAttempts?.[item]));
    Object.entries(tecnicoGroups).forEach(([group, opts]) =>
      opts.forEach((opt) => {
        const key = `${group}::${opt}`;
        const v = d.tecnicoAttempts?.[key];
        if (v) addCounts("Técnico", `${group} — ${opt}`, Object.values(v).flat());
      })
    );
    cognitivoItems.forEach((item) => addCounts("Cognitivo", item, d.cognitivoAttempts?.[item]));
    tacticoItems.forEach((item) => addCounts("Táctico", item, d.tacticoAttempts?.[item]));
  });

  filteredPartidos.forEach((e) => {
    const at = e.data.attempts || {};
    itemsSimples.forEach((item) => addCounts("Partido", item, at[item]));
    remates.forEach((r) => addCounts("Partido", `Remate — ${r}`, at[`Remate::${r}`]));
    cabezazos.forEach((z) => addCounts("Partido", `Cabezazo — ${z}`, at[`Cabezazo::${z}`]));
    pelotaParada.forEach((p) => addCounts("Partido", `Pelota parada — ${p}`, at[`Pelota parada::${p}`]));
    finales.forEach((f) => addCounts("Partido", f, at[f]));
  });

  filteredEvalCarf.forEach((e) => {
    const at = e.data.attempts || {};
    Object.entries(CATEGORIAS_EVAL_CARF).forEach(([, items]) =>
      items.forEach((item) => addCounts("Evaluación C.A.R.F.", item, at[item]))
    );
  });

  // totales de Sesión (Físico/Técnico/Cognitivo/Táctico) y de Partido, SIEMPRE separados
  let sesionCorrect = 0;
  let sesionFailed = 0;
  let partidoCorrect = 0;
  let partidoFailed = 0;
  let evalCarfCorrect = 0;
  let evalCarfFailed = 0;

  Object.entries(result).forEach(([categoria, items]) => {
    Object.values(items).forEach((v) => {
      if (categoria === "Partido") {
        partidoCorrect += v.correct;
        partidoFailed += v.failed;
      } else if (categoria === "Evaluación C.A.R.F.") {
        evalCarfCorrect += v.correct;
        evalCarfFailed += v.failed;
      } else {
        sesionCorrect += v.correct;
        sesionFailed += v.failed;
      }
    });
  });

  // bono ponderado: un gol/asistencia vale más que un ítem cualquiera.
  // el detalle por ítem (arriba) sigue mostrando el número real sin ponderar;
  // esto solo ajusta el total/resumen y el % de efectividad general.
  filteredPartidos.forEach((e) => {
    const at = e.data.attempts || {};
    const golesR = countStates(at["Goles"] || []);
    const asistR = countStates(at["Asistencias"] || []);
    partidoCorrect += golesR.correct * (PESO_GOL_PARTIDO - 1);
    partidoCorrect += asistR.correct * (PESO_ASISTENCIA_PARTIDO - 1);
  });
  filtered.forEach((e) => {
    const d = e.data;
    if (d.tipoActividad === "Fútbol 9" || d.tipoActividad === "Fútbol 11") {
      sesionCorrect += (parseInt(d.goles) || 0) * PESO_GOL_ENTRENAMIENTO;
      sesionCorrect += (parseInt(d.asistencias) || 0) * PESO_ASISTENCIA_ENTRENAMIENTO;
    }
  });

  return {
    result,
    sessionCount: filtered.length,
    partidoCount: filteredPartidos.length,
    evalCarfCount: filteredEvalCarf.length,
    sesionCorrect,
    sesionFailed,
    partidoCorrect,
    partidoFailed,
    evalCarfCorrect,
    evalCarfFailed,
  };
}

const catAccent = { "Físico": c.celeste, "Técnico": c.yellow, "Cognitivo": c.orange, "Táctico": c.red, "Partido": c.correct, "Evaluación C.A.R.F.": c.correct };

function sessionPct(entry) {
  if (entry.data.totales?.pct !== undefined) return entry.data.totales.pct;
  // recalcular si no viene precomputado
  let correct = 0, failed = 0;
  const d = entry.data;
  fisicoItems.forEach((i) => { const r = countStates(d.fisicoAttempts?.[i] || []); correct += r.correct; failed += r.failed; });
  Object.values(d.tecnicoAttempts || {}).forEach((v) => {
    Object.values(v).forEach((states) => {
      const r = countStates(states || []);
      correct += r.correct;
      failed += r.failed;
    });
  });
  cognitivoItems.forEach((i) => { const r = countStates(d.cognitivoAttempts?.[i] || []); correct += r.correct; failed += r.failed; });
  tacticoItems.forEach((i) => { const r = countStates(d.tacticoAttempts?.[i] || []); correct += r.correct; failed += r.failed; });
  const marked = correct + failed;
  return marked > 0 ? Math.round((correct / marked) * 100) : null;
}

function TrendChart({ entries, periodo, lugarFiltro }) {
  const filterFn = periodo === "Semanal" ? inCurrentWeek : periodo === "Mensual" ? inCurrentMonth : inCurrentYear;
  const sesiones = entries
    .filter((e) => e.tipo === "sesion" && filterFn(e.fecha) && (lugarFiltro === "Todos" || e.data.lugar === lugarFiltro))
    .sort((a, b) => (a.fecha > b.fecha ? 1 : -1))
    .map((e) => ({ fecha: e.fecha, pct: sessionPct(e) }))
    .filter((s) => s.pct !== null);

  if (sesiones.length < 2) return null;

  const W = 320, H = 120, PAD = 24;
  const stepX = (W - PAD * 2) / (sesiones.length - 1);
  const yFor = (pct) => H - PAD - (pct / 100) * (H - PAD * 2);
  const points = sesiones.map((s, i) => `${PAD + i * stepX},${yFor(s.pct)}`).join(" ");

  return (
    <Card>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: c.text, marginBottom: 8 }}>
        Evolución de efectividad
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
        <text x={4} y={PAD + 3} fontSize="8" fill={c.textDim}>100%</text>
        <text x={4} y={H - PAD + 3} fontSize="8" fill={c.textDim}>0%</text>
        <polyline points={points} fill="none" stroke={c.yellow} strokeWidth={2} />
        {sesiones.map((s, i) => (
          <circle key={i} cx={PAD + i * stepX} cy={yFor(s.pct)} r={3.5} fill={c.yellow} />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: c.textDim, marginTop: 2 }}>
        <span>{sesiones[0].fecha.slice(5)}</span>
        <span>{sesiones[sesiones.length - 1].fecha.slice(5)}</span>
      </div>
    </Card>
  );
}

function ComparisonBarChart({ entries, periodo }) {
  const club = aggregateStats(entries, periodo, "Club");
  const carf = aggregateStats(entries, periodo, "C.A.R.F.");
  const pctOf = (s) => {
    const correct = s.sesionCorrect + s.partidoCorrect;
    const failed = s.sesionFailed + s.partidoFailed;
    return correct + failed > 0 ? Math.round((correct / (correct + failed)) * 100) : 0;
  };
  const pctClub = pctOf(club);
  const pctCarf = pctOf(carf);

  if (club.sessionCount === 0 && carf.sessionCount === 0) return null;

  return (
    <Card>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: c.text, marginBottom: 10 }}>
        Club vs C.A.R.F.
      </div>
      {[
        { label: "Club", pct: pctClub, n: club.sessionCount, color: c.celeste },
        { label: "C.A.R.F.", pct: pctCarf, n: carf.sessionCount, color: c.yellow },
      ].map((row) => (
        <div key={row.label} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, color: c.text }}>
              {row.label} <span style={{ color: c.textDim }}>({row.n} {row.n === 1 ? "sesión" : "sesiones"})</span>
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: row.color }}>{row.n > 0 ? `${row.pct}%` : "—"}</span>
          </div>
          <div style={{ width: "100%", height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 5, overflow: "hidden" }}>
            <div style={{ width: `${row.pct}%`, height: "100%", background: row.color }} />
          </div>
        </div>
      ))}
    </Card>
  );
}

function EstadisticasScreen({ entries, onBack }) {
  const [periodo, setPeriodo] = useState("Mensual");
  const [lugarFiltro, setLugarFiltro] = useState("Todos");

  const { result, sessionCount, partidoCount, evalCarfCount, sesionCorrect, sesionFailed, partidoCorrect, partidoFailed, evalCarfCorrect, evalCarfFailed } = aggregateStats(entries, periodo, lugarFiltro);
  const sesionMarked = sesionCorrect + sesionFailed;
  const sesionPctVal = sesionMarked > 0 ? Math.round((sesionCorrect / sesionMarked) * 100) : 0;
  const partidoMarked = partidoCorrect + partidoFailed;
  const partidoPctVal = partidoMarked > 0 ? Math.round((partidoCorrect / partidoMarked) * 100) : 0;
  const evalCarfMarked = evalCarfCorrect + evalCarfFailed;
  const evalCarfPctVal = evalCarfMarked > 0 ? Math.round((evalCarfCorrect / evalCarfMarked) * 100) : 0;

  // Acumulado histórico de Evaluación C.A.R.F.: TODAS las evaluaciones
  // guardadas, sin importar el período elegido arriba — el "total
  // acumulable" que no se resetea nunca.
  const historicoEvalCarf = entries.filter((e) => e.tipo === "evaluacion_carf");
  let histCorrect = 0, histFailed = 0;
  historicoEvalCarf.forEach((e) => {
    histCorrect += e.data?.totales?.correct || 0;
    histFailed += e.data?.totales?.failed || 0;
  });
  const histMarked = histCorrect + histFailed;
  const histPct = histMarked > 0 ? Math.round((histCorrect / histMarked) * 100) : 0;
  const categorias = Object.keys(result);

  return (
    <Shell>
      <TopBar title="Estadísticas" onBack={onBack} />

      <FieldLabel>Período</FieldLabel>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {["Semanal", "Mensual", "Anual"].map((p) => (
          <Chip key={p} label={p} active={periodo === p} accent={c.yellow} onClick={() => setPeriodo(p)} />
        ))}
      </div>

      <FieldLabel>Lugar</FieldLabel>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["Todos", "Club", "C.A.R.F."].map((l) => (
          <Chip key={l} label={l} active={lugarFiltro === l} accent={c.celeste} onClick={() => setLugarFiltro(l)} />
        ))}
      </div>

      <Card>
        <div style={{ fontSize: 11, color: c.textDim, textAlign: "center", marginBottom: 8 }}>
          Sesiones de entrenamiento — {sessionCount} {sessionCount === 1 ? "sesión" : "sesiones"} en este período
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.correct }}>{sesionCorrect}</div>
            <div style={{ fontSize: 9.5, color: c.textDim }}>LOGRADOS</div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.failed }}>{sesionFailed}</div>
            <div style={{ fontSize: 9.5, color: c.textDim }}>A TRABAJAR</div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.yellow }}>{sesionMarked > 0 ? `${sesionPctVal}%` : "—"}</div>
            <div style={{ fontSize: 9.5, color: c.textDim }}>EFECTIVIDAD</div>
          </div>
        </div>
      </Card>

      {partidoCount > 0 && (
        <Card>
          <div style={{ fontSize: 11, color: c.textDim, textAlign: "center", marginBottom: 8 }}>
            Partidos (Competencia) — {partidoCount} {partidoCount === 1 ? "partido" : "partidos"} en este período
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.correct }}>{partidoCorrect}</div>
              <div style={{ fontSize: 9.5, color: c.textDim }}>LOGRADOS</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.failed }}>{partidoFailed}</div>
              <div style={{ fontSize: 9.5, color: c.textDim }}>A TRABAJAR</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.yellow }}>{partidoMarked > 0 ? `${partidoPctVal}%` : "—"}</div>
              <div style={{ fontSize: 9.5, color: c.textDim }}>EFECTIVIDAD</div>
            </div>
          </div>
        </Card>
      )}

      {evalCarfCount > 0 && (
        <Card>
          <div style={{ fontSize: 11, color: c.textDim, textAlign: "center", marginBottom: 8 }}>
            Evaluación C.A.R.F. — {evalCarfCount} {evalCarfCount === 1 ? "planilla" : "planillas"} en este período
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.correct }}>{evalCarfCorrect}</div>
              <div style={{ fontSize: 9.5, color: c.textDim }}>LOGRADOS</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.failed }}>{evalCarfFailed}</div>
              <div style={{ fontSize: 9.5, color: c.textDim }}>A TRABAJAR</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.yellow }}>{evalCarfMarked > 0 ? `${evalCarfPctVal}%` : "—"}</div>
              <div style={{ fontSize: 9.5, color: c.textDim }}>EFECTIVIDAD</div>
            </div>
          </div>
        </Card>
      )}

      {historicoEvalCarf.length > 0 && (
        <Card style={{ border: `1px solid ${c.correct}` }}>
          <div style={{ fontSize: 11, color: c.correct, textAlign: "center", marginBottom: 8, fontWeight: 700 }}>
            🏆 ACUMULADO HISTÓRICO — Evaluación C.A.R.F. ({historicoEvalCarf.length} {historicoEvalCarf.length === 1 ? "planilla" : "planillas"} en total, todo el tiempo)
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.correct }}>{histCorrect}</div>
              <div style={{ fontSize: 9.5, color: c.textDim }}>LOGRADOS</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.failed }}>{histFailed}</div>
              <div style={{ fontSize: 9.5, color: c.textDim }}>A TRABAJAR</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.yellow }}>{histMarked > 0 ? `${histPct}%` : "—"}</div>
              <div style={{ fontSize: 9.5, color: c.textDim }}>PROMEDIO GENERAL</div>
            </div>
          </div>
        </Card>
      )}

      <TrendChart entries={entries} periodo={periodo} lugarFiltro={lugarFiltro} />

      {categorias.length === 0 && (
        <div style={{ fontSize: 12.5, color: c.textDim, textAlign: "center", marginTop: 20 }}>
          No hay sesiones cargadas en este período y lugar.
        </div>
      )}

      {categorias.map((cat) => (
        <Card key={cat}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: catAccent[cat], marginBottom: 10 }}>{cat}</div>
          {Object.entries(result[cat])
            .sort((a, b) => (b[1].correct + b[1].failed) - (a[1].correct + a[1].failed))
            .map(([label, v]) => {
              const marked = v.correct + v.failed;
              const itemPct = marked > 0 ? Math.round((v.correct / marked) * 100) : 0;
              return (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: c.text }}>{label}</span>
                    <span style={{ fontSize: 11 }}>
                      <span style={{ color: c.correct, fontWeight: 700 }}>{v.correct}✓</span>{" "}
                      <span style={{ color: c.failed, fontWeight: 700 }}>{v.failed}✗</span>{" "}
                      <span style={{ color: c.yellow, fontWeight: 700 }}>{itemPct}%</span>
                    </span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${itemPct}%`, height: "100%", background: catAccent[cat] }} />
                  </div>
                </div>
              );
            })}
        </Card>
      ))}
    </Shell>
  );
}

// =====================================================================
// STATUS DEL JUGADOR — 3 escudos tipo carnet FIFA (Entrenamiento / Partido / General)
// =====================================================================
function computeRatings(entries) {
  let trC = 0, trF = 0, moC = 0, moF = 0;

  entries.filter((e) => e.tipo === "sesion").forEach((e) => {
    const d = e.data;
    fisicoItems.forEach((i) => { const r = countStates(d.fisicoAttempts?.[i] || []); trC += r.correct; trF += r.failed; });
    Object.values(d.tecnicoAttempts || {}).forEach((v) => {
      Object.values(v).forEach((states) => { const r = countStates(states || []); trC += r.correct; trF += r.failed; });
    });
    cognitivoItems.forEach((i) => { const r = countStates(d.cognitivoAttempts?.[i] || []); trC += r.correct; trF += r.failed; });
    tacticoItems.forEach((i) => { const r = countStates(d.tacticoAttempts?.[i] || []); trC += r.correct; trF += r.failed; });
    // goles/asistencias de entrenamiento pesan más, pero solo en Fútbol 9 / Fútbol 11
    if (d.tipoActividad === "Fútbol 9" || d.tipoActividad === "Fútbol 11") {
      trC += (parseInt(d.goles) || 0) * PESO_GOL_ENTRENAMIENTO;
      trC += (parseInt(d.asistencias) || 0) * PESO_ASISTENCIA_ENTRENAMIENTO;
    }
  });

  entries.filter((e) => e.tipo === "partido").forEach((e) => {
    const at = e.data.attempts || {};
    itemsSimples.forEach((item) => { const r = countStates(at[item] || []); moC += r.correct; moF += r.failed; });
    remates.forEach((r2) => { const r = countStates(at[`Remate::${r2}`] || []); moC += r.correct; moF += r.failed; });
    cabezazos.forEach((z) => { const r = countStates(at[`Cabezazo::${z}`] || []); moC += r.correct; moF += r.failed; });
    pelotaParada.forEach((p) => { const r = countStates(at[`Pelota parada::${p}`] || []); moC += r.correct; moF += r.failed; });
    // goles/asistencias de partido pesan más que un ítem cualquiera
    const golesR = countStates(at["Goles"] || []);
    moC += golesR.correct * PESO_GOL_PARTIDO;
    moF += golesR.failed;
    const asistR = countStates(at["Asistencias"] || []);
    moC += asistR.correct * PESO_ASISTENCIA_PARTIDO;
    moF += asistR.failed;
  });

  const trPct = trC + trF > 0 ? Math.round((trC / (trC + trF)) * 100) : null;
  const moPct = moC + moF > 0 ? Math.round((moC / (moC + moF)) * 100) : null;
  const genC = trC + moC, genF = trF + moF;
  const genPct = genC + genF > 0 ? Math.round((genC / (genC + genF)) * 100) : null;

  return { trPct, moPct, genPct };
}

function Escudo({ label, valor, color, size = 1 }) {
  const w = 90 * size;
  const activeColor = valor !== null ? color : "rgba(255,255,255,0.2)";
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <svg viewBox="0 0 24 24" width={16 * size} height={16 * size} style={{ margin: "0 auto 2px", display: "block" }}>
        <polygon
          points="12,2 14.7,8.7 22,9.3 16.5,13.9 18.2,21 12,17.1 5.8,21 7.5,13.9 2,9.3 9.3,8.7"
          fill={activeColor}
        />
      </svg>
      <svg viewBox="0 0 100 118" width="100%" style={{ maxWidth: w, margin: "0 auto", display: "block" }}>
        <path
          d="M50 4 L92 18 L92 56 Q92 94 50 114 Q8 94 8 56 L8 18 Z"
          fill={valor !== null ? `${color}22` : "rgba(255,255,255,0.04)"}
          stroke={activeColor}
          strokeWidth="3.5"
        />
        <text
          x="50"
          y="68"
          fontSize="36"
          fontWeight="900"
          fill={valor !== null ? color : "rgba(255,255,255,0.25)"}
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
        >
          {valor !== null ? valor : "—"}
        </text>
      </svg>
      <div style={{ fontSize: 10, color: c.textDim, marginTop: 4, fontWeight: 700, letterSpacing: 0.3 }}>{label}</div>
    </div>
  );
}

function StatusJugador({ entries }) {
  const { trPct, moPct, genPct } = computeRatings(entries);
  if (trPct === null && moPct === null) return null;

  return (
    <Card>
      <div style={{ fontSize: 11, color: c.textDim, textAlign: "center", marginBottom: 12, letterSpacing: 0.4, fontWeight: 700 }}>
        STATUS DEL JUGADOR
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <Escudo label="ENTRENAMIENTO" valor={trPct} color={c.celeste} />
        <Escudo label="GENERAL" valor={genPct} color={c.yellow} size={1.15} />
        <Escudo label="PARTIDO" valor={moPct} color={c.orange} />
      </div>
    </Card>
  );
}

function PlayerDetailScreen({ player, entries, loading, onBack, onEditPlayer, onNew, onOpenEntry, onOpenStats, canWrite = true }) {
  const sorted = [...entries].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  return (
    <Shell>
      <TopBar title={player.nombre || "Jugador"} onBack={onBack} />

      <StatusJugador entries={entries} />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>Ficha del jugador</div>
          <button
            onClick={onEditPlayer}
            style={{ background: "none", border: `1px solid ${c.cardEdge}`, color: c.textDim, borderRadius: 6, fontSize: 11, padding: "4px 8px", cursor: "pointer" }}
          >
            Editar
          </button>
        </div>

        <InfoLine label="Fecha de nacimiento" value={player.fechaNacimiento} />
        <InfoLine label="Posición principal" value={player.posicionPrincipal} />
        <InfoLine label="Posición alternativa" value={player.posicionAlternativa} />
        <InfoLine label="Club actual" value={player.clubActual} />
        <InfoLine label="Nivel inicial" value={player.nivelInicial} />
        <InfoLine label="Situación actual" value={player.situacionActual} />
        <InfoLine label="Pie hábil" value={player.pieHabil} />

        {player.plazoObjetivo?.includes("Corto plazo") && (
          <TextBlock label="Objetivo de corto plazo" value={player.objetivoCorto} />
        )}
        {player.plazoObjetivo?.includes("Largo plazo") && (
          <TextBlock label="Objetivo de largo plazo" value={player.objetivoLargo} />
        )}

        {!player.fechaNacimiento &&
          !player.posicionPrincipal &&
          !player.posicionAlternativa &&
          !player.clubActual &&
          !player.nivelInicial &&
          !player.situacionActual && (
            <div style={{ fontSize: 12, color: c.textDim }}>Todavía no hay datos cargados en la ficha.</div>
          )}
      </Card>

      {player.clubesAnteriores?.some((cl) => cl.club) && (
        <Card>
          <div style={{ fontSize: 12, color: c.textDim, marginBottom: 8, fontWeight: 700 }}>Clubes anteriores</div>
          {player.clubesAnteriores.filter((cl) => cl.club).map((cl) => (
            <div key={cl.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: c.text }}>{cl.club}</span>
              <span style={{ fontSize: 11, color: c.textDim }}>
                {cl.desde || "?"} — {cl.hasta || "actualidad"}
              </span>
            </div>
          ))}
        </Card>
      )}

      {player.horariosClub?.some((h) => h.horario) && (
        <Card>
          <div style={{ fontSize: 12, color: c.textDim, marginBottom: 8, fontWeight: 700 }}>Entrenamiento en el club</div>
          {player.horariosClub.filter((h) => h.horario).map((h) => (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: c.text }}>{h.dia}</span>
              <span style={{ fontSize: 11, color: c.textDim }}>{h.horario}</span>
            </div>
          ))}
        </Card>
      )}

      {player.horariosCarf?.some((h) => h.horario) && (
        <Card>
          <div style={{ fontSize: 12, color: c.textDim, marginBottom: 8, fontWeight: 700 }}>Entrenamiento en C.A.R.F.</div>
          {player.horariosCarf.filter((h) => h.horario).map((h) => (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: c.text }}>{h.dia}</span>
              <span style={{ fontSize: 11, color: c.textDim }}>{h.horario}</span>
            </div>
          ))}
        </Card>
      )}

      {canWrite ? (
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={() => onNew("sesion")} style={pillBtn(c.celeste)}>+ Sesión</button>
          <button onClick={() => onNew("partido")} style={pillBtn(c.orange)}>+ Partido</button>
          <button onClick={() => onNew("zona")} style={pillBtn(c.yellow)}>+ Zonas</button>
        </div>
      ) : (
        <div style={{ color: c.textDim, fontSize: 11, marginBottom: 8, padding: "6px 2px" }}>
          Tu prueba gratuita venció — activá un medio de pago para cargar sesiones, partidos o zonas nuevas.
        </div>
      )}

      <button
        onClick={onOpenStats}
        style={{
          width: "100%",
          background: "rgba(255,229,0,0.08)",
          border: `1px solid rgba(255,229,0,0.3)`,
          color: c.yellow,
          borderRadius: 10,
          fontSize: 12.5,
          fontWeight: 700,
          padding: "10px 0",
          cursor: "pointer",
          marginBottom: 16,
        }}
      >
        📊 Ver estadísticas (semanal / mensual / anual)
      </button>

      <SectionTitle>Historial</SectionTitle>
      {loading && <div style={{ color: c.textDim, fontSize: 13 }}>Cargando...</div>}
      {!loading && sorted.length === 0 && (
        <div style={{ color: c.textDim, fontSize: 13 }}>Todavía no hay entradas cargadas.</div>
      )}
      {sorted.map((e) => (
        <div
          key={e.id}
          onClick={() => onOpenEntry(e)}
          style={{
            background: c.card,
            border: `1px solid ${c.cardEdge}`,
            borderLeft: `3px solid ${tipoColor(e.tipo)}`,
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 6,
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: c.text }}>{tipoLabel(e.tipo)}</span>
            <span style={{ fontSize: 11, color: c.textDim }}>{e.fecha}</span>
          </div>
          {e.resumen && <div style={{ fontSize: 11.5, color: c.textDim, marginTop: 3 }}>{e.resumen}</div>}
        </div>
      ))}
    </Shell>
  );
}

function pillBtn(accent) {
  return {
    flex: 1,
    background: "none",
    border: `1.5px solid ${accent}`,
    color: accent,
    borderRadius: 20,
    fontSize: 12.5,
    fontWeight: 700,
    padding: "8px 4px",
    cursor: "pointer",
  };
}

// =====================================================================
// NUEVA SESIÓN DE ENTRENAMIENTO
// =====================================================================
const fisicoItems = ["Resistencia", "Velocidad", "Fuerza", "Coordinación", "Pliometría", "Elongación"];
const tecnicoGroups = {
  Pase: ["Corto", "Medio", "Largo", "En altura", "Cambios de frente"],
  Control: ["Fijo", "Orientado", "Muslo", "Pecho", "En altura"],
  Conducción: ["Normal", "Planta del pie"],
  Dribbling: ["Gambeta", "Frenos", "Con fantasía", "1 vs 1"],
  Remate: ["Borde interno", "Empeine", "Borde externo", "Volea", "Sobrepique"],
  Cabezazo: ["Estático", "Con salto", "Pase", "Remate"],
};

function ladosFor(group) {
  return group === "Cabezazo" ? ["Frontal", "Parietal derecho", "Parietal izquierdo"] : ["Derecha", "Izquierda"];
}
function ladoAbbrev(lado) {
  const map = { "Derecha": "D", "Izquierda": "I", "Frontal": "F", "Parietal derecho": "PD", "Parietal izquierdo": "PI" };
  return map[lado] || lado[0];
}
const cognitivoItems = ["Concentración", "Toma de decisiones", "Vista periférica", "Entendimiento de consignas", "Comportamiento", "Actitud", "Temporización"];
const tacticoItems = ["Triangulaciones", "Tercer hombre", "Paredes", "Entendimiento de sistemas", "Basculación", "Relevos", "Desdoblamiento", "Movimientos ofensivos", "Movimientos defensivos", "Pressing"];
const tiposActividad = ["Entrenamiento", "Fútbol Reducido", "Fútbol 9", "Fútbol 11"];
const formatosReducido = ["2 vs 2", "3 vs 3", "4 vs 4", "5 vs 5", "7 vs 7"];
const lugares = ["Club", "C.A.R.F."];

// =====================================================================
// EVALUACIÓN C.A.R.F. — planilla exclusiva del entrenador
// =====================================================================
const CATEGORIAS_EVAL_CARF = {
  "Coordinación": ["Toco y piso 2P", "Toco y piso 1 der.", "Toco y piso 1 izq.", "Batucada", "Paso elong."],
  "Velocidad": ["Velocidad s/ pelota", "Velocidad c/ pelota", "Vel. reacción c/p", "Vel. reacción c/p (2)"],
  "Control": ["Control fijo der.", "Control fijo izq.", "Control or. der", "Control or. izq", "Control pecho", "Control muslo der.", "Control muslo izq."],
  "Pase": ["Pase borde int. der.", "Pase borde int. izq.", "Pase largo alt. der.", "Pase largo alt. izq."],
  "Amague": ["Bicicleta simple h- der.", "Bicicleta simple h- izq.", "Bicicleta doble", "Bicicleta x4", "Amague corporal", "Okocha der.", "Okocha izq."],
  "Dribbling": ["Dribbling derecha", "Dribbling izquierda", "Dribbling combinado", "Pie a pie"],
  "Remate": [
    "Remate bi der. 1P", "Remate bi izq. 1P", "Remate emp der. cruz.", "Remate emp izq. cruz.",
    "Remate 3D der.", "Remate 3D izq.", "Remate rosca arr. der.", "Remate rosca arr. izq.",
    "Remate rosca aba. der.", "Remate rosca aba. izq.", "Remate empeine der.", "Remate empeine izq.",
    "Volea der.", "Volea izq.", "Remate alt. pique prev.", "Vaselina", "Picada",
  ],
  "Cabezazo": ["Cabezazo frontal", "Cabezazo parietal der.", "Cabezazo parietal izq.", "Elevación p/ cabecear", "Técnica cabezazo", "Saltabilidad"],
  "Cognición": ["Vista periférica", "Memoria", "Concentración", "Actitud", "Intensidad", "Toma de decisiones", "Control frustración", "Perfilamiento", "Desmarque"],
};
const CATEGORIA_COLORES = {
  "Coordinación": c.celeste, "Velocidad": c.orange, "Control": c.yellow, "Pase": c.celeste,
  "Amague": c.orange, "Dribbling": c.yellow, "Remate": c.celeste, "Cabezazo": c.orange, "Cognición": c.yellow,
};

function emptyEvalAttempts() {
  const o = {};
  Object.entries(CATEGORIAS_EVAL_CARF).forEach(([, items]) => items.forEach((i) => { o[i] = emptyAttempts(); }));
  return o;
}
function evalTotals(attempts) {
  let correct = 0, failed = 0;
  Object.values(attempts).forEach((states) => {
    const r = countStates(states);
    correct += r.correct;
    failed += r.failed;
  });
  return { correct, failed };
}

function EvaluacionCarfScreen({ players, onBack, onSaveOne, userId }) {
  const [seleccionados, setSeleccionados] = useState([]);
  const [paso, setPaso] = useState("elegir"); // "elegir" | "completar" | "listo"
  const [activo, setActivo] = useState(null); // id del jugador que se está marcando ahora
  const [fecha, setFecha] = useState(todayISO());
  const [turno, setTurno] = useState("");
  const [open, setOpen] = useState({});
  const [attemptsByPlayer, setAttemptsByPlayer] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [enviados, setEnviados] = useState([]); // ids ya guardados con éxito

  const toggleSel = (id) => setSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleOpen = (k) => setOpen((p) => ({ ...p, [k]: !p[k] }));
  const toggleDot = (item, i, v) =>
    setAttemptsByPlayer((prev) => ({
      ...prev,
      [activo]: { ...prev[activo], [item]: prev[activo][item].map((s, idx2) => (idx2 === i ? v : s)) },
    }));

  const jugadorActivo = players.find((p) => p.id === activo);
  const attemptsActivo = attemptsByPlayer[activo] || emptyEvalAttempts();
  const { correct, failed } = evalTotals(attemptsActivo);
  const marked = correct + failed;
  const pct = marked > 0 ? Math.round((correct / marked) * 100) : 0;

  const empezarCompletar = () => {
    if (seleccionados.length === 0) return;
    const init = {};
    seleccionados.forEach((id) => { init[id] = emptyEvalAttempts(); });
    setAttemptsByPlayer(init);
    setActivo(seleccionados[0]);
    setEnviados([]);
    setPaso("completar");
  };

  const guardarYEnviarTodos = async () => {
    setErrorMsg("");
    setGuardando(true);
    const yaEnviados = [...enviados];
    for (const playerId of seleccionados) {
      if (yaEnviados.includes(playerId)) continue;
      const at = attemptsByPlayer[playerId] || emptyEvalAttempts();
      const totalesJugador = evalTotals(at);
      const m2 = totalesJugador.correct + totalesJugador.failed;
      const p2 = m2 > 0 ? Math.round((totalesJugador.correct / m2) * 100) : 0;
      const entry = {
        id: uid(),
        tipo: "evaluacion_carf",
        fecha,
        resumen: `Turno ${turno || "-"} · ${p2}% efectividad`,
        data: { turno, attempts: at, totales: { correct: totalesJugador.correct, failed: totalesJugador.failed, pct: p2 } },
      };
      try {
        await onSaveOne(playerId, entry);
        yaEnviados.push(playerId);
        setEnviados([...yaEnviados]);
      } catch (e) {
        console.error(e);
        const nombreFallido = players.find((p) => p.id === playerId)?.nombre || "un jugador";
        setErrorMsg(`No se pudo guardar la evaluación de ${nombreFallido}. Los demás ya se guardaron bien — volvé a tocar el botón para reintentar solo este.`);
        setGuardando(false);
        return;
      }
    }
    setGuardando(false);
    setPaso("listo");
  };

  if (paso === "listo") {
    return (
      <Shell>
        <TopBar title="Evaluación C.A.R.F." onBack={onBack} />
        <div style={{ textAlign: "center", padding: "30px 10px" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>✅</div>
          <div style={{ color: c.text, fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
            ¡Listo! Se envió la evaluación a {seleccionados.length === 1 ? "la familia" : `las ${seleccionados.length} familias`}.
          </div>
          <div style={{ color: c.textDim, fontSize: 12 }}>Ya quedó cargada en la ficha de cada jugador, sin poder editarse.</div>
        </div>
        <PrimaryButton onClick={onBack}>Volver al inicio</PrimaryButton>
      </Shell>
    );
  }

  if (paso === "elegir") {
    return (
      <Shell>
        <TopBar title="Evaluación C.A.R.F." onBack={onBack} />
        <div style={{ color: c.textDim, fontSize: 11.5, marginBottom: 14, lineHeight: 1.5 }}>
          Elegí a los jugadores del turno de hoy. Vas a verlos a todos juntos, en pestañas, para ir marcando a cada uno mientras entrenan, sin tener que ir y volver — recién al final se guarda y se envía todo junto.
        </div>
        {players.length === 0 && <div style={{ color: c.textDim, fontSize: 13 }}>Todavía no hay jugadores cargados.</div>}
        {players.map((p) => (
          <div
            key={p.id}
            onClick={() => toggleSel(p.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: c.card,
              border: `1px solid ${seleccionados.includes(p.id) ? c.correct : c.cardEdge}`,
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 8,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                border: `1.5px solid ${seleccionados.includes(p.id) ? c.correct : c.cardEdge}`,
                background: seleccionados.includes(p.id) ? c.correct : "transparent",
                flexShrink: 0,
              }}
            />
            <div style={{ color: c.text, fontSize: 13, fontWeight: 700 }}>{p.nombre || "Sin nombre"}</div>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <FieldLabel>Turno (lo escribís vos)</FieldLabel>
          <TextInput value={turno} onChange={(e) => setTurno(e.target.value)} placeholder="Ej: Turno 1" />
        </div>
        <div style={{ marginTop: 12 }}>
          <FieldLabel>Fecha</FieldLabel>
          <TextInput type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <PrimaryButton onClick={empezarCompletar}>
          {seleccionados.length === 0 ? "Elegí al menos un jugador" : `Empezar (${seleccionados.length} jugador${seleccionados.length > 1 ? "es" : ""})`}
        </PrimaryButton>
      </Shell>
    );
  }

  // paso === "completar"
  return (
    <Shell>
      <TopBar title="Evaluación C.A.R.F." onBack={onBack} />
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 8 }}>
          <img src={MVP_FULL_LOGO_B64} alt="Mi MVP" style={{ height: 34 }} />
          <img src={LOGO_PLACEHOLDER} alt="C.A.R.F." style={{ height: 34 }} />
        </div>
        <div style={{ color: c.yellow, fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>EVALUACIÓN C.A.R.F.</div>
        <div style={{ color: c.textDim, fontSize: 11, marginTop: 2 }}>{fecha} · Turno {turno || "-"}</div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {seleccionados.map((id) => {
          const p = players.find((pl) => pl.id === id);
          const at = attemptsByPlayer[id] || {};
          const r = evalTotals(at);
          const m = r.correct + r.failed;
          const yaEnviado = enviados.includes(id);
          return (
            <button
              key={id}
              onClick={() => setActivo(id)}
              style={{
                border: `1.5px solid ${activo === id ? c.yellow : yaEnviado ? c.correct : c.cardEdge}`,
                background: activo === id ? c.yellow : "transparent",
                color: activo === id ? "#0A0A0A" : yaEnviado ? c.correct : c.text,
                borderRadius: 20,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {yaEnviado ? "✓ " : ""}
              {p?.nombre || "Jugador"} {m > 0 && !yaEnviado ? `(${m})` : ""}
            </button>
          );
        })}
      </div>

      {jugadorActivo && (
        <div style={{ color: c.text, fontSize: 14, fontWeight: 700, marginBottom: 8, textAlign: "center" }}>{jugadorActivo.nombre}</div>
      )}

      {enviados.includes(activo) && (
        <div style={{ color: c.correct, fontSize: 11.5, textAlign: "center", marginBottom: 10 }}>
          Esta evaluación ya se envió — no se puede editar.
        </div>
      )}

      {Object.entries(CATEGORIAS_EVAL_CARF).map(([categoria, items]) => {
        let catCorrect = 0, catFailed = 0;
        items.forEach((i) => { const r = countStates(attemptsActivo[i]); catCorrect += r.correct; catFailed += r.failed; });
        const catMarked = catCorrect + catFailed;
        const catPct = catMarked > 0 ? Math.round((catCorrect / catMarked) * 100) : 0;
        const isOpen = !!open[categoria];
        return (
          <Card key={categoria} style={{ marginBottom: 8 }}>
            <div onClick={() => toggleOpen(categoria)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div style={{ color: CATEGORIA_COLORES[categoria] || c.text, fontWeight: 700, fontSize: 13 }}>{categoria}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 10.5, color: c.textDim }}>
                  {catCorrect}✓ / {catFailed}✗ {catMarked > 0 ? `· ${catPct}%` : ""}
                </div>
                <span style={{ color: c.textDim, fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
              </div>
            </div>
            {isOpen && (
              <div style={{ marginTop: 10 }}>
                {items.map((item) => (
                  <ItemRow
                    key={item}
                    label={item}
                    states={attemptsActivo[item]}
                    onSetState={enviados.includes(activo) ? () => {} : (i, v) => toggleDot(item, i, v)}
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: c.text, fontWeight: 700 }}>
          <span>Total ({jugadorActivo?.nombre}): {correct} logrados / {failed} a trabajar</span>
          <span>{marked > 0 ? `${pct}%` : "—"}</span>
        </div>
      </Card>

      {errorMsg && <div style={{ color: c.failed, fontSize: 12, padding: "8px 2px" }}>{errorMsg}</div>}

      <PrimaryButton onClick={guardarYEnviarTodos} disabled={guardando}>
        {guardando ? "Guardando..." : `Guardar y enviar a los ${seleccionados.length} jugadores`}
      </PrimaryButton>
    </Shell>
  );
}

function EvaluacionCarfSummary({ data }) {
  const attempts = data.attempts || {};
  return (
    <>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 6 }}>
          <img src={MVP_FULL_LOGO_B64} alt="Mi MVP" style={{ height: 28 }} />
          <img src={LOGO_PLACEHOLDER} alt="C.A.R.F." style={{ height: 28 }} />
        </div>
        <div style={{ color: c.yellow, fontWeight: 800, fontSize: 13 }}>EVALUACIÓN C.A.R.F.</div>
        <div style={{ color: c.textDim, fontSize: 11 }}>Turno {data.turno || "-"}</div>
      </div>

      {Object.entries(CATEGORIAS_EVAL_CARF).map(([categoria, items]) => {
        let catCorrect = 0, catFailed = 0;
        items.forEach((i) => { const r = countStates(attempts[i] || []); catCorrect += r.correct; catFailed += r.failed; });
        const catMarked = catCorrect + catFailed;
        if (catMarked === 0) return null;
        const catPct = Math.round((catCorrect / catMarked) * 100);
        return (
          <Card key={categoria} style={{ marginBottom: 8 }}>
            <div style={{ color: CATEGORIA_COLORES[categoria] || c.text, fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>
              {categoria} <span style={{ color: c.textDim, fontWeight: 500, fontSize: 10.5 }}>({catCorrect}✓ / {catFailed}✗ · {catPct}%)</span>
            </div>
            {items.map((item) => {
              const states = attempts[item] || [];
              const r = countStates(states);
              if (r.correct + r.failed === 0) return null;
              return <ItemRow key={item} label={item} states={states} onSetState={() => {}} />;
            })}
          </Card>
        );
      })}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: c.text, fontWeight: 700 }}>
          <span>Total: {data.totales?.correct ?? 0} logrados / {data.totales?.failed ?? 0} a trabajar</span>
          <span>{data.totales?.pct != null ? `${data.totales.pct}%` : "—"}</span>
        </div>
      </Card>
    </>
  );
}

function NuevaSesionScreen({ onBack, onSave, isCoach }) {
  const [nombreDT, setNombreDT] = useState("Alejandro Parra");
  const [fecha, setFecha] = useState(todayISO());
  const [lugar, setLugarRaw] = useState("Club");
  const setLugar = (l) => {
    if (l === "C.A.R.F." && !isCoach) return; // sólo el entrenador carga sesiones de C.A.R.F.
    setLugarRaw(l);
  };
  const [tipoActividad, setTipoActividad] = useState("Entrenamiento");
  const [posicionJugada, setPosicionJugada] = useState("");
  const [formatoReducido, setFormatoReducido] = useState(null);
  const [goles, setGoles] = useState("");
  const [asistencias, setAsistencias] = useState("");
  const [evaluacionPropia, setEvaluacionPropia] = useState("");
  const [evaluacionEntrenador, setEvaluacionEntrenador] = useState("");
  const [open, setOpen] = useState({ fisico: true, tecnico: false, cognitivo: false, tactico: false });

  const [fisicoAttempts, setFisicoAttempts] = useState(Object.fromEntries(fisicoItems.map((i) => [i, emptyAttempts()])));
  const [fisicoIntensidad, setFisicoIntensidad] = useState(Object.fromEntries(fisicoItems.map((i) => [i, null])));
  const [tecnicoAttempts, setTecnicoAttempts] = useState(
    Object.fromEntries(
      Object.entries(tecnicoGroups).flatMap(([g, o]) =>
        o.map((op) => [`${g}::${op}`, Object.fromEntries(ladosFor(g).map((lado) => [lado, emptyAttempts()]))])
      )
    )
  );
  const [cognitivoAttempts, setCognitivoAttempts] = useState(Object.fromEntries(cognitivoItems.map((i) => [i, emptyAttempts()])));
  const [tacticoAttempts, setTacticoAttempts] = useState(Object.fromEntries(tacticoItems.map((i) => [i, emptyAttempts()])));

  const toggleOpen = (k) => setOpen((p) => ({ ...p, [k]: !p[k] }));
  const toggleDot = (setter, key, i, v) => setter((prev) => { const a = [...prev[key]]; a[i] = v; return { ...prev, [key]: a }; });
  const toggleDotPierna = (key, pierna, i, v) =>
    setTecnicoAttempts((prev) => ({ ...prev, [key]: { ...prev[key], [pierna]: prev[key][pierna].map((s, idx) => (idx === i ? v : s)) } }));

  const totals = () => {
    let correct = 0, failed = 0;
    fisicoItems.forEach((i) => { const r = countStates(fisicoAttempts[i]); correct += r.correct; failed += r.failed; });
    Object.values(tecnicoAttempts).forEach((v) => {
      Object.values(v).forEach((states) => {
        const r = countStates(states);
        correct += r.correct;
        failed += r.failed;
      });
    });
    cognitivoItems.forEach((i) => { const r = countStates(cognitivoAttempts[i]); correct += r.correct; failed += r.failed; });
    tacticoItems.forEach((i) => { const r = countStates(tacticoAttempts[i]); correct += r.correct; failed += r.failed; });
    return { correct, failed };
  };
  const t = totals();
  const marked = t.correct + t.failed;
  const pct = marked > 0 ? Math.round((t.correct / marked) * 100) : 0;

  const handleSave = () => {
    const resumen = marked > 0 ? `${lugar} · ${tipoActividad} · ${pct}% efectividad` : `${lugar} · ${tipoActividad}`;
    onSave({
      id: uid(),
      tipo: "sesion",
      fecha,
      resumen,
      data: {
        nombreDT, lugar, tipoActividad, formatoReducido, posicionJugada, goles, asistencias,
        evaluacionPropia, evaluacionEntrenador,
        fisicoAttempts, fisicoIntensidad, tecnicoAttempts, cognitivoAttempts, tacticoAttempts,
        totales: { ...t, pct },
      },
    });
  };

  return (
    <Shell>
      <TopBar title="Nueva sesión" onBack={onBack} />

      <FieldLabel>Apellido y nombre DT</FieldLabel>
      <TextInput value={nombreDT} onChange={(e) => setNombreDT(e.target.value)} />

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Fecha</FieldLabel>
          <TextInput type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div style={{ flex: 1.3 }}>
          <FieldLabel>Lugar de entrenamiento</FieldLabel>
          <div style={{ display: "flex", gap: 6 }}>
            {lugares.map((l) => (
              <Chip key={l} label={l} active={lugar === l} accent={c.celeste} disabled={l === "C.A.R.F." && !isCoach} onClick={() => setLugar(l)} />
            ))}
          </div>
          {!isCoach && (
            <div style={{ fontSize: 10, color: c.textDim, marginTop: 4 }}>Las sesiones en C.A.R.F. las carga el entrenador.</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <FieldLabel>Tipo de actividad</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {tiposActividad.map((t2) => (
            <Chip key={t2} label={t2} active={tipoActividad === t2} accent={c.yellow} onClick={() => setTipoActividad(t2)} />
          ))}
        </div>

        {(tipoActividad === "Fútbol Reducido" || tipoActividad === "Fútbol 9" || tipoActividad === "Fútbol 11") && (
          <Card style={{ marginTop: 10 }}>
            {tipoActividad === "Fútbol Reducido" && (
              <div style={{ marginBottom: 10 }}>
                <FieldLabel>Formato</FieldLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {formatosReducido.map((f) => (
                    <Chip key={f} label={f} active={formatoReducido === f} accent={c.celeste} onClick={() => setFormatoReducido(f)} />
                  ))}
                </div>
              </div>
            )}
            <FieldLabel>Posición en la que jugó</FieldLabel>
            <TextInput value={posicionJugada} onChange={(e) => setPosicionJugada(e.target.value)} placeholder="Ej: Volante central" />
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>Goles</FieldLabel>
                <TextInput type="number" min="0" value={goles} onChange={(e) => setGoles(e.target.value)} placeholder="0" />
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel>Asistencias</FieldLabel>
                <TextInput type="number" min="0" value={asistencias} onChange={(e) => setAsistencias(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <FieldLabel>Evaluación propia — cómo se vio el jugador (o quien presenció)</FieldLabel>
              <TextArea rows={2} value={evaluacionPropia} onChange={(e) => setEvaluacionPropia(e.target.value)} placeholder="Observación..." />
            </div>
          </Card>
        )}
      </div>

      {lugar === "C.A.R.F." && isCoach && (
        <Card>
          <FieldLabel>Evaluación del entrenador</FieldLabel>
          <TextArea rows={2} value={evaluacionEntrenador} onChange={(e) => setEvaluacionEntrenador(e.target.value)} placeholder="Observación general de esta sesión..." />
        </Card>
      )}

      <SectionTitle>Entrenamiento realizado</SectionTitle>
      <div style={{ fontSize: 10.5, color: c.textDim, marginBottom: 8 }}>Clic = logrado · doble clic = a trabajar</div>

      <Card>
        <div onClick={() => toggleOpen("fisico")} style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", marginBottom: open.fisico ? 10 : 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: c.celeste }}>Físico</span>
          <span style={{ color: c.textDim }}>{open.fisico ? "▲" : "▼"}</span>
        </div>
        {open.fisico && fisicoItems.map((item) => (
          <div key={item}>
            <ItemRow label={item} states={fisicoAttempts[item]} onSetState={(i, v) => toggleDot(setFisicoAttempts, item, i, v)} />
            {fisicoAttempts[item].some((s) => s !== "pending") && (
              <div style={{ display: "flex", gap: 6, marginTop: -6, marginBottom: 12 }}>
                {["Baja", "Media", "Alta"].map((lvl) => (
                  <button key={lvl} onClick={() => setFisicoIntensidad((p) => ({ ...p, [item]: lvl }))}
                    style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 6, border: `1px solid ${fisicoIntensidad[item] === lvl ? c.celeste : "rgba(255,255,255,0.15)"}`, background: fisicoIntensidad[item] === lvl ? `${c.celeste}22` : "transparent", color: fisicoIntensidad[item] === lvl ? c.celeste : c.textDim, cursor: "pointer" }}>
                    {lvl}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </Card>

      <Card>
        <div onClick={() => toggleOpen("tecnico")} style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", marginBottom: open.tecnico ? 10 : 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: c.yellow }}>Técnico</span>
          <span style={{ color: c.textDim }}>{open.tecnico ? "▲" : "▼"}</span>
        </div>
        {open.tecnico && Object.entries(tecnicoGroups).map(([group, opts]) => (
          <div key={group} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: c.yellow, marginBottom: 6, fontWeight: 700 }}>{group}</div>
            {opts.map((opt) => {
              const key = `${group}::${opt}`;
              const lados = ladosFor(group);
              const totalCorrect = lados.reduce((s, l) => s + countStates(tecnicoAttempts[key][l]).correct, 0);
              const totalFailed = lados.reduce((s, l) => s + countStates(tecnicoAttempts[key][l]).failed, 0);
              return (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12.5, color: c.text, marginBottom: 5 }}>
                    {opt}
                    <MiniCount correct={totalCorrect} failed={totalFailed} />
                  </div>
                  {lados.map((lado) => (
                    <div key={lado} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 9.5, color: c.textDim, width: 18 }}>{ladoAbbrev(lado)}</span>
                      <AttemptDots states={tecnicoAttempts[key][lado]} onSetState={(i, v) => toggleDotPierna(key, lado, i, v)} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </Card>

      <Card>
        <div onClick={() => toggleOpen("cognitivo")} style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", marginBottom: open.cognitivo ? 10 : 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: c.orange }}>Cognitivo</span>
          <span style={{ color: c.textDim }}>{open.cognitivo ? "▲" : "▼"}</span>
        </div>
        {open.cognitivo && cognitivoItems.map((item) => (
          <ItemRow key={item} label={item} states={cognitivoAttempts[item]} onSetState={(i, v) => toggleDot(setCognitivoAttempts, item, i, v)} />
        ))}
      </Card>

      <Card>
        <div onClick={() => toggleOpen("tactico")} style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", marginBottom: open.tactico ? 10 : 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: c.red }}>Táctico</span>
          <span style={{ color: c.textDim }}>{open.tactico ? "▲" : "▼"}</span>
        </div>
        {open.tactico && tacticoItems.map((item) => (
          <ItemRow key={item} label={item} states={tacticoAttempts[item]} onSetState={(i, v) => toggleDot(setTacticoAttempts, item, i, v)} />
        ))}
      </Card>

      <Card>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.correct }}>{t.correct}</div>
            <div style={{ fontSize: 9.5, color: c.textDim }}>LOGRADOS</div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.failed }}>{t.failed}</div>
            <div style={{ fontSize: 9.5, color: c.textDim }}>A TRABAJAR</div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: c.yellow }}>{marked > 0 ? `${pct}%` : "—"}</div>
            <div style={{ fontSize: 9.5, color: c.textDim }}>EFECTIVIDAD</div>
          </div>
        </div>
      </Card>

      <PrimaryButton onClick={handleSave}>Guardar sesión</PrimaryButton>
    </Shell>
  );
}

// =====================================================================
// NUEVO PARTIDO (Competencia)
// =====================================================================
const condiciones = ["Local", "Visitante", "Cancha neutral"];
const titularSuplente = ["Titular", "Suplente"];
const resultados = ["Ganó", "Empató", "Perdió"];
const tarjetas = ["Sin tarjeta", "Amarilla", "Roja"];
const itemsSimples = ["Pases", "Dribbling", "Quites"];
const remates = ["Al arco", "Desviados"];
const cabezazos = ["Ofensivo", "Defensivo"];
const pelotaParada = ["Penal", "Tiro libre", "Corner"];
const finales = ["Goles", "Asistencias"];

// pesos especiales: un gol/asistencia vale más que un ítem cualquiera
const PESO_GOL_PARTIDO = 10;
const PESO_ASISTENCIA_PARTIDO = 5;
const PESO_GOL_ENTRENAMIENTO = 5; // solo cuenta en Fútbol 9 / Fútbol 11
const PESO_ASISTENCIA_ENTRENAMIENTO = 3; // solo cuenta en Fútbol 9 / Fútbol 11

function buildInitialAttempts() {
  const all = [...itemsSimples, ...remates.map((r) => `Remate::${r}`), ...cabezazos.map((z) => `Cabezazo::${z}`), ...pelotaParada.map((p) => `Pelota parada::${p}`), ...finales];
  return Object.fromEntries(all.map((k) => [k, emptyAttempts()]));
}

function NuevoPartidoScreen({ onBack, onSave }) {
  const [fecha, setFecha] = useState(todayISO());
  const [clubRival, setClubRival] = useState("");
  const [condicion, setCondicion] = useState(null);
  const [cancha, setCancha] = useState("");
  const [sistemaUtilizado, setSistemaUtilizado] = useState("");
  const [posicion1, setPosicion1] = useState("");
  const [posicion2, setPosicion2] = useState("");
  const [condicionJuego, setCondicionJuego] = useState(null);
  const [minutosJugados, setMinutosJugados] = useState("");
  const [tarjeta, setTarjeta] = useState("Sin tarjeta");
  const [resultado, setResultado] = useState(null);
  const [marcador, setMarcador] = useState("");
  const [evaluacion, setEvaluacion] = useState("");
  const [attempts, setAttempts] = useState(buildInitialAttempts());

  const setDot = (key, i, v) => setAttempts((prev) => { const a = [...prev[key]]; a[i] = v; return { ...prev, [key]: a }; });

  const handleSave = () => {
    const resumen = [clubRival && `vs ${clubRival}`, resultado, marcador].filter(Boolean).join(" · ");
    onSave({
      id: uid(),
      tipo: "partido",
      fecha,
      resumen,
      data: { clubRival, condicion, cancha, sistemaUtilizado, posicion1, posicion2, condicionJuego, minutosJugados, tarjeta, resultado, marcador, evaluacion, attempts },
    });
  };

  return (
    <Shell>
      <TopBar title="Nuevo partido" onBack={onBack} />

      <FieldLabel>Fecha</FieldLabel>
      <TextInput type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />

      <div style={{ marginTop: 12 }}>
        <FieldLabel>Club rival</FieldLabel>
        <TextInput value={clubRival} onChange={(e) => setClubRival(e.target.value)} placeholder="Nombre del club rival" />
      </div>

      <div style={{ marginTop: 12 }}>
        <FieldLabel>Cancha</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {condiciones.map((cnd) => (
            <Chip key={cnd} label={cnd} active={condicion === cnd} accent={c.celeste} onClick={() => setCondicion(cnd)} />
          ))}
        </div>
        <TextInput value={cancha} onChange={(e) => setCancha(e.target.value)} placeholder="Nombre / dirección (opcional)" />
      </div>

      <div style={{ marginTop: 12 }}>
        <FieldLabel>Sistema utilizado</FieldLabel>
        <TextInput value={sistemaUtilizado} onChange={(e) => setSistemaUtilizado(e.target.value)} placeholder="Ej: 4-3-3" />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Posición 1</FieldLabel>
          <TextInput value={posicion1} onChange={(e) => setPosicion1(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel>Posición 2</FieldLabel>
          <TextInput value={posicion2} onChange={(e) => setPosicion2(e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <FieldLabel>Tiempo jugado</FieldLabel>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {titularSuplente.map((t2) => (
            <Chip key={t2} label={t2} active={condicionJuego === t2} accent={c.orange} onClick={() => setCondicionJuego(t2)} />
          ))}
        </div>
        <TextInput type="number" min="0" max="120" value={minutosJugados} onChange={(e) => setMinutosJugados(e.target.value)} placeholder="Minutos jugados" />
      </div>

      <SectionTitle>Ítems del partido</SectionTitle>
      <div style={{ fontSize: 10.5, color: c.textDim, marginBottom: 8 }}>Clic = logrado · doble clic = falló</div>
      <Card>
        {itemsSimples.map((item) => (
          <ItemRow key={item} label={item} states={attempts[item]} onSetState={(i, v) => setDot(item, i, v)} />
        ))}
        <div style={{ fontSize: 12, color: c.yellow, fontWeight: 700, marginTop: 4, marginBottom: 6 }}>Remates</div>
        {remates.map((r) => { const k = `Remate::${r}`; return <ItemRow key={k} label={r} states={attempts[k]} onSetState={(i, v) => setDot(k, i, v)} />; })}
        <div style={{ fontSize: 12, color: c.yellow, fontWeight: 700, marginTop: 4, marginBottom: 6 }}>Cabezazo</div>
        {cabezazos.map((z) => { const k = `Cabezazo::${z}`; return <ItemRow key={k} label={z} states={attempts[k]} onSetState={(i, v) => setDot(k, i, v)} />; })}
        <div style={{ fontSize: 12, color: c.yellow, fontWeight: 700, marginTop: 4, marginBottom: 6 }}>Pelota parada</div>
        {pelotaParada.map((p) => { const k = `Pelota parada::${p}`; return <ItemRow key={k} label={p} states={attempts[k]} onSetState={(i, v) => setDot(k, i, v)} />; })}
        <div style={{ fontSize: 12, color: c.yellow, fontWeight: 700, marginTop: 4, marginBottom: 6 }}>Definición</div>
        {finales.map((f) => (
          <ItemRow key={f} label={f} states={attempts[f]} onSetState={(i, v) => setDot(f, i, v)} />
        ))}
      </Card>

      <SectionTitle>Tarjeta</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {tarjetas.map((t2) => (
          <Chip key={t2} label={t2} active={tarjeta === t2} accent={t2 === "Roja" ? c.red : t2 === "Amarilla" ? c.yellow : c.celeste} onClick={() => setTarjeta(t2)} />
        ))}
      </div>

      <SectionTitle>Resultado del partido</SectionTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {resultados.map((r) => (
          <Chip key={r} label={r} active={resultado === r} accent={r === "Ganó" ? c.correct : r === "Perdió" ? c.failed : c.yellow} onClick={() => setResultado(r)} />
        ))}
      </div>
      <TextInput value={marcador} onChange={(e) => setMarcador(e.target.value)} placeholder="Marcador (ej: 2 - 1)" />

      <div style={{ marginTop: 12 }}>
        <FieldLabel>Evaluación</FieldLabel>
        <TextArea rows={3} value={evaluacion} onChange={(e) => setEvaluacion(e.target.value)} placeholder="Cómo se vio el jugador..." />
      </div>

      <PrimaryButton onClick={handleSave}>Guardar partido</PrimaryButton>
    </Shell>
  );
}

// =====================================================================
// ZONAS DE MOVIMIENTO
// =====================================================================
const ZCOLS = 4, ZROWS = 4, ZW = 300, ZH = 460;
const ZONE_W = ZW / ZCOLS, ZONE_H = ZH / ZROWS;

function NuevaZonaScreen({ onBack, onSave }) {
  const [fecha, setFecha] = useState(todayISO());
  const [contexto, setContexto] = useState("");
  const [zonas, setZonas] = useState(Array(ZROWS * ZCOLS).fill(false));

  const toggleZona = (idx) => setZonas((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  const marcadas = zonas.filter(Boolean).length;

  const handleSave = () => {
    onSave({
      id: uid(),
      tipo: "zona",
      fecha,
      resumen: `${marcadas} de 16 zonas${contexto ? ` · ${contexto}` : ""}`,
      data: { contexto, zonas },
    });
  };

  return (
    <Shell>
      <TopBar title="Zona de movimiento" onBack={onBack} />
      <div style={{ fontSize: 10.5, color: c.textDim, textAlign: "center", marginBottom: 14 }}>
        Tocá las zonas donde el jugador se movió mayoritariamente
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Fecha</FieldLabel>
          <TextInput type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div style={{ flex: 1.3 }}>
          <FieldLabel>Contexto</FieldLabel>
          <TextInput value={contexto} onChange={(e) => setContexto(e.target.value)} placeholder="Ej: vs. Rival" />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <svg viewBox={`0 0 ${ZW} ${ZH}`} width="100%" style={{ maxWidth: 300, borderRadius: 8, overflow: "hidden" }}>
          {Array.from({ length: ZROWS }).map((_, i) => (
            <rect key={`s${i}`} x={0} y={i * ZONE_H} width={ZW} height={ZONE_H} fill={i % 2 === 0 ? "#1C5C33" : "#1A5530"} />
          ))}
          <rect x={4} y={4} width={ZW - 8} height={ZH - 8} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
          <line x1={4} y1={ZH / 2} x2={ZW - 4} y2={ZH / 2} stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
          <circle cx={ZW / 2} cy={ZH / 2} r={38} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
          <image href={LOGO_PLACEHOLDER} x={ZW / 2 - 26} y={ZH / 2 - 26} width={52} height={52} opacity={0.92} preserveAspectRatio="xMidYMid meet" />
          <rect x={ZW / 2 - 70} y={4} width={140} height={55} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
          <rect x={ZW / 2 - 32} y={4} width={64} height={22} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
          <rect x={ZW / 2 - 70} y={ZH - 59} width={140} height={55} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
          <rect x={ZW / 2 - 32} y={ZH - 26} width={64} height={22} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
          {Array.from({ length: ZROWS }).map((_, row) =>
            Array.from({ length: ZCOLS }).map((_, col) => {
              const idx = row * ZCOLS + col;
              return (
                <rect
                  key={idx}
                  x={col * ZONE_W}
                  y={row * ZONE_H}
                  width={ZONE_W}
                  height={ZONE_H}
                  fill={zonas[idx] ? "rgba(255,229,0,0.55)" : "transparent"}
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth={1}
                  onClick={() => toggleZona(idx)}
                  style={{ cursor: "pointer" }}
                />
              );
            })
          )}
        </svg>
      </div>

      <div style={{ textAlign: "center", fontSize: 12, color: c.textDim }}>
        {marcadas === 0 ? "Ninguna zona marcada" : `${marcadas} de 16 zonas marcadas`}
      </div>
      <div style={{ textAlign: "center", fontSize: 10, color: c.textDim, marginBottom: 4 }}>
        Arriba = arco rival · Abajo = arco propio
      </div>

      <PrimaryButton onClick={handleSave}>Guardar zonas</PrimaryButton>
    </Shell>
  );
}

// =====================================================================
// VER ENTRADA (resumen de lectura)
// =====================================================================
function ZonaCanchaReadOnly({ zonas }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
      <svg viewBox={`0 0 ${ZW} ${ZH}`} width="100%" style={{ maxWidth: 280, borderRadius: 8, overflow: "hidden" }}>
        {Array.from({ length: ZROWS }).map((_, i) => (
          <rect key={`s${i}`} x={0} y={i * ZONE_H} width={ZW} height={ZONE_H} fill={i % 2 === 0 ? "#1C5C33" : "#1A5530"} />
        ))}
        <rect x={4} y={4} width={ZW - 8} height={ZH - 8} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
        <line x1={4} y1={ZH / 2} x2={ZW - 4} y2={ZH / 2} stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
        <circle cx={ZW / 2} cy={ZH / 2} r={38} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
        <image href={LOGO_PLACEHOLDER} x={ZW / 2 - 26} y={ZH / 2 - 26} width={52} height={52} opacity={0.92} preserveAspectRatio="xMidYMid meet" />
        <rect x={ZW / 2 - 70} y={4} width={140} height={55} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
        <rect x={ZW / 2 - 32} y={4} width={64} height={22} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
        <rect x={ZW / 2 - 70} y={ZH - 59} width={140} height={55} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
        <rect x={ZW / 2 - 32} y={ZH - 26} width={64} height={22} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
        {Array.from({ length: ZROWS }).map((_, row) =>
          Array.from({ length: ZCOLS }).map((_, col) => {
            const idx = row * ZCOLS + col;
            return (
              <rect
                key={idx}
                x={col * ZONE_W}
                y={row * ZONE_H}
                width={ZONE_W}
                height={ZONE_H}
                fill={zonas[idx] ? "rgba(255,229,0,0.55)" : "transparent"}
                stroke="rgba(255,255,255,0.28)"
                strokeWidth={1}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

function InfoLine({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
      <span style={{ fontSize: 11.5, color: c.textDim }}>{label}</span>
      <span style={{ fontSize: 12, color: c.text, fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function TextBlock({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: c.textDim, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: c.text, lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

function SesionSummary({ data }) {
  const d = data;
  const noop = () => {};
  return (
    <>
      <Card>
        <InfoLine label="DT" value={d.nombreDT} />
        <InfoLine label="Lugar" value={d.lugar} />
        <InfoLine label="Actividad" value={d.tipoActividad} />
        {(d.tipoActividad === "Fútbol Reducido" || d.tipoActividad === "Fútbol 9" || d.tipoActividad === "Fútbol 11") && (
          <>
            <InfoLine label="Formato" value={d.formatoReducido} />
            <InfoLine label="Posición" value={d.posicionJugada} />
            <InfoLine label="Goles" value={d.goles} />
            <InfoLine label="Asistencias" value={d.asistencias} />
          </>
        )}
      </Card>

      <TextBlock label="Evaluación propia" value={d.evaluacionPropia} />
      <TextBlock label="Evaluación del entrenador" value={d.evaluacionEntrenador} />

      {d.totales && (
        <Card>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.correct }}>{d.totales.correct}</div>
              <div style={{ fontSize: 9.5, color: c.textDim }}>LOGRADOS</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.failed }}>{d.totales.failed}</div>
              <div style={{ fontSize: 9.5, color: c.textDim }}>A TRABAJAR</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.yellow }}>{d.totales.pct}%</div>
              <div style={{ fontSize: 9.5, color: c.textDim }}>EFECTIVIDAD</div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: c.celeste, marginBottom: 8 }}>Físico</div>
        {fisicoItems.map((item) => {
          const marked = d.fisicoAttempts?.[item]?.some((s) => s !== "pending");
          if (!marked) return null;
          return (
            <div key={item}>
              <ItemRow label={item} states={d.fisicoAttempts[item]} onSetState={noop} />
              {d.fisicoIntensidad?.[item] && (
                <div style={{ fontSize: 10.5, color: c.textDim, marginTop: -6, marginBottom: 10 }}>
                  Intensidad: {d.fisicoIntensidad[item]}
                </div>
              )}
            </div>
          );
        })}
      </Card>

      <Card>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: c.yellow, marginBottom: 8 }}>Técnico</div>
        {Object.entries(tecnicoGroups).map(([group, opts]) =>
          opts.map((opt) => {
            const key = `${group}::${opt}`;
            const v = d.tecnicoAttempts?.[key];
            if (!v) return null;
            const lados = ladosFor(group);
            const marked = lados.some((l) => v[l]?.some((s) => s !== "pending"));
            if (!marked) return null;
            return (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12.5, color: c.text, marginBottom: 5 }}>{group} — {opt}</div>
                {lados.map((lado) => (
                  <div key={lado} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 9.5, color: c.textDim, width: 18 }}>{ladoAbbrev(lado)}</span>
                    <AttemptDots states={v[lado]} onSetState={noop} />
                  </div>
                ))}
              </div>
            );
          })
        )}
      </Card>

      <Card>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: c.orange, marginBottom: 8 }}>Cognitivo</div>
        {cognitivoItems.map((item) => {
          const marked = d.cognitivoAttempts?.[item]?.some((s) => s !== "pending");
          if (!marked) return null;
          return <ItemRow key={item} label={item} states={d.cognitivoAttempts[item]} onSetState={noop} />;
        })}
      </Card>

      <Card>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: c.red, marginBottom: 8 }}>Táctico</div>
        {tacticoItems.map((item) => {
          const marked = d.tacticoAttempts?.[item]?.some((s) => s !== "pending");
          if (!marked) return null;
          return <ItemRow key={item} label={item} states={d.tacticoAttempts[item]} onSetState={noop} />;
        })}
      </Card>
    </>
  );
}

function PartidoSummary({ data }) {
  const d = data;
  const noop = () => {};
  const grupos = [
    { titulo: null, items: itemsSimples },
    { titulo: "Remates", items: remates.map((r) => `Remate::${r}`) },
    { titulo: "Cabezazo", items: cabezazos.map((z) => `Cabezazo::${z}`) },
    { titulo: "Pelota parada", items: pelotaParada.map((p) => `Pelota parada::${p}`) },
    { titulo: "Definición", items: finales },
  ];
  return (
    <>
      <Card>
        <InfoLine label="Rival" value={d.clubRival} />
        <InfoLine label="Cancha" value={[d.condicion, d.cancha].filter(Boolean).join(" — ")} />
        <InfoLine label="Sistema" value={d.sistemaUtilizado} />
        <InfoLine label="Posición 1" value={d.posicion1} />
        <InfoLine label="Posición 2" value={d.posicion2} />
        <InfoLine label="Minutos jugados" value={d.condicionJuego ? `${d.condicionJuego} — ${d.minutosJugados || "?"}'` : d.minutosJugados} />
        <InfoLine label="Tarjeta" value={d.tarjeta !== "Sin tarjeta" ? d.tarjeta : null} />
        <InfoLine label="Resultado" value={[d.resultado, d.marcador].filter(Boolean).join(" · ")} />
      </Card>

      <TextBlock label="Evaluación" value={d.evaluacion} />

      <Card>
        {grupos.map((g, gi) => {
          const visibles = g.items.filter((k) => d.attempts?.[k]?.some((s) => s !== "pending"));
          if (visibles.length === 0) return null;
          return (
            <div key={gi} style={{ marginBottom: 10 }}>
              {g.titulo && <div style={{ fontSize: 12, color: c.yellow, fontWeight: 700, marginBottom: 6 }}>{g.titulo}</div>}
              {visibles.map((key) => {
                const label = key.includes("::") ? key.split("::")[1] : key;
                return <ItemRow key={key} label={label} states={d.attempts[key]} onSetState={noop} />;
              })}
            </div>
          );
        })}
      </Card>
    </>
  );
}

function VerEntradaScreen({ entry, onBack }) {
  return (
    <Shell>
      <TopBar title={tipoLabel(entry.tipo)} onBack={onBack} />
      <div style={{ fontSize: 12, color: c.textDim, marginBottom: 10 }}>{entry.fecha}</div>

      {entry.tipo === "zona" && (
        <>
          {entry.data.contexto && (
            <div style={{ fontSize: 12.5, color: c.text, marginBottom: 10, textAlign: "center" }}>
              {entry.data.contexto}
            </div>
          )}
          <ZonaCanchaReadOnly zonas={entry.data.zonas} />
          <div style={{ textAlign: "center", fontSize: 12, color: c.textDim, marginTop: 6 }}>
            {entry.resumen}
          </div>
          <div style={{ textAlign: "center", fontSize: 10, color: c.textDim, marginTop: 2 }}>
            Arriba = arco rival · Abajo = arco propio
          </div>
        </>
      )}

      {entry.tipo === "sesion" && <SesionSummary data={entry.data} />}
      {entry.tipo === "partido" && <PartidoSummary data={entry.data} />}
      {entry.tipo === "evaluacion_carf" && <EvaluacionCarfSummary data={entry.data} />}
    </Shell>
  );
}

// =====================================================================
// MÉTODO C.A.R.F. — página informativa institucional
// =====================================================================
function Pilar({ titulo, descripcion, accent }) {
  return (
    <div
      style={{
        background: c.card,
        border: `1px solid ${c.cardEdge}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 8,
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 700, color: accent, marginBottom: 3 }}>{titulo}</div>
      <div style={{ fontSize: 12, color: c.textDim, lineHeight: 1.5 }}>{descripcion}</div>
    </div>
  );
}

function Destacado({ children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "rgba(255,229,0,0.08)",
        border: `1px solid rgba(255,229,0,0.25)`,
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 8,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.yellow, flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, color: c.text, lineHeight: 1.4 }}>{children}</span>
    </div>
  );
}

function FamiliasScreen({ onBack }) {
  const [familias, setFamilias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const refresh = async () => {
    setLoading(true);
    setFamilias(await loadFamilias());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const set = async (fam, status) => {
    setBusyId(fam.id);
    try {
      await setFamiliaSubscription(fam.id, status);
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Shell>
      <TopBar title="Familias" onBack={onBack} />
      <div style={{ fontSize: 11.5, color: c.textDim, marginBottom: 14, lineHeight: 1.5 }}>
        Marcá como "Alumno C.A.R.F." a las familias cuyo hijo/a entrena
        con vos — les queda el acceso completo incluido, sin costo.
        Nadie puede otorgárselo a sí mismo: sólo vos podés cambiarlo
        acá.
      </div>

      {loading && <div style={{ color: c.textDim, fontSize: 13 }}>Cargando...</div>}
      {!loading && familias.length === 0 && (
        <div style={{ color: c.textDim, fontSize: 13 }}>Todavía no hay familias registradas.</div>
      )}

      {familias.map((f) => {
        const isAlumno = f.subscription_status === "alumno_carf";
        const isActive = f.subscription_status === "active";
        return (
          <div
            key={f.id}
            style={{
              background: c.card,
              border: `1px solid ${c.cardEdge}`,
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <div style={{ color: c.text, fontSize: 13, fontWeight: 700 }}>{f.full_name || "Sin nombre"}</div>
              <div style={{ color: c.textDim, fontSize: 11 }}>{f.email}</div>
              <div style={{ color: c.textDim, fontSize: 10, marginTop: 2 }}>
                Estado actual: {isAlumno ? "Alumno C.A.R.F." : isActive ? "Suscripción activa (pagó)" : "Prueba / sin pagar"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={() => set(f, isAlumno ? "trial" : "alumno_carf")}
                disabled={busyId === f.id}
                style={pillActionBtn(isAlumno, c.correct)}
              >
                {busyId === f.id ? "..." : isAlumno ? "✓ Alumno CARF" : "Marcar alumno"}
              </button>
              <button
                onClick={() => set(f, isActive ? "trial" : "active")}
                disabled={busyId === f.id}
                style={pillActionBtn(isActive, c.orange)}
              >
                {busyId === f.id ? "..." : isActive ? "✓ Pago confirmado" : "Confirmar pago (transferencia)"}
              </button>
            </div>
          </div>
        );
      })}
    </Shell>
  );
}

function pillActionBtn(active, accent) {
  return {
    fontSize: 10.5,
    fontWeight: 700,
    border: `1px solid ${active ? accent : "rgba(255,255,255,0.15)"}`,
    background: active ? accent : "transparent",
    color: active ? "#0A0A0A" : "rgba(245,245,240,0.55)",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function MetodoScreen({ onBack }) {
  return (
    <Shell>
      <TopBar title="El Método C.A.R.F." onBack={onBack} />

      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <Logo size={80} variant="carf" />
      </div>

      <div style={{ fontSize: 13, color: c.textDim, lineHeight: 1.6, textAlign: "center", marginBottom: 20, padding: "0 4px" }}>
        Los entrenamientos en el C.A.R.F. tienen como fin el{" "}
        <span style={{ color: c.text, fontWeight: 700 }}>mejoramiento individual</span>{" "}
        de cada jugador, mediante ejercicios polifacéticos: técnicos, tácticos, físicos y cognitivos.
      </div>

      <div style={{ fontSize: 11.5, letterSpacing: 0.4, color: c.textDim, fontWeight: 700, marginBottom: 8, paddingLeft: 2 }}>
        LOS CUATRO PILARES
      </div>
      <Pilar titulo="Técnico" descripcion="Perfeccionamiento de gestos individuales: pase, control, conducción, dribbling, remate y cabezazo." accent={c.yellow} />
      <Pilar titulo="Táctico" descripcion="Comprensión del juego colectivo: triangulaciones, sistemas, movimientos ofensivos y defensivos." accent={c.red} />
      <Pilar titulo="Físico" descripcion="Resistencia, velocidad, fuerza, coordinación, pliometría y elongación específicas para el fútbol." accent={c.celeste} />
      <Pilar titulo="Cognitivo" descripcion="Toma de decisiones, concentración, vista periférica y comportamiento dentro de la cancha." accent={c.orange} />

      <div style={{ fontSize: 11.5, letterSpacing: 0.4, color: c.textDim, fontWeight: 700, marginTop: 18, marginBottom: 8, paddingLeft: 2 }}>
        LO QUE NOS DIFERENCIA
      </div>
      <Destacado>Siempre <strong>con pelota</strong> — nunca ejercicios en seco desconectados del juego real.</Destacado>
      <Destacado><strong>Intensidad superior</strong> a la de los entrenamientos de club.</Destacado>
      <Destacado><strong>Cupos limitados</strong>, en grupos reducidos, para sostener el foco individual.</Destacado>

      <div style={{ marginTop: 20, borderTop: `1px solid ${c.cardEdge}`, paddingTop: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: 0.4, color: c.textDim, fontWeight: 700, marginBottom: 10, textAlign: "center" }}>
          CONTACTO
        </div>

        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, color: c.text, fontWeight: 700 }}>DT / Coach General</div>
          <div style={{ fontSize: 12.5, color: c.textDim }}>Alejandro Parra</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={c.textDim}>
            <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.01z" />
          </svg>
          <span style={{ fontSize: 12, color: c.textDim }}>+54 9 223 5 974246</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="5" stroke={c.celeste} strokeWidth="2" />
            <circle cx="12" cy="12" r="4.5" stroke={c.celeste} strokeWidth="2" />
            <circle cx="17.3" cy="6.7" r="1.2" fill={c.celeste} />
          </svg>
          <span style={{ fontSize: 12, color: c.textDim }}>carffutbolpersonalizado</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 14 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill={c.celeste}>
            <path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.8c0-.9.25-1.5 1.6-1.5H16.7V3.4C16.4 3.35 15.4 3.25 14.25 3.25c-2.4 0-4.05 1.45-4.05 4.15v2.4H7.5v3.2h2.7V21z" />
          </svg>
          <span style={{ fontSize: 12, color: c.textDim }}>carf argentina</span>
        </div>

        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 12.5, color: c.text, fontWeight: 700 }}>Villa Deportiva</div>
          <div style={{ fontSize: 12, color: c.textDim }}>Complejo Calasanz</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <svg width="16" height="11" viewBox="0 0 30 20" style={{ flexShrink: 0 }}>
            <rect width="30" height="20" fill={c.celeste} />
            <rect y="6.66" width="30" height="6.66" fill={c.white} />
            <circle cx="15" cy="10" r="2.2" fill="#F7B500" stroke="#8A6D00" strokeWidth="0.4" />
          </svg>
          <span style={{ fontSize: 12, color: c.textDim }}>A. Chulak 6635 — Mar del Plata, Argentina</span>
        </div>
      </div>
    </Shell>
  );
}

// =====================================================================
// APP ROOT
// =====================================================================
export default function CarfApp({ profile, onLogout }) {
  const isCoach = profile?.role === "entrenador";
  const trialExpired =
    profile?.subscription_status === "trial" &&
    profile?.trial_ends_at &&
    new Date(profile.trial_ends_at) < new Date();
  const canWrite = isCoach || profile?.subscription_status === "alumno_carf" || !trialExpired;
  const [screen, setScreen] = useState({ name: "home" });
  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const p = await loadPlayers();
      setPlayers(p);
      setLoadingPlayers(false);
    })();
  }, []);

  const openPlayer = async (playerId) => {
    setScreen({ name: "playerDetail", playerId });
    setLoadingEntries(true);
    const e = await loadEntries(playerId);
    setEntries(e);
    setLoadingEntries(false);
  };

  const handleSavePlayer = async (p) => {
    const exists = players.some((pl) => pl.id === p.id);
    const next = exists ? players.map((pl) => (pl.id === p.id ? p : pl)) : [...players, p];
    setPlayers(next);
    await savePlayers(next, profile?.id);
    openPlayer(p.id);
  };

  const handleDeletePlayer = async (playerId) => {
    try {
      await deletePlayer(playerId);
      setPlayers((prev) => prev.filter((pl) => pl.id !== playerId));
      setScreen({ name: "home" });
    } catch (e) {
      console.error(e);
      setError("No se pudo eliminar el jugador.");
    }
  };

  const handleSaveEvaluacionCarf = async (playerId, entry) => {
    await saveEntries(playerId, [entry], profile?.id);
  };

  const handleSaveEntry = async (entry) => {
    const playerId = screen.playerId;
    const next = [...entries, entry];
    setEntries(next);
    setError("");
    try {
      await saveEntries(playerId, next, profile?.id);
    } catch (e) {
      setError("Esa carga está reservada para el entrenador.");
    }
    setScreen({ name: "playerDetail", playerId });
  };

  const TopUserBar = () => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 11,
        color: c.textDim,
        padding: "0 2px 10px",
      }}
    >
      <span>
        {profile?.full_name || profile?.email} · {isCoach ? "Entrenador" : "Familia"}
      </span>
      <button
        onClick={onLogout}
        style={{ background: "none", border: "none", color: c.textDim, textDecoration: "underline", cursor: "pointer", fontSize: 11 }}
      >
        Cerrar sesión
      </button>
    </div>
  );

  if (screen.name === "home") {
    return (
      <>
        <TopUserBar />
        <HomeScreen
          players={players}
          loading={loadingPlayers}
          onOpenPlayer={openPlayer}
          onNewPlayer={() => setScreen({ name: "newPlayer" })}
          onOpenMetodo={() => setScreen({ name: "metodo" })}
          onOpenFamilias={() => setScreen({ name: "familias" })}
          onOpenEvaluacionCarf={() => setScreen({ name: "evaluacion-carf" })}
          isCoach={isCoach}
          canWrite={canWrite}
          subscriptionStatus={profile?.subscription_status}
          userId={profile?.id}
          userEmail={profile?.email}
        />
      </>
    );
  }

  if (screen.name === "metodo") {
    return <MetodoScreen onBack={() => setScreen({ name: "home" })} />;
  }

  if (screen.name === "familias") {
    return <FamiliasScreen onBack={() => setScreen({ name: "home" })} />;
  }

  if (screen.name === "evaluacion-carf") {
    return (
      <EvaluacionCarfScreen
        players={players}
        onBack={() => setScreen({ name: "home" })}
        onSaveOne={handleSaveEvaluacionCarf}
        userId={profile?.id}
      />
    );
  }

  if (screen.name === "newPlayer") {
    return <PlayerFormScreen onBack={() => setScreen({ name: "home" })} onSave={handleSavePlayer} />;
  }

  if (screen.name === "editPlayer") {
    const player = players.find((p) => p.id === screen.playerId);
    return (
      <PlayerFormScreen
        initial={player}
        onBack={() => openPlayer(screen.playerId)}
        onSave={handleSavePlayer}
        onDelete={handleDeletePlayer}
      />
    );
  }

  if (screen.name === "playerDetail") {
    const player = players.find((p) => p.id === screen.playerId) || emptyPlayer();
    return (
      <PlayerDetailScreen
        player={player}
        entries={entries}
        loading={loadingEntries}
        onBack={() => setScreen({ name: "home" })}
        onEditPlayer={() => setScreen({ name: "editPlayer", playerId: screen.playerId })}
        onNew={(tipo) => setScreen({ name: `new-${tipo}`, playerId: screen.playerId })}
        onOpenEntry={(entry) => setScreen({ name: "viewEntry", playerId: screen.playerId, entry })}
        onOpenStats={() => setScreen({ name: "estadisticas", playerId: screen.playerId })}
        canWrite={canWrite}
      />
    );
  }

  if (screen.name === "estadisticas") {
    return <EstadisticasScreen entries={entries} onBack={() => setScreen({ name: "playerDetail", playerId: screen.playerId })} />;
  }

  if (screen.name === "new-sesion") {
    return (
      <>
        {error && <div style={{ color: c.failed, fontSize: 12, padding: "8px 4px" }}>{error}</div>}
        <NuevaSesionScreen
          isCoach={isCoach}
          onBack={() => setScreen({ name: "playerDetail", playerId: screen.playerId })}
          onSave={handleSaveEntry}
        />
      </>
    );
  }
  if (screen.name === "new-partido") {
    return <NuevoPartidoScreen onBack={() => setScreen({ name: "playerDetail", playerId: screen.playerId })} onSave={handleSaveEntry} />;
  }
  if (screen.name === "new-zona") {
    return <NuevaZonaScreen onBack={() => setScreen({ name: "playerDetail", playerId: screen.playerId })} onSave={handleSaveEntry} />;
  }
  if (screen.name === "viewEntry") {
    return <VerEntradaScreen entry={screen.entry} onBack={() => setScreen({ name: "playerDetail", playerId: screen.playerId })} />;
  }

  return null;
}
