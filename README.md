# FixMate Server API 🛠️

FixMate is an on-demand Smart Device & Home Appliance Repair Service Platform backend built with Node.js, Express.js, MongoDB, JWT authentication, and Stripe payments.

## 📌 Project Overview
- **Project Name:** FixMate Server
- **Purpose:** Provide secure, role-based RESTful APIs for Customers, Technicians, and Administrators. Enforces a strict repair job pipeline, Stripe payments, admin moderation, and real-time MongoDB search, filter, and sorting.
- **Admin Credentials:** `admin@fixmate.com` / `Admin@123`
- **Technician Credentials:** `tech.rahim@fixmate.com` / `Tech@123`
- **Customer Credentials:** `customer.arman@fixmate.com` / `Customer@123`
- **Live Server URL:** https://fixmate-server-production.up.railway.app (or deployed Render/Vercel)

---

## 🚀 Key Features & Implementation
1. **4 Logical MongoDB Collections:**
   - `users`: Role-based profiles (Customer, Technician, Admin) with phone, area, bio, and avatar.
   - `services`: Repair listings by certified technicians with Admin approval pipeline.
   - `bookings`: Repair requests with immutable snapshots of service & technician data.
   - `payments`: Verified Stripe Checkout payment records with complete idempotency protection.
2. **Challenge 1: Server-Side Search, Filter & Sort:**
   - MongoDB `$regex` keyword search on title, category, description, and service area.
   - Multi-field filters: category and serviceMode.
   - Server-side sorting: `price-asc`, `price-desc`, `newest`.
   - Server-side pagination with `.skip()` and `.limit()`.
3. **Challenge 2: JWT & Role-Based Middleware:**
   - `verifyToken`: Header verification, token decoding, user lookup.
   - `verifyCustomer`: Restricts repair requests, cancellations, and checkout sessions to customers.
   - `verifyTechnician`: Restricts service creation, editing, and job status transitions to technician owners.
   - `verifyAdmin`: Restricts user management, role alterations, and service approvals to administrators.
4. **Challenge 3: Server-Enforced Job Status Pipeline:**
   - Strict transition state machine:
     - `requested` ➔ `accepted` | `rejected` (Technician) or `cancelled` (Customer)
     - `accepted` ➔ `in-progress` (Technician)
     - `in-progress` ➔ `completed` with verified `finalAmount > 0` (Technician)
     - `completed` + `unpaid` ➔ `paid` (Stripe only)
5. **Challenge 4: Stripe Checkout & Webhook Integration:**
   - Server-side Checkout session creation directly from database final amount.
   - Idempotent session verification (`/api/payments/verify`) and Webhook handler (`/api/payments/webhook`).

---

## 📦 NPM Packages Used
- `express` (^4.21.2) - High performance Node web framework
- `mongodb` (^6.14.2) - Official MongoDB native driver
- `jsonwebtoken` (^9.0.2) - Secure role-based JWT authentication
- `bcryptjs` (^3.0.3) - Password hashing with cryptographic salts
- `stripe` (^17.7.0) - Payment processing and webhook event verification
- `cors` (^2.8.5) - Cross-Origin Resource Sharing handling
- `dotenv` (^17.3.1) - Environment variable management
- `morgan` (^1.10.0) - HTTP request logger
- `nodemon` (^3.1.9) - Development auto-reload

---

## ⚙️ Environment Variables (`.env`)
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/fixmate?retryWrites=true&w=majority
DB_NAME=fixmate
JWT_SECRET=fixmate_super_secret_jwt_key_2026_secure_tokens
JWT_EXPIRES_IN=7d
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here
IMGBB_API_KEY=your_imgbb_api_key_here
```

---

## 🛠️ Getting Started
```bash
# 1. Install dependencies
npm install

# 2. Seed database with realistic demo data
npm run seed

# 3. Start development server
npm run dev
```
