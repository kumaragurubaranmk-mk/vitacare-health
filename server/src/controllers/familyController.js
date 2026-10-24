import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { getAuthorizedProfile } from '../middleware/profileAuth.js';

export class FamilyController {
  /**
   * Get all authorized family members for current user
   */
  static getFamilyMembers(req, res, next) {
    try {
      const userId = req.user.id;
      const { include_revoked = 'false' } = req.query;

      let query = `SELECT * FROM family_members WHERE user_id = ?`;
      if (include_revoked !== 'true') {
        query += ` AND consent_status != 'revoked'`;
      }
      query += ` ORDER BY CASE profile_type WHEN 'self' THEN 1 WHEN 'child' THEN 2 ELSE 3 END, created_at ASC`;

      let members = db.prepare(query).all(userId);

      // If user has no family member profile yet, create a default Self profile
      if (members.length === 0) {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        const healthProfile = db.prepare('SELECT * FROM health_profiles WHERE user_id = ?').get(userId) || {};
        const selfId = `fam-self-${userId.slice(0, 8)}`;

        db.prepare(`
          INSERT INTO family_members (
            id, user_id, name, relation, profile_type, gender, blood_group, allergies,
            existing_conditions, emergency_contact, emergency_phone, consent_status
          ) VALUES (?, ?, ?, 'self', 'self', 'other', ?, ?, ?, ?, ?, 'consented')
        `).run(
          selfId,
          userId,
          user?.full_name || 'Primary Account Owner',
          healthProfile.blood_group || '',
          healthProfile.allergies || '',
          healthProfile.existing_conditions || '',
          healthProfile.emergency_contact_name || '',
          healthProfile.emergency_contact_phone || ''
        );

        members = db.prepare(query).all(userId);
      }

      // Attach counts for each member (reports, active meds)
      const enriched = members.map(m => {
        const reportsCount = db.prepare(`
          SELECT COUNT(*) as cnt FROM medical_reports 
          WHERE user_id = ? AND (profile_id = ? OR (profile_id IS NULL AND ? = 'self'))
        `).get(userId, m.id, m.profile_type)?.cnt || 0;

        const medsCount = db.prepare(`
          SELECT COUNT(*) as cnt FROM medication_reminders 
          WHERE user_id = ? AND status = 'active' AND (profile_id = ? OR (profile_id IS NULL AND ? = 'self'))
        `).get(userId, m.id, m.profile_type)?.cnt || 0;

        return {
          ...m,
          reportsCount,
          activeMedicationsCount: medsCount
        };
      });

      res.status(200).json({ familyMembers: enriched });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single family member with security check
   */
  static getFamilyMember(req, res, next) {
    try {
      const userId = req.user.id;
      const { memberId } = req.params;

      const authResult = getAuthorizedProfile(userId, memberId);
      if (!authResult.authorized) {
        return res.status(authResult.status || 403).json({ error: authResult.reason });
      }

      const member = db.prepare(`SELECT * FROM family_members WHERE id = ?`).get(authResult.profileId);
      res.status(200).json({ member });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create or connect family profile (Child, Dependent, Self)
   */
  static createFamilyMember(req, res, next) {
    try {
      const userId = req.user.id;
      const {
        name,
        relation = 'dependent',
        profile_type = 'dependent',
        gender = 'other',
        date_of_birth = '',
        blood_group = '',
        allergies = '',
        existing_conditions = '',
        emergency_contact = '',
        emergency_phone = '',
        guardian_consent_acknowledged = true,
        notes = ''
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Family member name is required.' });
      }

      // Children under guardianship require explicit guardian consent acknowledgment
      if (profile_type === 'child' && !guardian_consent_acknowledged) {
        return res.status(400).json({ error: 'Authorized guardian consent acknowledgment is required for children profiles.' });
      }

      const memberId = `fam-${uuidv4().slice(0, 12)}`;

      db.prepare(`
        INSERT INTO family_members (
          id, user_id, name, relation, profile_type, gender, date_of_birth, blood_group,
          allergies, existing_conditions, emergency_contact, emergency_phone, consent_status,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'consented', ?)
      `).run(
        memberId,
        userId,
        name.trim(),
        relation,
        profile_type,
        gender,
        date_of_birth,
        blood_group.trim(),
        allergies.trim(),
        existing_conditions.trim(),
        emergency_contact.trim(),
        emergency_phone.trim(),
        notes.trim()
      );

      // Create isolated health profile entry
      db.prepare(`
        INSERT OR IGNORE INTO health_profiles (id, user_id, profile_id, blood_group, allergies, existing_conditions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(`hp-${memberId}`, userId, memberId, blood_group.trim(), allergies.trim(), existing_conditions.trim());

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, details)
        VALUES (?, ?, 'FAMILY_PROFILE_CREATED', 'family_member', ?, ?)
      `).run(
        uuidv4(),
        userId,
        memberId,
        `Created ${profile_type} profile: ${name.trim()} (${relation}) with guardian consent verified.`
      );

      const created = db.prepare(`SELECT * FROM family_members WHERE id = ?`).get(memberId);
      res.status(201).json({
        message: 'Family profile created successfully.',
        member: created
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update family member details
   */
  static updateFamilyMember(req, res, next) {
    try {
      const userId = req.user.id;
      const { memberId } = req.params;

      const authResult = getAuthorizedProfile(userId, memberId);
      if (!authResult.authorized) {
        return res.status(authResult.status || 403).json({ error: authResult.reason });
      }

      const {
        name,
        relation,
        gender,
        date_of_birth,
        blood_group,
        allergies,
        existing_conditions,
        emergency_contact,
        emergency_phone,
        notes
      } = req.body;

      db.prepare(`
        UPDATE family_members SET
          name = COALESCE(?, name),
          relation = COALESCE(?, relation),
          gender = COALESCE(?, gender),
          date_of_birth = COALESCE(?, date_of_birth),
          blood_group = COALESCE(?, blood_group),
          allergies = COALESCE(?, allergies),
          existing_conditions = COALESCE(?, existing_conditions),
          emergency_contact = COALESCE(?, emergency_contact),
          emergency_phone = COALESCE(?, emergency_phone),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(
        name?.trim(),
        relation,
        gender,
        date_of_birth,
        blood_group?.trim(),
        allergies?.trim(),
        existing_conditions?.trim(),
        emergency_contact?.trim(),
        emergency_phone?.trim(),
        notes?.trim(),
        authResult.profileId,
        userId
      );

      const updated = db.prepare(`SELECT * FROM family_members WHERE id = ?`).get(authResult.profileId);
      res.status(200).json({ message: 'Profile updated.', member: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Revoke access or remove family member safely
   */
  static revokeFamilyAccess(req, res, next) {
    try {
      const userId = req.user.id;
      const { memberId } = req.params;

      const authResult = getAuthorizedProfile(userId, memberId);
      if (!authResult.authorized) {
        return res.status(authResult.status || 403).json({ error: authResult.reason });
      }

      const member = authResult.profile;
      if (member.profile_type === 'self') {
        return res.status(400).json({ error: 'Primary self account profile cannot be revoked or deleted.' });
      }

      db.prepare(`
        UPDATE family_members SET consent_status = 'revoked', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(memberId, userId);

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, details)
        VALUES (?, ?, 'FAMILY_ACCESS_REVOKED', 'family_member', ?, ?)
      `).run(
        uuidv4(),
        userId,
        memberId,
        `Revoked access for family profile: ${member.name} (${member.relation}).`
      );

      res.status(200).json({ message: `Access for ${member.name} has been revoked safely.` });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get unified health overview for a specific family member
   */
  static getFamilySummary(req, res, next) {
    try {
      const userId = req.user.id;
      const { memberId } = req.params;

      const authResult = getAuthorizedProfile(userId, memberId);
      if (!authResult.authorized) {
        return res.status(authResult.status || 403).json({ error: authResult.reason });
      }

      const pId = authResult.profileId;
      const member = authResult.profile;

      // Reports
      const reports = db.prepare(`
        SELECT id, title, report_type, report_date, ai_summary 
        FROM medical_reports 
        WHERE user_id = ? AND (profile_id = ? OR (profile_id IS NULL AND ? = 'self'))
        ORDER BY report_date DESC LIMIT 5
      `).all(userId, pId, member.profile_type || 'dependent');

      // Active Medications
      const medications = db.prepare(`
        SELECT id, medicine_name, dosage, frequency, reminder_time, instructions, notes 
        FROM medication_reminders 
        WHERE user_id = ? AND status = 'active' AND (profile_id = ? OR (profile_id IS NULL AND ? = 'self'))
        ORDER BY reminder_time ASC
      `).all(userId, pId, member.profile_type || 'dependent');

      // Biomarkers
      const biomarkers = db.prepare(`
        SELECT biomarker_name, value, unit, status, reference_range, recorded_date 
        FROM report_biomarkers 
        WHERE user_id = ? AND (profile_id = ? OR (profile_id IS NULL AND ? = 'self'))
        ORDER BY recorded_date DESC LIMIT 10
      `).all(userId, pId, member.profile_type || 'dependent');

      // Timeline events
      const timeline = db.prepare(`
        SELECT id, event_type, title, description, event_date, event_time, status_badge 
        FROM medical_timeline 
        WHERE user_id = ? AND (profile_id = ? OR (profile_id IS NULL AND ? = 'self'))
        ORDER BY event_date DESC, created_at DESC LIMIT 5
      `).all(userId, pId, member.profile_type || 'dependent');

      res.status(200).json({
        member,
        summary: {
          totalReports: reports.length,
          activeMedications: medications.length,
          recentReports: reports,
          medications,
          recentBiomarkers: biomarkers,
          recentTimeline: timeline
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
