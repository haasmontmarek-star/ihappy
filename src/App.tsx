import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, ShieldAlert, Heart, Wallet, RefreshCw, Eye, Ghost, Quote as QuoteIcon, Mail, Phone, CheckCircle2, Baby, MessageSquareText, UserRound, Users, Lock, BarChart3, ChevronLeft, HelpCircle } from 'lucide-react';
import { getAnalysis, getCoachingQuestions, AnalysisResult } from './services/geminiService';
import { db, auth } from './lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, updateDoc, doc, where, limit } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { Tooltip } from './components/Tooltip';
import { Onboarding } from './components/Onboarding';
import { LegalModals } from './components/LegalModals';

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showGDPR, setShowGDPR] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [symptom, setSymptom] = useState('');
  const [step, setStep] = useState<'input' | 'loading-questions' | 'coaching' | 'loading' | 'result' | 'admin'>('input');
  const [questions, setQuestions] = useState<string[]>([]);
  const [coachingStep, setCoachingStep] = useState(0);
  const [coachingAnswers, setCoachingAnswers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCritical, setIsCritical] = useState(false);
  const [lastAnalysisId, setLastAnalysisId] = useState<string | null>(null);

  // Admin states
  const [user, setUser] = useState<User | null>(null);
  const [adminStats, setAdminStats] = useState<any[]>([]);
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  // Booking form states
  const [showBooking, setShowBooking] = useState(false);
  const [bookingData, setBookingData] = useState({ email: '', phone: '' });
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const [forceOnboarding, setForceOnboarding] = useState(false);

  const handleNextCoachingStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (coachingStep < questions.length - 1) {
      setCoachingStep(prev => prev + 1);
    } else {
      processAnalysis();
    }
  };

  const processAnalysis = async () => {
    setStep('loading');
    setLoading(true);
    setError(null);
    setResult(null);
    setShowBooking(false);

    try {
      // Combining initial symptom with coaching context for deeper analysis
      const fullContext = `Symptom: ${symptom}\nKontext: ${questions.map((q, i) => `${q}: ${coachingAnswers[i]}`).join('\n')}`;
      const data = await getAnalysis(fullContext);
      if (data.isCritical) {
        setIsCritical(data.isCritical);
        setStep('input');
        return;
      }

      // Record to Firebase
      try {
        const docRef = await addDoc(collection(db, 'analyses'), {
          symptom: symptom,
          mainPattern: data.symptom,
          createdAt: serverTimestamp(),
          hasEmail: false
        });
        setLastAnalysisId(docRef.id);
      } catch (dbErr) {
        console.error('Error saving to DB:', dbErr);
      }

      setResult(data);
      setStep('result');
    } catch (err) {
      setError('Zrcadlo se zamlžilo. Zkuste to prosím znovu.');
      setStep('input');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptom.trim()) return;
    
    setStep('loading-questions');
    setError(null);
    
    try {
      const { questions: generatedQuestions, isCritical: criticalDetected } = await getCoachingQuestions(symptom);
      
      if (criticalDetected) {
        setIsCritical(true);
        setStep('input');
        return;
      }
      
      setQuestions(generatedQuestions);
      setStep('coaching');
    } catch (err) {
      setError('Nepodařilo se připravit otázky. Zkuste to prosím znovu.');
      setStep('input');
      console.error(err);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingData.email || !bookingData.phone) return;
    setBookingStatus('submitting');
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: bookingData.email,
          phone: bookingData.phone,
          analysis: result
        }),
      });

      if (!response.ok) throw new Error('Failed to send reservation');

      // Update Firebase record with email and phone
      if (lastAnalysisId) {
        try {
          await updateDoc(doc(db, 'analyses', lastAnalysisId), {
            email: bookingData.email,
            phone: bookingData.phone,
            hasEmail: true
          });
        } catch (dbErr) {
          console.error('Error updating DB with email/phone:', dbErr);
        }
      }

      setBookingStatus('success');
    } catch (err) {
      console.error(err);
      alert('Omlouváme se, rezervaci se nepodařilo odeslat. Zkuste to prosím znovu.');
      setBookingStatus('idle');
    }
  };

  const handleReset = () => {
    setResult(null);
    setSymptom('');
    setStep('input');
    setCoachingStep(0);
    setCoachingAnswers([]);
    setError(null);
    setIsCritical(false);
    setShowBooking(false);
    setBookingStatus('idle');
    setBookingData({ email: '', phone: '' });
    setLastAnalysisId(null);
  };

  const handleAdminAccess = async () => {
    if (!user) {
      const provider = new GoogleAuthProvider();
      try {
        const result = await signInWithPopup(auth, provider);
        setUser(result.user);
      } catch (err) {
        console.error(err);
        return;
      }
    }
    setStep('admin');
    fetchStats();
  };

  const fetchStats = async () => {
    setIsAdminLoading(true);
    try {
      const q = query(collection(db, 'analyses'), orderBy('createdAt', 'desc'), limit(100));
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAdminStats(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAdminLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#333333] font-sans selection:bg-[#00CBA9] selection:text-white">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-ihappy-pink/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-ihappy-orange/10 blur-[150px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-20">
        <header className="mb-12 md:mb-20 text-center space-y-6 md:space-y-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-6 md:mb-8"
          >
            <div className="text-3xl md:text-5xl font-extrabold tracking-tighter text-ihappy-pink flex items-center gap-1">
              <span className="text-zinc-900 italic">i</span>Happy
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-ihappy-orange rounded-full mt-3 md:mt-4 ml-1" />
            </div>
          </motion.div>

          <div className="space-y-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center items-center gap-3 px-4"
            >
              <span className="text-[9px] md:text-[11px] uppercase tracking-[0.3em] md:tracking-[0.5em] text-ihappy-pink font-bold text-center">Analýza vašeho vnitřního nastavení</span>
              <button 
                onClick={() => setForceOnboarding(true)}
                className="p-1 hover:bg-ihappy-pink/10 rounded-full transition-colors group"
                title="Jak to funguje?"
              >
                <HelpCircle className="w-3 h-3 text-ihappy-pink/50 group-hover:text-ihappy-pink" />
              </button>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-7xl font-display text-zinc-900 tracking-tight leading-[1.1] max-w-4xl mx-auto font-extrabold px-2"
            >
              Mentorské <span className="text-ihappy-pink">zrcadlo</span>.
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-6 md:mt-8 text-zinc-700 text-base md:text-xl max-w-2xl mx-auto font-normal leading-relaxed px-4"
            >
              Mentorské zrcadlo, které odhalí, proč se stále držíte zpátky a co vás to skutečně stojí.
            </motion.p>
          </div>
        </header>

        {step === 'input' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-3xl mx-auto px-2 sm:px-0"
          >
            <div className="bg-white p-8 sm:p-12 md:p-16 rounded-[30px] sm:rounded-[40px] shadow-2xl shadow-ihappy-pink/5 border border-ihappy-pink/10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-ihappy-pink to-ihappy-orange" />
              
              <div className="text-center mb-8 md:mb-12">
                <div className="flex justify-center items-center gap-2 mb-2">
                  <h2 className="text-2xl md:text-3xl font-display text-zinc-900 font-bold text-center">Co vás brzdí nebo omezuje?</h2>
                </div>
                <p className="text-ihappy-pink text-sm md:text-lg mt-4 md:mt-6 tracking-[0.2em] font-black uppercase">Zde začněte psát svůj příběh:</p>
              </div>

              <form onSubmit={handleAnalyze} className="space-y-8 md:space-y-12">
                <div className="space-y-4">
                  <textarea
                    value={symptom}
                    onChange={(e) => setSymptom(e.target.value)}
                    placeholder="Např. strach z viditelnosti, neumím říct NE, pocit nehodnosti, finanční limit..."
                    className="w-full bg-white border-2 border-zinc-200 rounded-2xl p-6 md:p-8 text-2xl md:text-4xl font-display font-black text-zinc-900 focus:outline-none focus:ring-8 focus:ring-ihappy-pink/10 focus:border-ihappy-pink transition-all min-h-[220px] md:min-h-[300px] resize-none placeholder:text-zinc-400 placeholder:italic shadow-inner"
                    disabled={loading}
                    id="symptom-input"
                  />
                </div>

                <div className="flex justify-center flex-col items-center gap-6">
                  <button
                    type="submit"
                    disabled={loading || !symptom.trim()}
                    className="w-full sm:w-auto px-12 md:px-20 py-6 md:py-8 bg-ihappy-pink text-white rounded-full text-xs md:text-sm uppercase tracking-[0.2em] font-black hover:bg-ihappy-pink/90 hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-ihappy-pink/40 disabled:bg-zinc-100 disabled:text-zinc-300 disabled:shadow-none disabled:cursor-not-allowed group"
                    id="analyze-button"
                  >
                    <span className="flex items-center justify-center gap-4 font-bold whitespace-nowrap">Spustit analýzu <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" /></span>
                  </button>
                  
                  <div className="max-w-md text-center space-y-2">
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      Kliknutím na tlačítko souhlasíte se zpracováním vašich odpovědí umělou inteligencí pro účely sebepoznání. 
                      Data nejsou ukládána s vaší identitou, pokud ji sami neposkytnete.
                    </p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-4">
                      ⚠️ Nejedná se o lékařskou diagnozu ani psychoterapii.
                    </p>
                  </div>
                </div>
              </form>

              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-8 p-4 rounded-xl bg-red-50 text-red-500 text-sm flex items-center gap-3 justify-center border border-red-100"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    <p>{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {step === 'loading-questions' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-2xl mx-auto text-center space-y-8 py-20"
          >
            <div className="w-20 h-20 bg-ihappy-pink/10 rounded-full flex items-center justify-center mx-auto relative">
              <div className="absolute inset-0 border-2 border-ihappy-pink/20 border-t-ihappy-pink rounded-full animate-spin" />
              <Sparkles className="w-8 h-8 text-ihappy-pink animate-pulse" />
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-display font-bold text-zinc-900">Ladím zrcadlo iHappy...</h3>
              <p className="text-zinc-600 font-medium max-w-xs mx-auto italic">Hledám ty správné otázky pro nahlédnutí pod povrch...</p>
            </div>
          </motion.div>
        )}

        {step === 'coaching' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto px-4"
          >
            <div className="bg-white p-8 md:p-16 rounded-[30px] md:rounded-[40px] shadow-2xl shadow-ihappy-pink/5 border border-ihappy-pink/10 text-center relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-ihappy-pink/10">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${((coachingStep + 1) / questions.length) * 100}%` }}
                    className="h-full bg-ihappy-pink"
                  />
               </div>

               <div className="mb-6 md:mb-10 text-ihappy-pink font-bold tracking-[0.2em] md:tracking-[0.3em] uppercase text-[9px] md:text-[10px]">
                  Příprava vhledu: Otázka {coachingStep + 1} z {questions.length}
               </div>

               <h3 className="text-xl md:text-3xl font-display font-medium text-zinc-900 mb-8 md:mb-12 leading-relaxed min-h-[80px] md:min-h-[100px] flex items-center justify-center px-2">
                  {questions[coachingStep]}
               </h3>

               <form onSubmit={handleNextCoachingStep} className="space-y-8 md:space-y-10">
                  <input 
                    autoFocus
                    required
                    value={coachingAnswers[coachingStep] || ''}
                    onChange={(e) => {
                      const newAnswers = [...coachingAnswers];
                      newAnswers[coachingStep] = e.target.value;
                      setCoachingAnswers(newAnswers);
                    }}
                    placeholder="Vaše upřímná odpověď..."
                    className="w-full bg-white border-b-4 border-zinc-200 p-4 md:p-6 text-xl md:text-2xl font-display font-medium text-zinc-900 focus:outline-none focus:border-ihappy-pink transition-all text-center placeholder:text-zinc-300 shadow-sm"
                  />

                  <div className="flex justify-center">
                    <button 
                      type="submit"
                      disabled={!(coachingAnswers[coachingStep]?.trim())}
                      className="w-full sm:w-auto px-10 md:px-12 py-4 md:py-5 bg-zinc-900 text-white rounded-full text-[9px] md:text-[10px] uppercase tracking-[0.3em] md:tracking-[0.4em] font-bold hover:bg-black transition-all disabled:opacity-30"
                    >
                      {coachingStep < questions.length - 1 ? 'Další otázka' : 'Zobrazit zrcadlo'}
                    </button>
                  </div>
               </form>
            </div>
          </motion.div>
        )}

        {step === 'loading' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-2xl mx-auto text-center space-y-8 py-20"
          >
            <div className="relative w-28 h-28 mx-auto">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-[3px] border-ihappy-pink/10 border-t-ihappy-pink rounded-full shadow-[0_0_15px_rgba(244,114,182,0.3)]"
              />
              <div className="absolute inset-0 m-auto w-16 h-16 bg-white rounded-full flex items-center justify-center border border-zinc-50 shadow-sm">
                <RefreshCw className="w-8 h-8 text-ihappy-pink animate-spin" />
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-3xl font-display font-bold text-zinc-900 tracking-tight">Nahlížím do vašeho nitra...</h3>
              <div className="flex flex-col items-center gap-2">
                <p className="text-zinc-700 font-normal max-w-sm mx-auto">Zrcadlo iHappy analyzuje hluboké limity vašeho příběhu.</p>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "200px" }}
                  transition={{ duration: 3, ease: "easeInOut" }}
                  className="h-1 bg-ihappy-pink/20 rounded-full overflow-hidden"
                >
                  <motion.div 
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="h-full w-1/2 bg-ihappy-pink"
                  />
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'result' && result && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-16 md:space-y-24 px-2"
          >
            <section className="grid grid-cols-1 gap-8 md:gap-12 items-start text-left">
              <div className="space-y-8 md:space-y-12">
                <div className="bg-white p-8 sm:p-12 rounded-[30px] sm:rounded-[40px] shadow-xl shadow-zinc-100 border border-ihappy-pink/5 space-y-8 md:space-y-10">
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-widest text-ihappy-pink font-bold">Identifikovaný vzorec</label>
                    <p className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-zinc-900 leading-tight">{result.symptom}</p>
                  </div>
                  
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-widest text-ihappy-orange font-bold">Původ v minulosti</label>
                    <div className="space-y-6">
                      <p className="text-xl sm:text-2xl leading-relaxed text-zinc-700 font-display">„{result.pastConnection}“</p>
                      <div className="h-[2px] w-24 bg-gradient-to-r from-ihappy-pink to-transparent" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                <div className="p-8 md:p-10 bg-white rounded-[30px] border border-ihappy-pink/10 shadow-lg shadow-zinc-100 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-ihappy-pink/5 rounded-full flex items-center justify-center">
                      <Heart className="w-5 h-5 md:w-6 md:h-6 text-ihappy-pink" />
                    </div>
                    <Tooltip content="Jak vaše psychické nastavení ovlivňuje vaše fyzické zdraví a vitalitu.">
                      <HelpCircle className="w-4 h-4 text-zinc-200 cursor-help" />
                    </Tooltip>
                  </div>
                  <label className="text-[10px] uppercase tracking-widest text-ihappy-pink font-bold block">Vliv na zdraví</label>
                  <p className="text-base md:text-lg font-normal text-zinc-800 leading-relaxed">{result.priceHealth}</p>
                </div>

                <div className="p-8 md:p-10 bg-white rounded-[30px] border border-ihappy-orange/10 shadow-lg shadow-zinc-100 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-ihappy-orange/5 rounded-full flex items-center justify-center">
                      <Wallet className="w-5 h-5 md:w-6 md:h-6 text-ihappy-orange" />
                    </div>
                    <Tooltip content="Analýza vašich finančních limitů a schopnosti tvořit hojnost.">
                      <HelpCircle className="w-4 h-4 text-zinc-400 cursor-help" />
                    </Tooltip>
                  </div>
                  <label className="text-[10px] uppercase tracking-widest text-ihappy-orange font-bold block">Vliv na finance</label>
                  <p className="text-base md:text-lg font-normal text-zinc-800 leading-relaxed">{result.priceFinance}</p>
                </div>

                <div className="p-8 md:p-10 bg-white rounded-[30px] border border-ihappy-pink/10 shadow-lg shadow-zinc-100 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-ihappy-pink/5 rounded-full flex items-center justify-center">
                      <UserRound className="w-5 h-5 md:w-6 md:h-6 text-ihappy-pink" />
                    </div>
                    <Tooltip content="Jak se vaše limity promítají do intimity a porozumění s partnerem.">
                      <HelpCircle className="w-4 h-4 text-zinc-400 cursor-help" />
                    </Tooltip>
                  </div>
                  <label className="text-[10px] uppercase tracking-widest text-ihappy-pink font-bold block">Partnerský vztah</label>
                  <p className="text-base md:text-lg font-normal text-zinc-800 leading-relaxed">{result.relationshipPartner}</p>
                </div>

                <div className="p-8 md:p-10 bg-white rounded-[30px] border border-ihappy-orange/10 shadow-lg shadow-zinc-100 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-ihappy-orange/5 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 md:w-6 md:h-6 text-ihappy-orange" />
                    </div>
                    <Tooltip content="Jak vaše vnitřní nastavení ovlivňuje kvalitu vašich sociálních vazeb a vytváří limity.">
                      <HelpCircle className="w-4 h-4 text-zinc-400 cursor-help" />
                    </Tooltip>
                  </div>
                  <label className="text-[10px] uppercase tracking-widest text-ihappy-orange font-bold block">Okolí a přátelé</label>
                  <p className="text-base md:text-lg font-normal text-zinc-800 leading-relaxed">{result.relationshipFriends}</p>
                </div>

                <div className="p-8 md:p-10 bg-zinc-900 text-white rounded-[30px] border border-white/10 shadow-lg shadow-zinc-100 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-white/5 rounded-full flex items-center justify-center">
                      <Baby className="w-5 h-5 md:w-6 md:h-6 text-ihappy-pink" />
                    </div>
                    <Tooltip content="Přenášení nezpracovaných limitů na další generaci.">
                      <HelpCircle className="w-4 h-4 text-white/20 cursor-help" />
                    </Tooltip>
                  </div>
                  <label className="text-[10px] uppercase tracking-widest text-ihappy-pink font-bold block">Vliv na vaše děti</label>
                  <p className="text-base md:text-lg font-light text-zinc-300 leading-relaxed">{result.childrenImpact}</p>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-[30px] sm:rounded-[50px] p-8 sm:p-12 md:p-20 relative overflow-hidden border border-ihappy-pink/10 shadow-2xl shadow-ihappy-pink/5 text-center">
              <div className="absolute top-0 right-0 w-64 h-64 bg-ihappy-pink/5 blur-[100px] rounded-full -mr-32 -mt-32" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-ihappy-orange/5 blur-[100px] rounded-full -ml-32 -mb-32" />

              <div className="relative z-10 text-center mb-10 md:mb-16 space-y-4">
                <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-ihappy-pink mx-auto opacity-50" />
                <h2 className="text-3xl md:text-5xl font-display font-extrabold text-zinc-900 tracking-tight">Budoucnost ve vašich rukou</h2>
                <div className="h-1 w-20 bg-ihappy-orange mx-auto rounded-full" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 relative z-10">
                <div className="group space-y-6 md:space-y-8 p-6 md:p-10 rounded-[30px] transition-all hover:bg-zinc-50 border border-transparent hover:border-zinc-100 text-left">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="inline-block px-4 py-1.5 bg-zinc-100 text-zinc-500 text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-full font-sans">Cesta beze změny</span>
                      <Tooltip content="Pravděpodobný vývoj, pokud budete pokračovat ve stejných blocích.">
                        <HelpCircle className="w-4 h-4 text-zinc-200 cursor-help" />
                      </Tooltip>
                    </div>
                    <p className="text-base md:text-lg leading-relaxed text-zinc-600 font-display font-medium">Pokud program necháte beze změny...</p>
                  </div>
                  <p className="text-lg md:text-xl leading-relaxed font-medium text-zinc-800">{result.variantA}</p>
                </div>
                
                <div className="space-y-6 md:space-y-8 p-6 md:p-10 rounded-[30px] border-2 border-ihappy-pink/20 bg-ihappy-pink/5 shadow-xl shadow-ihappy-pink/10 text-left">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="inline-block px-4 py-1.5 bg-ihappy-pink text-white text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg shadow-ihappy-pink/20 font-sans">Cesta k iHappy</span>
                      <Tooltip content="Možnosti a potenciál, který se otevře po vědomé transformaci.">
                        <HelpCircle className="w-4 h-4 text-ihappy-pink/40 cursor-help" />
                      </Tooltip>
                    </div>
                    <p className="text-base md:text-lg leading-relaxed text-ihappy-pink font-display font-semibold">Pokud se rozhodnete pro změnu teď...</p>
                  </div>
                  <p className="text-lg md:text-xl leading-relaxed font-bold text-zinc-900">{result.variantB}</p>
                  <div className="h-1.5 w-24 bg-ihappy-orange rounded-full" />
                </div>
              </div>

              <div className="mt-12 md:mt-20 flex flex-col items-center gap-6 md:gap-8 relative z-10 w-full">
                <AnimatePresence mode="wait">
                  {!showBooking && bookingStatus !== 'success' ? (
                    <motion.button 
                      key="order-btn"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => setShowBooking(true)}
                      className="w-full sm:w-auto px-10 md:px-16 py-6 md:py-7 bg-ihappy-orange text-white rounded-full text-xs md:text-sm uppercase tracking-[0.3em] md:tracking-[0.4em] font-extrabold hover:bg-ihappy-orange/90 hover:scale-105 transition-all shadow-2xl shadow-ihappy-orange/30 cursor-pointer"
                    >
                      Objednat konzultaci iHappy
                    </motion.button>
                  ) : bookingStatus === 'success' ? (
                    <motion.div 
                      key="success-msg"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-4 text-ihappy-pink bg-ihappy-pink/5 p-6 md:p-10 rounded-[30px] md:rounded-[40px] border border-ihappy-pink/20 w-full max-w-md mx-auto"
                    >
                      <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16" />
                      <p className="text-lg md:text-xl font-display font-bold text-center">Rezervace odeslána. Mentor iHappy se vám brzy ozve.</p>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="booking-form"
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-md bg-zinc-50 p-6 md:p-10 rounded-[30px] md:rounded-[40px] border border-zinc-100 shadow-inner"
                    >
                      <h3 className="text-xl md:text-2xl font-display font-bold text-center mb-6 md:mb-8">Rezervace konzultace</h3>
                      <form onSubmit={handleBookingSubmit} className="space-y-4 md:space-y-6">
                        <div className="space-y-2 text-left">
                          <label className="text-[10px] uppercase tracking-widest text-ihappy-pink font-bold ml-2">Váš Email</label>
                          <div className="relative">
                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input 
                              required
                              type="email"
                              placeholder="vas@email.cz"
                              value={bookingData.email}
                              onChange={e => setBookingData({...bookingData, email: e.target.value})}
                              className="w-full bg-white border border-zinc-100 rounded-2xl py-3.5 md:py-4 pl-14 pr-5 focus:outline-none focus:border-ihappy-pink focus:ring-4 focus:ring-ihappy-pink/5 transition-all font-display text-sm md:text-base"
                            />
                          </div>
                        </div>

                        <div className="space-y-2 text-left">
                          <label className="text-[10px] uppercase tracking-widest text-ihappy-orange font-bold ml-2">Váš Telefon</label>
                          <div className="relative">
                            <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input 
                              type="tel"
                              required
                              placeholder="+420 123 456 789"
                              value={bookingData.phone}
                              onChange={e => setBookingData({...bookingData, phone: e.target.value})}
                              className="w-full bg-white border border-zinc-100 rounded-2xl py-3.5 md:py-4 pl-14 pr-5 focus:outline-none focus:border-ihappy-orange focus:ring-4 focus:ring-ihappy-orange/5 transition-all font-display text-sm md:text-base"
                            />
                          </div>
                        </div>
                        <button 
                          type="submit"
                          disabled={bookingStatus === 'submitting'}
                          className="w-full py-4 md:py-5 bg-ihappy-pink text-white rounded-2xl text-[10px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.3em] font-extrabold hover:bg-ihappy-pink/90 transition-all flex items-center justify-center gap-4 shadow-xl shadow-ihappy-pink/20"
                        >
                          {bookingStatus === 'submitting' ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Odeslat rezervaci'}
                        </button>
                        <p className="text-[9px] text-zinc-400 text-center leading-tight">
                          Odesláním souhlasíte se zpracováním údajů PrincepsMentor s.r.o. za účelem domluvení termínu konzultace.
                        </p>
                        <button 
                          type="button"
                          onClick={() => setShowBooking(false)}
                          className="w-full text-center text-[10px] uppercase tracking-widest text-zinc-400 font-bold hover:text-zinc-600 transition-colors py-2"
                        >
                          Zrušit
                        </button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button 
                  onClick={handleReset}
                  className="w-full sm:w-auto px-10 md:px-14 py-5 md:py-6 border-2 border-ihappy-pink/30 text-ihappy-pink rounded-full text-[10px] md:text-xs uppercase tracking-[0.3em] md:tracking-[0.4em] font-bold hover:bg-ihappy-pink hover:text-white hover:border-ihappy-pink transition-all group"
                >
                  <span className="flex items-center justify-center gap-4 font-bold">Zahájit novou analýzu <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700" /></span>
                </button>
              </div>
            </section>
          </motion.div>
        )}

        {/* Three Pillars Section */}
        <section className="mt-24 md:mt-40 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-20 px-4">
          <div className="space-y-6 md:space-y-8 text-center md:text-left">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-ihappy-pink/10 rounded-2xl flex items-center justify-center mx-auto md:mx-0">
              <Heart className="w-7 h-7 md:w-8 md:h-8 text-ihappy-pink" />
            </div>
            <div className="space-y-2 md:space-y-4">
              <h3 className="text-xs md:text-sm uppercase tracking-widest text-ihappy-pink font-bold">Vnitřní klid</h3>
              <p className="text-2xl md:text-4xl font-display text-zinc-900 font-extrabold leading-tight">Rovnováha v každém okamžiku.</p>
            </div>
          </div>
          <div className="space-y-6 md:space-y-8 text-center md:text-left">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-ihappy-orange/10 rounded-2xl flex items-center justify-center mx-auto md:mx-0">
              <Wallet className="w-7 h-7 md:w-8 md:h-8 text-ihappy-orange" />
            </div>
            <div className="space-y-2 md:space-y-4">
              <h3 className="text-xs md:text-sm uppercase tracking-widest text-ihappy-orange font-bold">Úspěch</h3>
              <p className="text-2xl md:text-4xl font-display text-zinc-900 font-extrabold leading-tight">Vaše hodnota měřená výsledky.</p>
            </div>
          </div>
          <div className="space-y-6 md:space-y-8 text-center md:text-left">
            <div className="w-14 h-14 md:w-16 md:h-16 bg-ihappy-pink/10 rounded-2xl flex items-center justify-center mx-auto md:mx-0">
              <RefreshCw className="w-7 h-7 md:w-8 md:h-8 text-ihappy-pink" />
            </div>
            <div className="space-y-2 md:space-y-4">
              <h3 className="text-xs md:text-sm uppercase tracking-widest text-ihappy-pink font-bold">Růst</h3>
              <p className="text-2xl md:text-4xl font-display text-zinc-900 font-extrabold leading-tight">Neustálý posun vpřed.</p>
            </div>
          </div>
        </section>

        {/* References Section */}
        <section className="mt-24 md:mt-40 text-center max-w-4xl mx-auto px-4">
          <label className="text-[10px] md:text-[11px] uppercase tracking-[0.3em] md:tracking-[0.5em] text-ihappy-pink font-bold block mb-10 md:mb-16">Inspirace od našich klientek</label>
          <div className="relative p-10 sm:p-16 md:p-24 bg-zinc-50 rounded-[40px] md:rounded-[60px] border border-zinc-100">
            <QuoteIcon className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 md:w-14 md:h-14 text-white bg-ihappy-pink rounded-full p-3 shadow-lg shadow-ihappy-pink/20" />
            <p className="text-xl sm:text-3xl md:text-4xl font-display font-extrabold text-zinc-900 leading-relaxed max-w-2xl mx-auto">
              „Změna začala rozhodnutím postavit se své pravdě v iHappy zrcadle.“
            </p>
            <div className="mt-8 md:mt-12 flex justify-center items-center gap-4">
              <div className="w-8 md:w-10 h-[2px] bg-ihappy-orange" />
              <span className="text-[9px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.3em] text-ihappy-pink font-bold">Jana, majitelka firmy</span>
              <div className="w-8 md:w-10 h-[2px] bg-ihappy-orange" />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-40 px-8 pt-20 pb-32 bg-zinc-900 text-white text-center space-y-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-3xl font-extrabold tracking-tighter flex justify-center items-center gap-1">
            <span className="italic">i</span>Happy
            <div className="w-2 h-2 bg-ihappy-orange rounded-full mt-3 ml-1" />
          </div>
          <p className="text-xs uppercase tracking-[0.5em] text-ihappy-pink font-bold py-2">Průvodce vaší transformací</p>
          <div className="h-px w-32 bg-ihappy-orange mx-auto" />
          
          <div className="pt-8 text-zinc-200 text-sm space-y-6">
            <div>
              <span className="text-zinc-500 uppercase tracking-widest text-[10px] block mb-1">Provozovatel</span>
              <p className="text-white font-bold">PrincepsMentor s.r.o.</p>
              <p className="text-zinc-300 text-xs">Dětmarovice 789, 735 71 Dětmarovice</p>
              <p className="text-zinc-300 text-xs text-zinc-500 italic mt-1">Zápis u Krajského soudu v Ostravě, oddíl C, vložka 81196</p>
              <p className="text-zinc-300 text-xs">IČO: 08892911</p>
            </div>
            <div className="flex flex-col items-center gap-6">
              <div>
                <span className="text-zinc-500 uppercase tracking-widest text-[10px] block mb-1">Kontakt</span>
                <a href="mailto:ahoj@ihappy.cz" className="text-white font-bold hover:text-ihappy-pink transition-colors text-lg">ahoj@ihappy.cz</a>
              </div>
              
              <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 pt-4">
                <button onClick={() => setShowGDPR(true)} className="text-[10px] uppercase tracking-widest text-zinc-400 hover:text-ihappy-pink transition-colors font-bold">Ochrana soukromí (GDPR)</button>
                <button onClick={() => setShowTerms(true)} className="text-[10px] uppercase tracking-widest text-zinc-400 hover:text-ihappy-pink transition-colors font-bold">Obchodní podmínky</button>
                <button onClick={() => setShowDisclaimerModal(true)} className="text-[10px] uppercase tracking-widest text-zinc-400 hover:text-ihappy-pink transition-colors font-bold">Lékařské vyloučení</button>
              </div>

              <button 
                onClick={handleAdminAccess}
                className="opacity-20 hover:opacity-100 transition-opacity p-2 text-zinc-500 hover:text-white cursor-pointer"
              >
                <Lock className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest pt-12">© 2026 IHAPPY.CZ | ALL RIGHTS RESERVED</p>
      </footer>

      {/* Marquee decoration */}
      <div className="fixed bottom-0 left-0 w-full overflow-hidden whitespace-nowrap py-4 border-t border-gray-900 bg-black z-50">
        <div className="flex animate-marquee">
          {[...Array(20)].map((_, i) => (
            <span key={i} className="mx-8 text-[10px] uppercase tracking-[0.5em] text-gray-800 shrink-0">
              Už se neschováte • Přestaňte platit cenu • Vaše tělo nelže • Vaše peníze jsou energie •
            </span>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showGDPR && (
          <LegalModals 
            isOpen={showGDPR} 
            onClose={() => setShowGDPR(false)} 
            title="Ochrana osobních údajů (GDPR)" 
            type="gdpr" 
          />
        )}
        {showTerms && (
          <LegalModals 
            isOpen={showTerms} 
            onClose={() => setShowTerms(false)} 
            title="Obchodní podmínky" 
            type="terms" 
          />
        )}
        {showDisclaimerModal && (
          <LegalModals 
            isOpen={showDisclaimerModal} 
            onClose={() => setShowDisclaimerModal(false)} 
            title="Lékařské vyloučení odpovědnosti" 
            type="disclaimer" 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {step === 'admin' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="fixed inset-0 z-[200] bg-white overflow-y-auto"
          >
            <div className="max-w-6xl mx-auto px-6 py-12">
              <div className="flex items-center justify-between mb-12">
                <button 
                  onClick={() => setStep('input')}
                  className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors uppercase tracking-widest text-[10px] font-bold"
                >
                  <ChevronLeft className="w-4 h-4" /> Zpět
                </button>
                <div className="text-2xl font-extrabold tracking-tighter flex items-center gap-1">
                  <span className="italic">i</span>Happy <span className="text-ihappy-pink ml-2">Admin</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-zinc-400">{user?.email}</span>
                  <BarChart3 className="w-5 h-5 text-ihappy-pink" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div className="bg-zinc-50 p-8 rounded-[30px] border border-zinc-100">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold block mb-2">Celkem analýz</span>
                  <p className="text-4xl font-display font-extrabold text-zinc-900">{adminStats.length}</p>
                </div>
                <div className="bg-zinc-50 p-8 rounded-[30px] border border-zinc-100">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold block mb-2">Analýzy s e-mailem</span>
                  <p className="text-4xl font-display font-extrabold text-ihappy-pink">{adminStats.filter(s => s.hasEmail).length}</p>
                </div>
                <div className="bg-zinc-50 p-8 rounded-[30px] border border-zinc-100">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold block mb-2">Konverzní poměr</span>
                  <p className="text-4xl font-display font-extrabold text-ihappy-orange">
                    {adminStats.length > 0 ? Math.round((adminStats.filter(s => s.hasEmail).length / adminStats.length) * 100) : 0}%
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-[40px] border border-zinc-100 shadow-xl shadow-zinc-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        <th className="px-8 py-6 text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Datum</th>
                        <th className="px-8 py-6 text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Původní symptom</th>
                        <th className="px-8 py-6 text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Zrcadlený vzorec</th>
                        <th className="px-8 py-6 text-[10px] uppercase tracking-widest text-zinc-400 font-bold">E-mail</th>
                        <th className="px-8 py-6 text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Telefon</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {isAdminLoading ? (
                        <tr>
                          <td colSpan={4} className="px-8 py-20 text-center text-zinc-400 italic">
                            Načítám data ze zrcadla...
                          </td>
                        </tr>
                      ) : adminStats.map((stat, i) => (
                        <tr key={stat.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-8 py-6 text-sm text-zinc-500">
                            {stat.createdAt?.toDate ? stat.createdAt.toDate().toLocaleString('cs-CZ') : 'Právě teď'}
                          </td>
                          <td className="px-8 py-6 text-sm font-medium text-zinc-900 max-w-xs truncate">{stat.symptom}</td>
                          <td className="px-8 py-6 text-sm text-zinc-600 max-w-xs truncate">{stat.mainPattern}</td>
                          <td className="px-8 py-6">
                            {stat.hasEmail ? (
                              <span className="px-3 py-1 bg-ihappy-pink/10 text-ihappy-pink text-[10px] font-bold rounded-full uppercase tracking-widest">
                                {stat.email}
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-300 uppercase tracking-widest">—</span>
                            )}
                          </td>
                          <td className="px-8 py-6">
                            {stat.phone ? (
                              <span className="text-sm text-zinc-600">
                                {stat.phone}
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-300 uppercase tracking-widest">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCritical && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-red-950/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[40px] max-w-2xl w-full p-10 md:p-16 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-3 bg-red-600" />
              
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center border-2 border-red-100">
                  <ShieldAlert className="w-10 h-10 text-red-600" />
                </div>
              </div>

              <h2 className="text-3xl font-display font-extrabold text-zinc-900 text-center mb-6">Důležité upozornění</h2>
              
              <div className="space-y-6 text-zinc-700 text-base md:text-lg leading-relaxed text-center">
                <p className="font-bold text-red-600 text-xl">
                  Vaše zadání obsahuje prvky, které vyžadují odbornou pomoc.
                </p>
                <p>
                  Aplikace iHappy je určena pro seberozvoj a koučink, nikoliv pro řešení akutních krizových stavů, sebepoškozování nebo sebevražedných myšlenek.
                </p>
                <div className="bg-zinc-50 p-8 rounded-3xl space-y-4 border border-zinc-100">
                  <p className="text-sm uppercase tracking-widest text-zinc-400 font-bold">Naléhavá pomoc:</p>
                  <p className="text-2xl font-display font-bold text-zinc-900">Linka bezpečí: 116 111</p>
                  <p className="text-2xl font-display font-bold text-zinc-900">Tísňové volání: 112 / 158</p>
                  <p className="text-sm text-zinc-500">K dispozici nonstop, zdarma a anonymně.</p>
                </div>
                <p className="text-sm italic">
                  V souladu se zákony ČR a předpisy EU vás musíme v této situaci odkázat na certifikované zdravotnické či záchranné služby.
                </p>
              </div>

              <div className="mt-12">
                <button 
                  onClick={handleReset}
                  className="w-full py-6 bg-zinc-900 text-white rounded-full text-xs uppercase tracking-[0.3em] font-extrabold hover:bg-black transition-all shadow-xl shadow-zinc-200 cursor-pointer"
                >
                  Rozumím, návrat na začátek
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDisclaimer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-950/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[40px] max-w-2xl w-full p-10 md:p-16 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-ihappy-pink" />
              
              <div className="flex justify-center mb-8">
                <div className="w-16 h-16 bg-ihappy-pink/10 rounded-2xl flex items-center justify-center">
                  <ShieldAlert className="w-8 h-8 text-ihappy-pink" />
                </div>
              </div>

              <h2 className="text-2xl font-display font-extrabold text-zinc-900 text-center mb-6">Právní prohlášení a informovaný souhlas</h2>
              
              <div className="space-y-6 text-zinc-600 text-sm md:text-base leading-relaxed overflow-y-auto max-h-[40vh] pr-2 custom-scrollbar">
                <p>
                  Vezměte prosím na vědomí, že tato aplikace <strong>iHappy</strong> slouží výhradně jako nástroj pro sebereflexi a poskytuje subjektivní zkušenostní vhledy na základě vámi vložených dat.
                </p>
                <p>
                  <strong>Důležitá upozornění:</strong>
                </p>
                <ul className="list-disc pl-5 space-y-3">
                  <li><strong>Nejedná se o psychologickou pomoc ani terapii:</strong> Poskytované informace nenahrazují odborné psychologické poradenství ani péči o duševní zdraví.</li>
                  <li><strong>Nejedná se o diagnózu:</strong> Výstupy aplikace nejsou lékařskou či psychologickou diagnózou v souladu se zákonem č. 372/2011 Sb., o zdravotních službách.</li>
                  <li><strong>Subjektivní vhled:</strong> Analýza představuje „zkušenostní vhled iHappy“. Výstupy jsou generovány algoritmem a mají informativní či inspirativní charakter.</li>
                  <li><strong>Vztah k realitě:</strong> Výstupy se nemusí shodovat s objektivní realitou a jsou závislé na přesnosti a upřímnosti vašich vstupů.</li>
                </ul>
                <p>
                  Provozovatel nenese odpovědnost za jakákoli rozhodnutí nebo činy učiněné na základě informací z této aplikace. V případě potíží vyhledejte certifikovaného odborníka.
                </p>
              </div>

              <div className="mt-12 flex flex-col items-center gap-4">
                <button 
                  onClick={() => setShowDisclaimer(false)}
                  className="w-full py-6 bg-ihappy-pink text-white rounded-full text-xs uppercase tracking-[0.3em] font-extrabold hover:bg-ihappy-pink/90 transition-all shadow-xl shadow-ihappy-pink/20 cursor-pointer"
                >
                  Souhlasím a rozumím
                </button>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest">Kliknutím potvrzujete svůj informovaný souhlas</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Onboarding forceOpen={forceOnboarding} onClose={() => setForceOnboarding(false)} />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          animation: marquee 60s linear infinite;
          width: fit-content;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f4f4f5;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #ec4899;
          border-radius: 10px;
        }
      `}} />
    </div>
  );
}
