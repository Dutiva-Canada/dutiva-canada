import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Use service role key for webhook — bypasses RLS
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
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
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        await supabase
          .from("profiles")
          .update({
            plan: "pro",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq("id", userId);

        break;
      }

      case "customer.subscription.deleted":
      case "customer.subscription.paused": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        await supabase
          .from("profiles")
          .update({
            plan: "free",
            stripe_subscription_id: null,
          })
          .eq("stripe_customer_id", customerId);

        break;
      }

      case "customer.subscription.resumed":
      case "invoice.payment_succeeded": {
        const obj = event.data.object;
        const customerId = obj.customer;

        await supabase
          .from("profiles")
          .update({ plan: "pro" })
          .eq("stripe_customer_id", customerId);

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        await supabase
          .from("profiles")
          .update({ plan: "free" })
          .eq("stripe_customer_id", customerId);

        break;
      }

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return res.status(500).json({ error: error.message });
  }
}
```

**Ctrl+S** to save.

Then we need one more key — the **Supabase service role key**. Go to Supabase → **Project Settings** → **API** → copy the **service_role** key (it's below the anon key). Add it to your `.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here