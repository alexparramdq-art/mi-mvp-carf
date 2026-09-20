import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { MVP_FULL_LOGO_B64 } from "./assets.js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const COACH_CODE = import.meta.env.VITE_COACH_SIGNUP_CODE || "";

const c = {
  bg: "#0A0A0A",
  card: "#161616",
  card2: "#1D1D1D",
  cardEdge: "rgba(255,255,255,0.08)",
  text: "#F5F5F0",
  textDim: "rgba(245,245,240,0.55)",
  yellow: "#FFE500",
  correct: "#3FA34D",
  failed: "#E30613",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: c.card2,
  border: `1px solid ${c.cardEdge}`,
  color: c.text,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
};
const labelStyle = { fontSize: 11.5, color: c.textDim, marginBottom: 4, display: "block" };

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [coachCode, setCoachCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const role = COACH_CODE && coachCode && coachCode === COACH_CODE ? "entrenador" : "padre";
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role } },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Cuenta creada. Revisá tu email para confirmar la cuenta antes de entrar.");
        }
      }
    } catch (err) {
      setError(traducirError(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: c.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <img src={MVP_FULL_LOGO_B64} alt="Mi MVP by C.A.R.F." style={{ width: "100%", maxWidth: 260, height: "auto", display: "block", margin: "0 auto" }} />
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <button onClick={() => setMode("login")} style={tabStyle(mode === "login")}>
            Ingresar
          </button>
          <button onClick={() => setMode("signup")} style={tabStyle(mode === "signup")}>
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "signup" && (
            <div>
              <label style={labelStyle}>Nombre y apellido</label>
              <input style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          )}
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Contraseña</label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...inputStyle, paddingRight: 40 }}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: c.textDim,
                  cursor: "pointer",
                  fontSize: 16,
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>
          {mode === "signup" && (
            <div>
              <label style={labelStyle}>Código de entrenador (opcional)</label>
              <input
                style={inputStyle}
                value={coachCode}
                onChange={(e) => setCoachCode(e.target.value)}
                placeholder="Sólo si sos Alejandro / staff técnico"
              />
              <div style={{ fontSize: 10, color: c.textDim, marginTop: 4 }}>
                Dejalo vacío si sos familia de un jugador.
              </div>
            </div>
          )}

          {mode === "signup" && (
            <div style={{ fontSize: 10.5, color: c.textDim, background: c.card2, borderRadius: 8, padding: "8px 10px" }}>
              Si tu hijo/a entrena en el C.A.R.F., contactá a Alejandro
              después de crear la cuenta para que active tu acceso sin
              costo.
            </div>
          )}


          {error && (
            <div style={{ background: `${c.failed}22`, border: `1px solid ${c.failed}`, color: c.text, borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
              {error}
            </div>
          )}
          {notice && (
            <div style={{ background: `${c.correct}22`, border: `1px solid ${c.correct}`, color: c.text, borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              background: c.yellow,
              color: "#0A0A0A",
              border: "none",
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 14,
              padding: "12px 0",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Un momento..." : mode === "login" ? "Ingresar" : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}

function tabStyle(active) {
  return {
    flex: 1,
    background: active ? "#FFE500" : "transparent",
    color: active ? "#0A0A0A" : "rgba(245,245,240,0.55)",
    border: `1px solid ${active ? "#FFE500" : "rgba(255,255,255,0.08)"}`,
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 12.5,
    padding: "8px 0",
    cursor: "pointer",
  };
}

function traducirError(msg) {
  if (!msg) return "Ocurrió un error inesperado.";
  if (msg.includes("Invalid login credentials")) return "Email o contraseña incorrectos.";
  if (msg.includes("already registered") || msg.includes("already exists")) return "Ese email ya tiene una cuenta creada.";
  if (msg.includes("Password should be")) return "La contraseña debe tener al menos 6 caracteres.";
  return msg;
}

export { supabase };
