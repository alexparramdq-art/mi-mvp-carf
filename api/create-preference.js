// api/create-preference.js
// Función que corre en el servidor de Vercel (nunca en el navegador).
// Crea una "preferencia de pago" en Mercado Pago y devuelve el link
// (init_point) al que hay que mandar a la familia para que pague.

const PRECIOS_ARS = {
  mensual: 14000,
  anual: 140000,
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { profileId, email, periodo } = req.body || {};
    const monto = PRECIOS_ARS[periodo];

    if (!profileId || !email || !monto) {
      return res.status(400).json({ error: "Faltan datos (profileId, email o periodo inválido)" });
    }

    const appUrl = process.env.APP_URL;
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!appUrl || !accessToken) {
      return res.status(500).json({ error: "Falta configurar APP_URL o MP_ACCESS_TOKEN en Vercel" });
    }

    const mpResp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: `Mi MVP — Suscripción ${periodo === "anual" ? "anual" : "mensual"}`,
            quantity: 1,
            currency_id: "ARS",
            unit_price: monto,
          },
        ],
        payer: { email },
        external_reference: profileId,
        back_urls: {
          success: `${appUrl}/?pago=exito`,
          failure: `${appUrl}/?pago=error`,
          pending: `${appUrl}/?pago=pendiente`,
        },
        auto_return: "approved",
        notification_url: `${appUrl}/api/mp-webhook`,
      }),
    });

    const data = await mpResp.json();
    if (!mpResp.ok) {
      console.error("Error de Mercado Pago:", data);
      return res.status(500).json({ error: "Mercado Pago rechazó la solicitud", detail: data });
    }

    return res.status(200).json({ init_point: data.init_point });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error interno" });
  }
}
