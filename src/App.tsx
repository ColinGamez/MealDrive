import React, { lazy, Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ChefHat,
  Refrigerator,
  ShoppingBag,
  Menu,
  Search,
  Sparkles,
  Calendar,
  Mic,
  MicOff,
  Info,
  History,
  X,
  Bookmark,
  Sun,
  Moon,
  RotateCcw,
  AlertCircle,
  UtensilsCrossed,
  LayoutDashboard,
  UserRound,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Recipe,
  MealPlan as MealPlanType,
  ShoppingItem,
  PantryItem,
  RecentRecipe,
  UserProfile,
  UserStats,
  View,
  Language,
} from './types';
import { analyzeFridgeImage, generateRecipes, generateMealPlan } from './services/gemini';
import { parseQuantity, getRecipePantryStatus } from './lib/ingredientUtils';
import { addItemToList } from './lib/shoppingUtils';
import { calculateCookingStats } from './lib/progressionUtils';
import { getPantryGenerationContext, mergePantryItems } from './lib/pantryUtils';
import { HomeView } from './views/HomeView';
import { RecipesView } from './views/RecipesView';
import { SavedView } from './views/SavedView';
import { useVoiceCommands, VoiceCommand } from './hooks/useVoiceCommands';
import { newId } from './lib/id';
import { STORAGE_KEYS, useLocalStorageState } from './lib/storage';
import { getFeaturedRecipes } from './i18n/featuredRecipes';

import { useI18n } from './i18n/I18nContext';

const RecipeDetail = lazy(() => import('./components/RecipeDetail').then((module) => ({ default: module.RecipeDetail })));
const Profile = lazy(() => import('./components/Profile').then((module) => ({ default: module.Profile })));
const ProfileEdit = lazy(() => import('./components/ProfileEdit').then((module) => ({ default: module.ProfileEdit })));
const ShoppingList = lazy(() => import('./components/ShoppingList').then((module) => ({ default: module.ShoppingList })));
const MealPlan = lazy(() => import('./components/MealPlan').then((module) => ({ default: module.MealPlan })));
const Pantry = lazy(() => import('./components/Pantry').then((module) => ({ default: module.Pantry })));
const AboutView = lazy(() => import('./components/AboutView').then((module) => ({ default: module.AboutView })));

const ViewLoading = ({ label }: { label: string }) => (
  <div className="flex min-h-[45vh] items-center justify-center" role="status" aria-live="polite">
    <div className="flex items-center gap-3 text-sm font-bold text-zinc-500 dark:text-zinc-400">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-200 border-t-food-orange" />
      {label}
    </div>
  </div>
);

const VIEW_LABEL_KEYS: Record<View, string> = {
  home: 'common.dashboard',
  recipes: 'common.recipes',
  shopping: 'common.shopping',
  'meal-plan': 'common.mealPlan',
  about: 'common.about',
  saved: 'common.saved',
  pantry: 'common.pantry',
  profile: 'common.profile',
};

const DEFAULT_PROFILE: UserProfile = {
  displayName: 'Chef',
  emojiAvatar: '👨‍🍳',
  preferredLanguage: 'en',
  dietaryPreferences: [],
  favoriteCuisines: [],
  cookingStyle: 'Quick Meals',
};

const DEFAULT_STATS: UserStats = {
  totalCooked: 0,
  weeklyCooked: 0,
  streak: 0,
  longestStreak: 0,
  scansCompleted: 0,
  rescueCount: 0,
  mealPlansCreated: 0,
  shoppingListUses: 0,
};

export default function App() {
  const { t, language, locale, setLanguage } = useI18n();
  const [view, setView] = useState<View>('home');
  const mainRef = useRef<HTMLElement>(null);
  // Move focus to the main content when the view changes so screen-reader and
  // keyboard users land at the top of the new view instead of staying on a
  // sidebar button. We intentionally only run on `view` changes (not initial mount).
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: false });
  }, [view]);
  const [isDarkMode, setIsDarkMode] = useLocalStorageState<boolean>(
    STORAGE_KEYS.darkMode,
    false,
  );
  const [userProfile, setUserProfile] = useLocalStorageState<UserProfile>(
    STORAGE_KEYS.userProfile,
    DEFAULT_PROFILE,
  );
  const [userStats, setUserStats] = useLocalStorageState<UserStats>(
    STORAGE_KEYS.userStats,
    DEFAULT_STATS,
  );
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [pantry, setPantry] = useLocalStorageState<PantryItem[]>(STORAGE_KEYS.pantry, () => []);
  const [recipes, setRecipes] = useLocalStorageState<Recipe[]>(STORAGE_KEYS.recipes, []);
  const [recentHistory, setRecentHistory] = useLocalStorageState<RecentRecipe[]>(
    STORAGE_KEYS.recentHistory,
    [],
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isVoiceActive, setIsVoiceActive] = useState(true);
  const [previousPantry, setPreviousPantry] = useState<PantryItem[] | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useLocalStorageState<string[]>(
    STORAGE_KEYS.searchHistory,
    [],
  );
  const [mealPlan, setMealPlan] = useLocalStorageState<MealPlanType>(
    STORAGE_KEYS.mealPlan,
    [],
  );
  const [mealPlanLanguage, setMealPlanLanguage] = useLocalStorageState<Language | null>(
    STORAGE_KEYS.mealPlanLanguage,
    null,
  );
  const [shoppingList, setShoppingList] = useLocalStorageState<ShoppingItem[]>(
    STORAGE_KEYS.shoppingList,
    [],
  );
  const [savedRecipes, setSavedRecipes] = useLocalStorageState<string[]>(
    STORAGE_KEYS.savedRecipes,
    [],
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Migrate legacy pantry shape (string[] from very old versions) to PantryItem[].
  useEffect(() => {
    if (pantry.length > 0 && typeof (pantry as unknown as unknown[])[0] === 'string') {
      const upgraded: PantryItem[] = (pantry as unknown as string[]).map((name) => ({
        id: newId(),
        name,
      }));
      setPantry(upgraded);
    }
    // Run once on mount; subsequent pantry changes are well-typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const FEATURED_RECIPES = useMemo(() => getFeaturedRecipes(language), [language]);

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

  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const voiceCommands = useMemo<VoiceCommand[]>(
    () => [
      { command: t('voiceCommands.home'), callback: () => setView('home') },
      { command: t('voiceCommands.recipes'), callback: () => setView('recipes') },
      { command: t('voiceCommands.shoppingList'), callback: () => setView('shopping') },
      { command: t('voiceCommands.mealPlan'), callback: () => setView('meal-plan') },
      { command: t('voiceCommands.savedRecipes'), callback: () => setView('saved') },
      { command: t('voiceCommands.showSaved'), callback: () => setView('saved') },
      { command: t('voiceCommands.darkMode'), callback: () => setIsDarkMode(true) },
      { command: t('voiceCommands.lightMode'), callback: () => setIsDarkMode(false) },
      { command: t('voiceCommands.toggleTheme'), callback: () => setIsDarkMode((prev) => !prev) },
      { command: t('voiceCommands.about'), callback: () => setView('about') },
      { command: t('voiceCommands.scanner'), callback: () => setView('home') },
      { command: t('voiceCommands.profile'), callback: () => setView('profile') },
      { command: t('voiceCommands.myProfile'), callback: () => setView('profile') },
    ],
    [t, setIsDarkMode],
  );

  const { isListening, error: voiceError, startListening, stopListening } =
    useVoiceCommands(voiceCommands, isVoiceActive && !selectedRecipe, { lang: locale });

  // Single source of truth for the primary nav. Used by the desktop sidebar
  // (with badges) and the mobile dropdown menu.
  const navItems = useMemo(
    () => [
      { id: 'home' as View, label: t('common.dashboard'), icon: ChefHat },
      { id: 'profile' as View, label: t('common.profile'), icon: History },
      { id: 'pantry' as View, label: t('common.pantry'), icon: Refrigerator },
      { id: 'recipes' as View, label: t('common.recipes'), icon: UtensilsCrossed },
      { id: 'meal-plan' as View, label: t('common.mealPlan'), icon: Calendar },
      { id: 'saved' as View, label: t('common.saved'), icon: Bookmark },
      { id: 'shopping' as View, label: t('common.shopping'), icon: ShoppingBag },
      { id: 'about' as View, label: t('common.about'), icon: Info },
    ],
    [t],
  );

  const navBadgeFor = (id: View): number | null => {
    if (id === 'pantry' && pantry.length > 0) return pantry.length;
    if (id === 'saved' && savedRecipes.length > 0) return savedRecipes.length;
    if (id === 'shopping' && shoppingList.length > 0) return shoppingList.length;
    return null;
  };

  const voiceErrorMessage = useMemo(() => {
    if (!voiceError) return null;
    if (voiceError.code === 'denied') return t('voice.errorDenied');
    if (voiceError.code === 'unsupported') return t('voice.errorUnsupported');
    return t('voice.errorGeneric', { detail: voiceError.detail ?? '' });
  }, [voiceError, t]);

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

  // Persistence for the slices above is handled by useLocalStorageState.
  // The only side-effect we still need here is keeping the document classes
  // in sync with the dark-mode flag.
  useEffect(() => {
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

  const handleScan = async (images: string[]) => {
    setIsAnalyzing(true);
    setUserStats((prev) => ({ ...prev, scansCompleted: prev.scansCompleted + 1 }));
    try {
      const detected = await analyzeFridgeImage(images[0], language);
      setPantry((prev) => mergePantryItems(
        prev,
        detected.map((name) => ({ id: newId(), name })),
      ));
      setView('pantry');
    } catch (error) {
      console.error('Scan failed', error);
      setErrorToast(t('toast.scanFailed'));
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
      const pantryContext = getPantryGenerationContext(pantry);
      const generated = await generateRecipes(
        pantryContext.ingredients,
        activeFilters,
        language,
        pantryContext.priorityIngredients,
      );
      addRecipesToCollection(generated);
      setView('recipes');
    } catch (error) {
      console.error("Recipe generation failed", error);
      setErrorToast(t('toast.generateFailed'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateMealPlan = async () => {
    setIsGeneratingPlan(true);
    try {
      const pantryContext = getPantryGenerationContext(pantry);
      const plan = await generateMealPlan(
        pantryContext.ingredients,
        activeFilters,
        [],
        language,
        pantryContext.priorityIngredients,
      );
      setMealPlan(plan);
      setMealPlanLanguage(language);
      setUserStats(prev => ({ ...prev, mealPlansCreated: prev.mealPlansCreated + 1 }));
      const allPlanRecipes: Recipe[] = [];
      plan.forEach(day => {
        allPlanRecipes.push(day.breakfast, day.lunch, day.dinner);
      });
      addRecipesToCollection(allPlanRecipes);
      setView('meal-plan');
    } catch (error) {
      console.error("Meal plan generation failed", error);
      setErrorToast(t('toast.planFailed'));
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const toggleFilter = (id: string) => {
    setActiveFilters(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const addToShoppingList = (name: string, amount: string) => {
    setShoppingList(prev => addItemToList(prev, name, amount, newId));
  };

  const toggleShoppingItem = (id: string) => {
    let didCheck = false;
    setShoppingList((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      );
      const item = next.find((i) => i.id === id);
      didCheck = !!item?.checked;
      return next;
    });
    if (didCheck) {
      setUserStats((s) => ({ ...s, shoppingListUses: s.shoppingListUses + 1 }));
    }
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

  useEffect(() => {
    if (!errorToast) return;
    const timer = setTimeout(() => setErrorToast(null), 5000);
    return () => clearTimeout(timer);
  }, [errorToast]);

  const handleCooked = (updatedPantry: PantryItem[], recipe: Recipe) => {
    const isRescue = getRecipePantryStatus(recipe, pantry).isCookWithSwaps;
    const nextHistory = [
      { recipe, cookedAt: Date.now() },
      ...recentHistory.filter((r) => r.recipe.id !== recipe.id),
    ].slice(0, 50);

    // Each setState is its own update — no setState inside another setState
    // (which would double-fire under React Strict Mode and inflate stats).
    setPreviousPantry(pantry);
    setPantry(updatedPantry);
    setRecentHistory(nextHistory);
    setUserStats((current) => {
      const updated = calculateCookingStats(nextHistory, current);
      if (isRescue) {
        updated.rescueCount = current.rescueCount + 1;
      }
      return updated;
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
  }, [recipes, FEATURED_RECIPES]);

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
        <Suspense fallback={<ViewLoading label={t('common.loading')} />}>
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
        </Suspense>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen bg-white dark:bg-zinc-950 font-sans transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`}>
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex-col hidden lg:flex transition-colors duration-300">
        <div className="p-6">
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
            <h1 className="font-display text-xl font-black tracking-[-0.05em]">
              <span className="text-food-orange">Meal</span>
              <span className="text-zinc-950 dark:text-white">Drive</span>
            </h1>
          </div>

          <nav className="space-y-1.5 mb-10" aria-label={t('common.navigationMenu')}>
            {navItems.map((item) => {
              const badge = navBadgeFor(item.id);
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setView(item.id)}
                  aria-current={view === item.id ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${view === item.id ? 'bg-orange-50 dark:bg-orange-600/10 text-orange-600 font-bold' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                  {badge !== null && (
                    <span className="ml-auto bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="space-y-6">
            <div className="px-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">{t('common.language')}</p>
              <div className="flex gap-2">
                {([
                  { id: 'en', label: 'EN' },
                  { id: 'ja', label: 'JA' },
                  { id: 'ko', label: 'KO' },
                ] as const).map((lang) => (
                  <button
                    type="button"
                    key={lang.id}
                    onClick={() => setLanguage(lang.id)}
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
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="w-full flex items-center justify-between p-4 rounded-3xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-orange-600 text-white' : 'bg-zinc-200 text-zinc-600'}`}>
                {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold uppercase tracking-wider">{isDarkMode ? t('common.dark') : t('common.light')}</p>
                <p className="text-[10px] opacity-70">{t('common.switchTheme')}</p>
              </div>
            </div>
          </button>

          {voiceErrorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-2xl text-[10px] text-red-600 font-medium leading-tight flex flex-col gap-2">
              <span>{voiceErrorMessage}</span>
              <button
                type="button"
                onClick={startListening}
                className="text-red-700 font-bold underline text-left"
              >
                {t('voice.tryAgain')}
              </button>
            </div>
          )}
          <button
            type="button"
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

      {isEditingProfile && (
        <Suspense fallback={null}>
          <ProfileEdit
            profile={userProfile}
            onSave={(updated) => {
              setUserProfile(updated);
              setIsEditingProfile(false);
            }}
            onCancel={() => setIsEditingProfile(false)}
          />
        </Suspense>
      )}

      {/* Main Content */}
      <main
        ref={mainRef}
        tabIndex={-1}
        aria-label={t(VIEW_LABEL_KEYS[view])}
        className="flex-1 h-screen overflow-x-hidden overflow-y-auto focus:outline-none pb-20 lg:pb-0"
      >
        <header className="sticky top-0 z-20 border-b border-zinc-100 bg-white/90 dark:border-zinc-900 dark:bg-zinc-950/90 backdrop-blur-xl px-4 sm:px-6 lg:px-8 py-3 lg:py-5 transition-colors duration-300">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-4 lg:hidden">
              <button
                type="button"
                onClick={() => {
                  setView('home');
                  setIsMobileMenuOpen(false);
                }}
                aria-label={t('common.dashboard')}
                className="flex min-w-0 items-center gap-3 shrink-0"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl flex items-center justify-center shadow-lg shadow-orange-600/20">
                  <ChefHat className="text-white w-6 h-6" />
                </div>
                <h1 className="font-display text-lg font-black tracking-[-0.05em] text-left">
                  <span className="text-food-orange">Meal</span>
                  <span className="text-zinc-950 dark:text-white">Drive</span>
                </h1>
              </button>

                <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setView('profile');
                    setIsMobileMenuOpen(false);
                  }}
                  aria-label={t('common.profile')}
                  className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors"
                >
                  <span className="text-xl" aria-hidden="true">{userProfile.emojiAvatar}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  aria-label={isMobileMenuOpen ? t('common.closeMenu') : t('common.navigationMenu')}
                  className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors"
                >
                  {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            </div>

            <div className="relative w-full min-w-0 lg:max-w-md lg:flex-1 lg:flex-none">
              <label htmlFor="recipe-search" className="sr-only">{t('common.searchRecipes')}</label>
              <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 px-4 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full shadow-sm focus-within:ring-2 focus-within:ring-orange-600/20 focus-within:border-orange-600 transition-all">
                <Search className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  id="recipe-search"
                  name="recipeSearch"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  onKeyDown={handleSearch}
                  placeholder={t('common.searchRecipes')}
                  autoComplete="off"
                  aria-label={t('common.searchRecipes')}
                  className="min-w-0 bg-transparent border-none outline-none text-sm w-full font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400"
                />
              </div>

              <AnimatePresence>
                {isSearchFocused && (searchHistory.length > 0 || suggestions.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-xl overflow-hidden z-30"
                  >
                    <div className="p-2">
                      {suggestions.length > 0 && (
                        <>
                          <div className="px-3 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t('common.suggestions')}</div>
                          {suggestions.map((suggestion, i) => (
                            <button
                              type="button"
                              key={`suggestion-${i}`}
                              onClick={() => selectSuggestion(suggestion)}
                              className="flex w-full items-center gap-3 px-3 py-2.5 hover:bg-orange-50 dark:hover:bg-zinc-800 rounded-xl group transition-colors text-left"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                              <span className="text-sm text-zinc-600 dark:text-zinc-300 font-medium">{suggestion}</span>
                            </button>
                          ))}
                          {searchHistory.length > 0 && <div className="my-2 border-t border-zinc-50 dark:border-zinc-800" />}
                        </>
                      )}

                      {searchHistory.length > 0 && (
                        <>
                          <div className="px-3 py-2 flex items-center justify-between">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t('common.recentSearches')}</div>
                            <button
                              type="button"
                              onClick={clearSearchHistory}
                              className="text-[10px] font-bold text-orange-600 hover:text-orange-700 uppercase tracking-widest transition-colors"
                            >
                              {t('common.clearAll')}
                            </button>
                          </div>
                          {searchHistory.map((query, i) => (
                            <div
                              key={`history-${i}`}
                              className="flex items-center justify-between gap-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 group transition-colors"
                            >
                              <button
                                type="button"
                                onClick={() => selectSuggestion(query)}
                                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
                              >
                                <History className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                <span className="text-sm text-zinc-600 dark:text-zinc-300 font-medium truncate">{query}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => removeFromHistory(e, query)}
                                aria-label={t('common.remove')}
                                className="p-1 mr-2 text-zinc-300 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
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

            <div className="hidden lg:flex items-center gap-4">
              <button
                type="button"
                onClick={() => setView('profile')}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
              >
                <span className="text-xl" aria-hidden="true">{userProfile.emojiAvatar}</span>
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{userProfile.displayName}</span>
              </button>
            </div>
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
                {navItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setView(item.id);
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
                    type="button"
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="flex items-center gap-2 text-zinc-500 text-xs font-bold"
                  >
                    {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    {isDarkMode ? t('common.dark') : t('common.light')}
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    className={`flex items-center gap-2 text-xs font-bold ${isVoiceActive ? 'text-orange-600' : 'text-zinc-400'}`}
                  >
                    {isVoiceActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    {t('common.voiceControl')} {isVoiceActive ? t('common.on') : t('common.off')}
                  </button>
                </div>
                <div className="flex gap-2">
                  {([
                    { id: 'en', label: 'EN' },
                    { id: 'ja', label: 'JA' },
                    { id: 'ko', label: 'KO' },
                  ] as const).map((lang) => (
                    <button
                      type="button"
                      key={lang.id}
                      onClick={() => setLanguage(lang.id)}
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

        <div className="px-4 sm:px-6 lg:px-8 pb-20">
          <Suspense fallback={<ViewLoading label={t('common.loading')} />}>
          <AnimatePresence mode="wait">
            {view === 'home' && (
              <HomeView
                pantry={pantry}
                recipes={recipes}
                featuredRecipes={FEATURED_RECIPES}
                canMakeNowRecipes={canMakeNowRecipes}
                almostThereRecipes={almostThereRecipes}
                cookWithSwapsRecipes={cookWithSwapsRecipes}
                savedRecipesList={savedRecipesList}
                savedRecipes={savedRecipes}
                recentHistory={recentHistory}
                isAnalyzing={isAnalyzing}
                onScan={handleScan}
                onGenerateFromPantry={handleGenerateFromPantry}
                onSelectRecipe={setSelectedRecipe}
                onToggleSave={toggleSaveRecipe}
                onViewChange={setView}
              />
            )}

            {view === 'pantry' && (
            <Pantry
              pantry={pantry}
              onAdd={(item) => setPantry((prev) => mergePantryItems(prev, [item]))}
              onAddMany={(items) => setPantry((prev) => mergePantryItems(prev, items))}
              onRemove={(id) => setPantry(prev => prev.filter(i => i.id !== id))}
              onToggleLowStock={(id) => setPantry(prev => prev.map(i =>
                i.id === id ? { ...i, isLowStock: !i.isLowStock } : i,
              ))}
              onUpdateExpiry={(id, expiresAt) => setPantry((prev) => prev.map((item) =>
                item.id === id ? { ...item, expiresAt } : item,
              ))}
              onClear={() => setPantry([])}
              onGenerateRecipes={handleGenerateFromPantry}
              onAddLowStockToShopping={addLowStockToShoppingList}
              onViewChange={setView}
              isGenerating={isAnalyzing}
            />
          )}

          {view === 'recipes' && (
              <RecipesView
                filteredRecipes={filteredRecipes}
                pantry={pantry}
                activeFilters={activeFilters}
                savedRecipes={savedRecipes}
                onToggleFilter={toggleFilter}
                onSelectRecipe={setSelectedRecipe}
                onToggleSave={toggleSaveRecipe}
                onViewChange={setView}
              />
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
                  planLanguage={mealPlanLanguage}
                  ingredients={pantry.map(i => i.name)}
                  dietaryRestrictions={activeFilters}
                  onSave={(plan) => {
                    setMealPlan(plan);
                    setMealPlanLanguage(language);
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
                  pantry={pantry}
                />
              </motion.div>
            )}

            {view === 'saved' && (
              <SavedView
                savedRecipesList={savedRecipesList}
                pantry={pantry}
                onSelectRecipe={setSelectedRecipe}
                onToggleSave={toggleSaveRecipe}
                onViewChange={setView}
              />
            )}

            {view === 'shopping' && (
              <motion.div
                key="shopping"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-5xl mx-auto"
              >
                <ShoppingList
                  items={shoppingList}
                  onRemove={removeFromShoppingList}
                  onToggle={toggleShoppingItem}
                  onClear={() => setShoppingList([])}
                  onAdd={addToShoppingList}
                />
              </motion.div>
            )}

            {view === 'about' && <AboutView />}

            {view === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Profile
                  profile={userProfile}
                  stats={userStats}
                  onEdit={() => setIsEditingProfile(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>
          </Suspense>
        </div>
      </main>

      <nav
        aria-label={t('common.navigationMenu')}
        className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[1.5rem] border border-zinc-200 bg-white/95 p-2 shadow-2xl shadow-zinc-900/10 backdrop-blur-xl lg:hidden dark:border-zinc-800 dark:bg-zinc-900/95"
      >
        {([
          { id: 'home' as View, label: t('common.dashboard'), icon: LayoutDashboard },
          { id: 'profile' as View, label: t('common.profile'), icon: UserRound },
          { id: 'pantry' as View, label: t('common.pantry'), icon: Refrigerator },
          { id: 'shopping' as View, label: t('common.shopping'), icon: ShoppingBag },
        ]).map((item) => {
          const active = view === item.id && !isMobileMenuOpen;
          const badge = navBadgeFor(item.id);
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                setView(item.id);
                setIsMobileMenuOpen(false);
              }}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-extrabold transition ${active ? 'bg-orange-50 text-food-orange dark:bg-orange-500/10' : 'text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
            >
              <item.icon className="h-5 w-5" />
              <span className="max-w-full text-center leading-3">{item.label}</span>
              {badge !== null && (
                <span className="absolute right-[20%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-food-orange px-1 text-[9px] text-white">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          aria-expanded={isMobileMenuOpen}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-extrabold transition ${isMobileMenuOpen ? 'bg-orange-50 text-food-orange dark:bg-orange-500/10' : 'text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800'}`}
        >
          <Menu className="h-5 w-5" />
          <span>{t('common.menu')}</span>
        </button>
      </nav>

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
              type="button"
              onClick={undoCooked}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all border border-white/10"
            >
              {t('common.undo')}
            </button>
            <button
              type="button"
              onClick={() => setShowUndoToast(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-all"
            >
              <X className="w-4 h-4 opacity-50" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-40 left-1/2 z-[100] bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[320px] max-w-sm"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="flex-1 text-sm font-bold">{errorToast}</p>
            <button
              type="button"
              onClick={() => setErrorToast(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-all"
            >
              <X className="w-4 h-4 opacity-70" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
