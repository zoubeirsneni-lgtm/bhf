import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, Supplement } from '../../types';
import { cleanClientText, cleanClientDescription } from '../../utils/clientFormatters';
import {
  X,
  Plus,
  Minus,
  Check,
  Flame,
  ChefHat,
  ShoppingBag,
  Sparkles,
  Info
} from 'lucide-react';

export const ProductModal: React.FC = () => {
  const {
    selectedProductForCustomization: product,
    setSelectedProductForCustomization,
    supplements: allSupplements,
    addToCart
  } = useApp();

  const [quantity, setQuantity] = useState<number>(1);
  const [selectedProteinOption, setSelectedProteinOption] = useState<{ label: string; extraPrice: number; extraGrams: number } | undefined>(undefined);
  const [selectedVeggiesOption, setSelectedVeggiesOption] = useState<{ label: string; extraPrice: number; extraGrams: number } | undefined>(undefined);
  const [selectedBaseChoice, setSelectedBaseChoice] = useState<{ label: string; extraPrice: number } | undefined>(undefined);
  const [selectedSupplements, setSelectedSupplements] = useState<Record<string, number>>({});
  const [specialInstructions, setSpecialInstructions] = useState<string>('');

  // Initialize options when product opens
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
  }, [product]);

  // Allowed supplements for this product
  const availableSupplements = useMemo(() => {
    if (!product) return [];
    const allowedIds = product.customization?.allowedSupplementIds || [];
    if (allowedIds.length === 0) {
      return allSupplements.filter(s => s.active && s.available);
    }
    return allSupplements.filter(s => s.active && s.available && allowedIds.includes(s.id));
  }, [product, allSupplements]);

  // Calculate unit price and breakdown
  const priceBreakdown = useMemo(() => {
    if (!product) return { base: 0, protein: 0, veggies: 0, baseChoice: 0, supplements: 0, unitTotal: 0, grandTotal: 0 };

    const base = product.basePrice;
    const protein = selectedProteinOption?.extraPrice || 0;
    const veggies = selectedVeggiesOption?.extraPrice || 0;
    const baseChoice = selectedBaseChoice?.extraPrice || 0;

    let supplements = 0;
    Object.entries(selectedSupplements).forEach(([supId, qty]) => {
      const sup = allSupplements.find(s => s.id === supId);
      const numQty = Number(qty) || 0;
      if (sup && numQty > 0) {
        supplements += sup.price * numQty;
      }
    });

    const unitTotal = Math.round((base + protein + veggies + baseChoice + supplements) * 10) / 10;
    const grandTotal = Math.round(unitTotal * quantity * 10) / 10;

    return {
      base,
      protein,
      veggies,
      baseChoice,
      supplements,
      unitTotal,
      grandTotal
    };
  }, [product, selectedProteinOption, selectedVeggiesOption, selectedBaseChoice, selectedSupplements, quantity, allSupplements]);

  if (!product) return null;

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

  const handleAddToCart = () => {
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

    setSelectedProductForCustomization(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        id="product-customization-modal"
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden"
      >
        {/* Header with image */}
        <div className="relative h-48 sm:h-56 bg-stone-900 flex-shrink-0">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover opacity-90"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />
          
          <button
            id="close-customization-modal-btn"
            onClick={() => setSelectedProductForCustomization(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-stone-900/80 text-white hover:bg-stone-900 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-5 right-5 text-white">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Préparation minute à la commande
            </span>
            <h2 className="text-xl sm:text-2xl font-bold font-display leading-snug">
              {product.name}
            </h2>
            <p className="text-xs sm:text-sm text-stone-300 line-clamp-1 mt-0.5">
              {product.description}
            </p>
          </div>
        </div>

        {/* Scrollable Customizer Form */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-stone-900">
          
          {/* Base composition info */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 text-xs text-emerald-900 flex items-start gap-2.5">
            <ChefHat className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Composition de base :</strong>
              <p className="mt-0.5 text-stone-700">
                {product.baseIngredients.map(i => cleanClientText(i.ingredientName)).join(' • ')}
              </p>
            </div>
          </div>

          {/* 1. Protein Customization */}
          {product.customization?.allowsProteinChoice && product.customization.proteinOptions && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-emerald-600" />
                  <span>Portion de Protéine</span>
                </label>
                <span className="text-xs text-stone-500">Obligatoire</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {product.customization.proteinOptions.map((opt, idx) => {
                  const isSelected = selectedProteinOption?.label === opt.label;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedProteinOption(opt)}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-semibold ring-2 ring-emerald-600/20'
                          : 'border-stone-200 hover:border-stone-300 bg-stone-50/50 text-stone-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{cleanClientText(opt.label)}</span>
                        {isSelected && <Check className="w-4 h-4 text-emerald-700" />}
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

          {/* 2. Base / Féculents Choice */}
          {product.customization?.allowsBaseChoice && product.customization.baseChoices && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Choix de l'Accompagnement / Base</span>
                </label>
                <span className="text-xs text-stone-500">1 au choix</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {product.customization.baseChoices.map((bChoice, idx) => {
                  const isSelected = selectedBaseChoice?.label === bChoice.label;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedBaseChoice(bChoice)}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-semibold ring-2 ring-emerald-600/20'
                          : 'border-stone-200 hover:border-stone-300 bg-stone-50/50 text-stone-700'
                      }`}
                    >
                      <span className="text-xs font-medium">{cleanClientText(bChoice.label)}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-emerald-700 font-bold">
                          {bChoice.extraPrice > 0 ? `+${bChoice.extraPrice.toFixed(1)} DT` : 'Inclus'}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-emerald-700" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Veggies Customization */}
          {product.customization?.allowsVeggiesChoice && product.customization.veggiesOptions && (
            <div className="space-y-2.5">
              <label className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <span>Portion de Légumes de saison</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {product.customization.veggiesOptions.map((opt, idx) => {
                  const isSelected = selectedVeggiesOption?.label === opt.label;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedVeggiesOption(opt)}
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 font-semibold ring-2 ring-emerald-600/20'
                          : 'border-stone-200 hover:border-stone-300 bg-stone-50/50 text-stone-700'
                      }`}
                    >
                      <span className="text-xs font-medium">{cleanClientText(opt.label)}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-emerald-700 font-bold">
                          {opt.extraPrice > 0 ? `+${opt.extraPrice.toFixed(1)} DT` : 'Inclus'}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-emerald-700" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Supplements list */}
          {availableSupplements.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-stone-900">
                  Suppléments Gourmands &amp; Santé
                </label>
                <span className="text-xs text-stone-500">Optionnel</span>
              </div>
              <div className="space-y-2">
                {availableSupplements.map(sup => {
                  const qty = selectedSupplements[sup.id] || 0;
                  return (
                    <div
                      key={sup.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        qty > 0
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                          : 'border-stone-200 bg-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <h4 className="text-xs font-bold text-stone-900">{cleanClientText(sup.name)}</h4>
                          <span className="text-xs font-extrabold text-emerald-700">
                            +{sup.price.toFixed(1)} DT
                          </span>
                        </div>
                        {sup.description && (
                          <p className="text-[11px] text-stone-500">
                            {cleanClientDescription(sup.description)}
                          </p>
                        )}
                      </div>

                      {/* Quantity buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {qty > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSupplementChange(sup.id, -1)}
                              className="w-7 h-7 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 flex items-center justify-center font-bold text-xs"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-5 text-center text-xs font-bold text-stone-900">
                              {qty}
                            </span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSupplementChange(sup.id, 1)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition-colors ${
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
            </div>
          )}

          {/* 5. Special Kitchen Instructions */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
              <span>Instructions pour la cuisine</span>
              <span className="text-xs text-stone-400 font-normal">(Optionnel)</span>
            </label>
            <input
              type="text"
              id="special-instructions-input"
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
              placeholder="Ex: Sauce à part svp, pas d'oignon, bien grillé..."
              className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-stone-50"
            />
          </div>

          {/* Price decomposition breakdown */}
          <div className="p-3.5 rounded-2xl bg-stone-100 text-xs space-y-1.5 text-stone-600">
            <div className="font-bold text-stone-800 mb-1 flex items-center justify-between">
              <span>Décomposition du prix :</span>
              <span className="text-emerald-800">{priceBreakdown.unitTotal.toFixed(1)} DT / unité</span>
            </div>
            <div className="flex justify-between">
              <span>Plat de référence ({product.name}) :</span>
              <span>{priceBreakdown.base.toFixed(1)} DT</span>
            </div>
            {priceBreakdown.protein > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Option protéine ({cleanClientText(selectedProteinOption?.label)}) :</span>
                <span>+{priceBreakdown.protein.toFixed(1)} DT</span>
              </div>
            )}
            {priceBreakdown.baseChoice > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Accompagnement ({cleanClientText(selectedBaseChoice?.label)}) :</span>
                <span>+{priceBreakdown.baseChoice.toFixed(1)} DT</span>
              </div>
            )}
            {priceBreakdown.veggies > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Option légumes ({cleanClientText(selectedVeggiesOption?.label)}) :</span>
                <span>+{priceBreakdown.veggies.toFixed(1)} DT</span>
              </div>
            )}
            {priceBreakdown.supplements > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Suppléments ajoutés :</span>
                <span>+{priceBreakdown.supplements.toFixed(1)} DT</span>
              </div>
            )}
          </div>

        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 bg-white border-t border-stone-200 flex items-center justify-between gap-4 flex-shrink-0">
          {/* Quantity selector */}
          <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-2xl border border-stone-200">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-9 h-9 rounded-xl bg-white text-stone-800 flex items-center justify-center font-bold text-sm shadow-sm hover:bg-stone-50 disabled:opacity-50"
              disabled={quantity <= 1}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-extrabold text-sm text-stone-900">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="w-9 h-9 rounded-xl bg-white text-stone-800 flex items-center justify-center font-bold text-sm shadow-sm hover:bg-stone-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add to Cart CTA */}
          <button
            id="add-customized-to-cart-btn"
            type="button"
            onClick={handleAddToCart}
            className="flex-1 py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm sm:text-base shadow-md shadow-emerald-700/20 flex items-center justify-between transition-all active:scale-[0.98]"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              <span>Ajouter au Panier</span>
            </span>
            <span>{priceBreakdown.grandTotal.toFixed(1)} DT</span>
          </button>
        </div>
      </div>
    </div>
  );
};
