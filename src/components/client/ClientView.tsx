import React, { useState, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ClientHeader } from './ClientHeader';
import { HeroSection } from './HeroSection';
import { ProductCard } from './ProductCard';
import { ProductModal } from './ProductModal';
import { CartDrawer } from './CartDrawer';
import { OrderTrackingView } from './OrderTrackingView';
import {
  Salad,
  Flame,
  Sparkles,
  GlassWater,
  Utensils,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Heart
} from 'lucide-react';

export const ClientView: React.FC = () => {
  const { categories, products, activeClientTab } = useApp();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const menuSectionRef = useRef<HTMLDivElement>(null);

  const scrollToMenu = () => {
    menuSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Salad':
        return <Salad className="w-4 h-4" />;
      case 'Flame':
        return <Flame className="w-4 h-4" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4" />;
      case 'GlassWater':
        return <GlassWater className="w-4 h-4" />;
      default:
        return <Utensils className="w-4 h-4" />;
    }
  };

  // Filter active products
  const filteredProducts = useMemo(() => {
    return products.filter(prod => {
      if (!prod.active) return false;
      const matchesCategory = selectedCategoryId === 'all' || prod.categoryId === selectedCategoryId;
      const matchesSearch =
        searchQuery.trim() === '' ||
        prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryId, searchQuery]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col justify-between">
      <div>
        <ClientHeader />

        {activeClientTab === 'tracking' ? (
          <OrderTrackingView />
        ) : (
          <main>
            {/* Hero Section */}
            <HeroSection onOrderNowClick={scrollToMenu} />

            {/* Menu Section */}
            <div ref={menuSectionRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
              
              {/* Menu Title & Search */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200/80 pb-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Cuisine saine &amp; Préparée minute
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 font-display">
                    Nos Plats &amp; Formules
                  </h2>
                  <p className="text-sm text-stone-500 max-w-xl mt-1">
                    Choisissez votre plat de base et personnalisez vos portions de protéines, féculents et suppléments à la demande.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-72">
                  <input
                    type="text"
                    id="search-menu-input"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un plat, ingrédient..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-stone-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* Dynamic Categories Selector */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                  id="category-pill-all"
                  onClick={() => setSelectedCategoryId('all')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all shadow-2xs ${
                    selectedCategoryId === 'all'
                      ? 'bg-emerald-700 text-white shadow-md shadow-emerald-800/20'
                      : 'bg-white text-stone-700 border border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <Utensils className="w-4 h-4" />
                  <span>Tous les Plats ({products.filter(p => p.active).length})</span>
                </button>

                {categories
                  .filter(c => c.active)
                  .map(category => {
                    const count = products.filter(p => p.active && p.categoryId === category.id).length;
                    const isSelected = selectedCategoryId === category.id;
                    return (
                      <button
                        key={category.id}
                        id={`category-pill-${category.id}`}
                        onClick={() => setSelectedCategoryId(category.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all shadow-2xs ${
                          isSelected
                            ? 'bg-emerald-700 text-white shadow-md shadow-emerald-800/20'
                            : 'bg-white text-stone-700 border border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {getCategoryIcon(category.icon)}
                        <span>{category.name} ({count})</span>
                      </button>
                    );
                  })}
              </div>

              {/* Product Grid */}
              {filteredProducts.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-8 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mx-auto">
                    <Search className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-stone-800">Aucun plat trouvé</h3>
                  <p className="text-xs text-stone-500 max-w-sm mx-auto">
                    Aucun produit ne correspond à votre recherche ou catégorie sélectionnée.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedCategoryId('all');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  {filteredProducts.map(product => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}

              {/* Why BEBBA Banner */}
              <div className="mt-16 p-8 rounded-3xl bg-stone-900 text-white relative overflow-hidden">
                <div className="relative z-10 max-w-3xl space-y-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Notre Engagement Qualité
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-extrabold font-display">
                    Pourquoi choisir BEBBA Healthy Food ?
                  </h3>
                  <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
                    Nous refusons les préparations industrielles pré-emballées. En cuisine, chaque filet de poulet, bœuf ou légume est pesé et saisi à la commande. Vous obtenez un plat chaud, ultra frais et calibré pour vos objectifs nutritionnels.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Ingrédients pesés au gramme</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Viandes marinées &amp; grillées minute</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>Paiement en espèces à la livraison</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </main>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-stone-950 text-stone-400 py-10 border-t border-stone-800 text-xs mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-stone-800/80 pb-6 text-center sm:text-left">
            <div>
              <span className="text-white font-extrabold text-lg font-display tracking-tight">
                BEBBA Healthy Food
              </span>
              <p className="text-emerald-400 font-medium text-xs">
                « Vos Plats santé en un clic »
              </p>
            </div>
            <p className="text-stone-500 text-[11px] max-w-md">
              Cuisine saine, grillades et bowls gourmands préparés individuellement à la commande.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-stone-500 text-center sm:text-left">
            <span>© {new Date().getFullYear()} BEBBA Healthy Food. Tous droits réservés.</span>
            <span>Paiement à la livraison • Livraison express Grand Tunis</span>
          </div>
        </div>
      </footer>

      {/* Product Customizer Modal */}
      <ProductModal />

      {/* Cart Drawer */}
      <CartDrawer />
    </div>
  );
};
