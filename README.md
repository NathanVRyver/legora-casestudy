# Messaging App

A real-time messaging application similar to Facebook Messenger or WhatsApp.

## Features

**Login Page**
- Users can log in with username and password

**Messaging Page**
- List of open threads with option to create new thread
- Start new DM threads with other users by username
- Messages shown in chronological order with latest at bottom
- Real-time message delivery without page refresh

## Tech Stack

**Frontend**
- React with TypeScript
- Tailwind CSS for styling
- Server-Sent Events for real-time updates
- Vite for development

**Backend**
- Node.js with Express and TypeScript
- PostgreSQL database
- Type-safe API with gRPC-style client interface
- bcrypt for password hashing
- JWT token authentication

**Architecture**
- Monorepo with npm workspaces
- Shared TypeScript types between frontend and backend

## How to Run

1. **Install dependencies:**
```bash
npm install
```

2. **Setup database:**
```bash
npm run db:setup -w server
npm run db:seed -w server
```

3. **Start the application:**
```bash
npm run dev
```

The app will be available at http://localhost:3000

**Test Users:**
- Username: `user` / Password: `legora123`
- Username: `alice` / Password: `alice123`
- Username: `bob` / Password: `bob12345`

## Requirements

- Node.js >= 20.0.0
- PostgreSQL
- npm >= 10.0.0

## Project Structure

```
├── client/     # React frontend
├── server/     # Node.js backend  
└── shared/     # Shared TypeScript types
```

# Timer



