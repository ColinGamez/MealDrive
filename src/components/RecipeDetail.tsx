import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ArrowLeft, Play, Pause, ChevronRight, ChevronLeft, ShoppingCart, CheckCircle2, Clock, Flame, Star, Bookmark, ChefHat, Sparkles, X, Timer, Plus, ChevronDown, ChevronUp, UtensilsCrossed } from 'lucide-react';
import { Recipe, ShoppingItem, PantryItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { generateSpeech } from '../services/gemini';
import { useVoiceCommands, VoiceCommand } from '../hooks/useVoiceCommands';
import { checkIngredient, deductIngredients, DeductionResult, normalizeName } from '../lib/ingredientUtils';
import { useI18n } from '../i18n/I18nContext';
import { detectTimers } from '../lib/timerUtils';
import { KitchenTimer, ActiveTimer } from './KitchenTimer';
import { GlobalTimerModal } from './GlobalTimerModal';
import { KitchenNoteModal } from './KitchenNoteModal';
import { getRecipeNotes, saveNote, deleteNote, updateNote } from '../lib/noteUtils';
import { RecipeNote } from '../types';
import { newId } from '../lib/id';
import { STORAGE_KEYS, readStorage, writeStorage } from '../lib/storage';
import confetti from 'canvas-confetti';
import { StickyNote, Trash2, Edit3 } from 'lucide-react';

interface Props {
  recipe: Recipe;
  onBack: () => void;
  onAddToShoppingList: (name: string, amount: string) => void;
  onRemoveFromShoppingList: (id: string) => void;
  shoppingList: ShoppingItem[];
  pantry: PantryItem[];
  isVoiceActive: boolean;
  isSaved?: boolean;
  onToggleSave?: (e: React.MouseEvent) => void;
  onCooked: (updatedPantry: PantryItem[], recipe: Recipe) => void;
}

export const RecipeDetail: React.FC<Props> = ({
  recipe,
  onBack,
  onAddToShoppingList,
  onRemoveFromShoppingList,
  shoppingList,
  pantry,
  isVoiceActive,
  isSaved,
  onToggleSave,
  onCooked
}) => {
  const { t, language, locale } = useI18n();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [showCookedModal, setShowCookedModal] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isGlobalTimerModalOpen, setIsGlobalTimerModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);
  const [noteStepIndex, setNoteStepIndex] = useState<number | undefined>(undefined);
  const [editingNote, setEditingNote] = useState<RecipeNote | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [notes, setNotes] = useState<RecipeNote[]>([]);
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const [deductionResult, setDeductionResult] = useState<DeductionResult | null>(null);
  const [servings, setServings] = useState(() => {
    const saved = readStorage<number | null>(STORAGE_KEYS.servings(recipe.id), null);
    return typeof saved === 'number' && Number.isFinite(saved) ? saved : recipe.servings;
  });
  const [adjustedAmounts, setAdjustedAmounts] = useState<Record<string, string>>(() => {
    const fallback: Record<string, string> = {};
    recipe.ingredients.forEach(ing => {
      fallback[ing.name] = ing.amount || '';
    });
    return readStorage<Record<string, string>>(
      STORAGE_KEYS.adjustedAmounts(recipe.id),
      fallback,
    );
  });

  useEffect(() => {
    writeStorage(STORAGE_KEYS.adjustedAmounts(recipe.id), adjustedAmounts);
  }, [adjustedAmounts, recipe.id]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.servings(recipe.id), servings);
  }, [servings, recipe.id]);

  const scaleAmount = (amount: string, scale: number) => {
    if (scale === 1) return amount;

    // Helper to convert decimal to fraction for common cooking measurements
    const toFraction = (decimal: number) => {
      const tolerance = 0.01;
      if (Math.abs(decimal - 0.25) < tolerance) return '1/4';
      if (Math.abs(decimal - 0.33) < tolerance) return '1/3';
      if (Math.abs(decimal - 0.5) < tolerance) return '1/2';
      if (Math.abs(decimal - 0.66) < tolerance) return '2/3';
      if (Math.abs(decimal - 0.75) < tolerance) return '3/4';

      const whole = Math.floor(decimal);
      const remainder = decimal - whole;
      if (remainder < tolerance) return whole.toString();

      return (Math.round(decimal * 100) / 100).toString();
    };

    // Handle fractions like 1/2, 3/4
    const fractionRegex = /(\d+)\/(\d+)/g;
    let processedAmount = amount.replace(fractionRegex, (_, num, den) => {
      return (parseInt(num) / parseInt(den)).toString();
    });

    // Scale all numbers (including those converted from fractions)
    processedAmount = processedAmount.replace(/(\d+(\.\d+)?)/g, (match) => {
      const num = parseFloat(match);
      const scaled = num * scale;
      return toFraction(scaled);
    });

    return processedAmount;
  };

  const handleServingsChange = (newServings: number) => {
    const scale = newServings / servings;
    setServings(newServings);
    setAdjustedAmounts(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(name => {
        next[name] = scaleAmount(next[name], scale);
      });
      return next;
    });
  };

  const isIngredientAdded = useCallback(
    (name: string) => shoppingList.some(item => item.name.toLowerCase() === name.toLowerCase()),
    [shoppingList],
  );

  const ingredientChecks = useMemo(
    () => recipe.ingredients.map(ing =>
      checkIngredient({ ...ing, amount: adjustedAmounts[ing.name] }, pantry),
    ),
    [recipe.ingredients, adjustedAmounts, pantry],
  );

  const availableCount = useMemo(
    () => ingredientChecks.filter(c => c.status === 'available').length,
    [ingredientChecks],
  );
  const missingIngredients = useMemo(
    () => ingredientChecks.filter(c => c.status === 'missing' || c.status === 'partial' || c.status === 'substitute_available' || c.status === 'can_omit'),
    [ingredientChecks],
  );
  const rescueIngredients = useMemo(
    () => ingredientChecks.filter(c => c.status === 'substitute_available' || c.status === 'can_omit'),
    [ingredientChecks],
  );

  const addAllMissingToShoppingList = () => {
    recipe.ingredients.forEach((ing, idx) => {
      const check = ingredientChecks[idx];
      const pantryItem = pantry.find(p => {
        const pNorm = normalizeName(p.name);
        const iNorm = normalizeName(ing.name);
        return pNorm.includes(iNorm) || iNorm.includes(pNorm);
      });

      const isMissing = check.status === 'missing' || check.status === 'partial';
      const isLow = pantryItem?.isLowStock;

      if ((isMissing || isLow) && !isIngredientAdded(ing.name)) {
        const amountToAdd = check.status === 'partial' ? check.missingAmount || check.requiredAmount : check.requiredAmount;
        onAddToShoppingList(ing.name, amountToAdd);
      }
    });
  };

  const handleToggleIngredient = useCallback(
    (name: string) => {
      const existing = shoppingList.find(item => item.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        onRemoveFromShoppingList(existing.id);
      } else {
        onAddToShoppingList(name, adjustedAmounts[name]);
      }
    },
    [shoppingList, onRemoveFromShoppingList, onAddToShoppingList, adjustedAmounts],
  );

  const handleCookedClick = () => {
    const result = deductIngredients(recipe.ingredients.map(ing => ({ ...ing, amount: adjustedAmounts[ing.name] })), pantry);
    setDeductionResult(result);
    setShowCookedModal(true);
    setIsFocusMode(false);

    // Celebratory confetti
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 200 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  };

  const confirmCooked = () => {
    if (deductionResult) {
      onCooked(deductionResult.updatedPantry, recipe);
      onBack();
    }
  };

  // TTS audio cache, keyed by step + language. Lives for this RecipeDetail
  // mount — the component remounts when the user opens a different recipe so
  // we don't need to scope by recipe id.
  const ttsCacheRef = useRef<Map<string, string>>(new Map());

  const handlePlayStep = useCallback(async () => {
    if (isPlaying) {
      audio?.pause();
      setIsPlaying(false);
      return;
    }

    const cacheKey = `${currentStep}:${language}`;
    try {
      setIsPlaying(true);
      let audioUrl = ttsCacheRef.current.get(cacheKey);
      if (!audioUrl) {
        audioUrl = await generateSpeech(recipe.instructions[currentStep], language);
        ttsCacheRef.current.set(cacheKey, audioUrl);
      }
      const newAudio = new Audio(audioUrl);
      setAudio(newAudio);
      newAudio.play();
      newAudio.onended = () => setIsPlaying(false);
    } catch (error) {
      console.error("Speech failed", error);
      setIsPlaying(false);
    }
  }, [isPlaying, audio, currentStep, recipe.instructions, language]);

  // Invalidate the cache when the recipe identity changes — even though the
  // component usually remounts between recipes, this is a belt-and-suspenders
  // guard for callers that might reuse the same mount.
  useEffect(() => {
    ttsCacheRef.current = new Map();
  }, [recipe.id]);

  // Pre-warm the next step's audio in the background so hitting "Play" right
  // after "Next" is instant. Fire-and-forget; if it errors we'll just fall
  // back to the live fetch when the user actually plays it.
  useEffect(() => {
    const nextIdx = currentStep + 1;
    if (nextIdx >= recipe.instructions.length) return;
    const cacheKey = `${nextIdx}:${language}`;
    if (ttsCacheRef.current.has(cacheKey)) return;

    let cancelled = false;
    (async () => {
      try {
        const audioUrl = await generateSpeech(recipe.instructions[nextIdx], language);
        if (!cancelled) ttsCacheRef.current.set(cacheKey, audioUrl);
      } catch {
        /* prefetch is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentStep, recipe.instructions, language]);

  const nextStep = useCallback(() => {
    if (currentStep < recipe.instructions.length - 1) {
      setCurrentStep(s => s + 1);
    }
  }, [currentStep, recipe.instructions.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  }, [currentStep]);

  useEffect(() => {
    setNotes(getRecipeNotes(recipe.id));
  }, [recipe.id]);

  useEffect(() => {
    setIsNotesExpanded(false);
  }, [currentStep]);

  const handleSaveNote = (content: string) => {
    if (editingNote) {
      const updated = updateNote(editingNote.id, content);
      setNotes(prev => prev.map(n => n.id === editingNote.id ? updated : n));
      setEditingNote(null);
    } else {
      const newNote = saveNote({
        recipeId: recipe.id,
        content,
        stepIndex: noteStepIndex
      });
      setNotes(prev => [...prev, newNote]);
    }
    setNoteStepIndex(undefined);
  };

  const handleDeleteNote = (id: string) => {
    setNoteToDelete(id);
  };

  const confirmDeleteNote = () => {
    if (noteToDelete) {
      deleteNote(noteToDelete);
      setNotes(prev => prev.filter(n => n.id !== noteToDelete));
      setNoteToDelete(null);
    }
  };

  const handleEditNote = (note: RecipeNote) => {
    setEditingNote(note);
    setNoteStepIndex(note.stepIndex);
    setIsNoteModalOpen(true);
  };

  const openNoteModal = (stepIdx?: number) => {
    setEditingNote(null);
    setNoteStepIndex(stepIdx);
    setIsNoteModalOpen(true);
  };

  const voiceCommands = useMemo(() => {
    // Regex commands are sourced from i18n so JA/KO speakers can use them too.
    // Each pattern MUST include exactly one capture group for the spoken item.
    const buildRegex = (key: string): RegExp | null => {
      const pattern = t(key);
      if (!pattern || pattern === key) return null;
      try {
        return new RegExp(pattern, 'i');
      } catch {
        return null;
      }
    };
    const addShoppingRegex = buildRegex('voiceRegex.addToShoppingList');
    const removeShoppingRegex = buildRegex('voiceRegex.removeFromShoppingList');
    const goToStepRegex = buildRegex('voiceRegex.goToStepWith');
    const addNoteRegex = buildRegex('voiceRegex.addNote');

    const commands: VoiceCommand[] = [
      { command: t('voiceCommands.next'), callback: nextStep },
      { command: t('voiceCommands.back'), callback: prevStep },
      { command: t('voiceCommands.previous'), callback: prevStep },
      { command: t('voiceCommands.read'), callback: handlePlayStep },
      { command: t('voiceCommands.play'), callback: handlePlayStep },
      { command: t('voiceCommands.stop'), callback: () => { audio?.pause(); setIsPlaying(false); } },
      { command: t('voiceCommands.exit'), callback: onBack },
      { command: t('voiceCommands.close'), callback: onBack },
    ];

    if (addShoppingRegex) {
      commands.push({
        command: addShoppingRegex,
        callback: (match: any) => {
          const item = String(match[1] ?? '').toLowerCase();
          const ingredient = recipe.ingredients.find(ing => ing.name.toLowerCase().includes(item));
          if (ingredient && !isIngredientAdded(ingredient.name)) {
            handleToggleIngredient(ingredient.name);
          }
        },
      });
    }
    if (removeShoppingRegex) {
      commands.push({
        command: removeShoppingRegex,
        callback: (match: any) => {
          const item = String(match[1] ?? '').toLowerCase();
          const ingredient = recipe.ingredients.find(ing => ing.name.toLowerCase().includes(item));
          if (ingredient && isIngredientAdded(ingredient.name)) {
            handleToggleIngredient(ingredient.name);
          }
        },
      });
    }
    if (goToStepRegex) {
      commands.push({
        command: goToStepRegex,
        callback: (match: any) => {
          const item = String(match[1] ?? '').toLowerCase();
          const stepIdx = recipe.instructions.findIndex(step => step.toLowerCase().includes(item));
          if (stepIdx !== -1) {
            setCurrentStep(stepIdx);
          }
        },
      });
    }

    commands.push(
      {
        command: t('voiceCommands.startTimer'),
        callback: () => {
          const detected = detectTimers(recipe.instructions[currentStep]);
          if (detected.length > 0) {
            startTimer(detected[0].durationSeconds, detected[0].label);
          }
        },
      },
      {
        command: t('voiceCommands.stopTimer'),
        callback: () => {
          if (activeTimers.length > 0) {
            cancelTimer(activeTimers[activeTimers.length - 1].id);
          }
        },
      },
    );

    if (addNoteRegex) {
      commands.push({
        command: addNoteRegex,
        callback: async (match: any) => {
          const content = String(match[1] ?? '');
          const newNote = saveNote({
            recipeId: recipe.id,
            content,
            stepIndex: currentStep,
          });
          setNotes(prev => [...prev, newNote]);

          try {
            const audioUrl = await generateSpeech(t('recipes.noteSaved'), language);
            const confirmAudio = new Audio(audioUrl);
            confirmAudio.play();
          } catch (e) {
            console.error('Voice confirmation failed', e);
          }
        },
      });
    }

    commands.push(
      { command: t('voiceCommands.openNotes'), callback: () => openNoteModal(currentStep) },
      { command: t('voiceCommands.closeNotes'), callback: () => setIsNoteModalOpen(false) },
      { command: t('voiceCommands.showNotes'), callback: () => setIsNotesExpanded(true) },
      { command: t('voiceCommands.hideNotes'), callback: () => setIsNotesExpanded(false) },
    );

    return commands;
  }, [t, language, recipe, currentStep, activeTimers, audio, handlePlayStep, nextStep, prevStep, onBack, isIngredientAdded, handleToggleIngredient]);

  const { startListening, stopListening } = useVoiceCommands(
    voiceCommands,
    isVoiceActive,
    { lang: locale },
  );

  // Auto-start/stop recipe voice recognition in sync with the global voice toggle.
  // App.tsx deactivates its own hook while a recipe is open, so we take over here.
  useEffect(() => {
    if (isVoiceActive) {
      void startListening();
    }
    return () => stopListening();
  }, [isVoiceActive, startListening, stopListening]);

  // Timer Countdown Logic
  useEffect(() => {
    if (activeTimers.length === 0) return;

    const interval = setInterval(() => {
      setActiveTimers(prev => prev.map(timer => {
        if (timer.isPaused || timer.isFinished || timer.remainingSeconds <= 0) return timer;
        return { ...timer, remainingSeconds: timer.remainingSeconds - 1 };
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimers.length]);

  const startTimer = (durationSeconds: number, label: string) => {
    const id = newId();
    setActiveTimers(prev => [...prev, {
      id,
      label,
      durationSeconds,
      remainingSeconds: durationSeconds,
      isPaused: false,
      isFinished: false,
    }]);
  };

  const pauseTimer = (id: string) => {
    setActiveTimers(prev => prev.map(t => t.id === id ? { ...t, isPaused: true } : t));
  };

  const resumeTimer = (id: string) => {
    setActiveTimers(prev => prev.map(t => t.id === id ? { ...t, isPaused: false } : t));
  };

  const cancelTimer = (id: string) => {
    setActiveTimers(prev => prev.filter(t => t.id !== id));
  };

  const restartTimer = (id: string) => {
    setActiveTimers(prev => prev.map(t => t.id === id ? { ...t, remainingSeconds: t.durationSeconds, isPaused: false, isFinished: false } : t));
  };

  const finishTimer = async (id: string) => {
    // Read latest timers via the setter callback so we always get the right
    // label for the alert (the previous version captured a stale closure).
    let finishedTimer: ActiveTimer | undefined;
    setActiveTimers(prev => {
      finishedTimer = prev.find(timer => timer.id === id);
      return prev.map(timer =>
        timer.id === id ? { ...timer, isFinished: true, remainingSeconds: 0 } : timer,
      );
    });

    try {
      const text = finishedTimer
        ? t('recipes.timerFinished', { label: finishedTimer.label })
        : t('recipes.timerFinishedGeneric');
      const audioUrl = await generateSpeech(text, language);
      const finishAudio = new Audio(audioUrl);
      finishAudio.play();
    } catch (error) {
      console.error('Timer voice alert failed', error);
    }
  };

  useEffect(() => {
    if (isFocusMode) {
      handlePlayStep();
    }
  }, [currentStep, isFocusMode]);

  useEffect(() => {
    return () => {
      audio?.pause();
    };
  }, [audio]);

  return (
    <div className="min-h-screen bg-mesh transition-colors duration-500 pb-32">
      {/* Hero Section */}
      <div className="relative h-[50vh] min-h-[400px] w-full overflow-hidden bg-gradient-to-br from-orange-50 to-orange-100 dark:from-zinc-800 dark:to-zinc-900">
        <motion.div
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="w-full h-full flex items-center justify-center"
        >
          <UtensilsCrossed className="w-32 h-32 text-food-orange/30" />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-50 dark:from-zinc-950 via-transparent to-black/40" />

        {/* Back Button Overlay */}
        <div className="absolute top-8 left-8">
          <button
            type="button"
            onClick={onBack}
            className="p-4 glass rounded-3xl text-zinc-900 dark:text-white hover:scale-110 transition-all glossy soft-shadow"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>

        {/* Save Button Overlay */}
        <div className="absolute top-8 right-8">
          <button
            type="button"
            onClick={onToggleSave}
            className={`p-4 rounded-3xl backdrop-blur-xl transition-all shadow-xl glossy border border-white/30 ${
              isSaved
                ? 'bg-food-orange text-white'
                : 'bg-white/20 text-white hover:bg-white/40'
            }`}
          >
            <Bookmark className={`w-6 h-6 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 max-w-5xl mx-auto">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {recipe.dietaryTags.map(tag => (
                <span key={tag} className="px-4 py-1.5 glass rounded-full text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider glossy">
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-black text-zinc-900 dark:text-white tracking-tighter leading-none drop-shadow-sm">
              {recipe.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 -mt-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column: Info & Ingredients */}
          <div className="lg:col-span-2 space-y-12">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: t('common.prepTime'), value: recipe.preparationTime, icon: Clock, color: 'text-sky-blue', bg: 'bg-sky-50 dark:bg-sky-500/10' },
                { label: t('common.calories'), value: `${recipe.calories} kcal`, icon: Flame, color: 'text-food-orange', bg: 'bg-orange-50 dark:bg-orange-500/10' },
                { label: t('common.difficulty'), value: recipe.difficulty, icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-500/10' }
              ].map((stat, i) => (
                <div key={i} className={`p-6 rounded-[2.5rem] ${stat.bg} border border-white/50 dark:border-zinc-800/50 soft-shadow glass`}>
                  <stat.icon className={`w-6 h-6 ${stat.color} mb-3`} />
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-lg font-display font-black text-zinc-900 dark:text-white">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="glass p-8 rounded-[3rem] border border-white/50 dark:border-zinc-800/50 soft-shadow">
              <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium italic">
                "{recipe.description}"
              </p>
            </div>

            {/* Kitchen Notes Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StickyNote className="w-6 h-6 text-food-orange" />
                  <h3 className="text-2xl font-display font-black text-zinc-900 dark:text-white">{t('recipes.yourKitchenNotes')}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => openNoteModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-food-orange/10 text-food-orange rounded-xl text-xs font-black uppercase tracking-widest hover:bg-food-orange hover:text-white transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {t('recipes.addNote')}
                </button>
              </div>

                      {notes.length > 0 ? (
                <div className="grid gap-4">
                  {notes.filter(n => n.stepIndex === undefined).map(note => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 glass rounded-[2rem] border border-white/50 dark:border-zinc-800/50 soft-shadow relative group"
                    >
                      <p className="text-zinc-700 dark:text-zinc-300 font-medium pr-16">{note.content}</p>
                      <div className="absolute top-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          type="button"
                          onClick={() => handleEditNote(note)}
                          className="p-2 text-zinc-300 hover:text-food-orange transition-all"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-2 text-zinc-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] text-center">
                  <p className="text-zinc-400 font-medium">{t('recipes.noNotesYet')}</p>
                </div>
              )}
            </div>

            {/* Ingredients Section */}
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-3xl font-display font-black text-zinc-900 dark:text-white">{t('recipes.ingredients')}</h3>
                  <p className="text-zinc-500 font-medium">{t('recipes.adjustQuantities')}</p>
                </div>
                <div className="flex items-center gap-4 glass p-2 rounded-3xl border border-white/50 dark:border-zinc-800/50">
                  <button
                    type="button"
                    onClick={() => handleServingsChange(Math.max(1, servings - 1))}
                    className="w-10 h-10 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-food-orange hover:text-white transition-all shadow-sm"
                  >
                    -
                  </button>
                  <div className="flex flex-col items-center px-2">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">{t('recipes.servings')}</span>
                    <span className="font-display font-black text-zinc-900 dark:text-white">{servings}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleServingsChange(servings + 1)}
                    className="w-10 h-10 rounded-2xl bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-food-orange hover:text-white transition-all shadow-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="grid gap-4">
                {recipe.ingredients.map((ing, idx) => {
                  const isAdded = isIngredientAdded(ing.name);
                  const check = ingredientChecks[idx];

                  return (
                    <motion.div
                      key={idx}
                      whileHover={{ x: 8 }}
                      onClick={() => handleToggleIngredient(ing.name)}
                      className={`flex items-center justify-between p-6 rounded-[2rem] transition-all duration-300 border cursor-pointer group/row glass soft-shadow ${
                        isAdded
                          ? 'bg-fresh-green/10 border-fresh-green/30'
                          : 'border-white/50 dark:border-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-6 flex-1">
                        <div className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all glossy ${
                          isAdded
                            ? 'bg-fresh-green border-fresh-green'
                            : 'border-zinc-200 dark:border-zinc-700 bg-transparent group-hover/row:border-food-orange'
                        }`}>
                          {isAdded && <CheckCircle2 className="w-5 h-5 text-zinc-900" />}
                        </div>
                        <div className="flex flex-col flex-1">
                          <span className={`text-lg font-display font-bold transition-all ${isAdded ? 'text-fresh-green line-through opacity-60' : 'text-zinc-800 dark:text-zinc-200'}`}>
                            {ing.name}
                          </span>
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            <span className="text-sm font-black text-food-orange uppercase tracking-tighter">{adjustedAmounts[ing.name]}</span>
                            {check.status === 'available' && (
                              <span className="text-[10px] font-black text-fresh-green uppercase tracking-widest flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> {t('recipes.inPantry')}
                              </span>
                            )}
                            {check.status === 'substitute_available' && (
                              <span className="text-[10px] font-black text-sky-blue uppercase tracking-widest flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> {t('recipes.useSubstitute', { substitute: check.substitution?.substituteIngredient })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleIngredient(ing.name);
                        }}
                        className={`p-4 rounded-2xl transition-all glossy ${
                          isAdded
                            ? 'bg-fresh-green text-zinc-900'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-food-orange'
                        }`}
                      >
                        <ShoppingCart className="w-5 h-5" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Pantry Check & Rescue */}
          <div className="space-y-8 lg:sticky lg:top-8 h-fit">
            {/* Pantry Check Card */}
            <div className="glass glossy p-8 rounded-[3rem] border border-white/50 dark:border-zinc-800/50 soft-shadow space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-display font-black text-zinc-900 dark:text-white">{t('recipes.pantryCheck')}</h3>
                <span className="text-3xl font-display font-black text-food-orange">
                  {Math.round((availableCount / recipe.ingredients.length) * 100)}%
                </span>
              </div>

              <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden p-1">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(availableCount / recipe.ingredients.length) * 100}%` }}
                  className="h-full bg-gradient-to-r from-food-orange to-food-coral rounded-full shadow-[0_0_15px_rgba(255,107,53,0.5)]"
                />
              </div>

              <p className="text-sm text-zinc-500 font-medium">
                {t('recipes.pantryCheckDesc', { available: availableCount, total: recipe.ingredients.length })}
              </p>

              {missingIngredients.length > 0 && (
                <button
                  type="button"
                  onClick={addAllMissingToShoppingList}
                  className="w-full py-5 bg-food-orange text-white rounded-[2rem] text-sm font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-food-orange/20 glossy"
                >
                  <div className="flex items-center justify-center gap-3">
                    <ShoppingCart className="w-5 h-5" />
                    {t('recipes.addMissingToShopping', { count: missingIngredients.length })}
                  </div>
                </button>
              )}
            </div>

            {/* Recipe Rescue Card */}
            {rescueIngredients.length > 0 && (
              <div className="glass glossy p-8 rounded-[3rem] border border-fresh-green/30 soft-shadow space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-fresh-green/20 rounded-[1.5rem] flex items-center justify-center glossy">
                    <Sparkles className="w-7 h-7 text-fresh-green" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-black text-zinc-900 dark:text-white">{t('recipes.recipeRescue')}</h3>
                    <p className="text-sm text-fresh-green font-bold uppercase tracking-widest">{t('recipes.smartSwaps')}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {rescueIngredients.map((check) => (
                    <div key={check.name} className="p-4 bg-white/40 dark:bg-zinc-900/40 rounded-2xl border border-white/50 dark:border-zinc-800/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-black text-zinc-900 dark:text-white">{check.name}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-fresh-green/20 text-fresh-green rounded-lg">
                          {check.status === 'can_omit' ? t('recipes.safeToSkip') : t('recipes.swapAvailable')}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 italic leading-relaxed">
                        {check.substitution?.note || (check.status === 'can_omit' ? t('recipes.garnishSkip') : t('recipes.useInstead', { substitute: check.substitution?.substituteIngredient }))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cooking Instructions Section */}
        <div className="mt-24">
          <div className="glass glossy rounded-[4rem] p-8 md:p-16 border border-white/50 dark:border-zinc-800/50 soft-shadow relative overflow-hidden">
            {/* Glossy Reflection */}
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-16">
                <div className="text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                    <span className="px-5 py-2 bg-food-orange text-white rounded-full text-xs font-black uppercase tracking-widest glossy shadow-lg">
                      {t('recipes.stepXofY', { current: currentStep + 1, total: recipe.instructions.length })}
                    </span>
                    {currentStep === recipe.instructions.length - 1 && (
                      <span className="px-5 py-2 bg-fresh-green text-zinc-900 rounded-full text-xs font-black uppercase tracking-widest glossy shadow-lg animate-pulse">
                        {t('recipes.finalStep')}
                      </span>
                    )}
                  </div>
                  <h2 className="text-5xl md:text-6xl font-display font-black text-zinc-900 dark:text-white tracking-tighter">
                    {t('recipes.cookingInstructions')}
                  </h2>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => openNoteModal(currentStep)}
                    aria-label={t('recipes.addNote')}
                    className="p-6 glass rounded-[2rem] text-zinc-900 dark:text-white hover:scale-110 transition-all glossy soft-shadow"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={handlePlayStep}
                    className="w-24 h-24 rounded-[2rem] bg-food-orange text-white flex items-center justify-center hover:scale-110 transition-all shadow-2xl shadow-food-orange/30 glossy"
                  >
                    {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
                  </button>
                </div>
              </div>

              <div className="min-h-[300px] flex flex-col items-center justify-center px-4 space-y-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-3xl md:text-5xl font-display font-black leading-tight text-center text-zinc-900 dark:text-white tracking-tight"
                  >
                    {recipe.instructions[currentStep]}
                  </motion.div>
                </AnimatePresence>

                {/* Collapsible Step Notes */}
                <AnimatePresence>
                  {notes.filter(n => n.stepIndex === currentStep).length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="w-full max-w-2xl"
                    >
                      <button
                        type="button"
                        onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                        className="flex items-center gap-2 text-food-orange font-black uppercase tracking-widest text-xs mb-4 hover:opacity-80 transition-all mx-auto"
                      >
                        <StickyNote className="w-4 h-4" />
                        <span>{t('recipes.yourNotes')} ({notes.filter(n => n.stepIndex === currentStep).length})</span>
                        {isNotesExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      <AnimatePresence>
                        {isNotesExpanded && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-3"
                          >
                            {notes.filter(n => n.stepIndex === currentStep).map(note => (
                              <div
                                key={note.id}
                                className="px-6 py-4 bg-food-orange/10 border border-food-orange/20 rounded-2xl flex items-center justify-between gap-3 group"
                              >
                                <span className="text-sm font-bold text-food-orange">{note.content}</span>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                  <button
                                    type="button"
                                    onClick={() => handleEditNote(note)}
                                    className="p-1 text-food-orange/40 hover:text-food-orange transition-all"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNote(note.id)}
                                    className="p-1 text-food-orange/40 hover:text-red-500 transition-all"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between mt-16 gap-8">
                <button
                  type="button"
                  disabled={currentStep === 0}
                  onClick={() => setCurrentStep(s => s - 1)}
                  className="flex items-center gap-3 text-zinc-400 hover:text-food-orange disabled:opacity-30 transition-all group"
                >
                  <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center group-hover:bg-food-orange group-hover:text-white transition-all">
                    <ChevronLeft className="w-6 h-6" />
                  </div>
                  <span className="font-black uppercase tracking-widest text-sm">{t('recipes.previous')}</span>
                </button>

                <div className="flex gap-3">
                  {recipe.instructions.map((_, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setCurrentStep(idx)}
                      className={`h-3 rounded-full transition-all duration-500 glossy ${idx === currentStep ? 'w-12 bg-food-orange shadow-[0_0_10px_rgba(255,107,53,0.5)]' : 'w-3 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300'}`}
                    />
                  ))}
                </div>

                {currentStep === recipe.instructions.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleCookedClick}
                    className="flex items-center gap-3 px-10 py-5 bg-fresh-green text-zinc-900 rounded-[2rem] font-black uppercase tracking-widest hover:scale-110 transition-all shadow-2xl shadow-fresh-green/30 glossy"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                    <span>{t('recipes.iCookedThis')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(s => s + 1)}
                    className="flex items-center gap-3 text-zinc-400 hover:text-food-orange transition-all group"
                  >
                    <span className="font-black uppercase tracking-widest text-sm">{t('recipes.next')}</span>
                    <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center group-hover:bg-food-orange group-hover:text-white transition-all">
                      <ChevronRight className="w-6 h-6" />
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 lg:hidden w-full max-w-xs px-4">
        <button
          type="button"
          onClick={() => setIsFocusMode(true)}
          className="w-full py-5 bg-food-orange text-white rounded-[2rem] font-black uppercase tracking-widest shadow-2xl shadow-food-orange/40 glossy flex items-center justify-center gap-3"
        >
          <ChefHat className="w-6 h-6" />
          {t('common.startCooking')}
        </button>
      </div>

      {/* Focus Cooking Mode Overlay */}
      <AnimatePresence>
        {isFocusMode && (
          <motion.div
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[150] bg-mesh dark:bg-zinc-950 overflow-hidden flex flex-col"
          >
            {/* Background gradient */}
            <div className="absolute inset-0 z-0">
              <div className="w-full h-full bg-gradient-to-br from-orange-50 to-orange-100 dark:from-zinc-900 dark:to-zinc-950 opacity-30 dark:opacity-20" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/40 dark:via-zinc-950/40 to-white dark:to-zinc-950" />
            </div>

            {/* Header */}
            <div className="relative z-10 p-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsFocusMode(false)}
                className="p-4 glass rounded-3xl text-zinc-900 dark:text-white hover:scale-110 transition-all glossy soft-shadow"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-food-orange uppercase tracking-[0.3em] mb-1">
                  {recipe.title}
                </span>
                <div className="flex gap-2">
                  {recipe.instructions.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentStep ? 'w-8 bg-food-orange' : idx < currentStep ? 'w-3 bg-fresh-green' : 'w-3 bg-zinc-200 dark:bg-zinc-800'}`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGlobalTimerModalOpen(true)}
                className="p-4 glass rounded-3xl text-zinc-900 dark:text-white hover:scale-110 transition-all glossy soft-shadow"
              >
                <Timer className="w-6 h-6" />
              </button>
            </div>

            {/* Main Step Content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 md:px-24 text-center">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -40, filter: 'blur(10px)' }}
                transition={{ type: "spring", damping: 20, stiffness: 100 }}
                className="space-y-12 max-w-4xl"
              >
                <div className="space-y-4">
                  <span className="px-6 py-2 bg-food-orange/10 text-food-orange rounded-full text-xs font-black uppercase tracking-widest border border-food-orange/20">
                    {t('recipes.stepXofY', { current: currentStep + 1, total: recipe.instructions.length })}
                  </span>
                  <h2 className="text-4xl md:text-7xl font-display font-black text-zinc-900 dark:text-white tracking-tighter leading-[1.1]">
                    {recipe.instructions[currentStep]}
                  </h2>

                  {/* Collapsible Step Notes in Focus Mode */}
                  <AnimatePresence>
                    {notes.filter(n => n.stepIndex === currentStep).length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mx-auto max-w-md w-full"
                      >
                        <button
                          type="button"
                          onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                          className="flex items-center gap-2 text-food-orange font-black uppercase tracking-widest text-xs mb-4 hover:opacity-80 transition-all mx-auto"
                        >
                          <StickyNote className="w-4 h-4" />
                          <span>{t('recipes.yourNotes')} ({notes.filter(n => n.stepIndex === currentStep).length})</span>
                          {isNotesExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        <AnimatePresence>
                          {isNotesExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-3 overflow-hidden"
                            >
                              {notes.filter(n => n.stepIndex === currentStep).map(note => (
                                <div
                                  key={note.id}
                                  className="px-6 py-4 glass border border-food-orange/30 rounded-3xl flex items-center justify-between gap-4 glossy group"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-food-orange/20 rounded-xl flex items-center justify-center shrink-0">
                                      <StickyNote className="w-5 h-5 text-food-orange" />
                                    </div>
                                    <span className="text-lg font-bold text-zinc-800 dark:text-zinc-200 text-left">{note.content}</span>
                                  </div>
                                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                    <button
                                      type="button"
                                      onClick={() => handleEditNote(note)}
                                      className="p-2 text-zinc-400 hover:text-food-orange transition-all"
                                    >
                                      <Edit3 className="w-5 h-5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteNote(note.id)}
                                      className="p-2 text-zinc-400 hover:text-red-500 transition-all"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex items-center justify-center gap-8">
                  <button
                    type="button"
                    onClick={handlePlayStep}
                    className={`w-24 h-24 rounded-[3rem] flex items-center justify-center transition-all shadow-2xl glossy ${isPlaying ? 'bg-zinc-900 text-white' : 'bg-food-orange text-white shadow-food-orange/30'}`}
                  >
                    {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current ml-1" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => openNoteModal(currentStep)}
                    className="flex items-center gap-3 px-8 py-5 bg-white/20 dark:bg-zinc-800/20 backdrop-blur-xl border border-white/30 dark:border-zinc-700/30 rounded-[2rem] text-zinc-900 dark:text-white font-black uppercase tracking-widest hover:bg-food-orange hover:text-white transition-all glossy shadow-xl"
                  >
                    <Plus className="w-6 h-6" />
                    <span>{t('recipes.addNote')}</span>
                  </button>

                  {/* Detected Timers */}
                  <AnimatePresence>
                    {detectTimers(recipe.instructions[currentStep]).map((timer, idx) => (
                      <motion.button
                        type="button"
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        onClick={() => startTimer(timer.durationSeconds, timer.label)}
                        className="flex items-center gap-3 px-8 py-5 bg-white/20 dark:bg-zinc-800/20 backdrop-blur-xl border border-white/30 dark:border-zinc-700/30 rounded-[2rem] text-zinc-900 dark:text-white font-black uppercase tracking-widest hover:bg-food-orange hover:text-white transition-all glossy shadow-xl"
                      >
                        <Clock className="w-6 h-6" />
                        <span>{t('recipes.startTimer', { time: timer.label })}</span>
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>

            {/* Navigation Footer */}
            <div className="relative z-10 p-8 md:p-12 flex items-center justify-between max-w-5xl mx-auto w-full">
              <button
                type="button"
                disabled={currentStep === 0}
                onClick={prevStep}
                className="flex items-center gap-4 text-zinc-400 hover:text-food-orange disabled:opacity-20 transition-all group"
              >
                <div className="w-16 h-16 rounded-[2rem] glass flex items-center justify-center group-hover:bg-food-orange group-hover:text-white transition-all shadow-lg">
                  <ChevronLeft className="w-8 h-8" />
                </div>
                <span className="font-black uppercase tracking-widest text-sm hidden md:block">{t('recipes.previous')}</span>
              </button>

              <div className="flex-1 flex justify-center">
                <div className="glass px-8 py-4 rounded-full flex items-center gap-4 glossy soft-shadow">
                  <ChefHat className="w-5 h-5 text-food-orange" />
                  <span className="text-sm font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">
                    {Math.round(((currentStep + 1) / recipe.instructions.length) * 100)}% {t('recipes.complete')}
                  </span>
                </div>
              </div>

              {currentStep === recipe.instructions.length - 1 ? (
                <button
                  type="button"
                  onClick={handleCookedClick}
                  className="flex items-center gap-4 px-12 py-6 bg-fresh-green text-zinc-900 rounded-[2.5rem] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-2xl shadow-fresh-green/30 glossy"
                >
                  <CheckCircle2 className="w-8 h-8" />
                  <span>{t('recipes.iCookedThis')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center gap-4 text-zinc-400 hover:text-food-orange transition-all group"
                >
                  <span className="font-black uppercase tracking-widest text-sm hidden md:block">{t('recipes.next')}</span>
                  <div className="w-16 h-16 rounded-[2rem] glass flex items-center justify-center group-hover:bg-food-orange group-hover:text-white transition-all shadow-lg">
                    <ChevronRight className="w-8 h-8" />
                  </div>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kitchen Timers */}
      <KitchenTimer
        timers={activeTimers}
        onPause={pauseTimer}
        onResume={resumeTimer}
        onCancel={cancelTimer}
        onRestart={restartTimer}
        onFinish={finishTimer}
      />

      <GlobalTimerModal
        isOpen={isGlobalTimerModalOpen}
        onClose={() => setIsGlobalTimerModalOpen(false)}
        onStart={startTimer}
      />

      <KitchenNoteModal
        isOpen={isNoteModalOpen}
        onClose={() => {
          setIsNoteModalOpen(false);
          setEditingNote(null);
        }}
        onSave={handleSaveNote}
        stepIndex={noteStepIndex}
        initialContent={editingNote?.content}
        isEditing={!!editingNote}
      />

      {/* Delete Note Confirmation Modal */}
      <AnimatePresence>
        {noteToDelete && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNoteToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm glass rounded-[3rem] shadow-2xl overflow-hidden border border-white/50 dark:border-zinc-800/50 glossy p-8 md:p-10 text-center"
            >
              <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 glossy">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-2xl font-display font-black text-zinc-900 dark:text-white mb-4 tracking-tighter">
                {t('recipes.deleteNoteAction')}
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8">
                {t('recipes.deleteNoteConfirm')}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setNoteToDelete(null)}
                  className="px-6 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-200 transition-all text-xs"
                >
                  {t('recipes.cancel')}
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteNote}
                  className="px-6 py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 glossy text-xs"
                >
                  {t('recipes.deleteNoteAction')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

        {/* Cooked Confirmation Modal */}
        <AnimatePresence>
          {showCookedModal && deductionResult && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCookedModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg glass rounded-[4rem] shadow-2xl overflow-hidden border border-white/50 dark:border-zinc-800/50 glossy"
              >
                <div className="p-10 md:p-12">
                  <div className="w-20 h-20 bg-food-orange/20 rounded-[2rem] flex items-center justify-center mb-8 glossy">
                    <ChefHat className="w-10 h-10 text-food-orange" />
                  </div>
                  <h2 className="text-4xl font-display font-black text-zinc-900 dark:text-white mb-3 tracking-tighter">{t('recipes.recipeComplete')}</h2>
                  <p className="text-zinc-500 font-medium mb-10">{t('recipes.confirmDeduction')}</p>

                  <div className="space-y-8 max-h-[40vh] overflow-y-auto pr-4 custom-scrollbar">
                    {deductionResult.deductions.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">{t('recipes.deducting')}</h4>
                        <div className="space-y-3">
                          {deductionResult.deductions.map((d, i) => (
                            <div key={i} className="flex items-center justify-between p-5 bg-white/40 dark:bg-zinc-950/40 rounded-3xl border border-white/50 dark:border-zinc-800/50 glass">
                              <span className="font-display font-bold text-zinc-800 dark:text-zinc-200">{d.name}</span>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-zinc-400 line-through uppercase tracking-tighter">{d.oldAmount}</p>
                                <p className="text-lg font-display font-black text-food-orange">{d.newAmount || t('recipes.usedUp')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {deductionResult.skipped.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">{t('recipes.skipped')}</h4>
                        <div className="space-y-3">
                          {deductionResult.skipped.map((s, i) => (
                            <div key={i} className="flex items-center justify-between p-5 bg-zinc-50/50 dark:bg-zinc-950/50 rounded-3xl border border-zinc-100/50 dark:border-zinc-800/50 opacity-60">
                              <span className="font-display font-bold text-zinc-500 dark:text-zinc-400">{s.name}</span>
                              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                {s.reason === 'incompatible_units' ? t('recipes.unitMismatch') : s.reason === 'no_quantity' ? t('recipes.noQty') : t('recipes.missingLabel')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-6 mt-12">
                    <button
                      type="button"
                      onClick={() => setShowCookedModal(false)}
                      className="px-8 py-5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-[2rem] font-black uppercase tracking-widest hover:bg-zinc-200 transition-all"
                    >
                      {t('recipes.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={confirmCooked}
                      className="px-8 py-5 bg-food-orange text-white rounded-[2rem] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-food-orange/20 glossy"
                    >
                      {t('recipes.confirm')}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
    </div>
  );
};
