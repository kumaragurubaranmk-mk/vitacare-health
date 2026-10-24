import { db } from '../database/db.js';
import { v4 as uuidv4 } from 'uuid';
import { getAuthorizedProfile } from '../middleware/profileAuth.js';

/**
 * FHIR R4 Interoperability Service for India's ABDM Ecosystem
 * Conforms to HL7 FHIR Release 4 specification for Health Information Provider (HIP) and User (HIU).
 */
export class FhirService {
  /**
   * Build FHIR R4 Patient Resource
   */
  static buildPatientResource(user, profile, abhaProfile) {
    const isMockAbha = Boolean(abhaProfile?.is_mock);
    return {
      resourceType: 'Patient',
      id: profile.id || `patient-${user.id}`,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient']
      },
      identifier: [
        {
          type: {
            coding: [
              {
                system: 'https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-identifier-type-code',
                code: 'ABHA',
                display: isMockAbha ? 'Mock Test Ayushman Bharat Health Account Number' : 'Ayushman Bharat Health Account Number'
              }
            ]
          },
          system: 'https://healthid.ndhm.gov.in',
          value: abhaProfile?.abha_number || '91-MOCK-TEST-0001'
        },
        {
          type: {
            coding: [
              {
                system: 'https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-identifier-type-code',
                code: 'ABHA-ADDRESS',
                display: 'ABHA Address'
              }
            ]
          },
          system: 'https://healthid.ndhm.gov.in',
          value: abhaProfile?.abha_address || 'patient@sbx'
        }
      ],
      name: [
        {
          text: profile.name || user.full_name,
          family: (profile.name || user.full_name).split(' ').pop() || '',
          given: [(profile.name || user.full_name).split(' ')[0] || '']
        }
      ],
      telecom: [
        {
          system: 'phone',
          value: profile.emergency_phone || user.phone || '+91 98765 43210',
          use: 'mobile'
        },
        {
          system: 'email',
          value: user.email,
          use: 'home'
        }
      ],
      gender: profile.gender === 'female' ? 'female' : profile.gender === 'male' ? 'male' : 'other',
      birthDate: profile.date_of_birth || user.date_of_birth || '1990-01-01'
    };
  }

  /**
   * Build FHIR R4 Observation Resource for a Biomarker
   */
  static buildObservationResource(patientId, biomarker) {
    const loincMap = {
      'fasting glucose': { code: '1558-6', display: 'Fasting glucose [Mass/volume] in Blood' },
      'glucose': { code: '2339-0', display: 'Glucose [Mass/volume] in Blood' },
      'hemoglobin': { code: '718-7', display: 'Hemoglobin [Mass/volume] in Blood' },
      'total cholesterol': { code: '2093-3', display: 'Cholesterol [Mass/volume] in Serum or Plasma' },
      'cholesterol': { code: '2093-3', display: 'Cholesterol [Mass/volume] in Serum or Plasma' },
      'hba1c': { code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total in Blood' },
      'systolic blood pressure': { code: '8480-6', display: 'Systolic blood pressure' },
      'diastolic blood pressure': { code: '8462-4', display: 'Diastolic blood pressure' },
      'blood pressure': { code: '85354-9', display: 'Blood pressure panel' },
      'heart rate': { code: '8867-4', display: 'Heart rate' },
      'oxygen saturation': { code: '59408-5', display: 'Oxygen saturation in Arterial blood by Pulse oximetry' },
      'spo2': { code: '59408-5', display: 'Oxygen saturation by Pulse oximetry' },
      'creatinine': { code: '2160-0', display: 'Creatinine [Mass/volume] in Serum or Plasma' }
    };

    const bLower = (biomarker.biomarker_name || '').toLowerCase();
    let loinc = { code: '30954-2', display: biomarker.biomarker_name };
    for (const [key, mapping] of Object.entries(loincMap)) {
      if (bLower.includes(key)) {
        loinc = mapping;
        break;
      }
    }

    return {
      resourceType: 'Observation',
      id: biomarker.id,
      meta: {
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Observation']
      },
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory',
              display: 'Laboratory'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: loinc.code,
            display: loinc.display
          }
        ],
        text: biomarker.biomarker_name
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      effectiveDateTime: biomarker.recorded_date ? `${biomarker.recorded_date}T09:00:00Z` : new Date().toISOString(),
      valueQuantity: {
        value: typeof biomarker.value === 'number' ? biomarker.value : parseFloat(biomarker.value) || 0,
        unit: biomarker.unit || '',
        system: 'http://unitsofmeasure.org'
      },
      interpretation: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: biomarker.status === 'elevated' ? 'H' : biomarker.status === 'low' ? 'L' : 'N',
              display: biomarker.status === 'elevated' ? 'High' : biomarker.status === 'low' ? 'Low' : 'Normal'
            }
          ]
        }
      ],
      referenceRange: biomarker.reference_range ? [
        {
          text: biomarker.reference_range
        }
      ] : []
    };
  }

  /**
   * Build FHIR R4 MedicationRequest Resource
   */
  static buildMedicationRequestResource(patientId, med) {
    return {
      resourceType: 'MedicationRequest',
      id: med.id,
      meta: {
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/MedicationRequest']
      },
      status: med.status === 'active' ? 'active' : 'completed',
      intent: 'order',
      medicationCodeableConcept: {
        text: `${med.medicine_name} ${med.dosage}`
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      authoredOn: med.start_date ? `${med.start_date}T08:00:00Z` : new Date().toISOString(),
      dosageInstruction: [
        {
          text: `${med.dosage} ${med.frequency} at ${med.reminder_time}. ${med.instructions || ''}`,
          timing: {
            code: {
              text: med.frequency
            }
          }
        }
      ]
    };
  }

  /**
   * Build FHIR R4 DiagnosticReport Resource
   */
  static buildDiagnosticReportResource(patientId, report, observationIds) {
    return {
      resourceType: 'DiagnosticReport',
      id: report.id,
      meta: {
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/DiagnosticReport']
      },
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: 'LAB',
              display: 'Laboratory'
            }
          ]
        }
      ],
      code: {
        text: report.title
      },
      subject: {
        reference: `Patient/${patientId}`
      },
      effectiveDateTime: report.report_date ? `${report.report_date}T09:30:00Z` : new Date().toISOString(),
      conclusion: report.ai_summary || '',
      result: (observationIds || []).map(id => ({
        reference: `Observation/${id}`
      }))
    };
  }

  /**
   * Export complete ABDM FHIR R4 Document / Collection Bundle
   */
  static generatePatientBundle(userId, profileId) {
    return this.exportFhirBundle(userId, profileId);
  }

  static exportFhirBundle(userId, profileId) {
    const auth = getAuthorizedProfile(userId, profileId);
    if (!auth.authorized) throw new Error(auth.reason);

    const pId = auth.profileId;
    const isSelf = auth.isSelf;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const abhaProfile = db.prepare('SELECT * FROM abha_profiles WHERE user_id = ? AND profile_id = ?').get(userId, pId);

    const patientResource = this.buildPatientResource(user, auth.profile, abhaProfile);

    // Get reports
    let reports;
    if (isSelf) {
      reports = db.prepare(`
        SELECT * FROM medical_reports WHERE user_id = ? AND (profile_id = ? OR profile_id IS NULL OR profile_id = 'self' OR profile_id = ?)
        ORDER BY report_date DESC
      `).all(userId, pId, `self-${userId}`);
    } else {
      reports = db.prepare(`
        SELECT * FROM medical_reports WHERE user_id = ? AND profile_id = ?
        ORDER BY report_date DESC
      `).all(userId, pId);
    }

    // Get biomarkers
    let biomarkers;
    if (isSelf) {
      biomarkers = db.prepare(`
        SELECT * FROM report_biomarkers WHERE user_id = ? AND (profile_id = ? OR profile_id IS NULL OR profile_id = 'self' OR profile_id = ?)
        ORDER BY recorded_date ASC
      `).all(userId, pId, `self-${userId}`);
    } else {
      biomarkers = db.prepare(`
        SELECT * FROM report_biomarkers WHERE user_id = ? AND profile_id = ?
        ORDER BY recorded_date ASC
      `).all(userId, pId);
    }

    // Get medications
    let medications;
    if (isSelf) {
      medications = db.prepare(`
        SELECT * FROM medication_reminders WHERE user_id = ? AND (profile_id = ? OR profile_id IS NULL OR profile_id = 'self' OR profile_id = ?)
      `).all(userId, pId, `self-${userId}`);
    } else {
      medications = db.prepare(`
        SELECT * FROM medication_reminders WHERE user_id = ? AND profile_id = ?
      `).all(userId, pId);
    }

    const bundleEntries = [
      {
        fullUrl: `urn:uuid:${patientResource.id}`,
        resource: patientResource
      }
    ];

    // Add observations
    for (const b of biomarkers) {
      const obsRes = this.buildObservationResource(patientResource.id, b);
      bundleEntries.push({
        fullUrl: `urn:uuid:${obsRes.id}`,
        resource: obsRes
      });
    }

    // Add diagnostic reports
    for (const r of reports) {
      const linkedObs = biomarkers.filter(b => b.report_id === r.id).map(b => b.id);
      const repRes = this.buildDiagnosticReportResource(patientResource.id, r, linkedObs);
      bundleEntries.push({
        fullUrl: `urn:uuid:${repRes.id}`,
        resource: repRes
      });
    }

    // Add medication requests
    for (const m of medications) {
      const medRes = this.buildMedicationRequestResource(patientResource.id, m);
      bundleEntries.push({
        fullUrl: `urn:uuid:${medRes.id}`,
        resource: medRes
      });
    }

    const bundleId = `bundle-${uuidv4()}`;

    return {
      resourceType: 'Bundle',
      id: bundleId,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle']
      },
      identifier: {
        system: 'https://healthid.ndhm.gov.in/bundle',
        value: bundleId
      },
      type: 'collection',
      timestamp: new Date().toISOString(),
      total: bundleEntries.length,
      entry: bundleEntries,
      abdmMetadata: {
        isMockSandbox: true,
        abdmVersion: 'M2/M3 FHIR R4',
        notice: 'Test-Only Mock ABHA Sandbox — Demonstrates ABDM-ready FHIR R4 schema interoperability for VitaCare AI.'
      }
    };
  }
}
