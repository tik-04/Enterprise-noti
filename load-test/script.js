import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // ramp up → 50 VUs
    { duration: '1m',  target: 50 },  // ramp up → 200 VUs
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],  // p95 ต้องต่ำกว่า 200ms
    http_req_failed:   ['rate<0.01'],  // error rate ต้องต่ำกว่า 1%
  },
};

export default function () {
  const payload = JSON.stringify({
    channel: 'email',
    to: 'test@example.com',
    subject: 'Load Test',
    body: '<p>Load test message</p>',
    idempotencyKey: uuidv4(), // generate UUID ใหม่ทุก request
  });

  const res = http.post('http://localhost:3000/notifications', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 202': (r) => r.status === 202,
    'has notificationId': (r) => JSON.parse(r.body).notificationId !== undefined,
  });

  if (res.status !== 202) {
    console.log(`Failed: ${res.status} — ${res.body}`);
  }

  sleep(0.1);
}