const express = require('express');
const cors = require('cors');
const { createClient } = require('redis');
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize Supabase Client (Using Service Role Key for Admin Access)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

// Initialize Redis Publisher
const publisher = createClient({
    url: 'redis://redis-broker:6379'
});

publisher.on('error', (err) => console.log('Redis Error', err));
publisher.connect().then(() => console.log('Connected to Redis Broker'));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Order Service is online' });
});

app.post('/api/orders', async (req, res) => {
    // 1. Capture userId, productId, and quantity from the frontend request
    const { productId, quantity, userId } = req.body;

    try {
        // 2. Save the order and link it to the user in Supabase
        const { data: dbOrder, error } = await supabase
            .from('orders')
            .insert([{ 
                user_id: userId, 
                product_id: productId, 
                quantity: quantity, 
                status: 'Processing' 
            }])
            .select()
            .single();

        if (error) {
            console.error('Database Error:', error);
            return res.status(500).json({ error: 'Failed to save order to database' });
        }

        const newOrder = {
            id: dbOrder.id,
            userId: dbOrder.user_id,
            productId: dbOrder.product_id,
            quantity: dbOrder.quantity,
            status: dbOrder.status
        };

        // 3. Publish the event to the "order_events" channel for workers
        await publisher.publish('order_events', JSON.stringify(newOrder));
        console.log(`Event Published: Order ${newOrder.id} broadcasted`);

        res.status(201).json({
            message: 'Order received, saved to database, and event published',
            order: newOrder
        });

    } catch (err) {
        console.error('Server Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Order Service listening on http://localhost:${PORT}`);
});