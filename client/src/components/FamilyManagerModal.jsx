import React, { useState } from 'react';
import {
  X,
  Users,
  UserPlus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Baby,
  Heart,
  User,
  Info
} from 'lucide-react';
import { useFamily } from '../context/FamilyContext';
import { useLanguage } from '../context/LanguageContext';

export function FamilyManagerModal({ isOpen, onClose }) {
  const { familyMembers, addFamilyMember, revokeFamilyMember, activeProfile, switchProfile } = useFamily();
  const { t } = useLanguage();
  const familyT = t.family || {};

  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'add'
  const [formData, setFormData] = useState({
    fullName: '',
    relationship: 'child',
    dob: '',
    gender: 'other',
    bloodGroup: '',
    emergencyContact: '',
    guardianConsent: false
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    if (formData.relationship === 'child' && !formData.guardianConsent) {
      setError('Guardian consent is legally required to manage health data for a child under authorized guardianship.');
      return;
    }

    setLoading(true);
    try {
      const res = await addFamilyMember({
        fullName: formData.fullName.trim(),
        relationship: formData.relationship,
        dob: formData.dob || null,
        gender: formData.gender,
        bloodGroup: formData.bloodGroup || null,
        emergencyContact: formData.emergencyContact || null,
        guardianConsent: formData.guardianConsent
      });

      if (res.success) {
        setSuccess(`Successfully added ${formData.fullName} to family profiles.`);
        setFormData({
          fullName: '',
          relationship: 'child',
          dob: '',
          gender: 'other',
          bloodGroup: '',
          emergencyContact: '',
          guardianConsent: false
        });
        setActiveTab('list');
      } else {
        setError(res.error || 'Failed to add family member.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to revoke access and remove ${memberName}'s profile from your account? This action will safely disconnect their profile.`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await revokeFamilyMember(memberId);
      if (res.success) {
        setSuccess(`Revoked access for ${memberName}.`);
      } else {
        setError(res.error || 'Failed to revoke family member.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
          maxWidth: '580px',
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.65rem',
                backgroundColor: '#0284c7',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                {familyT.manageFamily || 'Family Health Management'}
              </h2>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                Separate, privacy-preserving profiles with guardian authorization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: '0.5rem'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <button
            onClick={() => { setActiveTab('list'); setError(null); setSuccess(null); }}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              border: 'none',
              borderBottom: activeTab === 'list' ? '2px solid #0284c7' : '2px solid transparent',
              backgroundColor: activeTab === 'list' ? '#ffffff' : 'transparent',
              color: activeTab === 'list' ? '#0284c7' : '#64748b',
              fontWeight: activeTab === 'list' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Active Profiles ({familyMembers.length})
          </button>
          <button
            onClick={() => { setActiveTab('add'); setError(null); setSuccess(null); }}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              border: 'none',
              borderBottom: activeTab === 'add' ? '2px solid #0284c7' : '2px solid transparent',
              backgroundColor: activeTab === 'add' ? '#ffffff' : 'transparent',
              color: activeTab === 'add' ? '#0284c7' : '#64748b',
              fontWeight: activeTab === 'add' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              transition: 'all 0.15s ease'
            }}
          >
            <UserPlus size={15} /> + Add Family Profile
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#b91c1c',
                fontSize: '0.8rem'
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#15803d',
                fontSize: '0.8rem'
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{success}</span>
            </div>
          )}

          {activeTab === 'list' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '0.6rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#1e40af'
                }}
              >
                <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Strict Cross-Profile Isolation:</strong> Each profile has separate prescriptions, timeline events, and Copilot memory. The backend rejects any unauthorized access attempt with HTTP 403 Forbidden.
                </span>
              </div>

              {familyMembers.map((member) => {
                const isCurrent = member.id === activeProfile?.id;
                const isPrimary = member.relationship?.toLowerCase() === 'self';

                return (
                  <div
                    key={member.id}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '0.75rem',
                      border: isCurrent ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                      backgroundColor: isCurrent ? '#f0f9ff' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: isPrimary ? '#e0f2fe' : member.relationship === 'child' ? '#fef3c7' : '#f3e8ff',
                          color: isPrimary ? '#0369a1' : member.relationship === 'child' ? '#b45309' : '#7e22ce',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700
                        }}
                      >
                        {member.relationship === 'child' ? <Baby size={18} /> : member.relationship === 'self' ? <User size={18} /> : <Heart size={18} />}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                            {member.full_name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              backgroundColor: '#e2e8f0',
                              color: '#334155',
                              fontWeight: 700,
                              textTransform: 'uppercase'
                            }}
                          >
                            {member.relationship}
                          </span>
                          {isCurrent && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '4px',
                                backgroundColor: '#0284c7',
                                color: '#ffffff',
                                fontWeight: 700
                              }}
                            >
                              ACTIVE
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.2rem', fontSize: '0.72rem', color: '#64748b' }}>
                          {member.dob && <span>DOB: {member.dob}</span>}
                          {member.gender && <span>Gender: {member.gender}</span>}
                          {member.blood_group && <span>Blood: {member.blood_group}</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {!isCurrent && (
                        <button
                          onClick={() => {
                            switchProfile(member.id);
                            onClose();
                          }}
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '0.45rem',
                            border: '1px solid #0284c7',
                            backgroundColor: '#ffffff',
                            color: '#0284c7',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Switch To
                        </button>
                      )}

                      {!isPrimary && (
                        <button
                          onClick={() => handleRevoke(member.id, member.full_name)}
                          disabled={loading}
                          title="Revoke & remove profile"
                          style={{
                            padding: '0.35rem',
                            borderRadius: '0.45rem',
                            border: '1px solid #fee2e2',
                            backgroundColor: '#fff1f2',
                            color: '#e11d48',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="e.g., Maya Rivera or Eleanor Rivera"
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Relationship *
                  </label>
                  <select
                    name="relationship"
                    value={formData.relationship}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="child">Child (Minor)</option>
                    <option value="dependent">Dependent Adult</option>
                    <option value="parent">Parent</option>
                    <option value="spouse">Spouse</option>
                    <option value="sibling">Sibling</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Gender
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other / Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Blood Group (Optional)
                  </label>
                  <input
                    type="text"
                    name="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={handleChange}
                    placeholder="e.g., A+, O-, B+"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Emergency Phone Contact
                </label>
                <input
                  type="tel"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* Guardian Consent Box */}
              <div
                style={{
                  padding: '0.85rem',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '0.6rem'
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="guardianConsent"
                    checked={formData.guardianConsent}
                    onChange={handleChange}
                    style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: '#0284c7' }}
                  />
                  <div style={{ fontSize: '0.75rem', color: '#334155', lineHeight: 1.35 }}>
                    <strong>Legal Guardian / Authorized Representative Consent</strong>
                    <p style={{ margin: '0.2rem 0 0', color: '#64748b' }}>
                      I certify that I am the authorized parent, legal guardian, or designated caregiver permitted to create, manage, and access healthcare records for this individual in compliance with healthcare data protection guidelines.
                    </p>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
                  }}
                >
                  {loading ? 'Creating Profile...' : 'Save Family Profile'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
