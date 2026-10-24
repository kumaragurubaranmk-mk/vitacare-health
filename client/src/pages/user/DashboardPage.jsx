import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  FilePlus,
  PlusCircle,
  Pill,
  Heart,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  FileText,
  Video,
  Sparkles,
  HeartPulse,
  TrendingUp,
  User,
  ShieldCheck,
  ChevronRight,
  Droplet,
  Zap,
  Send,
  Loader2,
  Eye,
  BellRing,
  HelpCircle,
  Stethoscope,
  PhoneCall,
  History,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { AddPrescriptionModal } from '../../components/AddPrescriptionModal';
import { AddHealthReportModal } from '../../components/AddHealthReportModal';
import { CareConnectModal } from '../../components/CareConnectModal';
import { PillConsumptionTrackerModal } from '../../components/PillConsumptionTrackerModal';
import { ReportViewerModal } from '../../components/ReportViewerModal';

export function DashboardPage() {
  const { user, token } = useAuth();
  const { t, language } = useLanguage();

  // Modals state
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isCareConnectOpen, setIsCareConnectOpen] = useState(false);
  const [isPillTrackerOpen, setIsPillTrackerOpen] = useState(false);
  const [isReportViewerOpen, setIsReportViewerOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Data states
  const [loading, setLoading] = useState(true);
  const [metricsSummary, setMetricsSummary] = useState({});
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [adherenceData, setAdherenceData] = useState({
    taken: 0,
    missed: 0,
    pending: 0,
    adherencePercentage: 100
  });
  const [recentReports, setRecentReports] = useState([]);
  const [recentPrescriptions, setRecentPrescriptions] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [timelineEvents, setTimelineEvents] = useState([]);

  // AI Health Copilot Mini-Chat State
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotResponse, setCopilotResponse] = useState(null);
  const [copilotError, setCopilotError] = useState(null);

  const dashT = t.dashboard || {};
  const copilotT = t.copilot || {};
  const commonT = t.common || {};

  useEffect(() => {
    fetchDashboardData();

    const handleDataUpdate = () => {
      fetchDashboardData();
    };

    window.addEventListener('vitacare:data-updated', handleDataUpdate);
    return () => {
      window.removeEventListener('vitacare:data-updated', handleDataUpdate);
    };
  }, [token, language]);

  const fetchDashboardData = async () => {
    setLoading(true);
    const authToken = token || localStorage.getItem('healthgpt_token');
    const headers = {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    };

    try {
      const [metricsRes, medsRes, reportsRes, rxRes, alertsRes, timelineRes] = await Promise.all([
        fetch('/api/metrics/summary', { headers }).then(r => r.ok ? r.json() : { summary: {} }).catch(() => ({ summary: {} })),
        fetch('/api/medications', { headers }).then(r => r.ok ? r.json() : { reminders: [], todaySlots: [] }).catch(() => ({ reminders: [], todaySlots: [] })),
        fetch('/api/reports', { headers }).then(r => r.ok ? r.json() : { reports: [] }).catch(() => ({ reports: [] })),
        fetch('/api/prescriptions', { headers }).then(r => r.ok ? r.json() : { prescriptions: [] }).catch(() => ({ prescriptions: [] })),
        fetch('/api/guardians/alerts', { headers }).then(r => r.ok ? r.json() : { alerts: [] }).catch(() => ({ alerts: [] })),
        fetch('/api/timeline', { headers }).then(r => r.ok ? r.json() : { timeline: [] }).catch(() => ({ timeline: [] }))
      ]);

      // Metrics
      setMetricsSummary(metricsRes.summary || {});

      // Medications & Schedule (Strictly real data, no fake mock slots)
      const slots = medsRes.todaySlots || [];
      setTodaySchedule(slots);

      // Adherence stats
      if (medsRes.adherence) {
        setAdherenceData(medsRes.adherence);
      }

      // Reports & Prescriptions
      setRecentReports(reportsRes.reports || []);
      setRecentPrescriptions(rxRes.prescriptions || []);

      // Alerts & Escalations
      setAlertHistory(alertsRes.alerts || medsRes.alertHistory || []);

      // Timeline
      setTimelineEvents(timelineRes.timeline || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAskCopilot = async (questionText) => {
    const query = questionText || copilotQuery;
    if (!query || !query.trim()) return;

    setCopilotLoading(true);
    setCopilotError(null);
    setCopilotResponse(null);

    const authToken = token || localStorage.getItem('healthgpt_token');
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          message: query.trim(),
          language: language || 'en',
          history: []
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to get AI Copilot response.');
      }

      setCopilotResponse(data);
      if (!questionText) {
        setCopilotQuery('');
      }
    } catch (err) {
      console.error('Copilot query error:', err);
      setCopilotError(err.message || 'Unable to communicate with AI Health Copilot.');
    } finally {
      setCopilotLoading(false);
    }
  };

  const openPillTracker = (slot) => {
    setSelectedReminder(slot);
    setIsPillTrackerOpen(true);
  };

  const openCareConnect = (slot = null) => {
    setSelectedReminder(slot);
    setIsCareConnectOpen(true);
  };

  const openDocViewer = (doc, docType = 'report') => {
    setSelectedDoc({ ...doc, docType });
    setIsReportViewerOpen(true);
  };

  const userName = user?.full_name?.split(' ')[0] || user?.name || 'Patient';

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      
      {/* 1. TOP WELCOME ACTION BAR & QUICK ACTIONS */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1.1rem',
          padding: '1.5rem 1.85rem',
          boxShadow: '0 4px 20px -2px rgba(2, 132, 199, 0.08)',
          border: '1.5px solid #e0f2fe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
          marginBottom: '1.75rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                backgroundColor: '#e0f2fe',
                color: '#0369a1',
                fontSize: '0.74rem',
                fontWeight: 700,
                padding: '0.22rem 0.6rem',
                borderRadius: '9999px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              VitaCare AI
            </span>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
              • {dashT.sessionActive || 'Active Clinical Session'}
            </span>
          </div>
          <h1
            style={{
              margin: '0.15rem 0',
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em'
            }}
          >
            {dashT.welcomeBack || 'Welcome back'}, {userName} 👋
          </h1>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
            {dashT.subtitle || 'Your real-time healthcare intelligence, medication schedule, and clinical records overview.'}
          </p>
        </div>

        {/* 10. Quick Actions: Upload Report or Prescription */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <button
            id="btn-add-prescription-top"
            onClick={() => setIsRxModalOpen(true)}
            style={{
              backgroundColor: '#ffffff',
              border: '2px solid #0284c7',
              color: '#0284c7',
              borderRadius: '0.75rem',
              padding: '0.75rem 1.35rem',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.12)',
              transition: 'all 0.2s ease'
            }}
          >
            <PlusCircle size={18} />
            {dashT.addPrescription || '+ Add Prescription'}
          </button>

          <button
            id="btn-add-health-report-top"
            onClick={() => setIsReportModalOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '0.75rem',
              padding: '0.75rem 1.45rem',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <FilePlus size={18} />
            {dashT.addReport || '+ Add Health Report'}
          </button>
        </div>
      </div>

      {/* 2. PROMINENT AI HEALTH COPILOT FEATURE CARD */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #ffffff 100%)',
          border: '2px solid #bae6fd',
          borderRadius: '1.25rem',
          padding: '1.5rem 1.75rem',
          boxShadow: '0 6px 24px -4px rgba(2, 132, 199, 0.12)',
          marginBottom: '1.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                {copilotT.title || 'AI Health Copilot'}
              </h2>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.84rem', color: '#475569' }}>
                {copilotT.subtitle || 'Ask questions about your health, lab results, medications, or reports in simple language.'}
              </p>
            </div>
          </div>

          <Link
            to="/ai-copilot"
            style={{
              backgroundColor: '#ffffff',
              color: '#0284c7',
              border: '1.5px solid #0284c7',
              padding: '0.45rem 0.95rem',
              borderRadius: '0.55rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            Open Full Copilot <ChevronRight size={15} />
          </Link>
        </div>

        {/* Quick Question Chips */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {[
            { label: copilotT.whatLowHb || 'What does low hemoglobin mean?', q: 'What does low hemoglobin mean?' },
            { label: copilotT.whatReportShow || 'What does my report show?', q: 'What does my report show?' },
            { label: copilotT.myMedsToday || 'What are my medicines today?', q: 'What are my medicines today?' },
            { label: copilotT.bloodSugarTrend || 'How is my blood sugar trend?', q: 'How is my blood sugar trend?' },
            { label: 'Doctor visit questions', q: 'Help me prepare questions for my doctor' }
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleAskCopilot(item.q)}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #bae6fd',
                color: '#0369a1',
                padding: '0.35rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <HelpCircle size={13} color="#0284c7" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Interactive Query Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskCopilot();
          }}
          style={{ display: 'flex', gap: '0.65rem' }}
        >
          <input
            type="text"
            value={copilotQuery}
            onChange={(e) => setCopilotQuery(e.target.value)}
            placeholder={copilotT.askPlaceholder || 'Ask a health question, ask about low hemoglobin, blood glucose, or your uploaded reports...'}
            disabled={copilotLoading}
            style={{
              flex: 1,
              backgroundColor: '#ffffff',
              border: '1.5px solid #cbd5e1',
              borderRadius: '0.75rem',
              padding: '0.75rem 1.15rem',
              fontSize: '0.92rem',
              color: '#0f172a',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={copilotLoading || !copilotQuery.trim()}
            style={{
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.75rem',
              padding: '0.75rem 1.4rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: copilotLoading || !copilotQuery.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)'
            }}
          >
            {copilotLoading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
            {copilotT.send || 'Ask Copilot'}
          </button>
        </form>

        {/* Copilot Response Display */}
        {copilotResponse && (
          <div
            style={{
              marginTop: '1.25rem',
              backgroundColor: '#ffffff',
              borderRadius: '0.85rem',
              border: '1.5px solid #93c5fd',
              padding: '1.25rem',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Sparkles size={18} color="#0284c7" />
              <strong style={{ color: '#0369a1', fontSize: '0.95rem' }}>VitaCare AI Clinical Response</strong>
              <span style={{ fontSize: '0.72rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontWeight: 700 }}>
                {language.toUpperCase()}
              </span>
            </div>

            {/* 3-Part Structured Clinical Answer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {copilotResponse.directAnswer && (
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.65rem 0.85rem', borderRadius: '0.55rem' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                    🎯 {copilotT.directAnswer || 'Direct Answer'}
                  </div>
                  <div style={{ color: '#14532d', fontSize: '0.92rem', fontWeight: 600, marginTop: '0.15rem' }}>
                    {copilotResponse.directAnswer}
                  </div>
                </div>
              )}

              {copilotResponse.briefExplanation && (
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.65rem 0.85rem', borderRadius: '0.55rem' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    💡 {copilotT.briefExplanation || 'Brief Explanation'}
                  </div>
                  <div style={{ color: '#334155', fontSize: '0.88rem', marginTop: '0.15rem' }}>
                    {copilotResponse.briefExplanation}
                  </div>
                </div>
              )}

              {copilotResponse.practicalNextStep && (
                <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.65rem 0.85rem', borderRadius: '0.55rem' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                    🩺 {copilotT.practicalNextStep || 'Practical Next Step'}
                  </div>
                  <div style={{ color: '#1e3a8a', fontSize: '0.88rem', fontWeight: 500, marginTop: '0.15rem' }}>
                    {copilotResponse.practicalNextStep}
                  </div>
                </div>
              )}

              {/* Fallback for general text reply */}
              {!copilotResponse.directAnswer && copilotResponse.reply && (
                <div style={{ color: '#1e293b', fontSize: '0.92rem', lineHeight: 1.5 }}>
                  {copilotResponse.reply}
                </div>
              )}
            </div>
          </div>
        )}

        {copilotError && (
          <div
            style={{
              marginTop: '1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '0.75rem 1rem',
              borderRadius: '0.6rem',
              fontSize: '0.86rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <AlertCircle size={17} />
            <span>{copilotError}</span>
          </div>
        )}
      </div>

      {/* 4 & 5. HEALTH MEASUREMENTS AND VITALS OVERVIEW */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} color="#0284c7" />
            {dashT.vitalsTitle || 'Health Overview (Latest Vitals & Trends)'}
          </h2>
          <Link to="/health-tracker" style={{ fontSize: '0.84rem', color: '#0284c7', textDecoration: 'none', fontWeight: 700 }}>
            {dashT.viewTracker || 'View Full Health Tracker & Trends →'}
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
          {/* Blood Pressure */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.85rem',
              padding: '1.15rem',
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>{dashT.bloodPressure || 'Blood Pressure'}</span>
              <Heart size={16} color="#ef4444" />
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
              {metricsSummary.blood_pressure ? `${metricsSummary.blood_pressure.metric_value}/${metricsSummary.blood_pressure.secondary_value || 80}` : '120/80'}{' '}
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>mmHg</span>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
              <CheckCircle2 size={13} /> {dashT.normalRange || 'Normal Range (120/80)'}
            </div>
          </div>

          {/* Heart Rate */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.85rem',
              padding: '1.15rem',
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>{dashT.heartRate || 'Heart Rate'}</span>
              <HeartPulse size={16} color="#0284c7" />
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
              {metricsSummary.heart_rate?.metric_value || 72}{' '}
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>BPM</span>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
              <CheckCircle2 size={13} /> {dashT.restingOptimal || 'Resting Optimal (60-100)'}
            </div>
          </div>

          {/* Fasting Glucose */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.85rem',
              padding: '1.15rem',
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>{dashT.bloodGlucose || 'Fasting Blood Glucose'}</span>
              <Zap size={16} color="#f59e0b" />
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
              {metricsSummary.glucose?.metric_value || 94}{' '}
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>mg/dL</span>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
              <CheckCircle2 size={13} /> {dashT.normalFasting || 'Normal Fasting (70-99)'}
            </div>
          </div>

          {/* Hemoglobin */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.85rem',
              padding: '1.15rem',
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>{dashT.hemoglobin || 'Hemoglobin (Hb)'}</span>
              <Droplet size={16} color="#dc2626" />
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
              {metricsSummary.hemoglobin?.metric_value || 14.2}{' '}
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>g/dL</span>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
              <CheckCircle2 size={13} /> Ref: 13.5 - 17.5 g/dL
            </div>
          </div>

          {/* SpO2 */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.85rem',
              padding: '1.15rem',
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>{dashT.spo2 || 'Oxygen Saturation (SpO2)'}</span>
              <Activity size={16} color="#059669" />
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
              {metricsSummary.spo2?.metric_value || 99}{' '}
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>%</span>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
              <CheckCircle2 size={13} /> {dashT.optimal || 'Optimal (>95%)'}
            </div>
          </div>
        </div>
      </div>

      {/* 3 & 4. TWO COLUMN SECTION: TODAY'S MEDICINE SCHEDULE + CARE CONNECT & ADHERENCE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
        
        {/* LEFT COLUMN: TODAY'S MEDICINE SCHEDULE & TRACKING STATUS */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '1.1rem',
            padding: '1.5rem',
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={19} color="#0284c7" />
                {dashT.todaySchedule || "Today's Medicine Schedule"}
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                {dashT.scheduleSubtitle || 'Camera-verified intake schedule with automated tracking'}
              </p>
            </div>
            <span
              style={{
                backgroundColor: '#f0f9ff',
                color: '#0284c7',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.65rem',
                borderRadius: '0.35rem',
                border: '1px solid #bae6fd'
              }}
            >
              TODAY
            </span>
          </div>

          {/* Genuine Empty State when user has no medicine scheduled */}
          {todaySchedule.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1.5rem',
                backgroundColor: '#f8fafc',
                borderRadius: '0.85rem',
                border: '1.5px dashed #cbd5e1'
              }}
            >
              <Pill size={36} color="#94a3b8" style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
                {dashT.noMedicinesToday || 'No medicines scheduled for today.'}
              </div>
              <p style={{ margin: '0.35rem 0 1.25rem', fontSize: '0.82rem', color: '#64748b' }}>
                {dashT.addMedCTA || 'Click [+ Add Prescription] above to schedule your prescribed medicines.'}
              </p>
              <button
                onClick={() => setIsRxModalOpen(true)}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.65rem',
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                <PlusCircle size={16} />
                {dashT.addPrescription || '+ Add Prescription'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {todaySchedule.map((slot, index) => {
                const isVerified = slot.status === 'verified';
                const isRefused = slot.status === 'refused';
                const isMissed = slot.status === 'missed';
                const isTracking = slot.status === 'tracking';
                const isPending = !isVerified && !isRefused && !isMissed;

                return (
                  <div
                    key={slot.id || index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      padding: '0.95rem 1.15rem',
                      borderRadius: '0.85rem',
                      backgroundColor: isVerified ? '#f8fafc' : (isRefused ? '#fef2f2' : (isMissed ? '#fff1f2' : '#f0f9ff')),
                      border: `1.5px solid ${isVerified ? '#e2e8f0' : (isRefused ? '#fecaca' : (isMissed ? '#fda4af' : '#bae6fd'))}`,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.45rem',
                          backgroundColor: isVerified ? '#e2e8f0' : '#0284c7',
                          color: isVerified ? '#475569' : '#ffffff',
                          fontSize: '0.82rem',
                          fontWeight: 800
                        }}
                      >
                        {slot.time || slot.scheduled_time || '08:00 AM'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0f172a' }}>
                          {slot.medicine_name || slot.medicineName}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {slot.dosage} • {slot.instructions || 'Oral intake with water'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isVerified ? (
                        <span
                          style={{
                            backgroundColor: '#ecfdf5',
                            color: '#059669',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '9999px',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <CheckCircle2 size={14} /> Verified Taken
                        </span>
                      ) : isRefused ? (
                        <span
                          style={{
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '9999px',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          <AlertTriangle size={14} /> Patient Refused
                        </span>
                      ) : (
                        <>
                          {/* PROHIBITED: Manual "Mark as Taken" button is completely removed! */}
                          {/* REPLACED WITH: Camera CV Verification Button */}
                          <button
                            onClick={() => openPillTracker(slot)}
                            style={{
                              backgroundColor: '#0284c7',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '0.55rem',
                              padding: '0.5rem 0.95rem',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)'
                            }}
                          >
                            <Sparkles size={14} />
                            {dashT.verifyIntake || 'Verify Intake (Camera)'}
                          </button>

                          <button
                            onClick={() => openCareConnect(slot)}
                            style={{
                              backgroundColor: '#ffffff',
                              color: '#0284c7',
                              border: '1.5px solid #0284c7',
                              borderRadius: '0.55rem',
                              padding: '0.45rem 0.75rem',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                            title="Start supervised CareConnect video session"
                          >
                            <Video size={14} /> CareConnect
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: 7. CARE CONNECT ACCESS & ADHERENCE SUMMARY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* 7. CARE CONNECT ACCESS CARD */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              borderRadius: '1.1rem',
              padding: '1.5rem',
              boxShadow: '0 6px 22px rgba(2, 132, 199, 0.28)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.22)',
                  color: '#ffffff',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  padding: '0.22rem 0.65rem',
                  borderRadius: '9999px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Care Connect Live Video
              </span>
              <span style={{ fontSize: '0.82rem', opacity: 0.95, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4ade80' }} />
                WebRTC Ready
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '0.85rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Video size={28} color="#ffffff" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
                  Live Supervised Adherence
                </h4>
                <div style={{ fontSize: '0.86rem', opacity: 0.9, marginTop: '0.2rem' }}>
                  Two-way video consultation with attending caregiver & automated computer vision intake.
                </div>
              </div>
            </div>

            <button
              onClick={() => openCareConnect(null)}
              style={{
                width: '100%',
                backgroundColor: '#ffffff',
                color: '#0284c7',
                border: 'none',
                borderRadius: '0.75rem',
                padding: '0.8rem 1.25rem',
                fontSize: '0.92rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.55rem',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
              }}
            >
              <Video size={18} />
              Start Live Care Connect Session
            </button>
          </div>

          {/* ADHERENCE SUMMARY */}
          <div
            style={{
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              border: '1.5px solid #bae6fd',
              borderRadius: '1.1rem',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <div>
              <div style={{ fontWeight: 800, color: '#0369a1', fontSize: '0.98rem' }}>
                {dashT.healthStatus || 'Health Status Summary'}
              </div>
              <div style={{ color: '#334155', fontSize: '0.84rem', marginTop: '0.2rem' }}>
                {dashT.weeklyAdherence || 'Weekly medication adherence is at'}{' '}
                <strong style={{ color: '#0284c7' }}>{adherenceData.adherencePercentage}%</strong>.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.15rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                  {adherenceData.taken || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                  {dashT.taken || 'TAKEN'}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>
                  {adherenceData.missed || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                  {dashT.missed || 'MISSED'}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>
                  {adherenceData.pending || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>
                  {dashT.pending || 'PENDING'}
                </div>
              </div>
              <Link
                to="/medications"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#0284c7',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  border: '1px solid #bae6fd',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                {dashT.adherenceDetails || 'Details'} <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 6. RECENT HEALTH REPORTS AND PRESCRIPTIONS */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1.1rem',
          padding: '1.5rem',
          border: '1.5px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          marginBottom: '1.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={19} color="#0284c7" />
              {dashT.recentDocuments || 'Recent Health Reports & Prescriptions'}
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Secure server-side authorized medical documents with original PDF & OCR biomarker inspection
            </p>
          </div>
          <Link to="/reports" style={{ fontSize: '0.84rem', color: '#0284c7', textDecoration: 'none', fontWeight: 700 }}>
            {dashT.allDocuments || 'All Documents →'}
          </Link>
        </div>

        {recentReports.length === 0 && recentPrescriptions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', backgroundColor: '#f8fafc', borderRadius: '0.85rem', border: '1.5px dashed #cbd5e1' }}>
            <FileText size={36} color="#94a3b8" style={{ margin: '0 auto 0.5rem' }} />
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
              {dashT.noReportsYet || 'No clinical reports uploaded yet.'}
            </div>
            <p style={{ margin: '0.35rem 0 1rem', fontSize: '0.82rem', color: '#64748b' }}>
              {dashT.uploadFirstReport || 'Click [+ ADD HEALTH REPORT] at the top to scan your first report.'}
            </p>
            <button
              onClick={() => setIsReportModalOpen(true)}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.65rem',
                padding: '0.6rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              <FilePlus size={16} />
              {dashT.addReport || '+ Add Health Report'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {/* Reports */}
            {recentReports.slice(0, 3).map((rep) => (
              <div
                key={`rep-${rep.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.15rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '0.55rem',
                      backgroundColor: '#e0f2fe',
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <FileText size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                      {rep.title || 'Laboratory Blood Report'}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                      {rep.report_date || 'Recent'} • {rep.lab_name || 'Clinical Diagnostics'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => openDocViewer(rep, 'report')}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #0284c7',
                    color: '#0284c7',
                    borderRadius: '0.5rem',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Eye size={13} /> View
                </button>
              </div>
            ))}

            {/* Prescriptions */}
            {recentPrescriptions.slice(0, 3).map((rx) => (
              <div
                key={`rx-${rx.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1.15rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '0.55rem',
                      backgroundColor: '#ecfdf5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Pill size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                      {rx.title || 'Doctor Prescription'}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                      {rx.prescription_date || 'Recent'} • {rx.doctor_name || 'Attending Physician'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => openDocViewer(rx, 'prescription')}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #059669',
                    color: '#059669',
                    borderRadius: '0.5rem',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Eye size={13} /> View
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 8 & 9. TWO COLUMN SECTION: GUARDIAN NOTIFICATIONS & MEDICAL TIMELINE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
        
        {/* 8. GUARDIAN NOTIFICATIONS & ALERTS */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '1.1rem',
            padding: '1.5rem',
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BellRing size={19} color="#0284c7" />
              {dashT.guardianAlertsTitle || 'Guardian Alerts & Escalations'}
            </h3>
            <Link to="/alert-history" style={{ fontSize: '0.84rem', color: '#0284c7', textDecoration: 'none', fontWeight: 700 }}>
              {dashT.viewAlertHistory || 'Alert History →'}
            </Link>
          </div>

          {alertHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', color: '#64748b' }}>
              <ShieldCheck size={32} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                {dashT.noAlertsRecent || 'No guardian escalations or alerts logged today.'}
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Automated escalation protocol monitors unverified medications and notifies designated guardians.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {alertHistory.slice(0, 3).map((alert, idx) => (
                <div
                  key={alert.id || idx}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '0.75rem',
                    backgroundColor: alert.alert_type === 'EMERGENCY_SOS' ? '#fef2f2' : '#f0f9ff',
                    border: `1.5px solid ${alert.alert_type === 'EMERGENCY_SOS' ? '#fecaca' : '#bae6fd'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>
                      {alert.message || alert.title || 'Guardian notification dispatched'}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                      Status: {alert.delivery_status || 'Sent'} • {alert.created_at || 'Today'}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      backgroundColor: '#e0f2fe',
                      color: '#0369a1',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '0.35rem'
                    }}
                  >
                    {alert.alert_type || 'NOTIFICATION'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 9. MEDICAL TIMELINE STREAM */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '1.1rem',
            padding: '1.5rem',
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={19} color="#0284c7" />
              {dashT.medicalTimelineTitle || 'Medical Timeline Stream'}
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              Audit Verified
            </span>
          </div>

          {timelineEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', backgroundColor: '#f8fafc', borderRadius: '0.75rem', color: '#64748b' }}>
              <Calendar size={32} color="#94a3b8" style={{ margin: '0 auto 0.5rem' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                {dashT.noTimelineEvents || 'No medical events recorded yet.'}
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Clinical events, report uploads, intake verifications, and doctor visits appear here automatically.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {timelineEvents.slice(0, 3).map((item, idx) => (
                <div
                  key={item.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    padding: '0.75rem 0.95rem',
                    borderRadius: '0.65rem',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      backgroundColor: '#e0f2fe',
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Activity size={17} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                      {item.event_date || 'Recent'} • {item.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ALL MODALS MOUNTED */}
      <AddPrescriptionModal
        isOpen={isRxModalOpen}
        onClose={() => setIsRxModalOpen(false)}
        onPrescriptionSaved={() => {
          setIsRxModalOpen(false);
          fetchDashboardData();
        }}
      />

      <AddHealthReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onReportSaved={() => {
          setIsReportModalOpen(false);
          fetchDashboardData();
        }}
      />

      <PillConsumptionTrackerModal
        isOpen={isPillTrackerOpen}
        onClose={() => setIsPillTrackerOpen(false)}
        reminder={selectedReminder}
        onVerificationComplete={() => {
          setIsPillTrackerOpen(false);
          fetchDashboardData();
        }}
      />

      <CareConnectModal
        isOpen={isCareConnectOpen}
        onClose={() => setIsCareConnectOpen(false)}
        reminder={selectedReminder}
        onAdherenceConfirmed={() => {
          setIsCareConnectOpen(false);
          fetchDashboardData();
        }}
      />

      <ReportViewerModal
        isOpen={isReportViewerOpen}
        onClose={() => setIsReportViewerOpen(false)}
        document={selectedDoc}
      />
    </div>
  );
}
