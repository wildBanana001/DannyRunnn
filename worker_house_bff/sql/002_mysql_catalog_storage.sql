CREATE TABLE IF NOT EXISTS worker_house_schema_migrations (
  version VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  applied_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS worker_house_activities (
  activity_id VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  start_date VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
  updated_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payload JSON NOT NULL,
  PRIMARY KEY (activity_id),
  KEY idx_activities_enabled_start (enabled, start_date),
  KEY idx_activities_sort (sort_order, activity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS worker_house_shop_products (
  product_id VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  category VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  stock INT UNSIGNED NULL,
  updated_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payload JSON NOT NULL,
  PRIMARY KEY (product_id),
  KEY idx_products_enabled_sort (enabled, sort_order, product_id),
  KEY idx_products_category_sort (category, sort_order, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS worker_house_catalog_state (
  catalog_name VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  seed_version INT UNSIGNED NOT NULL DEFAULT 0,
  seeded_at VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
  PRIMARY KEY (catalog_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

INSERT IGNORE INTO worker_house_schema_migrations (version, applied_at)
VALUES ('002_mysql_catalog_storage', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ'));
