#!/bin/bash

# Script để start các services cần thiết cho development

echo "🚀 Starting Vehicle Management System Development Environment"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo "📦 Starting MongoDB with Docker Compose..."
docker-compose up -d mongodb

# Wait for MongoDB to be ready
echo "⏳ Waiting for MongoDB to be ready..."
sleep 10

# Check if MongoDB is accessible
while ! docker exec quan-ly-phuong-tien-mongodb mongosh --eval "db.adminCommand('ismaster')" > /dev/null 2>&1; do
    echo "   Waiting for MongoDB..."
    sleep 2
done

echo "✅ MongoDB is ready!"
echo ""

echo "🔧 Installing dependencies (if needed)..."
npm install

echo ""
echo "🌱 Starting development server..."
echo "   API will be available at: http://localhost:5000"
echo "   Health check: http://localhost:5000/api/health"
echo "   MongoDB Express: http://localhost:8081 (admin/admin123)"
echo ""
echo "🛑 Press Ctrl+C to stop the server"
echo ""

npm run dev
