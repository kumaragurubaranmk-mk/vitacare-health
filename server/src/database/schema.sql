-- HealthGPT Relational Database Schema
-- Designed for relational integrity, data isolation per user, and strict administrative privacy

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  guardian_email TEXT,
  phone TEXT,
  guardian_phone TEXT,
  date_of_birth TEXT,
  password_hash TEXT NOT NULL,
  is_verified INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', -- 'active' | 'suspended' | 'pending'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  avatar TEXT DEFAULT '',
  preferred_language TEXT DEFAULT 'en', -- 'en' | 'ta' | 'te' | 'hi'
  notification_preferences TEXT DEFAULT '{"email": true, "sms": true}',
  dark_mode INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS health_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  blood_group TEXT DEFAULT '',
  height REAL DEFAULT NULL,
  weight REAL DEFAULT NULL,
  allergies TEXT DEFAULT '',
  existing_conditions TEXT DEFAULT '',
  current_medications TEXT DEFAULT '',
  emergency_contact_name TEXT DEFAULT '',
  emergency_contact_phone TEXT DEFAULT '',
  emergency_contact_relation TEXT DEFAULT '',
  dietary_preferences TEXT DEFAULT '',
  lifestyle_notes TEXT DEFAULT '',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS health_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- 'notes' | 'lab' | 'prescription' | 'visit' | 'history'
  record_date TEXT NOT NULL,
  doctor_name TEXT DEFAULT '',
  facility_name TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  attachment_url TEXT DEFAULT '',
  attachment_name TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medication_reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  medicine_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL, -- 'once_daily' | 'twice_daily' | 'three_daily' | 'as_needed'
  reminder_time TEXT NOT NULL, -- '08:00', '20:00'
  start_date TEXT NOT NULL,
  end_date TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'active', -- 'active' | 'paused' | 'completed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medication_logs (
  id TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  status TEXT NOT NULL, -- 'taken' | 'skipped' | 'missed'
  taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reminder_id) REFERENCES medication_reminders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS health_metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  metric_type TEXT NOT NULL, -- 'weight' | 'blood_pressure' | 'heart_rate' | 'blood_glucose' | 'sleep' | 'water' | 'exercise' | 'mood'
  metric_value REAL NOT NULL,
  secondary_value REAL DEFAULT NULL, -- for systolic/diastolic or secondary metric
  unit TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  specialty TEXT DEFAULT '',
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  location TEXT DEFAULT '',
  is_virtual INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'scheduled', -- 'scheduled' | 'completed' | 'cancelled'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  language TEXT DEFAULT 'en', -- 'en' | 'ta' | 'te' | 'hi'
  module_type TEXT DEFAULT 'assistant', -- 'assistant' | 'symptom_checker'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  structured_data TEXT DEFAULT NULL, -- JSON string: summary, possibleCauses, nextSteps, whenToSeekHelp, disclaimer
  is_emergency INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS education_content (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL, -- 'common_topics' | 'symptoms' | 'conditions' | 'nutrition' | 'fitness' | 'sleep' | 'preventive' | 'first_aid' | 'medications' | 'wellness'
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  read_time INTEGER DEFAULT 5,
  author TEXT DEFAULT 'HealthGPT Medical Education Editorial',
  tags TEXT DEFAULT '',
  is_published INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medical_dictionary (
  id TEXT PRIMARY KEY,
  term TEXT UNIQUE NOT NULL,
  pronunciation TEXT DEFAULT '',
  simple_definition TEXT NOT NULL,
  clinical_context TEXT DEFAULT '',
  related_terms TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'superadmin', -- 'superadmin' | 'editor' | 'support'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT DEFAULT 'system',
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT DEFAULT '',
  details TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_email TEXT,
  category TEXT NOT NULL, -- 'suggestion' | 'bug' | 'content' | 'general'
  message TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pending', -- 'pending' | 'reviewed' | 'resolved'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- 'info' | 'medication' | 'appointment' | 'alert'
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS otp_verifications (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  purpose TEXT NOT NULL, -- 'register' | 'forgot_password'
  expires_at DATETIME NOT NULL,
  is_used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medical_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  report_type TEXT NOT NULL, -- 'lab_test' | 'prescription' | 'scan_imaging' | 'discharge_summary' | 'blood_panel' | 'cardiology' | 'other'
  report_date TEXT NOT NULL,
  doctor_name TEXT DEFAULT '',
  facility_name TEXT DEFAULT '',
  file_name TEXT DEFAULT '',
  file_type TEXT DEFAULT '',
  file_data TEXT DEFAULT '',
  raw_text TEXT DEFAULT '',
  extracted_data TEXT DEFAULT '{}',
  ai_summary TEXT DEFAULT '',
  version INTEGER DEFAULT 1,
  parent_report_id TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS report_biomarkers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  biomarker_name TEXT NOT NULL,
  biomarker_category TEXT DEFAULT 'general',
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  reference_range TEXT DEFAULT '',
  status TEXT DEFAULT 'normal', -- 'normal' | 'elevated' | 'critical' | 'low'
  recorded_date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (report_id) REFERENCES medical_reports(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS video_verification_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reminder_id TEXT NOT NULL,
  medicine_name TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  session_end DATETIME,
  adherence_status TEXT DEFAULT 'confirmed', -- 'confirmed' | 'missed' | 'skipped'
  user_notes TEXT DEFAULT '',
  disclaimer_acknowledged INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reminder_id) REFERENCES medication_reminders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guardians (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  relation TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  escalation_enabled INTEGER DEFAULT 1,
  escalation_timeout_mins INTEGER DEFAULT 15,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guardian_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  guardian_id TEXT,
  reminder_id TEXT,
  medicine_name TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  reason TEXT NOT NULL,
  channel TEXT DEFAULT 'demo_call',
  status TEXT DEFAULT 'sent',
  message TEXT NOT NULL,
  is_demo INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS emergency_sos_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  contact1_type TEXT DEFAULT 'ambulance',
  contact1_phone TEXT DEFAULT '108',
  contact2_name TEXT DEFAULT '',
  contact2_phone TEXT DEFAULT '',
  location_info TEXT DEFAULT '',
  medical_snapshot TEXT DEFAULT '',
  status TEXT DEFAULT 'demo_triggered',
  is_demo INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  doctor_name TEXT DEFAULT '',
  prescription_date TEXT NOT NULL,
  file_name TEXT DEFAULT '',
  file_type TEXT DEFAULT '',
  file_data TEXT DEFAULT '',
  raw_ocr_text TEXT DEFAULT '',
  extracted_medicines TEXT DEFAULT '[]', -- JSON array of extracted medicine objects
  verified_medicines TEXT DEFAULT '[]', -- JSON array of user confirmed medicine objects
  status TEXT DEFAULT 'verified',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medical_timeline (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'report_uploaded' | 'prescription_added' | 'medicine_scheduled' | 'medicine_taken' | 'medicine_completed' | 'vital_recorded'
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  event_date TEXT NOT NULL,
  event_time TEXT DEFAULT '',
  reference_id TEXT DEFAULT '',
  icon_type TEXT DEFAULT 'file',
  status_badge TEXT DEFAULT 'completed',
  metadata TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS careconnect_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reminder_id TEXT,
  medicine_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  caregiver_name TEXT DEFAULT 'Care Supporter',
  scheduled_time TEXT NOT NULL,
  session_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  session_end DATETIME,
  adherence_status TEXT DEFAULT 'taken', -- 'taken' | 'skipped' | 'missed'
  user_notes TEXT DEFAULT '',
  consent_acknowledged INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS consumption_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  medicine_id TEXT NOT NULL,
  schedule_id TEXT,
  session_id TEXT,
  started_at DATETIME,
  detected_at DATETIME,
  completed_at DATETIME,
  status TEXT NOT NULL, -- 'TRACKING' | 'CONSUMPTION_DETECTED' | 'VERIFIED' | 'FAILED' | 'PATIENT_REFUSED' | 'NO_RESPONSE'
  verification_source TEXT NOT NULL, -- 'camera_cv_pipeline' | 'careconnect_cv' | 'patient_refusal'
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
  call_type TEXT NOT NULL, -- 'patient_warning_1' | 'patient_warning_2' | 'guardian_escalation'
  attempt_number INTEGER NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_role TEXT NOT NULL, -- 'patient' | 'guardian'
  status TEXT NOT NULL, -- 'initiated' | 'answered' | 'declined' | 'no_answer' | 'failed' | 'timeout'
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
  relation TEXT NOT NULL, -- 'self' | 'child' | 'spouse' | 'parent' | 'dependent' | 'other'
  profile_type TEXT NOT NULL, -- 'self' | 'child' | 'dependent'
  gender TEXT DEFAULT 'other',
  date_of_birth TEXT,
  blood_group TEXT DEFAULT '',
  allergies TEXT DEFAULT '',
  existing_conditions TEXT DEFAULT '',
  emergency_contact TEXT DEFAULT '',
  emergency_phone TEXT DEFAULT '',
  consent_status TEXT DEFAULT 'consented', -- 'consented' | 'pending' | 'revoked'
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
  status TEXT DEFAULT 'executed', -- 'executed' | 'pending_confirmation' | 'confirmed' | 'rejected' | 'failed'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staged_actions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'create_reminder' | 'update_prescription' | 'alert_guardian'
  payload TEXT NOT NULL,
  confirmation_prompt TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending' | 'confirmed' | 'cancelled' | 'executed'
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
  status TEXT DEFAULT 'linked', -- 'linked' | 'unlinked' | 'pending_verification'
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
  status TEXT DEFAULT 'GRANTED', -- 'REQUESTED' | 'GRANTED' | 'REVOKED' | 'EXPIRED'
  from_date TEXT,
  to_date TEXT,
  expiry_date TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_records_user ON health_records(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_user ON health_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_medications_user ON medication_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_education_cat ON education_content(category);
CREATE INDEX IF NOT EXISTS idx_reports_user ON medical_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_biomarkers_user ON report_biomarkers(user_id);
CREATE INDEX IF NOT EXISTS idx_biomarkers_name ON report_biomarkers(biomarker_name);
CREATE INDEX IF NOT EXISTS idx_guardians_user ON guardians(user_id);
CREATE INDEX IF NOT EXISTS idx_guardian_alerts_user ON guardian_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_user ON video_verification_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sos_logs_user ON emergency_sos_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_user ON prescriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_timeline_user ON medical_timeline(user_id);
CREATE INDEX IF NOT EXISTS idx_careconnect_user ON careconnect_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_consumption_events_user ON consumption_events(user_id);
CREATE INDEX IF NOT EXISTS idx_consumption_events_med ON consumption_events(medicine_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_user ON call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_med ON call_logs(reminder_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_agentic_tool_logs_user ON agentic_tool_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_staged_actions_user ON staged_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_abha_profiles_user ON abha_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_abdm_consents_user ON abdm_consents(user_id);


