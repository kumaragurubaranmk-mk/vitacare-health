import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  HeartPulse,
  Sun,
  Moon,
  Sparkles,
  User,
  LogOut,
  Shield,
  AlertTriangle,
  PlusCircle,
  FilePlus,
  Activity,
  Bot
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useTheme } from '../context/ThemeContext';
import { LanguageSelector } from './LanguageSelector';
import { EmergencySosModal } from './EmergencySosModal';
import { AddPrescriptionModal } from './AddPrescriptionModal';
import { AddHealthReportModal } from './AddHealthReportModal';
import { FamilyProfileSwitcher } from './FamilyProfileSwitcher';
import { FamilyManagerModal } from './FamilyManagerModal';
import { AbhaSandboxModal } from './AbhaSandboxModal';

export function Navbar() {
  const { user, isAuthenticated, logout, isDemoMode, toggleDemoMode } = useAuth();
  const { isAdminAuthenticated } = useAdminAuth();
  const { theme, toggleTheme } = useTheme();
  const [isSosOpen, setIsSosOpen] = useState(false);
  const [isAddRxOpen, setIsAddRxOpen] = useState(false);
  const [isAddReportOpen, setIsAddReportOpen] = useState(false);
  const [isFamilyOpen, setIsFamilyOpen] = useState(false);
  const [isAbhaOpen, setIsAbhaOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <header className="top-nav" style={{ padding: '0.65rem 1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <Link to="/" className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
            <div
              className="nav-brand-icon"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)'
              }}
            >
              <HeartPulse size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a', lineHeight: 1.1 }}>
                VitaCare <span style={{ color: '#0284c7' }}>AI</span>
              </div>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', letterSpacing: '0.01em' }}>
                Your Health. Organized. Intelligent. Connected.
              </div>
            </div>
          </Link>

          {isAuthenticated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.75rem' }}>
              <button
                onClick={() => setIsAddRxOpen(true)}
                style={{
                  backgroundColor: '#f0f9ff',
                  border: '1.5px solid #0284c7',
                  color: '#0284c7',
                  borderRadius: '0.5rem',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.785rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title="Add prescription with OCR & AI extraction"
              >
                <PlusCircle size={14} /> + ADD PRESCRIPTION
              </button>

              <button
                onClick={() => setIsAddReportOpen(true)}
                style={{
                  backgroundColor: '#0284c7',
                  border: '1.5px solid #0284c7',
                  color: '#ffffff',
                  borderRadius: '0.5rem',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.785rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                  transition: 'all 0.15s ease'
                }}
                title="Add medical report with OCR & automatic profile populating"
              >
                <FilePlus size={14} /> + ADD HEALTH REPORT
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          {/* EMERGENCY SOS BUTTON */}
          <button
            onClick={() => setIsSosOpen(true)}
            style={{
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.35rem 0.8rem',
              fontWeight: 800,
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.35)'
            }}
            title="Emergency SOS dispatch"
          >
            <AlertTriangle size={13} />
            SOS
          </button>

          {/* VitaCare Intelligence Bonus Dashboard Link */}
          <Link
            to="/intelligence"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
              color: '#ffffff',
              fontSize: '0.785rem',
              fontWeight: 700,
              borderRadius: '0.5rem',
              padding: '0.35rem 0.75rem',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)',
              transition: 'transform 0.15s ease'
            }}
            title="VitaCare Intelligence — Live Bonus Demonstration Dashboard"
          >
            <Sparkles size={14} /> Intelligence
          </Link>

          {/* Multilingual Selector */}
          <LanguageSelector compact />

          {/* User Auth Controls */}
          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {/* Family Profile Switcher */}
              <FamilyProfileSwitcher onOpenManager={() => setIsFamilyOpen(true)} />

              <button
                onClick={() => setIsAbhaOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: '#ecfdf5',
                  border: '1.5px solid #059669',
                  color: '#065f46',
                  borderRadius: '9999px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="Ayushman Bharat Digital Mission (ABDM) / ABHA Sandbox"
              >
                <Shield size={13} color="#059669" /> ABHA
              </button>

              <Link to="/ai-assistant" className="btn btn-ghost btn-sm" style={{ gap: '0.35rem', color: '#0284c7', fontWeight: 600 }}>
                <Bot size={15} /> Copilot
              </Link>
              <Link to="/dashboard" className="btn btn-secondary btn-sm" style={{ gap: '0.35rem' }}>
                <User size={15} /> {user?.full_name?.split(' ')[0] || 'Dashboard'}
              </Link>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="btn btn-ghost btn-sm"
                title="Sign Out"
                style={{ padding: '0.45rem' }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Link to="/login" className="btn btn-ghost btn-sm">Sign In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Create Account</Link>
            </div>
          )}

          {/* Admin Link (Requirement 1) */}
          <Link
            to={isAdminAuthenticated ? "/admin/dashboard" : "/admin/login"}
            className="btn btn-ghost btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: '#334155',
              fontSize: '0.785rem',
              fontWeight: 600,
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              padding: '0.35rem 0.65rem',
              textDecoration: 'none',
              background: '#f8fafc'
            }}
            title="Secure Administrator Portal"
          >
            <Shield size={14} color="#0284c7" />
            Admin
          </Link>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="btn btn-ghost btn-sm"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            style={{ padding: '0.45rem' }}
          >
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
        </div>
      </header>

      {/* Emergency SOS Modal Global Mount */}
      <EmergencySosModal
        isOpen={isSosOpen}
        onClose={() => setIsSosOpen(false)}
      />

      {/* Quick Action Add Prescription Modal */}
      <AddPrescriptionModal
        isOpen={isAddRxOpen}
        onClose={() => setIsAddRxOpen(false)}
        onPrescriptionSaved={() => {
          setIsAddRxOpen(false);
          // dispatch custom event to refresh data across tabs
          window.dispatchEvent(new Event('vitacare:data-updated'));
        }}
      />

      {/* Quick Action Add Health Report Modal */}
      <AddHealthReportModal
        isOpen={isAddReportOpen}
        onClose={() => setIsAddReportOpen(false)}
        onReportSaved={() => {
          setIsAddReportOpen(false);
          window.dispatchEvent(new Event('vitacare:data-updated'));
        }}
      />

      {/* Family Health Profiles Manager Modal */}
      <FamilyManagerModal
        isOpen={isFamilyOpen}
        onClose={() => setIsFamilyOpen(false)}
      />

      {/* ABDM / ABHA Sandbox Modal */}
      <AbhaSandboxModal
        isOpen={isAbhaOpen}
        onClose={() => setIsAbhaOpen(false)}
      />
    </>
  );
}
