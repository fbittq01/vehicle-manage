// MongoDB initialization script
db = db.getSiblingDB('quan_ly_phuong_tien');

// Create collections with indexes
db.createCollection('users');
db.createCollection('vehicles');
db.createCollection('accesslogs');

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "employeeId": 1 }, { sparse: true, unique: true });
db.users.createIndex({ "role": 1 });
db.users.createIndex({ "isActive": 1 });

db.vehicles.createIndex({ "licensePlate": 1 }, { unique: true });
db.vehicles.createIndex({ "owner": 1 });
db.vehicles.createIndex({ "vehicleType": 1 });
db.vehicles.createIndex({ "isActive": 1 });

db.accesslogs.createIndex({ "licensePlate": 1 });
db.accesslogs.createIndex({ "createdAt": -1 });
db.accesslogs.createIndex({ "action": 1 });
db.accesslogs.createIndex({ "verificationStatus": 1 });
db.accesslogs.createIndex({ "gateId": 1 });

print('Database initialization completed!');
