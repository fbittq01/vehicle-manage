#!/bin/bash

# Script để stop các services

echo "🛑 Stopping Vehicle Management System services..."

echo "   Stopping Docker containers..."
docker-compose down

echo "   Cleaning up..."
docker system prune -f > /dev/null 2>&1

echo "✅ All services stopped!"
