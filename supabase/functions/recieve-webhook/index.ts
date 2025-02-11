import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@1';

const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') as string, {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (request) => {
  const supabase = createClient(
    Deno.env.get('URL_SUPABASE')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );

  const signature = request.headers.get('Stripe-Signature');
  const body = await request.text();

  let receivedEvent;
  try {
    receivedEvent = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );
    console.log(JSON.stringify(receivedEvent, null, 2));
  } catch (err) {
    return new Response(err.message, { status: 400 });
  }

  const eventData = receivedEvent.data.object;
  let user;

  switch (receivedEvent.type) {
    case 'customer.created':
      console.log('Handling event:', receivedEvent.type);

      const { data: foundUser, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', eventData.email)
        .single();

      if (foundUser) {
        await supabase.from('subscriptions').insert([
          {
            user_id: foundUser.id,
            customer_id: eventData.id,
          },
        ]);
      }
      break;

    case 'customer.subscription.created':
      console.log('Handling subscription created');

      const { data: userData } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('customer_id', eventData.customer)
        .single();

      if (userData) {
        await supabase.from('subscriptions').update({
          stripe_subscription_id: eventData.id,
          status: 'active',
        }).eq('customer_id', eventData.customer);
      }
      break;

    case 'customer.subscription.updated':
      console.log('Handling subscription updated');

      await supabase.from('subscriptions').update({
        status: eventData.status,
      }).eq('stripe_subscription_id', eventData.id);
      break;

    case 'customer.subscription.deleted':
      console.log('Handling subscription deleted');
      await supabase.from('subscriptions').delete()
        .eq('stripe_subscription_id', eventData.id);
      break;
    default:
      console.log('ℹ️ Unhandled event type:', receivedEvent.type);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
