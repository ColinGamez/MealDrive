import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ChefHat, 
  Refrigerator, 
  ShoppingBag, 
  Filter, 
  Search, 
  ChevronRight,
  Sparkles,
  UtensilsCrossed,
  Leaf,
  Flame,
  Zap,
  Calendar,
  Mic,
  MicOff,
  Info,
  Github,
  History,
  X,
  Bookmark,
  Plus,
  Sun,
  Moon,
  RotateCcw,
  AlertCircle,
  Clock,
  CheckCircle2,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Recipe, MealPlan as MealPlanType, ShoppingItem, PantryItem, RecentRecipe } from './types';
import { analyzeFridgeImage, generateRecipes, generateMealPlan } from './services/gemini';
import { parseQuantity, getRecipePantryStatus } from './lib/ingredientUtils';
import { IngredientScanner } from './components/IngredientScanner';
import { RecipeCard } from './components/RecipeCard';
import { RecipeDetail } from './components/RecipeDetail';
import { ShoppingList } from './components/ShoppingList';
import { MealPlan } from './components/MealPlan';
import { Pantry } from './components/Pantry';
import { OnboardingCard } from './components/OnboardingCard';
import { useVoiceCommands } from './hooks/useVoiceCommands';

import { useI18n } from './i18n/I18nContext';

const DIETARY_FILTERS = [
  { id: 'vegetarian', label: 'Vegetarian', icon: Leaf },
  { id: 'keto', label: 'Keto', icon: Flame },
  { id: 'vegan', label: 'Vegan', icon: Sparkles },
  { id: 'gluten-free', label: 'Gluten Free', icon: Zap },
];

const FEATURED_RECIPES: Recipe[] = [
  {
    id: 'featured-1',
    title: 'Spring Pea & Mint Risotto',
    description: 'A vibrant, creamy risotto celebrating the best of spring with fresh peas, mint, and a touch of lemon zest.',
    ingredients: [
      { name: 'Arborio Rice', amount: '1.5 cups' },
      { name: 'Fresh Peas', amount: '1 cup' },
      { name: 'Vegetable Broth', amount: '4 cups' },
      { name: 'Fresh Mint', amount: '1/4 cup' },
      { name: 'Lemon', amount: '1' },
      { name: 'Parmesan', amount: '1/2 cup' }
    ],
    instructions: [
      'Heat broth in a saucepan and keep warm.',
      'Sauté onions in butter until translucent.',
      'Add rice and toast for 2 minutes.',
      'Add broth one ladle at a time, stirring constantly.',
      'When rice is al dente, stir in peas, mint, lemon zest, and parmesan.',
      'Serve immediately with a garnish of fresh mint.'
    ],
    preparationTime: '35 mins',
    difficulty: 'Medium',
    calories: 420,
    dietaryTags: ['Vegetarian', 'Seasonal'],
    imagePrompt: 'Creamy green risotto with peas and mint leaves on a white plate, professional food photography',
    rating: 4.9,
    servings: 4
  },
  {
    id: 'featured-2',
    title: 'Honey Garlic Glazed Salmon',
    description: 'Perfectly seared salmon fillets coated in a sticky, sweet, and savory honey garlic sauce.',
    ingredients: [
      { name: 'Salmon Fillets', amount: '2' },
      { name: 'Honey', amount: '3 tbsp' },
      { name: 'Soy Sauce', amount: '1 tbsp' },
      { name: 'Garlic', amount: '3 cloves' },
      { name: 'Lemon Juice', amount: '1 tbsp' }
    ],
    instructions: [
      'Season salmon with salt and pepper.',
      'Whisk honey, soy sauce, lemon juice, and garlic in a small bowl.',
      'Sear salmon in a hot pan for 3-4 minutes per side.',
      'Pour in the sauce and let it bubble and thicken.',
      'Spoon sauce over salmon and serve with steamed broccoli.'
    ],
    preparationTime: '15 mins',
    difficulty: 'Easy',
    calories: 380,
    dietaryTags: ['High Protein', 'Healthy'],
    imagePrompt: 'Glazed salmon fillet with honey garlic sauce and lemon slices, macro food photography',
    rating: 4.8,
    servings: 2
  },
  {
    id: 'featured-3',
    title: 'Roasted Mediterranean Veggies',
    description: 'A colorful medley of seasonal vegetables roasted with olive oil, garlic, and fresh herbs.',
    ingredients: [
      { name: 'Bell Peppers', amount: '2' },
      { name: 'Zucchini', amount: '1' },
      { name: 'Red Onion', amount: '1' },
      { name: 'Cherry Tomatoes', amount: '1 cup' },
      { name: 'Olive Oil', amount: '2 tbsp' },
      { name: 'Dried Oregano', amount: '1 tsp' }
    ],
    instructions: [
      'Preheat oven to 400°F (200°C).',
      'Chop all vegetables into bite-sized pieces.',
      'Toss with olive oil, oregano, salt, and pepper.',
      'Spread on a baking sheet in a single layer.',
      'Roast for 20-25 minutes until tender and slightly charred.'
    ],
    preparationTime: '30 mins',
    difficulty: 'Easy',
    calories: 180,
    dietaryTags: ['Vegan', 'Gluten Free', 'Seasonal'],
    imagePrompt: 'Colorful roasted vegetables on a baking sheet, vibrant Mediterranean style',
    rating: 4.7,
    servings: 4
  }
];

export default function App() {
  const { t, language, setLanguage } = useI18n();
  const [view, setView] = useState<'home' | 'recipes' | 'shopping' | 'meal-plan' | 'about' | 'saved' | 'pantry'>('home');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [pantry, setPantry] = useState<PantryItem[]>(() => {
    const saved = localStorage.getItem('pantry');
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    // Migration: if saved as string[], convert to PantryItem[]
    if (parsed.length > 0 && typeof parsed[0] === 'string') {
      return parsed.map((name: string) => ({ id: Math.random().toString(36).substr(2, 9), name }));
    }
    return parsed;
  });
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const saved = localStorage.getItem('recipes');
    return saved ? JSON.parse(saved) : [];
  });
  const [recentHistory, setRecentHistory] = useState<RecentRecipe[]>(() => {
    const saved = localStorage.getItem('recentHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isVoiceActive, setIsVoiceActive] = useState(true);
  const [previousPantry, setPreviousPantry] = useState<PantryItem[] | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('searchHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [mealPlan, setMealPlan] = useState<MealPlanType>(() => {
    const saved = localStorage.getItem('mealPlan');
    return saved ? JSON.parse(saved) : [];
  });
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => {
    const saved = localStorage.getItem('shoppingList');
    return saved ? JSON.parse(saved) : [];
  });
  const [savedRecipes, setSavedRecipes] = useState<string[]>(() => {
    const saved = localStorage.getItem('savedRecipes');
    return saved ? JSON.parse(saved) : [];
  });
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const saved = localStorage.getItem('onboardingDismissed');
    return saved ? !JSON.parse(saved) : true;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const topRatedRecipes = useMemo(() => {
    return [...recipes].sort((a, b) => b.rating - a.rating).slice(0, 3);
  }, [recipes]);

  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    
    const query = searchQuery.toLowerCase();
    const allSuggestions = new Set<string>();
    
    recipes.forEach(recipe => {
      if (recipe.title.toLowerCase().includes(query)) {
        allSuggestions.add(recipe.title);
      }
      recipe.ingredients.forEach(ing => {
        if (ing.name.toLowerCase().includes(query)) {
          allSuggestions.add(ing.name);
        }
      });
      recipe.dietaryTags.forEach(tag => {
        if (tag.toLowerCase().includes(query)) {
          allSuggestions.add(tag);
        }
      });
    });
    
    return Array.from(allSuggestions).slice(0, 5);
  }, [recipes, searchQuery]);

  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return recipes;
    
    const query = searchQuery.toLowerCase();
    return recipes.filter(recipe => 
      recipe.title.toLowerCase().includes(query) ||
      recipe.ingredients.some(ing => ing.name.toLowerCase().includes(query)) ||
      recipe.dietaryTags.some(tag => tag.toLowerCase().includes(query))
    );
  }, [recipes, searchQuery]);

  const voiceCommands = [
    { command: 'home', callback: () => setView('home') },
    { command: 'recipes', callback: () => setView('recipes') },
    { command: 'shopping list', callback: () => setView('shopping') },
    { command: 'meal plan', callback: () => setView('meal-plan') },
    { command: 'saved recipes', callback: () => setView('saved') },
    { command: 'show saved', callback: () => setView('saved') },
    { command: 'dark mode', callback: () => setIsDarkMode(true) },
    { command: 'light mode', callback: () => setIsDarkMode(false) },
    { command: 'toggle theme', callback: () => setIsDarkMode(prev => !prev) },
    { command: 'about', callback: () => setView('about') },
    { command: 'scanner', callback: () => setView('home') },
  ];

  const { isListening, error: voiceError, startListening, stopListening } = useVoiceCommands(voiceCommands, isVoiceActive && !selectedRecipe);

  const handleToggleVoice = () => {
    if (isVoiceActive && isListening) {
      stopListening();
      setIsVoiceActive(false);
    } else if (isVoiceActive && !isListening) {
      startListening();
    } else {
      setIsVoiceActive(true);
      startListening();
    }
  };

  useEffect(() => {
    localStorage.setItem('shoppingList', JSON.stringify(shoppingList));
  }, [shoppingList]);

  useEffect(() => {
    localStorage.setItem('mealPlan', JSON.stringify(mealPlan));
  }, [mealPlan]);

  useEffect(() => {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
  }, [searchHistory]);

  useEffect(() => {
    localStorage.setItem('savedRecipes', JSON.stringify(savedRecipes));
  }, [savedRecipes]);

  useEffect(() => {
    localStorage.setItem('recipes', JSON.stringify(recipes));
  }, [recipes]);

  useEffect(() => {
    localStorage.setItem('recentHistory', JSON.stringify(recentHistory));
  }, [recentHistory]);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    console.log('Theme changed:', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const query = searchQuery.trim();
      setSearchHistory(prev => {
        const filtered = prev.filter(h => h !== query);
        return [query, ...filtered].slice(0, 5);
      });
      setIsSearchFocused(false);
      if (view !== 'recipes') setView('recipes');
    }
  };

  const selectSuggestion = (query: string) => {
    setSearchQuery(query);
    setSearchHistory(prev => {
      const filtered = prev.filter(h => h !== query);
      return [query, ...filtered].slice(0, 5);
    });
    setIsSearchFocused(false);
    if (view !== 'recipes') setView('recipes');
  };

  const removeFromHistory = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    setSearchHistory(prev => prev.filter(h => h !== query));
  };

  const clearSearchHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory([]);
  };

  const toggleSaveRecipe = (e: React.MouseEvent, recipeId: string) => {
    e.stopPropagation();
    setSavedRecipes(prev => 
      prev.includes(recipeId) 
        ? prev.filter(id => id !== recipeId) 
        : [...prev, recipeId]
    );
  };

  useEffect(() => {
    localStorage.setItem('pantry', JSON.stringify(pantry));
  }, [pantry]);

  const handleScan = async (images: string[]) => {
    setIsAnalyzing(true);
    try {
      const detected = await analyzeFridgeImage(images[0], language);
      setPantry(prev => {
        const next = [...prev];
        detected.forEach(item => {
          if (!next.some(i => i.name.toLowerCase() === item.toLowerCase())) {
            next.push({ id: Math.random().toString(36).substr(2, 9), name: item });
          }
        });
        return next;
      });
      setView('pantry');
    } catch (error) {
      console.error("Scan failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addRecipesToCollection = useCallback((newRecipes: Recipe[]) => {
    setRecipes(prev => {
      const seen = new Set(newRecipes.map(r => r.id));
      return [...newRecipes, ...prev.filter(r => !seen.has(r.id))];
    });
  }, []);

  const handleGenerateFromPantry = async () => {
    setIsAnalyzing(true);
    try {
      const generated = await generateRecipes(pantry.map(i => i.name), activeFilters, language);
      addRecipesToCollection(generated);
      setView('recipes');
    } catch (error) {
      console.error("Recipe generation failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateMealPlan = async () => {
    setIsGeneratingPlan(true);
    try {
      const plan = await generateMealPlan(pantry.map(i => i.name), activeFilters, [], language);
      setMealPlan(plan);
      const allPlanRecipes: Recipe[] = [];
      plan.forEach(day => {
        allPlanRecipes.push(day.breakfast, day.lunch, day.dinner);
      });
      addRecipesToCollection(allPlanRecipes);
      setView('meal-plan');
    } catch (error) {
      console.error("Meal plan generation failed", error);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('onboardingDismissed', JSON.stringify(!showOnboarding));
  }, [showOnboarding]);

  const toggleFilter = (id: string) => {
    setActiveFilters(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const addToShoppingList = (name: string, amount: string) => {
    setShoppingList(prev => {
      const index = prev.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
      
      if (index !== -1) {
        const next = [...prev];
        const existing = next[index];
        
        // Try to merge amounts if units match
        const existingQty = parseQuantity(existing.amount);
        const newQty = parseQuantity(amount);
        
        if (existingQty.unit === newQty.unit && existingQty.unit !== '') {
          const mergedValue = existingQty.value + newQty.value;
          next[index] = { 
            ...existing, 
            amount: `${mergedValue} ${existingQty.unit}`.trim() 
          };
        } else {
          // If units don't match or are empty, just update to the latest amount
          // Or we could append them? "1 cup + 2 tbsp"
          next[index] = { ...existing, amount };
        }
        return next;
      }
      return [...prev, { id: Math.random().toString(36).substr(2, 9), name, amount, checked: false }];
    });
  };

  const toggleShoppingItem = (id: string) => {
    setShoppingList(prev => prev.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ));
  };

  const removeFromShoppingList = (id: string) => {
    setShoppingList(prev => prev.filter(i => i.id !== id));
  };

  useEffect(() => {
    if (showUndoToast) {
      const timer = setTimeout(() => {
        setShowUndoToast(false);
        setPreviousPantry(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showUndoToast]);

  const handleCooked = (updatedPantry: PantryItem[], recipe: Recipe) => {
    setPreviousPantry(pantry);
    setPantry(updatedPantry);
    setRecentHistory(prev => {
      const next = [{ recipe, cookedAt: Date.now() }, ...prev.filter(r => r.recipe.id !== recipe.id)];
      return next.slice(0, 10); // Keep last 10
    });
    setShowUndoToast(true);
  };

  const undoCooked = () => {
    if (previousPantry) {
      setPantry(previousPantry);
      setPreviousPantry(null);
      setShowUndoToast(false);
    }
  };

  const addLowStockToShoppingList = () => {
    const lowStockItems = pantry.filter(item => item.isLowStock);
    if (lowStockItems.length === 0) return;

    lowStockItems.forEach(item => {
      if (item.amount) {
        // For low stock, we might want to suggest a "refill" amount
        // For now, we'll just add the item with its current unit if possible
        const qty = parseQuantity(item.amount);
        // Suggesting a default refill amount based on unit
        let refillAmount = "1";
        if (qty.unit) {
          if (qty.unit === 'g') refillAmount = "500 g";
          else if (qty.unit === 'ml') refillAmount = "500 ml";
          else refillAmount = `1 ${qty.unit}`;
        }
        addToShoppingList(item.name, refillAmount);
      } else {
        addToShoppingList(item.name, "1 unit");
      }
    });
  };

  const allRecipes = useMemo(() => {
    // Deduplicate by ID
    const seen = new Set<string>();
    const combined = [...recipes, ...FEATURED_RECIPES];
    return combined.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [recipes]);

  const canMakeNowRecipes = useMemo(() => {
    return allRecipes.filter(r => getRecipePantryStatus(r, pantry).isCanMakeNow);
  }, [allRecipes, pantry]);

  const almostThereRecipes = useMemo(() => {
    return allRecipes.filter(r => getRecipePantryStatus(r, pantry).isAlmostThere);
  }, [allRecipes, pantry]);

  const cookWithSwapsRecipes = useMemo(() => {
    return allRecipes.filter(r => getRecipePantryStatus(r, pantry).isCookWithSwaps);
  }, [allRecipes, pantry]);

  const savedRecipesList = useMemo(() => {
    return allRecipes.filter(r => savedRecipes.includes(r.id));
  }, [allRecipes, savedRecipes]);

  if (selectedRecipe) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <RecipeDetail 
          recipe={selectedRecipe} 
          onBack={() => setSelectedRecipe(null)}
          onAddToShoppingList={addToShoppingList}
          onRemoveFromShoppingList={removeFromShoppingList}
          shoppingList={shoppingList}
          pantry={pantry}
          isVoiceActive={isVoiceActive}
          isSaved={savedRecipes.includes(selectedRecipe.id)}
          onToggleSave={(e) => toggleSaveRecipe(e, selectedRecipe.id)}
          onCooked={handleCooked}
        />
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`}>
      {/* Sidebar */}
      <aside className="w-72 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col hidden lg:flex transition-colors duration-300">
        <div className="p-8">
          <div className="flex items-center gap-4 mb-12 group cursor-default">
            <div className="relative">
              <div className="absolute inset-0 bg-orange-600/20 blur-xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-700 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-600/30 transform group-hover:rotate-6 transition-all duration-300">
                <ChefHat className="text-white w-7 h-7" />
              </div>
              <motion.div 
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center shadow-sm border border-zinc-100 dark:border-zinc-700 z-10"
              >
                <Sparkles className="w-2.5 h-2.5 text-orange-500" />
              </motion.div>
            </div>
            <div>
              <h1 className="text-2xl font-display font-black tracking-tighter flex flex-col -space-y-1.5">
                <span className="text-orange-600 leading-none">Meal</span>
                <span className="text-zinc-900 dark:text-white leading-none">Drive</span>
              </h1>
            </div>
          </div>

          <nav className="space-y-2 mb-12">
            <button 
              onClick={() => setView('home')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${view === 'home' ? 'bg-orange-50 dark:bg-orange-600/10 text-orange-600 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            >
              <ChefHat className="w-5 h-5" />
              <span>{t('common.dashboard')}</span>
            </button>
            <button 
              onClick={() => setView('pantry')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${view === 'pantry' ? 'bg-orange-50 dark:bg-orange-600/10 text-orange-600 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            >
              <Refrigerator className="w-5 h-5" />
              <span>{t('common.pantry')}</span>
              {pantry.length > 0 && (
                <span className="ml-auto bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {pantry.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setView('recipes')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${view === 'recipes' ? 'bg-orange-50 dark:bg-orange-600/10 text-orange-600 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            >
              <UtensilsCrossed className="w-5 h-5" />
              <span>{t('common.recipes')}</span>
            </button>
            <button 
              onClick={() => setView('meal-plan')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${view === 'meal-plan' ? 'bg-orange-50 dark:bg-orange-600/10 text-orange-600 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            >
              <Calendar className="w-5 h-5" />
              <span>{t('common.mealPlan')}</span>
            </button>
            <button 
              onClick={() => setView('saved')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${view === 'saved' ? 'bg-orange-50 dark:bg-orange-600/10 text-orange-600 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            >
              <Bookmark className="w-5 h-5" />
              <span>{t('common.saved')}</span>
              {savedRecipes.length > 0 && (
                <span className="ml-auto bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {savedRecipes.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setView('shopping')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${view === 'shopping' ? 'bg-orange-50 dark:bg-orange-600/10 text-orange-600 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            >
              <ShoppingBag className="w-5 h-5" />
              <span>{t('common.shopping')}</span>
              {shoppingList.length > 0 && (
                <span className="ml-auto bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {shoppingList.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setView('about')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${view === 'about' ? 'bg-orange-50 dark:bg-orange-600/10 text-orange-600 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            >
              <Info className="w-5 h-5" />
              <span>{t('common.about')}</span>
            </button>
          </nav>

          <div className="space-y-6">
            <div className="px-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">{t('common.language')}</p>
              <div className="flex gap-2">
                {[
                  { id: 'en', label: 'EN' },
                  { id: 'ja', label: 'JA' },
                  { id: 'ko', label: 'KO' },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => setLanguage(lang.id as any)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-bold transition-all ${language === lang.id ? 'bg-orange-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto p-6 space-y-4">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full flex items-center justify-between p-4 rounded-3xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-orange-600 text-white' : 'bg-zinc-200 text-zinc-600'}`}>
                {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-wider">{isDarkMode ? t('common.moon') || 'Dark Mode' : t('common.sun') || 'Light Mode'}</p>
                <p className="text-[10px] opacity-70">{t('common.switchTheme')}</p>
              </div>
            </div>
          </button>

          {voiceError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-[10px] text-red-600 font-medium leading-tight flex flex-col gap-2">
              <span>{voiceError}</span>
              <button 
                onClick={startListening}
                className="text-red-700 font-bold underline text-left"
              >
                {t('voice.tryAgain')}
              </button>
            </div>
          )}
          <button 
            onClick={handleToggleVoice}
            className={`w-full flex items-center justify-between p-4 rounded-3xl transition-all ${isVoiceActive ? 'bg-orange-50 dark:bg-orange-600/10 text-orange-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isVoiceActive ? 'bg-orange-600 text-white' : 'bg-zinc-200'}`}>
                {isVoiceActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-wider">{t('common.voiceControl')}</p>
                <p className="text-[10px] opacity-70">
                  {isVoiceActive ? (isListening ? t('common.listening') : t('recipes.clickToStartVoice')) : t('common.disabled')}
                </p>
              </div>
            </div>
            {isVoiceActive && isListening && (
              <div className="flex gap-0.5">
                {[1, 2, 3].map(i => (
                  <motion.div 
                    key={i}
                    animate={{ height: [4, 12, 4] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.2 }}
                    className="w-1 bg-orange-600 rounded-full"
                  />
                ))}
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto">
        <header className="sticky top-0 z-20 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-md px-6 lg:px-8 py-4 lg:py-6 flex items-center justify-between transition-colors duration-300 gap-4">
          <div className="flex items-center gap-3 lg:hidden shrink-0 cursor-pointer" onClick={() => setView('home')}>
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20">
              <ChefHat className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-display font-black tracking-tighter flex flex-col -space-y-1">
              <span className="text-orange-600 leading-none">Meal</span>
              <span className="text-zinc-900 dark:text-white leading-none text-[10px]">Drive</span>
            </h1>
          </div>

          <div className="relative w-full max-w-md flex-1 lg:flex-none">
            <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 px-4 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full shadow-sm focus-within:ring-2 focus-within:ring-orange-600/20 focus-within:border-orange-600 transition-all">
              <Search className="w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                onKeyDown={handleSearch}
                placeholder={t('common.searchRecipes')} 
                className="bg-transparent border-none outline-none text-sm w-full font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400"
              />
            </div>

            <AnimatePresence>
              {isSearchFocused && (searchHistory.length > 0 || suggestions.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-zinc-100 shadow-xl overflow-hidden z-30"
                >
                  <div className="p-2">
                    {suggestions.length > 0 && (
                      <>
                        <div className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t('common.suggestions')}</div>
                        {suggestions.map((suggestion, i) => (
                          <div 
                            key={`suggestion-${i}`}
                            onClick={() => selectSuggestion(suggestion)}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-orange-50 rounded-xl cursor-pointer group transition-colors"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                            <span className="text-sm text-zinc-600 font-medium">{suggestion}</span>
                          </div>
                        ))}
                        {searchHistory.length > 0 && <div className="my-2 border-t border-zinc-50" />}
                      </>
                    )}
                    
                    {searchHistory.length > 0 && (
                      <>
                        <div className="px-3 py-2 flex items-center justify-between">
                          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t('common.recentSearches')}</div>
                          <button 
                            onClick={clearSearchHistory}
                            className="text-[10px] font-bold text-orange-600 hover:text-orange-700 uppercase tracking-widest transition-colors"
                          >
                            {t('common.clearAll')}
                          </button>
                        </div>
                        {searchHistory.map((query, i) => (
                          <div 
                            key={`history-${i}`}
                            onClick={() => selectSuggestion(query)}
                            className="flex items-center justify-between px-3 py-2.5 hover:bg-zinc-50 rounded-xl cursor-pointer group transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <History className="w-3.5 h-3.5 text-zinc-400" />
                              <span className="text-sm text-zinc-600 font-medium">{query}</span>
                            </div>
                            <button 
                              onClick={(e) => removeFromHistory(e, query)}
                              className="p-1 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex items-center gap-4 lg:hidden">
             <button onClick={() => setView('pantry')} className="relative p-2 text-zinc-500">
               <Refrigerator className="w-6 h-6" />
               {pantry.length > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-orange-600 text-white text-[10px] rounded-full flex items-center justify-center">{pantry.length}</span>}
             </button>
             <button onClick={() => setView('shopping')} className="relative p-2 text-zinc-500">
               <ShoppingBag className="w-6 h-6" />
               {shoppingList.length > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-orange-600 text-white text-[10px] rounded-full flex items-center justify-center">{shoppingList.length}</span>}
             </button>
             <button 
               onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
               className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors"
             >
               {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Filter className="w-6 h-6" />}
             </button>
          </div>
        </header>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 overflow-hidden z-20 sticky top-[72px]"
            >
              <div className="p-4 grid grid-cols-2 gap-2">
                {[
                  { id: 'home', label: t('common.dashboard'), icon: ChefHat },
                  { id: 'pantry', label: t('common.pantry'), icon: Refrigerator },
                  { id: 'recipes', label: t('common.recipes'), icon: UtensilsCrossed },
                  { id: 'meal-plan', label: t('common.mealPlan'), icon: Calendar },
                  { id: 'saved', label: t('common.saved'), icon: Bookmark },
                  { id: 'shopping', label: t('common.shopping'), icon: ShoppingBag },
                  { id: 'about', label: t('common.about'), icon: Info },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setView(item.id as any);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === item.id ? 'bg-orange-50 dark:bg-orange-600/10 text-orange-600 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/50 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="flex items-center gap-2 text-zinc-500 text-xs font-bold"
                  >
                    {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    {isDarkMode ? t('common.dark') : t('common.light')}
                  </button>
                  <button 
                    onClick={handleToggleVoice}
                    className={`flex items-center gap-2 text-xs font-bold ${isVoiceActive ? 'text-orange-600' : 'text-zinc-400'}`}
                  >
                    {isVoiceActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    {t('common.voiceControl')} {isVoiceActive ? t('common.on') : t('common.off')}
                  </button>
                </div>
                <div className="flex gap-2">
                  {[
                    { id: 'en', label: 'EN' },
                    { id: 'ja', label: 'JA' },
                    { id: 'ko', label: 'KO' },
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => setLanguage(lang.id as any)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold transition-all ${language === lang.id ? 'bg-orange-600 text-white' : 'bg-white dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-800'}`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="px-8 pb-20">
          <AnimatePresence mode="wait">
            {view === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto pt-12"
              >
                <div className="text-center mb-12">
                  <h2 className="text-5xl font-display font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
                    {t('common.welcome')}
                  </h2>
                  <p className="text-zinc-500 dark:text-zinc-400 text-lg max-w-xl mx-auto">
                    {t('onboarding.subtitle')}
                  </p>
                </div>
                
                <AnimatePresence>
                  {showOnboarding && (
                    <OnboardingCard 
                      onDismiss={() => setShowOnboarding(false)} 
                      onAction={(v) => {
                        setView(v as any);
                        setShowOnboarding(false);
                      }} 
                    />
                  )}
                </AnimatePresence>

                <IngredientScanner onScan={handleScan} isAnalyzing={isAnalyzing} />

                <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
                  <button 
                    onClick={() => setView('pantry')}
                    className="flex items-center gap-3 px-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-orange-600 transition-all group"
                  >
                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-600/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{t('common.addManually')}</p>
                      <p className="text-[10px] text-zinc-500">{t('common.typeIngredients')}</p>
                    </div>
                  </button>
                  <button 
                    onClick={handleGenerateFromPantry}
                    className="flex items-center gap-3 px-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-orange-600 transition-all group"
                  >
                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-600/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Sparkles className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{t('common.aiRecipes')}</p>
                      <p className="text-[10px] text-zinc-500">{t('common.fromYourStock')}</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => setView('meal-plan')}
                    className="flex items-center gap-3 px-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-orange-600 transition-all group"
                  >
                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-600/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Calendar className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{t('common.mealPlan')}</p>
                      <p className="text-[10px] text-zinc-500">{t('common.organizeWeek')}</p>
                    </div>
                  </button>
                </div>

                <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    { title: t('common.smartDetection'), desc: t('common.smartDetectionDesc'), icon: Sparkles },
                    { title: t('common.zeroWaste'), desc: t('common.zeroWasteDesc'), icon: ChefHat },
                    { title: t('common.voiceGuided'), desc: t('common.voiceGuidedDesc'), icon: Zap }
                  ].map((feature, i) => (
                    <div key={i} className="bg-white p-8 rounded-[32px] border border-zinc-100 shadow-sm">
                      <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mb-6">
                        <feature.icon className="w-6 h-6 text-orange-600" />
                      </div>
                      <h4 className="font-display font-bold text-zinc-900 mb-2">{feature.title}</h4>
                      <p className="text-zinc-500 text-sm leading-relaxed">{feature.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-24">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">{t('dashboard.topRated')}</h3>
                      <p className="text-zinc-500 dark:text-zinc-400">{t('dashboard.popularChoices')}</p>
                    </div>
                    <button 
                      onClick={() => setView('recipes')}
                      className="text-orange-600 font-bold text-sm hover:text-orange-700 transition-colors flex items-center gap-1 group"
                    >
                      {t('common.findRecipes')}
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {FEATURED_RECIPES.map((recipe) => (
                      <RecipeCard 
                        key={recipe.id} 
                        recipe={recipe} 
                        onClick={() => setSelectedRecipe(recipe)} 
                        isSaved={savedRecipes.includes(recipe.id)}
                        onToggleSave={(e) => toggleSaveRecipe(e, recipe.id)}
                      />
                    ))}
                  </div>
                </div>

                {/* Can Make Now */}
                {(canMakeNowRecipes.length > 0 || cookWithSwapsRecipes.length > 0) ? (
                  <div className="mt-24">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">{t('dashboard.readyToCookTitle')}</h3>
                        <p className="text-zinc-500 dark:text-zinc-400">{t('dashboard.readyToCookSubtitle')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {canMakeNowRecipes.slice(0, 3).map((recipe) => (
                        <RecipeCard 
                          key={recipe.id} 
                          recipe={recipe} 
                          onClick={() => setSelectedRecipe(recipe)} 
                          isSaved={savedRecipes.includes(recipe.id)}
                          onToggleSave={(e) => toggleSaveRecipe(e, recipe.id)}
                          statusLabel={t('common.readyToCook')}
                        />
                      ))}
                      {cookWithSwapsRecipes.slice(0, Math.max(0, 3 - canMakeNowRecipes.length)).map((recipe) => {
                        const status = getRecipePantryStatus(recipe, pantry);
                        return (
                          <RecipeCard 
                            key={recipe.id} 
                            recipe={recipe} 
                            onClick={() => setSelectedRecipe(recipe)} 
                            isSaved={savedRecipes.includes(recipe.id)}
                            onToggleSave={(e) => toggleSaveRecipe(e, recipe.id)}
                            statusLabel={t('dashboard.rescueMsg')}
                            rescueMessage={status.rescueMessage}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : pantry.length > 0 && (
                  <div className="mt-24 p-12 bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-100 dark:border-zinc-800 text-center">
                    <div className="w-16 h-16 bg-orange-50 dark:bg-orange-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <Sparkles className="w-8 h-8 text-orange-600" />
                    </div>
                    <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-white mb-2">{t('dashboard.noRecipesReady')}</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mb-8">{t('dashboard.noRecipesAlmost')}</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                      <button 
                        onClick={() => setView('pantry')}
                        className="px-6 py-3 bg-zinc-900 dark:bg-zinc-800 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all"
                      >
                        {t('common.pantry')}
                      </button>
                      <button 
                        onClick={handleGenerateFromPantry}
                        className="px-6 py-3 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20"
                      >
                        {t('common.findRecipes')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Almost There */}
                {almostThereRecipes.length > 0 ? (
                  <div className="mt-24">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">{t('dashboard.almostThereTitle')}</h3>
                        <p className="text-zinc-500 dark:text-zinc-400">{t('dashboard.almostThereSubtitle')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {almostThereRecipes.slice(0, 3).map((recipe) => {
                        const status = getRecipePantryStatus(recipe, pantry);
                        const label = `${t('common.missing')} ${status.missingCount + status.partialCount}`;
                        return (
                          <RecipeCard 
                            key={recipe.id} 
                            recipe={recipe} 
                            onClick={() => setSelectedRecipe(recipe)} 
                            isSaved={savedRecipes.includes(recipe.id)}
                            onToggleSave={(e) => toggleSaveRecipe(e, recipe.id)}
                            statusLabel={label}
                            rescueMessage={status.rescueMessage}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : pantry.length > 0 && recipes.length > 0 && (
                   <div className="mt-24 p-8 bg-zinc-50 dark:bg-zinc-900/50 rounded-[32px] border-2 border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                     <p className="text-zinc-500 dark:text-zinc-400 font-medium italic">{t('common.keepAdding')}</p>
                   </div>
                )}

                {/* Saved Recipes */}
                {savedRecipesList.length > 0 && (
                  <div className="mt-24">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">{t('common.favorites')}</h3>
                        <p className="text-zinc-500 dark:text-zinc-400">{t('dashboard.popularChoices')}</p>
                      </div>
                      <button onClick={() => setView('saved')} className="text-orange-600 font-bold text-sm hover:text-orange-700 transition-colors flex items-center gap-1 group">
                        {t('common.findRecipes')} <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {savedRecipesList.slice(0, 3).map((recipe) => (
                        <RecipeCard 
                          key={recipe.id} 
                          recipe={recipe} 
                          onClick={() => setSelectedRecipe(recipe)} 
                          isSaved={true}
                          onToggleSave={(e) => toggleSaveRecipe(e, recipe.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Recently Cooked */}
                {recentHistory.length > 0 && (
                  <div className="mt-24">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">{t('dashboard.cookedRecently')}</h3>
                        <p className="text-zinc-500 dark:text-zinc-400">{t('dashboard.revisitMeals')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {recentHistory.slice(0, 3).map(({ recipe, cookedAt }) => (
                        <RecipeCard 
                          key={`${recipe.id}-${cookedAt}`} 
                          recipe={recipe} 
                          onClick={() => setSelectedRecipe(recipe)} 
                          isSaved={savedRecipes.includes(recipe.id)}
                          onToggleSave={(e) => toggleSaveRecipe(e, recipe.id)}
                          cookedAt={cookedAt}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {view === 'pantry' && (
            <Pantry 
              pantry={pantry}
              onAdd={(item) => setPantry(prev => {
                const index = prev.findIndex(i => i.name.toLowerCase() === item.name.toLowerCase());
                if (index !== -1) {
                  const next = [...prev];
                  next[index] = { ...next[index], amount: item.amount, isLowStock: false };
                  return next;
                }
                return [...prev, item];
              })}
              onRemove={(id) => setPantry(prev => prev.filter(i => i.id !== id))}
              onClear={() => setPantry([])}
              onGenerateRecipes={handleGenerateFromPantry}
              onAddLowStockToShopping={addLowStockToShoppingList}
              onViewChange={setView}
              isGenerating={isAnalyzing}
            />
          )}

          {view === 'recipes' && (
              <motion.div 
                key="recipes"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
                  <div>
                    <h2 className="text-3xl font-display font-bold text-zinc-900 dark:text-white">{t('recipes.title')}</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">{t('recipes.subtitle', { count: ingredients.length })}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl mr-4">
                      {DIETARY_FILTERS.map(filter => (
                        <button 
                          key={filter.id}
                          onClick={() => toggleFilter(filter.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${activeFilters.includes(filter.id) ? 'bg-orange-600 text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                        >
                          {t(`filters.${filter.id.replace('-f', 'F')}`)}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      {ingredients.slice(0, 3).map(ing => (
                        <span key={ing} className="px-3 py-1 bg-orange-100 dark:bg-orange-600/10 text-orange-700 dark:text-orange-400 rounded-full text-xs font-bold uppercase tracking-wider">
                          {ing}
                        </span>
                      ))}
                      {ingredients.length > 3 && <span className="text-zinc-400 text-xs font-bold self-center">+{ingredients.length - 3} {t('common.more')}</span>}
                    </div>
                  </div>
                </div>

                {filteredRecipes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {filteredRecipes.map((recipe) => (
                      <RecipeCard 
                        key={recipe.id} 
                        recipe={recipe} 
                        onClick={() => setSelectedRecipe(recipe)} 
                        isSaved={savedRecipes.includes(recipe.id)}
                        onToggleSave={(e) => toggleSaveRecipe(e, recipe.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-40">
                    <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Search className="w-10 h-10 text-zinc-300" />
                    </div>
                    <h3 className="text-2xl font-display font-bold text-zinc-900 mb-2">{t('recipes.noRecipes')}</h3>
                    <p className="text-zinc-500 mb-8">{t('recipes.noRecipesDesc')}</p>
                    <button 
                      onClick={() => setView('home')}
                      className="px-8 py-4 bg-orange-600 text-white rounded-2xl font-bold hover:bg-orange-500 transition-all shadow-lg shadow-orange-600/20"
                    >
                      {t('common.scanFridge')}
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {view === 'meal-plan' && (
              <motion.div 
                key="meal-plan"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <MealPlan 
                  plan={mealPlan}
                  ingredients={pantry.map(i => i.name)}
                  dietaryRestrictions={activeFilters}
                  onSave={(plan) => {
                    setMealPlan(plan);
                    const allPlanRecipes: Recipe[] = [];
                    plan.forEach(day => {
                      allPlanRecipes.push(day.breakfast, day.lunch, day.dinner);
                    });
                    addRecipesToCollection(allPlanRecipes);
                  }}
                  onSelectRecipe={(recipe) => {
                    addRecipesToCollection([recipe]);
                    setSelectedRecipe(recipe);
                  }}
                  isGenerating={isGeneratingPlan}
                  onGenerate={handleGenerateMealPlan}
                />
              </motion.div>
            )}

            {view === 'saved' && (
              <motion.div 
                key="saved"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mb-10">
                  <h2 className="text-3xl font-display font-bold text-zinc-900 dark:text-white">{t('common.saved')}</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mt-1">{t('dashboard.popularChoices')}</p>
                </div>

                {savedRecipesList.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {savedRecipesList.map((recipe) => (
                      <RecipeCard 
                        key={recipe.id} 
                        recipe={recipe} 
                        onClick={() => setSelectedRecipe(recipe)} 
                        isSaved={true}
                        onToggleSave={(e) => toggleSaveRecipe(e, recipe.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-40">
                    <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Bookmark className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
                    </div>
                    <h3 className="text-xl font-display font-bold text-zinc-900 dark:text-white mb-2">{t('saved.emptyTitle') || 'No saved recipes yet'}</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mb-8">{t('saved.emptyDesc') || 'Click the bookmark icon on any recipe to save it for later.'}</p>
                    <button 
                      onClick={() => setView('home')}
                      className="px-8 py-3 bg-zinc-900 dark:bg-orange-600 text-white rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-orange-500 transition-all"
                    >
                      {t('common.findRecipes')}
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {view === 'shopping' && (
              <motion.div 
                key="shopping"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-2xl mx-auto"
              >
                <ShoppingList 
                  items={shoppingList} 
                  onRemove={removeFromShoppingList}
                  onToggle={toggleShoppingItem}
                  onClear={() => setShoppingList([])}
                />
              </motion.div>
            )}

            {view === 'about' && (
              <motion.div 
                key="about"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-3xl mx-auto pt-12"
              >
                <div className="bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                  <div className="p-12">
                    <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/20 mb-8">
                      <ChefHat className="text-white w-8 h-8" />
                    </div>
                    <h2 className="text-4xl font-display font-bold text-zinc-900 dark:text-white mb-6 tracking-tight">{t('about.title')}</h2>
                    <p className="text-zinc-600 dark:text-zinc-400 text-lg leading-relaxed mb-8">
                      {t('about.subtitle')} {t('about.philosophy1')}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                      <div className="space-y-4">
                        <h4 className="font-display font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-orange-600" />
                          {t('onboarding.step1Title')}
                        </h4>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                          {t('onboarding.step1Desc')}
                        </p>
                      </div>
                      <div className="space-y-4">
                        <h4 className="font-display font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                          <Zap className="w-5 h-5 text-orange-600" />
                          {t('voice.error') || 'Voice Control'}
                        </h4>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                          {t('about.pantryFirstDesc')}
                        </p>
                      </div>
                    </div>

                    <div className="p-8 bg-zinc-50 dark:bg-zinc-950 rounded-[32px] border border-zinc-100 dark:border-zinc-800">
                      <h4 className="font-display font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                        <Github className="w-5 h-5" />
                        {t('about.openSourceTitle')}
                      </h4>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed mb-6">
                        {t('about.openSourceDesc')}
                      </p>
                      <a 
                        href="https://github.com/ColinGamez/MealDrive" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-orange-600 text-white rounded-2xl font-bold hover:bg-zinc-800 dark:hover:bg-orange-500 transition-all shadow-lg shadow-zinc-900/20"
                      >
                        <Github className="w-4 h-4" />
                        {t('about.viewOnGithub')}
                      </a>
                    </div>
                  </div>
                  
                  <div className="bg-orange-600 p-8 text-white text-center">
                    <p className="text-sm font-medium opacity-90">{t('about.madeWithLove')}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      {/* Undo Toast */}
      <AnimatePresence>
        {showUndoToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-[100] bg-zinc-900 dark:bg-zinc-800 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10 min-w-[320px]"
          >
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">{t('toast.pantryUpdated')}</p>
              <p className="text-[10px] opacity-70">{t('toast.deductedDesc')}</p>
            </div>
            <button 
              onClick={undoCooked}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all border border-white/10"
            >
              {t('common.undo')}
            </button>
            <button 
              onClick={() => setShowUndoToast(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-all"
            >
              <X className="w-4 h-4 opacity-50" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
