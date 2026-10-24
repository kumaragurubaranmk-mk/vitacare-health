import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { getAuthorizedProfile } from '../middleware/profileAuth.js';

export class TimelineController {
  /**
   * Get all chronological health timeline events for user/profile
   */
  static getTimeline(req, res, next) {
    try {
      const requestedProfileId = req.query.profile_id || req.headers['x-profile-id'] || null;
      const authResult = getAuthorizedProfile(req.user.id, requestedProfileId);

      if (!authResult.authorized) {
        return res.status(authResult.status || 403).json({ error: authResult.reason });
      }

      const pId = authResult.profileId;
      const isSelf = authResult.isSelf;

      let events;
      if (isSelf) {
        events = db.prepare(`
          SELECT * FROM medical_timeline 
          WHERE user_id = ? AND (profile_id = ? OR profile_id IS NULL OR profile_id = 'self' OR profile_id = ?)
          ORDER BY event_date DESC, created_at DESC
        `).all(req.user.id, pId, `self-${req.user.id}`);
      } else {
        events = db.prepare(`
          SELECT * FROM medical_timeline 
          WHERE user_id = ? AND profile_id = ?
          ORDER BY event_date DESC, created_at DESC
        `).all(req.user.id, pId);
      }

      const parsed = events.map(e => ({
        ...e,
        metadata: e.metadata ? (typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata) : {}
      }));

      res.status(200).json({
        timeline: parsed,
        totalEvents: parsed.length,
        profileId: pId,
        profileName: authResult.profile?.name || 'Self'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Add a custom event to the timeline
   */
  static addEvent(req, res, next) {
    try {
      const {
        event_type = 'custom_note',
        title,
        description = '',
        event_date,
        event_time = '',
        icon_type = 'calendar',
        status_badge = 'completed',
        profile_id = null
      } = req.body;

      if (!title || !event_date) {
        return res.status(400).json({ error: 'Title and event date are required.' });
      }

      const authResult = getAuthorizedProfile(req.user.id, profile_id);
      if (!authResult.authorized) {
        return res.status(authResult.status || 403).json({ error: authResult.reason });
      }

      const id = uuidv4();
      db.prepare(`
        INSERT INTO medical_timeline (
          id, user_id, profile_id, event_type, title, description, event_date, event_time,
          icon_type, status_badge
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        req.user.id,
        authResult.profileId,
        event_type,
        title.trim(),
        description.trim(),
        event_date,
        event_time,
        icon_type,
        status_badge
      );

      const event = db.prepare('SELECT * FROM medical_timeline WHERE id = ?').get(id);
      res.status(201).json({ message: 'Timeline event recorded.', event });
    } catch (err) {
      next(err);
    }
  }
}
