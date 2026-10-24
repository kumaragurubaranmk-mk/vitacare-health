import React, { useState, useEffect } from 'react';
import {
  Pill,
  Plus,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit,
  AlertCircle,
  Video,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Camera
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Modal } from '../../components/Modal';
import { CareConnectModal } from '../../components/CareConnectModal';
import { AddPrescriptionModal } from '../../components/AddPrescriptionModal';
import { PillConsumptionTrackerModal } from '../../components/PillConsumptionTrackerModal';

export function MedicationReminderPage() {
  const { token, isDemoMode } = useAuth();
  const { t } = useLanguage();

  const [reminders, setReminders] = useState([]);
  const [todayTimeline, setTodayTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  // Adherence Data
  const [adherence, setAdherence] = useState({
    taken: 18,
    missed: 2,
    pending: 1,
    adherencePercentage: 90,
    calendar: [
      { day: 'MON', status: 'taken', label: '🟢' },
      { day: 'TUE', status: 'taken', label: '🟢' },
      { day: 'WED', status: 'taken', label: '🟢' },
      { day: 'THU', status: 'missed', label: '🔴' },
      { day: 'FRI', status: 'taken', label: '🟢' },
      { day: 'SAT', status: 'taken', label: '🟢' },
      { day: 'SUN', status: 'pending', label: '🟠' }
    ]
  });

  // Modals
  const [isAddMedOpen, setIsAddMedOpen] = useState(false);
  const [isAddRxOpen, setIsAddRxOpen] = useState(false);
  const [isCareConnectOpen, setIsCareConnectOpen] = useState(false);
  const [isPillTrackerOpen, setIsPillTrackerOpen] = useState(false);
  const [trackingReminder, setTrackingReminder] = useState(null);
  const [selectedReminder, setSelectedReminder] = useState(null);

  // Form Data for Manual Add/Edit
  const [formData, setFormData] = useState({
    id: null,
    medicine_name: '',
    dosage: '',
    frequency: 'Twice daily',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    intake_times: '08:00 AM, 08:00 PM',
    duration_days: '5',
    instructions: 'Take with food and water'
  });

  useEffect(() => {
    fetchMedications();

    // Auto-poll every 3.5s for real-time adherence updates
    const pollTimer = setInterval(() => {
      fetchMedications();
    }, 3500);

    const handleUpdate = () => fetchMedications();
    window.addEventListener('vitacare:data-updated', handleUpdate);

    return () => {
      clearInterval(pollTimer);
      window.removeEventListener('vitacare:data-updated', handleUpdate);
    };
  }, [token, isDemoMode]);

  const fetchMedications = async () => {
    setLoading(true);
    const authToken = token || localStorage.getItem('healthgpt_token');
    const headers = {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    };

    try {
      const res = await fetch('/api/medications', { headers });
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders || []);

        if (data.todaySlots && data.todaySlots.length > 0) {
          setTodayTimeline(data.todaySlots);
        } else {
          setTodayTimeline([]);
        }

        if (data.adherence) {
          setAdherence({
            taken: data.adherence.taken ?? 0,
            missed: data.adherence.missed ?? 0,
            pending: data.adherence.pending ?? 0,
            adherencePercentage: data.adherence.adherencePercentage ?? 100,
            calendar: data.adherence.calendar || [
              { day: 'MON', status: 'verified', label: '🟢' },
              { day: 'TUE', status: 'verified', label: '🟢' },
              { day: 'WED', status: 'verified', label: '🟢' },
              { day: 'THU', status: 'verified', label: '🟢' },
              { day: 'FRI', status: 'verified', label: '🟢' },
              { day: 'SAT', status: 'verified', label: '🟢' },
              { day: 'SUN', status: 'pending', label: '🟠' }
            ]
          });
        }
      }
    } catch (err) {
      console.error('Error fetching medications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMedicine = async (e) => {
    e.preventDefault();
    const authToken = token || localStorage.getItem('healthgpt_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    };

    try {
      await fetch('/api/medications', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          medicine_name: formData.medicine_name,
          dosage: formData.dosage,
          frequency: formData.frequency,
          reminder_time: formData.intake_times.split(',')[0].trim() || '08:00 AM',
          intake_times: formData.intake_times,
          duration_days: parseInt(formData.duration_days) || 5,
          start_date: formData.start_date,
          end_date: formData.end_date,
          instructions: formData.instructions
        })
      });

      setIsAddMedOpen(false);
      setFormData({
        id: null,
        medicine_name: '',
        dosage: '',
        frequency: 'Twice daily',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        intake_times: '08:00 AM, 08:00 PM',
        duration_days: '5',
        instructions: 'Take with food and water'
      });
      fetchMedications();
    } catch (err) {
      console.error('Error saving medication:', err);
    }
  };

  const openCareConnectForSlot = (slot) => {
    setSelectedReminder(slot);
    setIsCareConnectOpen(true);
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      
      {/* HEADER SECTION */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          padding: '1.25rem 1.75rem',
          border: '1.5px solid #e0f2fe',
          boxShadow: '0 4px 16px -2px rgba(2, 132, 199, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                backgroundColor: '#e0f2fe',
                color: '#0284c7',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.2rem 0.55rem',
                borderRadius: '9999px',
                textTransform: 'uppercase'
              }}
            >
              Medicine Schedule & Adherence Tracker
            </span>
          </div>
          <h1 style={{ margin: '0.3rem 0 0.15rem', fontSize: '1.65rem', fontWeight: 800, color: '#0f172a' }}>
            Medication Management & Visual Timeline
          </h1>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
            Manage active prescriptions, generate dosing schedules, and track adherence compliance.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setIsAddRxOpen(true)}
            style={{
              backgroundColor: '#f0f9ff',
              border: '1.5px solid #0284c7',
              color: '#0284c7',
              padding: '0.65rem 1.15rem',
              borderRadius: '0.65rem',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Sparkles size={16} /> Scan Rx with OCR
          </button>

          <button
            id="btn-add-medicine-manual"
            onClick={() => setIsAddMedOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '0.65rem 1.25rem',
              borderRadius: '0.65rem',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
            }}
          >
            <Plus size={16} /> + ADD MEDICINE
          </button>
        </div>
      </div>

      {/* ADHERENCE DASHBOARD (REQUIREMENT 11) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          borderRadius: '1rem',
          padding: '1.5rem',
          color: '#ffffff',
          boxShadow: '0 6px 20px rgba(2, 132, 199, 0.25)',
          marginBottom: '1.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <span
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Medication Adherence
            </span>
            <h2 style={{ margin: '0.35rem 0 0', fontSize: '1.4rem', fontWeight: 800 }}>
              This Week's Compliance Overview
            </h2>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              padding: '0.5rem 1.25rem',
              borderRadius: '0.75rem',
              border: '1px solid rgba(255,255,255,0.25)',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '0.75rem', opacity: 0.9, fontWeight: 600 }}>OVERALL ADHERENCE</div>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{adherence.adherencePercentage}%</div>
          </div>
        </div>

        {/* 3 Metric Pills + Weekly Calendar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.65rem', padding: '0.85rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399' }}>{adherence.taken}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Taken Doses</div>
          </div>

          <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.65rem', padding: '0.85rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f87171' }}>{adherence.missed}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Missed Doses</div>
          </div>

          <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '0.65rem', padding: '0.85rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24' }}>{adherence.pending}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Pending Doses</div>
          </div>
        </div>

        {/* Weekly Calendar Representation (Requirement 11) */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem', opacity: 0.95 }}>
            Weekly Calendar History:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
            {adherence.calendar.map((item, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  borderRadius: '0.5rem',
                  padding: '0.65rem 0.4rem',
                  textAlign: 'center',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{item.day}</div>
                <div style={{ fontSize: '1.1rem', marginTop: '0.2rem' }}>{item.label}</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.85, textTransform: 'capitalize' }}>{item.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TWO COLUMNS: VISUAL MEDICINE TIMELINE (REQ 8) + ACTIVE MEDICINES (REQ 7) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>
        
        {/* LEFT COLUMN: VISUAL MEDICINE TIMELINE (TODAY) */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} color="#0284c7" /> Visual Medicine Timeline
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Today's scheduled intake sequence & adherence status
              </p>
            </div>
            <span
              style={{
                backgroundColor: '#f0f9ff',
                color: '#0284c7',
                border: '1px solid #bae6fd',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.65rem',
                borderRadius: '0.35rem'
              }}
            >
              TODAY
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
            {todayTimeline.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1.5px dashed #cbd5e1' }}>
                <Pill size={36} color="#94a3b8" style={{ margin: '0 auto 0.5rem' }} />
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
                  {t.dashboard?.noMedicinesToday || 'No medicines scheduled for today.'}
                </div>
                <p style={{ margin: '0.25rem 0 1rem', fontSize: '0.82rem', color: '#64748b' }}>
                  {t.dashboard?.addMedCTA || 'Click [+ ADD MEDICINE] above to schedule your prescribed medicines.'}
                </p>
                <button
                  onClick={() => setIsAddMedOpen(true)}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.55rem',
                    padding: '0.55rem 1.15rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  + ADD MEDICINE
                </button>
              </div>
            ) : (
              todayTimeline.map((item, index) => {
              const isTaken = item.status === 'taken';
              const isMissed = item.status === 'missed';
              const isSkipped = item.status === 'skipped';
              const isDue = item.status === 'due';
              const isUpcoming = item.status === 'upcoming';

              return (
                <div
                  key={item.id || index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.15rem',
                    borderRadius: '0.75rem',
                    backgroundColor: isTaken ? '#f8fafc' : isDue ? '#fef2f2' : '#f0f9ff',
                    border: `1.5px solid ${isTaken ? '#e2e8f0' : isDue ? '#fca5a5' : '#bae6fd'}`,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                    <div
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.45rem',
                        backgroundColor: isTaken ? '#e2e8f0' : '#0284c7',
                        color: isTaken ? '#475569' : '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 700
                      }}
                    >
                      {item.time}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>
                        {item.medicine_name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        Dosage: {item.dosage}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isTaken || item.status === 'verified' ? (
                      <span
                        style={{
                          backgroundColor: '#ecfdf5',
                          color: '#059669',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <CheckCircle2 size={13} /> ✅ Verified
                      </span>
                    ) : isMissed ? (
                      <span
                        style={{
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.78rem',
                          fontWeight: 800
                        }}
                      >
                        ❌ Missed
                      </span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span
                          style={{
                            backgroundColor: '#fffbeb',
                            color: '#d97706',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 800
                          }}
                        >
                          ⏳ {t.medicine?.pending || 'Pending'}
                        </span>
                        <button
                          onClick={() => {
                            setTrackingReminder(item);
                            setIsPillTrackerOpen(true);
                          }}
                          style={{
                            backgroundColor: '#0284c7',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '0.45rem',
                            padding: '0.4rem 0.75rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
                          }}
                          title="Start automated camera pill consumption tracking"
                        >
                          <Camera size={13} /> {t.tracker?.startTracking || 'Track Intake'}
                        </button>
                        <button
                          onClick={async () => {
                            if (!window.confirm(t.consumptionTracking?.confirmRefusalPrompt || 'Are you sure you want to refuse this medicine dose?')) return;
                            const authToken = token || localStorage.getItem('healthgpt_token');
                            await fetch(`/api/medications/${item.reminderId || item.id}/refuse`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
                              },
                              body: JSON.stringify({ scheduled_time: item.time || '08:00 AM' })
                            });
                            fetchMedications();
                          }}
                          style={{
                            backgroundColor: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '0.45rem',
                            padding: '0.4rem 0.6rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                          title="Refuse medicine dose"
                        >
                          <XCircle size={13} /> {t.tracker?.refuseDose || 'Refuse'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }))}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE MEDICATIONS & SCHEDULE DETAILS (REQ 7) */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Pill size={18} color="#0284c7" /> Active Medications
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Dosages, intake intervals, and prescription durations
              </p>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
              {reminders.length} Active
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {reminders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', border: '1.5px dashed #cbd5e1' }}>
                <Pill size={36} color="#94a3b8" style={{ margin: '0 auto 0.5rem' }} />
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
                  No active medications registered.
                </div>
                <p style={{ margin: '0.25rem 0 1rem', fontSize: '0.82rem', color: '#64748b' }}>
                  Click [+ ADD MEDICINE] above to register your prescribed medications.
                </p>
                <button
                  onClick={() => setIsAddMedOpen(true)}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.55rem',
                    padding: '0.55rem 1.15rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  + ADD MEDICINE
                </button>
              </div>
            ) : (
              reminders.map((med) => (
              <div
                key={med.id}
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 }}>
                      {med.medicine_name}
                    </h4>
                    <span
                      style={{
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '0.3rem'
                      }}
                    >
                      {med.dosage}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.35rem' }}>
                    <strong>Schedule:</strong> {med.intake_times || med.reminder_time} ({med.frequency})
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                    <strong>Duration:</strong> {med.duration_days || 5} days • <em>{med.instructions || 'Standard oral administration'}</em>
                  </div>
                </div>

                <button
                  onClick={() => openCareConnectForSlot(med)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #bae6fd',
                    color: '#0284c7',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}
                  title="CareConnect adherence session"
                >
                  <Video size={13} /> CareConnect
                </button>
              </div>
            )))}
          </div>
        </div>
      </div>

      {/* MANUAL ADD MEDICINE MODAL (REQUIREMENT 7) */}
      <Modal isOpen={isAddMedOpen} onClose={() => setIsAddMedOpen(false)} title="Add / Edit Medication Schedule">
        <form onSubmit={handleSaveMedicine} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Medicine Name *
            </label>
            <input
              type="text"
              required
              value={formData.medicine_name}
              onChange={(e) => setFormData({ ...formData, medicine_name: e.target.value })}
              placeholder="e.g. Amoxicillin"
              style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Dosage *
              </label>
              <input
                type="text"
                required
                value={formData.dosage}
                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                placeholder="e.g. 500 mg"
                style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Frequency *
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
              >
                <option value="Once daily">Once daily</option>
                <option value="Twice daily">Twice daily</option>
                <option value="Three times daily">Three times daily</option>
                <option value="Every 8 hours">Every 8 hours</option>
                <option value="As needed (PRN)">As needed (PRN)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Intake Times *
              </label>
              <input
                type="text"
                required
                value={formData.intake_times}
                onChange={(e) => setFormData({ ...formData, intake_times: e.target.value })}
                placeholder="e.g. 08:00 AM, 08:00 PM"
                style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Duration (Days)
              </label>
              <input
                type="number"
                value={formData.duration_days}
                onChange={(e) => setFormData({ ...formData, duration_days: e.target.value })}
                placeholder="e.g. 5"
                style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Start Date
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                End Date (Optional)
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Instructions
            </label>
            <input
              type="text"
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              placeholder="e.g. Take with water after breakfast and dinner"
              style={{ width: '100%', padding: '0.65rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setIsAddMedOpen(false)}
              style={{ padding: '0.6rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#0284c7', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Save Schedule & Timeline
            </button>
          </div>
        </form>
      </Modal>

      {/* SCAN PRESCRIPTION MODAL */}
      <AddPrescriptionModal
        isOpen={isAddRxOpen}
        onClose={() => setIsAddRxOpen(false)}
        onPrescriptionSaved={() => {
          setIsAddRxOpen(false);
          fetchMedications();
        }}
      />

      {/* CARECONNECT VIDEO MODAL */}
      <CareConnectModal
        isOpen={isCareConnectOpen}
        onClose={() => setIsCareConnectOpen(false)}
        reminder={selectedReminder}
        onAdherenceConfirmed={() => {
          if (selectedReminder) {
            handleStatusChange(selectedReminder, 'taken');
          }
          fetchMedications();
        }}
      />
      {/* Automated Pill Consumption Tracker Modal */}
      <PillConsumptionTrackerModal
        isOpen={isPillTrackerOpen}
        onClose={() => setIsPillTrackerOpen(false)}
        reminder={trackingReminder}
        onVerificationComplete={() => fetchMedications()}
      />
    </div>
  );
}
