CREATE TABLE IF NOT EXISTS worker_house_shop_stock_locks (
  product_id VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  stock_limit BIGINT UNSIGNED NULL,
  updated_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

INSERT IGNORE INTO worker_house_schema_migrations (version, applied_at)
VALUES ('003_mysql_shop_stock_reservations', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ'));
