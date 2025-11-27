# Test App - Node.js Sample API

A simple Node.js Express application with sample endpoints for testing deployment.

## Available Endpoints

- `GET /` - Root endpoint with API documentation
- `GET /health` - Health check endpoint
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/echo` - Echo endpoint (returns posted data)
- `GET /api/time` - Get current server time

## Running Locally

### Install dependencies
```bash
npm install
```

### Start the server
```bash
npm start
```

The server will run on `http://localhost:3000`

## Running with Docker

### Build the Docker image
```bash
docker build -t test-app .
```

### Run the container
```bash
docker run -p 3000:3000 test-app
```

### Run with custom port
```bash
docker run -p 8080:3000 -e PORT=3000 test-app
```

### Stop the container
```bash
docker ps  # Find the container ID
docker stop <container_id>
```

## Testing the Endpoints

### Using curl
```bash
# Root endpoint
curl http://localhost:3000/

# Health check
curl http://localhost:3000/health

# Get users
curl http://localhost:3000/api/users

# Get specific user
curl http://localhost:3000/api/users/1

# Echo endpoint
curl -X POST http://localhost:3000/api/echo \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello World"}'

# Get time
curl http://localhost:3000/api/time
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (default: development)
