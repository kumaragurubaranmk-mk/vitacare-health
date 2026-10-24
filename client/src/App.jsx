import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Providers
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { FamilyProvider } from './context/FamilyContext';

// Components
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { AdminSidebar } from './components/AdminSidebar';
import { Footer } from './components/Footer';

// Public Pages
import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/public/LoginPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { OtpVerificationPage } from './pages/public/OtpVerificationPage';
import { ForgotPasswordPage } from './pages/public/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/public/ResetPasswordPage';
import { PrivacyPolicyPage } from './pages/public/PrivacyPolicyPage';
import { TermsPage } from './pages/public/TermsPage';

// User Pages
import { DashboardPage } from './pages/user/DashboardPage';
import { HealthTrackerPage } from './pages/user/HealthTrackerPage';
import { MedicationReminderPage } from './pages/user/MedicationReminderPage';
import { MedicalTimelinePage } from './pages/user/MedicalTimelinePage';
import { HealthRecordsPage } from './pages/user/HealthRecordsPage';
import { AiAssistantPage } from './pages/user/AiAssistantPage';
import { SymptomCheckerPage } from './pages/user/SymptomCheckerPage';
import { HealthProfilePage } from './pages/user/HealthProfilePage';
import { AppointmentsPage } from './pages/user/AppointmentsPage';
import { EducationPage } from './pages/user/EducationPage';
import { MedicalDictionaryPage } from './pages/user/MedicalDictionaryPage';
import { EmergencyPage } from './pages/user/EmergencyPage';
import { SettingsPage } from './pages/user/SettingsPage';
import { UnifiedHealthHubPage } from './pages/user/UnifiedHealthHubPage';
import { AlertHistoryPage } from './pages/user/AlertHistoryPage';
import { VitaCareIntelligencePage } from './pages/user/VitaCareIntelligencePage';

// Admin Pages
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminContentPage } from './pages/admin/AdminContentPage';
import { AdminDictionaryPage } from './pages/admin/AdminDictionaryPage';
import { AdminFeedbackPage } from './pages/admin/AdminFeedbackPage';
import { AdminAuditLogsPage } from './pages/admin/AdminAuditLogsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminMedicinesPage } from './pages/admin/AdminMedicinesPage';

// Protected Route for User
function UserRoute({ children }) {
  const { isAuthenticated, isDemoMode, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated && !isDemoMode) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Protected Route for Admin
function AdminRoute({ children }) {
  const { isAdminAuthenticated } = useAdminAuth();
  if (!isAdminAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}

// User Layout (Sidebar + Top Navbar)
function UserLayout({ children }) {
  return (
    <div className="app-container">
      <Navbar />
      <div className="dashboard-layout">
        <Sidebar />
        <main className="dashboard-main">
          {children}
        </main>
      </div>
    </div>
  );
}

// Admin Layout
function AdminLayout({ children }) {
  return (
    <div className="dashboard-layout">
      <AdminSidebar />
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}

// Public Layout
function PublicLayout({ children }) {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <FamilyProvider>
            <AdminAuthProvider>
              <BrowserRouter>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<PublicLayout><LandingPage /></PublicLayout>} />
                  <Route path="/login" element={<PublicLayout><LoginPage /></PublicLayout>} />
                  <Route path="/register" element={<PublicLayout><RegisterPage /></PublicLayout>} />
                  <Route path="/verify-otp" element={<PublicLayout><OtpVerificationPage /></PublicLayout>} />
                  <Route path="/forgot-password" element={<PublicLayout><ForgotPasswordPage /></PublicLayout>} />
                  <Route path="/reset-password" element={<PublicLayout><ResetPasswordPage /></PublicLayout>} />
                  <Route path="/privacy" element={<PublicLayout><PrivacyPolicyPage /></PublicLayout>} />
                  <Route path="/terms" element={<PublicLayout><TermsPage /></PublicLayout>} />

                  {/* User Portal Routes */}
                  <Route path="/dashboard" element={<UserRoute><UserLayout><DashboardPage /></UserLayout></UserRoute>} />
                  <Route path="/intelligence" element={<UserRoute><UserLayout><VitaCareIntelligencePage /></UserLayout></UserRoute>} />
                  <Route path="/health-tracker" element={<UserRoute><UserLayout><HealthTrackerPage /></UserLayout></UserRoute>} />
                  <Route path="/medications" element={<UserRoute><UserLayout><MedicationReminderPage /></UserLayout></UserRoute>} />
                  <Route path="/timeline" element={<UserRoute><UserLayout><MedicalTimelinePage /></UserLayout></UserRoute>} />
                  <Route path="/reports" element={<UserRoute><UserLayout><HealthRecordsPage /></UserLayout></UserRoute>} />
                  <Route path="/health-records" element={<UserRoute><UserLayout><HealthRecordsPage /></UserLayout></UserRoute>} />
                  <Route path="/ai-assistant" element={<UserRoute><UserLayout><AiAssistantPage /></UserLayout></UserRoute>} />
                  <Route path="/ai-copilot" element={<UserRoute><UserLayout><AiAssistantPage /></UserLayout></UserRoute>} />
                  <Route path="/health-hub" element={<UserRoute><UserLayout><UnifiedHealthHubPage /></UserLayout></UserRoute>} />
                  <Route path="/symptom-checker" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/profile" element={<UserRoute><UserLayout><HealthProfilePage /></UserLayout></UserRoute>} />
                  <Route path="/appointments" element={<UserRoute><UserLayout><AppointmentsPage /></UserLayout></UserRoute>} />
                  <Route path="/education" element={<UserRoute><UserLayout><EducationPage /></UserLayout></UserRoute>} />
                  <Route path="/medical-dictionary" element={<UserRoute><UserLayout><MedicalDictionaryPage /></UserLayout></UserRoute>} />
                  <Route path="/emergency" element={<UserRoute><UserLayout><EmergencyPage /></UserLayout></UserRoute>} />
                  <Route path="/alert-history" element={<UserRoute><UserLayout><AlertHistoryPage /></UserLayout></UserRoute>} />
                  <Route path="/settings" element={<UserRoute><UserLayout><SettingsPage /></UserLayout></UserRoute>} />

                  {/* Admin Portal Routes */}
                  <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="/admin/login" element={<AdminLoginPage />} />
                  <Route path="/admin/dashboard" element={<AdminRoute><AdminLayout><AdminDashboardPage /></AdminLayout></AdminRoute>} />
                  <Route path="/admin/medicines" element={<AdminRoute><AdminLayout><AdminMedicinesPage /></AdminLayout></AdminRoute>} />
                  <Route path="/admin/users" element={<AdminRoute><AdminLayout><AdminUsersPage /></AdminLayout></AdminRoute>} />
                  <Route path="/admin/content" element={<AdminRoute><AdminLayout><AdminContentPage /></AdminLayout></AdminRoute>} />
                  <Route path="/admin/medical-dictionary" element={<AdminRoute><AdminLayout><AdminDictionaryPage /></AdminLayout></AdminRoute>} />
                  <Route path="/admin/feedback" element={<AdminRoute><AdminLayout><AdminFeedbackPage /></AdminLayout></AdminRoute>} />
                  <Route path="/admin/audit-logs" element={<AdminRoute><AdminLayout><AdminAuditLogsPage /></AdminLayout></AdminRoute>} />
                  <Route path="/admin/settings" element={<AdminRoute><AdminLayout><AdminSettingsPage /></AdminLayout></AdminRoute>} />

                  {/* Catch All Redirect */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </AdminAuthProvider>
          </FamilyProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
