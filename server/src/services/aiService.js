import { config } from '../config/env.js';

// Comprehensive emergency keywords in English, Hindi, Tamil, Telugu
const EMERGENCY_KEYWORDS = [
  // English
  'chest pain', 'heart attack', 'shortness of breath', 'cannot breathe', 'difficulty breathing',
  'stroke', 'face drooping', 'slurred speech', 'arm numbness', 'sudden weakness',
  'severe bleeding', 'coughing blood', 'unconscious', 'fainted', 'seizure', 'convulsion',
  'anaphylaxis', 'throat swelling', 'swallowed poison', 'overdose', 'suicide', 'kill myself',
  'worst headache of my life', 'thunderclap headache', 'stiff neck with high fever',
  // Hindi
  'seene me dard', 'chhati me dard', 'saans lene me takleef', 'behosh', 'khoon nikal raha hai',
  'सीने में दर्द', 'सांस लेने में तकलीफ', 'बेहोश', 'खून निकल रहा है',
  // Tamil
  'nenju vali', 'swasa kolaru', 'moochu vida mudiyavillai', 'mayakkam', 'maradaipu',
  'நெஞ்சு வலி', 'சுவாசக் கோளாறு', 'மூச்சு விட முடியவில்லை', 'மயக்கம்',
  // Telugu
  'gunde noppi', 'oopiri aadadam ledu', 'gundepotu', 'spruha tappadam',
  'గుండె నొప్పి', 'ఊపిరి ఆడడం లేదు', 'గుండెపోటు', 'స్పృహ తప్పడం'
];

export class AIService {
  constructor() {
    this.provider = config.activeAiProvider || 'builtin';
    this.geminiKey = config.geminiApiKey;
    this.openaiKey = config.openaiApiKey;
  }

  setProvider(provider, apiKey = '') {
    this.provider = provider;
    if (provider === 'gemini') this.geminiKey = apiKey;
    else if (provider === 'openai') this.openaiKey = apiKey;
    else if (provider === 'builtin') {
      if (!apiKey) {
        this.geminiKey = '';
        this.openaiKey = '';
      }
    }
  }

  /**
   * Fast emergency safety filter to intercept life-threatening queries
   */
  detectEmergency(text = '') {
    const lower = text.toLowerCase();
    for (const keyword of EMERGENCY_KEYWORDS) {
      if (lower.includes(keyword)) {
        return { isEmergency: true, keyword };
      }
    }
    return { isEmergency: false, keyword: null };
  }

  /**
   * Main entrypoint for Health Assistant conversation & queries
   */
  async processHealthQuery({ message, language = 'en', moduleType = 'assistant', healthContext = {}, apiKey = null, provider = null }) {
    const emergencyCheck = this.detectEmergency(message);

    if (emergencyCheck.isEmergency) {
      const emRes = this.generateEmergencyResponse(language, emergencyCheck.keyword);
      emRes.isEmergency = true;
      emRes.providerUsed = 'safety-filter';
      return emRes;
    }

    // Determine effective provider and key
    let effectiveKey = (apiKey && typeof apiKey === 'string') ? apiKey.trim() : '';
    let effectiveProvider = provider || this.provider;

    if (!effectiveKey) {
      if (effectiveProvider === 'gemini' && this.geminiKey) effectiveKey = this.geminiKey;
      else if (effectiveProvider === 'openai' && this.openaiKey) effectiveKey = this.openaiKey;
      else if (this.geminiKey) { effectiveKey = this.geminiKey; effectiveProvider = 'gemini'; }
      else if (this.openaiKey) { effectiveKey = this.openaiKey; effectiveProvider = 'openai'; }
    }

    // Auto-detect provider if key supplied but provider unspecified
    if (effectiveKey && (!provider || provider === 'auto' || provider === 'builtin')) {
      if (effectiveKey.startsWith('AIza')) effectiveProvider = 'gemini';
      else if (effectiveKey.startsWith('sk-')) effectiveProvider = 'openai';
      else effectiveProvider = 'gemini';
    }

    // 1. Try Gemini if configured
    if (effectiveProvider === 'gemini' && effectiveKey) {
      try {
        const geminiRes = await this.callGemini(message, language, moduleType, healthContext, effectiveKey);
        if (geminiRes) {
          geminiRes.providerUsed = 'gemini';
          return geminiRes;
        }
      } catch (err) {
        console.warn('[AIService] Gemini API error, falling back to Intelligent Clinical Engine:', err.message);
      }
    }

    // 2. Try OpenAI if configured
    if (effectiveProvider === 'openai' && effectiveKey) {
      try {
        const openaiRes = await this.callOpenAI(message, language, moduleType, healthContext, effectiveKey);
        if (openaiRes) {
          openaiRes.providerUsed = 'openai';
          return openaiRes;
        }
      } catch (err) {
        console.warn('[AIService] OpenAI API error, falling back to Intelligent Clinical Engine:', err.message);
      }
    }

    // 3. Built-in intelligent clinical knowledge engine (100% offline, concise 3-part answers)
    const builtinRes = await this.generateBuiltinResponse(message, language, moduleType, healthContext);
    builtinRes.providerUsed = 'builtin';
    return builtinRes;
  }

  generateEmergencyResponse(language, keyword) {
    const responses = {
      en: {
        directAnswer: "⚠️ Potential medical emergency detected.",
        briefExplanation: `Symptoms involving "${keyword || 'acute distress'}" may indicate a critical, time-sensitive condition.`,
        practicalNextStep: "Call emergency medical services immediately (Dial 108 / 112 in India, 911 in the US) and seek urgent care.",
        formattedResponse: `⚠️ Potential medical emergency detected.\n\nSymptoms involving "${keyword || 'acute distress'}" may indicate a critical, time-sensitive condition.\n\nCall emergency medical services immediately (Dial 108 / 112 in India, 911 in the US) and seek urgent care.`,
        summary: "Potential medical emergency detected. Immediate emergency medical evaluation is urgently required."
      },
      ta: {
        directAnswer: "⚠️ சாத்தியமான அவசர மருத்துவ நிலை கண்டறியப்பட்டது.",
        briefExplanation: `"${keyword || 'அறிகுறிகள்'}" தொடர்பான தீவிர அறிகுறிகள் உடனடி மருத்துவ அவசர நிலையைக் குறிக்கலாம்.`,
        practicalNextStep: "உடனடியாக 108 அல்லது 112 அவசர சிகிச்சை எண்ணை அழைத்து அவசர மருத்துவ உதவியை நாடவும்.",
        formattedResponse: `⚠️ சாத்தியமான அவசர மருத்துவ நிலை கண்டறியப்பட்டது.\n\n"${keyword || 'அறிகுறிகள்'}" தொடர்பான தீவிர அறிகுறிகள் உடனடி மருத்துவ அவசர நிலையைக் குறிக்கலாம்.\n\nஉடனடியாக 108 அல்லது 112 அவசர சிகிச்சை எண்ணை அழைத்து அவசர மருத்துவ உதவியை நாடவும்.`,
        summary: "சாத்தியமான அவசர மருத்துவ நிலை. உடனடி அவசர சிகிச்சை அவசியம்."
      },
      te: {
        directAnswer: "⚠️ తీవ్రమైన అత్యవసర వైద్య పరిస్థితి గుర్తించబడింది.",
        briefExplanation: `"${keyword || 'తీవ్ర లక్షణాలు'}" సంబంధిత లక్షణాలు తక్షణ ప్రాణాంతక పరిస్థితిని సూచించవచ్చు.`,
        practicalNextStep: "వెంటనే 108 లేదా 112 ఎమర్జెన్సీ నంబర్‌కు కాల్ చేసి తక్షణ వైద్య సహాయం పొందండి.",
        formattedResponse: `⚠️ తీవ్రమైన అత్యవసర వైద్య పరిస్థితి గుర్తించబడింది.\n\n"${keyword || 'తీవ్ర లక్షణాలు'}" సంబంధిత లక్షణాలు తక్షణ ప్రాణాంతక పరిస్థితిని సూచించవచ్చు.\n\nవెంటనే 108 లేదా 112 ఎమర్జెన్సీ నంబర్‌కు కాల్ చేసి తక్షణ వైద్య సహాయం పొందండి.`,
        summary: "తీవ్రమైన అత్యవసర వైద్య పరిస్థితి. తక్షణ సహాయం అవసరం."
      },
      hi: {
        directAnswer: "⚠️ संभावित आपातकालीन चिकित्सा स्थिति का पता चला।",
        briefExplanation: `"${keyword || 'गंभीर लक्षण'}" से संबंधित लक्षण गंभीर आपातकालीन स्थिति का संकेत हो सकते हैं।`,
        practicalNextStep: "तुरंत 108 या 112 आपातकालीन नंबर पर कॉल करें और निकटतम अस्पताल पहुंचें।",
        formattedResponse: `⚠️ संभावित आपातकालीन चिकित्सा स्थिति का पता चला।\n\n"${keyword || 'गंभीर लक्षण'}" से संबंधित लक्षण गंभीर आपातकालीन स्थिति का संकेत हो सकते हैं।\n\nतुरंत 108 या 112 आपातकालीन नंबर पर कॉल करें और निकटतम अस्पताल पहुंचें।`,
        summary: "संभावित आपातकालीन चिकित्सा स्थिति। तत्काल सहायता आवश्यक है।"
      }
    };

    const langData = responses[language] || responses.en;
    return {
      isEmergency: true,
      reply: langData.formattedResponse,
      data: langData
    };
  }

  /**
   * Built-in clinical knowledge base delivering short, direct, sweet 3-part answers
   * Structure:
   * 1. Direct answer.
   * 2. One brief explanation.
   * 3. One practical next step.
   */
  generateBuiltinResponse(query, language = 'en', moduleType = 'assistant', healthContext = {}) {
    const q = query.toLowerCase();
    const activeMeds = healthContext.activeMedications || [];
    const recentReports = healthContext.recentReports || [];
    const recentBiomarkers = healthContext.recentBiomarkers || [];
    const recentMetrics = healthContext.recentMetrics || [];

    // 1. Report queries
    if (q.includes('what does my report show') || q.includes('what report') || q.includes('my report') || q.includes('explain my report') || q.includes('summarize report') || q.includes('அறிக்கை') || q.includes('నివేదిక') || q.includes('रिपोर्ट')) {
      return this.handleReportsInquiry(recentReports, recentBiomarkers, language);
    }

    // 2. Active medications queries
    if (q.includes('what are my medicines today') || q.includes('medicines today') || q.includes('what medicines') || q.includes('medicine do i have') || q.includes('my medications') || q.includes('மருந்து') || q.includes('మందు') || q.includes('दवा')) {
      return this.handleActiveMedsInquiry(activeMeds, language);
    }

    // 3. Next medicine queries
    if (q.includes('next medicine') || q.includes('upcoming medicine')) {
      return this.handleNextMedInquiry(activeMeds, language);
    }

    // 4. Glucose / Blood Sugar queries
    if (q.includes('blood sugar') || q.includes('glucose') || q.includes('சர்க்கரை') || q.includes('చక్కెర') || q.includes('शुगर') || q.includes('ग्लूकोज')) {
      return this.handleGlucoseInquiry(recentBiomarkers, recentMetrics, language);
    }

    // 5. Blood Pressure queries
    if (q.includes('blood pressure') || q.includes('high bp') || q.includes('low bp') || (q.includes('bp') && !q.includes('bpm')) || q.includes('இரத்த அழுத்தம்') || q.includes('రక్తపోటు') || q.includes('रक्तचाप')) {
      return this.handleBloodPressureInquiry(recentBiomarkers, recentMetrics, language);
    }

    // 6. Hemoglobin query (Requirement 2.B specific example)
    if (q.includes('hemoglobin') || q.includes('low hemoglobin') || q.includes('hb') || q.includes('ஹீமோகுளோபின்') || q.includes('హిమోగ్లోబిన్') || q.includes('हीमोग्लोबिन')) {
      const payload = this.getConciseClinicalPayload('hemoglobin', query, language);
      return { isEmergency: false, reply: payload.formattedResponse, data: payload };
    }

    // 7. Doctor consultation questions
    if (q.includes('doctor') && (q.includes('question') || q.includes('prepare') || q.includes('ask') || q.includes('visit'))) {
      const payload = this.getConciseClinicalPayload('doctor_questions', query, language);
      return { isEmergency: false, reply: payload.formattedResponse, data: payload };
    }

    // 8. Clinical symptom & topic detection
    let topic = 'general';
    if (q.includes('headache') || q.includes('migraine') || q.includes('thalaivali') || q.includes('sar dard') || q.includes('tala noppi')) {
      topic = 'headache';
    } else if (q.includes('fever') || q.includes('temperature') || q.includes('kaichal') || q.includes('bukhar') || q.includes('jwaram')) {
      topic = 'fever';
    } else if (q.includes('stomach') || q.includes('acidity') || q.includes('acid') || q.includes('heartburn') || q.includes('gerd') || q.includes('pet dard') || q.includes('vayitru') || q.includes('kadupu')) {
      topic = 'stomach';
    } else if (q.includes('cough') || q.includes('cold') || q.includes('throat') || q.includes('irumal') || q.includes('khansi') || q.includes('daggu')) {
      topic = 'respiratory';
    } else if (q.includes('chest') || q.includes('palpitation') || q.includes('heart')) {
      topic = 'cardiac';
    } else if (q.includes('back') || q.includes('joint') || q.includes('muscle') || q.includes('pain') || q.includes('vali') || q.includes('dard')) {
      topic = 'musculoskeletal';
    } else if (q.includes('dizzy') || q.includes('vertigo') || q.includes('spinning')) {
      topic = 'dizziness';
    } else if (q.includes('rash') || q.includes('itch') || q.includes('skin')) {
      topic = 'dermatology';
    } else if (q.includes('sleep') || q.includes('insomnia') || q.includes('tired') || q.includes('fatigue')) {
      topic = 'sleep_fatigue';
    }

    const payload = this.getConciseClinicalPayload(topic, query, language);
    return {
      isEmergency: false,
      reply: payload.formattedResponse,
      data: payload
    };
  }

  handleReportsInquiry(recentReports, recentBiomarkers, language) {
    if (recentReports.length === 0) {
      const empty = {
        en: {
          directAnswer: "You currently have no uploaded health reports in your records.",
          briefExplanation: "Once you upload a report or lab test, I can summarize its recorded values and reference ranges.",
          practicalNextStep: "Click [+ Add Health Report] on your dashboard to upload and scan your medical documents."
        },
        ta: {
          directAnswer: "உங்கள் சுயவிவரத்தில் இதுவரை எந்த மருத்துவ அறிக்கைகளும் பதிவேற்றப்படவில்லை.",
          briefExplanation: "அறிக்கையை பதிவேற்றியதும், அதன் பதிவு செய்யப்பட்ட முடிவுகள் மற்றும் குறிப்பு வரம்புகளை நான் விளக்குவேன்.",
          practicalNextStep: "மருத்துவ அறிக்கையை பதிவேற்ற முகப்பில் உள்ள [+ மருத்துவ அறிக்கையைச் சேர்] பொத்தானைப் பயன்படுத்தவும்."
        },
        te: {
          directAnswer: "మీ ఖాతాలో ఇప్పటివరకు ఎలాంటి ఆరోగ్య నివేదికలు అప్‌లోడ్ చేయబడలేదు.",
          briefExplanation: "మీరు నివేదికను అప్‌లోడ్ చేసిన తర్వాత, దాని ఫలితాలు మరియు సాధారణ పరిధులను నేను వివరిస్తాను.",
          practicalNextStep: "మీ పత్రాలను అప్‌లోడ్ చేయడానికి డ్యాష్‌బోర్డ్‌లోని [+ ఆరోగ్య నివేదికను జోడించండి] బటన్‌ను క్లిక్ చేయండి."
        },
        hi: {
          directAnswer: "आपके रिकॉर्ड में वर्तमान में कोई स्वास्थ्य रिपोर्ट अपलोड नहीं है।",
          briefExplanation: "रिपोर्ट अपलोड करने पर मैं उसके दर्ज परिणामों और संदर्भ सीमाओं को आसानी से समझा सकता हूँ।",
          practicalNextStep: "अपने दस्तावेज़ अपलोड करने के लिए डैशबोर्ड पर [+ स्वास्थ्य रिपोर्ट जोड़ें] पर क्लिक करें।"
        }
      };

      const res = empty[language] || empty.en;
      const formattedResponse = `${res.directAnswer}\n\n${res.briefExplanation}\n\n${res.practicalNextStep}`;
      return {
        isEmergency: false,
        reply: formattedResponse,
        data: { ...res, formattedResponse, summary: `${res.directAnswer} ${res.briefExplanation}` },
        usedStoredRecords: true
      };
    }

    const rep = recentReports[0];
    const bios = recentBiomarkers.filter(b => b.report_id === rep.id || !b.report_id).slice(0, 4);
    const bioText = bios.length > 0 
      ? bios.map(b => `${b.biomarker_name}: ${b.value} ${b.unit} (${b.reference_range || 'Normal'})`).join(', ')
      : 'recorded physiological parameters';

    const reportDict = {
      en: {
        directAnswer: `Your report shows the recorded test results for ${rep.title} from ${rep.report_date}.`,
        briefExplanation: `Recorded values include ${bioText}. Some values may need medical interpretation.`,
        practicalNextStep: "Discuss these recorded results with your healthcare provider, and let me know if you would like any specific test explained."
      },
      ta: {
        directAnswer: `உங்கள் அறிக்கை ${rep.report_date} தேதியிட்ட ${rep.title} சோதனைகளின் முடிவுகளைக் காட்டுகிறது.`,
        briefExplanation: `பதிவான அளவுகள்: ${bioText}. சில முடிவுகளுக்கு மருத்துவ விளக்கம் தேவைப்படலாம்.`,
        practicalNextStep: "இந்த முடிவுகளைப் பற்றி உங்கள் மருத்துவரிடம் கலந்துரையாடுங்கள். குறிப்பிட்ட சோதனையை விளக்க விரும்பினால் கேட்கலாம்."
      },
      te: {
        directAnswer: `మీ నివేదిక ${rep.report_date} నాటి ${rep.title} నమోదు చేసిన పరీక్ష ఫలితాలను చూపుతుంది.`,
        briefExplanation: `నమోదైన కొలతలు: ${bioText}. కొన్ని ఫలితాలకు వైద్య వివరణ అవసరం కావచ్చు.`,
        practicalNextStep: "ఈ ఫలితాల గురించి మీ వైద్యుడితో చర్చించండి, నిర్దిష్ట పరీక్ష గురించి మరింత తెలుసుకోవాలంటే నన్ను అడగండి."
      },
      hi: {
        directAnswer: `आपकी रिपोर्ट ${rep.report_date} की ${rep.title} के दर्ज परीक्षण परिणाम दर्शाती है।`,
        briefExplanation: `दर्ज परीक्षण: ${bioText}। कुछ मानों को चिकित्सकीय व्याख्या की आवश्यकता हो सकती है।`,
        practicalNextStep: "इन परिणामों पर अपने डॉक्टर से चर्चा करें, और किसी विशिष्ट परिणाम को समझने के लिए मुझसे पूछें।"
      }
    };

    const res = reportDict[language] || reportDict.en;
    const formattedResponse = `${res.directAnswer}\n\n${res.briefExplanation}\n\n${res.practicalNextStep}`;
    return {
      isEmergency: false,
      reply: formattedResponse,
      data: { ...res, formattedResponse, summary: `${res.directAnswer} ${res.briefExplanation}` },
      usedStoredRecords: true
    };
  }

  handleActiveMedsInquiry(activeMeds, language) {
    if (activeMeds.length === 0) {
      const empty = {
        en: {
          directAnswer: "You currently have no active scheduled medications in your VitaCare profile.",
          briefExplanation: "Medicine reminders can be created from prescriptions or entered manually.",
          practicalNextStep: "Click [+ Add Prescription] or [+ Add Medicine] to set up your dose reminders."
        },
        ta: {
          directAnswer: "உங்கள் சுயவிவரத்தில் தற்போது திட்டமிடப்பட்ட மருந்துகள் எதுவும் இல்லை.",
          briefExplanation: "மருந்துச் சீட்டைப் பதிவேற்றுவதன் மூலம் நினைவூட்டல்களை எளிதாக உருவாக்கலாம்.",
          practicalNextStep: "நினைவூட்டலைத் தொடங்க [+ மருந்துச் சீட்டைச் சேர்] பொத்தானைப் பயன்படுத்தவும்."
        },
        te: {
          directAnswer: "మీ ప్రొఫైల్‌లో ప్రస్తుతం ఎలాంటి మందుల షెడ్యూల్ నమోదు కాలేదు.",
          briefExplanation: "ప్రిస్క్రిప్షన్ అప్‌లోడ్ చేయడం ద్వారా మందుల రిమైండర్‌లను సులభంగా సృష్టించవచ్చు.",
          practicalNextStep: "రిమైండర్ ప్రారంభించడానికి [+ ప్రిస్క్రిప్షన్ జోడించండి] క్లిక్ చేయండి."
        },
        hi: {
          directAnswer: "आपकी प्रोफ़ाइल में वर्तमान में कोई सक्रिय निर्धारित दवा नहीं है।",
          briefExplanation: "पर्चा अपलोड करके या सीधे जोड़कर दवा रिमाइंडर बनाए जा सकते हैं।",
          practicalNextStep: "रिमाइंडर शुरू करने के लिए [+ पर्चा जोड़ें] पर क्लिक करें।"
        }
      };
      const res = empty[language] || empty.en;
      const formattedResponse = `${res.directAnswer}\n\n${res.briefExplanation}\n\n${res.practicalNextStep}`;
      return {
        isEmergency: false,
        reply: formattedResponse,
        data: { ...res, formattedResponse, summary: `${res.directAnswer} ${res.briefExplanation}` },
        usedStoredRecords: true
      };
    }

    const medNames = activeMeds.map(m => `${m.medicine_name} (${m.dosage}) at ${m.reminder_time}`).join(', ');
    const dict = {
      en: {
        directAnswer: `You have ${activeMeds.length} active medicine(s) scheduled for today.`,
        briefExplanation: `Scheduled doses: ${medNames}.`,
        practicalNextStep: "Take each dose on schedule with a full glass of water and use camera tracking to verify intake."
      },
      ta: {
        directAnswer: `இன்று உங்களுக்கு ${activeMeds.length} மருந்துகள் திட்டமிடப்பட்டுள்ளன.`,
        briefExplanation: `திட்டமிடப்பட்ட மருந்துகள்: ${medNames}.`,
        practicalNextStep: "நேரத்திற்கு நீருடன் உட்கொண்டு கேமரா கண்காணிப்பு மூலம் சரிபார்க்கவும்."
      },
      te: {
        directAnswer: `ఈ రోజు మీకు ${activeMeds.length} మందుల మోతాదులు షెడ్యూల్ చేయబడ్డాయి.`,
        briefExplanation: `షెడ్యూల్ చేయబడినవి: ${medNames}.`,
        practicalNextStep: "సమయానికి నీటితో తీసుకుని కెమెరా ట్రాకింగ్ ద్వారా ధృవీకరించండి."
      },
      hi: {
        directAnswer: `आज के लिए आपकी ${activeMeds.length} दवाएं निर्धारित हैं।`,
        briefExplanation: `निर्धारित खुराक: ${medNames}।`,
        practicalNextStep: "समय पर पानी के साथ खुराक लें और कैमरा ट्रैकिंग द्वारा सेवन सत्यापित करें।"
      }
    };

    const res = dict[language] || dict.en;
    const formattedResponse = `${res.directAnswer}\n\n${res.briefExplanation}\n\n${res.practicalNextStep}`;
    return {
      isEmergency: false,
      reply: formattedResponse,
      data: { ...res, formattedResponse, summary: `${res.directAnswer} ${res.briefExplanation}` },
      usedStoredRecords: true
    };
  }

  handleNextMedInquiry(activeMeds, language) {
    if (activeMeds.length === 0) {
      return this.handleActiveMedsInquiry(activeMeds, language);
    }
    const nextMed = activeMeds[0];
    const dict = {
      en: {
        directAnswer: `Your next upcoming medicine is ${nextMed.medicine_name} (${nextMed.dosage}) at ${nextMed.reminder_time}.`,
        briefExplanation: `${nextMed.notes ? `Prescription note: ${nextMed.notes}` : 'Follow prescribed oral directions with water.'}`,
        practicalNextStep: "Prepare your dose and use camera tracking to confirm intake at the scheduled time."
      },
      ta: {
        directAnswer: `உங்கள் அடுத்த மருந்து ${nextMed.reminder_time} மணிக்கு ${nextMed.medicine_name} (${nextMed.dosage}) ஆகும்.`,
        briefExplanation: "மருத்துவர் குறிப்பிட்ட வாய்வழி வழிமுறைகளின்படி நீருடன் உட்கொள்ளவும்.",
        practicalNextStep: "குறிப்பிட்ட நேரத்தில் மருந்தை உட்கொண்டு கேமரா மூலம் சரிபார்க்கவும்."
      },
      te: {
        directAnswer: `మీ తదుపరి మందు ${nextMed.reminder_time} సమయానికి ${nextMed.medicine_name} (${nextMed.dosage}).`,
        briefExplanation: "వైద్యుల సూచనల ప్రకారం నీటితో మందు తీసుకోండి.",
        practicalNextStep: "నిర్దేశిత సమయానికి మందు తీసుకుని కెమెరా ద్వారా ధృవీకరించండి."
      },
      hi: {
        directAnswer: `आपकी अगली दवा ${nextMed.reminder_time} बजे ${nextMed.medicine_name} (${nextMed.dosage}) है।`,
        briefExplanation: "चिकित्सक के निर्देशानुसार पानी के साथ सेवन करें।",
        practicalNextStep: "निर्धारित समय पर खुराक लें और कैमरा ट्रैकिंग द्वारा पुष्टि करें।"
      }
    };
    const res = dict[language] || dict.en;
    const formattedResponse = `${res.directAnswer}\n\n${res.briefExplanation}\n\n${res.practicalNextStep}`;
    return {
      isEmergency: false,
      reply: formattedResponse,
      data: { ...res, formattedResponse, summary: `${res.directAnswer} ${res.briefExplanation}` },
      usedStoredRecords: true
    };
  }

  handleGlucoseInquiry(recentBiomarkers, recentMetrics, language) {
    const glucoseBio = recentBiomarkers.find(b => b.biomarker_name?.toLowerCase().includes('glucose') || b.biomarker_name?.toLowerCase().includes('sugar'));
    const glucoseMetric = recentMetrics.find(m => m.metric_type === 'blood_glucose');

    const value = glucoseBio?.value || glucoseMetric?.metric_value;
    const unit = glucoseBio?.unit || glucoseMetric?.unit || 'mg/dL';
    const date = glucoseBio?.recorded_date || glucoseMetric?.recorded_at?.split('T')[0];

    if (value) {
      const isElevated = value > 125;
      const isPre = value >= 100 && value <= 125;
      const statusNote = isElevated ? 'elevated' : (isPre ? 'prediabetes range' : 'within normal fasting range');

      const dict = {
        en: {
          directAnswer: `Your latest recorded fasting blood glucose is ${value} ${unit} (${date || 'Recent'}).`,
          briefExplanation: `Normal fasting range is 70 to 99 mg/dL; your reading is considered ${statusNote}.`,
          practicalNextStep: "Maintain balanced nutrition, stay well hydrated, and discuss this trend with your physician."
        },
        ta: {
          directAnswer: `உங்கள் சமீபத்திய இரத்த சர்க்கரை அளவு ${value} ${unit} ஆகும் (${date || 'சமீபத்தியது'}).`,
          briefExplanation: `இயல்பான உண்ணாவிரத வரம்பு 70 முதல் 99 mg/dL ஆகும்; உங்கள் அளவு ${statusNote} நிலையைக் குறிக்கிறது.`,
          practicalNextStep: "ஆரோக்கியமான உணவை உட்கொண்டு மருத்துவரிடம் இந்த அளவீட்டைப் பற்றி விவாதிக்கவும்."
        },
        te: {
          directAnswer: `మీ తాజా రక్తంలో చక్కెర స్థాయి ${value} ${unit} (${date || 'ఇటీవలి'}).`,
          briefExplanation: `సాధారణ ఉపవాస పరిధి 70 నుండి 99 mg/dL; మీ రీడింగ్ ${statusNote} లో ఉంది.`,
          practicalNextStep: "సమతుల్య ఆహారం తీసుకోండి మరియు మీ వైద్యుడితో ఈ ఫలితాన్ని చర్చించండి."
        },
        hi: {
          directAnswer: `आपका नवीनतम रक्त शर्करा (ग्लूकोज) स्तर ${value} ${unit} दर्ज है (${date || 'हालिया'})।`,
          briefExplanation: `सामान्य फास्टिंग सीमा 70 से 99 mg/dL है; आपकी रीडिंग ${statusNote} है।`,
          practicalNextStep: "संतुलित आहार लें, पानी भरपूर पिएं और अपने चिकित्सक से इस पर चर्चा करें।"
        }
      };

      const res = dict[language] || dict.en;
      const formattedResponse = `${res.directAnswer}\n\n${res.briefExplanation}\n\n${res.practicalNextStep}`;
      return {
        isEmergency: false,
        reply: formattedResponse,
        data: { ...res, formattedResponse, summary: `${res.directAnswer} ${res.briefExplanation}` },
        usedStoredRecords: true
      };
    }

    const dict = {
      en: {
        directAnswer: "Standard fasting blood glucose reference range is 70 to 99 mg/dL.",
        briefExplanation: "A level of 100 to 125 mg/dL indicates prediabetes, while 126 mg/dL or higher suggests diabetes.",
        practicalNextStep: "Upload a lab report or record your reading in the Health Tracker tab to track your glucose trend."
      },
      ta: {
        directAnswer: "இயல்பான உண்ணாவிரத இரத்த சர்க்கரை அளவு 70 முதல் 99 mg/dL வரை இருக்கும்.",
        briefExplanation: "100 முதல் 125 mg/dL வரை இருப்பது ஆரம்ப சர்க்கரை நிலையையும், 126 mg/dL க்கு மேல் இருப்பது நீரிழிவையும் குறிக்கும்.",
        practicalNextStep: "உங்கள் சர்க்கரை அளவைக் கண்காணிக்க ஆய்வக அறிக்கையை பதிவேற்றவும்."
      },
      te: {
        directAnswer: "సాధారణ ఉపవాస రక్తంలో చక్కెర పరిధి 70 నుండి 99 mg/dL.",
        briefExplanation: "100 నుండి 125 mg/dL ఉంటే ప్రీ-డయాబెటిస్ అని, 126 mg/dL లేదా అంతకంటే ఎక్కువ ఉంటే డయాబెటిస్ అని సూచిస్తుంది.",
        practicalNextStep: "మీ చక్కెర స్థాయిలను ట్రాక్ చేయడానికి ల్యాబ్ నివేదికను అప్‌లోడ్ చేయండి."
      },
      hi: {
        directAnswer: "सामान्य फास्टिंग रक्त शर्करा (ब्लड शुगर) की सीमा 70 से 99 mg/dL होती है।",
        briefExplanation: "100 से 125 mg/dL प्रीडायबिटीज और 126 mg/dL या अधिक स्तर डायबिटीज का संकेत हो सकता है।",
        practicalNextStep: "अपने स्तर को ट्रैक करने के लिए हेल्थ ट्रैकर में रीडिंग दर्ज करें या रिपोर्ट अपलोड करें।"
      }
    };
    const res = dict[language] || dict.en;
    const formattedResponse = `${res.directAnswer}\n\n${res.briefExplanation}\n\n${res.practicalNextStep}`;
    return {
      isEmergency: false,
      reply: formattedResponse,
      data: { ...res, formattedResponse, summary: `${res.directAnswer} ${res.briefExplanation}` },
      usedStoredRecords: false
    };
  }

  handleBloodPressureInquiry(recentBiomarkers, recentMetrics, language) {
    const bpMetric = recentMetrics.find(m => m.metric_type === 'blood_pressure');
    const sys = bpMetric?.metric_value;
    const dia = bpMetric?.secondary_value || 80;

    if (sys) {
      const isHigh = sys >= 130 || dia >= 85;
      const dict = {
        en: {
          directAnswer: `Your latest recorded blood pressure is ${sys}/${dia} mmHg.`,
          briefExplanation: `Normal resting blood pressure is generally below 120/80 mmHg; your reading is ${isHigh ? 'slightly elevated' : 'in the normal range'}.`,
          practicalNextStep: "Avoid excessive sodium, stay physically active, and monitor regular readings in your Health Tracker."
        },
        ta: {
          directAnswer: `உங்கள் சமீபத்திய இரத்த அழுத்தம் ${sys}/${dia} mmHg ஆக பதிவாகியுள்ளது.`,
          briefExplanation: `இயல்பான இரத்த அழுத்தம் 120/80 mmHg க்குக் கீழ் இருக்க வேண்டும்; உங்கள் அளவு ${isHigh ? 'சற்று அதிகமாக' : 'இயல்பான வரம்பில்'} உள்ளது.`,
          practicalNextStep: "உணவில் உப்பைக் குறைத்து, வழக்கமான அளவீடுகளைக் கண்காணிக்கவும்."
        },
        te: {
          directAnswer: `మీ తాజా రక్తపోటు రీడింగ్ ${sys}/${dia} mmHg గా ఉంది.`,
          briefExplanation: `సాధారణ విశ్రాంతి రక్తపోటు 120/80 mmHg లోపు ఉండాలి; మీ కొలత ${isHigh ? 'కాస్త ఎక్కువగా' : 'సాధారణ పరిధిలో'} ఉంది.`,
          practicalNextStep: "ఉప్పు తగ్గించండి, మరియు హెల్త్ ట్రాకర్‌లో రీడింగులను పర్యవేక్షించండి."
        },
        hi: {
          directAnswer: `आपका नवीनतम दर्ज रक्तचाप (BP) ${sys}/${dia} mmHg है।`,
          briefExplanation: `सामान्य रक्तचाप 120/80 mmHg से नीचे माना जाता है; आपका स्तर ${isHigh ? 'हल्का सा बढ़ा हुआ' : 'सामान्य सीमा में'} है।`,
          practicalNextStep: "नमक का सेवन सीमित रखें और नियमित रूप से रीडिंग ट्रैक करें।"
        }
      };
      const res = dict[language] || dict.en;
      const formattedResponse = `${res.directAnswer}\n\n${res.briefExplanation}\n\n${res.practicalNextStep}`;
      return {
        isEmergency: false,
        reply: formattedResponse,
        data: { ...res, formattedResponse, summary: `${res.directAnswer} ${res.briefExplanation}` },
        usedStoredRecords: true
      };
    }

    const dict = {
      en: {
        directAnswer: "Optimal adult resting blood pressure is typically below 120/80 mmHg.",
        briefExplanation: "Readings persistently at or above 130/80 mmHg may indicate hypertension.",
        practicalNextStep: "Log your blood pressure readings in Health Tracker to automatically view trends."
      },
      ta: {
        directAnswer: "பெரியவர்களுக்கான இயல்பான ஓய்வு இரத்த அழுத்தம் 120/80 mmHg க்குக் கீழே இருக்க வேண்டும்.",
        briefExplanation: "தொடர்ந்து 130/80 mmHg க்கு மேல் இருந்தால் அது உயர் இரத்த அழுத்தத்தைக் குறிக்கலாம்.",
        practicalNextStep: "அளவீடுகளைப் பதிவு செய்து வரைபடத்தைக் கண்காணிக்கவும்."
      },
      te: {
        directAnswer: "సాధారణ విశ్రాంతి రక్తపోటు 120/80 mmHg కంటే తక్కువగా ఉండాలి.",
        briefExplanation: "నిరంతరం 130/80 mmHg లేదా అంతకంటే ఎక్కువ ఉంటే హైపర్‌టెన్షన్ కావచ్చు.",
        practicalNextStep: "ధోరణులను చూడటానికి హెల్త్ ట్రాకర్‌లో కొలతలను నమోదు చేయండి."
      },
      hi: {
        directAnswer: "वयस्कों के लिए सामान्य विश्राम रक्तचाप 120/80 mmHg से कम होता है।",
        briefExplanation: "लगातार 130/80 mmHg या उससे अधिक होना उच्च रक्तचाप (हाइपरटेंशन) का संकेत हो सकता है।",
        practicalNextStep: "ट्रेंड्स देखने के लिए हेल्थ ट्रैकर में अपना बीपी दर्ज करें।"
      }
    };
    const res = dict[language] || dict.en;
    const formattedResponse = `${res.directAnswer}\n\n${res.briefExplanation}\n\n${res.practicalNextStep}`;
    return {
      isEmergency: false,
      reply: formattedResponse,
      data: { ...res, formattedResponse, summary: `${res.directAnswer} ${res.briefExplanation}` },
      usedStoredRecords: false
    };
  }

  getConciseClinicalPayload(topic, rawQuery, language = 'en') {
    const knowledgeBase = {
      hemoglobin: {
        en: {
          directAnswer: "Low hemoglobin may mean your blood carries less oxygen than usual.",
          briefExplanation: "Causes vary, including iron deficiency, blood loss, or vitamin insufficiency.",
          practicalNextStep: "Discuss your result with a healthcare professional to understand the cause."
        },
        ta: {
          directAnswer: "குறைந்த ஹீமோகுளோபின் உங்கள் இரத்தம் வழக்கத்தை விட குறைவான ஆக்ஸிஜனைக் கொண்டு செல்கிறது என்பதைக் குறிக்கலாம்.",
          briefExplanation: "இரும்புச்சத்து குறைபாடு அல்லது ஊட்டச்சத்துக் குறைவு உள்ளிட்ட பல காரணங்கள் இருக்கலாம்.",
          practicalNextStep: "சரியான காரணத்தைப் புரிந்து கொள்ள மருத்துவரிடம் கலந்தாலோசிக்கவும்."
        },
        te: {
          directAnswer: "తక్కువ హిమోగ్లోబిన్ అంటే మీ రక్తం సాధారణం కంటే తక్కువ ఆక్సిజన్‌ను మోసుకెళుతుందని అర్థం కావచ్చు.",
          briefExplanation: "ఇనుము లోపం లేదా పోషకాహార లోపం వంటి వివిధ కారణాల వల్ల ఇది సంభవించవచ్చు.",
          practicalNextStep: "ఖచ్చితమైన కారణాన్ని తెలుసుకోవడానికి మీ వైద్యుడిని సంప్రదించండి."
        },
        hi: {
          directAnswer: "कम हीमोग्लोबिन का अर्थ हो सकता है कि आपका रक्त सामान्य से कम ऑक्सीजन ले जा रहा है।",
          briefExplanation: "इसके सामान्य कारणों में आयरन की कमी या पोषण संबंधी असंतुलन शामिल हैं।",
          practicalNextStep: "सटीक कारण और उपचार जानने के लिए स्वास्थ्य विशेषज्ञ से परामर्श लें।"
        }
      },

      doctor_questions: {
        en: {
          directAnswer: "Here are clear, practical questions you can prepare for your doctor visit.",
          briefExplanation: "Focusing on symptoms, medication purpose, and lifestyle safeguards ensures the most effective consultation.",
          practicalNextStep: "Ask: 1) What is the main cause of my symptoms? 2) How long should I take my medicines? 3) What warning signs require immediate care?"
        },
        ta: {
          directAnswer: "மருத்துவரிடம் கேட்க வேண்டிய முக்கியமான கேள்விகள் இதோ.",
          briefExplanation: "அறிகுறிகள், மருந்து உட்கொள்ளல் மற்றும் வாழ்க்கைமுறை மாற்றங்கள் குறித்து தெளிவு பெறுவது நலம்.",
          practicalNextStep: "கேளுங்கள்: 1) என் அறிகுறிகளுக்கான காரணம் என்ன? 2) மருந்துகளை எவ்வளவு காலம் எடுத்துக்கொள்ள வேண்டும்? 3) எப்போது மீண்டும் பரிசோதிக்க வேண்டும்?"
        },
        te: {
          directAnswer: "మీ వైద్యుడిని అడగడానికి ముఖ్యమైన ప్రశ్నలు ఇక్కడ ఉన్నాయి.",
          briefExplanation: "లక్షణాలు, మందుల సమయం మరియు తీసుకోవలసిన జాగ్రత్తలపై దృష్టి పెట్టడం ముఖ్యం.",
          practicalNextStep: "అడగండి: 1) నా లక్షణాలకు ప్రధాన కారణం ఏమిటి? 2) మందులు ఎంతకాలం వాడాలి? 3) ఎలాంటి మార్పులు గమనించాలి?"
        },
        hi: {
          directAnswer: "डॉक्टर से परामर्श के लिए कुछ महत्वपूर्ण प्रश्न तैयार किए गए हैं।",
          briefExplanation: "लक्षणों के कारण, दवा के समय और परहेज पर स्पष्टता प्राप्त करना सबसे अच्छा रहता है।",
          practicalNextStep: "पूछें: 1) मेरे लक्षणों का मूल कारण क्या है? 2) दवाएं कितने समय तक लेनी हैं? 3) किन चेतावनी संकेतों पर तुरंत दिखाना होगा?"
        }
      },

      headache: {
        en: {
          directAnswer: "Headaches are commonly caused by tension, dehydration, or eye strain.",
          briefExplanation: "Lack of rest, prolonged screen use, or stress can trigger scalp and neck muscle tightness.",
          practicalNextStep: "Rest in a quiet, dark room, drink 1–2 glasses of water, and seek medical care if pain is sudden and severe."
        },
        ta: {
          directAnswer: "மன அழுத்தம், நீரிழப்பு அல்லது கண் சோர்வு தலைவலிக்கு பொதுவான காரணங்கள்.",
          briefExplanation: "போதிய தூக்கமின்மை அல்லது அதிக நேரம் திரை பார்ப்பதால் கழுத்து மற்றும் தலை தசைகள் இறுக்கமடையலாம்.",
          practicalNextStep: "அமைதியான அறையில் ஓய்வெடுக்கவும், தண்ணீர் குடிக்கவும்; வலி தீவிரமடைந்தால் மருத்துவரை அணுகவும்."
        },
        te: {
          directAnswer: "ఒత్తిడి, డీహైడ్రేషన్ లేదా కంటి అలసట తలనొప్పికి సాధారణ కారణాలు.",
          briefExplanation: "నిద్రలేమి లేదా ఎక్కువసేపు స్క్రీన్ చూడటం వలన మెడ మరియు తల కండరాలు బిగుసుకుపోతాయి.",
          practicalNextStep: "ప్రశాంతమైన గదిలో విశ్రాంతి తీసుకోండి, నీరు త్రాగండి; నొప్పి తీవ్రంగా ఉంటే వైద్యుడిని సంప్రదించండి."
        },
        hi: {
          directAnswer: "सिरदर्द आमतौर पर तनाव, पानी की कमी (डिहाइड्रेशन) या आंखों की थकान के कारण होता है।",
          briefExplanation: "नींद की कमी या लंबे समय तक स्क्रीन देखने से सिर और गर्दन की मांसपेशियों में खिंचाव आ सकता है।",
          practicalNextStep: "शांत कमरे में आराम करें, पर्याप्त पानी पिएं और यदि दर्द बहुत तेज हो तो डॉक्टर को दिखाएं।"
        }
      },

      fever: {
        en: {
          directAnswer: "Fever indicates your body's immune response to an infection.",
          briefExplanation: "Common causes include viral upper respiratory infections like the cold or flu.",
          practicalNextStep: "Rest, drink plenty of fluids, and consult a doctor if temperature exceeds 103°F or lasts longer than 3 days."
        },
        ta: {
          directAnswer: "காய்ச்சல் என்பது உடலின் நோய் எதிர்ப்பு மண்டலம் தொற்றுநோயை எதிர்த்துப் போராடுவதைக் குறிக்கிறது.",
          briefExplanation: "சளி, இருமல் போன்ற வைரஸ் தொற்றுகள் இதற்கு பொதுவான காரணங்களாகும்.",
          practicalNextStep: "ஓய்வெடுத்து திரவ உணவுகளை அதிகம் உட்கொள்ளவும்; காய்ச்சல் 3 நாட்களுக்கு மேல் நீடித்தால் மருத்துவரை அணுகவும்."
        },
        te: {
          directAnswer: "జ్వరం అనేది మీ రోగనిరోధక వ్యవస్థ ఇన్ఫెక్షన్‌తో పోరాడుతున్నట్లు సూచిస్తుంది.",
          briefExplanation: "జలుబు లేదా ఫ్లూ వంటి వైరల్ ఇన్ఫెక్షన్లు దీనికి సాధారణ కారణాలు.",
          practicalNextStep: "విశ్రాంతి తీసుకోండి, ద్రవాలు పుష్కలంగా త్రాగండి; జ్వరం 3 రోజుల కంటే ఎక్కువ ఉంటే వైద్యుడిని సంప్రదించండి."
        },
        hi: {
          directAnswer: "बुखार इस बात का संकेत है कि आपकी प्रतिरक्षा प्रणाली किसी संक्रमण से लड़ रही है।",
          briefExplanation: "सामान्य कारणों में वायरल फ्लू या मौसमी सर्दी-जुकाम शामिल हैं।",
          practicalNextStep: "भरपूर आराम करें, तरल पदार्थ पिएं और बुखार 103°F से अधिक होने या 3 दिन से ज्यादा रहने पर डॉक्टर को दिखाएं।"
        }
      },

      stomach: {
        en: {
          directAnswer: "Stomach discomfort is commonly caused by acidity, gas, or mild indigestion.",
          briefExplanation: "Spicy foods, irregular meals, or stress can irritate the gastric lining.",
          practicalNextStep: "Sip warm water, stay upright after eating, and seek immediate care if pain is sharp or accompanied by vomiting."
        },
        ta: {
          directAnswer: "வயிற்று அசௌகரியம் பொதுவாக அசிடிட்டி, வாயு அல்லது அஜீரணக் கோளாறுகளால் ஏற்படுகிறது.",
          briefExplanation: "காரமான உணவு, ஒழுங்கற்ற உணவு நேரம் அல்லது மன அழுத்தம் வயிற்றை எரிச்சலடையச் செய்யலாம்.",
          practicalNextStep: "வெதுவெதுப்பான நீர் அருந்தவும்; சாப்பிட்ட உடனே படுக்க வேண்டாம்; கடுமையான வலி இருந்தால் மருத்துவரை அணுகவும்."
        },
        te: {
          directAnswer: "కడుపులో అసౌకర్యం సాధారణంగా ఎసిడిటీ, గ్యాస్ లేదా అజీర్ణం వల్ల వస్తుంది.",
          briefExplanation: "కారం ఎక్కువ ఉన్న ఆహారం లేదా క్రమరహిత భోజనం కడుపులో చికాకును కలిగిస్తాయి.",
          practicalNextStep: "గోరువెచ్చని నీరు త్రాగండి, భోజనం తర్వాత వెంటనే పడుకోవద్దు; తీవ్రమైన నొప్పి ఉంటే వైద్యుడిని సంప్రదించండి."
        },
        hi: {
          directAnswer: "पेट की तकलीफ आमतौर पर एसिडिटी, गैस या अपच के कारण होती है।",
          briefExplanation: "मसालेदार भोजन, अनियमित खान-पान या तनाव पेट में जलन पैदा कर सकते हैं।",
          practicalNextStep: "हल्का गुनगुना पानी पिएं, भोजन के तुरंत बाद न लेटें और तेज दर्द होने पर डॉक्टर से संपर्क करें।"
        }
      },

      respiratory: {
        en: {
          directAnswer: "Cough and throat irritation are typically caused by viral respiratory infections or dry air.",
          briefExplanation: "Seasonal allergies or post-nasal drip can also inflame the airway lining.",
          practicalNextStep: "Gargle with warm salt water, stay hydrated, and consult a doctor if you experience wheezing or shortness of breath."
        },
        ta: {
          directAnswer: "இருமல் மற்றும் தொண்டை வலி பொதுவாக வைரஸ் தொற்று அல்லது ஒவ்வாமையால் ஏற்படுகிறது.",
          briefExplanation: "பருவநிலை மாற்றம் அல்லது உலர்ந்த காற்று சுவாசக் குழாயில் எரிச்சலை ஏற்படுத்தலாம்.",
          practicalNextStep: "வெதுவெதுப்பான உப்பு நீரில் வாய் கொப்பளிக்கவும்; மூச்சுத் திணறல் ஏற்பட்டால் உடனே மருத்துவரை அணுகவும்."
        },
        te: {
          directAnswer: "దగ్గు మరియు గొంతు నొప్పి సాధారణంగా వైరల్ ఇన్ఫెక్షన్ లేదా అలెర్జీల వల్ల వస్తాయి.",
          briefExplanation: "వాతావరణ మార్పులు లేదా పొడి గాలి శ్వాసనాళాల్లో చికాకును కలిగిస్తాయి.",
          practicalNextStep: "గోరువెచ్చని ఉప్పు నీటితో పుక్కిలించండి; శ్వాస తీసుకోవడంలో ఇబ్బంది ఉంటే వెంటనే వైద్యుడిని సంప్రదించండి."
        },
        hi: {
          directAnswer: "खांसी और गले में खराश आमतौर पर वायरल संक्रमण या एलर्जी के कारण होती है।",
          briefExplanation: "मौसम में बदलाव या सूखी हवा से सांस की नली में सूजन आ सकती है।",
          practicalNextStep: "गुनगुने नमक के पानी से गरारे करें, और सांस लेने में कठिनाई होने पर तुरंत डॉक्टर को दिखाएं।"
        }
      },

      cardiac: {
        en: {
          directAnswer: "Palpitations can result from stress, caffeine, or cardiovascular changes.",
          briefExplanation: "Dehydration or lack of sleep often increases heart rate sensitivity.",
          practicalNextStep: "Sit down, breathe slowly, and seek emergency care immediately if accompanied by chest pain or shortness of breath."
        },
        ta: {
          directAnswer: "படபடப்பு மன அழுத்தம், காஃபின் அல்லது நீரிழப்பு காரணமாக ஏற்படலாம்.",
          briefExplanation: "போதிய தூக்கமின்மை இதயத் துடிப்பின் வேகத்தை அதிகரிக்கலாம்.",
          practicalNextStep: "அமைதியாக அமர்ந்து சீராக மூச்சு விடவும்; நெஞ்சு வலி இருந்தால் உடனடியாக அவசர மருத்துவ உதவியை நாடவும்."
        },
        te: {
          directAnswer: "గుండె దడ ఒత్తిడి, కెఫిన్ లేదా డీహైడ్రేషన్ వల్ల రావచ్చు.",
          briefExplanation: "నిద్రలేమి వల్ల గుండె స్పందనల వేగం పెరగవచ్చు.",
          practicalNextStep: "ప్రశాంతంగా కూర్చుని లోతైన శ్వాస తీసుకోండి; ఛాతీ నొప్పి ఉంటే వెంటనే ఎమర్జెన్సీ సహాయం పొందండి."
        },
        hi: {
          directAnswer: "घबराहट या दिल की धड़कन तेज होना तनाव, कैफीन या डिहाइड्रेशन के कारण हो सकता है।",
          briefExplanation: "नींद की कमी या चिंता हृदय गति को अस्थायी रूप से बढ़ा सकती है।",
          practicalNextStep: "आराम से बैठें और गहरी सांस लें; सीने में दर्द होने पर तुरंत आपातकालीन चिकित्सा सहायता लें।"
        }
      },

      musculoskeletal: {
        en: {
          directAnswer: "Body and muscle aches are commonly caused by physical strain, poor posture, or fatigue.",
          briefExplanation: "Prolonged sitting or awkward movements can cause minor muscle stiffness.",
          practicalNextStep: "Rest, apply a gentle warm compress, and seek medical evaluation if accompanied by numbness or weakness."
        },
        ta: {
          directAnswer: "உடல் மற்றும் தசை வலி பொதுவாக அதிக உழைப்பு அல்லது தவறான தோரணையால் ஏற்படுகிறது.",
          briefExplanation: "நீண்ட நேரம் ஒரே இடத்தில் அமர்வது தசை இறுக்கத்தை ஏற்படுத்தலாம்.",
          practicalNextStep: "ஓய்வெடுத்து வெதுவெதுப்பான ஒத்தடம் கொடுக்கவும்; உணர்வின்மை இருந்தால் மருத்துவரை அணுகவும்."
        },
        te: {
          directAnswer: "శరీర మరియు కండరాల నొప్పులు అలసట లేదా సరికాని భంగిమ వల్ల వస్తాయి.",
          briefExplanation: "ఎక్కువసేపు కూర్చోవడం వల్ల కండరాలు బిగుసుకుపోతాయి.",
          practicalNextStep: "విశ్రాంతి తీసుకోండి, వేడి కాపడం పెట్టండి; తిమ్మిరి ఉంటే వైద్యుడిని సంప్రదించండి."
        },
        hi: {
          directAnswer: "बदन दर्द और मांसपेशियों में खिंचाव शारीरिक थकान या गलत मुद्रा के कारण होता है।",
          briefExplanation: "लंबे समय तक एक ही स्थिति में बैठने से मांसपेशियों में अकड़न आ सकती है।",
          practicalNextStep: "आराम करें, सिकाई करें और यदि सुन्नपन या कमजोरी महसूस हो तो डॉक्टर को दिखाएं।"
        }
      },

      dizziness: {
        en: {
          directAnswer: "Dizziness is often triggered by sudden standing, dehydration, or skipped meals.",
          briefExplanation: "A temporary drop in blood pressure or inner ear changes can cause lightheadedness.",
          practicalNextStep: "Sit or lie down flat immediately, sip water, and seek emergency care if accompanied by slurred speech or facial weakness."
        },
        ta: {
          directAnswer: "திடீரென எழுந்து நிற்பது, நீரிழப்பு அல்லது உணவு தவிர்வு தலைசுற்றலை ஏற்படுத்தலாம்.",
          briefExplanation: "இரத்த அழுத்தத்தில் ஏற்படும் தற்காலிக வீழ்ச்சி மயக்க உணர்வை உண்டாக்கலாம்.",
          practicalNextStep: "உடனடியாக அமரவும் அல்லது படுக்கவும், தண்ணீர் குடிக்கவும்; பார்வை மங்கினால் மருத்துவரை அணுகவும்."
        },
        te: {
          directAnswer: "హఠాత్తుగా లేవడం, డీహైడ్రేషన్ లేదా భోజనం మానేయడం వల్ల కళ్ళు తిరగవచ్చు.",
          briefExplanation: "రక్తపోటులో తాత్కాలిక తగ్గుదల తలతిరగడానికి కారణం కావచ్చు.",
          practicalNextStep: "వెంటనే కూర్చోండి లేదా పడుకోండి, నీరు త్రాగండి; మాట తడబడితే వెంటనే ఆసుపత్రికి వెళ్లండి."
        },
        hi: {
          directAnswer: "चक्कर आना अक्सर अचानक खड़े होने, पानी की कमी या खाली पेट रहने के कारण होता है।",
          briefExplanation: "रक्तचाप में क्षणिक गिरावट या भीतरी कान का असंतुलन इसका कारण हो सकता है।",
          practicalNextStep: "तुरंत बैठ जाएं या लेटें, पानी पिएं और बोलने में कठिनाई होने पर तुरंत आपातकालीन सेवा लें।"
        }
      },

      dermatology: {
        en: {
          directAnswer: "Skin rashes or itching typically stem from mild contact allergies or dry skin.",
          briefExplanation: "Soaps, detergents, or insect bites can temporarily irritate the skin barrier.",
          practicalNextStep: "Wash gently with cool water, avoid scratching, and consult a doctor if the rash spreads rapidly or swells."
        },
        ta: {
          directAnswer: "தோல் தடிப்புகள் அல்லது அரிப்பு பொதுவாக ஒவ்வாமை அல்லது வறண்ட சருமத்தால் ஏற்படுகிறது.",
          briefExplanation: "சோப்பு அல்லது பூச்சிக் கடியால் சருமத்தில் தற்காலிக எரிச்சல் ஏற்படலாம்.",
          practicalNextStep: "குளிர்ந்த நீரால் கழுவவும், சொறிய வேண்டாம்; வீக்கம் ஏற்பட்டால் மருத்துவரை அணுகவும்."
        },
        te: {
          directAnswer: "చర్మంపై దద్దుర్లు లేదా దురద సాధారణంగా అలెర్జీ లేదా పొడి చర్మం వల్ల వస్తాయి.",
          briefExplanation: "సబ్బులు లేదా కీటకాల కాటు చర్మానికి చికాకు కలిగిస్తాయి.",
          practicalNextStep: "చల్లని నీటితో కడగండి, గోకవద్దు; దద్దుర్లు వేగంగా వ్యాపిస్తే వైద్యుడిని సంప్రదించండి."
        },
        hi: {
          directAnswer: "त्वचा पर चकत्ते या खुजली आमतौर पर एलर्जी या रूखी त्वचा के कारण होती है।",
          briefExplanation: "साबुन, डिटर्जेंट या किसी कीट के काटने से त्वचा में जलन हो सकती है।",
          practicalNextStep: "ठंडे पानी से हल्के धोएं, खुजलाएं नहीं और सूजन बढ़ने पर डॉक्टर से संपर्क करें।"
        }
      },

      sleep_fatigue: {
        en: {
          directAnswer: "Fatigue and sleep disturbance are commonly related to stress, irregular hours, or screen use.",
          briefExplanation: "Disrupted circadian rhythms diminish restorative sleep and lower daytime energy.",
          practicalNextStep: "Maintain a consistent bedtime, avoid screens 1 hour before sleep, and consult a doctor if tiredness persists."
        },
        ta: {
          directAnswer: "சோர்வு மற்றும் தூக்கமின்மை மன அழுத்தம் அல்லது அதிக திரை பயன்பாட்டினால் ஏற்படுகிறது.",
          briefExplanation: "தூங்கும் நேர மாற்றம் உடலின் இயற்கையான ஓய்வு சுழற்சியைப் பாதிக்கிறது.",
          practicalNextStep: "ஒழுங்கான நேரத்தில் தூங்கச் செல்லவும், படுக்கும் முன் மொபைல் பார்ப்பதைத் தவிர்க்கவும்."
        },
        te: {
          directAnswer: "అలసట మరియు నిద్రలేమి ఒత్తిడి లేదా ఎక్కువ స్క్రీన్ సమయం వల్ల సంభవించవచ్చు.",
          briefExplanation: "క్రమరహిత నిద్ర వేళలు సహజ శక్తిని తగ్గిస్తాయి.",
          practicalNextStep: "రోజూ ఒకే సమయానికి నిద్రపోండి, పడుకునే ముందు ఫోన్ వాడవద్దు."
        },
        hi: {
          directAnswer: "थकान और नींद न आना आमतौर पर तनाव, अनियमित दिनचर्या या स्क्रीन के अत्यधिक उपयोग से जुड़ा होता है।",
          briefExplanation: "नींद के अनियमित चक्र से शरीर को पूर्ण विश्राम नहीं मिल पाता।",
          practicalNextStep: "नियमित समय पर सोएं, सोने से पहले मोबाइल से दूर रहें और थकान बनी रहे तो डॉक्टर को दिखाएं।"
        }
      },

      general: {
        en: {
          directAnswer: "Your health inquiry has been reviewed.",
          briefExplanation: "Everyday factors such as hydration, nutrition, and rest significantly influence how you feel.",
          practicalNextStep: "Stay hydrated, monitor your symptoms, and discuss any concerning changes with your doctor."
        },
        ta: {
          directAnswer: "உங்கள் உடல்நலக் கேள்வி ஆய்வு செய்யப்பட்டது.",
          briefExplanation: "நீர்ச்சத்து, சத்தான உணவு மற்றும் போதிய ஓய்வு ஆகியவை உடல் ஆரோக்கியத்திற்கு மிக அவசியம்.",
          practicalNextStep: "நீர் அருந்துங்கள், உங்கள் அறிகுறிகளைக் கண்காணித்து மருத்துவரிடம் ஆலோசனை பெறவும்."
        },
        te: {
          directAnswer: "మీ ఆరోగ్య ప్రశ్న పరిశీలించబడింది.",
          briefExplanation: "నీరు, సరైన పోషకాహారం మరియు తగినంత విశ్రాంతి ఆరోగ్యంపై నేరుగా ప్రభావం చూపుతాయి.",
          practicalNextStep: "తగినంత నీరు త్రాగండి, ఏవైనా మార్పులు ఉంటే మీ వైద్యుడితో చర్చించండి."
        },
        hi: {
          directAnswer: "आपके स्वास्थ्य संबंधी प्रश्न की समीक्षा की गई है।",
          briefExplanation: "पानी, संतुलित पोषण और पर्याप्त आराम आपके स्वास्थ्य को सीधे प्रभावित करते हैं।",
          practicalNextStep: "हाइड्रेटेड रहें, अपने लक्षणों पर नजर रखें और किसी भी असामान्य बदलाव पर डॉक्टर से सलाह लें।"
        }
      }
    };

    const topicItem = knowledgeBase[topic] || knowledgeBase.general;
    const langData = topicItem[language] || topicItem.en || knowledgeBase.general.en;

    const formattedResponse = `${langData.directAnswer}\n\n${langData.briefExplanation}\n\n${langData.practicalNextStep}`;
    return {
      directAnswer: langData.directAnswer,
      briefExplanation: langData.briefExplanation,
      practicalNextStep: langData.practicalNextStep,
      formattedResponse,
      summary: `${langData.directAnswer} ${langData.briefExplanation}`,
      disclaimer: "VitaCare AI Copilot provides educational guidance and is not a substitute for professional medical care."
    };
  }

  /**
   * Gemini API Integration Layer
   */
  async callGemini(message, language, moduleType, healthContext, customKey = null) {
    const key = customKey || this.geminiKey;
    if (!key) throw new Error('No Gemini API Key provided.');

    const prompt = `You are VitaCare AI Health Copilot, a certified clinical assistant.
CRITICAL FORMAT & SAFETY RULES:
- Provide SHORT, DIRECT, PATIENT-FRIENDLY answers. Keep responses concise and simple.
- Do NOT provide unnecessary introductions, long paragraphs, repetitive disclaimers, or complicated medical jargon.
- Format every response strictly in 3 short parts:
  1. Direct answer: (1 direct, clear sentence answering the question)
  2. Brief explanation: (1 brief sentence explaining the cause, normal reference range, or context)
  3. Practical next step: (1 practical next step or question for doctor, if appropriate)
- Output pure JSON with keys: "directAnswer", "briefExplanation", "practicalNextStep", "summary", "formattedResponse", "disclaimer".
- "formattedResponse" should join directAnswer, briefExplanation, practicalNextStep with double newlines.
- Never fabricate test results, medications, or diagnoses. Use the actual user clinical context provided.
- Target Language: ${language === 'ta' ? 'Tamil' : language === 'te' ? 'Telugu' : language === 'hi' ? 'Hindi' : 'English'}. Write the entire answer in this target language.
- User clinical context: ${JSON.stringify(healthContext)}
- User query: "${message}"`;

    const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];
    let lastError = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Gemini ${model} HTTP ${response.status}: ${errBody}`);
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          let cleaned = rawText.trim();
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }

          let parsed;
          try {
            parsed = JSON.parse(cleaned);
          } catch (e) {
            return {
              isEmergency: false,
              reply: rawText,
              data: { summary: rawText, formattedResponse: rawText }
            };
          }

          const formatted = parsed.formattedResponse || 
            `${parsed.directAnswer || ''}\n\n${parsed.briefExplanation || ''}\n\n${parsed.practicalNextStep || ''}`.trim() ||
            parsed.summary || rawText;

          return {
            isEmergency: false,
            reply: formatted,
            data: {
              ...parsed,
              formattedResponse: formatted
            }
          };
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('All Gemini models failed.');
  }

  /**
   * OpenAI API Integration Layer
   */
  async callOpenAI(message, language, moduleType, healthContext, customKey = null) {
    const key = customKey || this.openaiKey;
    if (!key) throw new Error('No OpenAI API Key provided.');

    const prompt = `You are VitaCare AI Health Copilot, a certified clinical assistant.
CRITICAL FORMAT & SAFETY RULES:
- Provide SHORT, DIRECT, PATIENT-FRIENDLY answers. Keep responses concise and simple.
- Do NOT provide unnecessary introductions, long paragraphs, repetitive disclaimers, or complicated medical jargon.
- Format every response strictly in 3 short parts:
  1. Direct answer: (1 direct sentence)
  2. Brief explanation: (1 brief sentence)
  3. Practical next step: (1 practical next step)
- Output pure JSON with keys: "directAnswer", "briefExplanation", "practicalNextStep", "summary", "formattedResponse", "disclaimer".
- Never fabricate test results, medications, or diagnoses. Use actual user clinical context.
- Target Language: ${language === 'ta' ? 'Tamil' : language === 'te' ? 'Telugu' : language === 'hi' ? 'Hindi' : 'English'}.
- User context: ${JSON.stringify(healthContext)}
- User query: "${message}"`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const formatted = parsed.formattedResponse || 
        `${parsed.directAnswer || ''}\n\n${parsed.briefExplanation || ''}\n\n${parsed.practicalNextStep || ''}`.trim() ||
        parsed.summary;

      return {
        isEmergency: false,
        reply: formatted,
        data: {
          ...parsed,
          formattedResponse: formatted
        }
      };
    }
    return null;
  }
}

export const aiService = new AIService();
