import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';
import { seedInitialContent } from './seedEducation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the directory for the database exists
const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Clean up any stale or foreign WAL / SHM shared memory files before connecting
const shmPath = `${config.databasePath}-shm`;
const walPath = `${config.databasePath}-wal`;
if (fs.existsSync(shmPath)) {
  try { fs.unlinkSync(shmPath); } catch (e) {}
}
if (fs.existsSync(walPath)) {
  try { fs.unlinkSync(walPath); } catch (e) {}
}

export const db = new Database(config.databasePath);

// Enable WAL mode with graceful fallback to DELETE mode
try {
  db.pragma('journal_mode = WAL');
} catch (e) {
  try { db.pragma('journal_mode = DELETE'); } catch (e2) {}
}
db.pragma('foreign_keys = ON');

function runMigrations() {
  const alterStatements = [
    "ALTER TABLE medication_reminders ADD COLUMN call_reminder_enabled INTEGER DEFAULT 1",
    "ALTER TABLE medication_reminders ADD COLUMN video_verification_enabled INTEGER DEFAULT 1",
    "ALTER TABLE medication_reminders ADD COLUMN call_status TEXT DEFAULT 'idle'",
    "ALTER TABLE medication_reminders ADD COLUMN intake_times TEXT DEFAULT '[]'",
    "ALTER TABLE medication_reminders ADD COLUMN duration_days INTEGER DEFAULT 7",
    "ALTER TABLE medication_reminders ADD COLUMN instructions TEXT DEFAULT ''",
    "ALTER TABLE medication_reminders ADD COLUMN prescription_id TEXT DEFAULT NULL",
    "ALTER TABLE medication_reminders ADD COLUMN profile_id TEXT DEFAULT NULL",
    "ALTER TABLE medication_logs ADD COLUMN verification_mode TEXT DEFAULT 'self'",
    "ALTER TABLE medication_logs ADD COLUMN video_session_id TEXT DEFAULT NULL",
    "ALTER TABLE medication_logs ADD COLUMN video_duration_seconds INTEGER DEFAULT 0",
    "ALTER TABLE medication_logs ADD COLUMN verified_at DATETIME DEFAULT NULL",
    "ALTER TABLE medication_logs ADD COLUMN guardian_alerted INTEGER DEFAULT 0",
    "ALTER TABLE medication_logs ADD COLUMN notes TEXT DEFAULT ''",
    "ALTER TABLE medication_logs ADD COLUMN careconnect_session_id TEXT DEFAULT NULL",
    "ALTER TABLE medication_logs ADD COLUMN profile_id TEXT DEFAULT NULL",
    "ALTER TABLE medical_reports ADD COLUMN verified_data TEXT DEFAULT '[]'",
    "ALTER TABLE medical_reports ADD COLUMN ocr_confidence REAL DEFAULT 0.95",
    "ALTER TABLE medical_reports ADD COLUMN file_path TEXT DEFAULT ''",
    "ALTER TABLE medical_reports ADD COLUMN profile_id TEXT DEFAULT NULL",
    "ALTER TABLE report_biomarkers ADD COLUMN profile_id TEXT DEFAULT NULL",
    "ALTER TABLE prescriptions ADD COLUMN profile_id TEXT DEFAULT NULL",
    "ALTER TABLE medical_timeline ADD COLUMN profile_id TEXT DEFAULT NULL",
    "ALTER TABLE health_metrics ADD COLUMN profile_id TEXT DEFAULT NULL",
    "ALTER TABLE health_profiles ADD COLUMN profile_id TEXT DEFAULT NULL",
    "ALTER TABLE conversations ADD COLUMN profile_id TEXT DEFAULT NULL",
    "ALTER TABLE guardian_alerts ADD COLUMN alert_type TEXT DEFAULT 'escalation'",
    "ALTER TABLE guardian_alerts ADD COLUMN attempt_number INTEGER DEFAULT 1",
    "ALTER TABLE guardian_alerts ADD COLUMN recipient_phone TEXT DEFAULT ''",
    "ALTER TABLE guardian_alerts ADD COLUMN recipient_name TEXT DEFAULT ''",
    "ALTER TABLE guardian_alerts ADD COLUMN acknowledged INTEGER DEFAULT 0",
    "ALTER TABLE guardian_alerts ADD COLUMN acknowledged_at DATETIME DEFAULT NULL",
    "ALTER TABLE guardian_alerts ADD COLUMN schedule_id TEXT DEFAULT NULL",
    "ALTER TABLE guardian_alerts ADD COLUMN call_status TEXT DEFAULT 'completed'",
    "ALTER TABLE guardian_alerts ADD COLUMN escalation_status TEXT DEFAULT 'escalated'",
    "ALTER TABLE guardian_alerts ADD COLUMN call_session_id TEXT DEFAULT NULL"
  ];
  for (const stmt of alterStatements) {
    try {
      db.prepare(stmt).run();
    } catch (e) {
      // Column already exists or already migrated
    }
  }

  // Create Round 2 tables if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS consumption_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      medicine_id TEXT NOT NULL,
      schedule_id TEXT,
      session_id TEXT,
      started_at DATETIME,
      detected_at DATETIME,
      completed_at DATETIME,
      status TEXT NOT NULL,
      verification_source TEXT NOT NULL,
      confidence_score REAL DEFAULT 0.0,
      device_info TEXT DEFAULT '',
      telemetry_data TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES medication_reminders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      reminder_id TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      call_type TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      recipient_name TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      recipient_role TEXT NOT NULL,
      status TEXT NOT NULL,
      call_duration_seconds INTEGER DEFAULT 0,
      provider_session_id TEXT,
      provider_response TEXT,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reminder_id) REFERENCES medication_reminders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS family_members (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      member_user_id TEXT,
      name TEXT NOT NULL,
      relation TEXT NOT NULL,
      profile_type TEXT NOT NULL,
      gender TEXT DEFAULT 'other',
      date_of_birth TEXT,
      blood_group TEXT DEFAULT '',
      allergies TEXT DEFAULT '',
      existing_conditions TEXT DEFAULT '',
      emergency_contact TEXT DEFAULT '',
      emergency_phone TEXT DEFAULT '',
      consent_status TEXT DEFAULT 'consented',
      consent_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      avatar TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agentic_tool_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      parameters TEXT NOT NULL,
      result_summary TEXT NOT NULL,
      requires_confirmation INTEGER DEFAULT 0,
      confirmed_at DATETIME,
      status TEXT DEFAULT 'executed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS staged_actions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      confirmation_prompt TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS abha_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      abha_number TEXT NOT NULL,
      abha_address TEXT NOT NULL,
      phr_address TEXT DEFAULT '',
      status TEXT DEFAULT 'linked',
      verification_method TEXT DEFAULT 'mock_otp',
      is_mock INTEGER DEFAULT 1,
      kyc_status TEXT DEFAULT 'verified',
      linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS abdm_consents (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      consent_id TEXT NOT NULL,
      hip_name TEXT NOT NULL,
      purpose TEXT NOT NULL,
      status TEXT DEFAULT 'GRANTED',
      from_date TEXT,
      to_date TEXT,
      expiry_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Seed default system configurations
  const defaultSettings = [
    { key: 'site_name', value: 'VitaCare AI' },
    { key: 'site_tagline', value: 'Your Health. Organized. Intelligent. Connected.' },
    { key: 'max_patient_warning_attempts', value: '2' },
    { key: 'warning_timeout_minutes', value: '15' },
    { key: 'careconnect_enabled', value: 'true' },
    { key: 'guardian_sms_gateway', value: 'active' },
    { key: 'default_language', value: 'en' },
    { key: 'emergency_number', value: '108' },
    { key: 'support_phone', value: '+1 (800) 848-2227' }
  ];

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO system_settings (id, key, value) VALUES (?, ?, ?)
  `);

  for (const s of defaultSettings) {
    insertSetting.run(`cfg-${s.key}`, s.key, s.value);
  }

  // Seed Test Users & Family Profiles (Requirements 3, 5, 6)
  seedTestUsers(db);
}

export function seedTestUsers(db) {
  try {
    const passwordHash = bcrypt.hashSync('TestPatient@123!', 10);
    
    const testUsers = [
        {
          id: 'test-patient-a-001',
          name: 'Alex Rivera',
          email: 'patient_a@vitacare.test',
          phone: '+1 555-010-0001',
          guardianName: 'Maria Rivera',
          guardianPhone: '+1 555-010-0002',
          guardianEmail: 'guardian_a@vitacare.test'
        },
        {
          id: 'test-patient-b-002',
          name: 'Patient B',
          email: 'patient_b@vitacare.test',
          phone: '+1 555-020-0001',
          guardianName: 'Guardian B',
          guardianPhone: '+1 555-020-0002',
          guardianEmail: 'guardian_b@vitacare.test'
        }
      ];

      for (const u of testUsers) {
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
        if (!existing) {
          db.prepare(`
            INSERT INTO users (id, full_name, email, phone, guardian_phone, guardian_email, password_hash, is_verified, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active')
          `).run(u.id, u.name, u.email, u.phone, u.guardianPhone, u.guardianEmail, passwordHash);

          db.prepare(`
            INSERT INTO user_profiles (id, user_id, preferred_language)
            VALUES (?, ?, 'en')
          `).run(`prof-${u.id}`, u.id);

          db.prepare(`
            INSERT INTO guardians (id, user_id, name, relation, phone, email, escalation_enabled)
            VALUES (?, ?, ?, 'Caregiver', ?, ?, 1)
          `).run(`guard-${u.id}`, u.id, u.guardianName, u.guardianPhone, u.guardianEmail);
        }
      }

      // Seed Family Profiles for test-patient-a-001
      const pAId = 'test-patient-a-001';
      const famProfiles = [
        {
          id: 'fam-a-self',
          userId: pAId,
          name: 'Alex Rivera',
          relation: 'self',
          profileType: 'self',
          gender: 'male',
          dob: '1990-05-14',
          bloodGroup: 'O+',
          allergies: 'Penicillin, Shellfish (Mild hives)',
          conditions: 'Prediabetes (Diet managed), Mild Hyperlipidemia',
          emergencyContact: 'Maria Rivera',
          emergencyPhone: '+1 555-010-0002'
        },
        {
          id: 'fam-a-child',
          userId: pAId,
          name: 'Aarav Rivera',
          relation: 'child',
          profileType: 'child',
          gender: 'male',
          dob: '2018-09-20',
          bloodGroup: 'O+',
          allergies: 'Peanuts, Tree Pollen',
          conditions: 'Mild Pediatric Asthma',
          emergencyContact: 'Alex Rivera (Father)',
          emergencyPhone: '+1 555-010-0001'
        },
        {
          id: 'fam-a-dependent',
          userId: pAId,
          name: 'Kamala Rivera',
          relation: 'parent',
          profileType: 'dependent',
          gender: 'female',
          dob: '1958-03-12',
          bloodGroup: 'B+',
          allergies: 'Sulfa antibiotics',
          conditions: 'Essential Hypertension, Osteoarthritis',
          emergencyContact: 'Alex Rivera (Son)',
          emergencyPhone: '+1 555-010-0001'
        }
      ];

      for (const fp of famProfiles) {
        const existFam = db.prepare('SELECT id FROM family_members WHERE id = ?').get(fp.id);
        if (!existFam) {
          db.prepare(`
            INSERT INTO family_members (
              id, user_id, name, relation, profile_type, gender, date_of_birth, blood_group,
              allergies, existing_conditions, emergency_contact, emergency_phone, consent_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'consented')
          `).run(fp.id, fp.userId, fp.name, fp.relation, fp.profileType, fp.gender, fp.dob, fp.bloodGroup, fp.allergies, fp.conditions, fp.emergencyContact, fp.emergencyPhone);

          // Seed health profile for this family member
          db.prepare(`
            INSERT OR IGNORE INTO health_profiles (id, user_id, profile_id, blood_group, allergies, existing_conditions)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(`hp-${fp.id}`, fp.userId, fp.id, fp.bloodGroup, fp.allergies, fp.conditions);
        }
      }

      // Seed family member for test-patient-b-002
      const pBId = 'test-patient-b-002';
      const existFamB = db.prepare('SELECT id FROM family_members WHERE id = ?').get('fam-b-self');
      if (!existFamB) {
        db.prepare(`
          INSERT INTO family_members (id, user_id, name, relation, profile_type, gender, consent_status)
          VALUES ('fam-b-self', ?, 'Patient B', 'self', 'self', 'female', 'consented')
        `).run(pBId);
      }

      // Seed two reports for Alex Rivera (fam-a-self) to demonstrate report comparison
      const existRep1 = db.prepare('SELECT id FROM medical_reports WHERE id = ?').get('rep-a-baseline-001');
      if (!existRep1) {
        db.prepare(`
          INSERT INTO medical_reports (
            id, user_id, profile_id, title, report_type, report_date, doctor_name, facility_name,
            file_name, file_type, raw_text, extracted_data, ai_summary, version, verified_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'rep-a-baseline-001',
          pAId,
          'fam-a-self',
          'Baseline Comprehensive Health Panel',
          'blood_panel',
          '2026-08-10',
          'Dr. Sarah Lin, MD',
          'BioCore Diagnostics',
          'baseline_health_panel_aug.pdf',
          'application/pdf',
          'Comprehensive Metabolic & Lipid Panel. Fasting Glucose 128 mg/dL (Elevated), Total Cholesterol 215 mg/dL (Elevated), HbA1c 6.1% (Elevated), Hemoglobin 14.2 g/dL (Normal).',
          JSON.stringify([
            { name: 'Fasting Glucose', value: 128, unit: 'mg/dL', referenceRange: '70 - 99 mg/dL', status: 'elevated' },
            { name: 'Total Cholesterol', value: 215, unit: 'mg/dL', referenceRange: '< 200 mg/dL', status: 'elevated' },
            { name: 'HbA1c', value: 6.1, unit: '%', referenceRange: '< 5.7 %', status: 'elevated' },
            { name: 'Hemoglobin', value: 14.2, unit: 'g/dL', referenceRange: '13.8 - 17.2 g/dL', status: 'normal' }
          ]),
          'Baseline panel indicates elevated fasting blood glucose (128 mg/dL) and total cholesterol (215 mg/dL). HbA1c is at prediabetic threshold of 6.1%. Lifestyle and dietary modification initiated.',
          1,
          JSON.stringify([
            { name: 'Fasting Glucose', value: 128, unit: 'mg/dL', referenceRange: '70 - 99 mg/dL', status: 'elevated' },
            { name: 'Total Cholesterol', value: 215, unit: 'mg/dL', referenceRange: '< 200 mg/dL', status: 'elevated' },
            { name: 'HbA1c', value: 6.1, unit: '%', referenceRange: '< 5.7 %', status: 'elevated' },
            { name: 'Hemoglobin', value: 14.2, unit: 'g/dL', referenceRange: '13.8 - 17.2 g/dL', status: 'normal' }
          ])
        );

        // Biomarkers for report 1
        const bms1 = [
          ['bm-1', 'Fasting Glucose', 128, 'mg/dL', '70 - 99 mg/dL', 'elevated', '2026-08-10'],
          ['bm-2', 'Total Cholesterol', 215, 'mg/dL', '< 200 mg/dL', 'elevated', '2026-08-10'],
          ['bm-3', 'HbA1c', 6.1, '%', '< 5.7 %', 'elevated', '2026-08-10'],
          ['bm-4', 'Hemoglobin', 14.2, 'g/dL', '13.8 - 17.2 g/dL', 'normal', '2026-08-10']
        ];
        for (const [id, name, val, unit, ref, status, date] of bms1) {
          db.prepare(`
            INSERT OR IGNORE INTO report_biomarkers (id, user_id, profile_id, report_id, biomarker_name, value, unit, reference_range, status, recorded_date)
            VALUES (?, ?, 'fam-a-self', 'rep-a-baseline-001', ?, ?, ?, ?, ?, ?)
          `).run(id, pAId, name, val, unit, ref, status, date);
        }

        // Timeline event 1
        db.prepare(`
          INSERT OR IGNORE INTO medical_timeline (id, user_id, profile_id, event_type, title, description, event_date, event_time, reference_id, icon_type, status_badge)
          VALUES ('tl-rep-1', ?, 'fam-a-self', 'report_uploaded', 'Medical Report Uploaded: Baseline Comprehensive Health Panel', 'Fasting Glucose 128 mg/dL, Total Cholesterol 215 mg/dL, HbA1c 6.1%. Baseline evaluation.', '2026-08-10', '09:30', 'rep-a-baseline-001', 'file', 'verified')
        `).run(pAId);
      }

      const existRep2 = db.prepare('SELECT id FROM medical_reports WHERE id = ?').get('rep-a-followup-002');
      if (!existRep2) {
        db.prepare(`
          INSERT INTO medical_reports (
            id, user_id, profile_id, title, report_type, report_date, doctor_name, facility_name,
            file_name, file_type, raw_text, extracted_data, ai_summary, version, verified_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'rep-a-followup-002',
          pAId,
          'fam-a-self',
          'Follow-up Metabolic & Lipid Panel',
          'blood_panel',
          '2026-10-18',
          'Dr. Sarah Lin, MD',
          'BioCore Diagnostics',
          'followup_health_panel_oct.pdf',
          'application/pdf',
          'Follow-up Metabolic & Lipid Panel. Fasting Glucose 102 mg/dL (Normal), Total Cholesterol 182 mg/dL (Normal), HbA1c 5.7% (Normal), Hemoglobin 14.5 g/dL (Normal).',
          JSON.stringify([
            { name: 'Fasting Glucose', value: 102, unit: 'mg/dL', referenceRange: '70 - 99 mg/dL', status: 'normal' },
            { name: 'Total Cholesterol', value: 182, unit: 'mg/dL', referenceRange: '< 200 mg/dL', status: 'normal' },
            { name: 'HbA1c', value: 5.7, unit: '%', referenceRange: '< 5.7 %', status: 'normal' },
            { name: 'Hemoglobin', value: 14.5, unit: 'g/dL', referenceRange: '13.8 - 17.2 g/dL', status: 'normal' }
          ]),
          'Follow-up panel demonstrates marked clinical improvement. Fasting Glucose decreased from 128 to 102 mg/dL (-26 mg/dL), Total Cholesterol dropped from 215 to 182 mg/dL (-33 mg/dL), and HbA1c improved to 5.7%. All key parameters approaching optimal target.',
          2,
          JSON.stringify([
            { name: 'Fasting Glucose', value: 102, unit: 'mg/dL', referenceRange: '70 - 99 mg/dL', status: 'normal' },
            { name: 'Total Cholesterol', value: 182, unit: 'mg/dL', referenceRange: '< 200 mg/dL', status: 'normal' },
            { name: 'HbA1c', value: 5.7, unit: '%', referenceRange: '< 5.7 %', status: 'normal' },
            { name: 'Hemoglobin', value: 14.5, unit: 'g/dL', referenceRange: '13.8 - 17.2 g/dL', status: 'normal' }
          ])
        );

        // Biomarkers for report 2
        const bms2 = [
          ['bm-5', 'Fasting Glucose', 102, 'mg/dL', '70 - 99 mg/dL', 'normal', '2026-10-18'],
          ['bm-6', 'Total Cholesterol', 182, 'mg/dL', '< 200 mg/dL', 'normal', '2026-10-18'],
          ['bm-7', 'HbA1c', 5.7, '%', '< 5.7 %', 'normal', '2026-10-18'],
          ['bm-8', 'Hemoglobin', 14.5, 'g/dL', '13.8 - 17.2 g/dL', 'normal', '2026-10-18']
        ];
        for (const [id, name, val, unit, ref, status, date] of bms2) {
          db.prepare(`
            INSERT OR IGNORE INTO report_biomarkers (id, user_id, profile_id, report_id, biomarker_name, value, unit, reference_range, status, recorded_date)
            VALUES (?, ?, 'fam-a-self', 'rep-a-followup-002', ?, ?, ?, ?, ?, ?)
          `).run(id, pAId, name, val, unit, ref, status, date);
        }

        // Timeline event 2
        db.prepare(`
          INSERT OR IGNORE INTO medical_timeline (id, user_id, profile_id, event_type, title, description, event_date, event_time, reference_id, icon_type, status_badge)
          VALUES ('tl-rep-2', ?, 'fam-a-self', 'report_uploaded', 'Medical Report Uploaded: Follow-up Metabolic & Lipid Panel', 'Significant improvement in Fasting Glucose (102 mg/dL) and Total Cholesterol (182 mg/dL). HbA1c normalized to 5.7%.', '2026-10-18', '11:15', 'rep-a-followup-002', 'file', 'verified')
        `).run(pAId);
      }

      // Seed Child Report for Aarav Rivera (fam-a-child)
      const existChildRep = db.prepare('SELECT id FROM medical_reports WHERE id = ?').get('rep-child-001');
      if (!existChildRep) {
        db.prepare(`
          INSERT INTO medical_reports (
            id, user_id, profile_id, title, report_type, report_date, doctor_name, facility_name,
            file_name, file_type, raw_text, extracted_data, ai_summary, version, verified_data
          ) VALUES ('rep-child-001', ?, 'fam-a-child', 'Pediatric Wellness & Pulmonary Function Test', 'lab_test', '2026-09-05', 'Dr. Anita Desai, MD (Pediatrics)', 'Childrens Health Center', 'pediatric_wellness_sep.pdf', 'application/pdf', 'Pediatric Pulmonary Assessment. SpO2 98% (Normal), Peak Expiratory Flow 220 L/min (Normal), Height 128 cm, Weight 26.5 kg.', ?, 'Pediatric respiratory evaluation shows well-controlled asthma with normal oxygen saturation (98%) and expected lung peak flow.', 1, ?)
        `).run(
          pAId,
          JSON.stringify([
            { name: 'Oxygen Saturation (SpO2)', value: 98, unit: '%', referenceRange: '95 - 100 %', status: 'normal' },
            { name: 'Peak Expiratory Flow', value: 220, unit: 'L/min', referenceRange: '180 - 250 L/min', status: 'normal' },
            { name: 'Height', value: 128, unit: 'cm', referenceRange: '120 - 135 cm', status: 'normal' },
            { name: 'Weight', value: 26.5, unit: 'kg', referenceRange: '22 - 30 kg', status: 'normal' }
          ]),
          JSON.stringify([
            { name: 'Oxygen Saturation (SpO2)', value: 98, unit: '%', referenceRange: '95 - 100 %', status: 'normal' },
            { name: 'Peak Expiratory Flow', value: 220, unit: 'L/min', referenceRange: '180 - 250 L/min', status: 'normal' },
            { name: 'Height', value: 128, unit: 'cm', referenceRange: '120 - 135 cm', status: 'normal' },
            { name: 'Weight', value: 26.5, unit: 'kg', referenceRange: '22 - 30 kg', status: 'normal' }
          ])
        );

        db.prepare(`
          INSERT OR IGNORE INTO medication_reminders (id, user_id, profile_id, medicine_name, dosage, frequency, reminder_time, start_date, notes, status)
          VALUES ('rem-child-1', ?, 'fam-a-child', 'Montelukast', '4mg Chewable', 'once_daily', '19:30', '2026-09-01', 'Take evening dose with water before bed for asthma prophylaxis.', 'active')
        `).run(pAId);

        db.prepare(`
          INSERT OR IGNORE INTO medical_timeline (id, user_id, profile_id, event_type, title, description, event_date, event_time, reference_id, icon_type, status_badge)
          VALUES ('tl-child-1', ?, 'fam-a-child', 'prescription_added', 'Child Medication Scheduled: Montelukast 4mg', 'Daily evening pediatric asthma prevention therapy.', '2026-09-01', '19:30', 'rem-child-1', 'pill', 'completed')
        `).run(pAId);
      }

      // Seed Dependent Report for Kamala Rivera (fam-a-dependent)
      const existDepRep = db.prepare('SELECT id FROM medical_reports WHERE id = ?').get('rep-dep-001');
      if (!existDepRep) {
        db.prepare(`
          INSERT INTO medical_reports (
            id, user_id, profile_id, title, report_type, report_date, doctor_name, facility_name,
            file_name, file_type, raw_text, extracted_data, ai_summary, version, verified_data
          ) VALUES ('rep-dep-001', ?, 'fam-a-dependent', 'Geriatric Cardiovascular & Renal Evaluation', 'cardiology', '2026-07-22', 'Dr. Rajesh Gupta, MD', 'Apex Heart Institute', 'cardio_renal_jul.pdf', 'application/pdf', 'Geriatric Cardiovascular Screen. Systolic BP 138 mmHg, Diastolic BP 86 mmHg, Serum Creatinine 0.9 mg/dL, eGFR 78 mL/min.', ?, 'Evaluation reveals Stage 1 systolic hypertension under acceptable control. Renal function is preserved.', 1, ?)
        `).run(
          pAId,
          JSON.stringify([
            { name: 'Systolic Blood Pressure', value: 138, unit: 'mmHg', referenceRange: '< 130 mmHg', status: 'elevated' },
            { name: 'Diastolic Blood Pressure', value: 86, unit: 'mmHg', referenceRange: '< 80 mmHg', status: 'elevated' },
            { name: 'Serum Creatinine', value: 0.9, unit: 'mg/dL', referenceRange: '0.6 - 1.1 mg/dL', status: 'normal' },
            { name: 'eGFR', value: 78, unit: 'mL/min', referenceRange: '> 60 mL/min', status: 'normal' }
          ]),
          JSON.stringify([
            { name: 'Systolic Blood Pressure', value: 138, unit: 'mmHg', referenceRange: '< 130 mmHg', status: 'elevated' },
            { name: 'Diastolic Blood Pressure', value: 86, unit: 'mmHg', referenceRange: '< 80 mmHg', status: 'elevated' },
            { name: 'Serum Creatinine', value: 0.9, unit: 'mg/dL', referenceRange: '0.6 - 1.1 mg/dL', status: 'normal' },
            { name: 'eGFR', value: 78, unit: 'mL/min', referenceRange: '> 60 mL/min', status: 'normal' }
          ])
        );

        db.prepare(`
          INSERT OR IGNORE INTO medication_reminders (id, user_id, profile_id, medicine_name, dosage, frequency, reminder_time, start_date, notes, status)
          VALUES ('rem-dep-1', ?, 'fam-a-dependent', 'Amlodipine', '5mg', 'once_daily', '09:00', '2026-07-25', 'Take morning dose with breakfast for blood pressure control.', 'active')
        `).run(pAId);

        db.prepare(`
          INSERT OR IGNORE INTO medical_timeline (id, user_id, profile_id, event_type, title, description, event_date, event_time, reference_id, icon_type, status_badge)
          VALUES ('tl-dep-1', ?, 'fam-a-dependent', 'prescription_added', 'Medication Scheduled: Amlodipine 5mg', 'Morning dose for systolic hypertension.', '2026-07-25', '09:00', 'rem-dep-1', 'pill', 'completed')
        `).run(pAId);
      }

      // Seed Mock ABHA Profile for Alex Rivera
      db.prepare(`
        INSERT OR IGNORE INTO abha_profiles (id, user_id, profile_id, abha_number, abha_address, phr_address, status, verification_method, is_mock, kyc_status)
        VALUES ('abha-a-001', ?, 'fam-a-self', '91-5821-4902-1844', 'alex.rivera@sbx', 'alex.rivera@abdm.test', 'linked', 'mock_otp', 1, 'verified')
      `).run(pAId);

      // Seed Mock ABDM Consent Artifact
      db.prepare(`
        INSERT OR IGNORE INTO abdm_consents (id, user_id, profile_id, consent_id, hip_name, purpose, status, from_date, to_date, expiry_date)
        VALUES ('consent-001', ?, 'fam-a-self', 'CONSENT-ABDM-882190', 'BioCore Diagnostics & Labs', 'Care Management', 'GRANTED', '2026-08-01', '2027-08-01', '2027-08-01')
      `).run(pAId);
  } catch (err) {
    console.warn('Seed test users error:', err);
  }
}


export function initDatabase() {
  console.log(`[Database] Initializing SQLite database at: ${config.databasePath}`);
  
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Execute schema tables and indexes
  db.exec(schemaSql);

  // Apply migrations
  runMigrations();

  // Seed default educational materials & admin credentials (ZERO patient records!)
  seedInitialContent(db);

  console.log('[Database] Database tables initialized successfully.');
}

