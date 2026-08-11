// This file lives at /functions/api/contact.js in the repo.
// Cloudflare Pages automatically turns it into a live endpoint at /api/contact
// — no extra routing setup needed.
//
// It receives the estimate form's data, then calls Resend's API to send
// an email. The two values it needs (RESEND_API_KEY and TO_EMAIL) are read
// from Cloudflare's Environment Variables, NOT hardcoded here — see the
// Cloudflare Pages dashboard: Settings -> Environment variables.

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();

    // Honeypot: real visitors never fill this hidden field. Bots often do.
    if (data._gotcha) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const { name, phone, email, address, projectTypes, details } = data;

    if (!name || !phone || !email) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const emailBody = `New estimate request from the B.A.C Construction website

Name: ${name}
Phone: ${phone}
Email: ${email}
Project Address: ${address || "Not provided"}
Looking to build: ${(projectTypes || []).join(", ") || "Not specified"}

Project details:
${details || "Not provided"}`;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // "from" must be an address on a domain you've verified in Resend.
        // Until you verify B.A.C's own domain, Resend's shared test address
        // (onboarding@resend.dev) works fine for sending.
        from: env.FROM_EMAIL || "B.A.C Construction Website <onboarding@resend.dev>",
        to: [env.TO_EMAIL],
        reply_to: email,
        subject: `New Estimate Request — ${name}`,
        text: emailBody,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error("Resend error:", errText);
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to send email" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Contact form error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
