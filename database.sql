CREATE DATABASE IF NOT EXISTS birthday_db;
USE birthday_db;

CREATE TABLE IF NOT EXISTS config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    photo_path VARCHAR(255) DEFAULT 'assets/default_photo.png',
    default_song_id VARCHAR(50) DEFAULT '1pSPZAGeO3w',
    admin_password VARCHAR(255) DEFAULT 'love2026'
);

CREATE TABLE IF NOT EXISTS photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initialize with defaults
INSERT INTO config (id, photo_path, default_song_id, admin_password) 
VALUES (1, 'assets/default_photo.png', '1pSPZAGeO3w', 'love2026')
ON DUPLICATE KEY UPDATE default_song_id='1pSPZAGeO3w';
