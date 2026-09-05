const express = require('express');
const cors = require('cors');
const { createClient: createRedisClient } = require('redis');
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

// Updated for Cloud/Render
const publisher = createRedisClient({ 
    url: process.env.REDIS_URL || 'redis://redis-broker:6379' 
});
publisher.on('error', (err) => console.log('Redis Error', err));
publisher.connect().then(() => console.log('Connected to Redis Broker'));

// Security Middleware: Intercept and Validate JWT
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];

    // Cryptographically verify the token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
        return res.status(403).json({ error: 'Forbidden: Token expired or invalid' });
    }

    // Attach the verified user object to the request
    req.user = data.user;
    next();
};

// Route is now protected by the authenticateToken middleware
app.post('/api/orders', authenticateToken, async (req, res) => {
    const { productId, quantity } = req.body;
    
    // Extract the user ID directly from the validated JWT payload
    const secureUserId = req.user.id;

    try {
        const { data: dbOrder, error } = await supabase
            .from('orders')
            .insert([{ 
                user_id: secureUserId, 
                product_id: productId, 
                quantity: quantity, 
                status: 'Processing' 
            }])
            .select()
            .single();

        if (error) throw error;

        const newOrder = {
            id: dbOrder.id,
            userId: dbOrder.user_id,
            productId: dbOrder.product_id,
            quantity: dbOrder.quantity,
            status: dbOrder.status
        };

        await publisher.publish('order_events', JSON.stringify(newOrder));
        res.status(201).json({ message: 'Order saved', order: newOrder });

    } catch (err) {
        console.error('Server Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => console.log(`Order Service listening on port ${PORT}`));