import React from 'react';
import { useApp } from '../../context/AppContext';

export const LandingPage: React.FC = () => {
  const { setActiveTab } = useApp();

  return (
    <div className="flex-1 flex flex-col justify-between bg-stone-50 text-stone-900 font-sans antialiased min-h-screen overflow-y-auto selection:bg-[#FDF0EA] selection:text-[#C85A32]">
      {/* BEGIN: Custom Styles (Serene Light Theme Effects) */}
      <style>{`
        .glass-panel {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(200, 90, 50, 0.12);
        }
        .hero-glow {
          background: radial-gradient(circle at 50% 30%, rgba(200, 90, 50, 0.08) 0%, rgba(245, 246, 248, 0) 75%);
        }
        .ambient-card-glow {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ambient-card-glow:hover {
          border-color: rgba(232, 122, 93, 0.4);
          box-shadow: 0 12px 35px -10px rgba(200, 90, 50, 0.15);
        }
      `}</style>

      {/* Atmospheric Horizon Sky Backdrop */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 select-none" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-[#EBF2F7] via-[#F6F5F2] to-[#F5ECE3]" />
        <div className="absolute -bottom-24 left-0 right-0 h-96 bg-gradient-to-t from-[#F8EDE1]/60 via-[#FDF9F4]/40 to-transparent" />
        <div className="absolute -top-32 right-[-10%] w-[560px] h-[560px] rounded-full bg-gradient-to-br from-[#FFF7EA]/30 via-[#FFF1D6]/15 to-transparent filter blur-3xl" />
      </div>

      {/* BEGIN: TopBar */}
      <header className="w-full border-b border-stone-200/60 bg-white/80 sticky top-0 z-50 backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex items-center gap-3 group">
              <img 
                alt="LocalMarket Interlocking LM Monogram" 
                className="h-10 w-10 rounded-xl object-cover shadow-xs group-hover:scale-105 transition-transform border border-stone-200 p-0.5 bg-white" 
                src="https://lh3.googleusercontent.com/aida/AEtjO1UfUiIqabsIZ56CPMQZDDINSLpdT6QSVf0B-x4HcMjJ7PbKy_i1yem7zMzcxE-B3NFGYhcHZZk80VwzUIdvChBRjEwHktu1TMTOe5OBWbir5UPYK4hYX8JdLpPVmSJk_ijs2Y64lfbrJhnJ7iubyPSX-zCr7eWK0ZpdTKUFjekNlHKaSjlNDN4T_dfkLorrnQuH7uvl4cC9w6XnNreypS5GNTEbnnCG481DTrFY5hD4EUs5E_rhWM71Ivk"
              />
              <div className="flex flex-col text-left">
                <span className="text-lg font-bold tracking-tight text-stone-900 flex items-center gap-1.5 leading-none font-headline">
                  LocalMarket
                  <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-[#C85A32]/10 text-[#C85A32] border border-[#C85A32]/20">OS</span>
                </span>
                <span className="text-xs text-[#C85A32]/90 font-medium tracking-wide flex items-center gap-1 mt-0.5 text-left">
                  Powered by LocalEats SA
                </span>
              </div>
            </div>
            <div className="hidden md:block h-6 w-px bg-stone-200 mx-1"></div>
            <a 
              className="hidden lg:inline-flex items-center gap-2 px-3 py-1 text-xs text-stone-500 hover:text-stone-800 bg-white/70 hover:bg-white rounded-full border border-stone-200 transition-colors" 
              href="https://www.localeatssa.co.za/" 
              rel="noopener noreferrer" 
              target="_blank"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Official LocalEats SA Ecosystem Branch • <span className="underline decoration-stone-300 underline-offset-2">www.localeatssa.co.za</span></span>
            </a>
          </div>
          <div className="flex items-center gap-3">
            <a 
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded border border-stone-200 hover:border-stone-300 bg-white/80 transition-all cursor-pointer" 
              href="https://www.localeatssa.co.za/" 
              rel="noopener noreferrer" 
              target="_blank"
            >
              <span>Ecosystem</span>
              <span className="text-[#C85A32]">↗</span>
            </a>
          </div>
        </div>
      </header>

      {/* BEGIN: MainContent */}
      <main className="flex-1 flex flex-col justify-center relative overflow-hidden py-8 lg:py-12" id="cover">
        <div aria-hidden="true" className="absolute inset-0 hero-glow pointer-events-none -z-10"></div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 w-full flex flex-col items-center text-center py-6 sm:py-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#C85A32]/10 border border-[#C85A32]/20 text-[#C85A32] text-xs font-semibold tracking-wide mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32] animate-pulse"></span>
            <span>Point-of-sale, second-hand goods and pawn workflow management</span>
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-stone-900 tracking-tight leading-[1.15] max-w-3xl mb-4 font-headline">
              Retail Counter &amp; <span className="text-[#C85A32] font-black">Pawn Management OS</span>
          </h1>
          <p className="text-base sm:text-lg text-stone-600 max-w-2xl mx-auto leading-relaxed mb-8 font-light">
              Streamlined counter sales, collateral appraisals, and second-hand goods inventory management software.
          </p>
          
          <div className="relative w-full rounded-2xl overflow-hidden border border-stone-200 bg-white p-2 shadow-xl mb-8 group">
            <div className="relative aspect-[16/9] md:aspect-[21/9] w-full overflow-hidden rounded-xl">
              <img 
                alt="LocalMarket retail store counter" 
                className="w-full h-full object-cover object-center filter brightness-95 contrast-105 group-hover:scale-105 transition-transform duration-700" 
                src="https://lh3.googleusercontent.com/aida/AEtjO1VP6YyvELeiPk-07rAo_VKLEXOni6S08hqZpbbjiMEUxHS-Z7QB9hQwp5i4xfEkQ7wKoHhR-nClr5iyxgHRLDk7FM4Dk1sjgxk8I-XSDCi3zr2AdZHQthIUc_yd8xR9NMDxMgFXT7vP_tWrMROTaKIVdyUSCLolmK-i4sRuNXplPM51pQMS9Lcy239avhHk4m1FXZjVUM4cF0cRry_jcrtk4kTncxnL2Y4vSnDZdY-Wk9AjC7HR4P3KSw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-stone-900/10 to-stone-900/20"></div>
              <div className="absolute bottom-3 left-4 sm:bottom-4 sm:left-6 flex items-center gap-2 text-xs text-white font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Counter Terminal &amp; Vault Management</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button 
              onClick={() => setActiveTab('auth')}
              className="inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-[#C85A32] hover:bg-[#B84E27] text-white font-bold text-base tracking-wide uppercase shadow-lg shadow-[#C85A32]/25 hover:shadow-[#C85A32]/40 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#C85A32] cursor-pointer"
            >
              <span>Launch Terminal → Sign In</span>
            </button>
            <span className="text-xs text-stone-500 font-mono tracking-wide">Secure operator access portal</span>
          </div>
        </div>
      </main>

      {/* BEGIN: ComplianceRibbon & Footer */}
      <footer className="w-full border-t border-stone-200/80 bg-white py-4 px-4 sm:px-8 mt-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-center sm:text-left text-[11px] text-stone-500">
          <div className="flex items-center gap-2 font-mono text-stone-600">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Point-of-sale, second-hand goods and pawn workflow management software</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium">
            <span>© {new Date().getFullYear()} LocalMarket OS</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
