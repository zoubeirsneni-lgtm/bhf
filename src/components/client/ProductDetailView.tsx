import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, Supplement } from '../../types';
import { cleanClientText, cleanClientDescription } from '../../utils/clientFormatters';
import {
  ArrowLeft,
  ShoppingBag,
  Plus,
  Minus,
  Check,
  Flame,
  ChefHat,
  Sparkles,
  Salad,
  GlassWater,
  Utensils,
  AlertCircle,
  CheckCircle2,
  Activity,
  Heart,
  Sliders
} from 'lucide-react';

interface ProductDetailViewProps {
  productId: string;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({ productId }) => {
  const {
    products,
    categories,
    supplements: allSupplements,
    addToCart,
    setSelectedProductForCustomization,
    backToMenu
  } = useApp();

  const [loading, setLoading] = useState<boolean>(false);
  const [fetchedProduct, setFetchedProduct] = useState<Product | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form states for in-page customization
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedProteinOption, setSelectedProteinOption] = useState<{ label: string; extraPrice: number; extraGrams: number } | undefined>(undefined);
  const [selectedVeggiesOption, setSelectedVeggiesOption] = useState<{ label: string; extraPrice: number; extraGrams: number } | undefined>(undefined);
  const [selectedBaseChoice, setSelectedBaseChoice] = useState<{ label: string; extraPrice: number } | undefined>(undefined);
  const [selectedSupplements, setSelectedSupplements] = useState<Record<string, number>>({});
  const [specialInstructions, setSpecialInstructions] = useState<string>('');

  // Find product in context first
  const existingProduct = products.find(p => p.id === productId);

  // If not in context or directly loaded from URL, fetch from API /api/products/:id
  useEffect(() => {
    if (existingProduct) {
      setFetchedProduct(existingProduct);
      setFetchError(null);
    } else {
      let isMounted = true;
      setLoading(true);
      fetch(`/api/products/${productId}`)
        .then(res => {
          if (!res.ok) {
            throw new Error('Menu introuvable');
          }
          return res.json();
        })
        .then(data => {
          if (isMounted) {
            setFetchedProduct(data);
            setFetchError(null);
            setLoading(false);
          }
        })
        .catch(err => {
          if (isMounted) {
            setFetchedProduct(null);
            setFetchError(err.message || 'Menu introuvable');
            setLoading(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [productId, existingProduct]);

  const product = fetchedProduct || existingProduct;

  // Initialize options once product is loaded
  useEffect(() => {
    if (product) {
      setQuantity(1);
      setSpecialInstructions('');
      setSelectedSupplements({});

      if (product.customization?.proteinOptions?.length) {
        setSelectedProteinOption(product.customization.proteinOptions[0]);
      } else {
        setSelectedProteinOption(undefined);
      }

      if (product.customization?.veggiesOptions?.length) {
        setSelectedVeggiesOption(product.customization.veggiesOptions[0]);
      } else {
        setSelectedVeggiesOption(undefined);
      }

      if (product.customization?.baseChoices?.length) {
        setSelectedBaseChoice(product.customization.baseChoices[0]);
      } else {
        setSelectedBaseChoice(undefined);
      }
    }
  }, [product?.id]);

  // Category info
  const category = categories.find(c => c.id === product?.categoryId);

  const getCategoryIcon = (iconName?: string) => {
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

  // Allowed supplements for this product
  const availableSupplements = useMemo(() => {
    if (!product) return [];
    const allowedIds = product.customization?.allowedSupplementIds || [];
    if (allowedIds.length === 0) {
      return allSupplements.filter(s => s.active && (s.available !== false && s.isAvailable !== false));
    }
    return allSupplements.filter(s => s.active && (s.available !== false && s.isAvailable !== false) && allowedIds.includes(s.id));
  }, [product, allSupplements]);

  // Dynamic Price Breakdown
  const priceBreakdown = useMemo(() => {
    if (!product) {
      return {
        basePrice: 0,
        optionsPrice: 0,
        supplementsPrice: 0,
        unitTotal: 0,
        grandTotal: 0,
        proteinPrice: 0,
        veggiesPrice: 0,
        basePriceOption: 0
      };
    }

    const basePrice = product.basePrice;
    const proteinPrice = selectedProteinOption?.extraPrice || 0;
    const veggiesPrice = selectedVeggiesOption?.extraPrice || 0;
    const basePriceOption = selectedBaseChoice?.extraPrice || 0;
    const optionsPrice = proteinPrice + veggiesPrice + basePriceOption;

    let supplementsPrice = 0;
    Object.entries(selectedSupplements).forEach(([supId, qty]) => {
      const sup = allSupplements.find(s => s.id === supId);
      const numQty = Number(qty) || 0;
      if (sup && numQty > 0) {
        supplementsPrice += sup.price * numQty;
      }
    });

    const unitTotal = Math.round((basePrice + optionsPrice + supplementsPrice) * 10) / 10;
    const grandTotal = Math.round(unitTotal * quantity * 10) / 10;

    return {
      basePrice,
      optionsPrice,
      supplementsPrice,
      unitTotal,
      grandTotal,
      proteinPrice,
      veggiesPrice,
      basePriceOption
    };
  }, [product, selectedProteinOption, selectedVeggiesOption, selectedBaseChoice, selectedSupplements, quantity, allSupplements]);

  const handleSupplementChange = (supId: string, delta: number) => {
    setSelectedSupplements(prev => {
      const current = prev[supId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [supId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [supId]: next };
    });
  };

  // Add to cart with current customized config
  const handleAddToCart = () => {
    if (!product) return;
    const isOutOfStock = product.available === false || product.isAvailable === false;
    if (isOutOfStock) return;

    const chosenSupplements = Object.entries(selectedSupplements)
      .map(([supId, qty]) => {
        const sup = allSupplements.find(s => s.id === supId);
        const numQty = Number(qty) || 0;
        return (sup && numQty > 0) ? { id: sup.id, quantity: numQty, supplement: sup } : null;
      })
      .filter((s): s is { id: string; quantity: number; supplement: Supplement } => s !== null);

    addToCart({
      product,
      quantity,
      proteinOption: selectedProteinOption,
      veggiesOption: selectedVeggiesOption,
      baseChoice: selectedBaseChoice,
      supplements: chosenSupplements,
      specialInstructions: specialInstructions.trim() || undefined,
      itemTotalPrice: priceBreakdown.grandTotal
    });
  };

  // Quick Order with Default Config
  const handleDirectDefaultOrder = () => {
    if (!product) return;
    const isOutOfStock = product.available === false || product.isAvailable === false;
    if (isOutOfStock) return;

    const defaultProtein = product.customization?.proteinOptions?.[0];
    const defaultVeggies = product.customization?.veggiesOptions?.[0];
    const defaultBase = product.customization?.baseChoices?.[0];
    const extraCost = (defaultProtein?.extraPrice || 0) + (defaultVeggies?.extraPrice || 0) + (defaultBase?.extraPrice || 0);
    const unitPrice = product.basePrice + extraCost;

    addToCart({
      product,
      quantity: 1,
      proteinOption: defaultProtein,
      veggiesOption: defaultVeggies,
      baseChoice: defaultBase,
      supplements: [],
      specialInstructions: '',
      itemTotalPrice: unitPrice
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-stone-600 text-sm font-medium">Chargement de la fiche menu...</p>
      </div>
    );
  }

  // 404 - Produit introuvable / inexistant
  if (!product || fetchError) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-stone-900 font-display">
            Menu introuvable
          </h1>
          <p className="text-stone-600 text-sm max-w-md mx-auto">
            Le plat que vous recherchez n'existe pas, est actuellement désactivé ou a été retiré du catalogue.
          </p>
        </div>
        <div>
          <button
            id="btn-back-from-not-found"
            onClick={backToMenu}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-stone-900 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>← Retour au menu</span>
          </button>
        </div>
      </div>
    );
  }

  const isOutOfStock = product.available === false || product.isAvailable === false;

  return (
    <div id="product-detail-view" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          id="btn-back-to-menu"
          onClick={backToMenu}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-stone-700 hover:text-emerald-800 hover:border-emerald-300 hover:bg-emerald-50/50 font-bold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-700" />
          <span>← Retour au menu</span>
        </button>

        {category && (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold border border-stone-200/80">
            {getCategoryIcon(category.icon)}
            <span>{category.name}</span>
          </div>
        )}
      </div>

      {/* Main Container Card */}
      <article className="bg-white rounded-3xl border border-stone-200/90 shadow-xl overflow-hidden">
        {/* 1. GRANDE IMAGE DU PLAT */}
        <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full bg-stone-900 overflow-hidden">
          <img
            id="product-detail-hero-image"
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover opacity-95 hover:scale-105 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-transparent" />

          {/* Badges Over Image */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-10">
            {product.isPopular && (
              <span className="px-3 py-1 rounded-full bg-amber-500 text-stone-950 text-xs font-extrabold flex items-center gap-1.5 shadow-md">
                <Sparkles className="w-3.5 h-3.5" />
                Populaire BEBBA
              </span>
            )}
            {category && (
              <span className="px-3 py-1 rounded-full bg-stone-900/80 backdrop-blur-md text-white text-xs font-bold flex items-center gap-1.5 border border-white/10">
                {getCategoryIcon(category.icon)}
                {category.name}
              </span>
            )}
          </div>

          {/* Availability Status Badge */}
          <div className="absolute top-4 right-4 z-10">
            {isOutOfStock ? (
              <span
                id="product-status-badge-out-of-stock"
                className="px-4 py-1.5 rounded-full bg-rose-600 text-white text-xs font-extrabold tracking-wide uppercase shadow-lg flex items-center gap-1.5"
              >
                <AlertCircle className="w-4 h-4" />
                Épuisé / Indisponible
              </span>
            ) : (
              <span
                id="product-status-badge-available"
                className="px-4 py-1.5 rounded-full bg-emerald-600/90 backdrop-blur-md text-white text-xs font-bold tracking-wide uppercase shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Disponible en cuisine
              </span>
            )}
          </div>

          {/* Overlay Title at bottom of Hero */}
          <div className="absolute bottom-4 left-5 right-5 sm:bottom-6 sm:left-8 sm:right-8 text-white">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Cuisine saine &amp; Préparée minute
            </span>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mt-1">
              <h1
                id="product-detail-name"
                className="text-2xl sm:text-4xl font-extrabold font-display leading-tight"
              >
                {product.name}
              </h1>
              <div className="flex items-baseline gap-2 flex-shrink-0">
                <span className="text-xs text-stone-300">Prix de base :</span>
                <span id="product-detail-base-price" className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                  {product.basePrice.toFixed(1)} DT
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 lg:p-10 space-y-8 text-stone-900">
          
          {/* 2. DESCRIPTION COMPLÈTE */}
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Description du Plat
            </h2>
            <p
              id="product-detail-description"
              className="text-stone-700 text-sm sm:text-base leading-relaxed"
            >
              {product.description}
            </p>
          </section>

          {/* 3. INGRÉDIENTS */}
          <section className="space-y-3 pt-4 border-t border-stone-200/80">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-emerald-600" />
                <span>Composition &amp; Ingrédients</span>
              </h2>
            </div>

            {product.baseIngredients && product.baseIngredients.length > 0 ? (
              <div
                id="product-detail-ingredients-list"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                {product.baseIngredients.map(ing => (
                  <div
                    key={ing.ingredientId}
                    className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/90 flex items-center gap-3 shadow-2xs"
                  >
                    <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      ✓
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-stone-800 truncate">
                      {cleanClientText(ing.ingredientName)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500 italic">Recette standard selon arrivage frais du jour.</p>
            )}
          </section>

          {/* 4. INFORMATIONS NUTRITIONNELLES */}
          <section className="space-y-3 pt-4 border-t border-stone-200/80">
            <h2 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              <span>Valeurs Nutritionnelles Moyennes</span>
            </h2>

            <div
              id="product-detail-nutrition-grid"
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"
            >
              <div className="p-4 rounded-2xl bg-stone-900 text-white flex flex-col justify-between shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  Énergie
                </span>
                <div className="mt-2">
                  <span className="text-xl sm:text-2xl font-extrabold">
                    {product.calories || 450}
                  </span>
                  <span className="text-xs text-stone-300 ml-1">kcal</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col justify-between shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  Protéines
                </span>
                <div className="mt-2">
                  <span className="text-xl sm:text-2xl font-extrabold text-emerald-800">
                    {product.proteinGrams || 38}
                  </span>
                  <span className="text-xs text-emerald-700 ml-1">g</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col justify-between shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Glucides
                </span>
                <div className="mt-2">
                  <span className="text-xl sm:text-2xl font-extrabold text-amber-800">
                    {product.carbsGrams || 42}
                  </span>
                  <span className="text-xs text-amber-700 ml-1">g</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-stone-100 border border-stone-200 text-stone-900 flex flex-col justify-between shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  Lipides
                </span>
                <div className="mt-2">
                  <span className="text-xl sm:text-2xl font-extrabold text-stone-800">
                    {product.fatGrams || 12}
                  </span>
                  <span className="text-xs text-stone-500 ml-1">g</span>
                </div>
              </div>
            </div>
          </section>

          {/* 5. OPTIONS DE PERSONNALISATION */}
          <section id="customization-section" className="space-y-6 pt-4 border-t border-stone-200/80">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-stone-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-600" />
                <span>Personnalisation du Plat</span>
              </h2>
              <span className="text-xs text-stone-500 font-medium">
                Ajustez vos options
              </span>
            </div>

            {/* Protein Option */}
            {product.customization?.allowsProteinChoice && product.customization.proteinOptions && (
              <div className="space-y-2.5">
                <label className="text-xs sm:text-sm font-bold text-stone-800 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-emerald-600" />
                  <span>Portion de Protéine</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {product.customization.proteinOptions.map((opt, idx) => {
                    const isSelected = selectedProteinOption?.label === opt.label;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedProteinOption(opt)}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-semibold ring-2 ring-emerald-600/20 shadow-xs'
                            : 'border-stone-200 hover:border-stone-300 bg-stone-50/50 text-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-bold">{cleanClientText(opt.label)}</span>
                          {isSelected && <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />}
                        </div>
                        <span className="text-xs text-emerald-700 font-bold mt-1">
                          {opt.extraPrice > 0 ? `+${opt.extraPrice.toFixed(1)} DT` : 'Inclus'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Base Choice */}
            {product.customization?.allowsBaseChoice && product.customization.baseChoices && (
              <div className="space-y-2.5">
                <label className="text-xs sm:text-sm font-bold text-stone-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Accompagnement / Base</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {product.customization.baseChoices.map((bChoice, idx) => {
                    const isSelected = selectedBaseChoice?.label === bChoice.label;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedBaseChoice(bChoice)}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-semibold ring-2 ring-emerald-600/20 shadow-xs'
                            : 'border-stone-200 hover:border-stone-300 bg-stone-50/50 text-stone-700'
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-medium">{cleanClientText(bChoice.label)}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-emerald-700 font-bold">
                            {bChoice.extraPrice > 0 ? `+${bChoice.extraPrice.toFixed(1)} DT` : 'Inclus'}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Veggies Choice */}
            {product.customization?.allowsVeggiesChoice && product.customization.veggiesOptions && (
              <div className="space-y-2.5">
                <label className="text-xs sm:text-sm font-bold text-stone-800 flex items-center gap-1.5">
                  <Salad className="w-4 h-4 text-emerald-600" />
                  <span>Légumes de Saison</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {product.customization.veggiesOptions.map((opt, idx) => {
                    const isSelected = selectedVeggiesOption?.label === opt.label;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedVeggiesOption(opt)}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-semibold ring-2 ring-emerald-600/20 shadow-xs'
                            : 'border-stone-200 hover:border-stone-300 bg-stone-50/50 text-stone-700'
                        }`}
                      >
                        <span className="text-xs sm:text-sm font-medium">{cleanClientText(opt.label)}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-emerald-700 font-bold">
                            {opt.extraPrice > 0 ? `+${opt.extraPrice.toFixed(1)} DT` : 'Inclus'}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* 6. SUPPLÉMENTS */}
          {availableSupplements.length > 0 && (
            <section className="space-y-3 pt-4 border-t border-stone-200/80">
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-bold text-stone-900">
                  Suppléments disponibles
                </h2>
                <span className="text-xs text-stone-500 font-medium">
                  Optionnel
                </span>
              </div>

              <div className="space-y-2.5">
                {availableSupplements.map(sup => {
                  const qty = selectedSupplements[sup.id] || 0;
                  return (
                    <div
                      key={sup.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        qty > 0
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-2xs'
                          : 'border-stone-200 bg-white hover:border-stone-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-xs sm:text-sm font-bold text-stone-900">{cleanClientText(sup.name)}</h3>
                          <span className="text-xs font-extrabold text-emerald-700">
                            +{sup.price.toFixed(1)} DT
                          </span>
                        </div>
                        {sup.description && (
                          <p className="text-[11px] sm:text-xs text-stone-500 mt-0.5">
                            {cleanClientDescription(sup.description)}
                          </p>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {qty > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSupplementChange(sup.id, -1)}
                              className="w-8 h-8 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 flex items-center justify-center font-bold text-xs cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center text-xs font-extrabold text-stone-900">
                              {qty}
                            </span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSupplementChange(sup.id, 1)}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition-colors cursor-pointer ${
                            qty > 0
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-stone-100 text-stone-800 hover:bg-emerald-600 hover:text-white border border-stone-200'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 7. INSTRUCTIONS SPÉCIALES */}
          <section className="space-y-2 pt-4 border-t border-stone-200/80">
            <label className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-1.5">
              <span>Remarques ou instructions particulières pour la cuisine</span>
              <span className="text-xs text-stone-400 font-normal">(Optionnel)</span>
            </label>
            <input
              type="text"
              id="detail-special-instructions-input"
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
              placeholder="Ex: Sauce à part, sans oignon, bien cuit..."
              className="w-full px-4 py-3 rounded-2xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-stone-50"
            />
          </section>

          {/* 8. DÉCOMPOSITION DU PRIX */}
          <section
            id="price-breakdown-card"
            className="p-5 rounded-3xl bg-stone-50 border border-stone-200 space-y-2 text-xs sm:text-sm text-stone-700"
          >
            <h3 className="font-extrabold text-stone-900 text-sm sm:text-base border-b border-stone-200 pb-2 flex items-center justify-between">
              <span>Récapitulatif &amp; Calcul du Prix</span>
              <span className="text-emerald-800 font-bold">{priceBreakdown.unitTotal.toFixed(1)} DT / unité</span>
            </h3>

            <div className="flex justify-between pt-1">
              <span>Prix de base :</span>
              <span id="summary-base-price" className="font-semibold text-stone-900">{priceBreakdown.basePrice.toFixed(1)} DT</span>
            </div>

            <div className="flex justify-between">
              <span>Options :</span>
              <span id="summary-options-price" className="font-semibold text-stone-900">{priceBreakdown.optionsPrice.toFixed(1)} DT</span>
            </div>

            <div className="flex justify-between">
              <span>Suppléments :</span>
              <span id="summary-supplements-price" className="font-semibold text-stone-900">{priceBreakdown.supplementsPrice.toFixed(1)} DT</span>
            </div>

            <div className="border-t border-stone-300 pt-2 flex justify-between items-baseline font-extrabold text-base sm:text-lg text-stone-950">
              <span>TOTAL {quantity > 1 ? `(x${quantity})` : ''} :</span>
              <span id="summary-total-price" className="text-emerald-700 text-xl sm:text-2xl">
                {priceBreakdown.grandTotal.toFixed(1)} DT
              </span>
            </div>
          </section>

          {/* 9. ACTIONS : PERSONNALISER & COMMANDER */}
          <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            {isOutOfStock ? (
              <button
                id="btn-detail-out-of-stock"
                disabled
                className="w-full py-4 rounded-2xl bg-stone-200 text-stone-500 font-bold text-sm cursor-not-allowed text-center"
              >
                Victime de son succès — Produit temporairement indisponible
              </button>
            ) : (
              <>
                {/* Quantity selector */}
                <div className="flex items-center justify-between sm:justify-start gap-2 bg-stone-100 p-1.5 rounded-2xl border border-stone-200 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-10 h-10 rounded-xl bg-white text-stone-800 flex items-center justify-center font-bold text-sm shadow-xs hover:bg-stone-50 disabled:opacity-40 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-extrabold text-sm sm:text-base text-stone-900">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 rounded-xl bg-white text-stone-800 flex items-center justify-center font-bold text-sm shadow-xs hover:bg-stone-50 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* PERSONNALISER Button */}
                <button
                  id="btn-detail-customize"
                  type="button"
                  onClick={() => setSelectedProductForCustomization(product)}
                  className="flex-1 py-4 px-5 rounded-2xl bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 border border-stone-200 hover:border-emerald-300 text-stone-900 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-xs"
                >
                  <Sliders className="w-5 h-5 text-emerald-600" />
                  <span>PERSONNALISER</span>
                </button>

                {/* COMMANDER Button */}
                <button
                  id="btn-detail-order"
                  type="button"
                  onClick={handleAddToCart}
                  className="flex-1 py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-700/25 flex items-center justify-between gap-3 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    <span>COMMANDER</span>
                  </span>
                  <span className="text-emerald-100 text-sm sm:text-base font-bold">
                    {priceBreakdown.grandTotal.toFixed(1)} DT
                  </span>
                </button>
              </>
            )}
          </div>

        </div>
      </article>
    </div>
  );
};
