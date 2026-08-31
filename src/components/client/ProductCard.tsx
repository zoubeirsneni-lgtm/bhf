import React from 'react';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { Plus, Flame, Sparkles, Utensils, ShoppingBag } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { setSelectedProductForCustomization, addToCart } = useApp();

  return (
    <article
      id={`product-card-${product.id}`}
      className="bg-white rounded-3xl overflow-hidden border border-stone-200/80 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group relative"
    >
      {/* Image container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        {/* Nutritional badge */}
        {(product.calories || product.proteinGrams) && (
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
            {product.calories && (
              <span className="px-2.5 py-1 rounded-full bg-stone-900/80 backdrop-blur-md text-white text-[11px] font-bold">
                {product.calories} kcal
              </span>
            )}
            {product.proteinGrams && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-700/90 backdrop-blur-md text-white text-[11px] font-bold">
                {product.proteinGrams}g Protéines
              </span>
            )}
          </div>
        )}

        {product.isPopular && (
          <div className="absolute top-3 right-3 z-10">
            <span className="px-2.5 py-1 rounded-full bg-amber-500 text-stone-950 text-[11px] font-extrabold flex items-center gap-1 shadow-md">
              <Sparkles className="w-3 h-3" />
              Populaire
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <h3 className="font-bold text-lg text-stone-900 font-display group-hover:text-emerald-700 transition-colors">
              {product.name}
            </h3>
            <span className="font-extrabold text-lg text-emerald-700 flex-shrink-0">
              {product.basePrice.toFixed(1)} DT
            </span>
          </div>

          <p className="text-stone-600 text-xs sm:text-sm leading-relaxed line-clamp-2">
            {product.description}
          </p>

          {/* Base Ingredients Pills */}
          {product.baseIngredients && product.baseIngredients.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {product.baseIngredients.slice(0, 3).map(ing => (
                <span
                  key={ing.ingredientId}
                  className="inline-block px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[11px] font-medium"
                >
                  {ing.ingredientName.split(' ')[0]} ({ing.quantity}{ing.unit})
                </span>
              ))}
              {product.baseIngredients.length > 3 && (
                <span className="text-[10px] text-stone-400 self-center">
                  +{product.baseIngredients.length - 3} autres
                </span>
              )}
            </div>
          )}
        </div>

        {/* CTA Actions */}
        <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            id={`btn-order-${product.id}`}
            onClick={() => {
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
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Commander</span>
          </button>

          <button
            id={`btn-customize-${product.id}`}
            onClick={() => setSelectedProductForCustomization(product)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 active:bg-emerald-100 border border-stone-200 hover:border-emerald-300 text-stone-800 text-xs sm:text-sm font-bold transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>Personnaliser</span>
          </button>
        </div>
      </div>
    </article>
  );
};
