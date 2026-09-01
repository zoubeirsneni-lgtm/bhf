import { Category, Ingredient, Product, Supplement, Supplier, Driver, Order, StockMovement } from '../src/types';

export const initialCategories: Category[] = [
  {
    id: 'cat-healthy',
    name: 'Healthy Bowls',
    slug: 'healthy',
    icon: 'Salad',
    description: 'Compositions équilibrées, céréales complètes, légumes frais et protéines maigres.',
    active: true,
    order: 1,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'cat-grillades',
    name: 'Grillades',
    slug: 'grillades',
    icon: 'Flame',
    description: 'Viandes et volailles sélectionnées, grillées minute à la flamme sans matières grasses superflues.',
    active: true,
    order: 2,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'cat-enfants',
    name: 'Enfants',
    slug: 'enfants',
    icon: 'Baby',
    description: 'Portions adaptées, recettes gourmandes et équilibrées pour les plus jeunes.',
    active: true,
    order: 3,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'cat-jus-detox',
    name: 'Jus détox',
    slug: 'jus-detox',
    icon: 'GlassWater',
    description: 'Jus 100% naturels pressés à froid sans sucre ajouté et eaux infusées bienfaisantes.',
    active: true,
    order: 4,
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'cat-regime-30j',
    name: 'Régime complet 30 jours',
    slug: 'regime-30j',
    icon: 'Calendar',
    description: 'Programmes nutritionnels complets et accompagnement sur-mesure pour transformer vos habitudes.',
    active: true,
    order: 5,
    sortOrder: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'cat-salades',
    name: 'Salades & Fraîcheur',
    slug: 'salades',
    icon: 'Sparkles',
    description: 'Légumes croquants du terroir, herbes fraîches et assaisonnements maison.',
    active: true,
    order: 6,
    sortOrder: 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const initialSuppliers: Supplier[] = [
  {
    id: 'sup-1',
    name: 'Ferme Bio de Mornag',
    phone: '+216 71 889 001',
    email: 'contact@ferme-mornag.tn',
    address: 'Mornag, Ben Arous',
    suppliedIngredients: ['ing-legumes', 'ing-avocat', 'ing-oeuf', 'ing-saumon', 'ing-fruits-frais', 'ing-betterave', 'ing-eau-infusee']
  },
  {
    id: 'sup-2',
    name: 'Volailles du Terroir',
    phone: '+216 71 450 120',
    email: 'commandes@volailles-terroir.tn',
    address: 'Zone Industrielle, Tunis',
    suppliedIngredients: ['ing-poulet', 'ing-boeuf', 'ing-dinde']
  },
  {
    id: 'sup-3',
    name: 'Moulins & Grains Sélection',
    phone: '+216 71 230 400',
    email: 'contact@grains-selection.tn',
    address: 'Port de Radès',
    suppliedIngredients: ['ing-riz', 'ing-quinoa', 'ing-patate-douce']
  }
];

export const initialIngredients: Ingredient[] = [
  {
    id: 'ing-poulet',
    name: 'Filet de Poulet mariné aux herbes',
    unit: 'g',
    currentStock: 18500,
    minThreshold: 4000,
    purchaseCost: 0.016,
    supplierId: 'sup-2',
    supplierName: 'Volailles du Terroir',
    category: 'Protéines',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-boeuf',
    name: 'Bœuf maigre mariné façon BEBBA',
    unit: 'g',
    currentStock: 9200,
    minThreshold: 3000,
    purchaseCost: 0.034,
    supplierId: 'sup-2',
    supplierName: 'Volailles du Terroir',
    category: 'Protéines',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-dinde',
    name: 'Filet de Dinde fermière mariné',
    unit: 'g',
    currentStock: 12000,
    minThreshold: 3000,
    purchaseCost: 0.015,
    supplierId: 'sup-2',
    supplierName: 'Volailles du Terroir',
    category: 'Protéines',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-saumon',
    name: 'Pavé de Saumon frais Atlantique',
    unit: 'g',
    currentStock: 6500,
    minThreshold: 1500,
    purchaseCost: 0.045,
    supplierId: 'sup-1',
    supplierName: 'Ferme Bio de Mornag',
    category: 'Protéines',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-riz',
    name: 'Riz Basmati complet aux épices douces',
    unit: 'g',
    currentStock: 25000,
    minThreshold: 5000,
    purchaseCost: 0.005,
    supplierId: 'sup-3',
    supplierName: 'Moulins & Grains Sélection',
    category: 'Féculents',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-quinoa',
    name: 'Quinoa royal aux graines',
    unit: 'g',
    currentStock: 7800,
    minThreshold: 2000,
    purchaseCost: 0.014,
    supplierId: 'sup-3',
    supplierName: 'Moulins & Grains Sélection',
    category: 'Féculents',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-patate-douce',
    name: 'Patates douces rôties au romarin',
    unit: 'g',
    currentStock: 12000,
    minThreshold: 3000,
    purchaseCost: 0.006,
    supplierId: 'sup-3',
    supplierName: 'Moulins & Grains Sélection',
    category: 'Féculents',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-legumes',
    name: 'Légumes croquants de saison',
    unit: 'g',
    currentStock: 21000,
    minThreshold: 5000,
    purchaseCost: 0.004,
    supplierId: 'sup-1',
    supplierName: 'Ferme Bio de Mornag',
    category: 'Légumes',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-avocat',
    name: 'Avocat frais crémeux',
    unit: 'g',
    currentStock: 3500,
    minThreshold: 1500,
    purchaseCost: 0.018,
    supplierId: 'sup-1',
    supplierName: 'Ferme Bio de Mornag',
    category: 'Légumes & Fruits',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-oeuf',
    name: 'Œufs fermiers bio pochés/durs',
    unit: 'piece',
    currentStock: 65,
    minThreshold: 20,
    purchaseCost: 0.45,
    supplierId: 'sup-1',
    supplierName: 'Ferme Bio de Mornag',
    category: 'Protéines',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-halloumi',
    name: 'Fromage Halloumi grillé',
    unit: 'g',
    currentStock: 2800,
    minThreshold: 1000,
    purchaseCost: 0.025,
    supplierId: 'sup-1',
    supplierName: 'Ferme Bio de Mornag',
    category: 'Protéines & Fromages',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-sauce-healthy',
    name: 'Sauce signature BEBBA (Herbes & Yaourt)',
    unit: 'ml',
    currentStock: 4500,
    minThreshold: 1000,
    purchaseCost: 0.008,
    supplierId: 'sup-1',
    supplierName: 'Ferme Bio de Mornag',
    category: 'Sauces',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-sauce-miel-moutarde',
    name: 'Sauce Miel & Moutarde à l’ancienne',
    unit: 'ml',
    currentStock: 3800,
    minThreshold: 1000,
    purchaseCost: 0.009,
    supplierId: 'sup-1',
    supplierName: 'Ferme Bio de Mornag',
    category: 'Sauces',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-fruits-frais',
    name: 'Agrumes & Fruits frais pressés',
    unit: 'ml',
    currentStock: 12000,
    minThreshold: 3000,
    purchaseCost: 0.005,
    supplierId: 'sup-1',
    supplierName: 'Ferme Bio de Mornag',
    category: 'Boissons',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-betterave',
    name: 'Betterave rouge & Gingembre',
    unit: 'ml',
    currentStock: 5000,
    minThreshold: 1000,
    purchaseCost: 0.007,
    supplierId: 'sup-1',
    supplierName: 'Ferme Bio de Mornag',
    category: 'Boissons',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-eau-infusee',
    name: 'Infusion Détox Concombre Menthe Citron',
    unit: 'ml',
    currentStock: 8000,
    minThreshold: 2000,
    purchaseCost: 0.002,
    supplierId: 'sup-1',
    supplierName: 'Ferme Bio de Mornag',
    category: 'Boissons',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ing-repas-programme',
    name: 'Pack Repas Nutritionnel Équilibré BEBBA',
    unit: 'portion',
    currentStock: 45,
    minThreshold: 10,
    purchaseCost: 8.5,
    supplierId: 'sup-1',
    supplierName: 'Ferme Bio de Mornag',
    category: 'Programmes',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const initialSupplements: Supplement[] = [
  {
    id: 'sup-poulet-extra',
    name: 'Portion supplémentaire de Poulet grillé (+150g)',
    description: '150g de filet de poulet mariné grillé minute.',
    price: 4.5,
    ingredientId: 'ing-poulet',
    ingredientName: 'Filet de Poulet mariné aux herbes',
    quantity: 150,
    quantityConsumed: 150,
    unit: 'g',
    available: true,
    isAvailable: true,
    active: true,
    order: 1,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'sup-boeuf-extra',
    name: 'Portion supplémentaire de Bœuf grillé (+150g)',
    description: '150g de bœuf maigre mariné et grillé minute.',
    price: 6.5,
    ingredientId: 'ing-boeuf',
    ingredientName: 'Bœuf maigre mariné façon BEBBA',
    quantity: 150,
    quantityConsumed: 150,
    unit: 'g',
    available: true,
    isAvailable: true,
    active: true,
    order: 2,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'sup-legumes-extra',
    name: 'Légumes croquants supplémentaires (+150g)',
    description: 'Courgettes, brocolis, carottes et poivrons sautés à sec.',
    price: 2.5,
    ingredientId: 'ing-legumes',
    ingredientName: 'Légumes croquants de saison',
    quantity: 150,
    quantityConsumed: 150,
    unit: 'g',
    available: true,
    isAvailable: true,
    active: true,
    order: 3,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'sup-riz-extra',
    name: 'Riz basmati complet supplémentaire (+150g)',
    description: 'Portion de riz complet aux aromates.',
    price: 2.0,
    ingredientId: 'ing-riz',
    ingredientName: 'Riz Basmati complet aux épices douces',
    quantity: 150,
    quantityConsumed: 150,
    unit: 'g',
    available: true,
    isAvailable: true,
    active: true,
    order: 4,
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'sup-avocat-extra',
    name: 'Demi-avocat tranché (+80g)',
    description: 'Avocat frais riche en bons lipides.',
    price: 3.0,
    ingredientId: 'ing-avocat',
    ingredientName: 'Avocat frais crémeux',
    quantity: 80,
    quantityConsumed: 80,
    unit: 'g',
    available: true,
    isAvailable: true,
    active: true,
    order: 5,
    sortOrder: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'sup-oeuf-poche',
    name: 'Œuf fermier poché bio (1 pièce)',
    description: 'Œuf coulant bio riche en protéines.',
    price: 1.5,
    ingredientId: 'ing-oeuf',
    ingredientName: 'Œufs fermiers bio pochés/durs',
    quantity: 1,
    quantityConsumed: 1,
    unit: 'piece',
    available: true,
    isAvailable: true,
    active: true,
    order: 6,
    sortOrder: 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'sup-halloumi-extra',
    name: 'Halloumi grillé doré (+80g)',
    description: 'Tranches de fromage halloumi grillé à la perfection.',
    price: 3.5,
    ingredientId: 'ing-halloumi',
    ingredientName: 'Fromage Halloumi grillé',
    quantity: 80,
    quantityConsumed: 80,
    unit: 'g',
    available: true,
    isAvailable: true,
    active: true,
    order: 7,
    sortOrder: 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'sup-sauce-extra',
    name: 'Sauce signature BEBBA supplémentaire (+50ml)',
    description: 'Pot de sauce maison fraîche.',
    price: 1.0,
    ingredientId: 'ing-sauce-healthy',
    ingredientName: 'Sauce signature BEBBA (Herbes & Yaourt)',
    quantity: 50,
    quantityConsumed: 50,
    unit: 'ml',
    available: true,
    isAvailable: true,
    active: true,
    order: 8,
    sortOrder: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const initialProducts: Product[] = [
  // --- Category 1: Healthy Bowls (cat-healthy) ---
  {
    id: 'prod-poulet-bowl',
    name: 'BEBBA Chicken Power Bowl',
    description: 'Filet de poulet mariné grillé minute, riz basmati complet, brocolis, courgettes grillées, avocat et sauce signature légère.',
    categoryId: 'cat-healthy',
    basePrice: 14.5,
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    calories: 520,
    proteinGrams: 42,
    carbsGrams: 48,
    fatGrams: 14,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: true,
    order: 1,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-poulet', ingredientName: 'Filet de Poulet mariné aux herbes', quantity: 200, unit: 'g' },
      { ingredientId: 'ing-riz', ingredientName: 'Riz Basmati complet aux épices douces', quantity: 150, unit: 'g' },
      { ingredientId: 'ing-legumes', ingredientName: 'Légumes croquants de saison', quantity: 180, unit: 'g' },
      { ingredientId: 'ing-sauce-healthy', ingredientName: 'Sauce signature BEBBA (Herbes & Yaourt)', quantity: 35, unit: 'ml' }
    ],
    customization: {
      allowsProteinChoice: true,
      proteinOptions: [
        { label: 'Portion normale (200g)', extraPrice: 0, extraGrams: 0 },
        { label: 'Portion sportive (+100g de poulet)', extraPrice: 3.0, extraGrams: 100 },
        { label: 'Double protéine (+200g de poulet)', extraPrice: 5.5, extraGrams: 200 }
      ],
      allowsVeggiesChoice: true,
      veggiesOptions: [
        { label: 'Portion normale (180g)', extraPrice: 0, extraGrams: 0 },
        { label: 'Légumes supplémentaires (+100g)', extraPrice: 1.8, extraGrams: 100 },
        { label: 'Double portion légumes (+180g)', extraPrice: 3.0, extraGrams: 180 }
      ],
      allowsBaseChoice: true,
      baseChoices: [
        { label: 'Riz Basmati complet', extraPrice: 0 },
        { label: 'Quinoa royal aux graines (+1.5 DT)', extraPrice: 1.5 },
        { label: 'Patates douces rôties (+1.0 DT)', extraPrice: 1.0 },
        { label: 'Base 100% Légumes sans féculent', extraPrice: 0 }
      ],
      allowedSupplementIds: [
        'sup-poulet-extra',
        'sup-avocat-extra',
        'sup-oeuf-poche',
        'sup-halloumi-extra',
        'sup-sauce-extra',
        'sup-legumes-extra'
      ]
    }
  },
  {
    id: 'prod-quinoa-green-bowl',
    name: 'Quinoa Superfood & Halloumi Bowl',
    description: 'Quinoa royal, tranches d’halloumi grillé, avocat frais, œuf bio poché, brocolis vapeur et sauce légère au citron.',
    categoryId: 'cat-healthy',
    basePrice: 15.5,
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
    calories: 490,
    proteinGrams: 28,
    carbsGrams: 42,
    fatGrams: 22,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: false,
    order: 2,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-quinoa', ingredientName: 'Quinoa royal aux graines', quantity: 150, unit: 'g' },
      { ingredientId: 'ing-halloumi', ingredientName: 'Fromage Halloumi grillé', quantity: 100, unit: 'g' },
      { ingredientId: 'ing-avocat', ingredientName: 'Avocat frais crémeux', quantity: 70, unit: 'g' },
      { ingredientId: 'ing-oeuf', ingredientName: 'Œufs fermiers bio pochés/durs', quantity: 1, unit: 'piece' },
      { ingredientId: 'ing-legumes', ingredientName: 'Légumes croquants de saison', quantity: 120, unit: 'g' },
      { ingredientId: 'ing-sauce-healthy', ingredientName: 'Sauce signature BEBBA (Herbes & Yaourt)', quantity: 30, unit: 'ml' }
    ],
    customization: {
      allowsProteinChoice: true,
      proteinOptions: [
        { label: 'Halloumi standard (100g) + 1 œuf', extraPrice: 0, extraGrams: 0 },
        { label: 'Ajout Poulet grillé (+120g)', extraPrice: 3.5, extraGrams: 120 },
        { label: 'Double Halloumi (+80g)', extraPrice: 3.5, extraGrams: 80 }
      ],
      allowsVeggiesChoice: true,
      veggiesOptions: [
        { label: 'Portion normale (120g)', extraPrice: 0, extraGrams: 0 },
        { label: 'Légumes supplémentaires (+100g)', extraPrice: 1.8, extraGrams: 100 }
      ],
      allowsBaseChoice: true,
      baseChoices: [
        { label: 'Quinoa royal', extraPrice: 0 },
        { label: 'Riz basmati complet', extraPrice: 0 },
        { label: 'Patates douces rôties', extraPrice: 0 }
      ],
      allowedSupplementIds: [
        'sup-poulet-extra',
        'sup-oeuf-poche',
        'sup-avocat-extra',
        'sup-halloumi-extra',
        'sup-sauce-extra'
      ]
    }
  },
  {
    id: 'prod-saumon-zen-bowl',
    name: 'Bowl Saumon Énergie & Avocat',
    description: 'Pavé de saumon frais poêlé, quinoa royal, dés d’avocat, graines de sésame grillées et légumes vapeur croquants.',
    categoryId: 'cat-healthy',
    basePrice: 18.5,
    imageUrl: 'https://images.unsplash.com/photo-1546069901-d7790b4119d6?auto=format&fit=crop&w=800&q=80',
    calories: 550,
    proteinGrams: 38,
    carbsGrams: 36,
    fatGrams: 24,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: true,
    order: 3,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-saumon', ingredientName: 'Pavé de Saumon frais Atlantique', quantity: 180, unit: 'g' },
      { ingredientId: 'ing-quinoa', ingredientName: 'Quinoa royal aux graines', quantity: 150, unit: 'g' },
      { ingredientId: 'ing-avocat', ingredientName: 'Avocat frais crémeux', quantity: 70, unit: 'g' },
      { ingredientId: 'ing-legumes', ingredientName: 'Légumes croquants de saison', quantity: 150, unit: 'g' },
      { ingredientId: 'ing-sauce-healthy', ingredientName: 'Sauce signature BEBBA (Herbes & Yaourt)', quantity: 30, unit: 'ml' }
    ],
    customization: {
      allowsProteinChoice: true,
      proteinOptions: [
        { label: 'Saumon standard (180g)', extraPrice: 0, extraGrams: 0 },
        { label: 'Portion généreuse (+80g saumon)', extraPrice: 4.5, extraGrams: 80 }
      ],
      allowsVeggiesChoice: true,
      veggiesOptions: [
        { label: 'Portion standard', extraPrice: 0, extraGrams: 0 },
        { label: 'Extra légumes verts (+100g)', extraPrice: 1.8, extraGrams: 100 }
      ],
      allowsBaseChoice: true,
      baseChoices: [
        { label: 'Quinoa royal', extraPrice: 0 },
        { label: 'Riz Basmati complet', extraPrice: 0 },
        { label: 'Mix 100% Légumes sans féculent', extraPrice: 0 }
      ],
      allowedSupplementIds: [
        'sup-avocat-extra',
        'sup-oeuf-poche',
        'sup-halloumi-extra',
        'sup-sauce-extra'
      ]
    }
  },
  {
    id: 'prod-bowl-vegetal-mediterraneen',
    name: 'Bowl Végétal Méditerranéen',
    description: 'Composition 100% végétale avec quinoa, légumes rôtis au four, avocat crémeux, graines de courge et herbes de Mornag.',
    categoryId: 'cat-healthy',
    basePrice: 13.5,
    imageUrl: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=800&q=80',
    calories: 420,
    proteinGrams: 18,
    carbsGrams: 52,
    fatGrams: 16,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: false,
    order: 4,
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-quinoa', ingredientName: 'Quinoa royal aux graines', quantity: 180, unit: 'g' },
      { ingredientId: 'ing-legumes', ingredientName: 'Légumes croquants de saison', quantity: 220, unit: 'g' },
      { ingredientId: 'ing-avocat', ingredientName: 'Avocat frais crémeux', quantity: 80, unit: 'g' },
      { ingredientId: 'ing-sauce-healthy', ingredientName: 'Sauce signature BEBBA (Herbes & Yaourt)', quantity: 35, unit: 'ml' }
    ],
    customization: {
      allowsVeggiesChoice: true,
      veggiesOptions: [
        { label: 'Portion généreuse (220g)', extraPrice: 0, extraGrams: 0 },
        { label: 'Double portion légumes (+180g)', extraPrice: 2.5, extraGrams: 180 }
      ],
      allowsBaseChoice: true,
      baseChoices: [
        { label: 'Quinoa royal', extraPrice: 0 },
        { label: 'Riz Basmati complet', extraPrice: 0 },
        { label: 'Patates douces rôties', extraPrice: 0 }
      ],
      allowedSupplementIds: [
        'sup-oeuf-poche',
        'sup-halloumi-extra',
        'sup-avocat-extra',
        'sup-sauce-extra'
      ]
    }
  },

  // --- Category 2: Grillades (cat-grillades) ---
  {
    id: 'prod-poulet-grille',
    name: 'Assiette Grillade Poulet Mariné',
    description: 'Poitrine de poulet fermier grillée à la flamme avec épices tunisiennes douces, accompagnée de patates douces rôties et légumes sautés.',
    categoryId: 'cat-grillades',
    basePrice: 16.0,
    imageUrl: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80',
    calories: 560,
    proteinGrams: 48,
    carbsGrams: 38,
    fatGrams: 16,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: true,
    order: 1,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-poulet', ingredientName: 'Filet de Poulet mariné aux herbes', quantity: 250, unit: 'g' },
      { ingredientId: 'ing-patate-douce', ingredientName: 'Patates douces rôties au romarin', quantity: 180, unit: 'g' },
      { ingredientId: 'ing-legumes', ingredientName: 'Légumes croquants de saison', quantity: 150, unit: 'g' },
      { ingredientId: 'ing-sauce-miel-moutarde', ingredientName: 'Sauce Miel & Moutarde à l’ancienne', quantity: 40, unit: 'ml' }
    ],
    customization: {
      allowsProteinChoice: true,
      proteinOptions: [
        { label: 'Portion normale (250g)', extraPrice: 0, extraGrams: 0 },
        { label: 'Portion Gourmet (+100g de poulet)', extraPrice: 3.0, extraGrams: 100 },
        { label: 'Double portion (+250g de poulet)', extraPrice: 6.0, extraGrams: 250 }
      ],
      allowsVeggiesChoice: true,
      veggiesOptions: [
        { label: 'Portion normale (150g)', extraPrice: 0, extraGrams: 0 },
        { label: 'Extra légumes grillés (+100g)', extraPrice: 1.8, extraGrams: 100 }
      ],
      allowsBaseChoice: true,
      baseChoices: [
        { label: 'Patates douces rôties', extraPrice: 0 },
        { label: 'Riz Basmati complet', extraPrice: 0 },
        { label: 'Quinoa royal (+1.5 DT)', extraPrice: 1.5 },
        { label: 'Double légumes (sans féculents)', extraPrice: 0 }
      ],
      allowedSupplementIds: [
        'sup-poulet-extra',
        'sup-boeuf-extra',
        'sup-halloumi-extra',
        'sup-oeuf-poche',
        'sup-sauce-extra'
      ]
    }
  },
  {
    id: 'prod-boeuf-grillade',
    name: 'Assiette Bœuf Grillé & Romarin',
    description: 'Pavé de bœuf maigre tendre saisi sur le grill, patates douces rôties au four et sauce signature aux herbes.',
    categoryId: 'cat-grillades',
    basePrice: 19.5,
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
    calories: 590,
    proteinGrams: 50,
    carbsGrams: 32,
    fatGrams: 18,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: false,
    order: 2,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-boeuf', ingredientName: 'Bœuf maigre mariné façon BEBBA', quantity: 220, unit: 'g' },
      { ingredientId: 'ing-patate-douce', ingredientName: 'Patates douces rôties au romarin', quantity: 160, unit: 'g' },
      { ingredientId: 'ing-legumes', ingredientName: 'Légumes croquants de saison', quantity: 180, unit: 'g' },
      { ingredientId: 'ing-sauce-healthy', ingredientName: 'Sauce signature BEBBA (Herbes & Yaourt)', quantity: 35, unit: 'ml' }
    ],
    customization: {
      allowsProteinChoice: true,
      proteinOptions: [
        { label: 'Portion normale (220g)', extraPrice: 0, extraGrams: 0 },
        { label: 'Portion Gourmet (+100g de bœuf)', extraPrice: 5.0, extraGrams: 100 },
        { label: 'Double portion (+220g de bœuf)', extraPrice: 9.0, extraGrams: 220 }
      ],
      allowsVeggiesChoice: true,
      veggiesOptions: [
        { label: 'Portion standard (180g)', extraPrice: 0, extraGrams: 0 },
        { label: 'Légumes supplémentaires (+100g)', extraPrice: 1.8, extraGrams: 100 }
      ],
      allowsBaseChoice: true,
      baseChoices: [
        { label: 'Patates douces rôties', extraPrice: 0 },
        { label: 'Riz complet basmati', extraPrice: 0 },
        { label: 'Quinoa royal (+1.5 DT)', extraPrice: 1.5 },
        { label: 'Mix 100% Légumes rôtis', extraPrice: 0 }
      ],
      allowedSupplementIds: [
        'sup-boeuf-extra',
        'sup-oeuf-poche',
        'sup-halloumi-extra',
        'sup-avocat-extra',
        'sup-sauce-extra'
      ]
    }
  },
  {
    id: 'prod-mix-grill-fitness',
    name: 'Mix Grill BEBBA Fitness',
    description: 'Duo de poulet mariné et bœuf maigre grillé minute, légumes du soleil et riz complet basmati.',
    categoryId: 'cat-grillades',
    basePrice: 22.0,
    imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80',
    calories: 640,
    proteinGrams: 58,
    carbsGrams: 40,
    fatGrams: 18,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: true,
    order: 3,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-poulet', ingredientName: 'Filet de Poulet mariné aux herbes', quantity: 150, unit: 'g' },
      { ingredientId: 'ing-boeuf', ingredientName: 'Bœuf maigre mariné façon BEBBA', quantity: 150, unit: 'g' },
      { ingredientId: 'ing-riz', ingredientName: 'Riz Basmati complet aux épices douces', quantity: 160, unit: 'g' },
      { ingredientId: 'ing-legumes', ingredientName: 'Légumes croquants de saison', quantity: 150, unit: 'g' },
      { ingredientId: 'ing-sauce-healthy', ingredientName: 'Sauce signature BEBBA (Herbes & Yaourt)', quantity: 40, unit: 'ml' }
    ],
    customization: {
      allowsProteinChoice: true,
      proteinOptions: [
        { label: 'Duo Standard (150g Poulet + 150g Bœuf)', extraPrice: 0, extraGrams: 0 },
        { label: 'Maxi Duo (+100g Poulet)', extraPrice: 3.0, extraGrams: 100 }
      ],
      allowsBaseChoice: true,
      baseChoices: [
        { label: 'Riz Basmati complet', extraPrice: 0 },
        { label: 'Patates douces rôties', extraPrice: 0 },
        { label: 'Mix 100% Légumes', extraPrice: 0 }
      ],
      allowedSupplementIds: [
        'sup-oeuf-poche',
        'sup-avocat-extra',
        'sup-halloumi-extra',
        'sup-sauce-extra'
      ]
    }
  },
  {
    id: 'prod-brochettes-dinde',
    name: 'Brochettes de Dinde aux Épices Douces',
    description: 'Brochettes de dinde fermière marinées au paprika doux et herbes fraîches, grillées au feu de bois.',
    categoryId: 'cat-grillades',
    basePrice: 15.0,
    imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=800&q=80',
    calories: 480,
    proteinGrams: 44,
    carbsGrams: 35,
    fatGrams: 12,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: false,
    order: 4,
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-dinde', ingredientName: 'Filet de Dinde fermière mariné', quantity: 220, unit: 'g' },
      { ingredientId: 'ing-riz', ingredientName: 'Riz Basmati complet aux épices douces', quantity: 150, unit: 'g' },
      { ingredientId: 'ing-legumes', ingredientName: 'Légumes croquants de saison', quantity: 150, unit: 'g' },
      { ingredientId: 'ing-sauce-miel-moutarde', ingredientName: 'Sauce Miel & Moutarde à l’ancienne', quantity: 35, unit: 'ml' }
    ],
    customization: {
      allowsProteinChoice: true,
      proteinOptions: [
        { label: 'Portion standard (220g)', extraPrice: 0, extraGrams: 0 },
        { label: 'Brochette supplémentaire (+100g)', extraPrice: 2.8, extraGrams: 100 }
      ],
      allowsBaseChoice: true,
      baseChoices: [
        { label: 'Riz Basmati complet', extraPrice: 0 },
        { label: 'Patates douces rôties', extraPrice: 0 }
      ],
      allowedSupplementIds: [
        'sup-oeuf-poche',
        'sup-avocat-extra',
        'sup-sauce-extra'
      ]
    }
  },

  // --- Category 3: Enfants (cat-enfants) ---
  {
    id: 'prod-menu-ptit-champion',
    name: 'Menu P\'tit Champion Poulet & Riz Doux',
    description: 'Émincé de filet de poulet grillé tendre, riz basmati parfumé, petits dés de carottes & courgettes et sauce douce.',
    categoryId: 'cat-enfants',
    basePrice: 11.0,
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80',
    calories: 380,
    proteinGrams: 28,
    carbsGrams: 42,
    fatGrams: 8,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: true,
    order: 1,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-poulet', ingredientName: 'Filet de Poulet mariné aux herbes', quantity: 120, unit: 'g' },
      { ingredientId: 'ing-riz', ingredientName: 'Riz Basmati complet aux épices douces', quantity: 120, unit: 'g' },
      { ingredientId: 'ing-legumes', ingredientName: 'Légumes croquants de saison', quantity: 80, unit: 'g' },
      { ingredientId: 'ing-sauce-healthy', ingredientName: 'Sauce signature BEBBA (Herbes & Yaourt)', quantity: 25, unit: 'ml' }
    ],
    customization: {
      allowsBaseChoice: true,
      baseChoices: [
        { label: 'Riz basmati doux', extraPrice: 0 },
        { label: 'Patates douces rôties', extraPrice: 0 }
      ],
      allowedSupplementIds: [
        'sup-oeuf-poche',
        'sup-avocat-extra',
        'sup-sauce-extra'
      ]
    }
  },
  {
    id: 'prod-mini-bowl-gourmet',
    name: 'Mini Bowl P\'tit Gourmet & Légumes Colorés',
    description: 'Petits cubes de poulet doré, patates douces au four croustillantes, dés d’avocat et sauce yaourt.',
    categoryId: 'cat-enfants',
    basePrice: 10.5,
    imageUrl: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=800&q=80',
    calories: 350,
    proteinGrams: 24,
    carbsGrams: 36,
    fatGrams: 10,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: false,
    order: 2,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-poulet', ingredientName: 'Filet de Poulet mariné aux herbes', quantity: 100, unit: 'g' },
      { ingredientId: 'ing-patate-douce', ingredientName: 'Patates douces rôties au romarin', quantity: 120, unit: 'g' },
      { ingredientId: 'ing-avocat', ingredientName: 'Avocat frais crémeux', quantity: 40, unit: 'g' },
      { ingredientId: 'ing-sauce-healthy', ingredientName: 'Sauce signature BEBBA (Herbes & Yaourt)', quantity: 25, unit: 'ml' }
    ],
    customization: {
      allowedSupplementIds: [
        'sup-oeuf-poche',
        'sup-sauce-extra'
      ]
    }
  },
  {
    id: 'prod-batonnets-poulet-dore',
    name: 'P\'tits Bâtonnets de Poulet au Four',
    description: 'Bâtonnets de filet de poulet panés aux graines et cuits au four sans friture, accompagnés de riz doux.',
    categoryId: 'cat-enfants',
    basePrice: 11.5,
    imageUrl: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80',
    calories: 390,
    proteinGrams: 30,
    carbsGrams: 38,
    fatGrams: 9,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: false,
    order: 3,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-poulet', ingredientName: 'Filet de Poulet mariné aux herbes', quantity: 140, unit: 'g' },
      { ingredientId: 'ing-riz', ingredientName: 'Riz Basmati complet aux épices douces', quantity: 120, unit: 'g' },
      { ingredientId: 'ing-sauce-miel-moutarde', ingredientName: 'Sauce Miel & Moutarde à l’ancienne', quantity: 30, unit: 'ml' }
    ],
    customization: {
      allowedSupplementIds: [
        'sup-avocat-extra',
        'sup-sauce-extra'
      ]
    }
  },

  // --- Category 4: Jus détox (cat-jus-detox) ---
  {
    id: 'prod-jus-detox-vert',
    name: 'Jus Vert Détox Vitalité (350ml)',
    description: 'Pomme verte, concombre, épinards, menthe fraîche et touche de gingembre. Pressé à froid sans sucre.',
    categoryId: 'cat-jus-detox',
    basePrice: 5.5,
    imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80',
    calories: 110,
    proteinGrams: 2,
    carbsGrams: 24,
    fatGrams: 0,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: true,
    order: 1,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-fruits-frais', ingredientName: 'Agrumes & Fruits frais pressés', quantity: 350, unit: 'ml' }
    ],
    customization: {
      allowedSupplementIds: []
    }
  },
  {
    id: 'prod-jus-orange-carotte',
    name: 'Jus Boost Énergie Orange & Carotte (350ml)',
    description: 'Oranges douces de Tunisie pressées à la minute avec carottes fraîches et pointe de curcuma.',
    categoryId: 'cat-jus-detox',
    basePrice: 5.0,
    imageUrl: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=800&q=80',
    calories: 125,
    proteinGrams: 2,
    carbsGrams: 28,
    fatGrams: 0,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: false,
    order: 2,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-fruits-frais', ingredientName: 'Agrumes & Fruits frais pressés', quantity: 350, unit: 'ml' }
    ],
    customization: {
      allowedSupplementIds: []
    }
  },
  {
    id: 'prod-elixir-betterave',
    name: 'Élixir Détox Betterave & Gingembre (350ml)',
    description: 'Betterave rouge bio, pomme, jus de citron pressé et racine de gingembre frais pour stimuler l\'oxygénation.',
    categoryId: 'cat-jus-detox',
    basePrice: 5.5,
    imageUrl: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=800&q=80',
    calories: 115,
    proteinGrams: 2,
    carbsGrams: 26,
    fatGrams: 0,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: false,
    order: 3,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-betterave', ingredientName: 'Betterave rouge & Gingembre', quantity: 350, unit: 'ml' }
    ],
    customization: {
      allowedSupplementIds: []
    }
  },
  {
    id: 'prod-eau-infusee',
    name: 'Eau Infusée Concombre Menthe Citron (500ml)',
    description: 'Eau minérale infusée à froid pendant 12h avec tranches de concombre frais, menthe du jardin et citron bio.',
    categoryId: 'cat-jus-detox',
    basePrice: 3.5,
    imageUrl: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=800&q=80',
    calories: 15,
    proteinGrams: 0,
    carbsGrams: 3,
    fatGrams: 0,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: false,
    order: 4,
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-eau-infusee', ingredientName: 'Infusion Détox Concombre Menthe Citron', quantity: 500, unit: 'ml' }
    ],
    customization: {
      allowedSupplementIds: []
    }
  },

  // --- Category 5: Régime complet 30 jours (cat-regime-30j) ---
  {
    id: 'prod-programme-30j-perte',
    name: 'Programme 30 Jours — Perte de Poids & Détox',
    description: 'Pack complet de 30 jours comprenant 2 repas sains quotidiens (midi + soir) et un jus détox par jour avec suivi nutritionnel.',
    categoryId: 'cat-regime-30j',
    basePrice: 380.0,
    imageUrl: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80',
    calories: 1100,
    proteinGrams: 85,
    carbsGrams: 95,
    fatGrams: 30,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: true,
    order: 1,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-repas-programme', ingredientName: 'Pack Repas Nutritionnel Équilibré BEBBA', quantity: 1, unit: 'portion' }
    ],
    customization: {
      allowedSupplementIds: []
    }
  },
  {
    id: 'prod-programme-30j-masse',
    name: 'Programme 30 Jours — Prise de Masse Sèche',
    description: 'Formule sportive enrichie en protéines nobles (poulet, bœuf maigre, quinoa, patates douces) avec collations énergétiques.',
    categoryId: 'cat-regime-30j',
    basePrice: 440.0,
    imageUrl: 'https://images.unsplash.com/photo-1547496502-affa22d38842?auto=format&fit=crop&w=800&q=80',
    calories: 1650,
    proteinGrams: 140,
    carbsGrams: 150,
    fatGrams: 42,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: false,
    order: 2,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-repas-programme', ingredientName: 'Pack Repas Nutritionnel Équilibré BEBBA', quantity: 1, unit: 'portion' }
    ],
    customization: {
      allowedSupplementIds: []
    }
  },
  {
    id: 'prod-formule-30j-vitalite',
    name: 'Formule 30 Jours — Équilibre & Vitalité',
    description: '30 déjeuners équilibrés livrés chaque midi au bureau ou à domicile pour manger sain sans contrainte.',
    categoryId: 'cat-regime-30j',
    basePrice: 360.0,
    imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    calories: 550,
    proteinGrams: 45,
    carbsGrams: 48,
    fatGrams: 15,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: false,
    order: 3,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-repas-programme', ingredientName: 'Pack Repas Nutritionnel Équilibré BEBBA', quantity: 1, unit: 'portion' }
    ],
    customization: {
      allowedSupplementIds: []
    }
  },

  // --- Category 6: Salades & Fraîcheur (cat-salades) ---
  {
    id: 'prod-salade-fraicheur',
    name: 'Grande Salade BEBBA Croustillante',
    description: 'Mélange de jeunes pousses, concombre croquant, carottes râpées, tomates cerises, avocat, graines de courge et poulet effiloché tiède.',
    categoryId: 'cat-salades',
    basePrice: 13.0,
    imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    calories: 380,
    proteinGrams: 32,
    carbsGrams: 20,
    fatGrams: 14,
    active: true,
    available: true,
    isAvailable: true,
    isPopular: false,
    order: 1,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    baseIngredients: [
      { ingredientId: 'ing-legumes', ingredientName: 'Légumes croquants de saison', quantity: 240, unit: 'g' },
      { ingredientId: 'ing-poulet', ingredientName: 'Filet de Poulet mariné aux herbes', quantity: 150, unit: 'g' },
      { ingredientId: 'ing-avocat', ingredientName: 'Avocat frais crémeux', quantity: 50, unit: 'g' },
      { ingredientId: 'ing-sauce-healthy', ingredientName: 'Sauce signature BEBBA (Herbes & Yaourt)', quantity: 35, unit: 'ml' }
    ],
    customization: {
      allowsProteinChoice: true,
      proteinOptions: [
        { label: 'Poulet grillé (150g)', extraPrice: 0, extraGrams: 0 },
        { label: 'Double poulet (+150g)', extraPrice: 4.0, extraGrams: 150 },
        { label: 'Option Végétarienne (Remplacer par Halloumi + Œuf)', extraPrice: 1.0, extraGrams: 0 }
      ],
      allowsVeggiesChoice: true,
      veggiesOptions: [
        { label: 'Portion généreuse (240g)', extraPrice: 0, extraGrams: 0 },
        { label: 'Extra avocat & légumes (+100g)', extraPrice: 2.5, extraGrams: 100 }
      ],
      allowedSupplementIds: [
        'sup-oeuf-poche',
        'sup-avocat-extra',
        'sup-halloumi-extra',
        'sup-poulet-extra',
        'sup-sauce-extra'
      ]
    }
  }
];

export const initialDrivers: Driver[] = [
  {
    id: 'drv-1',
    name: 'Yassine Ben Amor',
    phone: '+216 98 123 456',
    vehicle: 'Scooter Honda 125cc (Rapide)',
    active: true,
    totalDeliveries: 142,
    rating: 4.9
  },
  {
    id: 'drv-2',
    name: 'Amine Trabelsi',
    phone: '+216 55 987 654',
    vehicle: 'Moto Peugeot Tweet',
    active: true,
    totalDeliveries: 98,
    rating: 4.8
  },
  {
    id: 'drv-3',
    name: 'Karim Bouazizi',
    phone: '+216 22 456 789',
    vehicle: 'Vélo Électrique Cargo',
    active: true,
    totalDeliveries: 64,
    rating: 4.95
  }
];

export const initialOrders: Order[] = [
  {
    id: 'ord-1047',
    orderNumber: 'BEBBA-1047',
    trackingToken: 'tk_bebba_1047_demo',
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    client: {
      name: 'Sami Khelifi',
      phone: '+216 98 440 210',
      deliveryAddress: 'Résidence Les Palmiers, Apt 4B, Les Berges du Lac 2, Tunis',
      notes: 'Code porte 4210. Sonner 2 fois.'
    },
    items: [
      {
        id: 'item-1',
        productId: 'prod-poulet-bowl',
        productName: 'BEBBA Chicken Power Bowl',
        unitPrice: 22.3,
        quantity: 1,
        proteinOption: { label: 'Portion sportive (+100g de poulet)', extraPrice: 3.0, extraGrams: 100 },
        veggiesOption: { label: 'Légumes supplémentaires (+100g)', extraPrice: 1.8, extraGrams: 100 },
        baseChoice: { label: 'Riz Basmati complet', extraPrice: 0 },
        supplements: [
          {
            supplementId: 'sup-avocat-extra',
            name: 'Demi-avocat tranché (+80g)',
            price: 3.0,
            quantity: 1,
            ingredientId: 'ing-avocat',
            ingredientName: 'Avocat frais crémeux',
            quantityConsumed: 80,
            unit: 'g'
          }
        ],
        specialInstructions: 'Sauce servie à part svp. Pas de piment.',
        itemTotalPrice: 22.3,
        preparationSheet: {
          totalIngredients: [
            { ingredientId: 'ing-poulet', ingredientName: 'Filet de Poulet mariné aux herbes', totalQuantity: 300, unit: 'g' },
            { ingredientId: 'ing-riz', ingredientName: 'Riz Basmati complet aux épices douces', totalQuantity: 150, unit: 'g' },
            { ingredientId: 'ing-legumes', ingredientName: 'Légumes croquants de saison', totalQuantity: 280, unit: 'g' },
            { ingredientId: 'ing-avocat', ingredientName: 'Avocat frais crémeux', totalQuantity: 80, unit: 'g' },
            { ingredientId: 'ing-sauce-healthy', ingredientName: 'Sauce signature BEBBA (Herbes & Yaourt)', totalQuantity: 35, unit: 'ml' }
          ],
          summaryLines: [
            '🍗 Poulet mariné: 300g (Base 200g + Extra 100g)',
            '🍚 Riz basmati: 150g',
            '🥦 Légumes de saison: 280g (Base 180g + Extra 100g)',
            '🥑 Avocat frais: 80g',
            '🥣 Sauce signature BEBBA: 35ml (À PART)'
          ]
        }
      }
    ],
    subtotal: 22.3,
    deliveryFee: 2.5,
    totalAmount: 24.8,
    status: 'delivering',
    paymentMethod: 'cash_on_delivery',
    paymentStatus: 'to_collect',
    assignedDriverId: 'drv-1',
    assignedDriverName: 'Yassine Ben Amor',
    statusHistory: [
      {
        status: 'received',
        label: 'Commande reçue & enregistrée',
        timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        note: 'Validation du panier client (Paiement à la livraison)'
      },
      {
        status: 'preparing',
        label: 'En préparation en cuisine',
        timestamp: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
        note: 'Prise en charge par le Chef Cuisine BEBBA'
      },
      {
        status: 'ready',
        label: 'Commande prête & emballée',
        timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        note: 'Vérification qualité et mise en sac thermique'
      },
      {
        status: 'delivering',
        label: 'En cours de livraison',
        timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
        note: 'Prise en charge par Yassine Ben Amor'
      }
    ]
  },
  {
    id: 'ord-1048',
    orderNumber: 'BEBBA-1048',
    trackingToken: 'tk_bebba_1048_demo',
    createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    client: {
      name: 'Meriem Mansouri',
      phone: '+216 52 119 883',
      deliveryAddress: 'Avenue Habib Bourguiba, Immeuble Carthage, 3ème étage, La Marsa',
      notes: 'Appeler à l’arrivée'
    },
    items: [
      {
        id: 'item-2',
        productId: 'prod-poulet-grille',
        productName: 'Assiette Grillade Poulet Mariné',
        unitPrice: 17.5,
        quantity: 1,
        proteinOption: { label: 'Portion normale (250g)', extraPrice: 0, extraGrams: 0 },
        veggiesOption: { label: 'Portion normale (150g)', extraPrice: 0, extraGrams: 0 },
        baseChoice: { label: 'Patates douces rôties', extraPrice: 0 },
        supplements: [
          {
            supplementId: 'sup-oeuf-poche',
            name: 'Œuf fermier poché bio (1 pièce)',
            price: 1.5,
            quantity: 1,
            ingredientId: 'ing-oeuf',
            ingredientName: 'Œufs fermiers bio pochés/durs',
            quantityConsumed: 1,
            unit: 'piece'
          }
        ],
        itemTotalPrice: 17.5,
        preparationSheet: {
          totalIngredients: [
            { ingredientId: 'ing-poulet', ingredientName: 'Filet de Poulet mariné aux herbes', totalQuantity: 250, unit: 'g' },
            { ingredientId: 'ing-patate-douce', ingredientName: 'Patates douces rôties au romarin', totalQuantity: 180, unit: 'g' },
            { ingredientId: 'ing-legumes', ingredientName: 'Légumes croquants de saison', totalQuantity: 150, unit: 'g' },
            { ingredientId: 'ing-oeuf', ingredientName: 'Œufs fermiers bio pochés/durs', totalQuantity: 1, unit: 'piece' },
            { ingredientId: 'ing-sauce-miel-moutarde', ingredientName: 'Sauce Miel & Moutarde à l’ancienne', totalQuantity: 40, unit: 'ml' }
          ],
          summaryLines: [
            '🍗 Poulet grillé minute: 250g',
            '🍠 Patates douces rôties: 180g',
            '🥦 Légumes croquants: 150g',
            '🥚 1 Œuf fermier poché bio',
            '🍯 Sauce Miel & Moutarde: 40ml'
          ]
        }
      },
      {
        id: 'item-3',
        productId: 'prod-jus-detox-vert',
        productName: 'Jus Vert Détox Vitalité (350ml)',
        unitPrice: 5.5,
        quantity: 1,
        supplements: [],
        itemTotalPrice: 5.5,
        preparationSheet: {
          totalIngredients: [
            { ingredientId: 'ing-fruits-frais', ingredientName: 'Agrumes & Fruits frais pressés', totalQuantity: 350, unit: 'ml' }
          ],
          summaryLines: ['🍏 1 Jus vert détox pressé frais (350ml)']
        }
      }
    ],
    subtotal: 23.0,
    deliveryFee: 2.5,
    totalAmount: 25.5,
    status: 'preparing',
    paymentMethod: 'cash_on_delivery',
    paymentStatus: 'to_collect',
    statusHistory: [
      {
        status: 'received',
        label: 'Commande reçue & enregistrée',
        timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
        note: 'Validée par le client'
      },
      {
        status: 'preparing',
        label: 'En préparation en cuisine',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        note: 'Grillades en cuisson'
      }
    ]
  },
  {
    id: 'ord-1049',
    orderNumber: 'BEBBA-1049',
    trackingToken: 'tk_bebba_1049_demo',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    client: {
      name: 'Nidhal Gharbi',
      phone: '+216 23 881 902',
      deliveryAddress: 'Centre Urbain Nord, Tour Yasmine, Bureau 502, Tunis',
      notes: 'Laisser à la réception si indisponible.'
    },
    items: [
      {
        id: 'item-4',
        productId: 'prod-boeuf-grillade',
        productName: 'Assiette Bœuf Grillé & Romarin',
        unitPrice: 28.0,
        quantity: 1,
        proteinOption: { label: 'Portion Gourmet (+100g de bœuf)', extraPrice: 5.0, extraGrams: 100 },
        veggiesOption: { label: 'Portion standard (180g)', extraPrice: 0, extraGrams: 0 },
        baseChoice: { label: 'Mix 100% Légumes rôtis', extraPrice: 0 },
        supplements: [
          {
            supplementId: 'sup-halloumi-extra',
            name: 'Halloumi grillé doré (+80g)',
            price: 3.5,
            quantity: 1,
            ingredientId: 'ing-halloumi',
            ingredientName: 'Fromage Halloumi grillé',
            quantityConsumed: 80,
            unit: 'g'
          }
        ],
        itemTotalPrice: 28.0,
        preparationSheet: {
          totalIngredients: [
            { ingredientId: 'ing-boeuf', ingredientName: 'Bœuf maigre mariné façon BEBBA', totalQuantity: 320, unit: 'g' },
            { ingredientId: 'ing-legumes', ingredientName: 'Légumes croquants de saison', totalQuantity: 280, unit: 'g' },
            { ingredientId: 'ing-halloumi', ingredientName: 'Fromage Halloumi grillé', totalQuantity: 80, unit: 'g' },
            { ingredientId: 'ing-sauce-healthy', ingredientName: 'Sauce signature BEBBA (Herbes & Yaourt)', totalQuantity: 35, unit: 'ml' }
          ],
          summaryLines: [
            '🥩 Bœuf grillé tendre: 320g (Base 220g + Extra 100g)',
            '🥦 Légumes rôtis: 280g (Base + Remplacement féculent)',
            '🧀 Halloumi grillé: 80g',
            '🥣 Sauce signature BEBBA: 35ml'
          ]
        }
      }
    ],
    subtotal: 28.0,
    deliveryFee: 2.5,
    totalAmount: 30.5,
    status: 'received',
    paymentMethod: 'cash_on_delivery',
    paymentStatus: 'to_collect',
    statusHistory: [
      {
        status: 'received',
        label: 'Commande reçue & enregistrée',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        note: 'Nouvelle commande à traiter en cuisine'
      }
    ]
  }
];

export const initialStockMovements: StockMovement[] = [
  {
    id: 'mov-1',
    ingredientId: 'ing-poulet',
    ingredientName: 'Filet de Poulet mariné aux herbes',
    type: 'order_consumption',
    quantity: -300,
    unit: 'g',
    orderId: 'ord-1047',
    orderNumber: 'BEBBA-1047',
    notes: 'Consommation commande #BEBBA-1047 (Poulet Bowl 300g)',
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    performedBy: 'Système Automatique BEBBA'
  },
  {
    id: 'mov-2',
    ingredientId: 'ing-riz',
    ingredientName: 'Riz Basmati complet aux épices douces',
    type: 'order_consumption',
    quantity: -150,
    unit: 'g',
    orderId: 'ord-1047',
    orderNumber: 'BEBBA-1047',
    notes: 'Consommation commande #BEBBA-1047',
    timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    performedBy: 'Système Automatique BEBBA'
  },
  {
    id: 'mov-3',
    ingredientId: 'ing-poulet',
    ingredientName: 'Filet de Poulet mariné aux herbes',
    type: 'manual_in',
    quantity: 15000,
    unit: 'g',
    notes: 'Réception livraison fournisseur Volailles du Terroir (Bon #4891)',
    timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    performedBy: 'Chef Gestionnaire'
  }
];
