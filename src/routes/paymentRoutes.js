const express = require('express');
const { ObjectId } = require('mongodb');
const Stripe = require('stripe');
const { getCollections } = require('../config/db');
const { verifyToken, verifyCustomer } = require('../middleware/auth');

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

let stripe = null;
if (STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.startsWith('sk_test_51Mock')) {
  try {
    stripe = new Stripe(STRIPE_SECRET_KEY);
  } catch (err) {
    console.warn('[Stripe] Initialization warning:', err.message);
  }
}

function buildIdQuery(id) {
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
  }
  return { _id: id };
}

/**
 * POST /api/payments/create-checkout-session
 * Create Stripe Checkout session for a completed, unpaid booking
 */
router.post('/create-checkout-session', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId is required.',
      });
    }

    const { bookingsCollection } = getCollections();
    const query = buildIdQuery(bookingId);
    const booking = await bookingsCollection.findOne(query);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
      });
    }

    // Ownership check: Customer must own this booking
    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only pay for your own bookings.',
      });
    }

    // Business rule: Pay Now only when status === 'completed' and paymentStatus === 'unpaid'
    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Cannot pay for booking with status '${booking.status}'. Payment is only allowed after service is completed.`,
      });
    }

    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This booking has already been paid for.',
      });
    }

    const finalAmount = Number(booking.finalAmount || booking.basePrice);
    const unitAmountCents = Math.round(finalAmount * 100);

    // If live/test Stripe is configured with a valid key
    if (stripe) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `FixMate: ${booking.serviceTitle}`,
                description: `Technician: ${booking.technicianName} | Service Area: ${booking.address}`,
                images: booking.serviceImage ? [booking.serviceImage] : [],
              },
              unit_amount: unitAmountCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          bookingId: booking._id.toString(),
          customerEmail: booking.customerEmail,
          serviceTitle: booking.serviceTitle,
          amount: finalAmount.toString(),
        },
        success_url: `${CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${CLIENT_URL}/payment/cancel?booking_id=${booking._id}`,
      });

      return res.status(200).json({
        success: true,
        sessionId: session.id,
        url: session.url,
      });
    }

    // Mock session for local development or sandbox environment
    const mockSessionId = `cs_test_mock_${Date.now()}_${booking._id}`;
    const mockSuccessUrl = `${CLIENT_URL}/payment/success?session_id=${mockSessionId}&mock=true`;

    return res.status(200).json({
      success: true,
      sessionId: mockSessionId,
      url: mockSuccessUrl,
      isMock: true,
      message: 'Stripe simulated test session created.',
    });
  } catch (error) {
    console.error('Error in /api/payments/create-checkout-session:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to initiate payment session.',
    });
  }
});

/**
 * GET /api/payments/verify
 * Verify payment status after customer returns from Stripe Checkout
 * Implements strict IDEMPOTENCY: never saves duplicate payment record.
 */
router.get('/verify', verifyToken, async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: 'session_id query parameter is required.',
      });
    }

    const { paymentsCollection, bookingsCollection } = getCollections();

    // 1. Check idempotency: Did we already process this stripe session?
    const existingPayment = await paymentsCollection.findOne({ stripeSessionId: session_id });
    if (existingPayment) {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified.',
        payment: existingPayment,
      });
    }

    let bookingId = null;
    let transactionId = session_id;
    let paidAmount = null;

    if (stripe && !session_id.startsWith('cs_test_mock_')) {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (!session || session.payment_status !== 'paid') {
        return res.status(400).json({
          success: false,
          message: 'Payment has not been completed or verified by Stripe.',
        });
      }
      bookingId = session.metadata?.bookingId;
      transactionId = session.payment_intent || session.id;
      paidAmount = session.amount_total ? session.amount_total / 100 : null;
    } else {
      // Mock flow handling
      const parts = session_id.split('_');
      bookingId = parts[parts.length - 1];
    }

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Unable to resolve associated booking from payment session.',
      });
    }

    const bookingQuery = buildIdQuery(bookingId);
    const booking = await bookingsCollection.findOne(bookingQuery);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Associated repair booking not found.',
      });
    }

    const amountFinal = paidAmount || Number(booking.finalAmount || booking.basePrice);

    // Create Payment Record (Collection 4: payments)
    const newPayment = {
      bookingId: booking._id.toString(),
      serviceTitle: booking.serviceTitle,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      technicianName: booking.technicianName,
      technicianEmail: booking.technicianEmail,
      amount: amountFinal,
      currency: 'usd',
      transactionId: transactionId || `pi_sim_${Date.now()}`,
      stripeSessionId: session_id,
      paymentStatus: 'paid',
      paidAt: new Date(),
    };

    const paymentResult = await paymentsCollection.insertOne(newPayment);

    // Update booking paymentStatus to 'paid'
    await bookingsCollection.updateOne(bookingQuery, {
      $set: {
        paymentStatus: 'paid',
        paidAt: new Date(),
        updatedAt: new Date(),
      },
      $push: {
        statusHistory: {
          status: 'paid',
          changedAt: new Date(),
          note: `Payment of $${amountFinal} received successfully via Stripe.`,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified and recorded successfully!',
      payment: {
        _id: paymentResult.insertedId,
        ...newPayment,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/payments/verify:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment session.',
    });
  }
});

/**
 * POST /api/payments/webhook
 * Stripe raw webhook endpoint (Challenge 4)
 * Listens for checkout.session.completed, applies idempotency, and records payment.
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (stripe && STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.error(`[Stripe Webhook Error]: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { paymentsCollection, bookingsCollection } = getCollections();

    try {
      // Idempotency check: don't process twice
      const existing = await paymentsCollection.findOne({ stripeSessionId: session.id });
      if (!existing && session.metadata?.bookingId) {
        const bookingQuery = buildIdQuery(session.metadata.bookingId);
        const booking = await bookingsCollection.findOne(bookingQuery);

        if (booking) {
          const amount = session.amount_total ? session.amount_total / 100 : booking.finalAmount;

          const paymentDoc = {
            bookingId: booking._id.toString(),
            serviceTitle: booking.serviceTitle,
            customerName: booking.customerName,
            customerEmail: booking.customerEmail,
            technicianName: booking.technicianName,
            technicianEmail: booking.technicianEmail,
            amount,
            currency: 'usd',
            transactionId: session.payment_intent || session.id,
            stripeSessionId: session.id,
            paymentStatus: 'paid',
            paidAt: new Date(),
          };

          await paymentsCollection.insertOne(paymentDoc);

          await bookingsCollection.updateOne(bookingQuery, {
            $set: {
              paymentStatus: 'paid',
              paidAt: new Date(),
              updatedAt: new Date(),
            },
            $push: {
              statusHistory: {
                status: 'paid',
                changedAt: new Date(),
                note: `Payment recorded via Stripe Webhook ($${amount}).`,
              },
            },
          });
        }
      }
    } catch (saveErr) {
      console.error('Error recording payment in webhook:', saveErr);
    }
  }

  res.json({ received: true });
});

/**
 * GET /api/payments/my
 * Get all payment records for the logged-in customer
 */
router.get('/my', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { paymentsCollection } = getCollections();

    const payments = await paymentsCollection
      .find({ customerEmail: req.user.email })
      .sort({ paidAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error('Error in GET /api/payments/my:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load payment history.',
    });
  }
});

module.exports = router;
