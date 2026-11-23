const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { getSeedData } = require('../scripts/seedData');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fixmate';
const dbName = process.env.DB_NAME || 'fixmate';

let client = null;
let db = null;
let isInMemory = false;

let collections = {
  usersCollection: null,
  servicesCollection: null,
  bookingsCollection: null,
  paymentsCollection: null,
};

/**
 * Match an item against MongoDB query object
 */
function matchQuery(item, query) {
  if (!query || Object.keys(query).length === 0) return true;

  for (const [key, val] of Object.entries(query)) {
    if (key === '$or') {
      const anyMatch = val.some((subQuery) => matchQuery(item, subQuery));
      if (!anyMatch) return false;
      continue;
    }

    if (key === '_id') {
      const targetId = val instanceof ObjectId ? val.toString() : (val?._id ? val._id.toString() : String(val));
      const itemId = item._id ? item._id.toString() : '';
      if (itemId !== targetId) return false;
      continue;
    }

    const itemVal = item[key];

    if (val && typeof val === 'object') {
      if (val.$regex) {
        const regex = new RegExp(val.$regex, val.$options || 'i');
        if (!regex.test(String(itemVal || ''))) return false;
        continue;
      }
      if (val.$in) {
        if (!val.$in.includes(itemVal)) return false;
        continue;
      }
    }

    if (itemVal !== val) {
      return false;
    }
  }

  return true;
}

/**
 * Lightweight In-Memory Collection Emulator
 */
class InMemoryCollection {
  constructor(name, initialData = []) {
    this.name = name;
    this.items = [...initialData];
  }

  find(query = {}) {
    let results = this.items.filter((item) => matchQuery(item, query));

    const cursor = {
      _sort: null,
      _skip: 0,
      _limit: Infinity,
      sort(sortObj) {
        this._sort = sortObj;
        return this;
      },
      skip(n) {
        this._skip = Number(n) || 0;
        return this;
      },
      limit(n) {
        this._limit = Number(n) || Infinity;
        return this;
      },
      async toArray() {
        let arr = [...results];
        if (this._sort) {
          const [sortKey, sortDir] = Object.entries(this._sort)[0] || [];
          if (sortKey) {
            arr.sort((a, b) => {
              const valA = a[sortKey];
              const valB = b[sortKey];
              if (valA < valB) return sortDir === -1 ? 1 : -1;
              if (valA > valB) return sortDir === -1 ? -1 : 1;
              return 0;
            });
          }
        }
        if (this._skip > 0) {
          arr = arr.slice(this._skip);
        }
        if (this._limit < Infinity) {
          arr = arr.slice(0, this._limit);
        }
        return arr;
      },
    };

    return cursor;
  }

  async findOne(query = {}, options = {}) {
    return this.items.find((item) => matchQuery(item, query)) || null;
  }

  async countDocuments(query = {}) {
    return this.items.filter((item) => matchQuery(item, query)).length;
  }

  async insertOne(doc) {
    const newDoc = {
      _id: doc._id || new ObjectId(),
      ...doc,
      createdAt: doc.createdAt || new Date(),
    };
    this.items.push(newDoc);
    return { insertedId: newDoc._id };
  }

  async insertMany(docs) {
    const insertedIds = {};
    const created = docs.map((doc, idx) => {
      const id = doc._id || new ObjectId();
      insertedIds[idx] = id;
      return {
        _id: id,
        ...doc,
        createdAt: doc.createdAt || new Date(),
      };
    });
    this.items.push(...created);
    return { insertedIds };
  }

  async updateOne(query, update) {
    const idx = this.items.findIndex((item) => matchQuery(item, query));
    if (idx === -1) return { matchedCount: 0, modifiedCount: 0 };

    const target = this.items[idx];
    if (update.$set) {
      Object.assign(target, update.$set);
    }
    if (update.$push) {
      for (const [key, pushVal] of Object.entries(update.$push)) {
        if (!Array.isArray(target[key])) target[key] = [];
        target[key].push(pushVal);
      }
    }
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async findOneAndUpdate(query, update, options = {}) {
    const idx = this.items.findIndex((item) => matchQuery(item, query));
    if (idx === -1) return { value: null };

    const target = this.items[idx];
    if (update.$set) Object.assign(target, update.$set);
    if (update.$push) {
      for (const [key, pushVal] of Object.entries(update.$push)) {
        if (!Array.isArray(target[key])) target[key] = [];
        target[key].push(pushVal);
      }
    }
    return { value: target };
  }

  async deleteOne(query) {
    const idx = this.items.findIndex((item) => matchQuery(item, query));
    if (idx !== -1) {
      this.items.splice(idx, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async deleteMany(query = {}) {
    if (Object.keys(query).length === 0) {
      const count = this.items.length;
      this.items = [];
      return { deletedCount: count };
    }
    const before = this.items.length;
    this.items = this.items.filter((item) => !matchQuery(item, query));
    return { deletedCount: before - this.items.length };
  }

  async aggregate(pipeline = []) {
    let result = [...this.items];
    for (const stage of pipeline) {
      if (stage.$match) {
        result = result.filter((item) => matchQuery(item, stage.$match));
      }
      if (stage.$group) {
        let total = 0;
        for (const item of result) {
          total += Number(item.amount) || 0;
        }
        result = [{ _id: null, totalRevenue: total }];
      }
    }
    return {
      async toArray() {
        return result;
      },
    };
  }

  async createIndex() {
    return Promise.resolve();
  }
}

async function connectDB() {
  if (db || isInMemory) return collections;

  try {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true,
      },
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 3000,
    });

    await client.connect();
    db = client.db(dbName);
    console.log(`[MongoDB] Connected successfully to database: ${dbName}`);

    collections.usersCollection = db.collection('users');
    collections.servicesCollection = db.collection('services');
    collections.bookingsCollection = db.collection('bookings');
    collections.paymentsCollection = db.collection('payments');

    return collections;
  } catch (error) {
    console.log(`---------------------------------------------------------------`);
    console.log(`[Database Notice] Real MongoDB instance not found at ${uri}.`);
    console.log(`[Database Notice] Auto-activating FixMate In-Memory Storage Engine with realistic seed dataset.`);
    console.log(`[Database Notice] To use real MongoDB, set a valid MONGODB_URI in server/.env (e.g. MongoDB Atlas).`);
    console.log(`---------------------------------------------------------------`);

    isInMemory = true;
    const seedData = await getSeedData();

    collections.usersCollection = new InMemoryCollection('users', seedData.users);
    collections.servicesCollection = new InMemoryCollection('services', seedData.services);
    collections.bookingsCollection = new InMemoryCollection('bookings', seedData.bookings);
    collections.paymentsCollection = new InMemoryCollection('payments', seedData.payments);

    return collections;
  }
}

function getCollections() {
  if (!collections.usersCollection) {
    throw new Error('Database not connected. Please ensure connectDB() has been called.');
  }
  return collections;
}

function getDb() {
  return db;
}

function getClient() {
  return client;
}

module.exports = {
  connectDB,
  getCollections,
  getDb,
  getClient,
};
