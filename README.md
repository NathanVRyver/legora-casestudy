# Real-Time Messaging Platform

A real-time messaging platform with instant communication, online presence, and typing indicators.


## Features

Real-time messaging with modern UX patterns:

- [x] Instant message delivery
- [x] Real-time typing indicators
- [x] Online/offline presence status
- [x] Persistent login sessions
- [x] User search and discovery
- [x] Clean, responsive design

## Tech Stack

**Frontend**

- React 18 with TypeScript
- Zustand for state management
- Tailwind CSS for styling
- Server-Sent Events for real-time communication
- Vite for development and building

**Backend**

- Node.js with Express and TypeScript
- PostgreSQL database with pg client
- Server-Sent Events for real-time features
- bcrypt for password hashing
- Token-based authentication with sessions

**Architecture**

- Monorepo with npm workspaces
- Shared TypeScript types and validation
- ESM modules throughout

## Quick Start

1. **Install and setup:**

```bash
npm install
npm run db:setup -w server
npm run db:seed -w server
```

2. **Start development:**

```bash
npm run dev
```

3. **Login with test accounts:**

- Username: `user` / Password: `legora123`
- Username: `alice` / Password: `alice123`
- Username: `bob` / Password: `bob12345`
  you can also see the other users when you run the seeding script or modify it to create new users.
  The app will be available at http://localhost:3000

## Database Schema

```
users
├── id (UUID, primary key)
├── username (unique)
├── email (unique)
└── password_hash

messages
├── id (UUID, primary key)
├── content (text)
├── sender_id (UUID, references users)
├── recipient_id (UUID, references users)
├── status (sent/delivered/read)
├── created_at (timestamp)
└── updated_at (timestamp)

user_sessions
├── id (UUID, primary key)
├── user_id (UUID, references users)
├── token (unique)
├── expires_at (timestamp)
└── created_at (timestamp)
```

## Development

### Project Structure

```
messaging-platform/
├── client/              # React frontend
│   ├── src/components/  # UI components
│   ├── src/hooks/       # Custom React hooks
│   ├── src/pages/       # Route components
│   ├── src/store/       # Zustand stores
│   └── src/lib/         # API client and utilities
├── server/              # Node.js backend
│   ├── src/routes/      # API routes
│   ├── src/db/          # Database operations
│   └── src/middleware/  # Express middleware
└── shared/              # Shared types and validation
```

### Available Scripts

- `npm run dev` - Start all servers in development mode
- `npm run build` - Build all packages for production
- `npm run db:reset` - Reset database with fresh test data
- `npm run type-check` - Run TypeScript checks
- `npm run lint` - Lint all packages
  see more on package.json

## Requirements

- Node.js >= 20.0.0
- PostgreSQL (any recent version)
- npm >= 10.0.0
