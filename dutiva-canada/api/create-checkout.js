export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: "userId and email are required" });
    }

    const params = new URLSearchParams({
      "payment_method_types[0]": "card",
      "mode": "subscription",
      "customer_email": email,
      "line_items[0][price]": process.env.STRIPE_PRICE_ID,
      "line_items[0][quantity]": "1",
      "success_url": `${req.headers.origin}/?upgraded=true`,
      "cancel_url": `${req.headers.origin}/`,
      "metadata[supabase_user_id]": userId,
    });

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: session.error?.message || "Stripe error" });
    }

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return res.status(500).json({ error: error.message });
  }
}