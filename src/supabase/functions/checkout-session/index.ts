import { serve } from "https://deno.land/std@0.177.1/http/server.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

if (!STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY in environment variables");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Only POST requests allowed" }), {
      status: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const { email, priceId } = await req.json();

    // Validate required fields
    if (!email || !priceId) {
      return new Response(JSON.stringify({ error: "Email and priceId are required" }), {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // Step 1: Check if customer exists with the given email
    const customerSearchResponse = await fetch(`https://api.stripe.com/v1/customers?email=${email}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
      },
    });

    const customerSearchData = await customerSearchResponse.json();
    let customerId;

    if (customerSearchData.data.length > 0) {
      // Customer exists, check if they have any active subscriptions
      customerId = customerSearchData.data[0].id;
      const subscriptionsResponse = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
          },
        }
      );

      const subscriptionsData = await subscriptionsResponse.json();
      if (subscriptionsData.data.length > 0) {
        // Customer already has an active subscription
        return new Response(JSON.stringify({ error: "Customer already has an active subscription" }), {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }
    } else {
      // Customer does not exist, create a new customer
      const customerCreateResponse = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          email: email,
        }).toString(),
      });

      const customerCreateData = await customerCreateResponse.json();
      customerId = customerCreateData.id;
    }

    // Step 2: Create a Checkout Session for the customer
    const sessionResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: customerId,
        "payment_method_types[]": "card",
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        mode: "subscription",
        // email:email
        success_url: "http://localhost:5173/dashboard", // Replace with your success URL
        cancel_url: "http://localhost:5173", // Replace with your cancel URL
      }).toString(),
    });

    const sessionData = await sessionResponse.json();

    if (sessionData.error) {
      return new Response(JSON.stringify({ error: sessionData.error.message }), {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    return new Response(JSON.stringify({ url: sessionData.url }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
});