# Enterprise Notification Gateway

A production-ready notification microservice built with NestJS — handles Email and SMS delivery at scale with retry, idempotency, and real-time observability.

---

## Architecture

```
┌─────────────────────────────────────────┐
│           CLIENT SERVICES               │
│     (HR System, ERP, CRM, etc.)         │
└──────────────────┬──────────────────────┘
                   │  HTTP POST /notifications
                   ▼
┌─────────────────────────────────────────┐
│           API GATEWAY                   │
│  • Idempotency check (Redis)            │
│  • Rate limiting (Redis)                │
│  • INSERT notification → PostgreSQL     │
│  • Publish event → RabbitMQ             │
└──────────┬──────────────────────────────┘
           │
    ┌──────┴───────┐
    ▼              ▼
notifications   notifications
  .email          .sms
    │              │
    ▼              ▼
┌────────┐    ┌────────┐
│ Email  │    │  SMS   │
│ Worker │    │ Worker │
│  SMTP  │    │ Twilio │
└───┬────┘    └───┬────┘
    └──────┬───────┘
           ▼
     PostgreSQL
  PENDING → SENT
           │
     Dead Letter
       Queue
  (failed after 3x)
```

---

## Features

- **Multi-channel** — Email (SMTP/Mailtrap) and SMS (Twilio) from a single API
- **Async processing** — Returns 202 immediately, delivers in background via RabbitMQ
- **Idempotency** — Redis-based deduplication with 24-hour TTL prevents duplicate sends
- **Auto retry** — Exponential backoff (2s → 4s → 8s) with Dead Letter Queue after 3 failures
- **Rate limiting** — Redis-backed throttling protects SMTP servers from being blocked
- **Observability** — Prometheus metrics + Grafana dashboard (queue depth, delivery rate, p95 latency)

---

## Benchmark Results

Load tested with k6 — 200 concurrent virtual users over 2 minutes on local M2:

| Metric | Result | Target |
|--------|--------|--------|
| Throughput | **741 req/s** (44,000/min) | 10,000/min |
| p95 Latency | **73ms** | < 200ms |
| Error Rate | **0.00%** | < 1% |
| Total Requests | 89,069 in 2 min | — |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS (TypeScript) |
| Message Broker | RabbitMQ |
| Cache / Rate Limit | Redis |
| Database | PostgreSQL + TypeORM |
| Email | Nodemailer + SMTP (Mailtrap for dev) |
| SMS | Twilio |
| Metrics | Prometheus + prom-client |
| Dashboard | Grafana |
| Load Testing | k6 |
| Infrastructure | Docker Compose |

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- npm

### 1. Clone and install

```bash
git clone https://github.com/your-username/enterprise-noti.git
cd enterprise-noti
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# SMTP (use Mailtrap for dev)
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_mailtrap_user
SMTP_PASS=your_mailtrap_pass

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

POSTGRES_DB=notification_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password_here

RABBITMQ_USER=rabbit
RABBITMQ_PASSWORD=your_password_here

GF_ADMIN_USER=admin
GF_ADMIN_PASSWORD=your_password_here

### 3. Start infrastructure

```bash
docker-compose up -d
```

| Service | URL |
|---------|-----|
| API Gateway | http://localhost:3000 |
| RabbitMQ Management | http://localhost:15672 (rabbit/rabbit) |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 (admin/admin) |

### 4. Run services

```bash
# Terminal 1
npx nest start api-gateway --watch

# Terminal 2
npx nest start email-worker --watch

# Terminal 3
npx nest start sms-worker --watch
```

---

## API Reference

### Send Notification

```http
POST /notifications
Content-Type: application/json

{
  "channel": "email",
  "to": "user@example.com",
  "subject": "System Alert",
  "body": "<p>Hello from Notification Gateway</p>",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response `202 Accepted`:**
```json
{
  "notificationId": "7f0653bf-5bc9-43e5-85ca-5ce48bcc1026",
  "status": "accepted",
  "message": "Notification accepted and queued"
}
```

### Check Status

```http
GET /notifications/:id/status
```

**Response:**
```json
{
  "id": "7f0653bf-...",
  "status": "SENT",
  "channel": "email",
  "recipient": "user@example.com",
  "attempts": 1,
  "sentAt": "2026-05-03T10:30:00.000Z",
  "createdAt": "2026-05-03T10:29:59.800Z"
}
```

**Notification statuses:** `PENDING` → `SENT` / `RETRYING` / `DEAD`

---

## System Flows

### Happy Path
```
Client → POST /notifications
       → API Gateway checks idempotency (Redis)
       → INSERT notifications table (PENDING)
       → Publish event to RabbitMQ
       → Return 202 Accepted

Worker → Consume message
       → Send via SMTP / Twilio
       → UPDATE status = SENT
       → ACK message
```

### Retry Flow
```
Worker fails to send
  → attempts < 3: UPDATE RETRYING, NACK + requeue (exponential backoff)
  → attempts >= 3: UPDATE DEAD, NACK no-requeue → Dead Letter Queue
```

### Idempotency Flow
```
Same idempotencyKey sent twice
  → Redis HIT: return cached notificationId immediately
  → No duplicate INSERT, no duplicate email/SMS
```

---

## Load Testing

```bash
# Install k6
brew install k6

# Run load test
k6 run load-test/script.js
```

Adjust VUs in `load-test/script.js` based on your machine capacity.

---

## Project Structure

```
├── apps/
│   ├── api-gateway/        # REST API, idempotency, rate limiting
│   ├── email-worker/       # RabbitMQ consumer, SMTP delivery
│   └── sms-worker/         # RabbitMQ consumer, Twilio delivery
├── libs/
│   └── shared/             # Shared Entity, DTO, Enums, Metrics
├── docker/
│   ├── db/                 # PostgreSQL init.sql
│   ├── grafana/            # Dashboard provisioning
│   ├── prometheus/         # Scrape config
│   └── rabbitmq/           # RabbitMQ config
├── load-test/
│   └── script.js           # k6 load test script
└── docker-compose.yml
```