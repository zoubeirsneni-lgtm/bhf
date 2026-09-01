import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, Category, Supplement, Ingredient } from '../../types';
import { CategoryModal } from './CategoryModal';
import { SupplementModal } from './SupplementModal';
import { ProductModalAdmin } from './ProductModalAdmin';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  Salad,
  Flame,
  Utensils,
  GlassWater,
  Baby,
  Calendar,
  DollarSign,
  ChefHat,
  PackageCheck
} from 'lucide-react';

export const CatalogManager: React.FC = () => {
  const {
    products,
    categories,
    supplements,
    ingredients,
    saveProduct,
    deleteProduct,
    saveCategory,
    deleteCategory,
    saveSupplement,
    deleteSupplement,
    showToast
  } = useApp();

  const [activeCatalogSubTab, setActiveCatalogSubTab] = useState<'products' | 'categories' | 'supplements'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  // Modals state
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const [editingSupplement, setEditingSupplement] = useState<Supplement | null>(null);
  const [isSupplementModalOpen, setIsSupplementModalOpen] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Category Icon helper
  const renderCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Salad':
        return <Salad className="w-4 h-4" />;
      case 'Flame':
        return <Flame className="w-4 h-4" />;
      case 'Baby':
        return <Baby className="w-4 h-4" />;
      case 'GlassWater':
        return <GlassWater className="w-4 h-4" />;
      case 'Calendar':
        return <Calendar className="w-4 h-4" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4" />;
      default:
        return <Utensils className="w-4 h-4" />;
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(prod => {
      const matchesCategory = selectedCategoryId === 'all' || prod.categoryId === selectedCategoryId;
      const matchesSearch =
        searchQuery.trim() === '' ||
        prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prod.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryId, searchQuery]);

  // Toggle active product
  const handleToggleProductActive = async (product: Product) => {
    try {
      await saveProduct({ ...product, active: !product.active });
      showToast(
        product.active ? 'Produit masqué' : 'Produit activé',
        `« ${product.name} » a été mis à jour.`,
        'info'
      );
    } catch (err: any) {
      showToast('Erreur', err.message, 'warning');
    }
  };

  // Toggle availability (in stock)
  const handleToggleProductAvailable = async (product: Product) => {
    const nextVal = product.available === false || product.isAvailable === false ? true : false;
    try {
      await saveProduct({
        ...product,
        available: nextVal,
        isAvailable: nextVal
      });
      showToast(
        nextVal ? 'Produit disponible' : 'Produit marqué épuisé',
        `« ${product.name} » est maintenant ${nextVal ? 'disponible à la commande' : 'marqué en rupture'}.`,
        'info'
      );
    } catch (err: any) {
      showToast('Erreur', err.message, 'warning');
    }
  };

  // Delete product with confirmation
  const handleDeleteProduct = async (product: Product) => {
    if (confirm(`Confirmer la suppression définitive du produit « ${product.name} » ?`)) {
      try {
        await deleteProduct(product.id);
        showToast('Produit supprimé', `« ${product.name} » a été retiré du catalogue.`, 'success');
      } catch (err: any) {
        showToast('Erreur suppression', err.message, 'warning');
      }
    }
  };

  // Delete Category
  const handleDeleteCategory = async (cat: Category) => {
    const prodsInCat = products.filter(p => p.categoryId === cat.id);
    if (prodsInCat.length > 0) {
      alert(`Impossible de supprimer cette catégorie car ${prodsInCat.length} produit(s) y sont rattachés.`);
      return;
    }
    if (confirm(`Supprimer la catégorie « ${cat.name} » ?`)) {
      try {
        await deleteCategory(cat.id);
        showToast('Catégorie supprimée', `La catégorie « ${cat.name} » a été supprimée.`, 'success');
      } catch (err: any) {
        showToast('Erreur', err.message, 'warning');
      }
    }
  };

  // Delete Supplement
  const handleDeleteSupplement = async (sup: Supplement) => {
    if (confirm(`Supprimer le supplément « ${sup.name} » ?`)) {
      try {
        await deleteSupplement(sup.id);
        showToast('Supplément supprimé', `Le supplément « ${sup.name} » a été supprimé.`, 'success');
      } catch (err: any) {
        showToast('Erreur', err.message, 'warning');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tabs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveCatalogSubTab('products')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeCatalogSubTab === 'products'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            Plats &amp; Repas ({products.length})
          </button>
          <button
            onClick={() => setActiveCatalogSubTab('categories')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeCatalogSubTab === 'categories'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            Catégories ({categories.length})
          </button>
          <button
            onClick={() => setActiveCatalogSubTab('supplements')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeCatalogSubTab === 'supplements'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            Suppléments ({supplements.length})
          </button>
        </div>

        {/* Create CTA */}
        <div>
          {activeCatalogSubTab === 'products' && (
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsProductModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Plat / Produit</span>
            </button>
          )}

          {activeCatalogSubTab === 'categories' && (
            <button
              onClick={() => {
                setEditingCategory(null);
                setIsCategoryModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle Catégorie</span>
            </button>
          )}

          {activeCatalogSubTab === 'supplements' && (
            <button
              onClick={() => {
                setEditingSupplement(null);
                setIsSupplementModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Supplément</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. PRODUCTS MANAGEMENT */}
      {activeCatalogSubTab === 'products' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-6 space-y-6 shadow-xs">
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedCategoryId === 'all'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                Toutes ({products.length})
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    selectedCategoryId === cat.id
                      ? 'bg-emerald-700 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {renderCategoryIcon(cat.icon)}
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher plat..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-emerald-500"
              />
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-3" />
            </div>
          </div>

          {/* Products Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-3.5 rounded-l-xl">Plat / Recette</th>
                  <th className="p-3.5">Catégorie</th>
                  <th className="p-3.5">Prix Base</th>
                  <th className="p-3.5">Composition &amp; Pesée</th>
                  <th className="p-3.5">Disponibilité</th>
                  <th className="p-3.5">Affichage</th>
                  <th className="p-3.5 rounded-r-xl text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredProducts.map(product => {
                  const cat = categories.find(c => c.id === product.categoryId);
                  const isOutOfStock = product.available === false || product.isAvailable === false;

                  return (
                    <tr key={product.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-12 h-12 rounded-xl object-cover border border-stone-200 flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-stone-900 text-sm">{product.name}</h4>
                              {product.isPopular && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  Populaire
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-stone-500 line-clamp-1 max-w-xs">{product.description}</p>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 font-medium text-stone-700">
                        {cat?.name || 'Non classé'}
                      </td>

                      <td className="p-3.5 font-mono font-extrabold text-emerald-700 text-sm">
                        {product.basePrice.toFixed(1)} DT
                      </td>

                      <td className="p-3.5">
                        {product.baseIngredients && product.baseIngredients.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md font-mono text-[11px]">
                            <ChefHat className="w-3 h-3 text-emerald-700" />
                            {product.baseIngredients.length} pesées
                          </span>
                        ) : (
                          <span className="text-stone-400 italic text-[11px]">Recette simple</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleProductAvailable(product)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${
                            !isOutOfStock
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          }`}
                        >
                          {!isOutOfStock ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{!isOutOfStock ? 'En Stock' : 'Épuisé'}</span>
                        </button>
                      </td>

                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleProductActive(product)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 transition-colors ${
                            product.active
                              ? 'bg-stone-100 text-stone-800 hover:bg-stone-200'
                              : 'bg-stone-200 text-stone-500 hover:bg-stone-300'
                          }`}
                        >
                          {product.active ? <Eye className="w-3 h-3 text-emerald-700" /> : <EyeOff className="w-3 h-3" />}
                          <span>{product.active ? 'Visible' : 'Masqué'}</span>
                        </button>
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingProduct(product);
                              setIsProductModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-200 transition-colors"
                            title="Modifier la fiche produit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Supprimer le produit"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. CATEGORIES MANAGEMENT */}
      {activeCatalogSubTab === 'categories' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-6 space-y-6 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-3.5 rounded-l-xl">Ordre</th>
                  <th className="p-3.5">Icône &amp; Catégorie</th>
                  <th className="p-3.5">Slug URL</th>
                  <th className="p-3.5">Description</th>
                  <th className="p-3.5">Plats associés</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5 rounded-r-xl text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {categories.map(cat => {
                  const prodsCount = products.filter(p => p.categoryId === cat.id).length;
                  return (
                    <tr key={cat.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-3.5 font-bold font-mono text-stone-500">
                        #{cat.sortOrder || 1}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                            {renderCategoryIcon(cat.icon)}
                          </div>
                          <span className="font-bold text-stone-900 text-sm">{cat.name}</span>
                        </div>
                      </td>

                      <td className="p-3.5 font-mono text-stone-500">
                        {cat.slug || cat.id}
                      </td>

                      <td className="p-3.5 text-stone-600 max-w-xs line-clamp-1">
                        {cat.description || '—'}
                      </td>

                      <td className="p-3.5 font-bold text-stone-700">
                        <span className="px-2 py-0.5 rounded-md bg-stone-100">
                          {prodsCount} plat(s)
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            cat.active !== false
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stone-200 text-stone-600'
                          }`}
                        >
                          {cat.active !== false ? 'Actif' : 'Masqué'}
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setIsCategoryModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-200 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. SUPPLEMENTS MANAGEMENT */}
      {activeCatalogSubTab === 'supplements' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-6 space-y-6 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-3.5 rounded-l-xl">Supplément</th>
                  <th className="p-3.5">Prix Client</th>
                  <th className="p-3.5">Consommation Stock</th>
                  <th className="p-3.5">Disponibilité</th>
                  <th className="p-3.5">Statut</th>
                  <th className="p-3.5 rounded-r-xl text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {supplements.map(sup => {
                  const ing = ingredients.find(i => i.id === sup.ingredientId);
                  return (
                    <tr key={sup.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-stone-900 text-sm">{sup.name}</div>
                        <p className="text-[11px] text-stone-500 line-clamp-1">{sup.description}</p>
                      </td>

                      <td className="p-3.5 font-mono font-extrabold text-emerald-700 text-sm">
                        +{sup.price.toFixed(1)} DT
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-stone-800">
                            +{sup.quantityConsumed} {sup.unit}
                          </span>
                          <span className="text-stone-500">
                            ({ing?.name || 'Ingrédient non trouvé'})
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            sup.available !== false
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {sup.available !== false ? 'Disponible' : 'Épuisé'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            sup.active !== false
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stone-200 text-stone-600'
                          }`}
                        >
                          {sup.active !== false ? 'Actif' : 'Masqué'}
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingSupplement(sup);
                              setIsSupplementModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-200 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSupplement(sup)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Category Modal */}
      <CategoryModal
        category={editingCategory}
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        onSave={async cat => {
          await saveCategory(cat);
          showToast('Succès', 'Catégorie enregistrée.', 'success');
        }}
      />

      {/* Supplement Modal */}
      <SupplementModal
        supplement={editingSupplement}
        ingredients={ingredients}
        isOpen={isSupplementModalOpen}
        onClose={() => {
          setIsSupplementModalOpen(false);
          setEditingSupplement(null);
        }}
        onSave={async sup => {
          await saveSupplement(sup);
          showToast('Succès', 'Supplément enregistré.', 'success');
        }}
      />

      {/* Product Admin Modal */}
      <ProductModalAdmin
        product={editingProduct}
        categories={categories}
        ingredients={ingredients}
        supplements={supplements}
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        onSave={async prod => {
          await saveProduct(prod);
          showToast('Succès', `Le plat « ${prod.name} » a été enregistré.`, 'success');
        }}
      />
    </div>
  );
};
