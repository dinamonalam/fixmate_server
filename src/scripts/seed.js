const bcrypt = require('bcryptjs');
const { connectDB, getCollections } = require('../config/db');

async function seed() {
  console.log('[Seed] Starting FixMate database seeding...');
  try {
    const { usersCollection, servicesCollection, bookingsCollection, paymentsCollection } = await connectDB();

    // Clear existing data for fresh clean state
    await usersCollection.deleteMany({});
    await servicesCollection.deleteMany({});
    await bookingsCollection.deleteMany({});
    await paymentsCollection.deleteMany({});

    console.log('[Seed] Cleared existing records.');

    // 1. Seed Users
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('Admin@123', salt);
    const techPasswordHash = await bcrypt.hash('Tech@123', salt);
    const customerPasswordHash = await bcrypt.hash('Customer@123', salt);

    const users = [
      {
        name: 'FixMate System Admin',
        email: 'admin@fixmate.com',
        password: adminPasswordHash,
        role: 'admin',
        phone: '+880 1711 000111',
        area: 'Banani, Dhaka',
        bio: 'FixMate Principal Operations & Compliance Administrator.',
        image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop',
        createdAt: new Date('2026-01-01'),
      },
      {
        name: 'Rahim Chowdhury',
        email: 'tech.rahim@fixmate.com',
        password: techPasswordHash,
        role: 'technician',
        phone: '+880 1819 223344',
        area: 'Dhanmondi, Dhaka',
        bio: 'Level-3 Certified Hardware Specialist with 8+ years expertise in Smartphone displays, MacBook logic boards, and micro-soldering.',
        image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=300&auto=format&fit=crop',
        createdAt: new Date('2026-01-10'),
      },
      {
        name: 'Karim Hasan',
        email: 'tech.karim@fixmate.com',
        password: techPasswordHash,
        role: 'technician',
        phone: '+880 1912 334455',
        area: 'Gulshan & Banani, Dhaka',
        bio: 'HVAC & Master Home Appliance Engineer specializing in Inverter AC servicing, Refrigerator cooling loops, and Smart Washers.',
        image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop',
        createdAt: new Date('2026-01-12'),
      },
      {
        name: 'Arman Hossain',
        email: 'customer.arman@fixmate.com',
        password: customerPasswordHash,
        role: 'customer',
        phone: '+880 1515 998877',
        area: 'Mirpur 10, Dhaka',
        bio: 'Software engineer and avid tech enthusiast.',
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop',
        createdAt: new Date('2026-01-15'),
      },
      {
        name: 'Fatima Rahman',
        email: 'customer.fatima@fixmate.com',
        password: customerPasswordHash,
        role: 'customer',
        phone: '+880 1616 443322',
        area: 'Sector 4, Uttara, Dhaka',
        bio: 'Homeowner seeking reliable smart appliance servicing.',
        image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop',
        createdAt: new Date('2026-01-16'),
      },
    ];

    await usersCollection.insertMany(users);
    console.log(`[Seed] Inserted ${users.length} users (Admin, Technicians, Customers).`);

    // 2. Seed 14 Approved & Available Services (2 per category across all 7 categories)
    const services = [
      // Smartphone
      {
        title: 'iPhone OLED Screen & Digitizer Replacement',
        category: 'Smartphone',
        description: 'Complete replacement of cracked or malfunctioning iPhone OLED screens using Grade-A OEM panels. Includes TrueTone transfer and oleophobic coating warranty.',
        image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&auto=format&fit=crop',
        basePrice: 55,
        estimatedDuration: '1-2 hours',
        serviceMode: 'Shop Drop-off',
        serviceArea: 'Dhanmondi, Dhaka',
        technicianName: 'Rahim Chowdhury',
        technicianEmail: 'tech.rahim@fixmate.com',
        approvalStatus: 'approved',
        isAvailable: true,
        createdAt: new Date('2026-02-01'),
      },
      {
        title: 'Samsung Galaxy Battery & Charging Port Repair',
        category: 'Smartphone',
        description: 'High-capacity battery replacement and Type-C charging port sub-board fix for Samsung Galaxy S, Note, and A series smartphones.',
        image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop',
        basePrice: 35,
        estimatedDuration: '1 hour',
        serviceMode: 'Home Visit',
        serviceArea: 'Dhanmondi, Dhaka',
        technicianName: 'Rahim Chowdhury',
        technicianEmail: 'tech.rahim@fixmate.com',
        approvalStatus: 'approved',
        isAvailable: true,
        createdAt: new Date('2026-02-03'),
      },

      // Laptop & PC
      {
        title: 'MacBook Motherboard & Liquid Damage Restoration',
        category: 'Laptop & PC',
        description: 'Component-level ultrasonic cleaning, corroded capacitor replacement, and power rail diagnostics for liquid-damaged MacBook Air and Pro laptops.',
        image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop',
        basePrice: 85,
        estimatedDuration: '1-2 days',
        serviceMode: 'Shop Drop-off',
        serviceArea: 'Dhanmondi, Dhaka',
        technicianName: 'Rahim Chowdhury',
        technicianEmail: 'tech.rahim@fixmate.com',
        approvalStatus: 'approved',
        isAvailable: true,
        createdAt: new Date('2026-02-05'),
      },
      {
        title: 'Gaming PC Deep Dust Cleaning & Thermal Paste Repaste',
        category: 'Laptop & PC',
        description: 'Comprehensive cooling overhaul: disassembly, radiator blower cleaning, premium Arctic MX-6 thermal compound repasting, and cable management.',
        image: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop',
        basePrice: 40,
        estimatedDuration: '2-3 hours',
        serviceMode: 'Home Visit',
        serviceArea: 'Dhanmondi, Dhaka',
        technicianName: 'Rahim Chowdhury',
        technicianEmail: 'tech.rahim@fixmate.com',
        approvalStatus: 'approved',
        isAvailable: true,
        createdAt: new Date('2026-02-06'),
      },

      // AC
      {
        title: 'Split Inverter AC Jet Wash & R410A/R32 Gas Refill',
        category: 'AC',
        description: 'High-pressure water pump cleaning for indoor cooling coils and outdoor condensers, drainage clearing, and precision pressure gas top-up.',
        image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=600&auto=format&fit=crop',
        basePrice: 45,
        estimatedDuration: '2 hours',
        serviceMode: 'Home Visit',
        serviceArea: 'Gulshan & Banani, Dhaka',
        technicianName: 'Karim Hasan',
        technicianEmail: 'tech.karim@fixmate.com',
        approvalStatus: 'approved',
        isAvailable: true,
        createdAt: new Date('2026-02-08'),
      },
      {
        title: 'Inverter AC Circuit PCB Board Repair & Diagnostics',
        category: 'AC',
        description: 'Troubleshooting AC error codes, replacing blown varistors, transistors, and inverter communication microcontrollers.',
        image: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600&auto=format&fit=crop',
        basePrice: 60,
        estimatedDuration: '1 day',
        serviceMode: 'Home Visit',
        serviceArea: 'Gulshan & Banani, Dhaka',
        technicianName: 'Karim Hasan',
        technicianEmail: 'tech.karim@fixmate.com',
        approvalStatus: 'approved',
        isAvailable: true,
        createdAt: new Date('2026-02-10'),
      },

      // Refrigerator
      {
        title: 'Frost & Deep Refrigerator Gas Leakage & Cooling Fix',
        category: 'Refrigerator',
        description: 'Nitrogen pressure leak detection, copper brazing, suction line repair, and eco-friendly R600a/R134a refrigerant recharging.',
        image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=600&auto=format&fit=crop',
        basePrice: 50,
        estimatedDuration: '3-4 hours',
        serviceMode: 'Home Visit',
        serviceArea: 'Gulshan & Banani, Dhaka',
        technicianName: 'Karim Hasan',
        technicianEmail: 'tech.karim@fixmate.com',
        approvalStatus: 'approved',
        isAvailable: true,
        createdAt: new Date('2026-02-12'),
      },
      {
        title: 'Refrigerator Thermostat & Defrost Timer Replacement',
        category: 'Refrigerator',
        description: 'Fixing freezing issues, excess ice accumulation, or no-cooling cycles by replacing faulty bi-metal sensors and defrost heaters.',
        image: 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=600&auto=format&fit=crop',
        basePrice: 38,
        estimatedDuration: '1-2 hours',
        serviceMode: 'Home Visit',
        serviceArea: 'Gulshan & Banani, Dhaka',
        technicianName: 'Karim Hasan',
        technicianEmail: 'tech.karim@fixmate.com',
        approvalStatus: 'approved',
        isAvailable: true,
        createdAt: new Date('2026-02-14'),
      },

      // TV
      {
        title: '4K Smart LED TV Backlight Replacement & Panel Repair',
        category: 'TV',
        description: 'Resolves dark screen with sound, flickering LEDs, or dim patches with brand-new aluminum backlight array strips.',
        image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&auto=format&fit=crop',
        basePrice: 65,
        estimatedDuration: '1 day',
        serviceMode: 'Shop Drop-off',
        serviceArea: 'Dhanmondi, Dhaka',
        technicianName: 'Rahim Chowdhury',
        technicianEmail: 'tech.rahim@fixmate.com',
        approvalStatus: 'approved',
        isAvailable: true,
        createdAt: new Date('2026-02-15'),
      },
      {
        title: 'Smart TV Motherboard Power Supply & HDMI Port Fix',
        category: 'TV',
        description: 'Power board capacitor swaps, voltage regulator fixes, and HDMI input port micro-soldering for Android and WebOS TVs.',
        image: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=600&auto=format&fit=crop',
        basePrice: 48,
        estimatedDuration: '3-5 hours',
        serviceMode: 'Shop Drop-off',
        serviceArea: 'Dhanmondi, Dhaka',
        technicianName: 'Rahim Chowdhury',
        technicianEmail: 'tech.rahim@fixmate.com',
        approvalStatus: 'approved',
        isAvailable: true,
        createdAt: new Date('2026-02-16'),
      },

      // Washing Machine
      {
        title: 'Front & Top Load Washer Motor & Drum Bearing Overhaul',
        category: 'Washing Machine',
        description: 'Elimination of loud spinning noise, vibrating drum, and stuck drive belts with genuine heavy-duty bearing seals.',
        image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=600&auto=format&fit=crop',
        basePrice: 52,
        estimatedDuration: '3-4 hours',
        serviceMode: 'Home Visit',
        serviceArea: 'Gulshan & Banani, Dhaka',
        technicianName: 'Karim Hasan',
        technicianEmail: 'tech.karim@fixmate.com',
        approvalStatus: 'approved',
        isAvailable: true,
        createdAt: new Date('2026-02-18'),
      },
      {
        title: 'Automatic Washer Water Inlet Valve & Drainage Pump Service',
        category: 'Washing Machine',
        description: 'Clears error codes (OE/IE), fixes slow water filling, unblocks lint filters, and replaces faulty electromagnetic water valves.',
        image: 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?w=600&auto=format&fit=crop',
        basePrice: 32,
        estimatedDuration: '1-2 hours',
        serviceMode: 'Home Visit',
        serviceArea: 'Gulshan & Banani, Dhaka',
        technicianName: 'Karim Hasan',
        technicianEmail: 'tech.karim@fixmate.com',
        approvalStatus: 'approved',
        isAvailable: true,
        createdAt: new Date('2026-02-19'),
      },

      // Electrical
      {
        title: 'Complete Home Electrical Wiring & DB Board Upgrade',
        category: 'Electrical',
        description: 'RCCB / MCB breaker installation, earthing earth-resistance testing, and whole-house safety wiring inspection.',
        image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop',
        basePrice: 70,
        estimatedDuration: '4-6 hours',
        serviceMode: 'Home Visit',
        serviceArea: 'Dhanmondi, Dhaka',
        technicianName: 'Rahim Chowdhury',
        technicianEmail: 'tech.rahim@fixmate.com',
        approvalStatus: 'approved',
        isAvailable: true,
        createdAt: new Date('2026-02-20'),
      },
      {
        title: 'Short Circuit Emergency Repair & Load Balancing',
        category: 'Electrical',
        description: 'Rapid troubleshooting of tripping circuit breakers, burning smells, overheated sockets, and single-phase load rebalancing.',
        image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop',
        basePrice: 42,
        estimatedDuration: '1-2 hours',
        serviceMode: 'Home Visit',
        serviceArea: 'Dhanmondi, Dhaka',
        technicianName: 'Rahim Chowdhury',
        technicianEmail: 'tech.rahim@fixmate.com',
        approvalStatus: 'approved',
        isAvailable: true,
        createdAt: new Date('2026-02-21'),
      },
    ];

    const insertedServices = await servicesCollection.insertMany(services);
    console.log(`[Seed] Inserted ${services.length} services across all 7 categories.`);

    const s0 = services[0]; // iPhone screen
    const s2 = services[2]; // MacBook logic board
    const s4 = services[4]; // AC Jet Wash
    const s6 = services[6]; // Refrigerator
    const s10 = services[10]; // Washer

    const s0Id = insertedServices.insertedIds[0].toString();
    const s2Id = insertedServices.insertedIds[2].toString();
    const s4Id = insertedServices.insertedIds[4].toString();
    const s6Id = insertedServices.insertedIds[6].toString();
    const s10Id = insertedServices.insertedIds[10].toString();

    // 3. Seed Sample Bookings in Various Pipeline States
    const bookings = [
      // 1. Requested Booking
      {
        serviceId: s0Id,
        serviceTitle: s0.title,
        serviceImage: s0.image,
        category: s0.category,
        basePrice: s0.basePrice,
        technicianName: s0.technicianName,
        technicianEmail: s0.technicianEmail,
        customerName: 'Arman Hossain',
        customerEmail: 'customer.arman@fixmate.com',
        customerPhone: '+880 1515 998877',
        address: 'House 14, Road 5, Mirpur 10, Dhaka',
        preferredDate: new Date('2026-11-28'),
        problemDescription: 'My iPhone screen was dropped on tile floor. Glass is shattered and top touch is unresponsive.',
        status: 'requested',
        finalAmount: s0.basePrice,
        paymentStatus: 'unpaid',
        statusHistory: [
          {
            status: 'requested',
            changedAt: new Date('2026-11-20'),
            note: 'Repair request submitted by customer.',
          },
        ],
        createdAt: new Date('2026-11-20'),
      },

      // 2. In-Progress Booking
      {
        serviceId: s4Id,
        serviceTitle: s4.title,
        serviceImage: s4.image,
        category: s4.category,
        basePrice: s4.basePrice,
        technicianName: s4.technicianName,
        technicianEmail: s4.technicianEmail,
        customerName: 'Fatima Rahman',
        customerEmail: 'customer.fatima@fixmate.com',
        customerPhone: '+880 1616 443322',
        address: 'House 22, Road 11, Sector 4, Uttara, Dhaka',
        preferredDate: new Date('2026-11-26'),
        problemDescription: 'Master bedroom 1.5 ton AC is not cooling properly and blowing foul odor when turned on.',
        status: 'in-progress',
        finalAmount: s4.basePrice,
        paymentStatus: 'unpaid',
        statusHistory: [
          {
            status: 'requested',
            changedAt: new Date('2026-11-18'),
            note: 'Repair request submitted by customer.',
          },
          {
            status: 'accepted',
            changedAt: new Date('2026-11-19'),
            note: 'Request accepted by technician.',
          },
          {
            status: 'in-progress',
            changedAt: new Date('2026-11-21'),
            note: 'Technician arrived on site and started jet wash procedure.',
          },
        ],
        createdAt: new Date('2026-11-18'),
      },

      // 3. Completed Booking (Awaiting Customer Payment!)
      {
        serviceId: s6Id,
        serviceTitle: s6.title,
        serviceImage: s6.image,
        category: s6.category,
        basePrice: s6.basePrice,
        technicianName: s6.technicianName,
        technicianEmail: s6.technicianEmail,
        customerName: 'Arman Hossain',
        customerEmail: 'customer.arman@fixmate.com',
        customerPhone: '+880 1515 998877',
        address: 'House 14, Road 5, Mirpur 10, Dhaka',
        preferredDate: new Date('2026-11-22'),
        problemDescription: 'Deep freezer compartment is warm and ice cream is melting completely.',
        status: 'completed',
        finalAmount: 58, // slightly adjusted with replacement filter
        paymentStatus: 'unpaid', // Customer can click "Pay Now" on this!
        statusHistory: [
          { status: 'requested', changedAt: new Date('2026-11-15'), note: 'Booking created.' },
          { status: 'accepted', changedAt: new Date('2026-11-16'), note: 'Technician confirmed.' },
          { status: 'in-progress', changedAt: new Date('2026-11-17'), note: 'Gas leak sealed and refilled.' },
          { status: 'completed', changedAt: new Date('2026-11-18'), note: 'Job completed. Final total $58.' },
        ],
        createdAt: new Date('2026-11-15'),
      },

      // 4. Paid Booking (With Review and Rating)
      {
        serviceId: s2Id,
        serviceTitle: s2.title,
        serviceImage: s2.image,
        category: s2.category,
        basePrice: s2.basePrice,
        technicianName: s2.technicianName,
        technicianEmail: s2.technicianEmail,
        customerName: 'Fatima Rahman',
        customerEmail: 'customer.fatima@fixmate.com',
        customerPhone: '+880 1616 443322',
        address: 'House 22, Road 11, Sector 4, Uttara, Dhaka',
        preferredDate: new Date('2026-11-10'),
        problemDescription: 'Spilled coffee over the keyboard. Device turned off instantly and won’t turn back on.',
        status: 'completed',
        finalAmount: 95,
        paymentStatus: 'paid',
        paidAt: new Date('2026-11-14'),
        rating: 5,
        review: 'Incredible work by Rahim! Saved my MacBook logic board and recovered all my project files.',
        statusHistory: [
          { status: 'requested', changedAt: new Date('2026-11-10'), note: 'Request submitted.' },
          { status: 'accepted', changedAt: new Date('2026-11-11'), note: 'Diagnostic agreed.' },
          { status: 'in-progress', changedAt: new Date('2026-11-12'), note: 'Ultrasonic cleaning done.' },
          { status: 'completed', changedAt: new Date('2026-11-13'), note: 'Work verified.' },
          { status: 'paid', changedAt: new Date('2026-11-14'), note: 'Stripe payment received ($95).' },
        ],
        createdAt: new Date('2026-11-10'),
      },
    ];

    const insertedBookings = await bookingsCollection.insertMany(bookings);
    console.log(`[Seed] Inserted ${bookings.length} sample bookings across various pipeline stages.`);

    // 4. Seed Payment for Paid Booking
    const paidBookingId = insertedBookings.insertedIds[3].toString();
    const payment = {
      bookingId: paidBookingId,
      serviceTitle: s2.title,
      customerName: 'Fatima Rahman',
      customerEmail: 'customer.fatima@fixmate.com',
      technicianName: s2.technicianName,
      technicianEmail: s2.technicianEmail,
      amount: 95,
      currency: 'usd',
      transactionId: 'pi_test_3OqL27FixMateVerified01',
      stripeSessionId: 'cs_test_mock_1700000000_seed',
      paymentStatus: 'paid',
      paidAt: new Date('2026-11-14'),
    };

    await paymentsCollection.insertOne(payment);
    console.log('[Seed] Inserted payment transaction record.');

    console.log('========================================================');
    console.log(' FixMate Database Seed Completed Successfully! 🎉');
    console.log(' Credentials:');
    console.log('  Admin:      admin@fixmate.com / Admin@123');
    console.log('  Technician: tech.rahim@fixmate.com / Tech@123');
    console.log('  Customer:   customer.arman@fixmate.com / Customer@123');
    console.log('========================================================');
    process.exit(0);
  } catch (err) {
    console.error('[Seed Error]:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  seed();
}

module.exports = seed;
