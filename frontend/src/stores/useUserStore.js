import { create } from "zustand";
import { getGamificationSummary } from "../api/gamificationApi";

const initialGamification = {
  totalPoints: 0,
  level: 1,
  pointsInLevel: 0,
  streakDays: 0,
  achievementCount: 0,
  recentEvents: [],
};

const useUserStore = create((set) => ({
  gamification: initialGamification,
  loadingGamification: false,
  gamificationError: "",

  setGamification(summary) {
    set({ gamification: summary || initialGamification, gamificationError: "" });
  },

  async refreshGamification() {
    try {
      set({ loadingGamification: true, gamificationError: "" });
      const summary = await getGamificationSummary();
      set({ gamification: summary || initialGamification, loadingGamification: false });
      return summary;
    } catch (error) {
      set({ loadingGamification: false, gamificationError: error.message || "Không tải được EXP" });
      return null;
    }
  },
}));

export default useUserStore;
