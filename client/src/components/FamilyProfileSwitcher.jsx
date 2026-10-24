import React, { useState, useRef, useEffect } from 'react';
import { Users, ChevronDown, Check, Plus, Shield, User, Baby, Heart } from 'lucide-react';
import { useFamily } from '../context/FamilyContext';
import { useLanguage } from '../context/LanguageContext';

export function FamilyProfileSwitcher({ onOpenManager }) {
  const { activeProfile, familyMembers, switchProfile, loading } = useFamily();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const familyT = t.family || {};

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getRelationBadge = (relation) => {
    switch (relation?.toLowerCase()) {
      case 'self':
        return { label: familyT.self || 'Self', bg: '#e0f2fe', color: '#0369a1', icon: User };
      case 'child':
        return { label: familyT.child || 'Child', bg: '#fef3c7', color: '#b45309', icon: Baby };
      case 'dependent':
      case 'parent':
        return { label: familyT.dependent || 'Dependent', bg: '#f3e8ff', color: '#7e22ce', icon: Heart };
      default:
        return { label: relation || 'Family', bg: '#f1f5f9', color: '#475569', icon: User };
    }
  };

  const activeBadge = getRelationBadge(activeProfile?.relationship || 'self');
  const ActiveIcon = activeBadge.icon;

  return (
    <div className="family-profile-switcher" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="profile-switcher-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.35rem 0.65rem',
          backgroundColor: '#f8fafc',
          border: '1.5px solid #cbd5e1',
          borderRadius: '9999px',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#1e293b',
          transition: 'all 0.15s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
        title="Active Patient Profile (click to switch between family members)"
      >
        <div
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            backgroundColor: activeBadge.bg,
            color: activeBadge.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.7rem'
          }}
        >
          <ActiveIcon size={12} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', lineHeight: 1.15 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeProfile?.full_name || 'Patient'}
          </span>
          <span style={{ fontSize: '0.62rem', color: activeBadge.color, fontWeight: 700, textTransform: 'uppercase' }}>
            {activeBadge.label}
          </span>
        </div>

        <ChevronDown size={14} style={{ color: '#64748b', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {isOpen && (
        <div
          className="family-dropdown-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '270px',
            backgroundColor: '#ffffff',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          <div style={{ padding: '0.65rem 0.85rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {familyT.switchProfile || 'Select Patient Profile'}
              </span>
              <span style={{ fontSize: '0.65rem', color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <Shield size={10} /> Isolated Data
              </span>
            </div>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.68rem', color: '#64748b' }}>
              Copilot, reports, and reminders adapt strictly to selected person.
            </p>
          </div>

          <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '0.35rem' }}>
            {familyMembers.map((member) => {
              const isSelected = member.id === activeProfile?.id;
              const badge = getRelationBadge(member.relationship);
              const MemberIcon = badge.icon;

              return (
                <button
                  key={member.id}
                  onClick={() => {
                    switchProfile(member.id);
                    setIsOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.65rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.1s ease',
                    marginBottom: '0.15rem'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        backgroundColor: badge.bg,
                        color: badge.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem'
                      }}
                    >
                      <MemberIcon size={14} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: isSelected ? 700 : 600, color: isSelected ? '#0284c7' : '#1e293b' }}>
                        {member.full_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem' }}>
                        <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: badge.bg, color: badge.color, fontWeight: 700 }}>
                          {badge.label}
                        </span>
                        {member.blood_group && (
                          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                            {member.blood_group}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div style={{ color: '#0284c7', display: 'flex', alignItems: 'center' }}>
                      <Check size={16} strokeWidth={2.5} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ padding: '0.5rem 0.65rem', borderTop: '1px solid #f1f5f9', backgroundColor: '#fafafa' }}>
            <button
              onClick={() => {
                setIsOpen(false);
                if (onOpenManager) onOpenManager();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                padding: '0.45rem',
                borderRadius: '0.5rem',
                border: '1px dashed #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#0284c7',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f0f9ff';
                e.currentTarget.style.borderColor = '#0284c7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              <Plus size={14} /> {familyT.manageFamily || 'Manage Family Members'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
