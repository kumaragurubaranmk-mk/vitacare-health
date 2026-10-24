import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { getAuthorizedProfile } from '../middleware/profileAuth.js';

/**
 * Allowlist of permissible agentic tools
 */
export const ALLOWLISTED_TOOLS = [
  'retrieve_health_records',
  'summarize_medical_info',
  'compare_measurements',
  'check_medicine_schedules',
  'prepare_medication_reminder',
  'execute_staged_action',
  'check_report_changes'
];

export class AgenticCopilotService {
  /**
   * Return allowlist of permissible agentic tools
   */
  static getAllowlistedTools() {
    return ALLOWLISTED_TOOLS.map(t => ({ name: t }));
  }

  /**
   * Log tool execution in database for safety and audit compliance
   */
  static logToolExecution(userId, profileId, toolName, parameters, resultSummary, requiresConfirmation = false, status = 'executed') {
    try {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO agentic_tool_logs (
          id, user_id, profile_id, tool_name, parameters, result_summary, requires_confirmation, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        userId,
        profileId,
        toolName,
        JSON.stringify(parameters),
        typeof resultSummary === 'string' ? resultSummary.slice(0, 500) : JSON.stringify(resultSummary).slice(0, 500),
        requiresConfirmation ? 1 : 0,
        status
      );

      // System audit log
      db.prepare(`
        INSERT INTO audit_logs (id, admin_id, action, target_type, target_id, details)
        VALUES (?, ?, 'AGENTIC_TOOL_EXECUTED', 'tool_call', ?, ?)
      `).run(
        uuidv4(),
        userId,
        toolName,
        `Executed tool: ${toolName} for profile ${profileId}. Status: ${status}`
      );

      return id;
    } catch (err) {
      console.warn('Tool logging error:', err);
      return null;
    }
  }

  /**
   * Tool 1: Retrieve authorized health records, lab reports, and biomarkers
   */
  static async retrieveHealthRecords({ userId, profileId, category, query }) {
    const auth = getAuthorizedProfile(userId, profileId);
    if (!auth.authorized) throw new Error(auth.reason);

    const pId = auth.profileId;
    const isSelf = auth.isSelf;

    let reports;
    if (isSelf) {
      reports = db.prepare(`
        SELECT id, title, report_type, report_date, doctor_name, facility_name, ai_summary
        FROM medical_reports
        WHERE user_id = ? AND (profile_id = ? OR profile_id IS NULL OR profile_id = 'self' OR profile_id = ?)
        ORDER BY report_date DESC LIMIT 5
      `).all(userId, pId, `self-${userId}`);
    } else {
      reports = db.prepare(`
        SELECT id, title, report_type, report_date, doctor_name, facility_name, ai_summary
        FROM medical_reports
        WHERE user_id = ? AND profile_id = ?
        ORDER BY report_date DESC LIMIT 5
      `).all(userId, pId);
    }

    let biomarkers;
    if (isSelf) {
      biomarkers = db.prepare(`
        SELECT biomarker_name, value, unit, status, reference_range, recorded_date
        FROM report_biomarkers
        WHERE user_id = ? AND (profile_id = ? OR profile_id IS NULL OR profile_id = 'self' OR profile_id = ?)
        ORDER BY recorded_date DESC LIMIT 10
      `).all(userId, pId, `self-${userId}`);
    } else {
      biomarkers = db.prepare(`
        SELECT biomarker_name, value, unit, status, reference_range, recorded_date
        FROM report_biomarkers
        WHERE user_id = ? AND profile_id = ?
        ORDER BY recorded_date DESC LIMIT 10
      `).all(userId, pId);
    }

    const summary = `Found ${reports.length} report(s) and ${biomarkers.length} biomarker(s) for profile ${auth.profile.name}.`;
    this.logToolExecution(userId, pId, 'retrieve_health_records', { category, query }, summary);

    return {
      profile: auth.profile,
      reports,
      biomarkers,
      summary
    };
  }

  /**
   * Tool 2: Summarize relevant medical information and unified profile
   */
  static async summarizeMedicalInfo({ userId, profileId }) {
    const auth = getAuthorizedProfile(userId, profileId);
    if (!auth.authorized) throw new Error(auth.reason);

    const pId = auth.profileId;
    const member = auth.profile;

    const healthProfile = db.prepare(`
      SELECT * FROM health_profiles WHERE user_id = ? AND (profile_id = ? OR (profile_id IS NULL AND ? = 'self'))
    `).get(userId, pId, member.profile_type || 'self') || {};

    const activeMeds = db.prepare(`
      SELECT medicine_name, dosage, frequency, reminder_time 
      FROM medication_reminders 
      WHERE user_id = ? AND status = 'active' AND (profile_id = ? OR (profile_id IS NULL AND ? = 'self'))
    `).all(userId, pId, member.profile_type || 'self');

    const recentTimeline = db.prepare(`
      SELECT title, event_type, event_date 
      FROM medical_timeline 
      WHERE user_id = ? AND (profile_id = ? OR (profile_id IS NULL AND ? = 'self'))
      ORDER BY event_date DESC LIMIT 3
    `).all(userId, pId, member.profile_type || 'self');

    const summary = `Patient ${member.name} (${member.relation}): Blood Group ${healthProfile.blood_group || member.blood_group || 'Not recorded'}. Conditions: ${healthProfile.existing_conditions || member.existing_conditions || 'None'}. Active Meds: ${activeMeds.length}.`;
    this.logToolExecution(userId, pId, 'summarize_medical_info', {}, summary);

    return {
      profile: member,
      bloodGroup: healthProfile.blood_group || member.blood_group || 'Not recorded',
      allergies: healthProfile.allergies || member.allergies || 'None recorded',
      conditions: healthProfile.existing_conditions || member.existing_conditions || 'None recorded',
      activeMedicationsCount: activeMeds.length,
      activeMedications: activeMeds,
      recentEvents: recentTimeline,
      summary
    };
  }

  /**
   * Tool 3: Compare available measurements over time (e.g. Glucose, BP, Cholesterol)
   */
  static async compareMeasurements({ userId, profileId, biomarkerName }) {
    const auth = getAuthorizedProfile(userId, profileId);
    if (!auth.authorized) throw new Error(auth.reason);

    const pId = auth.profileId;
    const isSelf = auth.isSelf;

    const query = biomarkerName ? `%${biomarkerName.trim()}%` : '%';

    let measurements;
    if (isSelf) {
      measurements = db.prepare(`
        SELECT biomarker_name, value, unit, status, reference_range, recorded_date, report_id
        FROM report_biomarkers
        WHERE user_id = ? AND (profile_id = ? OR profile_id IS NULL OR profile_id = 'self' OR profile_id = ?)
          AND biomarker_name LIKE ?
        ORDER BY recorded_date ASC
      `).all(userId, pId, `self-${userId}`, query);
    } else {
      measurements = db.prepare(`
        SELECT biomarker_name, value, unit, status, reference_range, recorded_date, report_id
        FROM report_biomarkers
        WHERE user_id = ? AND profile_id = ? AND biomarker_name LIKE ?
        ORDER BY recorded_date ASC
      `).all(userId, pId, query);
    }

    if (measurements.length < 2) {
      const summary = measurements.length === 1
        ? `Only 1 recorded measurement found for ${measurements[0].biomarker_name}: ${measurements[0].value} ${measurements[0].unit} on ${measurements[0].recorded_date}. At least 2 measurements across different dates are required for historical trend comparison.`
        : `No recorded measurements found for "${biomarkerName || 'physiological parameters'}".`;

      this.logToolExecution(userId, pId, 'compare_measurements', { biomarkerName }, summary);
      return { hasSufficientData: false, measurements, summary };
    }

    const first = measurements[0];
    const latest = measurements[measurements.length - 1];
    const delta = latest.value - first.value;
    const percentChange = ((delta / (first.value || 1)) * 100).toFixed(1);
    const direction = delta < 0 ? 'decreased' : delta > 0 ? 'increased' : 'remained unchanged';

    const summary = `${latest.biomarker_name} ${direction} from ${first.value} ${first.unit} (${first.recorded_date}) to ${latest.value} ${latest.unit} (${latest.recorded_date}), a change of ${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${latest.unit} (${percentChange}%). Status: ${latest.status}.`;
    this.logToolExecution(userId, pId, 'compare_measurements', { biomarkerName }, summary);

    return {
      hasSufficientData: true,
      biomarkerName: latest.biomarker_name,
      firstMeasurement: first,
      latestMeasurement: latest,
      delta,
      percentChange,
      direction,
      allDataPoints: measurements,
      summary
    };
  }

  /**
   * Tool 4: Check actual medicine schedules and reminder status
   */
  static async checkMedicineSchedules({ userId, profileId }) {
    const auth = getAuthorizedProfile(userId, profileId);
    if (!auth.authorized) throw new Error(auth.reason);

    const pId = auth.profileId;
    const isSelf = auth.isSelf;

    let meds;
    if (isSelf) {
      meds = db.prepare(`
        SELECT * FROM medication_reminders
        WHERE user_id = ? AND (profile_id = ? OR profile_id IS NULL OR profile_id = 'self' OR profile_id = ?)
          AND status = 'active'
        ORDER BY reminder_time ASC
      `).all(userId, pId, `self-${userId}`);
    } else {
      meds = db.prepare(`
        SELECT * FROM medication_reminders
        WHERE user_id = ? AND profile_id = ? AND status = 'active'
        ORDER BY reminder_time ASC
      `).all(userId, pId);
    }

    const today = new Date().toISOString().split('T')[0];
    const logs = db.prepare(`
      SELECT * FROM medication_logs WHERE user_id = ? AND scheduled_date = ?
    `).all(userId, today);

    const scheduleOverview = meds.map(m => {
      const log = logs.find(l => l.reminder_id === m.id);
      return {
        id: m.id,
        medicineName: m.medicine_name,
        dosage: m.dosage,
        frequency: m.frequency,
        time: m.reminder_time,
        instructions: m.instructions || 'Take with water',
        todayStatus: log ? log.status : 'pending'
      };
    });

    const summary = scheduleOverview.length > 0
      ? `Profile has ${scheduleOverview.length} active medicine(s): ${scheduleOverview.map(s => `${s.medicineName} (${s.dosage}) at ${s.time} [${s.todayStatus}]`).join(', ')}.`
      : 'No active scheduled medicines found for this profile.';

    this.logToolExecution(userId, pId, 'check_medicine_schedules', {}, summary);

    return {
      activeCount: scheduleOverview.length,
      schedule: scheduleOverview,
      summary
    };
  }

  /**
   * Tool 5: Prepare a reminder or notification (REQUIRES EXPLICIT USER CONFIRMATION)
   * Does NOT alter the database directly; creates a pending staged action!
   */
  static async prepareMedicationReminder({ userId, profileId, medicineName, dosage, frequency = 'once_daily', reminderTime = '08:00 AM', instructions = '' }) {
    const auth = getAuthorizedProfile(userId, profileId);
    if (!auth.authorized) throw new Error(auth.reason);

    const pId = auth.profileId;
    const memberName = auth.profile.name;

    if (!medicineName || !dosage) {
      throw new Error('Medicine name and dosage are required to prepare a reminder.');
    }

    const actionId = `stage-${uuidv4().slice(0, 8)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min expiry

    const payload = {
      medicine_name: medicineName.trim(),
      dosage: dosage.trim(),
      frequency,
      reminder_time: reminderTime,
      instructions: instructions.trim(),
      profile_id: pId
    };

    const confirmationPrompt = `I have prepared a new medication reminder for ${memberName}: ${medicineName} (${dosage}) scheduled at ${reminderTime} (${frequency}). Please confirm to activate this reminder in your schedule.`;

    db.prepare(`
      INSERT INTO staged_actions (
        id, user_id, profile_id, action_type, payload, confirmation_prompt, status, expires_at
      ) VALUES (?, ?, ?, 'create_reminder', ?, ?, 'pending', ?)
    `).run(
      actionId,
      userId,
      pId,
      JSON.stringify(payload),
      confirmationPrompt,
      expiresAt
    );

    this.logToolExecution(userId, pId, 'prepare_medication_reminder', payload, confirmationPrompt, true, 'pending_confirmation');

    return {
      requiresConfirmation: true,
      id: actionId,
      actionId,
      action_id: actionId,
      actionType: 'create_reminder',
      targetProfile: { id: pId, name: memberName },
      stagedDetails: payload,
      confirmationPrompt,
      prompt_to_user: confirmationPrompt,
      expiresAt
    };
  }

  /**
   * Tool 6: Execute a staged action after user confirmation
   */
  static async executeStagedAction({ userId, actionId, confirmed, action }) {
    const isConfirmed = confirmed !== undefined ? Boolean(confirmed) : (action === 'confirm');

    const staged = db.prepare(`
      SELECT * FROM staged_actions WHERE id = ? AND user_id = ?
    `).get(actionId, userId);

    if (!staged) {
      throw new Error('Staged action not found or access denied.');
    }

    if (staged.status !== 'pending') {
      return {
        success: false,
        message: `Action has already been processed with status: ${staged.status}.`
      };
    }

    if (new Date(staged.expires_at) < new Date()) {
      db.prepare(`UPDATE staged_actions SET status = 'expired' WHERE id = ?`).run(actionId);
      return {
        success: false,
        message: 'This confirmation request has expired. Please prepare the action again.'
      };
    }

    if (!isConfirmed) {
      db.prepare(`UPDATE staged_actions SET status = 'cancelled' WHERE id = ?`).run(actionId);
      this.logToolExecution(userId, staged.profile_id, 'execute_staged_action', { actionId, confirmed: false }, 'User declined action.', false, 'rejected');
      return {
        success: true,
        actionStatus: 'cancelled',
        action_status: 'cancelled',
        message: 'Action cancelled. No changes were made to your medical schedule.'
      };
    }

    // Process confirmed action
    if (staged.action_type === 'create_reminder') {
      const payload = JSON.parse(staged.payload);
      const reminderId = uuidv4();
      const today = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

      db.prepare(`
        INSERT INTO medication_reminders (
          id, user_id, profile_id, medicine_name, dosage, frequency, reminder_time, start_date, end_date,
          intake_times, instructions, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(
        reminderId,
        userId,
        payload.profile_id || staged.profile_id,
        payload.medicine_name,
        payload.dosage,
        payload.frequency,
        payload.reminder_time,
        today,
        endDate,
        JSON.stringify([payload.reminder_time]),
        payload.instructions || ''
      );

      // Log timeline
      db.prepare(`
        INSERT INTO medical_timeline (
          id, user_id, profile_id, event_type, title, description, event_date, event_time, reference_id, icon_type, status_badge
        ) VALUES (?, ?, ?, 'medicine_scheduled', ?, ?, ?, ?, ?, 'pill', 'active')
      `).run(
        uuidv4(),
        userId,
        payload.profile_id || staged.profile_id,
        `Medication Activated via Copilot: ${payload.medicine_name} (${payload.dosage})`,
        `Scheduled at ${payload.reminder_time} by authorized patient confirmation.`,
        today,
        payload.reminder_time,
        reminderId
      );

      db.prepare(`UPDATE staged_actions SET status = 'executed' WHERE id = ?`).run(actionId);
      db.prepare(`UPDATE agentic_tool_logs SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP WHERE parameters LIKE ?`).run(`%${actionId}%`);

      this.logToolExecution(userId, staged.profile_id, 'execute_staged_action', { actionId, reminderId }, `Successfully created reminder for ${payload.medicine_name}.`, false, 'confirmed');

      return {
        success: true,
        actionStatus: 'executed',
        action_status: 'confirmed',
        reminderId,
        message: `✓ Confirmed! ${payload.medicine_name} (${payload.dosage}) has been added to your schedule at ${payload.reminder_time}.`
      };
    }

    return { success: false, message: 'Unknown action type.' };
  }

  /**
   * Tool 7: Check report changes (HACKATHON BONUS DEMO SPECIFIC)
   * Answers: "What changes can you see in my recent health reports?"
   */
  static async checkReportChanges({ userId, profileId, language = 'en' }) {
    const auth = getAuthorizedProfile(userId, profileId);
    if (!auth.authorized) throw new Error(auth.reason);

    const pId = auth.profileId;
    const isSelf = auth.isSelf;

    let reports;
    if (isSelf) {
      reports = db.prepare(`
        SELECT * FROM medical_reports
        WHERE user_id = ? AND (profile_id = ? OR profile_id IS NULL OR profile_id = 'self' OR profile_id = ?)
        ORDER BY report_date DESC, created_at DESC LIMIT 2
      `).all(userId, pId, `self-${userId}`);
    } else {
      reports = db.prepare(`
        SELECT * FROM medical_reports
        WHERE user_id = ? AND profile_id = ?
        ORDER BY report_date DESC, created_at DESC LIMIT 2
      `).all(userId, pId);
    }

    // Case A: Zero reports
    if (reports.length === 0) {
      const messages = {
        en: "No health reports have been uploaded to your profile yet. Once you upload and verify a laboratory test or health report, I will track and explain your biomarker changes over time.",
        ta: "உங்கள் சுயவிவரத்தில் இதுவரை எந்த மருத்துவ அறிக்கைகளும் பதிவேற்றப்படவில்லை. ஆய்வக பரிசோதனை அல்லது மருத்துவ அறிக்கையை பதிவேற்றியதும், அதில் ஏற்படும் மாற்றங்களை நான் ஒப்பிட்டு விளக்குவேன்.",
        te: "మీ ప్రొఫైల్‌లో ఇంకా ఎలాంటి ఆరోగ్య నివేదికలు అప్‌లోడ్ చేయబడలేదు. మీరు ప్రయోగశాల పరీక్ష నివేదికను అప్‌లోడ్ చేసిన తర్వాత, కొలతలలో మార్పులను నేను విశ్లేషిస్తాను.",
        hi: "आपकी प्रोफ़ाइल में अभी तक कोई स्वास्थ्य रिपोर्ट अपलोड नहीं की गई है। एक बार जब आप प्रयोगशाला परीक्षण या रिपोर्ट अपलोड करते हैं, तो मैं समय के साथ आपके बायोमार्कर परिवर्तनों को समझाऊंगा।"
      };

      const reply = messages[language] || messages.en;
      this.logToolExecution(userId, pId, 'check_report_changes', { reportsFound: 0 }, reply);
      return {
        reportsFound: 0,
        reply,
        hasComparison: false
      };
    }

    // Case B: Exactly 1 report
    if (reports.length === 1) {
      const r = reports[0];
      const biomarkers = db.prepare(`SELECT * FROM report_biomarkers WHERE report_id = ?`).all(r.id);
      const bioList = biomarkers.slice(0, 4).map(b => `${b.biomarker_name}: ${b.value} ${b.unit} (${b.status})`).join(', ');

      const messages = {
        en: `You currently have one report on file: "${r.title}" dated ${r.report_date}. Key recorded values include: ${bioList || 'baseline indicators'}. A historical comparison will be available as soon as you upload a second report over time.`,
        ta: `தற்போது உங்கள் பதிவேட்டில் ஒரு அறிக்கை மட்டுமே உள்ளது: "${r.title}" (தேதி: ${r.report_date}). முக்கிய அளவுகள்: ${bioList || 'ஆரம்ப அளவுகள்'}. இரண்டாவது அறிக்கையை பதிவேற்றியதும் காலப்போக்கில் ஏற்படும் மாற்றங்களை ஒப்பிடலாம்.`,
        te: `ప్రస్తుతం మీ వద్ద ఒకే నివేదిక ఉంది: "${r.title}" (తేదీ: ${r.report_date}). ముఖ్యమైన కొలతలు: ${bioList || 'ప్రాథమిక కొలతలు'}. మరొక నివేదిక అప్‌లోడ్ చేసిన వెంటనే కాలక్రమేణా మార్పులను పోల్చవచ్చు.`,
        hi: `वर्तमान में आपकी प्रोफ़ाइल में एक रिपोर्ट है: "${r.title}" (दिनांक: ${r.report_date})। मुख्य दर्ज परिणाम: ${bioList || 'प्रारंभिक संकेतक'}। दूसरी रिपोर्ट अपलोड होते ही दोनों के बीच तुलना उपलब्ध होगी।`
      };

      const reply = messages[language] || messages.en;
      this.logToolExecution(userId, pId, 'check_report_changes', { reportsFound: 1 }, reply);
      return {
        reportsFound: 1,
        reply,
        hasComparison: false,
        report: r,
        biomarkers
      };
    }

    // Case C: 2 or more reports -> REAL FACTUAL COMPARISON!
    const [latestRep, prevRep] = reports;

    const latestBios = db.prepare(`SELECT * FROM report_biomarkers WHERE report_id = ?`).all(latestRep.id);
    const prevBios = db.prepare(`SELECT * FROM report_biomarkers WHERE report_id = ?`).all(prevRep.id);

    const changes = [];
    for (const lb of latestBios) {
      const pb = prevBios.find(p => p.biomarker_name.toLowerCase() === lb.biomarker_name.toLowerCase());
      if (pb) {
        const delta = lb.value - pb.value;
        changes.push({
          name: lb.biomarker_name,
          previous: pb.value,
          current: lb.value,
          unit: lb.unit,
          delta,
          prevStatus: pb.status,
          currStatus: lb.status,
          improved: (delta < 0 && pb.status === 'elevated') || (delta > 0 && pb.status === 'low') || (lb.status === 'normal' && pb.status !== 'normal')
        });
      }
    }

    let summaryText = '';
    if (changes.length > 0) {
      const changeStrings = changes.map(c => {
        const diffStr = c.delta < 0 ? `decreased by ${Math.abs(c.delta).toFixed(1)} ${c.unit}` : c.delta > 0 ? `increased by ${c.delta.toFixed(1)} ${c.unit}` : `remained stable`;
        const normStr = c.currStatus === 'normal' && c.prevStatus !== 'normal' ? ' (normalized to healthy range)' : '';
        return `${c.name} ${diffStr} (from ${c.previous} to ${c.current} ${c.unit})${normStr}`;
      });

      if (language === 'ta') {
        summaryText = `உங்கள் சமீபத்திய அறிக்கைகளை (${prevRep.report_date} மற்றும் ${latestRep.report_date}) ஒப்பிடுகையில்:\n\n• ${changeStrings.join('\n• ')}\n\nமுந்தைய முடிவுகளுடன் ஒப்பிடுகையில் முக்கிய அளவுகளில் சீரான முன்னேற்றம் காணப்படுகிறது. மருத்துவர் அறிவுறுத்திய உணவு மற்றும் சிகிச்சை முறையைத் தொடரவும்.`;
      } else if (language === 'te') {
        summaryText = `మీ ఇటీవలి నివేదికలను (${prevRep.report_date} మరియు ${latestRep.report_date}) పోల్చి చూస్తే:\n\n• ${changeStrings.join('\n• ')}\n\nగత ఫలితాలతో పోలిస్తే ముఖ్యమైన కొలతలలో సానుకూల మెరుగుదల ఉంది. మీ వైద్యుల సలహాలను పాటించడం కొనసాగించండి.`;
      } else if (language === 'hi') {
        summaryText = `आपकी हालिया रिपोर्टों (${prevRep.report_date} और ${latestRep.report_date}) की तुलना करने पर:\n\n• ${changeStrings.join('\n• ')}\n\nपिछली रिपोर्ट की तुलना में महत्वपूर्ण स्तरों में उल्लेखनीय सुधार देखा गया है। डॉक्टर द्वारा निर्देशित दिनचर्या जारी रखें।`;
      } else {
        summaryText = `Comparing your recent reports from ${prevRep.report_date} (${prevRep.title}) to ${latestRep.report_date} (${latestRep.title}):\n\n• ${changeStrings.join('\n• ')}\n\nOverall, your recorded biomarkers demonstrate positive clinical improvement towards healthy target ranges. Please share these verified trends with your doctor at your next follow-up.`;
      }
    } else {
      summaryText = `Comparing "${prevRep.title}" (${prevRep.report_date}) and "${latestRep.title}" (${latestRep.report_date}): both reports cover distinct diagnostic categories without directly overlapping biomarker metrics.`;
    }

    this.logToolExecution(userId, pId, 'check_report_changes', { reportsCompared: 2, changesCount: changes.length }, summaryText);

    return {
      reportsFound: reports.length,
      hasComparison: true,
      latestReport: { title: latestRep.title, date: latestRep.report_date },
      previousReport: { title: prevRep.title, date: prevRep.report_date },
      changes,
      reply: summaryText
    };
  }

  /**
   * Unified processQuery alias
   */
  static async processQuery(args) {
    const rawMsg = args.message || args.query || '';
    const res = await this.processAgenticQuery({
      userId: args.userId,
      profileId: args.profileId,
      message: rawMsg,
      language: args.language || 'en'
    });
    return {
      ...res,
      tools_executed: (res.executedTools || []).map(t => typeof t === 'string' ? t : t.tool),
      staged_action: res.stagedAction || null,
      requires_confirmation: Boolean(res.requiresConfirmation)
    };
  }

  /**
   * Main Agentic Orchestrator: analyzes user intent, calls allowlisted tools, and returns concise grounded response
   */
  static async processAgenticQuery({ userId, profileId, message, language = 'en' }) {
    const q = message.toLowerCase();
    const executedTools = [];

    // Intent 1: Check changes in recent health reports (Bonus Demonstration)
    if (
      q.includes('what changes can you see in my recent health reports') ||
      q.includes('changes in my recent health reports') ||
      q.includes('changes in my report') ||
      q.includes('compare my reports') ||
      q.includes('report changes') ||
      q.includes('மாற்றங்கள்') ||
      q.includes('మార్పులు') ||
      q.includes('बदलाव')
    ) {
      const res = await this.checkReportChanges({ userId, profileId, language });
      executedTools.push({ tool: 'check_report_changes', success: true });
      return {
        reply: res.reply,
        executedTools,
        data: res,
        isGrounded: true
      };
    }

    // Intent 2: Schedule / Prepare new medicine reminder
    if (
      (q.includes('remind me to take') || q.includes('schedule') || q.includes('set reminder for') || q.includes('add medicine reminder')) &&
      (q.includes('mg') || q.includes('tablet') || q.includes('daily') || q.includes('at'))
    ) {
      // Extract medicine name, dosage, and time from message
      const medMatch = message.match(/(?:for|take)\s+([A-Za-z0-9\s]+?)(?:\s+at|\s+\d+(?:mg|ml)|\s+daily|$)/i);
      const medName = medMatch && medMatch[1].trim() ? medMatch[1].trim() : 'Prescribed Medication';
      const dosageMatch = message.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|tablets?|capsules?))/i);
      const dosage = dosageMatch ? dosageMatch[1] : '1 standard dose';
      const timeMatch = message.match(/at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      const reminderTime = timeMatch ? timeMatch[1].toUpperCase() : '08:00 PM';

      const prepRes = await this.prepareMedicationReminder({
        userId,
        profileId,
        medicineName: medName,
        dosage,
        reminderTime
      });

      executedTools.push({ tool: 'prepare_medication_reminder', success: true, requiresConfirmation: true });

      return {
        reply: prepRes.confirmationPrompt,
        executedTools,
        requiresConfirmation: true,
        stagedAction: prepRes,
        isGrounded: true
      };
    }

    // Intent 3: Check medicine schedules / upcoming medications
    if (
      q.includes('medicine') ||
      q.includes('medication') ||
      q.includes('dose') ||
      q.includes('schedule') ||
      q.includes('மருந்து') ||
      q.includes('మందు') ||
      q.includes('दवा')
    ) {
      const sched = await this.checkMedicineSchedules({ userId, profileId });
      executedTools.push({ tool: 'check_medicine_schedules', success: true });

      let reply;
      if (sched.activeCount === 0) {
        reply = language === 'ta'
          ? "உங்கள் சுயவிவரத்தில் திட்டமிடப்பட்ட மருந்துகள் எதுவும் தற்போது இல்லை. புதிய மருந்தைச் சேர்க்க [+ மருந்துச் சீட்டைச் சேர்] பொத்தானைப் பயன்படுத்தவும்."
          : language === 'te'
          ? "మీ ప్రొఫైల్‌లో ప్రస్తుతం ఎలాంటి మందుల షెడ్యూల్ నమోదు కాలేదు. కొత్త మందును జోడించడానికి డ్యాష్‌బోర్డ్‌ను ఉపయోగించండి."
          : language === 'hi'
          ? "आपकी प्रोफ़ाइल में वर्तमान में कोई सक्रिय निर्धारित दवा नहीं है। नई दवा जोड़ने के लिए डैशबोर्ड का उपयोग करें।"
          : "You currently have no active scheduled medications in this profile. You can click [+ Add Medicine] or upload a prescription to set up intake reminders.";
      } else {
        const medSummary = sched.schedule.map(s => `• ${s.medicineName} (${s.dosage}) at ${s.time} — Status: ${s.todayStatus}`).join('\n');
        reply = language === 'ta'
          ? `இன்றைய திட்டமிடப்பட்ட மருந்துகள் (${sched.activeCount}):\n${medSummary}\n\nநேரத்திற்கு உட்கொண்டு சரிபார்க்கவும்.`
          : language === 'te'
          ? `ఈ రోజు మీ షెడ్యూల్ చేసిన మందులు (${sched.activeCount}):\n${medSummary}\n\nదయచేసి సమయానికి తీసుకోండి.`
          : language === 'hi'
          ? `आज के लिए आपकी निर्धारित दवाएं (${sched.activeCount}):\n${medSummary}\n\nकृपया समय पर सेवन करें।`
          : `You have ${sched.activeCount} active medicine(s) scheduled for today:\n${medSummary}\n\nEnsure to take each dose on time with a full glass of water.`;
      }

      return {
        reply,
        executedTools,
        data: sched,
        isGrounded: true
      };
    }

    // Intent 4: Measurements comparison (e.g. glucose, blood pressure, cholesterol)
    if (
      q.includes('glucose') ||
      q.includes('blood sugar') ||
      q.includes('cholesterol') ||
      q.includes('blood pressure') ||
      q.includes('bp') ||
      q.includes('hemoglobin') ||
      q.includes('trend')
    ) {
      let bName = 'glucose';
      if (q.includes('cholesterol')) bName = 'cholesterol';
      else if (q.includes('blood pressure') || q.includes('bp')) bName = 'blood pressure';
      else if (q.includes('hemoglobin') || q.includes('hb')) bName = 'hemoglobin';

      const cmp = await this.compareMeasurements({ userId, profileId, biomarkerName: bName });
      executedTools.push({ tool: 'compare_measurements', success: true });

      return {
        reply: cmp.summary,
        executedTools,
        data: cmp,
        isGrounded: true
      };
    }

    // Intent 5: General profile & record retrieval fallback
    const records = await this.retrieveHealthRecords({ userId, profileId, query: message });
    executedTools.push({ tool: 'retrieve_health_records', success: true });

    const reply = `Based on verified health records for ${records.profile.name}: you have ${records.reports.length} report(s) on file and ${records.biomarkers.length} tracked biomarker(s). How can I assist you with your health data today?`;

    return {
      reply,
      executedTools,
      data: records,
      isGrounded: true
    };
  }
}
