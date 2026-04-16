-- Database Schema for Health Report System
-- Create database
CREATE DATABASE IF NOT EXISTS health_report_db;
USE health_report_db;

-- Users table (opsional, untuk future authentication)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('citizen', 'admin', 'health_officer') DEFAULT 'citizen',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Health Reports table (MAIN TABLE)
CREATE TABLE IF NOT EXISTS health_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_type VARCHAR(100) NOT NULL,
  location VARCHAR(255) NOT NULL,
  description LONGTEXT NOT NULL,
  photo_url VARCHAR(500),
  reporter_name VARCHAR(100),
  reporter_phone VARCHAR(20),
  status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  admin_notes LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_status (status),
  INDEX idx_location (location),
  INDEX idx_report_type (report_type),
  INDEX idx_created_at (created_at)
);

-- Disease Statistics table
CREATE TABLE IF NOT EXISTS disease_statistics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  disease_type VARCHAR(100) NOT NULL,
  location VARCHAR(255) NOT NULL,
  count INT DEFAULT 0,
  week INT,
  year INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_location (location),
  INDEX idx_disease_type (disease_type)
);

-- Environmental Issues table
CREATE TABLE IF NOT EXISTS environmental_issues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  issue_type VARCHAR(100) NOT NULL,
  location VARCHAR(255) NOT NULL,
  severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  description LONGTEXT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_location (location),
  INDEX idx_severity (severity)
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  report_id INT,
  user_id INT,
  action_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  details LONGTEXT,
  
  FOREIGN KEY (report_id) REFERENCES health_reports(id),
  INDEX idx_action_time (action_time)
);

-- Insert sample data
INSERT INTO health_reports (report_type, location, description, reporter_name, reporter_phone, status)
VALUES 
('Air Tercemar', 'Jl. Sudirman No. 123, Bandung', 'Air di sumur warga berubah warna menjadi hitam dan berbau aneh', 'Budi', '081234567890', 'verified'),
('Sampah Liar', 'Jl. Gatot Subroto, Bandung', 'Tumpukan sampah di tepi jalan menjadi tempat lalat berkembang biak', 'Siti', '082345678901', 'pending'),
('Udara Tercemar', 'Area Industri Majalaya, Bandung', 'Asap pabrik mencemari udara, warga mengalami sesak napas', 'Ahmad', '083456789012', 'verified');
