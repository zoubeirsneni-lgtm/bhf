import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Save, Package } from 'lucide-react';
import { Ingredient } from '../../types';

interface IngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ingredient: Ingredient) => Promise<void>;
  ingredientToEdit?: Ingredient | null;
}

export const IngredientModal: React.FC<IngredientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  ingredientToEdit
}) => {
  const isEditing = Boolean(ingredientToEdit);

  const [formData, setFormData] = useState<Partial<Ingredient>>({
    name: '',
    category: 'Protéines',
    unit: 'g',
    currentStock: 1000,
    minThreshold: 200,
    purchaseCost: 0.015,
    supplierName: '',
    active: true
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (ingredientToEdit) {
      setFormData({
        ...ingredientToEdit,
        active: ingredientToEdit.active !== false
      });
    } else {
      setFormData({
        name: '',
        category: 'Protéines',
        unit: 'g',
        currentStock: 1000,
        minThreshold: 200,
        purchaseCost: 0.015,
        supplierName: '',
        active: true
      });
    }
    setError(null);
  }, [ingredientToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setError('Le nom de l’ingrédient est obligatoire.');
      return;
    }
    if (!formData.unit) {
      setError('L’unité de mesure est obligatoire.');
      return;
    }
    if (formData.currentStock === undefined || formData.currentStock < 0) {
      setError('Le stock doit être un nombre positif ou nul.');
      return;
    }
    if (formData.minThreshold === undefined || formData.minThreshold < 0) {
      setError('Le seuil d’alerte doit être un nombre positif ou nul.');
      return;
    }
    if (formData.purchaseCost === undefined || formData.purchaseCost < 0) {
      setError('Le coût d’achat doit être un nombre positif ou nul.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload: Ingredient = {
        ...(ingredientToEdit || {}),
        id: ingredientToEdit?.id || '',
        name: formData.name.trim(),
        category: formData.category?.trim() || 'Autre',
        unit: formData.unit as 'g' | 'ml' | 'piece' | 'portion',
        currentStock: Number(formData.currentStock),
        minThreshold: Number(formData.minThreshold),
        purchaseCost: Number(formData.purchaseCost),
        supplierName: formData.supplierName?.trim() || undefined,
        active: formData.active !== false,
        updatedAt: new Date().toISOString()
      };

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’enregistrement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                {isEditing ? 'Modifier l’ingrédient' : 'Ajouter un nouvel ingrédient'}
              </h2>
              <p className="text-xs text-stone-500">
                {isEditing ? 'Mise à jour des paramètres de stock et coût' : 'Enregistrement de matière première en cuisine'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Nom */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Nom de l’ingrédient <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Blanc de poulet, Quinoa, Avocat..."
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              required
            />
          </div>

          {/* Catégorie & Unité */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Catégorie
              </label>
              <select
                value={formData.category || 'Protéines'}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
              >
                <option value="Protéines">Protéines</option>
                <option value="Féculents">Féculents</option>
                <option value="Légumes">Légumes</option>
                <option value="Sauces">Sauces</option>
                <option value="Condiments">Condiments</option>
                <option value="Emballages">Emballages</option>
                <option value="Boissons">Boissons</option>
                <option value="Autre">Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Unité de mesure <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.unit || 'g'}
                onChange={e => setFormData({ ...formData, unit: e.target.value as 'g' | 'ml' | 'piece' | 'portion' })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                required
              >
                <option value="g">Grammes (g)</option>
                <option value="ml">Millilitres (ml)</option>
                <option value="piece">Pièce (piece)</option>
                <option value="portion">Portion (portion)</option>
              </select>
            </div>
          </div>

          {/* Stock actuel / initial & Seuil alerte */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                {isEditing ? 'Stock actuel' : 'Stock initial'} ({formData.unit}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.currentStock ?? ''}
                onChange={e => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Seuil d’alerte ({formData.unit}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.minThreshold ?? ''}
                onChange={e => setFormData({ ...formData, minThreshold: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>
          </div>

          {/* Coût d'achat & Fournisseur */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Coût d’achat (DT / {formData.unit}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                placeholder="Ex: 0.016"
                value={formData.purchaseCost ?? ''}
                onChange={e => setFormData({ ...formData, purchaseCost: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Fournisseur
              </label>
              <input
                type="text"
                placeholder="Ex: Marché Central, BioDist..."
                value={formData.supplierName || ''}
                onChange={e => setFormData({ ...formData, supplierName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Statut actif/désactivé */}
          <div className="pt-1">
            <label className="inline-flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.active !== false}
                onChange={e => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
              />
              <span className="text-xs font-bold text-stone-700">
                Ingrédient actif (disponible pour de nouvelles recettes et suppléments)
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSubmitting ? 'Enregistrement...' : isEditing ? 'Enregistrer les modifications' : 'Créer l’ingrédient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
