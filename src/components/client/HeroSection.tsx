import React from 'react';
import { Flame, Sparkles, ChefHat, Clock, Banknote, ShieldCheck } from 'lucide-react';

interface HeroSectionProps {
  onOrderNowClick: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOrderNowClick }) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950 text-white pt-10 pb-16 sm:pt-16 sm:pb-24">
      {/* Subtle organic background accents */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-emerald-600/15 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          
          {/* Text Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-semibold">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>100% Frais &amp; Fait Maison</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight font-display">
              BEBBA Healthy Food
              <span className="block text-emerald-400 mt-2 font-normal italic text-2xl sm:text-3xl lg:text-4xl">
                « Vos Plats santé en un clic »
              </span>
            </h1>

            <p className="text-stone-300 text-base sm:text-lg max-w-2xl leading-relaxed">
              Repas équilibrés, bowls gourmands et grillades tendres saisis à la flamme. 
              <strong className="text-white font-semibold"> Aucun plat n'est préparé à l'avance</strong> : 
              chaque commande est cuisinée individuellement selon vos choix précis.
            </p>

            {/* Core commitments badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-800/80 border border-stone-700/60 text-left">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 flex-shrink-0">
                  <ChefHat className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">À la Commande</h4>
                  <p className="text-[11px] text-stone-400">Préparation minute</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-800/80 border border-stone-700/60 text-left">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 flex-shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Grillades Flamme</h4>
                  <p className="text-[11px] text-stone-400">Viandes sélectionnées</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-800/80 border border-stone-700/60 text-left col-span-2 sm:col-span-1">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 flex-shrink-0">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Paiement Livraison</h4>
                  <p className="text-[11px] text-stone-400">En espèces sécurisé</p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-4">
              <button
                id="hero-order-now-btn"
                onClick={onOrderNowClick}
                className="px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base sm:text-lg shadow-lg shadow-emerald-900/40 hover:shadow-emerald-700/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Commander maintenant
              </button>

              <div className="text-xs text-stone-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Sans compte obligatoire</span>
              </div>
            </div>
          </div>

          {/* Visual Showcase Card */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-md rounded-3xl overflow-hidden shadow-2xl border border-stone-700/80 bg-stone-800/50 group">
              <img
                src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1000&q=80"
                alt="BEBBA Healthy Power Bowl"
                className="w-full h-80 sm:h-96 object-cover group-hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-transparent" />
              
              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-2xl bg-stone-900/90 backdrop-blur-md border border-stone-700/60 text-left">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Bowl Signature
                  </span>
                  <span className="text-sm font-extrabold text-white">
                    Dès 14.5 DT
                  </span>
                </div>
                <h3 className="text-base font-bold text-white">BEBBA Chicken Power Bowl</h3>
                <p className="text-xs text-stone-300 line-clamp-1 mt-0.5">
                  Poulet mariné grillé minute, riz complet, légumes croquants &amp; avocat frais.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
