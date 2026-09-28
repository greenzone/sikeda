/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `activity_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `actor` varchar(60) NOT NULL,
  `aksi` varchar(120) NOT NULL,
  `detail` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=494 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `anggota` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kode_unik` varchar(30) NOT NULL,
  `nama` varchar(120) NOT NULL,
  `nik_enc` varchar(200) NOT NULL,
  `nik_hash` char(64) NOT NULL,
  `gender` enum('Laki-laki','Perempuan') NOT NULL,
  `tempat_lahir` varchar(80) DEFAULT NULL,
  `tanggal_lahir` date DEFAULT NULL,
  `pekerjaan` varchar(100) DEFAULT NULL,
  `kecamatan` varchar(80) NOT NULL,
  `desa` varchar(80) NOT NULL,
  `alamat` varchar(255) DEFAULT NULL,
  `whatsapp` varchar(20) NOT NULL,
  `telegram` varchar(60) DEFAULT NULL,
  `email` varchar(140) DEFAULT NULL,
  `status` enum('Pending','Revisi','Ditolak','Aktif') NOT NULL DEFAULT 'Pending',
  `jabatan` varchar(80) DEFAULT 'Anggota',
  `catatan` varchar(255) DEFAULT NULL,
  `foto_path` varchar(255) DEFAULT NULL,
  `ktp_path` varchar(255) DEFAULT NULL,
  `registered_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_at` datetime DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kode_unik` (`kode_unik`),
  KEY `idx_nikhash` (`nik_hash`),
  KEY `idx_status` (`status`),
  KEY `idx_wilayah` (`kecamatan`,`desa`),
  KEY `idx_wa` (`whatsapp`),
  KEY `idx_tg` (`telegram`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `data_drafts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `anggota_id` int NOT NULL,
  `payload` json NOT NULL,
  `status` enum('draft','pending','disetujui','ditolak') NOT NULL DEFAULT 'draft',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `submitted_at` datetime DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `catatan_review` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_draft_anggota` (`anggota_id`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `otp_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `target` varchar(140) NOT NULL,
  `channel` enum('wa','email','telegram') NOT NULL DEFAULT 'wa',
  `code_hash` varchar(100) NOT NULL,
  `expires_at` datetime NOT NULL,
  `attempts` tinyint DEFAULT '0',
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_target` (`target`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_resets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token_hash` varchar(100) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_token` (`token_hash`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pengumuman` (
  `id` int NOT NULL AUTO_INCREMENT,
  `target` enum('umum','personal') NOT NULL DEFAULT 'umum',
  `anggota_id` int DEFAULT NULL,
  `kategori` enum('pengumuman','pemberitahuan','pesan') NOT NULL DEFAULT 'pengumuman',
  `judul` varchar(160) NOT NULL,
  `isi` text NOT NULL,
  `prioritas` enum('normal','penting') NOT NULL DEFAULT 'normal',
  `channels` varchar(64) NOT NULL DEFAULT '',
  `aktif` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_peng_target` (`target`,`anggota_id`,`aktif`),
  KEY `idx_peng_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `kunci` varchar(60) NOT NULL,
  `nilai` TEXT NOT NULL,
  PRIMARY KEY (`kunci`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(60) DEFAULT NULL,
  `password_hash` varchar(100) DEFAULT NULL,
  `nama` varchar(120) NOT NULL,
  `level` enum('anggota','admin','superadmin') NOT NULL DEFAULT 'anggota',
  `email` varchar(140) DEFAULT NULL,
  `whatsapp` varchar(20) DEFAULT NULL,
  `telegram` varchar(60) DEFAULT NULL,
  `anggota_id` int DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wilayah` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kecamatan` varchar(80) NOT NULL,
  `desa` varchar(80) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wilayah` (`kecamatan`,`desa`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
