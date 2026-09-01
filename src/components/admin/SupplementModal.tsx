import React, { useState, useEffect } from 'react';
import { Supplement, Ingredient } from '../../types';
import { X, Check, Plus, DollarSign } from 'lucide-react';

interface SupplementModalProps {
  supplement: Supplement | null;
  ingredients: Ingredient[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplement: Supplement) => Promise<void>;
}

export const SupplementModal: React.FC<SupplementModalProps> = ({
  supplement,
  ingredients,
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<Partial<Supplement>>({
    name: '',
    description: '',
    price: 4.0,
    ingredientId: '',
    quantityConsumed: 50,
    unit: 'g',
    active: true,
    available: true,
    sortOrder: 1
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supplement) {
      setFormData(supplement);
    } else {
      setFormData({
        name: '',
        description: '',
        price: 4.0,
        ingredientId: ingredients[0]?.id || '',
        quantityConsumed: 50,
        unit: 'g',
        active: true,
        available: true,
        sortOrder: 1
      });
    }
    setError(null);
  }, [supplement, isOpen, ingredients]);

  if (!isOpen) return null;

  const handleIngredientChange = (ingId: string) => {
    const ing = ingredients.find(i => i.id === ingId);
    setFormData(prev => ({
      ...prev,
      ingredientId: ingId,
      unit: ing ? ing.unit : prev.unit || 'g'
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setError('Le nom du supplément est obligatoire.');
      return;
    }
    if (formData.price === undefined || formData.price < 0) {
      setError('Le prix de vente doit être supérieur ou égal à 0.');
      return;
    }
    if (!formData.ingredientId) {
      setError('Veuillez associer un ingrédient du stock.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        id: supplement?.id || `sup-${Date.now()}`,
        name: formData.name.trim(),
        description: formData.description?.trim() || '',
        price: Number(formData.price),
        ingredientId: formData.ingredientId,
        quantityConsumed: Number(formData.quantityConsumed) || 0,
        unit: formData.unit || 'g',
        active: formData.active !== false,
        available: formData.available !== false,
        sortOrder: Number(formData.sortOrder) || 1
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’enregistrement du supplément.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg font-display">
              {supplement ? 'Modifier le Supplément' : 'Nouveau Supplément Menu'}
            </h3>
            <p className="text-xs text-stone-400">
              Option payante avec déduction automatique de stock
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-stone-800 text-stone-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Nom du supplément *
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="ex: Poulet Grillé Extra (+60g), Œuf Poché Bio..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Description commerciale
            </label>
            <input
              type="text"
              value={formData.description || ''}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="ex: Blanc de poulet fermier mariné aux herbes"
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                Prix de vente (DT) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  required
                  value={formData.price ?? ''}
                  onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm font-bold font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-stone-500">DT</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                Ordre d'affichage
              </label>
              <input
                type="number"
                min="1"
                value={formData.sortOrder || 1}
                onChange={e => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Stock Linking */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">
              Consommation Stock Cuisine (Recette)
            </span>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Matière première associée *
              </label>
              <select
                value={formData.ingredientId || ''}
                onChange={e => handleIngredientChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">-- Choisir un ingrédient du stock --</option>
                {ingredients.map(ing => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} (Stock actuel : {ing.currentStock} {ing.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Quantité déduite
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.quantityConsumed ?? ''}
                  onChange={e => setFormData({ ...formData, quantityConsumed: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-mono font-bold bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Unité de mesure
                </label>
                <input
                  type="text"
                  value={formData.unit || 'g'}
                  onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-bold bg-white"
                />
              </div>
            </div>
          </div>

          {/* Visibility and Availability */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <label className="flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.active !== false}
                onChange={e => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <span>Actif (au catalogue)</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.available !== false}
                onChange={e => setFormData({ ...formData, available: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <span>Disponible (en stock)</span>
            </label>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-2">
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
              <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
