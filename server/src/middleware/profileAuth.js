import { db } from '../database/db.js';

/**
 * Resolves and validates access to a family profile.
 * Ensures strict profile isolation and rejects unauthorized cross-profile requests.
 */
export function getAuthorizedProfile(userId, requestedProfileId = null) {
  // If no profile specified or explicitly 'self'/'default', look up user's primary self profile
  if (!requestedProfileId || requestedProfileId === 'self' || requestedProfileId === 'default' || requestedProfileId === `self-${userId}`) {
    const selfMember = db.prepare(`
      SELECT * FROM family_members 
      WHERE user_id = ? AND profile_type = 'self' AND consent_status != 'revoked'
      LIMIT 1
    `).get(userId);

    const effectiveId = selfMember ? selfMember.id : `self-${userId}`;
    return {
      authorized: true,
      profileId: effectiveId,
      profile: selfMember || { id: effectiveId, name: 'Self', profile_type: 'self', relation: 'self' },
      isSelf: true
    };
  }

  // Check if profile belongs to the authenticated user and has active consent
  const member = db.prepare(`
    SELECT * FROM family_members 
    WHERE id = ? AND user_id = ? AND consent_status != 'revoked'
  `).get(requestedProfileId, userId);

  if (member) {
    return {
      authorized: true,
      profileId: member.id,
      profile: member,
      isSelf: member.profile_type === 'self'
    };
  }

  // Cross-profile security check: does this profile exist under a DIFFERENT user?
  const foreignProfile = db.prepare(`
    SELECT id, user_id FROM family_members WHERE id = ?
  `).get(requestedProfileId);

  if (foreignProfile) {
    return {
      authorized: false,
      reason: 'Cross-profile access forbidden: record belongs to another user account.',
      status: 403,
      statusCode: 403,
      error: 'Cross-profile access forbidden: record belongs to another user account.'
    };
  }

  return {
    authorized: false,
    reason: 'Family profile not found or unauthorized access rejected.',
    status: 403,
    statusCode: 403,
    error: 'Family profile not found or unauthorized access rejected.'
  };
}

/**
 * Express middleware to validate profile access on endpoints with profile_id
 */
export function enforceProfileAccess(req, res, next) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const requestedProfileId = req.query.profile_id || req.headers['x-profile-id'] || req.body?.profile_id || null;
  const authResult = getAuthorizedProfile(userId, requestedProfileId);

  if (!authResult.authorized) {
    return res.status(authResult.status || 403).json({
      error: authResult.reason || 'Access denied. You are not authorized to view health records for this profile.'
    });
  }

  req.effectiveProfileId = authResult.profileId;
  req.profileMember = authResult.profile;
  next();
}
