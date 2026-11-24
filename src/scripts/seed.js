const { connectDB } = require('../config/db');
const { getSeedData } = require('./seedData');

async function seed() {
  console.log('[Seed] Connecting to MongoDB and starting FixMate database seeding...');
  try {
    const { usersCollection, servicesCollection, bookingsCollection, paymentsCollection } = await connectDB();

    // Clear existing data for fresh clean state
    await usersCollection.deleteMany({});
    await servicesCollection.deleteMany({});
    await bookingsCollection.deleteMany({});
    await paymentsCollection.deleteMany({});

    console.log('[Seed] Cleared existing records.');

    const { users, services, bookings, payments } = await getSeedData();

    await usersCollection.insertMany(users);
    console.log(`[Seed] Inserted ${users.length} users successfully.`);

    await servicesCollection.insertMany(services);
    console.log(`[Seed] Inserted ${services.length} services successfully.`);

    await bookingsCollection.insertMany(bookings);
    console.log(`[Seed] Inserted ${bookings.length} bookings successfully.`);

    await paymentsCollection.insertMany(payments);
    console.log(`[Seed] Inserted ${payments.length} payment records successfully.`);

    console.log('========================================================');
    console.log(' FixMate Database Seed Completed Successfully in MongoDB! 🎉');
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
