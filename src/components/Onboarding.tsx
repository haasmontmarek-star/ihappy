import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowRight, X, Heart, ShieldCheck, Zap } from 'lucide-react';

interface OnboardingProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export const Onboarding = ({ forceOpen, onClose }: OnboardingProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      setCurrentStep(0);
    } else {
      const hasSeenOnboarding = localStorage.getItem('onboarding_seen');
      if (!hasSeenOnboarding) {
        setIsOpen(true);
      }
    }
  }, [forceOpen]);

  const steps = [
    {
      title: "Vítejte v iHappy",
      description: "Mentorské zrcadlo je nástroj, který vám pomůže odhalit hluboké limity ve vašem životě.",
      icon: <Sparkles className="w-8 h-8 text-ihappy-pink" />,
    },
    {
      title: "Jak to funguje?",
      description: "Zadáte symptom, který vás trápí. Zrcadlo vám položí 3 otázky a poté vygeneruje hloubkovou analýzu.",
      icon: <Zap className="w-8 h-8 text-ihappy-orange" />,
    },
    {
      title: "Vaše soukromí",
      description: "Všechny analýzy jsou soukromé. Analýza identifikuje dopady na vaše zdraví, finance i vztahy.",
      icon: <ShieldCheck className="w-8 h-8 text-ihappy-pink" />,
    },
    {
      title: "Jste připraveni?",
      description: "Pojďme se podívat, co vás skutečně brzdí a nastavit cestu k transformaci.",
      icon: <Heart className="w-8 h-8 text-ihappy-orange" />,
    }
  ];

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('onboarding_seen', 'true');
    if (onClose) onClose();
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[30px] md:rounded-[40px] max-w-lg w-full p-6 sm:p-8 md:p-12 shadow-2xl relative overflow-hidden"
      >
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 md:top-6 md:right-6 p-2 hover:bg-zinc-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-zinc-400" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4 md:space-y-6">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-zinc-50 rounded-xl md:rounded-2xl flex items-center justify-center mb-2 md:mb-4">
            {steps[currentStep].icon}
          </div>
          
          <h2 className="text-2xl md:text-3xl font-display font-extrabold text-zinc-900 leading-tight">
            {steps[currentStep].title}
          </h2>
          
          <p className="text-zinc-500 text-base md:text-lg font-light leading-relaxed">
            {steps[currentStep].description}
          </p>

          <div className="flex gap-2 py-2 md:py-4">
            {steps.map((_, i) => (
              <div 
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 md:w-8 bg-ihappy-pink' : 'w-1.5 md:w-2 bg-zinc-100'}`}
              />
            ))}
          </div>

          <button
            onClick={nextStep}
            className="w-full py-4 md:py-5 bg-ihappy-pink text-white rounded-2xl text-[10px] md:text-xs uppercase tracking-[0.2em] md:tracking-[0.3em] font-extrabold hover:bg-ihappy-pink/90 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 shadow-xl shadow-ihappy-pink/20"
          >
            {currentStep === steps.length - 1 ? 'Začít' : 'Pokračovat'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
