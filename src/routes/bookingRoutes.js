const express = require('express');
const { ObjectId } = require('mongodb');
const { getCollections } = require('../config/db');
const { verifyToken, verifyCustomer, verifyTechnician } = require('../middleware/auth');

const router = express.Router();

function buildIdQuery(id) {
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
  }
  return { _id: id };
}

/**
 * POST /api/bookings
 * Create a repair request (Customer only)
 * Enforces business rules:
 * - Customer only (no technician/admin)
 * - Preferred date >= today
 * - Problem description >= 20 chars
 * - No duplicate active requests (requested, accepted, in-progress)
 */
router.post('/', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const {
      serviceId,
      customerPhone,
      address,
      preferredDate,
      problemDescription,
    } = req.body;

    if (!serviceId || !customerPhone || !address || !preferredDate || !problemDescription) {
      return res.status(400).json({
        success: false,
        message: 'All booking fields (serviceId, phone, address, date, problem description) are required.',
      });
    }

    if (problemDescription.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Problem description must be at least 5 characters long.',
      });
    }

    const bookingDate = new Date(preferredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(bookingDate.getTime()) || bookingDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Preferred date must be today or a future date.',
      });
    }

    const { servicesCollection, bookingsCollection } = getCollections();

    // Verify service exists and is approved & available
    const serviceQuery = buildIdQuery(serviceId);
    const service = await servicesCollection.findOne(serviceQuery);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'The requested repair service was not found.',
      });
    }

    if (service.approvalStatus !== 'approved' || !service.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'This service is currently unavailable for bookings.',
      });
    }

    // Rule: Prevent duplicate active requests for the same service
    const existingActiveRequest = await bookingsCollection.findOne({
      serviceId: service._id.toString(),
      customerEmail: req.user.email,
      status: { $in: ['requested', 'accepted', 'in-progress'] },
    });

    if (existingActiveRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active request for this service. Please wait until it completes or is cancelled.',
      });
    }

    // Create booking document copying service snapshot
    const newBooking = {
      serviceId: service._id.toString(),
      serviceTitle: service.title,
      serviceImage: service.image,
      category: service.category,
      basePrice: service.basePrice,
      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,
      customerName: req.user.name,
      customerEmail: req.user.email,
      customerPhone: customerPhone.trim(),
      address: address.trim(),
      preferredDate: bookingDate,
      problemDescription: problemDescription.trim(),
      status: 'requested', // Initial status
      finalAmount: service.basePrice, // default = basePrice
      paymentStatus: 'unpaid',
      statusHistory: [
        {
          status: 'requested',
          changedAt: new Date(),
          note: 'Repair request submitted by customer.',
        },
      ],
      createdAt: new Date(),
    };

    const result = await bookingsCollection.insertOne(newBooking);

    return res.status(201).json({
      success: true,
      message: 'Repair request submitted successfully! Your technician will review it shortly.',
      booking: {
        _id: result.insertedId,
        ...newBooking,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit repair request.',
    });
  }
});

/**
 * GET /api/bookings/my
 * Get all bookings of the logged-in customer
 */
router.get('/my', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { bookingsCollection } = getCollections();

    const bookings = await bookingsCollection
      .find({ customerEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error('Error in GET /api/bookings/my:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve your bookings.',
    });
  }
});

/**
 * PATCH /api/bookings/:id/cancel
 * Cancel booking (Customer owner only, while status is 'requested')
 */
router.patch('/:id/cancel', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { id } = req.params;
    const { bookingsCollection } = getCollections();

    const query = buildIdQuery(id);
    const booking = await bookingsCollection.findOne(query);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
      });
    }

    // Ownership check
    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only cancel your own bookings.',
      });
    }

    // Only allow cancellation when status is 'requested'
    if (booking.status !== 'requested') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking in '${booking.status}' status. Cancellation is only allowed while status is 'requested'.`,
      });
    }

    const cancelEntry = {
      status: 'cancelled',
      changedAt: new Date(),
      note: 'Cancelled by customer.',
    };

    await bookingsCollection.updateOne(query, {
      $set: {
        status: 'cancelled',
        updatedAt: new Date(),
      },
      $push: {
        statusHistory: cancelEntry,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Booking has been cancelled.',
    });
  } catch (error) {
    console.error('Error in PATCH /api/bookings/:id/cancel:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel booking.',
    });
  }
});

/**
 * GET /api/bookings/technician
 * Get all bookings assigned to the logged-in technician
 * Supports optional ?status= query filter
 */
router.get('/technician', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { bookingsCollection } = getCollections();
    const { status } = req.query;

    const query = { technicianEmail: req.user.email };
    if (status && status !== 'all' && status.trim() !== '') {
      query.status = status.trim();
    }

    const bookings = await bookingsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error('Error in GET /api/bookings/technician:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve technician requests.',
    });
  }
});

/**
 * PATCH /api/bookings/:id/status
 * Strict Job Status Pipeline enforcement (Technician owner only - Challenge 3)
 * Rules:
 * - requested -> accepted OR rejected
 * - accepted -> in-progress
 * - in-progress -> completed (requires finalAmount > 0)
 * - completed, rejected, cancelled -> final states (no changes allowed)
 */
router.patch('/:id/status', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { id } = req.params;
    const { nextStatus, finalAmount, note } = req.body;
    const { bookingsCollection } = getCollections();

    if (!nextStatus) {
      return res.status(400).json({
        success: false,
        message: 'nextStatus is required.',
      });
    }

    const query = buildIdQuery(id);
    const booking = await bookingsCollection.findOne(query);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
      });
    }

    // Ownership check: technician can only update bookings assigned to them
    if (booking.technicianEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only manage requests assigned to you.',
      });
    }

    const current = booking.status;
    let isValidTransition = false;
    let extraUpdate = {};

    // Pipeline Validation
    if (current === 'requested') {
      if (nextStatus === 'accepted' || nextStatus === 'rejected') {
        isValidTransition = true;
      }
    } else if (current === 'accepted') {
      if (nextStatus === 'in-progress') {
        isValidTransition = true;
      }
    } else if (current === 'in-progress') {
      if (nextStatus === 'completed') {
        const amountNum = Number(finalAmount !== undefined ? finalAmount : booking.basePrice);
        if (isNaN(amountNum) || amountNum <= 0) {
          return res.status(400).json({
            success: false,
            message: 'A valid finalAmount greater than 0 is required when completing a job.',
          });
        }
        isValidTransition = true;
        extraUpdate.finalAmount = amountNum;
      }
    }

    if (!isValidTransition) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${current}' to '${nextStatus}'. Please follow the job status pipeline.`,
      });
    }

    const historyEntry = {
      status: nextStatus,
      changedAt: new Date(),
      note: note || `Status updated from ${current} to ${nextStatus} by technician.`,
    };

    await bookingsCollection.updateOne(query, {
      $set: {
        status: nextStatus,
        ...extraUpdate,
        updatedAt: new Date(),
      },
      $push: {
        statusHistory: historyEntry,
      },
    });

    const updatedBooking = await bookingsCollection.findOne(query);

    return res.status(200).json({
      success: true,
      message: `Job status updated to '${nextStatus}'.`,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error('Error in PATCH /api/bookings/:id/status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update job status.',
    });
  }
});

/**
 * POST /api/bookings/:id/review
 * Customer reviews a paid booking (Bonus Feature)
 */
router.post('/:id/review', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const { bookingsCollection } = getCollections();

    const query = buildIdQuery(id);
    const booking = await bookingsCollection.findOne(query);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only review your own bookings.' });
    }

    if (booking.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Reviews can only be submitted after the service has been paid.',
      });
    }

    const ratingNum = Math.min(5, Math.max(1, parseInt(rating, 10) || 5));

    await bookingsCollection.updateOne(query, {
      $set: {
        rating: ratingNum,
        review: review ? review.trim() : '',
        reviewedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Thank you! Your rating and review have been submitted.',
    });
  } catch (error) {
    console.error('Error in POST /api/bookings/:id/review:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit review.' });
  }
});

module.exports = router;
