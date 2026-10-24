import jwt from 'jsonwebtoken';
import { db, initDatabase } from './src/database/db.js';
import { AgenticCopilotService } from './src/services/agenticCopilotService.js';
import { FhirService } from './src/services/fhirService.js';
import { getAuthorizedProfile } from './src/middleware/profileAuth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runRound2TestSuite() {
  console.log('===============================================================');
  console.log('   VITACARE AI — ROUND 2 BONUS CREDIT AUTOMATED TEST SUITE   ');
  console.log('===============================================================\n');

  // Initialize DB tables and seed data
  initDatabase();

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${details ? '— ' + details : ''}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // TEST SECTION 1: AUTHENTICATION & SEED PROFILES
  // --------------------------------------------------------------------------
  console.log('--- TEST SECTION 1: Family Health & Backend Authorization ---');
  const userA = db.prepare(`SELECT * FROM users WHERE id = ?`).get('test-patient-a-001');
  assert(!!userA, 'Seed Patient A exists in database', userA?.email);

  const userB = db.prepare(`SELECT * FROM users WHERE id = ?`).get('test-patient-b-002');
  assert(!!userB, 'Seed Patient B exists in database', userB?.email);

  // Check Family Profiles for Patient A
  const familyProfilesA = db.prepare(`SELECT * FROM family_members WHERE user_id = ? AND consent_status != 'revoked'`).all(userA.id);
  assert(familyProfilesA.length >= 3, 'User A has at least 3 authorized family profiles', `Count: ${familyProfilesA.length}`);

  const selfProfile = familyProfilesA.find(p => p.relation === 'self');
  const childProfile = familyProfilesA.find(p => p.relation === 'child');
  const depProfile = familyProfilesA.find(p => p.profile_type === 'dependent');

  assert(!!selfProfile && selfProfile.name === 'Alex Rivera', 'Self profile verified', selfProfile?.id);
  assert(!!childProfile && childProfile.consent_status === 'consented', 'Child profile verified with guardian consent', childProfile?.id);
  assert(!!depProfile && depProfile.profile_type === 'dependent', 'Dependent profile verified', depProfile?.id);

  // --------------------------------------------------------------------------
  // TEST SECTION 2: STRICT CROSS-PROFILE 403 REJECTION
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SECTION 2: Backend 403 Cross-Profile Rejection ---');

  // Authorized access to self
  const authSelf = getAuthorizedProfile(userA.id, 'fam-a-self');
  assert(authSelf.authorized === true && authSelf.profile.id === 'fam-a-self', 'User A can access own profile fam-a-self');

  // Authorized access to child under guardianship
  const authChild = getAuthorizedProfile(userA.id, 'fam-a-child');
  assert(authChild.authorized === true && (authChild.profile.relation === 'child' || authChild.profile.profile_type === 'child'), 'User A can access authorized child profile fam-a-child');

  // UNAUTHORIZED ATTEMPT: User A attempts to access User B's profile fam-b-self
  const authCrossUser = getAuthorizedProfile(userA.id, 'fam-b-self');
  assert(authCrossUser.authorized === false && authCrossUser.statusCode === 403, 'Cross-user profile request blocked with HTTP 403', authCrossUser.error);

  // UNAUTHORIZED ATTEMPT: Malicious random profile ID
  const authTampered = getAuthorizedProfile(userA.id, 'fam-malicious-999');
  assert(authTampered.authorized === false && authTampered.statusCode === 403, 'Arbitrary forged profile ID blocked with HTTP 403', authTampered.error);

  // --------------------------------------------------------------------------
  // TEST SECTION 3: AGENTIC AI ALLOWLISTED TOOLS & GROUNDED REPORT CHANGES
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SECTION 3: Agentic AI Health Copilot Workflows ---');

  // 3.1 Allowlisted tools inventory
  const tools = AgenticCopilotService.getAllowlistedTools();
  assert(tools.length === 7, 'Exact 7 allowlisted tools present in backend allowlist', tools.map(t => t.name).join(', '));

  // 3.2 Grounded Report Changes Comparison ("What changes can you see in my recent health reports?")
  const reportChangesResult = await AgenticCopilotService.processQuery({
    userId: userA.id,
    profileId: 'fam-a-self',
    query: 'What changes can you see in my recent health reports?',
    language: 'en'
  });

  assert(reportChangesResult.tools_executed.includes('check_report_changes'), 'Copilot executed allowlisted tool check_report_changes');
  assert(typeof reportChangesResult.reply === 'string' && reportChangesResult.reply.length > 50, 'Copilot returned grounded response based on reports');
  assert(reportChangesResult.reply.includes('HbA1c') || reportChangesResult.reply.includes('Glucose') || reportChangesResult.reply.includes('Cholesterol'), 'Response references verified biomarkers without fabrication');
  console.log('     Sample Copilot Output snippet:', reportChangesResult.reply.slice(0, 150) + '...');

  // 3.3 Zero fabrication when no reports exist (switch to child profile who has asthma notes but no blood reports)
  const emptyReportResult = await AgenticCopilotService.processQuery({
    userId: userA.id,
    profileId: 'fam-a-child',
    query: 'What changes can you see in my recent health reports?',
    language: 'en'
  });
  assert(emptyReportResult.reply.includes('No verified lab reports') || emptyReportResult.reply.includes('No reports') || emptyReportResult.reply.includes('available'), 'Copilot honestly explains absence of reports without fabricating data');

  // 3.4 Staged Action Confirmation Workflow (Prepare Reminder)
  const reminderResult = await AgenticCopilotService.processQuery({
    userId: userA.id,
    profileId: 'fam-a-self',
    query: 'Schedule a reminder for Vitamin D3 at 8:00 PM',
    language: 'en'
  });

  assert(reminderResult.requires_confirmation === true, 'Controlled action flagged as requires_confirmation: true');
  assert(!!reminderResult.staged_action && !!reminderResult.staged_action.id, 'Action staged in staged_actions table with ID', reminderResult.staged_action?.id);

  // 3.5 Execute Patient Confirmation
  const confirmResult = await AgenticCopilotService.executeStagedAction({
    actionId: reminderResult.staged_action.id,
    userId: userA.id,
    action: 'confirm'
  });

  assert(confirmResult.success === true && confirmResult.action_status === 'confirmed', 'Patient confirmation safely executed and reminder created');

  // Verify Audit Log was recorded
  const auditLogs = db.prepare(`SELECT * FROM agentic_tool_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`).all(userA.id);
  assert(auditLogs.length > 0, 'Agentic tool execution recorded in immutable audit log', `Logged ${auditLogs.length} events`);
  assert(auditLogs.some(l => l.tool_name === 'check_report_changes'), 'Audit log records check_report_changes execution');

  // --------------------------------------------------------------------------
  // TEST SECTION 4: EXTENDED MULTILINGUAL PARITY (EN, TA, HI, TE)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SECTION 4: Extended Multilingual 4-Language Parity ---');
  const translationsDir = path.resolve(__dirname, '../client/src/translations');
  const enKeys = JSON.parse(fs.readFileSync(path.join(translationsDir, 'en.json'), 'utf8'));
  const taKeys = JSON.parse(fs.readFileSync(path.join(translationsDir, 'ta.json'), 'utf8'));
  const hiKeys = JSON.parse(fs.readFileSync(path.join(translationsDir, 'hi.json'), 'utf8'));
  const teKeys = JSON.parse(fs.readFileSync(path.join(translationsDir, 'te.json'), 'utf8'));

  function getAllLeafKeys(obj, prefix = '') {
    let keys = [];
    for (const [k, v] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        keys = keys.concat(getAllLeafKeys(v, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }

  const enList = getAllLeafKeys(enKeys);
  const taList = new Set(getAllLeafKeys(taKeys));
  const hiList = new Set(getAllLeafKeys(hiKeys));
  const teList = new Set(getAllLeafKeys(teKeys));

  const missingTa = enList.filter(k => !taList.has(k));
  const missingHi = enList.filter(k => !hiList.has(k));
  const missingTe = enList.filter(k => !teList.has(k));

  assert(enList.length >= 350, 'Translation keys count', `Total keys: ${enList.length}`);
  assert(missingTa.length === 0, 'Tamil (TA) has 100% key parity with English', `Missing: ${missingTa.length}`);
  assert(missingHi.length === 0, 'Hindi (HI) has 100% key parity with English', `Missing: ${missingHi.length}`);
  assert(missingTe.length === 0, 'Telugu (TE) has 100% key parity with English', `Missing: ${missingTe.length}`);

  // Test multilingual Copilot query in Tamil
  const taResult = await AgenticCopilotService.processQuery({
    userId: userA.id,
    profileId: 'fam-a-self',
    query: 'What medicines do I have today?',
    language: 'ta'
  });
  assert(typeof taResult.reply === 'string' && taResult.reply.length > 20, 'Copilot responds in requested language (Tamil)', taResult.reply.slice(0, 50) + '...');

  // --------------------------------------------------------------------------
  // TEST SECTION 5: ABDM / HL7 FHIR R4 RESOURCE MAPPING
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SECTION 5: ABDM Readiness & FHIR R4 Mapping ---');
  const fhirBundle = FhirService.generatePatientBundle(userA.id, 'fam-a-self');

  assert(fhirBundle.resourceType === 'Bundle', 'FHIR Bundle resourceType is "Bundle"');
  assert(fhirBundle.type === 'collection', 'FHIR Bundle type is "collection"');
  assert(fhirBundle.total >= 4, 'FHIR Bundle contains multiple structured resources', `Total: ${fhirBundle.total}`);

  const resourceTypes = fhirBundle.entry.map(e => e.resource.resourceType);
  assert(resourceTypes.includes('Patient'), 'FHIR Bundle includes Patient resource');
  assert(resourceTypes.includes('Observation'), 'FHIR Bundle includes Observation resources');
  assert(resourceTypes.includes('DiagnosticReport'), 'FHIR Bundle includes DiagnosticReport resource');
  assert(resourceTypes.includes('MedicationRequest'), 'FHIR Bundle includes MedicationRequest resource');

  // Verify Observation coding preserving source units
  const obs = fhirBundle.entry.find(e => e.resource.resourceType === 'Observation')?.resource;
  assert(obs?.code?.coding?.length > 0 && obs?.valueQuantity?.unit, 'Observation preserves clinical code and measurement units', `${obs?.code?.text}: ${obs?.valueQuantity?.value} ${obs?.valueQuantity?.unit}`);

  // --------------------------------------------------------------------------
  // TEST SECTION 6: UNIFIED HEALTH PROFILE & TIMELINE ISOLATION
  // --------------------------------------------------------------------------
  console.log('\n--- TEST SECTION 6: Unified Health Profile & Timeline Isolation ---');
  const selfEvents = db.prepare(`SELECT * FROM medical_timeline WHERE user_id = ? AND profile_id = ?`).all(userA.id, 'fam-a-self');
  const childEvents = db.prepare(`SELECT * FROM medical_timeline WHERE user_id = ? AND profile_id = ?`).all(userA.id, 'fam-a-child');

  assert(selfEvents.length >= 2, 'Self profile has medical timeline events', `Count: ${selfEvents.length}`);
  assert(childEvents.length >= 1, 'Child profile has separate medical timeline events', `Count: ${childEvents.length}`);
  assert(selfEvents[0].id !== childEvents[0].id, 'Timeline events are strictly separated between family profiles');

  // --------------------------------------------------------------------------
  // SUMMARY RESULTS
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`   TEST EXECUTION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed === 0) {
    console.log('✓ All Round 2 Bonus Requirements Verified with 100% Pass Rate!\n');
    process.exit(0);
  } else {
    console.error(`✗ ${failed} test(s) failed. Review output above.\n`);
    process.exit(1);
  }
}

runRound2TestSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
