import React, { useState, useEffect, useMemo } from 'react';
import { Product, Category, Ingredient, Supplement, ProductCustomizationConfig } from '../../types';
import { X, Check, Plus, Trash2, ChefHat, Sparkles, Flame, DollarSign, Image as ImageIcon } from 'lucide-react';

interface ProductModalAdminProps {
  product: Product | null;
  categories: Category[];
  ingredients: Ingredient[];
  supplements: Supplement[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => Promise<void>;
}

export const ProductModalAdmin: React.FC<ProductModalAdminProps> = ({
  product,
  categories,
  ingredients,
  supplements,
  isOpen,
  onClose,
  onSave
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'recipe' | 'customization' | 'nutrition'>('general');

  // Product state
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [basePrice, setBasePrice] = useState<number>(18.5);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isPopular, setIsPopular] = useState(false);
  const [active, setActive] = useState(true);
  const [available, setAvailable] = useState(true);

  // Nutrition
  const [calories, setCalories] = useState<number>(450);
  const [proteinGrams, setProteinGrams] = useState<number>(35);
  const [carbsGrams, setCarbsGrams] = useState<number>(40);
  const [fatGrams, setFatGrams] = useState<number>(12);

  // Base Ingredients Recipe
  const [baseIngredients, setBaseIngredients] = useState<
    Array<{ ingredientId: string; ingredientName: string; quantity: number; unit: string }>
  >([]);

  // Customization
  const [customization, setCustomization] = useState<ProductCustomizationConfig>({
    allowsProteinChoice: true,
    proteinOptions: [
      { label: 'Poulet Mariné 120g (Standard)', extraPrice: 0, extraGrams: 0 },
      { label: 'Double Poulet 180g (+60g)', extraPrice: 4.0, extraGrams: 60 }
    ],
    allowsVeggiesChoice: true,
    veggiesOptions: [
      { label: 'Légumes de Saison Rôtis', extraPrice: 0, extraGrams: 0 },
      { label: 'Extra Avocat & Brocoli (+80g)', extraPrice: 3.5, extraGrams: 80 }
    ],
    allowsBaseChoice: true,
    baseChoices: [
      { label: 'Riz Basmati Complet', extraPrice: 0, extraGrams: 0 },
      { label: 'Quinoa Bio Gourmand', extraPrice: 2.0, extraGrams: 0 }
    ],
    allowedSupplementIds: []
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setCategoryId(product.categoryId || categories[0]?.id || '');
      setBasePrice(product.basePrice ?? 18.5);
      setDescription(product.description || '');
      setImageUrl(product.imageUrl || '');
      setIsPopular(!!product.isPopular);
      setActive(product.active !== false);
      setAvailable(product.available !== false && product.isAvailable !== false);
      setCalories(product.calories || 450);
      setProteinGrams(product.proteinGrams || 35);
      setCarbsGrams(product.carbsGrams || 40);
      setFatGrams(product.fatGrams || 12);
      setBaseIngredients(product.baseIngredients || []);
      setCustomization(
        product.customization || {
          allowsProteinChoice: false,
          proteinOptions: [],
          allowsVeggiesChoice: false,
          veggiesOptions: [],
          allowsBaseChoice: false,
          baseChoices: [],
          allowedSupplementIds: []
        }
      );
    } else {
      setName('');
      setCategoryId(categories[0]?.id || '');
      setBasePrice(18.5);
      setDescription('');
      setImageUrl('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800');
      setIsPopular(false);
      setActive(true);
      setAvailable(true);
      setCalories(450);
      setProteinGrams(35);
      setCarbsGrams(40);
      setFatGrams(12);
      setBaseIngredients([]);
      setCustomization({
        allowsProteinChoice: true,
        proteinOptions: [
          { label: 'Poulet Mariné 120g (Standard)', extraPrice: 0, extraGrams: 0 },
          { label: 'Double Portion 180g (+60g)', extraPrice: 4.0, extraGrams: 60 }
        ],
        allowsVeggiesChoice: true,
        veggiesOptions: [
          { label: 'Portion Standard (100g)', extraPrice: 0, extraGrams: 0 },
          { label: 'Extra Légumes Croquants (+60g)', extraPrice: 2.5, extraGrams: 60 }
        ],
        allowsBaseChoice: true,
        baseChoices: [
          { label: 'Riz Basmati Complet', extraPrice: 0, extraGrams: 0 },
          { label: 'Quinoa aux fines herbes', extraPrice: 2.0, extraGrams: 0 }
        ],
        allowedSupplementIds: supplements.map(s => s.id)
      });
    }
    setActiveTab('general');
    setError(null);
  }, [product, isOpen, categories, supplements]);

  if (!isOpen) return null;

  // Recipe cost calculation
  const recipeTheoreticalCost = useMemo(() => {
    let cost = 0;
    baseIngredients.forEach(item => {
      const ing = ingredients.find(i => i.id === item.ingredientId);
      if (ing && ing.costPerUnit > 0) {
        cost += ing.costPerUnit * item.quantity;
      }
    });
    return Math.round(cost * 100) / 100;
  }, [baseIngredients, ingredients]);

  const handleAddBaseIngredient = () => {
    if (ingredients.length === 0) return;
    const defaultIng = ingredients[0];
    setBaseIngredients(prev => [
      ...prev,
      {
        ingredientId: defaultIng.id,
        ingredientName: defaultIng.name,
        quantity: 100,
        unit: defaultIng.unit
      }
    ]);
  };

  const handleUpdateBaseIngredient = (index: number, ingId: string, quantity: number) => {
    const ing = ingredients.find(i => i.id === ingId);
    if (!ing) return;
    setBaseIngredients(prev => {
      const copy = [...prev];
      copy[index] = {
        ingredientId: ing.id,
        ingredientName: ing.name,
        quantity: Math.max(0, quantity),
        unit: ing.unit
      };
      return copy;
    });
  };

  const handleRemoveBaseIngredient = (index: number) => {
    setBaseIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddProteinOption = () => {
    setCustomization(prev => ({
      ...prev,
      proteinOptions: [
        ...(prev.proteinOptions || []),
        { label: 'Nouvelle option protéine', extraPrice: 0, extraGrams: 0 }
      ]
    }));
  };

  const handleAddVeggiesOption = () => {
    setCustomization(prev => ({
      ...prev,
      veggiesOptions: [
        ...(prev.veggiesOptions || []),
        { label: 'Nouvelle option légumes', extraPrice: 0, extraGrams: 0 }
      ]
    }));
  };

  const handleAddBaseChoice = () => {
    setCustomization(prev => ({
      ...prev,
      baseChoices: [
        ...(prev.baseChoices || []),
        { label: 'Nouvelle base / féculent', extraPrice: 0, extraGrams: 0 }
      ]
    }));
  };

  const toggleSupplementAllowed = (supId: string) => {
    setCustomization(prev => {
      const current = prev.allowedSupplementIds || [];
      const next = current.includes(supId)
        ? current.filter(id => id !== supId)
        : [...current, supId];
      return { ...prev, allowedSupplementIds: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom du produit est obligatoire.');
      return;
    }
    if (!categoryId) {
      setError('Veuillez sélectionner une catégorie.');
      return;
    }
    if (basePrice < 0) {
      setError('Le prix de base ne peut pas être négatif.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const productPayload: Product = {
        id: product?.id || `prod-${Date.now()}`,
        name: name.trim(),
        categoryId,
        basePrice: Number(basePrice),
        description: description.trim(),
        imageUrl: imageUrl.trim() || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800',
        calories: Number(calories) || 0,
        proteinGrams: Number(proteinGrams) || 0,
        carbsGrams: Number(carbsGrams) || 0,
        fatGrams: Number(fatGrams) || 0,
        isPopular,
        active,
        available,
        isAvailable: available,
        baseIngredients,
        customization
      };

      await onSave(productPayload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’enregistrement du produit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-bold text-lg font-display">
              {product ? `Modifier « ${product.name} »` : 'Nouveau Produit / Plat'}
            </h3>
            <p className="text-xs text-stone-400">
              Paramètres commerciaux, recette de cuisine &amp; personnalisation
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-stone-800 text-stone-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 bg-stone-100 border-b border-stone-200 flex items-center gap-2 overflow-x-auto flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'general'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Informations &amp; Prix
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recipe')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'recipe'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <span>Recette Cuisine ({baseIngredients.length})</span>
            {recipeTheoreticalCost > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                {recipeTheoreticalCost} DT
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('customization')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'customization'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Personnalisation Client
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('nutrition')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'nutrition'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            Nutrition &amp; Macros
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-stone-900">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* 1. GENERAL TAB */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                    Nom du plat / produit *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="ex: Royal Protein Power Bowl"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                    Catégorie au menu *
                  </label>
                  <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                    Prix de base standard (DT) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      required
                      value={basePrice}
                      onChange={e => setBasePrice(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs font-bold text-stone-500">DT</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                    URL de l'image (HD)
                  </label>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                  Description alléchante &amp; Conseils diététiques
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Décrivez les saveurs, le mode de cuisson et les atouts santé du plat..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Status Toggles */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={e => setActive(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span>Afficher au menu (Actif)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={available}
                    onChange={e => setAvailable(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <span>Disponible à la vente (En stock)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPopular}
                    onChange={e => setIsPopular(e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400"
                  />
                  <span>Badge « Populaire »</span>
                </label>
              </div>
            </div>
          )}

          {/* 2. RECIPE & STOCK CONSUMPTION TAB */}
          {activeTab === 'recipe' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-emerald-700" />
                    <span>Fiche Technique &amp; Pesées Cuisine</span>
                  </h4>
                  <p className="text-xs text-stone-500">
                    Chaque ingrédient est déduit du stock cuisine lors de la validation de commande.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddBaseIngredient}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter ingrédient</span>
                </button>
              </div>

              {baseIngredients.length === 0 ? (
                <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-300 text-stone-500 text-xs">
                  Aucun ingrédient associé à cette recette pour le moment.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {baseIngredients.map((item, index) => {
                    const matched = ingredients.find(i => i.id === item.ingredientId);
                    return (
                      <div
                        key={index}
                        className="p-3 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                      >
                        <div className="flex-1">
                          <select
                            value={item.ingredientId}
                            onChange={e => handleUpdateBaseIngredient(index, e.target.value, item.quantity)}
                            className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold bg-white"
                          >
                            {ingredients.map(ing => (
                              <option key={ing.id} value={ing.id}>
                                {ing.name} ({ing.unit}) — Stock: {ing.currentStock} {ing.unit}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.quantity}
                            onChange={e => handleUpdateBaseIngredient(index, item.ingredientId, Number(e.target.value))}
                            className="w-24 px-3 py-2 rounded-xl border border-stone-300 text-xs font-mono font-bold bg-white"
                          />
                          <span className="w-10 text-xs font-bold text-stone-600">{item.unit}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveBaseIngredient(index)}
                            className="p-2 rounded-lg text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. CUSTOMIZATION TAB */}
          {activeTab === 'customization' && (
            <div className="space-y-6">
              
              {/* Protein options */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customization.allowsProteinChoice}
                      onChange={e => setCustomization({ ...customization, allowsProteinChoice: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span>Choix de la Protéine (ex: 120g / 180g)</span>
                  </label>
                  {customization.allowsProteinChoice && (
                    <button
                      type="button"
                      onClick={handleAddProteinOption}
                      className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Ajouter option</span>
                    </button>
                  )}
                </div>

                {customization.allowsProteinChoice && (
                  <div className="space-y-2 pt-2">
                    {(customization.proteinOptions || []).map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-stone-200">
                        <input
                          type="text"
                          value={opt.label}
                          onChange={e => {
                            const copy = [...(customization.proteinOptions || [])];
                            copy[idx] = { ...copy[idx], label: e.target.value };
                            setCustomization({ ...customization, proteinOptions: copy });
                          }}
                          placeholder="Intitulé option"
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-medium"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-stone-500">+DT:</span>
                          <input
                            type="number"
                            step="0.5"
                            value={opt.extraPrice}
                            onChange={e => {
                              const copy = [...(customization.proteinOptions || [])];
                              copy[idx] = { ...copy[idx], extraPrice: Number(e.target.value) };
                              setCustomization({ ...customization, proteinOptions: copy });
                            }}
                            className="w-16 px-2 py-1.5 rounded-lg border border-stone-300 text-xs font-bold font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-stone-500">+Grams:</span>
                          <input
                            type="number"
                            step="10"
                            value={opt.extraGrams}
                            onChange={e => {
                              const copy = [...(customization.proteinOptions || [])];
                              copy[idx] = { ...copy[idx], extraGrams: Number(e.target.value) };
                              setCustomization({ ...customization, proteinOptions: copy });
                            }}
                            className="w-16 px-2 py-1.5 rounded-lg border border-stone-300 text-xs font-bold font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const copy = (customization.proteinOptions || []).filter((_, i) => i !== idx);
                            setCustomization({ ...customization, proteinOptions: copy });
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Base choice */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customization.allowsBaseChoice}
                      onChange={e => setCustomization({ ...customization, allowsBaseChoice: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span>Choix Féculent / Base (ex: Riz Basmati, Quinoa)</span>
                  </label>
                  {customization.allowsBaseChoice && (
                    <button
                      type="button"
                      onClick={handleAddBaseChoice}
                      className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Ajouter base</span>
                    </button>
                  )}
                </div>

                {customization.allowsBaseChoice && (
                  <div className="space-y-2 pt-2">
                    {(customization.baseChoices || []).map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-stone-200">
                        <input
                          type="text"
                          value={opt.label}
                          onChange={e => {
                            const copy = [...(customization.baseChoices || [])];
                            copy[idx] = { ...copy[idx], label: e.target.value };
                            setCustomization({ ...customization, baseChoices: copy });
                          }}
                          placeholder="Intitulé base"
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-medium"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-stone-500">+DT:</span>
                          <input
                            type="number"
                            step="0.5"
                            value={opt.extraPrice}
                            onChange={e => {
                              const copy = [...(customization.baseChoices || [])];
                              copy[idx] = { ...copy[idx], extraPrice: Number(e.target.value) };
                              setCustomization({ ...customization, baseChoices: copy });
                            }}
                            className="w-16 px-2 py-1.5 rounded-lg border border-stone-300 text-xs font-bold font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const copy = (customization.baseChoices || []).filter((_, i) => i !== idx);
                            setCustomization({ ...customization, baseChoices: copy });
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Veggies choice */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customization.allowsVeggiesChoice}
                      onChange={e => setCustomization({ ...customization, allowsVeggiesChoice: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span>Choix Légumes &amp; Accompagnements</span>
                  </label>
                  {customization.allowsVeggiesChoice && (
                    <button
                      type="button"
                      onClick={handleAddVeggiesOption}
                      className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Ajouter option</span>
                    </button>
                  )}
                </div>

                {customization.allowsVeggiesChoice && (
                  <div className="space-y-2 pt-2">
                    {(customization.veggiesOptions || []).map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-stone-200">
                        <input
                          type="text"
                          value={opt.label}
                          onChange={e => {
                            const copy = [...(customization.veggiesOptions || [])];
                            copy[idx] = { ...copy[idx], label: e.target.value };
                            setCustomization({ ...customization, veggiesOptions: copy });
                          }}
                          placeholder="Intitulé légumes"
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-medium"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-stone-500">+DT:</span>
                          <input
                            type="number"
                            step="0.5"
                            value={opt.extraPrice}
                            onChange={e => {
                              const copy = [...(customization.veggiesOptions || [])];
                              copy[idx] = { ...copy[idx], extraPrice: Number(e.target.value) };
                              setCustomization({ ...customization, veggiesOptions: copy });
                            }}
                            className="w-16 px-2 py-1.5 rounded-lg border border-stone-300 text-xs font-bold font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const copy = (customization.veggiesOptions || []).filter((_, i) => i !== idx);
                            setCustomization({ ...customization, veggiesOptions: copy });
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Supplements Allowed Selector */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-800 block">
                  Suppléments autorisés pour ce plat
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {supplements.map(sup => {
                    const isChecked = (customization.allowedSupplementIds || []).includes(sup.id);
                    return (
                      <label
                        key={sup.id}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isChecked ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold' : 'border-stone-200 bg-white text-stone-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSupplementAllowed(sup.id)}
                            className="w-4 h-4 text-emerald-600 rounded"
                          />
                          <span>{sup.name}</span>
                        </div>
                        <span className="text-emerald-700 font-mono font-bold">+{sup.price.toFixed(1)} DT</span>
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* 4. NUTRITION TAB */}
          {activeTab === 'nutrition' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                    Calories (kcal)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={calories}
                    onChange={e => setCalories(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm font-bold font-mono bg-white"
                  />
                </div>

                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
                    Protéines (g)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={proteinGrams}
                    onChange={e => setProteinGrams(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm font-bold font-mono bg-white"
                  />
                </div>

                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                  <label className="block text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
                    Glucides (g)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={carbsGrams}
                    onChange={e => setCarbsGrams(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm font-bold font-mono bg-white"
                  />
                </div>

                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                  <label className="block text-xs font-bold uppercase tracking-wider text-blue-700 mb-1">
                    Lipides (g)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={fatGrams}
                    onChange={e => setFatGrams(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm font-bold font-mono bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-semibold"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer le Plat'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
