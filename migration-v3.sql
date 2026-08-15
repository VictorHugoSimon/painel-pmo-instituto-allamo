-- Migração v3 — empresas, GMUD dupla aprovação e notificações
-- Rodar no D1 Console (D1 → allamo-pmo → Console). Colunas novas podem já existir; ignore erros de "duplicate column".

ALTER TABLE gmud ADD COLUMN pmo_ok INTEGER DEFAULT 0;
ALTER TABLE gmud ADD COLUMN techlead_ok INTEGER DEFAULT 0;
ALTER TABLE gmud ADD COLUMN techlead TEXT;
ALTER TABLE gmud ADD COLUMN project TEXT;
ALTER TABLE gmud ADD COLUMN description TEXT;

CREATE TABLE IF NOT EXISTS notifications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id   TEXT,
  project      TEXT,
  type         TEXT,
  title        TEXT,
  message      TEXT,
  created_at   TEXT,
  read_flag    INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notif_company ON notifications(company_id, id DESC);
