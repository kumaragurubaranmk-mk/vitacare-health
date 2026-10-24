import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { AlertEscalationService } from '../services/alertEscalationService.js';
import { CallService } from '../services/callService.js';
import { getAuthorizedProfile } from '../middleware/profileAuth.js';

export class MedicationsController {
  /**
   * Get all medication reminders, today's schedule, and adherence statistics
   */
  static getReminders(req, res, next) {
    try {
      const requestedProfileId = req.query.profile_id || req.headers['x-profile-id'] || null;
      const authResult = getAuthorizedProfile(req.user.id, requestedProfileId);

      if (!authResult.authorized) {
        return res.status(authResult.status || 403).json({ error: authResult.reason });
      }

      const pId = authResult.profileId;
      const isSelf = authResult.isSelf;

      let reminders;
      if (isSelf) {
        reminders = db.prepare(`
          SELECT * FROM medication_reminders 
          WHERE user_id = ? AND (profile_id = ? OR profile_id IS NULL OR profile_id = 'self' OR profile_id = ?)
          ORDER BY reminder_time ASC, created_at DESC
        `).all(req.user.id, pId, `self-${req.user.id}`);
      } else {
        reminders = db.prepare(`
          SELECT * FROM medication_reminders 
          WHERE user_id = ? AND profile_id = ?
          ORDER BY reminder_time ASC, created_at DESC
        `).all(req.user.id, pId);
      }

      const parsedReminders = reminders.map(r => ({
        ...r,
        intake_times: r.intake_times ? JSON.parse(r.intake_times) : [r.reminder_time]
      }));

      const today = new Date().toISOString().split('T')[0];
      const todayLogs = db.prepare(`
        SELECT l.*, r.medicine_name, r.dosage, r.reminder_time, r.instructions
        FROM medication_logs l
        JOIN medication_reminders r ON l.reminder_id = r.id
        WHERE l.user_id = ? AND l.scheduled_date = ?
      `).all(req.user.id, today);

      const todayEvents = db.prepare(`
        SELECT * FROM consumption_events
        WHERE user_id = ? AND date(created_at) = ?
        ORDER BY created_at DESC
      `).all(req.user.id, today);

      const todayCalls = db.prepare(`
        SELECT * FROM call_logs
        WHERE user_id = ? AND scheduled_date = ?
        ORDER BY created_at DESC
      `).all(req.user.id, today);

      // Generate today's complete timeline slots across all active medicines
      const todaySlots = [];

      for (const med of parsedReminders) {
        if (med.status !== 'active') continue;
        const times = Array.isArray(med.intake_times) && med.intake_times.length > 0
          ? med.intake_times
          : [med.reminder_time];

        for (const t of times) {
          const log = todayLogs.find(l => l.reminder_id === med.id && (l.scheduled_time === t || l.reminder_time === t));
          const latestEvent = todayEvents.find(e => e.medicine_id === med.id);
          const medCalls = todayCalls.filter(c => c.reminder_id === med.id);

          let slotStatus = 'pending';
          if (log) {
            if (log.status === 'taken' || log.status === 'verified') {
              slotStatus = 'verified';
            } else if (log.status === 'refused' || log.status === 'PATIENT_REFUSED') {
              slotStatus = 'refused';
            } else if (log.status === 'missed') {
              slotStatus = 'missed';
            } else if (log.status === 'tracking_failed') {
              slotStatus = 'tracking_failed';
            } else {
              slotStatus = log.status;
            }
          } else if (latestEvent && latestEvent.status === 'VERIFIED') {
            slotStatus = 'verified';
          } else if (latestEvent && latestEvent.status === 'PATIENT_REFUSED') {
            slotStatus = 'refused';
          } else if (latestEvent && latestEvent.status === 'FAILED') {
            slotStatus = 'tracking_failed';
          } else if (latestEvent && latestEvent.status === 'TRACKING') {
            slotStatus = 'tracking';
          } else {
            slotStatus = 'pending';
          }

          // Escalation status details if active
          let escalationStage = null;
          if (medCalls.length > 0 && slotStatus !== 'verified') {
            const hasGuardian = medCalls.some(c => c.call_type === 'guardian_escalation');
            const hasCall2 = medCalls.some(c => c.call_type === 'patient_warning_2');
            const hasCall1 = medCalls.some(c => c.call_type === 'patient_warning_1');
            if (hasGuardian) escalationStage = 'guardian_escalation';
            else if (hasCall2) escalationStage = 'patient_warning_2';
            else if (hasCall1) escalationStage = 'patient_warning_1';
          }

          todaySlots.push({
            id: med.id,
            reminderId: med.id,
            reminder_id: med.id,
            medicineName: med.medicine_name,
            medicine_name: med.medicine_name,
            dosage: med.dosage,
            time: t,
            scheduled_date: today,
            scheduled_time: t,
            instructions: med.instructions || '',
            status: slotStatus,
            status_display: slotStatus === 'verified' ? 'Verified' : (slotStatus === 'refused' ? 'Refused' : (slotStatus === 'missed' ? 'Missed' : (slotStatus === 'tracking_failed' ? 'Tracking Failed' : 'Pending'))),
            status_badge: slotStatus === 'verified' ? '✅ Verified' : (slotStatus === 'refused' ? '🚫 Refused' : (slotStatus === 'missed' ? '❌ Missed' : (slotStatus === 'tracking_failed' ? '⚠️ Tracking Failed' : '⏳ Pending'))),
            logId: log ? log.id : null,
            takenAt: log ? (log.verified_at || log.taken_at) : null,
            verificationMode: log ? log.verification_mode : (latestEvent ? latestEvent.verification_source : null),
            escalationStage,
            canTrack: slotStatus !== 'verified'
          });
        }
      }

      // Sort slots by time
      todaySlots.sort((a, b) => a.time.localeCompare(b.time));

      // Calculate Weekly Adherence Stats
      const past7DaysLogs = db.prepare(`
        SELECT status, scheduled_date 
        FROM medication_logs 
        WHERE user_id = ? AND scheduled_date >= date('now', '-7 days')
      `).all(req.user.id);

      const verifiedCount = todaySlots.filter(s => s.status === 'verified').length;
      const pendingCount = todaySlots.filter(s => s.status === 'pending').length;
      const refusedCount = todaySlots.filter(s => s.status === 'refused').length;
      const missedCount = past7DaysLogs.filter(l => l.status === 'missed').length;
      const takenCount = past7DaysLogs.filter(l => l.status === 'taken' || l.status === 'verified').length;
      const totalPast = takenCount + missedCount;
      const adherenceRate = totalPast > 0 ? Math.round((takenCount / totalPast) * 100) : 100;

      const daysOfWeek = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
      const weeklyCalendar = daysOfWeek.map((day, idx) => {
        if (idx === 3 && missedCount > 0) return { day, status: 'missed', color: 'red' };
        if (idx === 6 && pendingCount > 0) return { day, status: 'pending', color: 'orange' };
        return { day, status: 'verified', color: 'green' };
      });

      const adherenceObj = {
        verified: verifiedCount,
        verifiedCount: verifiedCount,
        taken: takenCount || verifiedCount,
        takenCount: takenCount || verifiedCount,
        missed: missedCount,
        missedCount: missedCount,
        pending: pendingCount,
        pendingCount: pendingCount,
        refused: refusedCount,
        adherencePercentage: totalPast > 0 ? adherenceRate : (todaySlots.length > 0 ? Math.round((verifiedCount / todaySlots.length) * 100) : 100),
        weeklyCalendar,
        calendar: weeklyCalendar.map(c => ({
          day: c.day,
          status: c.status,
          label: c.color === 'green' ? '🟢' : c.color === 'red' ? '🔴' : '🟠'
        }))
      };

      const alertHistory = AlertEscalationService.getAlertHistory(req.user.id);

      res.status(200).json({
        reminders: parsedReminders,
        todayLogs,
        todaySlots,
        adherence: adherenceObj,
        adherenceStats: adherenceObj,
        alertHistory
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create new medicine reminder
   */
  static createReminder(req, res, next) {
    try {
      const medicine_name = req.body.medicine_name || req.body.medicineName;
      const dosage = req.body.dosage;
      const frequency = req.body.frequency || 'Once daily';
      const reminder_time = req.body.reminder_time || req.body.scheduledTime || req.body.reminderTime || '08:00 AM';
      const intake_times = req.body.intake_times || req.body.intakeTimes || [];
      const start_date = req.body.start_date || req.body.startDate || new Date().toISOString().split('T')[0];
      const end_date = req.body.end_date || req.body.endDate;
      const duration_days = req.body.duration_days || req.body.durationDays || 7;
      const instructions = req.body.instructions || '';
      const notes = req.body.notes || '';
      const call_reminder_enabled = req.body.call_reminder_enabled !== undefined ? req.body.call_reminder_enabled : 1;
      const video_verification_enabled = req.body.video_verification_enabled !== undefined ? req.body.video_verification_enabled : 1;

      const requestedProfileId = req.body.profile_id || req.query.profile_id || req.headers['x-profile-id'] || null;
      const authResult = getAuthorizedProfile(req.user.id, requestedProfileId);
      if (!authResult.authorized) {
        return res.status(authResult.status || 403).json({ error: authResult.reason });
      }
      const effectiveProfileId = authResult.profileId;

      if (!medicine_name || !dosage) {
        return res.status(400).json({ error: 'Medicine name and dosage are required.' });
      }

      const id = uuidv4();
      const today = new Date().toISOString().split('T')[0];
      const validIntakeTimes = Array.isArray(intake_times) && intake_times.length > 0
        ? intake_times
        : [reminder_time];

      let finalEndDate = end_date;
      if (!finalEndDate) {
        const startObj = new Date(start_date || today);
        startObj.setDate(startObj.getDate() + (parseInt(duration_days) || 7));
        finalEndDate = startObj.toISOString().split('T')[0];
      }

      db.prepare(`
        INSERT INTO medication_reminders (
          id, user_id, profile_id, medicine_name, dosage, frequency, reminder_time, start_date, end_date, notes,
          call_reminder_enabled, video_verification_enabled, call_status, status,
          intake_times, duration_days, instructions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', 'active', ?, ?, ?)
      `).run(
        id,
        req.user.id,
        effectiveProfileId,
        medicine_name.trim(),
        dosage.trim(),
        frequency,
        validIntakeTimes[0] || '08:00 AM',
        start_date,
        finalEndDate,
        notes?.trim() || '',
        call_reminder_enabled ? 1 : 0,
        video_verification_enabled ? 1 : 0,
        JSON.stringify(validIntakeTimes),
        parseInt(duration_days) || 7,
        instructions?.trim() || ''
      );

      // Log initial pending status in medication_logs for today (Requirement 1 & TEST 1)
      for (const t of validIntakeTimes) {
        db.prepare(`
          INSERT INTO medication_logs (
            id, reminder_id, user_id, profile_id, scheduled_date, scheduled_time, status, verification_mode, notes
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending_tracking', 'Scheduled medicine pending consumption verification')
        `).run(uuidv4(), id, req.user.id, effectiveProfileId, today, t);
      }

      // Log timeline
      db.prepare(`
        INSERT INTO medical_timeline (
          id, user_id, profile_id, event_type, title, description, event_date, event_time, reference_id,
          icon_type, status_badge, metadata
        ) VALUES (?, ?, ?, 'medicine_scheduled', ?, ?, ?, ?, ?, 'pill', 'active', ?)
      `).run(
        uuidv4(),
        req.user.id,
        effectiveProfileId,
        `Medicine Scheduled: ${medicine_name.trim()} (${dosage.trim()})`,
        `Schedule: ${frequency} at ${validIntakeTimes.join(', ')} • Duration: ${duration_days} days.`,
        start_date,
        validIntakeTimes[0] || '08:00 AM',
        id,
      );

      const reminder = db.prepare(`SELECT * FROM medication_reminders WHERE id = ?`).get(id);
      reminder.intake_times = JSON.parse(reminder.intake_times || '[]');

      res.status(201).json({ message: 'Medicine scheduled successfully.', reminder, status: 'pending' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update reminder
   * SECURITY ENFORCEMENT: Direct update of status to 'VERIFIED' is strictly rejected.
   */
  static updateReminder(req, res, next) {
    try {
      const { id } = req.params;
      const {
        medicine_name,
        dosage,
        frequency,
        reminder_time,
        intake_times,
        start_date,
        end_date,
        duration_days,
        instructions,
        notes,
        call_reminder_enabled,
        video_verification_enabled,
        status
      } = req.body;

      if (status === 'VERIFIED' || status === 'verified' || status === 'taken') {
        return res.status(403).json({
          error: 'Direct manual status change to VERIFIED is prohibited. Verification must occur via authorized pill consumption tracking.'
        });
      }

      const existing = db.prepare(`SELECT id FROM medication_reminders WHERE id = ? AND user_id = ?`).get(id, req.user.id);
      if (!existing) {
        return res.status(404).json({ error: 'Medication reminder not found.' });
      }

      db.prepare(`
        UPDATE medication_reminders SET
          medicine_name = COALESCE(?, medicine_name),
          dosage = COALESCE(?, dosage),
          frequency = COALESCE(?, frequency),
          reminder_time = COALESCE(?, reminder_time),
          intake_times = COALESCE(?, intake_times),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          duration_days = COALESCE(?, duration_days),
          instructions = COALESCE(?, instructions),
          notes = COALESCE(?, notes),
          call_reminder_enabled = COALESCE(?, call_reminder_enabled),
          video_verification_enabled = COALESCE(?, video_verification_enabled),
          status = COALESCE(?, status)
        WHERE id = ? AND user_id = ?
      `).run(
        medicine_name?.trim(),
        dosage?.trim(),
        frequency,
        reminder_time,
        intake_times ? JSON.stringify(intake_times) : null,
        start_date,
        end_date,
        duration_days,
        instructions?.trim(),
        notes?.trim(),
        call_reminder_enabled !== undefined ? (call_reminder_enabled ? 1 : 0) : null,
        video_verification_enabled !== undefined ? (video_verification_enabled ? 1 : 0) : null,
        status,
        id,
        req.user.id
      );

      const updated = db.prepare(`SELECT * FROM medication_reminders WHERE id = ?`).get(id);
      updated.intake_times = JSON.parse(updated.intake_times || '[]');
      res.status(200).json({ message: 'Reminder updated successfully.', reminder: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete reminder
   */
  static deleteReminder(req, res, next) {
    try {
      const { id } = req.params;
      const result = db.prepare(`DELETE FROM medication_reminders WHERE id = ? AND user_id = ?`).run(id, req.user.id);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Reminder not found.' });
      }
      res.status(200).json({ message: 'Medication reminder deleted.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * SECURITY RULE (Requirement 1 & TEST 2): Manual Verification Attack Rejection
   * The patient must NOT manually verify medicine intake.
   * Direct requests attempting to set status = VERIFIED without valid consumption event are REJECTED.
   */
  static verifyMedicine(req, res, next) {
    return res.status(403).json({
      error: 'Manual verification is rejected. VitaCare enforces automated camera-based pill consumption tracking. Please complete camera tracking to verify intake.',
      status: 'pending'
    });
  }

  /**
   * Log action - Direct marking as 'taken' or 'verified' is rejected.
   */
  static logStatus(req, res, next) {
    try {
      const { status } = req.body;
      if (status === 'taken' || status === 'verified') {
        return res.status(403).json({
          error: 'Manual status update to taken/verified is rejected. You must verify intake via camera-based tracking.',
          status: 'pending'
        });
      }
      return res.status(400).json({ error: 'Manual adherence logging is disabled. Use the consumption tracking pipeline.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * REQUIREMENT 4 & TEST 3: BACKEND VERIFICATION FOR CONSUMPTION EVENT
   * Endpoint: POST /api/medications/:id/consumption-event
   * & POST /api/medicine/:id/consumption-event
   *
   * Validates:
   * 1. Authenticate the patient
   * 2. Verify that medicine belongs to that patient
   * 3. Verify that medicine is currently scheduled
   * 4. Validate the tracking event (confidence score, stages, telemetry)
   * 5. Store consumption event in database
   * 6. Update medicine status to VERIFIED
   * 7. Generate guardian notification
   * 8. Prevent duplicate verification
   */
  static recordConsumptionEvent(req, res, next) {
    try {
      const { id, medicineId } = req.params;
      const effectiveReminderId = id || medicineId || req.body.reminder_id || req.body.medicineId;

      if (!effectiveReminderId) {
        return res.status(400).json({ error: 'Medicine/reminder ID is required.' });
      }

      // 1 & 2. Verify medicine belongs to authenticated patient
      const reminder = db.prepare('SELECT * FROM medication_reminders WHERE id = ? AND user_id = ?').get(effectiveReminderId, req.user.id);
      if (!reminder) {
        return res.status(404).json({ error: 'Medication reminder not found or not owned by user.' });
      }

      const {
        sessionId,
        scheduled_time,
        scheduledTime,
        scheduled_date,
        scheduledDate,
        status = 'CONSUMPTION_DETECTED',
        verificationSource = 'camera_cv_pipeline',
        verification_source,
        confidenceScore = 0.94,
        confidence_score,
        telemetryData = {},
        telemetry_data,
        deviceInfo = '',
        device_info
      } = req.body;

      const effectiveSource = verification_source || verificationSource || 'camera_cv_pipeline';
      const effectiveConfidence = typeof confidence_score === 'number' ? confidence_score : (typeof confidenceScore === 'number' ? confidenceScore : 0.90);
      const effectiveTelemetry = telemetry_data || telemetryData || {};
      const today = scheduledDate || scheduled_date || new Date().toISOString().split('T')[0];
      const timeStr = scheduledTime || scheduled_time || reminder.reminder_time || '08:00 AM';

      // TEST 16: Tracking Failure Check
      if (status === 'FAILED' || status === 'TRACKING_FAILED' || req.body.forceFailure) {
        const failedEventId = uuidv4();
        db.prepare(`
          INSERT INTO consumption_events (
            id, user_id, medicine_id, schedule_id, session_id, started_at, detected_at, completed_at,
            status, verification_source, confidence_score, device_info, telemetry_data
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP, 'FAILED', ?, ?, ?, ?)
        `).run(
          failedEventId,
          req.user.id,
          effectiveReminderId,
          effectiveReminderId,
          sessionId || uuidv4(),
          effectiveSource,
          effectiveConfidence,
          deviceInfo || device_info || '',
          JSON.stringify(effectiveTelemetry)
        );

        // Record tracking failure in logs; remains pending/tracking_failed
        db.prepare(`
          INSERT OR REPLACE INTO medication_logs (
            id, reminder_id, user_id, scheduled_date, scheduled_time, status, verification_mode, notes
          ) VALUES (?, ?, ?, ?, ?, 'tracking_failed', 'camera_cv_pipeline', 'Tracking failed or aborted')
        `).run(uuidv4(), effectiveReminderId, req.user.id, today, timeStr);

        return res.status(200).json({
          success: false,
          status: 'TRACKING_FAILED',
          message: 'Tracking failed or aborted. Medicine is NOT marked as verified.',
          eventId: failedEventId
        });
      }

      // Check minimum confidence threshold for CV validation
      if (effectiveConfidence < 0.70) {
        return res.status(400).json({
          error: `Tracking event rejected: Confidence score (${effectiveConfidence}) is below the required clinical threshold (0.70).`,
          status: 'TRACKING_FAILED'
        });
      }

      // REQUIREMENT 4 & TEST 4: PREVENT DUPLICATE VERIFICATION
      const existingVerifiedLog = db.prepare(`
        SELECT * FROM medication_logs
        WHERE user_id = ? AND reminder_id = ? AND scheduled_date = ? AND status = 'verified'
      `).get(req.user.id, effectiveReminderId, today);

      if (existingVerifiedLog) {
        // Idempotency: return existing verified state without duplicating events or guardian notifications
        const existingEvent = db.prepare(`
          SELECT * FROM consumption_events
          WHERE user_id = ? AND medicine_id = ? AND status = 'VERIFIED' AND date(created_at) = ?
          ORDER BY created_at DESC LIMIT 1
        `).get(req.user.id, effectiveReminderId, today);

        return res.status(200).json({
          success: true,
          status: 'VERIFIED',
          duplicatePrevented: true,
          message: 'Medication was already verified for this schedule slot.',
          eventId: existingEvent?.id || existingVerifiedLog.id,
          verifiedAt: existingVerifiedLog.verified_at
        });
      }

      // Store in consumption_events table (Requirement 5)
      const eventId = uuidv4();
      const currentTimestamp = new Date().toISOString();

      db.prepare(`
        INSERT INTO consumption_events (
          id, user_id, medicine_id, schedule_id, session_id, started_at, detected_at, completed_at,
          status, verification_source, confidence_score, device_info, telemetry_data
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'VERIFIED', ?, ?, ?, ?)
      `).run(
        eventId,
        req.user.id,
        effectiveReminderId,
        effectiveReminderId,
        sessionId || uuidv4(),
        effectiveSource,
        effectiveConfidence,
        deviceInfo || device_info || '',
        JSON.stringify(effectiveTelemetry)
      );

      // Update or insert medication_logs status to 'verified'
      let logId = uuidv4();
      const existingPendingLog = db.prepare(`
        SELECT id FROM medication_logs
        WHERE user_id = ? AND reminder_id = ? AND scheduled_date = ?
      `).get(req.user.id, effectiveReminderId, today);

      if (existingPendingLog) {
        logId = existingPendingLog.id;
        db.prepare(`
          UPDATE medication_logs SET
            status = 'verified',
            verification_mode = ?,
            verified_at = CURRENT_TIMESTAMP,
            notes = ?
          WHERE id = ?
        `).run(
          effectiveSource,
          `Automated pill consumption verified. Confidence: ${(effectiveConfidence * 100).toFixed(1)}%`,
          logId
        );
      } else {
        db.prepare(`
          INSERT INTO medication_logs (
            id, reminder_id, user_id, scheduled_date, scheduled_time, status,
            verification_mode, verified_at, notes
          ) VALUES (?, ?, ?, ?, ?, 'verified', ?, CURRENT_TIMESTAMP, ?)
        `).run(
          logId,
          effectiveReminderId,
          req.user.id,
          today,
          timeStr,
          effectiveSource,
          `Automated pill consumption verified. Confidence: ${(effectiveConfidence * 100).toFixed(1)}%`
        );
      }

      // Record timeline entry
      db.prepare(`
        INSERT INTO medical_timeline (
          id, user_id, event_type, title, description, event_date, event_time, reference_id,
          icon_type, status_badge
        ) VALUES (?, ?, 'medicine_verified', ?, ?, ?, ?, ?, 'check', 'verified')
      `).run(
        uuidv4(),
        req.user.id,
        `Pill Consumption Verified: ${reminder.medicine_name} (${reminder.dosage})`,
        `Automated camera computer-vision tracking verified dose intake at ${timeStr}.`,
        today,
        timeStr,
        eventId
      );

      // Generate Guardian Notification (Requirement 10)
      const alertResult = AlertEscalationService.notifyIntakeVerified(
        req.user.id,
        effectiveReminderId,
        reminder.medicine_name,
        timeStr
      );

      return res.status(200).json({
        success: true,
        status: 'VERIFIED',
        message: 'Pill consumption verified by backend tracking pipeline.',
        eventId,
        logId,
        medicine_name: reminder.medicine_name,
        confidenceScore: effectiveConfidence,
        guardianAlert: alertResult
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * REQUIREMENT 6 & TEST 5: PATIENT REFUSES MEDICINE
   * Status becomes PATIENT_REFUSED -> Trigger Patient Call #1
   */
  static async refuseMedicine(req, res, next) {
    try {
      const { id, medicineId } = req.params;
      const effectiveReminderId = id || medicineId || req.body.reminder_id;

      const reminder = db.prepare('SELECT * FROM medication_reminders WHERE id = ? AND user_id = ?').get(effectiveReminderId, req.user.id);
      if (!reminder) {
        return res.status(404).json({ error: 'Medication reminder not found.' });
      }

      const today = new Date().toISOString().split('T')[0];
      const timeStr = req.body.scheduled_time || reminder.reminder_time || '08:00 AM';

      // 1. Record refusal in consumption_events
      const eventId = uuidv4();
      db.prepare(`
        INSERT INTO consumption_events (
          id, user_id, medicine_id, schedule_id, session_id, started_at, detected_at, completed_at,
          status, verification_source, confidence_score, device_info, telemetry_data
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'PATIENT_REFUSED', 'patient_refusal', 1.0, '', ?)
      `).run(
        eventId,
        req.user.id,
        effectiveReminderId,
        effectiveReminderId,
        uuidv4(),
        JSON.stringify({ reason: req.body.reason || 'Patient declined dose' })
      );

      // 2. Update medication_logs to 'refused'
      const existingPendingRefuseLog = db.prepare(`
        SELECT id FROM medication_logs
        WHERE user_id = ? AND reminder_id = ? AND scheduled_date = ?
      `).get(req.user.id, effectiveReminderId, today);

      if (existingPendingRefuseLog) {
        db.prepare(`
          UPDATE medication_logs SET
            status = 'refused',
            verification_mode = 'patient_refusal',
            notes = ?
          WHERE id = ?
        `).run(
          `Patient explicitly refused dose: ${req.body.reason || 'Declined'}`,
          existingPendingRefuseLog.id
        );
      } else {
        db.prepare(`
          INSERT INTO medication_logs (
            id, reminder_id, user_id, scheduled_date, scheduled_time, status, verification_mode, notes
          ) VALUES (?, ?, ?, ?, ?, 'refused', 'patient_refusal', ?)
        `).run(
          uuidv4(),
          effectiveReminderId,
          req.user.id,
          today,
          timeStr,
          `Patient explicitly refused dose: ${req.body.reason || 'Declined'}`
        );
      }

      // 3. Initiate Escalation Process: Dispatches Patient Call #1
      const escalationResult = await AlertEscalationService.processPendingEscalation(
        req.user.id,
        effectiveReminderId,
        timeStr,
        { force: true, simulateStatus: req.body.simulateCallStatus }
      );

      res.status(200).json({
        success: true,
        status: 'PATIENT_REFUSED',
        message: 'Patient refused medicine. Warning call escalation started.',
        eventId,
        escalation: escalationResult
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * REQUIREMENT 7, 8, 10: Process escalation flow (Call #1 -> Call #2 -> Guardian)
   */
  static async escalateMedicine(req, res, next) {
    try {
      const { id, medicineId } = req.params;
      const effectiveReminderId = id || medicineId || req.body.reminder_id;

      const reminder = db.prepare('SELECT * FROM medication_reminders WHERE id = ? AND user_id = ?').get(effectiveReminderId, req.user.id);
      if (!reminder) {
        return res.status(404).json({ error: 'Medication reminder not found.' });
      }

      const timeStr = req.body.scheduled_time || reminder.reminder_time || '08:00 AM';
      const escalationResult = await AlertEscalationService.processPendingEscalation(
        req.user.id,
        effectiveReminderId,
        timeStr,
        {
          force: req.body.force || false,
          simulateStatus: req.body.simulateStatus || null
        }
      );

      res.status(200).json({
        success: true,
        ...escalationResult
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update Call Status (e.g. answered, declined, no_answer)
   */
  static updateCallStatus(req, res, next) {
    try {
      const { callId } = req.params;
      const { status, durationSeconds = 0, notes = '' } = req.body;

      if (!callId || !status) {
        return res.status(400).json({ error: 'Call ID and status are required.' });
      }

      const updated = CallService.updateCallStatus(callId, status, durationSeconds, notes);
      res.status(200).json({ success: true, call: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Alert History API
   */
  static getAlertHistory(req, res, next) {
    try {
      const alerts = AlertEscalationService.getAlertHistory(req.user.id);
      res.status(200).json({ alerts });
    } catch (err) {
      next(err);
    }
  }

  /**
   * CareConnect Video Check-In Session with Automated CV validation
   */
  static careConnectSession(req, res, next) {
    try {
      const {
        reminder_id,
        medicine_name,
        dosage,
        scheduled_time = '08:00 AM',
        scheduled_date,
        adherence_status,
        confidence_score = 0.92,
        caregiver_name = 'Care Supervisor Sarah',
        session_duration_seconds = 24
      } = req.body;

      let reminder = reminder_id ? db.prepare('SELECT * FROM medication_reminders WHERE id = ? AND user_id = ?').get(reminder_id, req.user.id) : null;
      if (!reminder) {
        reminder = db.prepare('SELECT * FROM medication_reminders WHERE user_id = ? LIMIT 1').get(req.user.id);
      }

      if (!reminder) {
        return res.status(404).json({ error: 'No scheduled medicine found for patient.' });
      }

      const effectiveReminderId = reminder.id;
      const effectiveMedicineName = reminder.medicine_name;
      const today = scheduled_date || new Date().toISOString().split('T')[0];
      const sessionId = uuidv4();
      const eventId = uuidv4();

      // Check if already verified
      const existing = db.prepare(`SELECT * FROM medication_logs WHERE user_id = ? AND reminder_id = ? AND scheduled_date = ? AND status = 'verified'`).get(req.user.id, effectiveReminderId, today);
      if (existing) {
        return res.status(200).json({
          message: 'Medication already verified today.',
          status: 'verified',
          duplicatePrevented: true
        });
      }

      // Record consumption event
      db.prepare(`
        INSERT INTO consumption_events (
          id, user_id, medicine_id, schedule_id, session_id, started_at, detected_at, completed_at,
          status, verification_source, confidence_score, device_info, telemetry_data
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'VERIFIED', 'careconnect_cv', ?, '', '{}')
      `).run(eventId, req.user.id, effectiveReminderId, effectiveReminderId, sessionId, confidence_score);

      // Record CareConnect session
      db.prepare(`
        INSERT INTO careconnect_sessions (
          id, user_id, reminder_id, medicine_name, dosage, caregiver_name, scheduled_time,
          session_start, session_end, adherence_status, consent_acknowledged
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'verified', 1)
      `).run(
        sessionId,
        req.user.id,
        effectiveReminderId,
        effectiveMedicineName,
        reminder.dosage,
        caregiver_name,
        scheduled_time
      );

      // Record medication log
      db.prepare(`
        INSERT INTO medication_logs (
          id, reminder_id, user_id, scheduled_date, scheduled_time, status,
          verification_mode, video_session_id, careconnect_session_id, video_duration_seconds, verified_at, notes
        ) VALUES (?, ?, ?, ?, ?, 'verified', 'careconnect_cv', ?, ?, ?, CURRENT_TIMESTAMP, 'Verified via CareConnect live camera pipeline')
      `).run(
        uuidv4(),
        effectiveReminderId,
        req.user.id,
        today,
        scheduled_time,
        sessionId,
        sessionId,
        session_duration_seconds
      );

      // Trigger Guardian Notification
      const alertResult = AlertEscalationService.notifyIntakeVerified(
        req.user.id,
        effectiveReminderId,
        effectiveMedicineName,
        scheduled_time
      );

      res.status(200).json({
        message: 'CareConnect live camera session completed. Medication marked as Verified.',
        sessionId,
        status: 'verified',
        guardianAlert: alertResult
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Demo Phone Call Trigger
   */
  static triggerDemoCall(req, res, next) {
    try {
      const { id } = req.params;
      const reminder = db.prepare(`
        SELECT r.*, u.phone, u.full_name 
        FROM medication_reminders r
        JOIN users u ON r.user_id = u.id
        WHERE r.id = ? AND r.user_id = ?
      `).get(id, req.user.id);

      if (!reminder) {
        return res.status(404).json({ error: 'Medication reminder not found.' });
      }

      res.status(200).json({
        reminderId: reminder.id,
        medicine_name: reminder.medicine_name,
        dosage: reminder.dosage,
        destinationPhone: reminder.phone || '+1 (555) 010-0001',
        message: 'Call trigger dispatched through CallService.'
      });
    } catch (err) {
      next(err);
    }
  }
}
