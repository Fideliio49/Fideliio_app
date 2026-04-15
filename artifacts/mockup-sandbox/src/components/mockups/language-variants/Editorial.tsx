import React, { useState } from 'react';

const languages = [
  { id: 'fr', name: 'Français', isArabic: false },
  { id: 'ar', name: 'العربية', isArabic: true },
  { id: 'en', name: 'English', isArabic: false },
];

export function Editorial() {
  const [selectedLang, setSelectedLang] = useState('fr');

  return (
    <div className="w-[390px] h-[844px] overflow-hidden relative flex flex-col bg-white font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap');
      `}</style>
      
      {/* TOP HALF */}
      <div className="flex-1 flex flex-col pt-8">
        {/* Tiny coral square logo mark */}
        <div className="px-8 mb-auto">
          <div className="w-3 h-3 rounded-sm bg-[#FF6B6B]" />
        </div>
        
        {/* Center-aligned Title */}
        <div className="mb-auto text-center mt-20">
          <h1 
            className="font-black text-[52px] tracking-[0.12em] text-black uppercase"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Fideliio
          </h1>
          <div className="h-[3px] w-16 bg-[#FF6B6B] mx-auto mt-3" />
        </div>
      </div>

      {/* BOTTOM HALF */}
      <div className="flex-1 flex flex-col justify-end pb-[120px]">
        <div className="text-[11px] tracking-[0.2em] uppercase text-gray-400 font-medium text-center mb-8">
          Choose your language
        </div>
        
        <div className="flex flex-col">
          {languages.map((lang) => {
            const isSelected = selectedLang === lang.id;
            return (
              <div
                key={lang.id}
                onClick={() => setSelectedLang(lang.id)}
                className={`py-5 border-b border-gray-100 px-8 flex justify-between items-center cursor-pointer transition-colors ${
                  isSelected ? 'border-l-2 border-l-[#FF6B6B] -ml-[2px] pl-[30px]' : ''
                }`}
              >
                <span 
                  className={`text-xl font-semibold ${
                    isSelected ? 'text-[#FF6B6B]' : 'text-black'
                  } ${lang.isArabic ? 'text-[22px]' : ''}`}
                >
                  {lang.name}
                </span>
                {isSelected && (
                  <div className="rounded-full bg-[#FF6B6B] w-6 h-6 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* BOTTOM FIXED */}
      <div className="absolute bottom-0 left-0 right-0 px-8 pb-10 pt-4 bg-white">
        <button className="w-full bg-black text-white text-sm tracking-widest uppercase font-bold py-5 rounded-lg hover:bg-[#FF6B6B] transition-colors">
          Continue
        </button>
      </div>
    </div>
  );
}
