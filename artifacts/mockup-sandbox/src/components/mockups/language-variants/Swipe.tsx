import React, { useState, useRef, useEffect } from "react";

export function Swipe() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollPosition = scrollRef.current.scrollLeft;
    const cardWidth = scrollRef.current.clientWidth;
    // Calculate nearest card index
    const newIndex = Math.round(scrollPosition / cardWidth);
    if (newIndex !== activeIndex) {
      setActiveIndex(newIndex);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll, { passive: true });
      return () => el.removeEventListener("scroll", handleScroll);
    }
  }, [activeIndex]);

  const scrollToCard = (index: number) => {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.clientWidth;
    scrollRef.current.scrollTo({
      left: cardWidth * index,
      behavior: "smooth"
    });
  };

  const handleChoose = (id: string) => {
    if (selectedLanguage) return;
    setSelectedLanguage(id);
    setTimeout(() => {
      setIsConfirmed(true);
    }, 1000);
  };

  const cards = [
    {
      id: "fr",
      name: "Français",
      subtitle: "Langue française",
      gradient: "from-[#1a1a6e] via-[#2C3E8C] to-[#00B4D8]",
      buttonText: "Choisir →",
      selectedText: "✓ Sélectionné",
      align: "left",
      buttonClass: "bg-white text-[#1a1a6e] hover:bg-white/90"
    },
    {
      id: "ar",
      name: "العربية",
      subtitle: "اللغة العربية",
      gradient: "from-[#0D3B2E] via-[#00614A] to-[#00C896]",
      buttonText: "اختر ←",
      selectedText: "✓ تم الاختيار",
      align: "right",
      buttonClass: "bg-[#F3E5AB] text-[#0D3B2E] hover:bg-[#D4AF37]"
    },
    {
      id: "en",
      name: "English",
      subtitle: "English language",
      gradient: "from-[#7B2020] via-[#C0392B] to-[#FF6B6B]",
      buttonText: "Choose →",
      selectedText: "✓ Selected",
      align: "left",
      buttonClass: "bg-white text-[#7B2020] hover:bg-white/90"
    }
  ];

  if (isConfirmed) {
    return (
      <div className="w-[390px] h-[844px] overflow-hidden relative bg-black flex flex-col items-center justify-center text-white">
        <h1 className="text-2xl font-bold mb-8 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]">
          Ready to Start
        </h1>
        <button 
          onClick={() => {
            setIsConfirmed(false);
            setSelectedLanguage(null);
          }}
          className="px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:scale-105 transition-transform opacity-0 animate-[fadeIn_0.5s_ease-out_0.2s_forwards]"
        >
          Start Fideliio
        </button>
      </div>
    );
  }

  return (
    <div className="w-[390px] h-[844px] overflow-hidden relative bg-black">
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
      <div 
        ref={scrollRef}
        className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth hide-scrollbar"
      >
        {cards.map((card) => {
          const isSelected = selectedLanguage === card.id;
          
          return (
            <div 
              key={card.id}
              className={`w-[390px] h-[844px] snap-center shrink-0 flex flex-col relative bg-gradient-to-b ${card.gradient}`}
            >
              <div className={`absolute top-12 ${card.align === 'right' ? 'right-8' : 'left-8'}`}>
                <span className="text-white text-xl font-bold tracking-widest">Fideliio</span>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center">
                <h1 className="text-white text-6xl font-black italic mb-4 text-center px-4 leading-tight">
                  {card.name}
                </h1>
                <p className={`text-sm ${card.align === 'right' ? 'text-[#F3E5AB]/80' : 'text-white/60'}`}>
                  {card.subtitle}
                </p>
              </div>

              <div className="pb-32 px-8 flex justify-center">
                <button
                  onClick={() => handleChoose(card.id)}
                  disabled={selectedLanguage !== null}
                  className={`
                    px-10 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-xl
                    ${isSelected 
                      ? 'bg-black/50 text-white scale-95 border border-white/20' 
                      : card.buttonClass}
                    ${selectedLanguage !== null && !isSelected ? 'opacity-0 scale-90' : 'opacity-100'}
                  `}
                >
                  <span className="flex items-center gap-2">
                    {isSelected ? card.selectedText : card.buttonText}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`absolute bottom-6 left-0 right-0 flex justify-center items-center gap-3 transition-opacity duration-300 ${selectedLanguage ? 'opacity-0' : 'opacity-100'}`}>
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToCard(i)}
            className={`h-2 rounded-full transition-all duration-300 ${i === activeIndex ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'}`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
