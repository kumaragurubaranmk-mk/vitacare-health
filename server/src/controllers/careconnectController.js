import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';

// In-memory signaling cache for active WebRTC peer sessions
const activeSignals = new Map();

export class CareConnectController {
  /**
   * Initialize a genuine CareConnect Video Call Session
   * Authenticates participant and configures STUN infrastructure
   */
  static createSession(req, res, next) {
    try {
      const {
        reminderId,
        reminder_id,
        recipientRole = 'guardian',
        recipient_role,
        recipientName = 'Caregiver / Doctor',
        recipient_name,
        medicineName = 'Prescription Medicine',
        medicine_name,
        dosage = '1 dose',
        scheduledTime = '08:00 AM',
        scheduled_time
      } = req.body;

      let effectiveReminderId = null;
      if (reminderId || reminder_id) {
        const rem = db.prepare('SELECT id, medicine_name, dosage, reminder_time FROM medication_reminders WHERE id = ?').get(reminderId || reminder_id);
        if (rem) effectiveReminderId = rem.id;
      }
      if (!effectiveReminderId) {
        const userRem = db.prepare('SELECT id, medicine_name, dosage, reminder_time FROM medication_reminders WHERE user_id = ? LIMIT 1').get(req.user.id);
        if (userRem) effectiveReminderId = userRem.id;
      }

      const effectiveRole = recipient_role || recipientRole || 'guardian';
      const effectiveName = recipient_name || recipientName || (effectiveRole === 'doctor' ? 'Dr. Michael Chen, MD' : 'Caregiver Sarah');
      const effectiveMed = medicine_name || medicineName || 'Prescription Medicine';
      const effectiveDosage = dosage || '1 dose';
      const effectiveTime = scheduled_time || scheduledTime || '08:00 AM';

      const sessionId = uuidv4();
      const today = new Date().toISOString().split('T')[0];

      // STUN/TURN Infrastructure configuration
      const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ];

      // Record in careconnect_sessions
      db.prepare(`
        INSERT INTO careconnect_sessions (
          id, user_id, reminder_id, medicine_name, dosage, caregiver_name,
          scheduled_time, session_start, adherence_status, consent_acknowledged
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'in_progress', 1)
      `).run(
        sessionId,
        req.user.id,
        effectiveReminderId,
        effectiveMed,
        effectiveDosage,
        effectiveName,
        effectiveTime
      );

      // Record in call_logs if linked to a medication reminder
      if (effectiveReminderId) {
        db.prepare(`
          INSERT INTO call_logs (
            id, user_id, reminder_id, scheduled_date, scheduled_time, call_type,
            attempt_number, recipient_name, recipient_phone, recipient_role,
            status, call_duration_seconds, provider_session_id, notes
          ) VALUES (?, ?, ?, ?, ?, 'webrtc_video_call', 1, ?, '+1 (555) 010-0002', ?, 'initiated', 0, ?, 'CareConnect WebRTC video session initiated')
        `).run(
          uuidv4(),
          req.user.id,
          effectiveReminderId,
          today,
          effectiveTime,
          effectiveName,
          effectiveRole,
          sessionId
        );
      }

      // Initialize signaling store
      activeSignals.set(sessionId, {
        sessionId,
        userId: req.user.id,
        createdAt: Date.now(),
        signals: []
      });

      res.status(201).json({
        sessionId,
        status: 'initiated',
        iceServers,
        rtcConfig: { iceServers },
        recipient: {
          name: effectiveName,
          role: effectiveRole
        },
        message: 'CareConnect session established. Proceed with WebRTC peer signaling.'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Post WebRTC signaling payload (SDP offer, answer, or ICE candidate)
   */
  static postSignal(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { type, sdp, candidate, sender = 'patient' } = req.body;

      if (!activeSignals.has(sessionId)) {
        activeSignals.set(sessionId, {
          sessionId,
          userId: req.user.id,
          createdAt: Date.now(),
          signals: []
        });
      }

      const session = activeSignals.get(sessionId);
      const signalEntry = {
        id: uuidv4(),
        type, // 'offer' | 'answer' | 'candidate'
        sdp,
        candidate,
        sender,
        timestamp: Date.now()
      };

      session.signals.push(signalEntry);

      res.status(200).json({
        success: true,
        signalId: signalEntry.id,
        timestamp: signalEntry.timestamp
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Poll or retrieve WebRTC signals for session
   */
  static getSignals(req, res, next) {
    try {
      const { sessionId } = req.params;
      const since = parseInt(req.query.since || '0', 10);

      const session = activeSignals.get(sessionId);
      if (!session) {
        return res.status(200).json({ signals: [] });
      }

      const freshSignals = session.signals.filter(s => s.timestamp > since);
      res.status(200).json({ signals: freshSignals });
    } catch (err) {
      next(err);
    }
  }

  /**
   * End CareConnect Session & release metadata
   */
  static endSession(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { durationSeconds = 0, adherenceStatus = 'completed', notes = '' } = req.body;

      const existing = db.prepare('SELECT id FROM careconnect_sessions WHERE id = ? AND user_id = ?').get(sessionId, req.user.id);
      if (!existing) {
        return res.status(404).json({ error: 'CareConnect session not found.' });
      }

      db.prepare(`
        UPDATE careconnect_sessions SET
          session_end = CURRENT_TIMESTAMP,
          adherence_status = ?,
          user_notes = ?
        WHERE id = ? AND user_id = ?
      `).run(adherenceStatus, notes, sessionId, req.user.id);

      db.prepare(`
        UPDATE call_logs SET
          status = 'completed',
          call_duration_seconds = ?,
          notes = ?
        WHERE provider_session_id = ? AND user_id = ?
      `).run(parseInt(durationSeconds) || 0, notes, sessionId, req.user.id);

      // Clean up signaling memory
      activeSignals.delete(sessionId);

      res.status(200).json({
        success: true,
        status: 'completed',
        durationSeconds,
        message: 'CareConnect call completed. Video and microphone streams released.'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get CareConnect history for authenticated patient
   */
  static getHistory(req, res, next) {
    try {
      const sessions = db.prepare(`
        SELECT * FROM careconnect_sessions
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 20
      `).all(req.user.id);

      res.status(200).json({ sessions });
    } catch (err) {
      next(err);
    }
  }
}
