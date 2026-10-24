import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { FhirService } from '../services/fhirService.js';
import { getAuthorizedProfile } from '../middleware/profileAuth.js';

export class AbdmController {
  /**
   * Get ABHA linking status and profile for active patient
   */
  static getAbhaProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const requestedProfileId = req.query.profile_id || null;

      const auth = getAuthorizedProfile(userId, requestedProfileId);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ error: auth.reason });
      }

      const abha = db.prepare(`
        SELECT * FROM abha_profiles 
        WHERE user_id = ? AND (profile_id = ? OR (profile_id IS NULL AND ? = 'self'))
      `).get(userId, auth.profileId, auth.profile.profile_type || 'self');

      res.status(200).json({
        profile: auth.profile,
        abhaProfile: abha || null,
        isLinked: Boolean(abha && abha.status === 'linked'),
        sandboxNotice: 'Test-Only Mock ABHA Sandbox (Not connected to production ABDM gateway).'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Request Mock OTP for ABHA authentication/linking
   */
  static requestMockOtp(req, res, next) {
    try {
      const { abha_number, abha_address, phone } = req.body;

      res.status(200).json({
        success: true,
        message: 'Mock OTP dispatched successfully to registered mobile.',
        mockOtp: '123456',
        targetMobile: phone || '+91 98765-43210',
        abhaAddress: abha_address || 'patient@sbx',
        isMockSandbox: true,
        note: 'Use test verification code 123456 to complete mock linking.'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Link Mock ABHA Number and Address
   */
  static linkMockAbha(req, res, next) {
    try {
      const userId = req.user.id;
      const {
        abha_number,
        abha_address,
        otp_code,
        profile_id = null
      } = req.body;

      if (!abha_number || !abha_address) {
        return res.status(400).json({ error: 'ABHA Number and ABHA Address are required.' });
      }

      if (otp_code && otp_code !== '123456' && otp_code.length !== 6) {
        return res.status(400).json({ error: 'Invalid mock OTP. Use test code 123456.' });
      }

      const auth = getAuthorizedProfile(userId, profile_id);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ error: auth.reason });
      }

      const pId = auth.profileId;
      const id = `abha-${uuidv4().slice(0, 8)}`;

      // Format ABHA number cleanly as 91-XXXX-XXXX-XXXX
      const cleanNum = abha_number.includes('-')
        ? abha_number
        : `91-${abha_number.slice(0, 4)}-${abha_number.slice(4, 8)}-${abha_number.slice(8, 12)}`;

      const cleanAddr = abha_address.includes('@') ? abha_address : `${abha_address}@sbx`;

      // Upsert ABHA profile
      db.prepare(`
        INSERT INTO abha_profiles (
          id, user_id, profile_id, abha_number, abha_address, phr_address, status,
          verification_method, is_mock, kyc_status
        ) VALUES (?, ?, ?, ?, ?, ?, 'linked', 'mock_otp', 1, 'verified')
        ON CONFLICT(id) DO UPDATE SET
          abha_number = excluded.abha_number,
          abha_address = excluded.abha_address,
          status = 'linked',
          linked_at = CURRENT_TIMESTAMP
      `).run(id, userId, pId, cleanNum, cleanAddr, `${cleanAddr}.abdm`);

      const linked = db.prepare(`SELECT * FROM abha_profiles WHERE id = ?`).get(id);

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, details)
        VALUES (?, ?, 'ABHA_MOCK_LINKED', 'abha_profile', ?, ?)
      `).run(
        uuidv4(),
        userId,
        id,
        `Linked test mock ABHA ${cleanNum} (${cleanAddr}) for profile ${auth.profile.name}.`
      );

      res.status(200).json({
        success: true,
        message: 'Mock ABHA linked successfully in test sandbox.',
        abhaProfile: linked,
        isMockSandbox: true
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Unlink Mock ABHA
   */
  static unlinkMockAbha(req, res, next) {
    try {
      const userId = req.user.id;
      const { profile_id = null } = req.body;

      const auth = getAuthorizedProfile(userId, profile_id);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ error: auth.reason });
      }

      db.prepare(`
        DELETE FROM abha_profiles WHERE user_id = ? AND profile_id = ?
      `).run(userId, auth.profileId);

      res.status(200).json({ success: true, message: 'ABHA account unlinked.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Export complete FHIR R4 Bundle
   */
  static exportFhirBundle(req, res, next) {
    try {
      const userId = req.user.id;
      const requestedProfileId = req.query.profile_id || null;

      const bundle = FhirService.exportFhirBundle(userId, requestedProfileId);
      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get ABDM Consent Artifacts
   */
  static getConsents(req, res, next) {
    try {
      const userId = req.user.id;
      const requestedProfileId = req.query.profile_id || null;

      const auth = getAuthorizedProfile(userId, requestedProfileId);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ error: auth.reason });
      }

      const consents = db.prepare(`
        SELECT * FROM abdm_consents
        WHERE user_id = ? AND (profile_id = ? OR (profile_id IS NULL AND ? = 'self'))
        ORDER BY created_at DESC
      `).all(userId, auth.profileId, auth.profile.profile_type || 'self');

      res.status(200).json({
        consents,
        sandboxNotice: 'Demonstrates ABDM Electronic Consent Management (HIP/HIU consent flow).'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create / Grant a Mock Consent Artifact
   */
  static createConsent(req, res, next) {
    try {
      const userId = req.user.id;
      const {
        hip_name = 'Apollo Diagnostics & Hospitals',
        purpose = 'Care Management',
        from_date = '2026-01-01',
        to_date = '2027-01-01',
        profile_id = null
      } = req.body;

      const auth = getAuthorizedProfile(userId, profile_id);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ error: auth.reason });
      }

      const consentId = `CONSENT-${uuidv4().slice(0, 8).toUpperCase()}`;
      const id = `c-${uuidv4().slice(0, 8)}`;

      db.prepare(`
        INSERT INTO abdm_consents (
          id, user_id, profile_id, consent_id, hip_name, purpose, status, from_date, to_date, expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, 'GRANTED', ?, ?, ?)
      `).run(id, userId, auth.profileId, consentId, hip_name, purpose, from_date, to_date, to_date);

      const created = db.prepare('SELECT * FROM abdm_consents WHERE id = ?').get(id);
      res.status(201).json({ success: true, consent: created });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Revoke Mock Consent Artifact
   */
  static revokeConsent(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      db.prepare(`
        UPDATE abdm_consents SET status = 'REVOKED' WHERE id = ? AND user_id = ?
      `).run(id, userId);

      res.status(200).json({ success: true, message: 'Consent artifact revoked.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get Production ABDM Integration Architecture & Roadmap documentation
   */
  static getArchitecture(req, res, next) {
    try {
      res.status(200).json({
        abdmReadiness: {
          currentStatus: 'Ready for Sandbox / Production Integration',
          fhirVersion: 'HL7 FHIR R4 (NRCES India StructureDefinition v4.0.0)',
          milestones: [
            { milestone: 'M1', name: 'ABHA Creation & Verification', status: 'Implemented in Mock Sandbox', readyForProduction: true },
            { milestone: 'M2', name: 'Health Information Provider (HIP) Record Discovery & Linking', status: 'Implemented in Mock Sandbox', readyForProduction: true },
            { milestone: 'M3', name: 'Health Information User (HIU) Consent & Data Flow', status: 'Implemented in Mock Sandbox', readyForProduction: true }
          ],
          productionConfigRequirements: {
            clientId: 'Set ABDM_CLIENT_ID from ABDM Developer Portal (https://dev.abdm.gov.in)',
            clientSecret: 'Set ABDM_CLIENT_SECRET generated upon API enrollment',
            gatewayUrl: 'https://gateway.abdm.gov.in for production (or https://dev.abdm.gov.in for sandbox)',
            bridgeId: 'Bridge URL callback endpoints for data push / pull encrypted with Diffie-Hellman key exchange'
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
