const { createClient } = require('redis');
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');

// 1. Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

// 2. Initialize Redis Subscriber
const subscriber = createClient({
    url: 'redis://redis-broker:6379'
});

subscriber.on('error', (err) => console.error('Redis Error', err));

async function startWorker() {
    await subscriber.connect();
    console.log('Inventory Worker connected to Redis Broker');

    // 3. Subscribe to the order_events channel
    await subscriber.subscribe('order_events', async (message) => {
        const order = JSON.parse(message);
        console.log(`[Worker] Received order event: ${order.id}`);

        try {
            // 4. Update the Order Status to 'Shipped'
            const { error: orderError } = await supabase
                .from('orders')
                .update({ status: 'Shipped' })
                .eq('id', order.id);

            if (orderError) throw orderError;
            console.log(`[Worker] Order ${order.id} status successfully updated to 'Shipped'`);

            // Optional Bonus: Deduct 1 from the product stock
            // await supabase.rpc('decrement_stock', { product_id: order.productId });

        } catch (err) {
            console.error('[Worker] Error processing order:', err);
        }
    });
}

startWorker();