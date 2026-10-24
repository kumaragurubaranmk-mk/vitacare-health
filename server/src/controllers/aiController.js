import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { aiService } from '../services/aiService.js';
import { AgenticCopilotService } from '../services/agenticCopilotService.js';
import { getAuthorizedProfile } from '../middleware/profileAuth.js';

export class AIController {
  /**
   * List conversations for user (by module_type: 'assistant' or 'symptom_checker')
   */
  static getConversations(req, res, next) {
    try {
      const { module_type = 'assistant', search } = req.query;
      let query = `
        SELECT c.*, 
          (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
        FROM conversations c
        WHERE c.user_id = ? AND c.module_type = ?
      `;
      const params = [req.user.id, module_type];

      if (search && search.trim() !== '') {
        query += ` AND c.title LIKE ?`;
        params.push(`%${search.trim()}%`);
      }

      query += ` ORDER BY c.updated_at DESC`;

      const conversations = db.prepare(query).all(...params);
      res.status(200).json({ conversations });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create a new conversation
   */
  static createConversation(req, res, next) {
    try {
      const { title, language = 'en', module_type = 'assistant' } = req.body;
      const id = uuidv4();
      const cleanTitle = title?.trim() || (module_type === 'symptom_checker' ? 'New Symptom Assessment' : 'New Health Conversation');

      db.prepare(`
        INSERT INTO conversations (id, user_id, title, language, module_type)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, req.user.id, cleanTitle, language, module_type);

      const conversation = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id);
      res.status(201).json({ conversation });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get all messages for a specific conversation
   */
  static getConversationMessages(req, res, next) {
    try {
      const { conversationId } = req.params;

      // Verify conversation ownership
      const conversation = db.prepare(`SELECT * FROM conversations WHERE id = ? AND user_id = ?`).get(conversationId, req.user.id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found or access denied.' });
      }

      const messages = db.prepare(`
        SELECT * FROM messages 
        WHERE conversation_id = ? 
        ORDER BY created_at ASC
      `).all(conversationId);

      // Parse structured_data JSON if present
      const formatted = messages.map(msg => ({
        ...msg,
        structured_data: msg.structured_data ? JSON.parse(msg.structured_data) : null
      }));

      res.status(200).json({ conversation, messages: formatted });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Send a message and generate structured AI response
   */
  static async sendMessage(req, res, next) {
    try {
      const { conversationId } = req.params;
      const { content, language, apiKey, provider } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Message content cannot be empty.' });
      }

      // Verify ownership
      const conversation = db.prepare(`SELECT * FROM conversations WHERE id = ? AND user_id = ?`).get(conversationId, req.user.id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }

      const selectedLanguage = language || conversation.language || 'en';

      // 1. Save user message
      const userMsgId = uuidv4();
      db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content)
        VALUES (?, ?, 'user', ?)
      `).run(userMsgId, conversationId, content.trim());

      // Update conversation title if first user message
      const msgCount = db.prepare('SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?').get(conversationId);
      if (msgCount.count <= 2) {
        const shortTitle = content.trim().slice(0, 45) + (content.length > 45 ? '...' : '');
        db.prepare('UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(shortTitle, conversationId);
      } else {
        db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId);
      }

      // Retrieve user's authorized clinical context: profile, active medications, recent reports, biomarkers
      const healthProfile = db.prepare(`
        SELECT blood_group, allergies, existing_conditions, current_medications, dietary_preferences 
        FROM health_profiles WHERE user_id = ?
      `).get(req.user.id) || {};

      const activeMeds = db.prepare(`
        SELECT medicine_name, dosage, frequency, reminder_time, notes 
        FROM medication_reminders 
        WHERE user_id = ? AND status = 'active'
      `).all(req.user.id);

      const recentReports = db.prepare(`
        SELECT title, report_type, report_date, ai_summary 
        FROM medical_reports 
        WHERE user_id = ? 
        ORDER BY report_date DESC LIMIT 3
      `).all(req.user.id);

      const recentBiomarkers = db.prepare(`
        SELECT biomarker_name, value, unit, status, reference_range, recorded_date 
        FROM report_biomarkers 
        WHERE user_id = ? 
        ORDER BY recorded_date DESC LIMIT 8
      `).all(req.user.id);

      const recentMetrics = db.prepare(`
        SELECT metric_type, metric_value, secondary_value, unit, recorded_at 
        FROM health_metrics 
        WHERE user_id = ? 
        ORDER BY recorded_at DESC LIMIT 15
      `).all(req.user.id);

      const combinedHealthContext = {
        profile: healthProfile,
        activeMedications: activeMeds,
        recentReports: recentReports,
        recentBiomarkers: recentBiomarkers,
        recentMetrics: recentMetrics
      };

      // 2. Process with AI Service
      const aiResult = await aiService.processHealthQuery({
        message: content.trim(),
        language: selectedLanguage,
        moduleType: conversation.module_type,
        healthContext: combinedHealthContext,
        apiKey,
        provider
      });

      // 3. Format structured payload
      const structuredPayload = aiResult.data || {};
      const assistantText = aiResult.reply || structuredPayload.formattedResponse || structuredPayload.summary || "Here is safe, patient-friendly guidance regarding your health inquiry.";
      const assistantMsgId = uuidv4();

      db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, structured_data, is_emergency)
        VALUES (?, ?, 'assistant', ?, ?, ?)
      `).run(
        assistantMsgId,
        conversationId,
        assistantText,
        JSON.stringify(structuredPayload),
        aiResult.isEmergency ? 1 : 0
      );

      const userMsg = db.prepare(`SELECT * FROM messages WHERE id = ?`).get(userMsgId);
      const assistantMsg = {
        id: assistantMsgId,
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantText,
        structured_data: structuredPayload,
        is_emergency: aiResult.isEmergency ? 1 : 0,
        created_at: new Date().toISOString()
      };

      res.status(200).json({
        userMessage: userMsg,
        assistantMessage: assistantMsg
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Quick chat entrypoint for AI Assistant
   */
  static async quickChat(req, res, next) {
    try {
      const { message, conversation_id, language = 'en', module_type = 'assistant', apiKey, provider, profile_id } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message content cannot be empty.' });
      }

      const userId = req.user?.id || 'test-patient-a-001';

      // Check profile authorization
      const requestedProfileId = profile_id || req.headers['x-profile-id'] || null;
      const auth = getAuthorizedProfile(userId, requestedProfileId);
      if (!auth.authorized) {
        return res.status(auth.status || 403).json({ error: auth.reason });
      }
      const effectiveProfileId = auth.profileId;

      let convId = conversation_id;
      let conversation = null;

      if (convId && convId !== 'conv-default') {
        conversation = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(convId, userId);
      }

      if (!conversation) {
        convId = uuidv4();
        const shortTitle = message.trim().slice(0, 40) + (message.trim().length > 40 ? '...' : '');
        db.prepare(`
          INSERT INTO conversations (id, user_id, profile_id, title, language, module_type)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(convId, userId, effectiveProfileId, shortTitle, language, module_type);
        conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
      }

      // 1. Save user message
      const userMsgId = uuidv4();
      db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content)
        VALUES (?, ?, 'user', ?)
      `).run(userMsgId, convId, message.trim());

      db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(convId);

      // Check for Agentic Copilot tool-calling workflows
      const lower = message.trim().toLowerCase();
      const isAgenticQuery = lower.includes('change') || lower.includes('report') || lower.includes('remind') ||
                            lower.includes('schedule') || lower.includes('medicine') || lower.includes('medication') ||
                            lower.includes('trend') || lower.includes('compare') || lower.includes('glucose') ||
                            lower.includes('blood sugar') || lower.includes('bp') || lower.includes('cholesterol') ||
                            lower.includes('மாற்றங்கள்') || lower.includes('அறிக்கை') || lower.includes('மருந்து') ||
                            lower.includes('మార్పులు') || lower.includes('నివేదిక') || lower.includes('మందు') ||
                            lower.includes('बदलाव') || lower.includes('रिपोर्ट') || lower.includes('दवा');

      if (isAgenticQuery) {
        const agenticRes = await AgenticCopilotService.processAgenticQuery({
          userId,
          profileId: effectiveProfileId,
          message: message.trim(),
          language
        });

        if (agenticRes && agenticRes.executedTools?.length > 0) {
          const assistantText = agenticRes.reply;
          const assistantMsgId = uuidv4();

          db.prepare(`
            INSERT INTO messages (id, conversation_id, role, content, structured_data, is_emergency)
            VALUES (?, ?, 'assistant', ?, ?, 0)
          `).run(
            assistantMsgId,
            convId,
            assistantText,
            JSON.stringify(agenticRes.data || {})
          );

          return res.status(200).json({
            reply: assistantText,
            message: assistantText,
            language,
            conversation_id: convId,
            executedTools: agenticRes.executedTools,
            requires_confirmation: Boolean(agenticRes.requiresConfirmation),
            stagedAction: agenticRes.stagedAction || null,
            structured_data: agenticRes.data || null,
            used_stored_records: true,
            provider_used: 'agentic-copilot',
            profileId: effectiveProfileId,
            profileName: auth.profile?.name || 'Self'
          });
        }
      }

      // 2. Retrieve user's authorized health profile, medications, reports
      const healthProfile = db.prepare(`
        SELECT blood_group, allergies, existing_conditions, current_medications, dietary_preferences 
        FROM health_profiles WHERE user_id = ?
      `).get(userId) || {};

      const activeMeds = db.prepare(`
        SELECT medicine_name, dosage, frequency, reminder_time, notes 
        FROM medication_reminders 
        WHERE user_id = ? AND status = 'active'
      `).all(userId);

      const recentReports = db.prepare(`
        SELECT title, report_type, report_date, ai_summary 
        FROM medical_reports 
        WHERE user_id = ? 
        ORDER BY report_date DESC LIMIT 3
      `).all(userId);

      const recentBiomarkers = db.prepare(`
        SELECT biomarker_name, value, unit, status, reference_range, recorded_date 
        FROM report_biomarkers 
        WHERE user_id = ? 
        ORDER BY recorded_date DESC LIMIT 8
      `).all(userId);

      const recentMetrics = db.prepare(`
        SELECT metric_type, metric_value, secondary_value, unit, recorded_at 
        FROM health_metrics 
        WHERE user_id = ? 
        ORDER BY recorded_at DESC LIMIT 15
      `).all(userId);

      const combinedHealthContext = {
        profile: healthProfile,
        activeMedications: activeMeds,
        recentReports: recentReports,
        recentBiomarkers: recentBiomarkers,
        recentMetrics: recentMetrics
      };

      // 3. Process with upgraded AI Service
      const aiResult = await aiService.processHealthQuery({
        message: message.trim(),
        language,
        moduleType: module_type,
        healthContext: combinedHealthContext,
        apiKey,
        provider
      });

      const structuredPayload = aiResult.data || {};
      const assistantText = aiResult.reply || structuredPayload.formattedResponse || structuredPayload.summary || "Here is safe, patient-friendly guidance regarding your health inquiry.";
      const assistantMsgId = uuidv4();

      db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, structured_data, is_emergency)
        VALUES (?, ?, 'assistant', ?, ?, ?)
      `).run(
        assistantMsgId,
        convId,
        assistantText,
        JSON.stringify(structuredPayload),
        aiResult.isEmergency ? 1 : 0
      );

      res.status(200).json({
        reply: assistantText,
        message: assistantText,
        directAnswer: structuredPayload.directAnswer || null,
        briefExplanation: structuredPayload.briefExplanation || null,
        practicalNextStep: structuredPayload.practicalNextStep || null,
        language: language || 'en',
        conversation_id: convId,
        structured_data: structuredPayload,
        is_emergency: Boolean(aiResult.isEmergency),
        emergency_details: aiResult.isEmergency ? structuredPayload : null,
        used_stored_records: Boolean(aiResult.usedStoredRecords),
        provider_used: aiResult.providerUsed || 'builtin'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get current AI Configuration status
   */
  static getConfig(req, res, next) {
    try {
      res.status(200).json({
        activeProvider: aiService.provider,
        hasGeminiKey: Boolean(aiService.geminiKey),
        hasOpenaiKey: Boolean(aiService.openaiKey),
        defaultEngine: 'Intelligent Clinical Knowledge Engine (100% Offline Ready)'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Set AI Provider & API Key
   */
  static setConfig(req, res, next) {
    try {
      const { provider, apiKey } = req.body;
      if (provider) {
        aiService.setProvider(provider, apiKey || '');
      }
      res.status(200).json({
        success: true,
        activeProvider: aiService.provider,
        hasGeminiKey: Boolean(aiService.geminiKey),
        hasOpenaiKey: Boolean(aiService.openaiKey),
        message: 'AI configuration updated successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Clear all messages in a conversation
   */
  static clearConversation(req, res, next) {
    try {
      const { conversationId } = req.params;
      const conversation = db.prepare(`SELECT id FROM conversations WHERE id = ? AND user_id = ?`).get(conversationId, req.user.id);
      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }

      db.prepare(`DELETE FROM messages WHERE conversation_id = ?`).run(conversationId);
      db.prepare(`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(conversationId);

      res.status(200).json({ message: 'Conversation cleared.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete conversation entirely
   */
  static deleteConversation(req, res, next) {
    try {
      const { conversationId } = req.params;
      db.prepare(`DELETE FROM messages WHERE conversation_id = ?`).run(conversationId);
      const result = db.prepare(`DELETE FROM conversations WHERE id = ? AND user_id = ?`).run(conversationId, req.user.id);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Conversation not found.' });
      }

      res.status(200).json({ message: 'Conversation deleted.' });
    } catch (err) {
      next(err);
    }
  }
}
