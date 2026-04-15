import React, { useState } from 'react';

const languages = [
  { id: 'fr', label: 'Français' },
  { id: 'ar', label: 'العربية' },
  { id: 'en', label: 'English' },
];

export function Immersive() {
  const [selectedLang, setSelectedLang] = useState('fr');

  return (
    <div className="w-[390px] h-[844px] overflow-hidden relative flex flex-col bg-gradient-to-b from-[#0D0D2B] via-[#1a1a6e] to-[#2C3E8C]">
      <style>
        {`
          @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes spin-reverse-slow {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
          }
          @keyframes slide-up {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .orbit-1 { animation: spin-slow 8s linear infinite; }
          .orbit-2 { animation: spin-reverse-slow 12s linear infinite; }
          .orbit-3 { animation: spin-slow 15s linear infinite; }
          
          .animate-slide-up {
            animation: slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            animation-delay: 0.5s;
            opacity: 0;
            transform: translateY(100%);
          }
          
          .animate-fade-in {
            animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}
      </style>

      {/* Main Brand Environment */}
      <div className="flex-1 flex flex-col items-center justify-center relative -mt-20 animate-fade-in">
        
        {/* Orbiting Elements */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Orbit 1 */}
          <div className="absolute w-[160px] h-[160px] orbit-1">
            <div className="absolute top-0 left-1/2 w-2 h-2 bg-white/40 rounded-full -ml-1"></div>
            <div className="absolute bottom-0 left-1/3 w-1.5 h-1.5 bg-white/20 rounded-full"></div>
          </div>
          
          {/* Orbit 2 */}
          <div className="absolute w-[220px] h-[220px] orbit-2">
            <div className="absolute top-1/4 right-0 w-2.5 h-2.5 bg-white/50 rounded-full"></div>
            <div className="absolute bottom-1/4 left-0 w-1 h-1 bg-white/30 rounded-full"></div>
          </div>
          
          {/* Orbit 3 */}
          <div className="absolute w-[280px] h-[280px] orbit-3">
            <div className="absolute top-1/2 left-0 w-1.5 h-1.5 bg-white/40 rounded-full -mt-1"></div>
            <div className="absolute bottom-1/4 right-1/4 w-2 h-2 bg-white/20 rounded-full"></div>
          </div>
        </div>

        {/* Logo Card */}
        <div className="relative z-10 w-[90px] h-[90px] rounded-2xl bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] flex items-center justify-center shadow-2xl shadow-[#FF6B6B]/20 mb-6">
          <span className="text-white text-4xl font-black">F</span>
        </div>
        
        {/* Brand Name */}
        <h1 className="text-white font-bold text-3xl tracking-wide relative z-10">Fideliio</h1>
      </div>

      {/* Bottom Sheet */}
      <div className="backdrop-blur-xl bg-white/10 border-t border-white/20 rounded-t-3xl p-6 pb-10 animate-slide-up relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
        <h2 className="text-white/70 text-sm mb-4 uppercase tracking-wider font-medium">Choose your language</h2>
        
        <div className="space-y-2 mb-6">
          {languages.map((lang) => {
            const isSelected = selectedLang === lang.id;
            return (
              <button
                key={lang.id}
                onClick={() => setSelectedLang(lang.id)}
                className={`w-full rounded-2xl px-5 py-4 flex justify-between items-center transition-all duration-300 ${
                  isSelected 
                    ? 'bg-white/20 border border-white/10' 
                    : 'bg-white/5 hover:bg-white/15 border border-transparent'
                }`}
              >
                <span className={`text-lg ${isSelected ? 'text-white font-semibold' : 'text-white/80 font-medium'}`}>
                  {lang.label}
                </span>
                
                {/* Custom Radio Dot */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isSelected ? 'border-[#FF6B6B]' : 'border-white/30'
                }`}>
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B6B]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
        
        <button className="w-full bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white font-semibold text-lg rounded-full py-4 shadow-lg shadow-[#FF6B6B]/20 transform transition-transform active:scale-[0.98]">
          Continuer →
        </button>
      </div>
    </div>
  );
}
