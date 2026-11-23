const express = require('express');
const { ObjectId } = require('mongodb');
const { getCollections } = require('../config/db');
const { verifyToken, verifyTechnician } = require('../middleware/auth');

const router = express.Router();

/**
 * Valid service categories
 */
const ALLOWED_CATEGORIES = [
  'Smartphone',
  'Laptop & PC',
  'AC',
  'Refrigerator',
  'TV',
  'Washing Machine',
  'Electrical',
];

/**
 * Valid service modes
 */
const ALLOWED_MODES = ['Home Visit', 'Shop Drop-off'];

/**
 * Helper to safely construct an ObjectId query or fallback to string match
 */
function buildIdQuery(id) {
  if (ObjectId.isValid(id)) {
    return { $or: [{ _id: new ObjectId(id) }, { _id: id }] };
  }
  return { _id: id };
}

/**
 * GET /api/services
 * Public Browse with Server-Side Search, Filter, Sort & Pagination (Challenge 1)
 */
router.get('/', async (req, res) => {
  try {
    const { servicesCollection } = getCollections();
    const {
      search = '',
      category = '',
      serviceMode = '',
      sort = 'newest',
      page = 1,
      limit = 9,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 9);
    const skipNum = (pageNum - 1) * limitNum;

    // Base query: Only approved and available services appear publicly
    const query = {
      approvalStatus: 'approved',
      isAvailable: true,
    };

    // Server-side Search
    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      query.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { category: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { serviceArea: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    // Category Filter
    if (category && category !== 'All' && category.trim() !== '') {
      query.category = category.trim();
    }

    // Service Mode Filter
    if (serviceMode && serviceMode !== 'All' && serviceMode.trim() !== '') {
      query.serviceMode = serviceMode.trim();
    }

    // Sort options
    let sortQuery = { createdAt: -1 }; // default newest
    if (sort === 'price-asc') {
      sortQuery = { basePrice: 1 };
    } else if (sort === 'price-desc') {
      sortQuery = { basePrice: -1 };
    } else if (sort === 'newest') {
      sortQuery = { createdAt: -1 };
    }

    const total = await servicesCollection.countDocuments(query);
    const services = await servicesCollection
      .find(query)
      .sort(sortQuery)
      .skip(skipNum)
      .limit(limitNum)
      .toArray();

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      success: true,
      services,
      pagination: {
        total,
        page: pageNum,
        totalPages,
        limit: limitNum,
        hasPrev: pageNum > 1,
        hasNext: pageNum < totalPages,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/services:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve repair services.',
    });
  }
});

/**
 * GET /api/services/featured
 * Returns 6 latest approved and available services for homepage
 */
router.get('/featured', async (req, res) => {
  try {
    const { servicesCollection } = getCollections();

    const services = await servicesCollection
      .find({
        approvalStatus: 'approved',
        isAvailable: true,
      })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error('Error in GET /api/services/featured:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load featured services.',
    });
  }
});

/**
 * GET /api/services/technician/my-services
 * Returns all services for the logged-in technician
 */
router.get('/technician/my-services', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { servicesCollection } = getCollections();

    const services = await servicesCollection
      .find({ technicianEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error('Error in GET /api/services/technician/my-services:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch technician services.',
    });
  }
});

/**
 * GET /api/services/:id
 * Public service details with technician profile snapshot
 */
router.get('/:id', async (req, res) => {
  try {
    const { servicesCollection, usersCollection } = getCollections();
    const { id } = req.params;

    const query = buildIdQuery(id);
    const service = await servicesCollection.findOne(query);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Repair service not found.',
      });
    }

    // Fetch technician summary
    let technician = null;
    if (service.technicianEmail) {
      const techUser = await usersCollection.findOne(
        { email: service.technicianEmail },
        { projection: { password: 0 } }
      );
      if (techUser) {
        technician = {
          name: techUser.name,
          email: techUser.email,
          image: techUser.image || '',
          bio: techUser.bio || 'Experienced certified repair professional.',
          area: techUser.area || service.serviceArea,
          phone: techUser.phone || '',
        };
      }
    }

    return res.status(200).json({
      success: true,
      service,
      technician,
    });
  } catch (error) {
    console.error('Error in GET /api/services/:id:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch service details.',
    });
  }
});

/**
 * POST /api/services
 * Add a new repair service (Technician only)
 */
router.post('/', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      image,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea,
    } = req.body;

    if (!title || !category || !description || !basePrice || !estimatedDuration || !serviceMode || !serviceArea) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required to list a repair service.',
      });
    }

    const priceNum = Number(basePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Base price must be a positive number.',
      });
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`,
      });
    }

    if (!ALLOWED_MODES.includes(serviceMode)) {
      return res.status(400).json({
        success: false,
        message: 'Service mode must be either "Home Visit" or "Shop Drop-off".',
      });
    }

    const { servicesCollection } = getCollections();

    const newService = {
      title: title.trim(),
      category: category.trim(),
      description: description.trim(),
      image: image || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop',
      basePrice: priceNum,
      estimatedDuration: estimatedDuration.trim(),
      serviceMode: serviceMode.trim(),
      serviceArea: serviceArea.trim(),
      technicianName: req.user.name,
      technicianEmail: req.user.email,
      approvalStatus: 'pending', // Starts in pending until Admin approval
      isAvailable: true,
      createdAt: new Date(),
    };

    const result = await servicesCollection.insertOne(newService);

    return res.status(201).json({
      success: true,
      message: 'Repair service submitted successfully and is waiting for admin approval.',
      service: {
        _id: result.insertedId,
        ...newService,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/services:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create repair service.',
    });
  }
});

/**
 * PATCH /api/services/:id
 * Update repair service (Technician owner only).
 * Requirement: After editing, approvalStatus goes back to 'pending'.
 */
router.patch('/:id', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { id } = req.params;
    const { servicesCollection } = getCollections();

    const query = buildIdQuery(id);
    const existing = await servicesCollection.findOne(query);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.',
      });
    }

    // Ownership check: technician can only edit their own service
    if (existing.technicianEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only edit your own repair services.',
      });
    }

    const {
      title,
      category,
      description,
      image,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea,
    } = req.body;

    const updateFields = {
      approvalStatus: 'pending', // Resets to pending on edit as specified in requirement
      updatedAt: new Date(),
    };

    if (title !== undefined) updateFields.title = title.trim();
    if (category !== undefined) {
      if (!ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`,
        });
      }
      updateFields.category = category.trim();
    }
    if (description !== undefined) updateFields.description = description.trim();
    if (image !== undefined) updateFields.image = image.trim();
    if (basePrice !== undefined) {
      const priceNum = Number(basePrice);
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Base price must be a positive number.',
        });
      }
      updateFields.basePrice = priceNum;
    }
    if (estimatedDuration !== undefined) updateFields.estimatedDuration = estimatedDuration.trim();
    if (serviceMode !== undefined) {
      if (!ALLOWED_MODES.includes(serviceMode)) {
        return res.status(400).json({
          success: false,
          message: 'Service mode must be either "Home Visit" or "Shop Drop-off".',
        });
      }
      updateFields.serviceMode = serviceMode.trim();
    }
    if (serviceArea !== undefined) updateFields.serviceArea = serviceArea.trim();

    await servicesCollection.updateOne(query, { $set: updateFields });

    const updated = await servicesCollection.findOne(query);

    return res.status(200).json({
      success: true,
      message: 'Service updated successfully and returned to pending for admin approval.',
      service: updated,
    });
  } catch (error) {
    console.error('Error in PATCH /api/services/:id:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update repair service.',
    });
  }
});

/**
 * PATCH /api/services/:id/availability
 * Toggle service availability on/off (Technician owner only)
 */
router.patch('/:id/availability', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { id } = req.params;
    const { servicesCollection } = getCollections();

    const query = buildIdQuery(id);
    const existing = await servicesCollection.findOne(query);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.',
      });
    }

    if (existing.technicianEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only toggle availability for your own services.',
      });
    }

    const nextAvailability = req.body.isAvailable !== undefined
      ? Boolean(req.body.isAvailable)
      : !existing.isAvailable;

    await servicesCollection.updateOne(query, {
      $set: {
        isAvailable: nextAvailability,
        updatedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: `Service is now ${nextAvailability ? 'available' : 'hidden from public browse'}.`,
      isAvailable: nextAvailability,
    });
  } catch (error) {
    console.error('Error in PATCH /api/services/:id/availability:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to change service availability.',
    });
  }
});

/**
 * DELETE /api/services/:id
 * Delete a service (Technician owner only)
 */
router.delete('/:id', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { id } = req.params;
    const { servicesCollection } = getCollections();

    const query = buildIdQuery(id);
    const existing = await servicesCollection.findOne(query);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.',
      });
    }

    if (existing.technicianEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only delete your own repair services.',
      });
    }

    await servicesCollection.deleteOne(query);

    return res.status(200).json({
      success: true,
      message: 'Repair service deleted successfully.',
    });
  } catch (error) {
    console.error('Error in DELETE /api/services/:id:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete repair service.',
    });
  }
});

module.exports = router;
