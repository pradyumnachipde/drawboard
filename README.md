# Drawboard — Real-Time Collaborative Whiteboard

A production-ready collaborative whiteboard built with Django Channels, React, PostgreSQL, and Redis. Multiple users can draw together in real-time, chat, and see each other's cursors — all synchronized over WebSockets.

---

## Tech Stack

| Layer        | Technology                                    |
|-------------|-----------------------------------------------|
| Frontend    | React 18, Tailwind CSS, HTML5 Canvas API      |
| Backend     | Django 4.2, Django REST Framework             |
| Real-time   | Django Channels 4, WebSockets                 |
| Auth        | JWT (djangorestframework-simplejwt)           |
| Database    | PostgreSQL 16                                 |
| Cache/Broker| Redis 7                                       |
| Server      | Daphne (ASGI)                                 |
| Proxy       | Nginx                                         |
| Container   | Docker + Docker Compose                       |

---

## Features

- **Real-time drawing** — pen, eraser, rectangle, circle, line, arrow tools
- **Live collaboration** — see strokes as others draw them
- **Collaborative cursors** — see teammates' mouse positions in real-time
- **Room system** — create or join rooms with unique codes
- **Presence indicators** — see who is online in the room
- **In-room chat** — WebSocket-powered chat with typing indicators
- **Undo / Redo** — per-user, propagated to all room members
- **Canvas export** — download the board as a PNG
- **JWT auth** — register, login, guest access, token refresh
- **Persistence** — all strokes saved to PostgreSQL; canvas replayed on join
- **Soft deletes** — undo preserves data for replay/history

---

## Quick Start (Docker)

### 1. Clone and configure

```bash
git clone <your-repo-url> drawboard
cd drawboard
cp .env.example .env
# Edit .env if needed (defaults work for local dev)
```

### 2. Run everything

```bash
docker compose up --build
```

| Service   | URL                            |
|-----------|-------------------------------|
| App       | http://localhost               |
| API       | http://localhost/api/         |
| Admin     | http://localhost/admin/       |

### 3. Create a superuser (optional)

```bash
docker compose exec backend python manage.py createsuperuser
```

---

## Local Development (without Docker)

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables (or create a .env file)
export DB_HOST=localhost
export REDIS_URL=redis://localhost:6379
export SECRET_KEY=dev-secret-key

# Run migrations
python manage.py migrate

# Start the ASGI server
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Set environment variables
echo "REACT_APP_API_URL=http://localhost:8000/api" > .env.local
echo "REACT_APP_WS_URL=ws://localhost:8000"       >> .env.local

# Start dev server
npm start
```

The React dev server proxies `/api` to Django automatically (configured in `package.json`).

### Required services

- PostgreSQL running on `localhost:5432`
- Redis running on `localhost:6379`

Using Docker for just the services:

```bash
docker run -d -p 5432:5432 -e POSTGRES_DB=whiteboard -e POSTGRES_PASSWORD=postgres postgres:16-alpine
docker run -d -p 6379:6379 redis:7-alpine
```

---

## Project Structure

```
drawboard/
├── backend/
│   ├── config/
│   │   ├── settings.py         # All Django settings
│   │   ├── asgi.py             # ASGI + WebSocket routing
│   │   └── urls.py             # Top-level URL conf
│   ├── apps/
│   │   ├── accounts/           # User auth (JWT, register, guest)
│   │   ├── rooms/              # Room CRUD + membership
│   │   ├── whiteboard/         # WS consumer, stroke model, middleware
│   │   └── chat/               # WS consumer, message model
│   ├── entrypoint.sh           # Docker: wait → migrate → serve
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/index.js        # Axios client + JWT interceptors
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx # Auth state + token management
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js # Reconnecting WS hook
│   │   │   ├── useWhiteboard.js# Drawing engine + WS integration
│   │   │   └── useChat.js      # Chat WS hook + typing indicators
│   │   ├── components/
│   │   │   ├── WhiteboardCanvas.jsx
│   │   │   ├── Toolbar.jsx     # Drawing tools, color, size
│   │   │   ├── PresenceBar.jsx # Online users
│   │   │   └── ChatPanel.jsx   # Chat UI
│   │   └── pages/
│   │       ├── LoginPage.jsx   # Login + register
│   │       ├── LobbyPage.jsx   # Create/join rooms
│   │       ├── RoomPage.jsx    # Room entry point
│   │       └── ProfilePage.jsx # Profile management
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── nginx.conf
└── .env.example
```

---

## WebSocket Protocol

### Whiteboard (`ws://host/ws/whiteboard/<ROOM_CODE>/?token=<JWT>`)

| Direction      | Type          | Payload                                              |
|---------------|---------------|------------------------------------------------------|
| Server → Client| `replay`      | `{ strokes: [...] }` — full canvas on connect        |
| Client → Server| `draw_stroke` | `{ stroke: { tool, color, size, points, seq } }`     |
| Both           | `draw_stroke` | Relayed to all other room members                    |
| Client → Server| `cursor_move` | `{ x, y }` — throttled at 25fps                     |
| Both           | `cursor_move` | `{ x, y, user_id, username, color }`                 |
| Client → Server| `undo`        | Soft-deletes user's last stroke                      |
| Both           | `undo`        | `{ stroke_id }` — broadcasted to room               |
| Client → Server| `redo`        | Restores last soft-deleted stroke                    |
| Client → Server| `clear`       | Owner only — clears all strokes                      |
| Server → Client| `presence`    | `{ users: [...] }` — on join/leave                   |

### Chat (`ws://host/ws/chat/<ROOM_CODE>/?token=<JWT>`)

| Direction      | Type           | Payload                                             |
|---------------|----------------|-----------------------------------------------------|
| Server → Client| `history`      | `{ messages: [...] }` — last 100 messages on connect|
| Client → Server| `chat_message` | `{ text: "..." }`                                   |
| Both           | `chat_message` | Full message object with timestamp                  |
| Client → Server| `typing`       | `{ is_typing: true|false }`                         |
| Both           | `typing`       | `{ user_id, username, is_typing }`                  |

---

## REST API Endpoints

```
POST   /api/auth/register/          Register new user
POST   /api/auth/login/             Login → access + refresh tokens
POST   /api/auth/token/refresh/     Refresh access token
POST   /api/auth/guest/             Create guest session
POST   /api/auth/logout/            Blacklist refresh token
GET    /api/auth/me/                Current user profile
PATCH  /api/auth/me/                Update profile
PUT    /api/auth/me/password/       Change password

GET    /api/rooms/                  List my rooms
POST   /api/rooms/                  Create room
POST   /api/rooms/join/             Join room by code
GET    /api/rooms/<code>/           Room detail + members
DELETE /api/rooms/<code>/           Deactivate room (owner)
POST   /api/rooms/<code>/leave/     Leave room
GET    /api/rooms/<code>/members/   Room member list
POST   /api/rooms/<code>/snapshot/  Save canvas snapshot

GET    /api/whiteboard/<code>/strokes/  Stroke history (for export/replay)
```

---

## Keyboard Shortcuts

| Shortcut             | Action               |
|----------------------|----------------------|
| `P`                  | Pen tool             |
| `E`                  | Eraser tool          |
| `R`                  | Rectangle tool       |
| `C`                  | Circle tool          |
| `L`                  | Line tool            |
| `A`                  | Arrow tool           |
| `Ctrl+Z`             | Undo                 |
| `Ctrl+Shift+Z`       | Redo                 |

---

## Deployment Notes

For production, set these in your `.env`:

```env
DEBUG=False
SECRET_KEY=<64-char random string>
ALLOWED_HOSTS=yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
REACT_APP_API_URL=https://yourdomain.com/api
REACT_APP_WS_URL=wss://yourdomain.com
```

For HTTPS/WSS, add SSL termination at Nginx or use a load balancer (AWS ALB, Cloudflare, etc.).

---

## License

MIT
