import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Scale, Stethoscope } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'gdpr' | 'terms' | 'disclaimer';
}

export const LegalModals: React.FC<LegalModalProps> = ({ isOpen, onClose, title, type }) => {
  if (!isOpen) return null;

  const content = {
    gdpr: (
      <div className="space-y-6 text-zinc-700 leading-relaxed">
        <section>
          <h4 className="font-bold text-zinc-900 mb-2">1. Správce údajů</h4>
          <p>Správcem vašich osobních údajů je společnost PrincepsMentor s.r.o., IČO: 08892911, se sídlem Dětmarovice 789, 735 71 Dětmarovice.</p>
        </section>
        <section>
          <h4 className="font-bold text-zinc-900 mb-2">2. Rozsah zpracování</h4>
          <p>Zpracováváme textové vstupy, které dobrovolně vložíte do Mentorského zrcadla iHappy, a vaše kontaktní údaje (e-mail, telefon), pokud se rozhodnete objednat konzultaci.</p>
        </section>
        <section>
          <h4 className="font-bold text-zinc-900 mb-2">3. Účel zpracování a AI</h4>
          <p>Účelem zpracování je poskytnutí vhledu metodou koučovací analýzy. Data jsou zpracovávána algoritmy umělé inteligence (model Google Gemini). Prosíme, nevkládejte do pole pro analýzu citlivé údaje jako jsou rodná čísla nebo přesné adresy.</p>
        </section>
        <section>
          <h4 className="font-bold text-zinc-900 mb-2">4. Předávání dat</h4>
          <p>Data vložená do analýzy jsou v anonymizované podobě odesílána poskytovateli AI infrastruktury (Google Cloud) za účelem generování odpovědi. Data nejsou využívána k trénování modelů pro jiné účely.</p>
        </section>
        <section>
          <h4 className="font-bold text-zinc-900 mb-2">5. Vaše práva</h4>
          <p>Máte právo na přístup k údajům, jejich opravu, výmaz nebo vznesení námitky proti zpracování na adrese ahoj@ihappy.cz.</p>
        </section>
      </div>
    ),
    terms: (
      <div className="space-y-6 text-zinc-700 leading-relaxed">
        <section>
          <h4 className="font-bold text-zinc-900 mb-2">1. Definice služby</h4>
          <p>iHappy je interaktivní nástroj pro seberozvoj využívající technologii umělé inteligence k zrcadlení vnitřních vzorců uživatele.</p>
        </section>
        <section>
          <h4 className="font-bold text-zinc-900 mb-2">2. Odpovědnost a AI</h4>
          <p>Výstupy generované aplikací jsou výsledkem matematických modelů a pravděpodobností. Provozovatel neručí za absolutní přesnost nebo pravdivost generovaného textu. Uživatel nese plnou odpovědnost za interpretaci a využití těchto informací ve svém životě.</p>
        </section>
        <section>
          <h4 className="font-bold text-zinc-900 mb-2">3. Užívání služby</h4>
          <p>Základní analýza v Mentorském zrcadle je poskytována bezúplatně. Provozovatel si vyhrazuje právo službu kdykoliv omezit nebo ukončit bez předchozího upozornění.</p>
        </section>
        <section>
          <h4 className="font-bold text-zinc-900 mb-2">4. Duševní vlastnictví</h4>
          <p>Obsah aplikace, logo iHappy a mentorské metodiky jsou duševním vlastnictvím společnosti PrincepsMentor s.r.o.</p>
        </section>
      </div>
    ),
    disclaimer: (
      <div className="space-y-6 text-zinc-700 leading-relaxed">
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6">
          <p className="text-orange-900 font-bold">DŮLEŽITÉ UPOZORNĚNÍ:</p>
          <p className="text-orange-800 text-sm">Mentorské zrcadlo iHappy není zdravotnický prostředek ani psychoterapeutická služba.</p>
        </div>
        <p>Analýza generovaná touto aplikací má výhradně informativní, vzdělávací a seberozvojový charakter. V žádném případě nenahrazuje:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>odbornou lékařskou diagnostiku nebo léčbu</li>
          <li>psychiatrické vyšetření</li>
          <li>odbornou psychoterapii</li>
          <li>klinické psychologické poradenství</li>
        </ul>
        <p>Pokud se nacházíte v akutní krizi, trpíte hlubokými depresemi nebo máte myšlenky na sebepoškozování, vyhledejte prosím okamžitě odbornou pomoc (např. Linka bezpečí, Linka první psychické pomoci nebo nejbližší krizové centrum).</p>
        <p>Provozovatel aplikace PrincepsMentor s.r.o. nenese žádnou odpovědnost za případné přímé či nepřímé škody vzniklé na základě interpretace výsledků této aplikace.</p>
      </div>
    )
  };

  const icons = {
    gdpr: <Shield className="w-8 h-8 text-ihappy-pink" />,
    terms: <Scale className="w-8 h-8 text-ihappy-orange" />,
    disclaimer: <Stethoscope className="w-8 h-8 text-red-500" />
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[500] flex items-center justify-center px-4 overflow-y-auto py-10 bg-zinc-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white w-full max-w-2xl rounded-[30px] md:rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col max-h-full"
        >
          {/* Header */}
          <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-zinc-100">
                {icons[type]}
              </div>
              <h2 className="text-xl md:text-2xl font-display font-extrabold text-zinc-900 tracking-tight">{title}</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-400 hover:text-zinc-900"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="p-8 md:p-12 overflow-y-auto">
            {content[type]}
          </div>

          {/* Footer */}
          <div className="p-8 border-t border-zinc-100 bg-zinc-50/50 flex justify-end">
            <button 
              onClick={onClose}
              className="px-8 py-3 bg-zinc-900 text-white rounded-full text-xs uppercase tracking-widest font-bold hover:bg-black transition-colors"
            >
              Rozumím a zavřít
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
