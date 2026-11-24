const express = require('express');
const { ObjectId } = require('mongodb');
const { getCollections } = require('../config/db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

const router = express.Router();

function buildIdQuery(id) {
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
  }
  return { _id: id };
}

/**
 * All admin routes require verifyToken and verifyAdmin
 */
router.use(verifyToken, verifyAdmin);

/**
 * GET /api/admin/stats
 * Overview analytics for Admin Dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    const { usersCollection, servicesCollection, bookingsCollection, paymentsCollection } = getCollections();

    const totalUsers = await usersCollection.countDocuments();
    const totalTechnicians = await usersCollection.countDocuments({ role: 'technician' });
    const totalCustomers = await usersCollection.countDocuments({ role: 'customer' });
    const pendingServices = await servicesCollection.countDocuments({ approvalStatus: 'pending' });
    const totalBookings = await bookingsCollection.countDocuments();
    const completedBookings = await bookingsCollection.countDocuments({ status: 'completed' });

    // Calculate total platform revenue from payments collection
    const revenuePipeline = [
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } },
    ];
    const revenueResult = await paymentsCollection.aggregate(revenuePipeline).toArray();
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalTechnicians,
        totalCustomers,
        pendingServices,
        totalBookings,
        completedBookings,
        totalRevenue,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load admin statistics.',
    });
  }
});

/**
 * GET /api/admin/users
 * Manage Users list (role, name, email, photo, date)
 */
router.get('/users', async (req, res) => {
  try {
    const { usersCollection } = getCollections();

    const users = await usersCollection
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/users:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user list.',
    });
  }
});

/**
 * PATCH /api/admin/users/:id/role
 * Change user role (customer, technician, admin)
 * Rule: Admin cannot change their own role
 */
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['customer', 'technician', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role (customer, technician, or admin) is required.',
      });
    }

    const { usersCollection } = getCollections();
    const query = buildIdQuery(id);
    const targetUser = await usersCollection.findOne(query);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Spec requirement: The admin cannot change their own role.
    if (targetUser.email === req.user.email) {
      return res.status(400).json({
        success: false,
        message: 'Security policy violation: Administrators cannot modify their own role.',
      });
    }

    await usersCollection.updateOne(query, {
      $set: {
        role,
        updatedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: `User role successfully updated to ${role}.`,
    });
  } catch (error) {
    console.error('Error in PATCH /api/admin/users/:id/role:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user role.',
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Remove a user account from FixMate
 * Rule: Admin cannot delete their own account
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { usersCollection } = getCollections();
    const query = buildIdQuery(id);
    const targetUser = await usersCollection.findOne(query);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    if (targetUser.email === req.user.email) {
      return res.status(400).json({
        success: false,
        message: 'Security policy violation: Administrators cannot delete their own account.',
      });
    }

    await usersCollection.deleteOne(query);

    return res.status(200).json({
      success: true,
      message: `User ${targetUser.name} (${targetUser.email}) removed successfully.`,
    });
  } catch (error) {
    console.error('Error in DELETE /api/admin/users/:id:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove user account.',
    });
  }
});

/**
 * GET /api/admin/services
 * Manage Services with filter by approvalStatus
 */
router.get('/services', async (req, res) => {
  try {
    const { status } = req.query;
    const { servicesCollection } = getCollections();

    const query = {};
    if (status && status !== 'all') {
      query.approvalStatus = status;
    }

    // Pending services shown first for quick moderation
    const services = await servicesCollection
      .find(query)
      .sort({
        // Sort pending first, then by date descending
        approvalStatus: 1,
        createdAt: -1,
      })
      .toArray();

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/services:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load services for moderation.',
    });
  }
});

/**
 * PATCH /api/admin/services/:id/approval
 * Approve or Reject a service listing
 */
router.patch('/services/:id/approval', async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: 'approvalStatus must be "approved", "rejected", or "pending".',
      });
    }

    const { servicesCollection } = getCollections();
    const query = buildIdQuery(id);

    const existing = await servicesCollection.findOne(query);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.',
      });
    }

    await servicesCollection.updateOne(query, {
      $set: {
        approvalStatus,
        reviewedAt: new Date(),
        reviewedBy: req.user.email,
        updatedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: `Service has been marked as ${approvalStatus}.`,
    });
  } catch (error) {
    console.error('Error in PATCH /api/admin/services/:id/approval:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update service approval status.',
    });
  }
});

/**
 * GET /api/admin/bookings
 * Read-only monitor of all bookings on platform
 */
router.get('/bookings', async (req, res) => {
  try {
    const { status } = req.query;
    const { bookingsCollection } = getCollections();

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
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
    console.error('Error in GET /api/admin/bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load bookings list.',
    });
  }
});

/**
 * GET /api/admin/payments
 * All payment transactions with total platform revenue
 */
router.get('/payments', async (req, res) => {
  try {
    const { paymentsCollection } = getCollections();

    const payments = await paymentsCollection
      .find({})
      .sort({ paidAt: -1 })
      .toArray();

    const totalRevenue = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    return res.status(200).json({
      success: true,
      payments,
      totalRevenue,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/payments:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load transaction history.',
    });
  }
});

module.exports = router;
