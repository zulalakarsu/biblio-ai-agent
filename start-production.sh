#!/bin/bash

# Start both frontend and backend servers for production

echo "🚀 Starting BiblioAI production servers..."

# Start backend in background (production mode without watch)
echo "📡 Starting backend server on port 3001..."
npm run server:prod &
BACKEND_PID=$!

# Wait a bit for backend to initialize
sleep 5

# Start frontend
echo "🎨 Starting frontend server on port 3000..."
npm start &
FRONTEND_PID=$!

echo "✅ Both servers started!"
echo "   Backend PID: $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"

# Keep script running
wait $BACKEND_PID $FRONTEND_PID

