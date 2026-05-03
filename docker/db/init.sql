-- Enterprise Notification Gateway — DB Init Script

CREATE TABLE IF NOT EXISTS notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key  VARCHAR(255) UNIQUE NOT NULL,
  channel          VARCHAR(20)  NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient        VARCHAR(255) NOT NULL,
  subject          VARCHAR(500),
  body             TEXT         NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'SENT', 'RETRYING', 'DEAD')),
  attempts         INTEGER      NOT NULL DEFAULT 0,
  error_message    TEXT,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index สำหรับ query ตาม status (worker ใช้บ่อย)
CREATE INDEX IF NOT EXISTS idx_notifications_status
  ON notifications (status);

-- Index สำหรับ idempotency lookup (API Gateway ใช้ทุก request)
CREATE INDEX IF NOT EXISTS idx_notifications_idempotency_key
  ON notifications (idempotency_key);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();