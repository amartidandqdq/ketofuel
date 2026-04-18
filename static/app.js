// KetoFuel — ES module entry point. Imports all modules and assigns to window for onclick handlers.

import { state, storeData, getData, api, toast, toastUndo, setLoading, esc, truncate, clearDataStore } from './modules/core.js';
import { startFast, breakFast, startFastingTicker, updateFastingUI, loadFastingHistory } from './modules/fasting.js';
import { loadDashboard, loadProteinStatus, renderMacroDonut } from './modules/dashboard.js';
import { generatePlan, logFromPlanStore, toggleSection, setupTagInput, renderTags, removeTag, findRecipes,
         analyzeMeal, applyAnalysisStore, updateNetCarbs, logMeal, loadMeals, deleteMeal,
         loadSavedPlans, savePlanFromStore } from './modules/meals.js';
import { logWeight, loadWeights, deleteWeight, loadDeficitSlider, onDeficitSlide,
         applySliderCalories, getWeightInsight } from './modules/weight.js';
import { addWater, removeWater, showElectroForm, saveElectrolytes, loadDailyTrackers,
         toggleFluChecker, setupSymptomButtons, checkKetoFlu } from './modules/trackers.js';
import { loadFoodDB, searchFoodDB, addFoodFromStore, addFoodToMeal, setIF, highlightActiveIF,
         saveGroceryListFromStore, loadFavorites, relogFavoriteStore, scanLabel, applyScanStore,
         lookupBarcode, searchOpenFoodFacts } from './modules/food.js';
import { loadKetosisTracker, renderKetoPresets, selectKetoPreset, updateKetoModeBadge,
         loadExerciseButtons, renderExerciseGrid, logExercise, removeExercise, clearExercises,
         loadTodayExercises } from './modules/ketosis.js';
import { loadSettings, saveSettings } from './modules/settings.js';
import { loadBodyComp, loadAchievements, showDaySnapshot, toggleTheme, loadTheme, loadMacroTrends, loadComplianceStreaks, importBackup, shareAchievements, setupPWAInstall, installPWA, dismissPWA } from './modules/progress.js';

// --- Assign all onclick-accessible functions to window ---
Object.assign(window, {
    // Core
    storeData, getData, esc, truncate,
    // Nav
    switchTab, switchSubTab,
    // Fasting
    startFast, breakFast, loadFastingHistory,
    // Dashboard
    loadDashboard,
    // Meals
    generatePlan, logFromPlanStore, toggleSection, renderTags, removeTag, findRecipes,
    analyzeMeal, applyAnalysisStore, updateNetCarbs, logMeal, loadMeals, deleteMeal, loadSavedPlans, savePlanFromStore,
    // Weight
    logWeight, loadWeights, deleteWeight, applySliderCalories, getWeightInsight, onDeficitSlide,
    // Trackers
    addWater, removeWater, showElectroForm, saveElectrolytes, loadDailyTrackers,
    toggleFluChecker, checkKetoFlu,
    // Food
    loadFoodDB, searchFoodDB, addFoodFromStore, addFoodToMeal, setIF, highlightActiveIF,
    saveGroceryListFromStore, loadFavorites, relogFavoriteStore, scanLabel, applyScanStore, lookupBarcode, searchOpenFoodFacts,
    // Ketosis
    loadKetosisTracker, renderKetoPresets, selectKetoPreset, updateKetoModeBadge,
    logExercise, removeExercise, clearExercises, loadExerciseButtons, loadTodayExercises,
    // Settings
    loadSettings, saveSettings,
    // Progress
    loadBodyComp, loadAchievements, showDaySnapshot, toggleTheme, loadMacroTrends, loadComplianceStreaks, importBackup, shareAchievements, installPWA, dismissPWA,
});

// --- Navigation ---
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => {
        el.classList.remove('active');
        el.setAttribute('aria-selected', 'false');
    });
    document.getElementById(tab)?.classList.add('active');
    const activeLink = document.querySelector(`[data-tab="${tab}"]`);
    activeLink?.classList.add('active');
    activeLink?.setAttribute('aria-selected', 'true');

    if (tab === 'today') loadDashboard();
    if (tab === 'meals') { loadFavorites(); loadSavedPlans(); }
    if (tab === 'progress') { loadWeights(); loadMeals(); loadAchievements(); loadBodyComp(); loadMacroTrends(); loadComplianceStreaks(); }
    if (tab === 'settings') loadSettings();
}

function switchSubTab(parentTab, subTab) {
    const parent = document.getElementById(parentTab);
    if (!parent) return;
    parent.querySelectorAll('.sub-content').forEach(el => el.classList.remove('active'));
    parent.querySelectorAll('.sub-tab').forEach(el => el.classList.remove('active'));
    document.getElementById(`sub-${subTab}`)?.classList.add('active');
    parent.querySelector(`[data-subtab="${subTab}"]`)?.classList.add('active');
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();

    const today = new Date().toISOString().split('T')[0];
    ['meal-date', 'weight-date', 'dash-date-picker'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = today;
    });

    setupTagInput('ingredient-input', 'ingredient-tags', 'ingredients');
    setupTagInput('allergy-input', 'allergy-tags', 'allergies');
    setupTagInput('excluded-input', 'excluded-tags', 'excluded');
    setupTagInput('cuisine-input', 'cuisine-tags', 'cuisines');

    ['meal-carbs', 'meal-fiber'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateNetCarbs);
    });

    state.fastGoalHours = parseInt(localStorage.getItem('fastGoalHours') || '23');
    setupSymptomButtons();

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            switchTab(link.dataset.tab);
        });
    });

    // POURQUOI: Close modals with Escape key for keyboard accessibility
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
        }
    });

    loadDashboard();
    loadFavorites();
    setupPWAInstall();
});
