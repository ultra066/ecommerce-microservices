const express = require('express');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3003;

const subscriber = createClient({
    url: 'redis://redis-broker:6379'
});

subscriber.on('error', (err) => console.log('Redis Error', err));

subscriber.connect().then(() => {
    console.log('Notification Service connected to Redis Broker');
    
    // Listening to the same channel as the Inventory Service
    subscriber.subscribe('order_events', (message) => {
        const order = JSON.parse(message);
        console.log(`\n[Notification Service] Event caught for Order: ${order.id}`);
        console.log(`[Notification Service] Simulating email confirmation to user...`);
        
        // Simulating a 1-second delay for sending an email
        setTimeout(() => {
            console.log(`[Notification Service] Success: Email sent for Order ${order.id}!`);
        }, 1000);
    });
});

app.listen(PORT, () => {
    console.log(`Notification Service listening on http://localhost:${PORT}`);
});