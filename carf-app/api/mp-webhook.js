// api/mp-webhook.js
// Mercado Pago llama a esta dirección solo cuando pasa algo con un
// pago (por ejemplo, se aprueba). Acá confirmamos que el pago sea de
// verdad (consultándolo directo a Mercado Pago, nunca confiamos en
// datos que vengan solo del aviso) y, si está aprobado, activamos la
// cuenta de esa familia en Supabase.

export default async function handler(req, res) {
  try {
    const paymentId = req.query["data.id"] || req.body?.data?.id;
    const topic = req.query.type || req.body?.type;

    if (topic !== "payment" || !paymentId) {
      return res.status(200).json({ ok: true }); // ignoramos otros avisos
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payment = await mpResp.json();

    if (payment.status === "approved" && payment.external_reference) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${payment.external_reference}`, {
        method: "PATCH",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ subscription_status: "active" }),
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error en webhook de Mercado Pago:", err);
    // Igual devolvemos 200: si no, Mercado Pago reintenta sin parar.
    return res.status(200).json({ ok: false });
  }
}
