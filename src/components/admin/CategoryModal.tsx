import React, { useState, useEffect } from 'react';
import { Category } from '../../types';
import { X, Check, Salad, Flame, Sparkles, GlassWater, Baby, Calendar, Utensils } from 'lucide-react';

interface CategoryModalProps {
  category: Category | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: Category) => Promise<void>;
}

const AVAILABLE_ICONS = [
  { name: 'Salad', label: 'Salade / Bol', icon: Salad },
  { name: 'Flame', label: 'Chaud / Grillades', icon: Flame },
  { name: 'Baby', label: 'Kids / Doux', icon: Baby },
  { name: 'GlassWater', label: 'Boissons', icon: GlassWater },
  { name: 'Calendar', label: 'Packs & Semaines', icon: Calendar },
  { name: 'Sparkles', label: 'Spécialités', icon: Sparkles },
  { name: 'Utensils', label: 'Générique', icon: Utensils }
];

export const CategoryModal: React.FC<CategoryModalProps> = ({
  category,
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<Partial<Category>>({
    name: '',
    slug: '',
    description: '',
    icon: 'Salad',
    sortOrder: 1,
    active: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (category) {
      setFormData(category);
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
        icon: 'Salad',
        sortOrder: 1,
        active: true
      });
    }
    setError(null);
  }, [category, isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setFormData(prev => ({
      ...prev,
      name,
      slug: category ? prev.slug || slug : slug
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setError('Le nom de la catégorie est obligatoire.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        id: category?.id || `cat-${Date.now()}`,
        name: formData.name.trim(),
        slug: formData.slug?.trim() || formData.name.toLowerCase().replace(/\s+/g, '-'),
        description: formData.description?.trim() || '',
        icon: formData.icon || 'Utensils',
        sortOrder: Number(formData.sortOrder) || 1,
        active: formData.active !== false
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’enregistrement de la catégorie.');
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
              {category ? 'Modifier la Catégorie' : 'Nouvelle Catégorie'}
            </h3>
            <p className="text-xs text-stone-400">
              Organisation des plats dans le menu client
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
              Nom de la catégorie *
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="ex: Salades Santé, Bowls Chauds, Pack Semaine..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Slug (Identifiant URL)
            </label>
            <input
              type="text"
              value={formData.slug || ''}
              onChange={e => setFormData({ ...formData, slug: e.target.value })}
              placeholder="ex: salades-sante"
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Description (sous-titre menu)
            </label>
            <textarea
              rows={2}
              value={formData.description || ''}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Courte description pour guider les clients..."
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
              Icône visuelle
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {AVAILABLE_ICONS.map(item => {
                const IconComp = item.icon;
                const isSelected = formData.icon === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: item.name })}
                    className={`p-2.5 rounded-xl border text-xs flex flex-col items-center gap-1.5 transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-500/20'
                        : 'border-stone-200 hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <IconComp className="w-5 h-5 text-emerald-700" />
                    <span className="text-[10px] leading-tight text-center">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
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

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                Statut
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="category-active-checkbox"
                  checked={formData.active !== false}
                  onChange={e => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <label htmlFor="category-active-checkbox" className="text-xs font-medium text-stone-800">
                  Visible au menu client
                </label>
              </div>
            </div>
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
