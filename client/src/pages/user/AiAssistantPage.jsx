import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Plus,
  Trash2,
  Search,
  AlertTriangle,
  Sparkles,
  Info,
  Clock,
  ShieldCheck,
  ChevronRight,
  Pill,
  FileText,
  Activity,
  Heart,
  Key,
  CheckCircle2,
  Check,
  X,
  Zap,
  RefreshCw,
  Sliders,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Users,
  ShieldAlert,
  Play
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useFamily } from '../../context/FamilyContext';
import { EmergencyBanner } from '../../components/EmergencyBanner';

export function AiAssistantPage() {
  const { token, isDemoMode } = useAuth();
  const { language, t } = useLanguage();
  const { activeProfile, familyMembers } = useFamily();

  const voiceT = t.voice || {};
  const agenticT = t.agentic || {};
  const familyT = t.family || {};

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [emergencyAlert, setEmergencyAlert] = useState(null);

  // Voice STT State
  const [isListening, setIsListening] = useState(false);
  const [transcriptPreview, setTranscriptPreview] = useState('');
  const [voiceError, setVoiceError] = useState(null);
  const recognitionRef = useRef(null);

  // Voice TTS State
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState(null);
  const synthRef = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);

  // Staged Action Confirmation State
  const [confirmingActionId, setConfirmingActionId] = useState(null);

  // API Key & Model Configuration
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('vitacare_ai_api_key') || '');
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('vitacare_ai_provider') || 'auto');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [keyProviderInput, setKeyProviderInput] = useState('auto');
  const [keySaveMsg, setKeySaveMsg] = useState('');
  const [testStatus, setTestStatus] = useState('idle');
  const [testResult, setTestResult] = useState('');

  const messagesEndRef = useRef(null);

  // Bonus credit & Requirement Prompts
  const suggestedQuestions = [
    { text: "What changes can you see in my recent health reports?", icon: Activity, tag: "Report Trends" },
    { text: "What medicines do I have today?", icon: Pill, tag: "Medications" },
    { text: "When is my next medicine?", icon: Clock, tag: "Schedule" },
    { text: "Schedule a reminder for Vitamin D3 at 8:00 PM", icon: Sparkles, tag: "Agentic Tool" },
    { text: "Show my recent blood glucose results.", icon: FileText, tag: "Records" }
  ];

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;

      // Map app language to speech BCP-47 tag
      const langMap = {
        'en': 'en-IN',
        'ta': 'ta-IN',
        'hi': 'hi-IN',
        'te': 'te-IN'
      };
      recognition.lang = langMap[language] || 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscriptPreview(currentTranscript);
        setInputMessage(currentTranscript);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setVoiceError(voiceT.micPermissionDenied || 'Microphone access was denied. Please allow microphone permissions in your browser or type below.');
        } else if (event.error === 'no-speech') {
          setVoiceError('No speech was detected. Please try speaking again.');
        } else {
          setVoiceError(`Voice recognition: ${event.error}. You can type your question.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      if (synthRef.current) {
        try { synthRef.current.cancel(); } catch (e) {}
      }
    };
  }, [language]);

  // Stop TTS when leaving
  useEffect(() => {
    return () => {
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [token, isDemoMode, activeProfile]);

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    }
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleSpeechRecognition = () => {
    if (!recognitionRef.current) {
      setVoiceError(voiceT.unsupportedBrowser || 'Speech recognition is not supported in this browser. Please type your query.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscriptPreview('');
      setVoiceError(null);
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('Recognition start error:', e);
      }
    }
  };

  const handleSpeakText = (msgId, text) => {
    if (!synthRef.current) {
      alert('Text-to-speech audio output is not supported in this browser environment.');
      return;
    }

    // If already speaking this message, stop
    if (currentlySpeakingId === msgId) {
      synthRef.current.cancel();
      setCurrentlySpeakingId(null);
      return;
    }

    synthRef.current.cancel();

    // Clean markdown asterisks and hashtags for clean voice playback
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s?/g, '')
      .replace(/`{1,3}/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const langMap = {
      'en': 'en-IN',
      'ta': 'ta-IN',
      'hi': 'hi-IN',
      'te': 'te-IN'
    };
    utterance.lang = langMap[language] || 'en-IN';
    utterance.rate = 0.95;

    utterance.onstart = () => {
      setCurrentlySpeakingId(msgId);
    };
    utterance.onend = () => {
      setCurrentlySpeakingId(null);
    };
    utterance.onerror = () => {
      setCurrentlySpeakingId(null);
    };

    synthRef.current.speak(utterance);
  };

  const fetchConversations = async () => {
    const authToken = token || localStorage.getItem('token');
    if (!authToken) {
      initDefaultConversation();
      return;
    }

    try {
      const profileQuery = activeProfile?.id ? `?profile_id=${activeProfile.id}` : '';
      const res = await fetch(`/api/conversations${profileQuery}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        const convs = (data.conversations || []).filter(c => c.module_type === 'assistant' || !c.module_type);
        setConversations(convs);
        if (convs.length > 0 && !activeConversationId) {
          setActiveConversationId(convs[0].id);
        } else if (convs.length === 0) {
          initDefaultConversation();
        }
      } else {
        initDefaultConversation();
      }
    } catch (err) {
      console.error('Fetch conversations error:', err);
      initDefaultConversation();
    }
  };

  const initDefaultConversation = () => {
    const defaultConv = { id: 'conv-default', title: 'VitaCare Health Inquiry' };
    setConversations([defaultConv]);
    setActiveConversationId('conv-default');
    setMessages([
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: `Hello ${activeProfile?.full_name ? activeProfile.full_name : ''}! I am your **VitaCare AI Personal Health Copilot** scoped to **${activeProfile?.full_name || 'your'}** health records.\n\nI can verify medicines, review uploaded lab reports, compare measurement changes over time, and help schedule dose reminders. How can I assist you today?`,
        is_extracted_info: false
      }
    ]);
  };

  const fetchMessages = async (convId) => {
    if (convId === 'conv-default') return;
    const authToken = token || localStorage.getItem('token');
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || inputMessage;
    if (!query.trim() || loading) return;

    setInputMessage('');
    setTranscriptPreview('');
    setLoading(true);
    setEmergencyAlert(null);
    setVoiceError(null);

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query
    };
    setMessages(prev => [...prev, userMsg]);

    const authToken = token || localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    };

    const currentKey = apiKey || localStorage.getItem('vitacare_ai_api_key') || '';
    const currentProvider = aiProvider || localStorage.getItem('vitacare_ai_provider') || 'auto';

    try {
      // Direct call to Agentic Copilot endpoint for allowlisted tools & confirmation workflows
      const res = await fetch('/api/agentic/query', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: query,
          conversation_id: activeConversationId === 'conv-default' ? null : activeConversationId,
          language: language || 'en',
          profile_id: activeProfile?.id,
          apiKey: currentKey,
          provider: currentProvider
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.is_emergency) {
          setEmergencyAlert(data.emergency_details || { detected: true });
        }

        const botMsg = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: data.reply || data.message || 'I have analyzed your query based on your authorized health records.',
          structured_data: data.structured_data,
          is_extracted_info: data.tools_executed?.length > 0 || data.used_stored_records,
          tools_executed: data.tools_executed || [],
          requires_confirmation: data.requires_confirmation,
          staged_action: data.staged_action,
          grounding_summary: data.grounding_summary,
          profile_name: data.profile_name
        };
        setMessages(prev => [...prev, botMsg]);

        if (data.conversation_id && activeConversationId === 'conv-default') {
          setActiveConversationId(data.conversation_id);
          fetchConversations();
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessages(prev => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            role: 'assistant',
            content: errData.error || 'Unable to process health query. Server encountered an error.',
            is_error: true
          }
        ]);
      }
    } catch (err) {
      console.error('Agentic Copilot error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: 'Unable to connect to the VitaCare AI Copilot service. Please check your network connection.',
          is_error: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmStagedAction = async (msgId, actionId, decision) => {
    setConfirmingActionId(actionId);
    const authToken = token || localStorage.getItem('token');
    try {
      const res = await fetch('/api/agentic/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          action_id: actionId,
          action: decision
        })
      });

      const data = await res.json();
      if (res.ok) {
        // Update the message state to mark as resolved
        setMessages(prev => prev.map(m => {
          if (m.staged_action?.id === actionId) {
            return {
              ...m,
              requires_confirmation: false,
              staged_action: {
                ...m.staged_action,
                status: decision === 'confirm' ? 'confirmed' : 'declined',
                resolutionMessage: data.message
              }
            };
          }
          return m;
        }));
      } else {
        alert(data.error || 'Failed to update action.');
      }
    } catch (err) {
      alert('Error updating action: ' + err.message);
    } finally {
      setConfirmingActionId(null);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.25rem 1rem' }}>

      {/* ACTIVE PATIENT PROFILE BANNER */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.85rem',
          padding: '0.75rem 1.25rem',
          border: '1px solid #e2e8f0',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#e0f2fe',
              color: '#0369a1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Users size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Active Patient Context:</span>
              <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{activeProfile?.full_name || 'Patient'}</strong>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  textTransform: 'uppercase'
                }}
              >
                {activeProfile?.relationship || 'SELF'}
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.1rem' }}>
              <ShieldCheck size={12} /> Strict backend profile isolation active. Cross-profile data is never shared.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setShowKeyModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '0.5rem',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: '#334155',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Sliders size={13} /> AI Config
          </button>
        </div>
      </div>

      {/* EMERGENCY ALERT BANNER */}
      {emergencyAlert && (
        <div style={{ marginBottom: '1rem' }}>
          <EmergencyBanner details={emergencyAlert} />
        </div>
      )}

      {/* SUGGESTED REAL QUESTIONS */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.04em' }}>
          Verified Health Inquiries (Grounded in {activeProfile?.full_name || 'Your'} Records):
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.35rem' }}>
          {suggestedQuestions.map((q, idx) => {
            const Icon = q.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSendMessage(q.text)}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '0.55rem',
                  border: '1px solid #bfdbfe',
                  backgroundColor: '#ffffff',
                  color: '#1e3a8a',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}
              >
                <Icon size={13} color="#0284c7" />
                <span>{q.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MESSAGES CONTAINER */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          border: '1px solid #e2e8f0',
          padding: '1.25rem',
          minHeight: '440px',
          maxHeight: '520px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '1rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSpeaking = currentlySpeakingId === msg.id;

          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start'
              }}
            >
              <div
                style={{
                  maxWidth: '82%',
                  borderRadius: '1rem',
                  padding: '0.9rem 1.15rem',
                  backgroundColor: isUser ? '#0284c7' : '#f8fafc',
                  color: isUser ? '#ffffff' : '#0f172a',
                  border: isUser ? 'none' : '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                  position: 'relative'
                }}
              >
                {/* Header Tags for Assistant Messages */}
                {!isUser && (
                  <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {msg.is_extracted_info ? (
                        <span
                          style={{
                            backgroundColor: '#e0f2fe',
                            color: '#0369a1',
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <ShieldCheck size={11} /> VERIFIED RECORDS GROUNDED
                        </span>
                      ) : (
                        <span
                          style={{
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <Sparkles size={11} /> HEALTH INSIGHT
                        </span>
                      )}

                      {msg.tools_executed?.map((tName, i) => (
                        <span
                          key={i}
                          style={{
                            backgroundColor: '#f0fdf4',
                            color: '#166534',
                            fontSize: '0.62rem',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            padding: '0.1rem 0.35rem',
                            borderRadius: '3px',
                            border: '1px solid #bbf7d0'
                          }}
                        >
                          tool: {tName}
                        </span>
                      ))}
                    </div>

                    {/* Text-to-Speech Play/Stop Button */}
                    <button
                      onClick={() => handleSpeakText(msg.id, msg.content)}
                      style={{
                        background: 'none',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.4rem',
                        padding: '0.2rem 0.45rem',
                        fontSize: '0.7rem',
                        color: isSpeaking ? '#0284c7' : '#64748b',
                        backgroundColor: isSpeaking ? '#e0f2fe' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontWeight: 600
                      }}
                      title={isSpeaking ? "Stop Voice Playback" : "Listen to audio response"}
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX size={12} color="#0284c7" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={12} />
                          <span>{voiceT.speakResponse || 'Listen'}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Structured clinical data if available */}
                {!isUser && msg.structured_data?.directAnswer ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.3rem' }}>
                    <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
                        🎯 Direct Answer
                      </div>
                      <div style={{ color: '#14532d', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.1rem' }}>
                        {msg.structured_data.directAnswer}
                      </div>
                    </div>

                    {msg.structured_data.briefExplanation && (
                      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                          💡 Brief Explanation
                        </div>
                        <div style={{ color: '#334155', fontSize: '0.83rem', marginTop: '0.1rem' }}>
                          {msg.structured_data.briefExplanation}
                        </div>
                      </div>
                    )}

                    {msg.structured_data.practicalNextStep && (
                      <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                          🩺 Practical Next Step
                        </div>
                        <div style={{ color: '#1e3a8a', fontSize: '0.83rem', fontWeight: 500, marginTop: '0.1rem' }}>
                          {msg.structured_data.practicalNextStep}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                )}

                {/* STAGED ACTION CONFIRMATION CARD */}
                {msg.requires_confirmation && msg.staged_action && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.85rem',
                      borderRadius: '0.65rem',
                      backgroundColor: '#fffbeb',
                      border: '1.5px solid #f59e0b',
                      color: '#78350f'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.78rem' }}>
                      <AlertTriangle size={15} color="#d97706" />
                      <span>{agenticT.requiresConfirmation || 'ACTION CONFIRMATION REQUIRED'}</span>
                    </div>

                    <p style={{ margin: '0.35rem 0', fontSize: '0.8rem', color: '#92400e' }}>
                      {msg.staged_action.prompt_to_user}
                    </p>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}>
                      <button
                        onClick={() => handleConfirmStagedAction(msg.id, msg.staged_action.id, 'confirm')}
                        disabled={confirmingActionId === msg.staged_action.id}
                        style={{
                          padding: '0.4rem 0.85rem',
                          borderRadius: '0.45rem',
                          border: 'none',
                          backgroundColor: '#059669',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          cursor: confirmingActionId ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <Check size={13} /> {confirmingActionId === msg.staged_action.id ? 'Scheduling...' : (agenticT.confirmAction || 'Confirm & Schedule')}
                      </button>

                      <button
                        onClick={() => handleConfirmStagedAction(msg.id, msg.staged_action.id, 'decline')}
                        disabled={confirmingActionId === msg.staged_action.id}
                        style={{
                          padding: '0.4rem 0.75rem',
                          borderRadius: '0.45rem',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#475569',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={13} /> {agenticT.cancelAction || 'Decline'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Staged Action Resolution Feedback */}
                {msg.staged_action?.resolutionMessage && (
                  <div
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.5rem',
                      backgroundColor: msg.staged_action.status === 'confirmed' ? '#ecfdf5' : '#fef2f2',
                      border: `1px solid ${msg.staged_action.status === 'confirmed' ? '#a7f3d0' : '#fecaca'}`,
                      color: msg.staged_action.status === 'confirmed' ? '#065f46' : '#991b1b',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    {msg.staged_action.status === 'confirmed' ? <CheckCircle2 size={14} /> : <X size={14} />}
                    <span>{msg.staged_action.resolutionMessage}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                backgroundColor: '#f0f9ff',
                padding: '0.75rem 1.25rem',
                borderRadius: '1rem',
                fontSize: '0.82rem',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <div style={{ width: '14px', height: '14px', border: '2px solid #0284c7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              VitaCare Agentic Copilot is consulting authorized health records and tools...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* VOICE TRANSCRIPT / ERROR PREVIEWS */}
      {voiceError && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.55rem 0.85rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            color: '#b91c1c',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span>{voiceError}</span>
        </div>
      )}

      {isListening && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.65rem 1rem',
            backgroundColor: '#eff6ff',
            border: '1.5px solid #0284c7',
            borderRadius: '0.65rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: 'pulse 1.5s infinite'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af' }}>
              {voiceT.listening || 'Listening to speech... Speak clearly'} ({language.toUpperCase()})
            </span>
            {transcriptPreview && (
              <span style={{ fontSize: '0.8rem', color: '#334155', fontStyle: 'italic' }}>
                "{transcriptPreview}"
              </span>
            )}
          </div>

          <button
            onClick={toggleSpeechRecognition}
            style={{
              padding: '0.3rem 0.65rem',
              borderRadius: '0.4rem',
              border: 'none',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {voiceT.stopListening || 'Stop'}
          </button>
        </div>
      )}

      {/* INPUT FORM WITH MIC & SEND BUTTON */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        style={{
          display: 'flex',
          gap: '0.5rem',
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          padding: '0.45rem',
          border: '1.5px solid #cbd5e1',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
        }}
      >
        <button
          type="button"
          onClick={toggleSpeechRecognition}
          style={{
            backgroundColor: isListening ? '#ef4444' : '#f1f5f9',
            color: isListening ? '#ffffff' : '#334155',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.6rem 0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.8rem',
            fontWeight: 700,
            transition: 'all 0.15s ease'
          }}
          title={isListening ? "Stop Voice Input" : "Click to speak your health question"}
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} color="#0284c7" />}
          <span style={{ display: 'none' }}>Voice</span>
        </button>

        <input
          type="text"
          placeholder={`Ask about medicines, reports, test trends, or dosage schedules for ${activeProfile?.full_name || 'yourself'}...`}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={loading}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            padding: '0.55rem 0.75rem',
            fontSize: '0.9rem',
            color: '#0f172a'
          }}
        />

        <button
          type="submit"
          disabled={loading || !inputMessage.trim()}
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.6rem 1.15rem',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: loading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !inputMessage.trim() ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
          }}
        >
          <Send size={15} /> Ask Copilot
        </button>
      </form>

      {/* AI KEY CONFIG MODAL */}
      {showKeyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowKeyModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1.25rem',
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              border: '1.5px solid #e2e8f0'
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Key size={22} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                    Configure AI Copilot API Key
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', opacity: 0.9 }}>
                    Connect Google Gemini or OpenAI for customized AI clinical reasoning
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                Select AI Engine / Provider:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {[
                  { id: 'auto', label: 'Auto-Detect', sub: 'Gemini / OpenAI' },
                  { id: 'gemini', label: 'Google Gemini', sub: 'Gemini 1.5/2.0' },
                  { id: 'openai', label: 'OpenAI', sub: 'GPT-4o-mini' }
                ].map((prov) => (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => setKeyProviderInput(prov.id)}
                    style={{
                      padding: '0.65rem 0.5rem',
                      borderRadius: '0.6rem',
                      border: keyProviderInput === prov.id ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      backgroundColor: keyProviderInput === prov.id ? '#f0f9ff' : '#ffffff',
                      color: keyProviderInput === prov.id ? '#0284c7' : '#475569',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{prov.label}</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>{prov.sub}</div>
                  </button>
                ))}
              </div>

              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                Enter Your API Key:
              </label>
              <input
                type="text"
                placeholder="Paste AI key here (e.g. AIzaSy... or sk-...)"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.9rem',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  borderRadius: '0.6rem',
                  border: '1.5px solid #cbd5e1',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: '1rem'
                }}
              />

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.6rem',
                  padding: '0.75rem',
                  fontSize: '0.75rem',
                  color: '#475569',
                  lineHeight: 1.45,
                  marginBottom: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.2rem' }}>
                  <ShieldCheck size={14} color="#10b981" /> Built-in Offline Fallback Enabled
                </div>
                If no API key is provided, or if your cloud API limit is reached, VitaCare seamlessly uses its built-in certified clinical knowledge engine covering cardiology, neurology, gastroenterology, respiratory, and pharmacology.
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('vitacare_ai_api_key', keyInput.trim());
                    localStorage.setItem('vitacare_ai_provider', keyProviderInput);
                    setApiKey(keyInput.trim());
                    setAiProvider(keyProviderInput);
                    setShowKeyModal(false);
                  }}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
