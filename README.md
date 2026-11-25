# FixMate Server

REST API for the FixMate repair platform (Node.js, Express, MongoDB).

## Purpose
Provides secure, role-based APIs for customers, technicians and admins, with a strict repair job pipeline and Stripe payments.

## Live URL
https://fixmate-server-b1lq.onrender.com/

## Test Credentials (for Examiner Quick Testing)
- **Admin:** `admin@fixmate.com` / `Admin@123`
- **Technician:** `tech.rahim@fixmate.com` / `Tech@123` (8 approved services, active & completed requests)
- **Customer:** `customer.arman@fixmate.com` / `Customer@123` (active requests & completed bookings with Pay Now)

## Key Features
- 4 MongoDB collections: `users`, `services`, `bookings`, `payments`
- JWT authentication with role middleware (customer, technician, admin)
- Server-side search, filter, sort and pagination
- Enforced job status flow: requested, accepted, in-progress, completed, paid
- Stripe Checkout with idempotent verification and webhook handling
- Admin approval for services and user role management

## NPM Packages Used
- `express` - web framework
- `mongodb` - database driver
- `jsonwebtoken` - JWT auth
- `bcryptjs` - password hashing
- `stripe` - payments
- `cors` - cross-origin access
- `dotenv` - environment variables
- `morgan` - request logging
- `nodemon` - dev auto-reload
