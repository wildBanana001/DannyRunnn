CREATE TABLE IF NOT EXISTS worker_house_schema_migrations (
  version VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  applied_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS worker_house_orders (
  order_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kind VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  client_request_id VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  product_id VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  openid VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  transaction_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
  created_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  updated_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payload JSON NOT NULL,
  PRIMARY KEY (order_id),
  KEY idx_orders_openid_kind_created (openid, kind, created_at),
  KEY idx_orders_product_kind_status (product_id, kind, status),
  KEY idx_orders_kind_created (kind, created_at),
  KEY idx_orders_transaction (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS worker_house_activity_locks (
  activity_id VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  base_participants INT UNSIGNED NOT NULL DEFAULT 0,
  max_participants INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (activity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

INSERT IGNORE INTO worker_house_schema_migrations (version, applied_at)
VALUES ('001_mysql_order_storage', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ'));
