# Event-Driven E-Commerce Microservices Architecture

A fully decoupled, cloud-native e-commerce platform demonstrating secure microservices, asynchronous message brokering, and zero-trust security principles. This project separates frontend presentation, API routing, and background processing into isolated infrastructure components to ensure high availability and robust security.

---

## Architecture Overview

This system utilizes a modern, distributed tech stack deployed across Vercel and Render, communicating via an in-memory Redis message broker.

*   **Frontend Client (React / Vite / Vercel):** A public-facing web application that handles user authentication and product catalog rendering. It operates on a strict least-privilege model, communicating directly with Supabase only via an Anon Key bound by Row Level Security (RLS).
*   **Order API Gateway (Express / Render):** The secure perimeter service. It receives HTTP checkout requests from the frontend, validates JSON Web Tokens (JWT) to authorize the user, and securely writes the initial order to the database as `Processing` using an administrative Service Role Key.
*   **Message Broker (Redis / Render):** An internal pub/sub event bus. Once the Order API logs a transaction, it fires a non-blocking `order_events` message to this broker, immediately freeing up the API thread to respond to the client.
*   **Inventory Background Worker (Express / Render):** An asynchronous worker service operating on a private network. It continuously polls the Redis broker for new events, processes the inventory logic, and updates the database record to `Shipped`.
*   **Database & Auth (Supabase / PostgreSQL):** Centralized data storage managing user identities, session tokens, and relational order data. 

## System Data Flow

1.  **Authentication:** User logs in via the React frontend; Supabase issues a secure JWT.
2.  **Order Initiation:** The user initiates a checkout. The frontend sends an HTTP POST request to the Order API, passing the JWT in the authorization header.
3.  **Validation & Write:** The Order API verifies the token, utilizes the Service Role Key to bypass client limitations, and inserts the order into PostgreSQL with a `Processing` status.
4.  **Event Broadcast:** The Order API publishes a message containing the `order_id` to the Redis `order_events` channel.
5.  **Asynchronous Resolution:** The Inventory Worker intercepts the Redis message, executes backend business logic, and updates the order status to `Shipped`.

## Security & Scalability Highlights

*   **Decoupled Failure Domains:** By separating the Order API and Inventory Worker, the system maintains high availability. If the worker service crashes or undergoes maintenance, the Order API can continue accepting customer orders and queuing them in Redis without dropping transactions.
*   **Zero-Trust Credential Management:** Administrative database access (Service Role Key) is strictly isolated to backend servers. The frontend is physically incapable of mutating restricted data, neutralizing potential client-side injection attacks.
*   **Non-Blocking I/O:** Heavy background processing is offloaded to the worker service, ensuring the customer-facing API remains highly responsive during traffic spikes.

## Environment Variable Configuration

To deploy this architecture, the following environment variables must be injected into their respective cloud hosting environments:

| Service | Key | Purpose |
| :--- | :--- | :--- |
| **Frontend (Vercel)** | `VITE_API_URL` | Public URL of the Render Order API |
| **Frontend (Vercel)** | `VITE_SUPABASE_URL` | Supabase Project URL |
| **Frontend (Vercel)** | `VITE_SUPABASE_ANON_KEY` | Public key restricted by RLS |
| **Order API (Render)** | `SUPABASE_URL` | Supabase Project URL |
| **Order API (Render)** | `SUPABASE_SERVICE_ROLE_KEY` | Admin key for unrestricted backend writes |
| **Order API (Render)** | `REDIS_URL` | Internal Render Redis connection string |
| **Worker (Render)** | `SUPABASE_URL` | Supabase Project URL |
| **Worker (Render)** | `SUPABASE_SERVICE_ROLE_KEY` | Admin key for backend status updates |
| **Worker (Render)** | `REDIS_URL` | Internal Render Redis connection string |
