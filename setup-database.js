#!/usr/bin/env node

/**
 * MongoDB Database Initialization Script
 * Tự động tạo database và indexes khi không sử dụng Docker
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/quan_ly_phuong_tien';

async function initializeDatabase() {
  let client;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log(`   URI: ${MONGODB_URI}`);
    
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    console.log('✅ Connected to MongoDB successfully');
    
    // Create collections
    console.log('📦 Creating collections...');
    
    try {
      await db.createCollection('users');
      console.log('   ✅ Created users collection');
    } catch (error) {
      console.log('   ℹ️  Users collection already exists');
    }
    
    try {
      await db.createCollection('vehicles');
      console.log('   ✅ Created vehicles collection');
    } catch (error) {
      console.log('   ℹ️  Vehicles collection already exists');
    }
    
    try {
      await db.createCollection('accesslogs');
      console.log('   ✅ Created accesslogs collection');
    } catch (error) {
      console.log('   ℹ️  Accesslogs collection already exists');
    }
    
    // Create indexes
    console.log('🔍 Creating indexes...');
    
    // Users indexes
    await db.collection('users').createIndex({ "username": 1 }, { unique: true });
    await db.collection('users').createIndex({ "employeeId": 1 }, { sparse: true, unique: true });
    await db.collection('users').createIndex({ "role": 1 });
    await db.collection('users').createIndex({ "isActive": 1 });
    console.log('   ✅ Created users indexes');
    
    // Vehicles indexes
    await db.collection('vehicles').createIndex({ "licensePlate": 1 }, { unique: true });
    await db.collection('vehicles').createIndex({ "owner": 1 });
    await db.collection('vehicles').createIndex({ "vehicleType": 1 });
    await db.collection('vehicles').createIndex({ "isActive": 1 });
    console.log('   ✅ Created vehicles indexes');
    
    // Access logs indexes
    await db.collection('accesslogs').createIndex({ "licensePlate": 1 });
    await db.collection('accesslogs').createIndex({ "createdAt": -1 });
    await db.collection('accesslogs').createIndex({ "action": 1 });
    await db.collection('accesslogs').createIndex({ "verificationStatus": 1 });
    await db.collection('accesslogs').createIndex({ "gateId": 1 });
    await db.collection('accesslogs').createIndex({ "licensePlate": 1, "createdAt": -1 });
    await db.collection('accesslogs').createIndex({ "vehicle": 1, "action": 1, "createdAt": -1 });
    console.log('   ✅ Created accesslogs indexes');
    
    console.log('🎉 Database initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Hướng giải quyết:');
      console.error('   1. Kiểm tra MongoDB đã được cài đặt chưa');
      console.error('   2. Khởi động MongoDB service:');
      console.error('      • macOS: brew services start mongodb/brew/mongodb-community');
      console.error('      • Linux: sudo systemctl start mongod');
      console.error('      • Windows: Khởi động MongoDB service trong Services');
      console.error('   3. Kiểm tra port 27017 có bị chiếm dụng không');
    }
    
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase();
}

export default initializeDatabase;
