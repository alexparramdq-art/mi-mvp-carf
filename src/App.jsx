import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Auth from "./Auth.jsx";
import CarfApp from "./CarfApp.jsx";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    setLoadingProfile(true);
    supabase
      .from("profiles")
      .select("id, role, full_name, subscription_status, trial_ends_at")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) console.error(error);
        setProfile({
          id: session.user.id,
          email: session.user.email,
          role: data?.role || "padre",
          full_name: data?.full_name || "",
          subscription_status: data?.subscription_status || "trial",
          trial_ends_at: data?.trial_ends_at || null,
        });
      })
      .finally(() => setLoadingProfile(false));
  }, [session]);

  if (session === undefined) return <CenteredMessage>Cargando…</CenteredMessage>;
  if (!session) return <Auth />;
  if (loadingProfile || !profile) return <CenteredMessage>Cargando tu perfil…</CenteredMessage>;

  return <CarfApp profile={profile} onLogout={() => supabase.auth.signOut()} />;
}

function CenteredMessage({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0A0A",
        color: "rgba(245,245,240,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}
