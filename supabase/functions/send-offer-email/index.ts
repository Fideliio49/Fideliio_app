// supabase/functions/send-offer-email/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EMAIL_LIMIT_PER_MONTH = 2;

Deno.serve(async (req) => {
  // ✅ CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const db = createClient(SUPABASE_URL, SUPABASE_KEY);

    const {
      merchant_id,
      customer_ids, // tableau d'IDs clients
      title,
      message,
      type = "custom",
      send_email = true,
      send_push = true,
    } = await req.json();

    if (!merchant_id || !customer_ids?.length || !title || !message) {
      return json({ error: "Paramètres manquants" }, 400);
    }

    // ✅ Récupérer les infos du commerçant
    const { data: merchant } = await db
      .from("merchants")
      .select("id, business_name, email")
      .eq("id", merchant_id)
      .maybeSingle();

    if (!merchant) return json({ error: "Commerçant introuvable" }, 404);

    // ✅ Récupérer les infos des clients
    const { data: customers } = await db
      .from("customers")
      .select("id, first_name, last_name, email, push_token")
      .in("id", customer_ids);

    if (!customers?.length) return json({ error: "Clients introuvables" }, 404);

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const results = {
      push_sent: 0,
      email_sent: 0,
      email_skipped: 0,
      errors: [] as string[],
    };

    for (const customer of customers) {
      try {
        // ── 1. Enregistrer l'offre dans la DB ──
        const { data: offer } = await db
          .from("customer_offers")
          .insert({
            merchant_id,
            customer_id: customer.id,
            title,
            message,
            type,
            push_sent: false,
            email_sent: false,
          })
          .select()
          .maybeSingle();

        // ── 2. Notification Push ──
        if (send_push && customer.push_token?.startsWith("ExponentPushToken")) {
          const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: customer.push_token,
              title: `🎁 ${merchant.business_name}`,
              body: `${title} — ${message}`,
              sound: "default",
              priority: "high",
              data: { type: "offer", offer_id: offer?.id },
            }),
          });
          if (pushRes.ok) {
            results.push_sent++;
            if (offer)
              await db
                .from("customer_offers")
                .update({ push_sent: true })
                .eq("id", offer.id);
          }
        }

        // ── 3. Email ──
        if (send_email && customer.email) {
          // Vérifier la limite mensuelle
          const { data: counter } = await db
            .from("email_monthly_count")
            .select("count")
            .eq("merchant_id", merchant_id)
            .eq("customer_id", customer.id)
            .eq("month", currentMonth)
            .maybeSingle();

          const currentCount = counter?.count ?? 0;

          if (currentCount >= EMAIL_LIMIT_PER_MONTH) {
            results.email_skipped++;
            continue; // Limite atteinte pour ce client ce mois
          }

          // Envoyer l'email via Resend
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `${merchant.business_name} <onboarding@resend.dev>`,
              to: [customer.email],
              subject: `🎁 ${title} — ${merchant.business_name}`,
              html: buildEmailHTML({
                customerName: customer.first_name,
                merchantName: merchant.business_name,
                title,
                message,
                type,
              }),
            }),
          });

          if (emailRes.ok) {
            results.email_sent++;

            // Mettre à jour le compteur mensuel
            await db.from("email_monthly_count").upsert(
              {
                merchant_id,
                customer_id: customer.id,
                month: currentMonth,
                count: currentCount + 1,
              },
              { onConflict: "merchant_id,customer_id,month" },
            );

            if (offer)
              await db
                .from("customer_offers")
                .update({ email_sent: true })
                .eq("id", offer.id);
          }
        }
      } catch (err: any) {
        results.errors.push(`${customer.first_name}: ${err.message}`);
      }
    }

    return json({ success: true, results });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});

/* ── Template HTML email ── */
function buildEmailHTML({
  customerName,
  merchantName,
  title,
  message,
  type,
}: {
  customerName: string;
  merchantName: string;
  title: string;
  message: string;
  type: string;
}) {
  const emoji =
    type === "discount"
      ? "💰"
      : type === "bonus_points"
        ? "⭐"
        : type === "reminder"
          ? "👋"
          : "🎁";

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F7F4F0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4F0;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#C85A17,#FF7A3D);padding:36px 40px;text-align:center;">
              <div style="font-size:48px;margin-bottom:12px;">${emoji}</div>
              <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;line-height:1.3;">${title}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="color:#1A1A1A;font-size:16px;margin:0 0 8px 0;">
                Bonjour <strong>${customerName}</strong> 👋
              </p>
              <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 28px 0;">
                <strong>${merchantName}</strong> a une offre spéciale pour vous :
              </p>

              <!-- Offer box -->
              <div style="background:#FFF8F5;border:2px solid #C85A1730;border-radius:14px;padding:24px;margin-bottom:28px;text-align:center;">
                <p style="color:#C85A17;font-size:18px;font-weight:600;margin:0;line-height:1.5;">
                  ${message}
                </p>
              </div>

              <p style="color:#888;font-size:13px;text-align:center;margin:0;">
                Présentez cette offre lors de votre prochaine visite chez
                <strong style="color:#1A1A1A;">${merchantName}</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F7F4F0;padding:20px 40px;text-align:center;border-top:1px solid #E8E2DA;">
              <p style="color:#AAA;font-size:12px;margin:0;line-height:1.6;">
                Vous recevez cet email car vous êtes client de <strong>${merchantName}</strong>.<br/>
                Propulsé par <strong style="color:#C85A17;">Fideliio</strong> — HiomAI
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/* ── Helper JSON response ── */
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
