import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  Pill,
  Clock,
  FileText,
  Bot,
  Stethoscope,
  UserCheck,
  Settings,
  ShieldCheck,
  Bell,
  Download,
  Sparkles,
  Users
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export function Sidebar() {
  const { t } = useLanguage();
  const navT = t.nav || {};

  const links = [
    { to: '/dashboard', label: navT.dashboard || 'Dashboard', icon: LayoutDashboard },
    { to: '/intelligence', label: navT.intelligence || 'VitaCare Intelligence', icon: Sparkles },
    { to: '/health-tracker', label: navT.healthTracker || 'Health Tracker', icon: Activity },
    { to: '/medications', label: navT.medications || 'Medications', icon: Pill },
    { to: '/alert-history', label: navT.alertHistory || 'Alert History', icon: Bell },
    { to: '/timeline', label: 'Timeline', icon: Clock },
    { to: '/reports', label: navT.healthReports || 'Health Reports & Rx', icon: FileText },
    { to: '/ai-assistant', label: navT.assistant || 'AI Assistant', icon: Bot },
    { to: '/profile', label: navT.profile || 'Profile', icon: UserCheck },
    { to: '/settings', label: navT.settings || 'Settings', icon: Settings }
  ];

  return (
    <aside className="sidebar" style={{ width: '250px', background: '#ffffff', borderRight: '1px solid #e2e8f0' }}>
      <div className="sidebar-menu" style={{ padding: '1rem 0.75rem' }}>
        <span
          className="sidebar-heading"
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: '#64748b',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            padding: '0 0.5rem 0.5rem',
            display: 'block'
          }}
        >
          VitaCare Modules
        </span>
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.6rem 0.85rem',
                borderRadius: '0.6rem',
                textDecoration: 'none',
                fontSize: '0.86rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#0284c7' : '#334155',
                backgroundColor: isActive ? '#f0f9ff' : 'transparent',
                borderLeft: isActive ? '3px solid #0284c7' : '3px solid transparent',
                marginBottom: '0.2rem',
                transition: 'all 0.15s ease'
              })}
            >
              <Icon size={18} />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="sidebar-footer" style={{ padding: '0.85rem', borderTop: '1px solid #f1f5f9' }}>
        <a
          href="/api/download-project"
          download="VitaCare-AI-HealthGPT.zip"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            padding: '0.55rem 0.75rem',
            marginBottom: '0.65rem',
            borderRadius: '0.6rem',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            textDecoration: 'none',
            fontSize: '0.78rem',
            fontWeight: 700,
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
            transition: 'background-color 0.15s ease'
          }}
          title="Download complete project source code ZIP"
        >
          <Download size={14} />
          <span>Download All Files (ZIP)</span>
        </a>

        <div
          style={{
            padding: '0.6rem 0.75rem',
            borderRadius: '0.6rem',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            fontSize: '0.72rem',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem'
          }}
        >
          <ShieldCheck size={15} style={{ color: '#10b981', flexShrink: 0 }} />
          <span>VitaCare Verified Medical AI</span>
        </div>
      </div>
    </aside>
  );
}
