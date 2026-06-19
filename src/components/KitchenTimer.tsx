import React, { useEffect } from 'react';
import { Play, Pause, X, RotateCcw, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatTime } from '../lib/timerUtils';

export interface ActiveTimer {
  id: string;
  label: string;
  durationSeconds: number;
  remainingSeconds: number;
  isPaused: boolean;
  isFinished: boolean;
}

interface Props {
  timers: ActiveTimer[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRestart: (id: string) => void;
  onFinish: (id: string) => void;
}

export const KitchenTimer: React.FC<Props> = ({
  timers,
  onPause,
  onResume,
  onCancel,
  onRestart,
  onFinish
}) => {
  if (timers.length === 0) return null;

  return (
    <div className="fixed top-24 right-8 z-[200] flex flex-col gap-4 pointer-events-none">
      <AnimatePresence>
        {timers.map((timer) => (
          <TimerCard
            key={timer.id}
            timer={timer}
            onPause={() => onPause(timer.id)}
            onResume={() => onResume(timer.id)}
            onCancel={() => onCancel(timer.id)}
            onRestart={() => onRestart(timer.id)}
            onFinish={() => onFinish(timer.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

const TimerCard: React.FC<{
  timer: ActiveTimer;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRestart: () => void;
  onFinish: () => void;
}> = ({ timer, onPause, onResume, onCancel, onRestart, onFinish }) => {
  const isNearEnd = timer.remainingSeconds <= 10 && !timer.isFinished;
  const progress = (timer.remainingSeconds / timer.durationSeconds) * 100;

  useEffect(() => {
    if (timer.remainingSeconds <= 0 && !timer.isFinished) {
      onFinish();
    }
  }, [timer.remainingSeconds, timer.isFinished, onFinish]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: 1,
        y: isNearEnd ? [0, -4, 0] : 0
      }}
      exit={{ opacity: 0, x: 50, scale: 0.9 }}
      transition={{
        y: isNearEnd ? { repeat: Infinity, duration: 0.5 } : { duration: 0.3 }
      }}
      className={`pointer-events-auto w-64 glass rounded-3xl border glossy soft-shadow overflow-hidden ${
        timer.isFinished
          ? 'bg-food-orange text-white border-food-orange/50 shadow-food-orange/30'
          : 'border-white/50 dark:border-zinc-800/50'
      }`}
    >
      {/* Progress Bar Background */}
      {!timer.isFinished && (
        <div className="absolute bottom-0 left-0 h-1 bg-food-orange/20 w-full">
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-food-orange"
          />
        </div>
      )}

      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {timer.isFinished ? (
              <Bell className="w-4 h-4 animate-bounce" />
            ) : (
              <div className={`w-2 h-2 rounded-full ${timer.isPaused ? 'bg-zinc-400' : 'bg-food-orange animate-pulse'}`} />
            )}
            <span className={`text-[10px] font-black uppercase tracking-widest ${timer.isFinished ? 'text-white' : 'text-zinc-400'}`}>
              {timer.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className={`p-1.5 rounded-xl transition-all ${timer.isFinished ? 'hover:bg-white/20' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className={`text-3xl font-display font-black tracking-tighter ${timer.isFinished ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>
            {formatTime(timer.remainingSeconds)}
          </span>

          <div className="flex items-center gap-2">
            {timer.isFinished ? (
              <button
                type="button"
                onClick={onRestart}
                className="p-3 bg-white text-food-orange rounded-2xl shadow-lg hover:scale-110 transition-all"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={timer.isPaused ? onResume : onPause}
                className={`p-3 rounded-2xl transition-all glossy ${
                  timer.isPaused
                    ? 'bg-food-orange text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                {timer.isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
