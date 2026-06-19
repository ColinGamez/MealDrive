import { RecentRecipe, UserStats, KitchenIdentity, Language } from '../types';

export function calculateCookingStats(history: RecentRecipe[], currentStats: UserStats): UserStats {
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  const totalCooked = history.length;
  const weeklyCooked = history.filter(h => h.cookedAt > oneWeekAgo).length;

  // Calculate streak
  let streak = 0;
  if (history.length > 0) {
    const sortedHistory = [...history].sort((a, b) => b.cookedAt - a.cookedAt);
    const lastCookedDate = new Date(sortedHistory[0].cookedAt).setHours(0, 0, 0, 0);
    const today = new Date().setHours(0, 0, 0, 0);
    const yesterday = today - 24 * 60 * 60 * 1000;

    if (lastCookedDate === today || lastCookedDate === yesterday) {
      streak = 1;
      let currentDate = lastCookedDate;
      for (let i = 1; i < sortedHistory.length; i++) {
        const prevDate = new Date(sortedHistory[i].cookedAt).setHours(0, 0, 0, 0);
        if (prevDate === currentDate - 24 * 60 * 60 * 1000) {
          streak++;
          currentDate = prevDate;
        } else if (prevDate < currentDate - 24 * 60 * 60 * 1000) {
          break;
        }
      }
    }
  }

  return {
    ...currentStats,
    totalCooked,
    weeklyCooked,
    streak,
    longestStreak: Math.max(currentStats.longestStreak, streak),
    lastCookedAt: history.length > 0 ? Math.max(...history.map(h => h.cookedAt)) : undefined
  };
}

export function getKitchenIdentity(stats: UserStats, language: Language): KitchenIdentity {
  const titles: Record<Language, Record<string, KitchenIdentity>> = {
    en: {
      starter: { title: "Pantry Starter", description: "Just beginning the culinary journey.", icon: "🌱" },
      keeper: { title: "Pantry Keeper", description: "Maintains a well-stocked kitchen.", icon: "📦" },
      weeknight: { title: "Weeknight Cook", description: "Master of quick and efficient meals.", icon: "⏱️" },
      rescue: { title: "Rescue Chef", description: "Expert at cooking with what's on hand.", icon: "🛟" },
      planner: { title: "Smart Planner", description: "Always one step ahead with meal plans.", icon: "📅" },
      hero: { title: "Home Kitchen Hero", description: "A true master of the home kitchen.", icon: "👨‍🍳" }
    },
    ja: {
      starter: { title: "パントリー初心者", description: "料理の旅が始まったばかりです。", icon: "🌱" },
      keeper: { title: "パントリーの番人", description: "整理整頓されたキッチンを維持しています。", icon: "📦" },
      weeknight: { title: "平日料理の達人", description: "手早く効率的な食事のマスター。", icon: "⏱️" },
      rescue: { title: "レスキューシェフ", description: "あるもので作る料理のエキスパート。", icon: "🛟" },
      planner: { title: "スマートプランナー", description: "常に一歩先を行く献立作り。", icon: "📅" },
      hero: { title: "ホームキッチンヒーロー", description: "家庭料理の真のマスター。", icon: "👨‍🍳" }
    },
    ko: {
      starter: { title: "팬트리 입문자", description: "요리 여정을 이제 막 시작했습니다.", icon: "🌱" },
      keeper: { title: "팬트리 지킴이", description: "잘 정리된 주방을 유지합니다.", icon: "📦" },
      weeknight: { title: "평일 요리사", description: "빠르고 효율적인 식사의 달인.", icon: "⏱️" },
      rescue: { title: "레스큐 셰프", description: "있는 재료로 요리하는 전문가.", icon: "🛟" },
      planner: { title: "스마트 플래너", description: "항상 한발 앞선 식단 계획.", icon: "📅" },
      hero: { title: "우리집 주방 영웅", description: "가정 요리의 진정한 고수.", icon: "👨‍🍳" }
    }
  };

  const t = titles[language] || titles.en;

  if (stats.totalCooked >= 50) return t.hero;
  if (stats.mealPlansCreated >= 5) return t.planner;
  if (stats.rescueCount >= 10) return t.rescue;
  if (stats.weeklyCooked >= 4) return t.weeknight;
  if (stats.totalCooked >= 10) return t.keeper;

  return t.starter;
}
