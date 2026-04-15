import React, { useState } from 'react';

const LANGUAGES = [
  {
    id: 'fr',
    name: 'Français',
    native: 'French',
    color: '#FF6B6B',
    initial: 'F',
    buttonText: 'Commencer →',
  },
  {
    id: 'ar',
    name: 'العربية',
    native: 'Arabic',
    color: '#20B2AA', // Teal
    initial: 'ع',
    buttonText: 'ابدأ تجربتي ←',
  },
  {
    id: 'en',
    name: 'English',
    native: 'English',
    color: '#4169E1', // Deep Blue
    initial: 'E',
    buttonText: 'Start my experience →',
  },
];

export function Conversation() {
  const [selectedLang, setSelectedLang] = useState('fr');

  const currentLangData = LANGUAGES.find((l) => l.id === selectedLang) || LANGUAGES[0];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');
        
        @keyframes fadeWord {
          0%, 20% { opacity: 1; }
          28%, 100% { opacity: 0; }
        }
        
        .animate-greeting {
          opacity: 0;
          animation: fadeWord 6s infinite;
        }
        
        .delay-0 { animation-delay: 0s; }
        .delay-2 { animation-delay: 2s; }
        .delay-4 { animation-delay: 4s; }
      `}</style>

      <div className="w-[390px] h-[844px] overflow-hidden relative flex flex-col bg-[#FAF9F7]">
        {/* TOP SECTION */}
        <div className="flex-1 flex flex-col items-center justify-center pt-10">
          <div className="text-xs font-medium bg-[#FF6B6B]/10 text-[#FF6B6B] px-3 py-1 rounded-full mb-8">
            👋 Welcome
          </div>
          
          <div className="relative h-[100px] w-full flex justify-center items-center mb-2">
            <span className="absolute font-['Playfair_Display'] text-[56px] font-bold text-[#1a1a2e] leading-tight animate-greeting delay-0">
              Bonjour !
            </span>
            <span className="absolute font-['Playfair_Display'] text-[56px] font-bold text-[#1a1a2e] leading-tight animate-greeting delay-2">
              Hello !
            </span>
            <span className="absolute font-['Playfair_Display'] text-[56px] font-bold text-[#1a1a2e] leading-tight animate-greeting delay-4" dir="rtl">
              مرحباً!
            </span>
          </div>

          <div className="text-sm font-semibold tracking-widest uppercase text-gray-400 mt-4">
            Fideliio
          </div>
          
          <div className="w-12 h-px bg-gray-200 mx-auto mt-6"></div>
        </div>

        {/* MIDDLE SECTION */}
        <div className="px-8 mt-10">
          <div className="text-xs uppercase tracking-widest text-gray-400 font-medium mb-5 text-center">
            In which language?
          </div>
          
          <div className="flex flex-col gap-3">
            {LANGUAGES.map((lang) => {
              const isSelected = selectedLang === lang.id;
              
              return (
                <div
                  key={lang.id}
                  onClick={() => setSelectedLang(lang.id)}
                  className={`rounded-2xl border-2 px-6 py-5 cursor-pointer flex items-center gap-4 transition-all ${
                    isSelected
                      ? 'border-[#FF6B6B] bg-[#FF6B6B]/5 shadow-md shadow-[#FF6B6B]/10'
                      : 'bg-white border-gray-100 shadow-sm'
                  }`}
                >
                  <div 
                    className="w-[40px] h-[40px] rounded-full flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: lang.color }}
                  >
                    {lang.initial}
                  </div>
                  
                  <div className="flex-1 flex flex-col">
                    <span className="text-lg font-semibold text-gray-800 leading-tight">
                      {lang.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {lang.native}
                    </span>
                  </div>
                  
                  <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                    {isSelected && (
                      <div className="w-6 h-6 bg-[#FF6B6B] rounded-full flex items-center justify-center">
                        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4.00001 7.8L1.20001 5L0.266678 5.93333L4.00001 9.66667L12 1.66667L11.0667 0.733337L4.00001 7.8Z" fill="white"/>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM SECTION */}
        <div className="px-8 pb-10 mt-auto pt-6 bg-gradient-to-t from-[#FAF9F7] via-[#FAF9F7] to-transparent">
          <button className="w-full bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white font-semibold rounded-full py-5 text-center shadow-lg shadow-[#FF6B6B]/30 hover:opacity-90 transition-opacity text-[15px]">
            {currentLangData.buttonText}
          </button>
        </div>
      </div>
    </>
  );
}
