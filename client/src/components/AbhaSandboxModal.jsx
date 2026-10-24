import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  FileCode,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Layers,
  Activity
} from 'lucide-react';
import { useFamily } from '../context/FamilyContext';

export function AbhaSandboxModal({ isOpen, onClose }) {
  const { activeProfile } = useFamily();
  const [loading, setLoading] = useState(false);
  const [abhaProfile, setAbhaProfile] = useState(null);
  const [fhirBundle, setFhirBundle] = useState(null);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'fhir'
  const [step, setStep] = useState(1); // 1: input, 2: otp
  const [testAbhaNumber, setTestAbhaNumber] = useState('91-5821-4902-1844');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [txnId, setTxnId] = useState(null);
  const [otpHint, setOtpHnt] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAbhaData();
    }
  }, [isOpen, activeProfile]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const loadAbhaData = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const profileIdQuery = activeProfile?.id ? `?profile_id=${activeProfile.id}` : '';
      const [pRes, fRes] = await Promise.all([
        fetch(`/api/abdm/profile${profileIdQuery}`, { headers: getAuthHeaders() }),
        fetch(`/api/abdm/fhir/bundle${profileIdQuery}`, { headers: getAuthHeaders() })
      ]);

      if (pRes.ok) {
        const pData = await pRes.json();
        setAbhaProfile(pData.profile);
      } else {
        setAbhaProfile(null);
      }

      if (fRes.ok) {
        const fData = await fRes.json();
        setFhirBundle(fData);
      }
    } catch (err) {
      console.error('Failed to load ABHA/FHIR data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/abdm/mock-otp', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          abhaNumber: testAbhaNumber,
          profile_id: activeProfile?.id
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTxnId(data.txnId);
        setOtpHnt(data.testOtpHint);
        setStep(2);
        setStatusMessage({ type: 'success', text: `Mock OTP generated: ${data.testOtpHint}` });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to request OTP' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/abdm/link', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          abhaNumber: testAbhaNumber,
          otp: enteredOtp,
          txnId: txnId,
          profile_id: activeProfile?.id
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAbhaProfile(data.profile);
        setStep(1);
        setStatusMessage({ type: 'success', text: 'Mock ABHA profile linked successfully!' });
        loadAbhaData();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'OTP verification failed' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!window.confirm('Disconnect and unlink this Mock ABHA identifier?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/abdm/unlink', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ profile_id: activeProfile?.id })
      });
      if (res.ok) {
        setAbhaProfile(null);
        setStatusMessage({ type: 'info', text: 'Mock ABHA unlinked.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyFhir = () => {
    if (!fhirBundle) return;
    navigator.clipboard.writeText(JSON.stringify(fhirBundle, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #047857 0%, #059669 100%)',
            color: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.65rem',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)'
              }}
            >
              <Shield size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                  ABDM & ABHA Integration Sandbox
                </h2>
                <span
                  style={{
                    fontSize: '0.65rem',
                    backgroundColor: '#fef08a',
                    color: '#854d0e',
                    fontWeight: 800,
                    padding: '0.1rem 0.45rem',
                    borderRadius: '4px'
                  }}
                >
                  TEST SIMULATION
                </span>
              </div>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', opacity: 0.9 }}>
                HL7 FHIR R4 Ready • Mock ABDM Ecosystem Connector
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: '0.5rem'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Test Notice Banner */}
        <div
          style={{
            padding: '0.65rem 1.25rem',
            backgroundColor: '#fffbeb',
            borderBottom: '1px solid #fef3c7',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.73rem',
            color: '#92400e'
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>
            <strong>Sandbox Evaluation Notice:</strong> Uses standard-compliant mock ABHA numbers (e.g. <code>91-XXXX-XXXX-XXXX</code>) and test OTP <code>123456</code>. Production ABDM integration requires authorized NHA credentials & client IDs.
          </span>
        </div>

        {/* Tab Bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              border: 'none',
              borderBottom: activeTab === 'profile' ? '2px solid #059669' : '2px solid transparent',
              backgroundColor: activeTab === 'profile' ? '#ffffff' : 'transparent',
              color: activeTab === 'profile' ? '#047857' : '#64748b',
              fontWeight: activeTab === 'profile' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <QrCode size={16} /> Mock ABHA Card
          </button>
          <button
            onClick={() => setActiveTab('fhir')}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              border: 'none',
              borderBottom: activeTab === 'fhir' ? '2px solid #059669' : '2px solid transparent',
              backgroundColor: activeTab === 'fhir' ? '#ffffff' : 'transparent',
              color: activeTab === 'fhir' ? '#047857' : '#64748b',
              fontWeight: activeTab === 'fhir' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <FileCode size={16} /> FHIR R4 Resources ({fhirBundle?.total || 0})
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {statusMessage && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.65rem 0.85rem',
                borderRadius: '0.5rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: statusMessage.type === 'success' ? '#f0fdf4' : statusMessage.type === 'error' ? '#fef2f2' : '#f0f9ff',
                color: statusMessage.type === 'success' ? '#15803d' : statusMessage.type === 'error' ? '#b91c1c' : '#0369a1',
                border: `1px solid ${statusMessage.type === 'success' ? '#bbf7d0' : statusMessage.type === 'error' ? '#fecaca' : '#bae6fd'}`
              }}
            >
              {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {activeTab === 'profile' ? (
            <div>
              {abhaProfile ? (
                <div>
                  {/* Digital ABHA Card Representation */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #064e3b 0%, #047857 60%, #059669 100%)',
                      borderRadius: '1rem',
                      padding: '1.5rem',
                      color: '#ffffff',
                      boxShadow: '0 10px 20px rgba(4, 120, 87, 0.25)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>
                          NATIONAL HEALTH AUTHORITY • ABDM SANDBOX
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '0.35rem' }}>
                          Ayushman Bharat Health Account
                        </div>
                      </div>
                      <div
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.15)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: 700
                        }}
                      >
                        SANDBOX VERIFIED
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', marginTop: '1.5rem', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>ABHA Number</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.06em', fontFamily: 'monospace' }}>
                          {abhaProfile.abha_number}
                        </div>

                        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1.5rem' }}>
                          <div>
                            <div style={{ fontSize: '0.65rem', opacity: 0.75 }}>ABHA Address</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                              {abhaProfile.abha_address}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.65rem', opacity: 0.75 }}>Patient Name</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                              {abhaProfile.full_name}
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1.5rem', fontSize: '0.72rem', opacity: 0.85 }}>
                          <span>DOB: {abhaProfile.dob || '1988-06-14'}</span>
                          <span>Gender: {abhaProfile.gender?.toUpperCase() || 'MALE'}</span>
                          <span>Profile: {activeProfile?.full_name || 'Primary'}</span>
                        </div>
                      </div>

                      {/* Mock QR */}
                      <div
                        style={{
                          backgroundColor: '#ffffff',
                          padding: '0.5rem',
                          borderRadius: '0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#0f172a'
                        }}
                      >
                        <QrCode size={64} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Status: <strong style={{ color: '#059669' }}>Active Mock Link</strong> • Standards: FHIR R4
                    </div>
                    <button
                      onClick={handleUnlink}
                      disabled={loading}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #fee2e2',
                        backgroundColor: '#fff1f2',
                        color: '#e11d48',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Disconnect Mock ABHA
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '0.5rem 0' }}>
                  <div
                    style={{
                      padding: '1rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '0.75rem',
                      border: '1px solid #e2e8f0',
                      marginBottom: '1.25rem'
                    }}
                  >
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.4rem' }}>
                      Connect Test ABHA ID
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4 }}>
                      Simulate linking an Ayushman Bharat Health Account to this patient profile. In sandbox mode, use the test ABHA number below and fixed verification OTP <code>123456</code>.
                    </p>
                  </div>

                  {step === 1 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                          Mock ABHA Number (14 digits)
                        </label>
                        <input
                          type="text"
                          value={testAbhaNumber}
                          onChange={(e) => setTestAbhaNumber(e.target.value)}
                          placeholder="91-5821-4902-1844"
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.85rem',
                            borderRadius: '0.5rem',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '0.9rem',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          onClick={handleRequestOtp}
                          disabled={loading}
                          style={{
                            padding: '0.6rem 1.25rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)'
                          }}
                        >
                          {loading ? 'Requesting OTP...' : 'Generate Mock OTP →'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div
                        style={{
                          padding: '0.65rem 0.85rem',
                          backgroundColor: '#ecfdf5',
                          borderRadius: '0.5rem',
                          border: '1px solid #a7f3d0',
                          fontSize: '0.78rem',
                          color: '#065f46'
                        }}
                      >
                        OTP sent to registered sandbox device. <strong>Use test OTP: 123456</strong>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                          Enter Verification OTP
                        </label>
                        <input
                          type="text"
                          value={enteredOtp}
                          onChange={(e) => setEnteredOtp(e.target.value)}
                          placeholder="123456"
                          maxLength={6}
                          style={{
                            width: '100%',
                            padding: '0.6rem 0.85rem',
                            borderRadius: '0.5rem',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '1.1rem',
                            fontFamily: 'monospace',
                            letterSpacing: '0.2em',
                            textAlign: 'center'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button
                          onClick={() => setStep(1)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#64748b',
                            fontSize: '0.78rem',
                            cursor: 'pointer'
                          }}
                        >
                          ← Change ABHA Number
                        </button>

                        <button
                          onClick={handleVerifyOtp}
                          disabled={loading}
                          style={{
                            padding: '0.6rem 1.25rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            backgroundColor: '#059669',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: loading ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {loading ? 'Verifying...' : 'Verify & Link Sandbox ABHA'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                  Standard: <strong>HL7 FHIR Release 4</strong> • Resources in bundle: <strong>{fhirBundle?.total || 0}</strong>
                </div>
                <button
                  onClick={handleCopyFhir}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '0.45rem',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied to Clipboard' : 'Copy JSON'}</span>
                </button>
              </div>

              <div
                style={{
                  backgroundColor: '#0f172a',
                  color: '#38bdf8',
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  fontFamily: 'monospace',
                  fontSize: '0.72rem',
                  maxHeight: '360px',
                  overflowY: 'auto',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap'
                }}
              >
                {fhirBundle ? JSON.stringify(fhirBundle, null, 2) : '// Loading FHIR R4 Bundle...'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
