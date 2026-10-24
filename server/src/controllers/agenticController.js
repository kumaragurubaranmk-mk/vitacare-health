import { AgenticCopilotService, ALLOWLISTED_TOOLS } from '../services/agenticCopilotService.js';
import { db } from '../database/db.js';
import { getAuthorizedProfile } from '../middleware/profileAuth.js';

export class AgenticController {
  /**
   * Main Agentic query entrypoint
   */
  static async processQuery(req, res, next) {
    try {
      const { message, language = 'en', profile_id = null } = req.body;
      const userId = req.user?.id || 'guest-patient-default';

      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message cannot be empty.' });
      }

      // Check profile authorization
      const auth = getAuthorizedProfile(userId, profile_id);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ error: auth.reason });
      }

      const result = await AgenticCopilotService.processAgenticQuery({
        userId,
        profileId: auth.profileId,
        message: message.trim(),
        language
      });

      res.status(200).json({
        reply: result.reply,
        message: result.reply,
        executedTools: result.executedTools,
        requiresConfirmation: Boolean(result.requiresConfirmation),
        stagedAction: result.stagedAction || null,
        data: result.data || null,
        profileId: auth.profileId,
        profileName: auth.profile.name,
        isGrounded: true
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Execute or reject a confirmed staged action
   */
  static async confirmAction(req, res, next) {
    try {
      const { actionId, confirmed } = req.body;
      const userId = req.user?.id;

      if (!actionId) {
        return res.status(400).json({ error: 'Action ID is required.' });
      }

      const result = await AgenticCopilotService.executeStagedAction({
        userId,
        actionId,
        confirmed: Boolean(confirmed)
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get allowlisted agentic tools and security descriptions
   */
  static getTools(req, res, next) {
    try {
      const toolsMetadata = [
        {
          name: 'retrieve_health_records',
          description: 'Retrieve authorized health records, lab reports, and biomarkers for the active profile.',
          requiresConfirmation: false,
          securityScope: 'profile_isolated'
        },
        {
          name: 'summarize_medical_info',
          description: 'Summarize clinical overview, conditions, allergies, and vitals for active profile.',
          requiresConfirmation: false,
          securityScope: 'profile_isolated'
        },
        {
          name: 'compare_measurements',
          description: 'Compare historical measurements across dates to calculate trend, delta, and percentage change.',
          requiresConfirmation: false,
          securityScope: 'profile_isolated'
        },
        {
          name: 'check_medicine_schedules',
          description: 'Check active medication schedules, dosage times, and today verification status.',
          requiresConfirmation: false,
          securityScope: 'profile_isolated'
        },
        {
          name: 'prepare_medication_reminder',
          description: 'Stages a medication reminder schedule for patient confirmation (does not modify records directly).',
          requiresConfirmation: true,
          securityScope: 'confirmation_required'
        },
        {
          name: 'execute_staged_action',
          description: 'Executes or cancels a staged action after explicit patient confirmation.',
          requiresConfirmation: true,
          securityScope: 'audit_logged'
        },
        {
          name: 'check_report_changes',
          description: 'Factual comparison between user recent health reports with grounded explanation of changes.',
          requiresConfirmation: false,
          securityScope: 'profile_isolated'
        }
      ];

      res.status(200).json({
        allowlistedTools: ALLOWLISTED_TOOLS,
        tools: toolsMetadata,
        safetyGuarantee: 'Strict allowlist enforcement with profile isolation and explicit user confirmation for sensitive data modifications.'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get audit logs for tool executions
   */
  static getLogs(req, res, next) {
    try {
      const userId = req.user?.id;
      const requestedProfileId = req.query.profile_id || null;

      const auth = getAuthorizedProfile(userId, requestedProfileId);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ error: auth.reason });
      }

      const logs = db.prepare(`
        SELECT * FROM agentic_tool_logs 
        WHERE user_id = ? AND (profile_id = ? OR (profile_id IS NULL AND ? = 'self'))
        ORDER BY created_at DESC LIMIT 25
      `).all(userId, auth.profileId, auth.profile.profile_type || 'self');

      const parsedLogs = logs.map(l => ({
        ...l,
        parameters: l.parameters ? JSON.parse(l.parameters) : {}
      }));

      res.status(200).json({ logs: parsedLogs });
    } catch (err) {
      next(err);
    }
  }
}
