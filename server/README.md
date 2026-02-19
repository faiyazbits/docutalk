# Server

Node.js server for Docutalk using Express.js.

## Features

- Express.js web framework
- CORS enabled
- ES6 modules support
- Hot reload with Node.js watch mode

## Getting Started

### Install dependencies

From the workspace root:
```bash
pnpm install
```

Or from this directory:
```bash
pnpm install
```

### Development

Run the server in development mode with hot reload:
```bash
pnpm dev
```

The server will start on `http://localhost:3000`

### Production

Start the server:
```bash
pnpm start
```

## API Endpoints

- `GET /` - Welcome message
- `GET /api/health` - Health check endpoint

## Environment Variables

- `PORT` - Server port (default: 3000)
