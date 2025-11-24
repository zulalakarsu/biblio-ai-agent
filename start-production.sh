#!/bin/bash

# Start both frontend and backend servers for production

echo "🚀 Starting BiblioAI production servers..."

# Set PORT for Next.js if not set (Render provides dynamic PORT)
export PORT=${PORT:-3000}

echo "📡 Starting backend server on port 3001..."
npm run server:prod &
BACKEND_PID=$!

echo "⏳ Waiting for backend to initialize..."
sleep 5

echo "🎨 Starting frontend server on port $PORT..."
npm start &
FRONTEND_PID=$!

echo "✅ Both servers started!"
echo "   Backend PID: $BACKEND_PID (port 3001)"
echo "   Frontend PID: $FRONTEND_PID (port $PORT)"

# Trap SIGTERM and SIGINT to gracefully shutdown
trap "echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID; exit 0" SIGTERM SIGINT

# Keep script running and wait for both processes
wait $BACKEND_PID $FRONTEND_PID

