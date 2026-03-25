import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Disable Vercel's automatic body parsing so we get the raw body
// Required for Stripe webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Read raw body from request stream (no external dependency needed)
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Read raw body for signature verification
  const rawBody = await getRawBody(req);
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody.toString(),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata.supabase_user_id;
        const { error } = await supabase.from("profiles").update({
          plan: "pro",
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
        }).eq("id", userId);
        if (error) console.error("Supabase update error:", error);
        break;
      }
      case "customer.subscription.deleted":
      case "customer.subscription.paused": {
        const customerId = event.data.object.customer;
        await supabase.from("profiles").update({
          plan: "free",
          stripe_subscription_id: null,
        }).eq("stripe_customer_id", customerId);
        break;
      }
      case "invoice.payment_succeeded":
      case "customer.subscription.resumed": {
        const customerId = event.data.object.customer;
        await supabase.from("profiles").update({ plan: "pro" })
          .eq("stripe_customer_id", customerId);
        break;
      }
      case "invoice.payment_failed": {
        const customerId = event.data.object.customer;
        await supabase.from("profiles").update({ plan: "free" })
          .eq("stripe_customer_id", customerId);
        break;
      }
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return res.status(500).json({ error: error.message });
  }
}
