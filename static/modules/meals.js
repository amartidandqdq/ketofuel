// Meals — plan generation, recipes, tag inputs, analysis, logging, history
import { api, esc, storeData, getData, toast, toastUndo, setLoading, state, truncate } from './core.js';

// --- Meal Planner ---
export async function generatePlan() {
    const days = parseInt(document.getElementById('plan-days').value);
    const prefs = document.getElementById('plan-prefs').value.trim();
    setLoading('btn-generate-plan', true);
    try {
        const result = await api('/generate-plan', {
            method: 'POST',
            body: JSON.stringify({ days, preferences: prefs || null }),
        });
        renderPlan(result);
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        setLoading('btn-generate-plan', false);
    }
}

function renderPlan(plan) {
    const container = document.getElementById('plan-result');
    if (!plan.days?.length) {
        container.innerHTML = '<p class="text-muted">No plan generated</p>';
        return;
    }
    container.innerHTML = plan.days.map((day, i) => `
        <div class="plan-day">
            <h4>Day ${i + 1}</h4>
            ${day.meals.map(m => renderMealCard(m, i + 1)).join('')}
            ${day.daily_totals ? `
            <div class="plan-day-totals">
                <span>${Math.round(day.daily_totals.calories || 0)} kcal</span>
                <span>${Math.round(day.daily_totals.protein_g || 0)}g P</span>
                <span>${Math.round(day.daily_totals.fat_g || 0)}g F</span>
                <span>${Math.round(day.daily_totals.carbs_g || 0)}g C</span>
            </div>` : ''}
        </div>
    `).join('');

    if (plan.shopping_list?.length) {
        const groceryId = storeData({ items: plan.shopping_list.map(i => ({ item: i.item || i, quantity: i.quantity || '', checked: false })), name: 'OMAD Plan' });
        container.innerHTML += `<div class="plan-shopping">
            <h4>Shopping List</h4>
            <ul>${plan.shopping_list.map(i => `<li>${esc(i.item || i)}${i.quantity ? ` — ${esc(i.quantity)}` : ''}</li>`).join('')}</ul>
            <button class="btn btn-sm btn-secondary" onclick="saveGroceryListFromStore('${groceryId}')">Save to Grocery Lists</button>
        </div>`;
    }
    if (plan.tips?.length) {
        container.innerHTML += `<div class="plan-tips"><h4>Tips</h4><ul>${plan.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
    }
    const planId = storeData(plan);
    container.innerHTML += `<button class="btn btn-primary" style="margin-top:12px" onclick="savePlanFromStore('${planId}')">Save This Plan</button>`;
}

function renderMealCard(meal, dayNum) {
    const n = meal.nutrition || {};
    const id = storeData(meal);
    return `<div class="meal-card">
        <div class="meal-card-header">
            <h5>${esc(meal.name)}</h5>
            <button class="btn btn-sm btn-primary" onclick="logFromPlanStore('${id}')">Log This</button>
        </div>
        <p class="text-muted" style="font-size:13px">${esc(meal.description || '')}</p>
        ${meal.ingredients?.length ? `<div class="meal-ingredients">${meal.ingredients.map(i => `<span class="ingredient-badge">${esc(i)}</span>`).join('')}</div>` : ''}
        <div class="meal-macros">
            <span><span class="macro-dot cal"></span>${Math.round(n.calories || 0)} kcal</span>
            <span><span class="macro-dot protein"></span>${Math.round(n.protein_g || 0)}g P</span>
            <span><span class="macro-dot fat"></span>${Math.round(n.fat_g || 0)}g F</span>
            <span><span class="macro-dot carbs"></span>${Math.round(n.carbs_g || 0)}g C</span>
        </div>
    </div>`;
}

export async function loadSavedPlans() {
    try {
        const plans = await api('/plans');
        const container = document.getElementById('saved-plans');
        if (!container) return;
        if (!plans?.length) { container.innerHTML = '<p class="text-muted">No saved plans yet</p>'; return; }
        container.innerHTML = plans.map(p => {
            const dayCount = p.days?.length || 0;
            const savedDate = p.saved_at ? new Date(p.saved_at).toLocaleDateString() : '';
            return `<div class="saved-plan-item"><div class="flex-between"><strong>${esc(p.plan_name || dayCount + '-day plan')}</strong><span class="text-muted" style="font-size:11px">${savedDate}</span></div><div class="text-muted" style="font-size:12px">${dayCount} day${dayCount > 1 ? 's' : ''}</div></div>`;
        }).join('');
    } catch (e) { console.error('Saved plans error:', e); }
}

export function savePlanFromStore(dataId) { savePlanData(getData(dataId)); }
async function savePlanData(plan) {
    try {
        await api('/plans', { method: 'POST', body: JSON.stringify({ plan_name: plan.plan_name || 'OMAD Plan', days: plan.days || [], shopping_list: plan.shopping_list || [], tips: plan.tips || [] }) });
        toast('Plan saved!');
        loadSavedPlans();
    } catch (e) { toast(e.message, 'error'); }
}

export function toggleSection(id) {
    document.getElementById(id)?.classList.toggle('hidden');
}

export function logFromPlanStore(dataId) {
    logFromPlan(getData(dataId));
}

async function logFromPlan(meal) {
    const n = meal.nutrition || {};
    const entry = {
        date: document.getElementById('meal-date')?.value || new Date().toISOString().split('T')[0],
        meal_name: meal.name,
        meal_description: meal.description || meal.name,
        calories: n.calories || null, protein_g: n.protein_g || null,
        fat_g: n.fat_g || null, carbs_g: n.carbs_g || null, fiber_g: n.fiber_g || null,
    };
    try {
        await api('/meals', { method: 'POST', body: JSON.stringify(entry) });
        toast('Meal logged!');
    } catch (e) { toast(e.message, 'error'); }
}

// --- Tag Inputs ---
export function setupTagInput(inputId, tagsId, stateKey) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && input.value.trim()) {
            e.preventDefault();
            const val = input.value.trim();
            if (!state[stateKey].includes(val)) {
                state[stateKey].push(val);
                renderTags(tagsId, stateKey);
            }
            input.value = '';
        }
    });
}

export function renderTags(containerId, stateKey) {
    const container = document.getElementById(containerId);
    container.innerHTML = state[stateKey].map((t, i) =>
        `<span class="tag">${esc(t)}<span class="tag-remove" onclick="removeTag('${stateKey}','${containerId}',${i})">&times;</span></span>`
    ).join('');
}

export function removeTag(stateKey, containerId, index) {
    state[stateKey].splice(index, 1);
    renderTags(containerId, stateKey);
}

// --- Recipe Finder ---
export async function findRecipes() {
    if (!state.ingredients.length) { toast('Add at least one ingredient', 'error'); return; }
    const count = parseInt(document.getElementById('recipe-count').value);
    const prefs = document.getElementById('recipe-prefs').value.trim();
    setLoading('btn-find-recipes', true);
    try {
        const result = await api('/suggest-recipes', {
            method: 'POST',
            body: JSON.stringify({ ingredients: state.ingredients, max_recipes: count, preferences: prefs || null }),
        });
        renderRecipes(result);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading('btn-find-recipes', false); }
}

function renderRecipes(data) {
    const container = document.getElementById('recipe-results');
    if (!data.recipes?.length) {
        container.innerHTML = '<div class="card"><p class="text-muted">No recipes found</p></div>';
        return;
    }
    container.innerHTML = data.recipes.map(r => {
        const n = r.nutrition || {};
        const id = `recipe-${r.name?.replace(/\s/g, '')}`;
        return `<div class="recipe-card">
            <h4>${esc(r.name)}</h4>
            <div class="recipe-meta">
                ${r.prep_time_minutes ? `<span>${r.prep_time_minutes} min</span>` : ''}
                ${r.difficulty ? `<span>${esc(r.difficulty)}</span>` : ''}
            </div>
            <p style="font-size:13px;color:var(--text-secondary);margin-bottom:10px">${esc(r.description || '')}</p>
            <div class="recipe-ingredients-used">
                ${(r.uses_ingredients || []).map(i => `<span class="ingredient-badge used">${esc(i)}</span>`).join('')}
                ${(r.additional_ingredients || []).map(i => `<span class="ingredient-badge extra">+ ${esc(i.item || i)}</span>`).join('')}
            </div>
            <button class="section-toggle" onclick="toggleSection('${id}-steps')">Steps</button>
            <ol id="${id}-steps" class="steps-list hidden">
                ${(r.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}
            </ol>
            <div class="meal-macros">
                <span><span class="macro-dot cal"></span>${Math.round(n.calories || 0)} kcal</span>
                <span><span class="macro-dot protein"></span>${Math.round(n.protein_g || 0)}g P</span>
                <span><span class="macro-dot fat"></span>${Math.round(n.fat_g || 0)}g F</span>
                <span><span class="macro-dot carbs"></span>${Math.round(n.carbs_g || 0)}g C</span>
            </div>
        </div>`;
    }).join('');
}

// --- Meal Analysis + Logging ---
export async function analyzeMeal() {
    const desc = document.getElementById('meal-desc').value.trim();
    if (!desc) { toast('Describe your meal first', 'error'); return; }
    const btn = document.querySelector('[onclick="analyzeMeal()"]');
    btn.disabled = true; btn.textContent = 'Analyzing...';
    try {
        const result = await api('/analyze', { method: 'POST', body: JSON.stringify({ meal_description: desc }) });
        renderAnalysis(result);
    } catch (e) { toast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'AI Analyze'; }
}

function renderAnalysis(data) {
    const container = document.getElementById('analysis-result');
    container.classList.remove('hidden');
    const totals = data.totals || {};
    const compliance = data.diet_compliance || {};
    container.innerHTML = `<div class="analysis-card">
        <h4>Nutritional Analysis: ${esc(data.meal_name || '')}</h4>
        ${data.components?.length ? `<table class="analysis-components">
            <tr><th>Item</th><th>Qty</th><th>Cal</th><th>P</th><th>F</th><th>C</th></tr>
            ${data.components.map(c => `<tr><td>${esc(c.item)}</td><td>${esc(c.estimated_quantity || '')}</td><td>${Math.round(c.calories || 0)}</td><td>${Math.round(c.protein_g || 0)}g</td><td>${Math.round(c.fat_g || 0)}g</td><td>${Math.round(c.carbs_g || 0)}g</td></tr>`).join('')}
            <tr style="font-weight:600"><td colspan="2">Total</td><td>${Math.round(totals.calories || 0)}</td><td>${Math.round(totals.protein_g || 0)}g</td><td>${Math.round(totals.fat_g || 0)}g</td><td>${Math.round(totals.carbs_g || 0)}g</td></tr>
        </table>` : ''}
        <div style="margin-bottom:8px"><span class="compliance-badge ${compliance.fits_diet ? 'fits' : 'doesnt'}">${compliance.fits_diet ? 'Fits your diet' : 'Outside diet parameters'}</span></div>
        ${compliance.notes ? `<p class="text-muted" style="margin-bottom:8px">${esc(compliance.notes)}</p>` : ''}
        ${data.suggestions?.length ? `<ul class="tips-list" style="margin-top:8px">${data.suggestions.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
        <button class="btn btn-sm btn-primary" style="margin-top:10px" onclick="applyAnalysisStore('${storeData(totals)}')">Apply to meal log</button>
    </div>`;
}

export function applyAnalysisStore(dataId) { applyAnalysis(getData(dataId)); }

function applyAnalysis(totals) {
    document.getElementById('meal-cal').value = Math.round(totals.calories || 0);
    document.getElementById('meal-fat').value = Math.round(totals.fat_g || 0);
    document.getElementById('meal-protein').value = Math.round(totals.protein_g || 0);
    document.getElementById('meal-carbs').value = Math.round(totals.carbs_g || 0);
    document.getElementById('meal-fiber').value = Math.round(totals.fiber_g || 0);
    updateNetCarbs();
    document.getElementById('macro-fields').classList.remove('hidden');
    toast('Nutritional values applied');
}

export function updateNetCarbs() {
    const carbs = parseFloat(document.getElementById('meal-carbs').value) || 0;
    const fiber = parseFloat(document.getElementById('meal-fiber').value) || 0;
    document.getElementById('meal-net-carbs').value = Math.round(Math.max(0, carbs - fiber));
}

export async function logMeal() {
    const desc = document.getElementById('meal-desc').value.trim();
    if (!desc) { toast('Describe your meal', 'error'); return; }
    const entry = {
        date: document.getElementById('meal-date').value || new Date().toISOString().split('T')[0],
        meal_name: document.getElementById('meal-name').value.trim() || 'Meal',
        meal_description: desc,
        calories: parseFloat(document.getElementById('meal-cal').value) || null,
        protein_g: parseFloat(document.getElementById('meal-protein').value) || null,
        fat_g: parseFloat(document.getElementById('meal-fat').value) || null,
        carbs_g: parseFloat(document.getElementById('meal-carbs').value) || null,
        fiber_g: parseFloat(document.getElementById('meal-fiber').value) || null,
    };
    setLoading('btn-log-meal', true);
    try {
        await api('/meals', { method: 'POST', body: JSON.stringify(entry) });
        toast('Meal logged!');
        ['meal-desc','meal-name','meal-cal','meal-protein','meal-fat','meal-carbs','meal-fiber','meal-net-carbs'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('macro-fields').classList.add('hidden');
        document.getElementById('analysis-result').classList.add('hidden');
        window.loadMeals?.();
        window.loadDashboard?.();
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading('btn-log-meal', false); }
}

// --- Meal History ---
const MEALS_PAGE_SIZE = 20;
export async function loadMeals(append = false) {
    const dateInput = document.getElementById('history-date');
    const target = dateInput?.value || '';
    const container = document.getElementById('meal-history');
    const offset = append ? parseInt(container.dataset.offset || '0') : 0;
    try {
        let url = `/meals?limit=${MEALS_PAGE_SIZE}&offset=${offset}`;
        if (target) url += `&target_date=${target}`;
        const resp = await api(url);
        const meals = resp.meals || [];
        const total = resp.total || 0;
        _lastLoadedMeals = append ? _lastLoadedMeals.concat(meals) : meals;
        if (!meals.length && !append) { container.innerHTML = '<p class="text-muted">No meals logged</p>'; return; }
        const html = meals.map(m => `
            <div class="meal-history-item">
                <div class="meal-history-info">
                    <h4>${esc(m.meal_name || 'Meal')} <span class="text-muted">${m.date}</span></h4>
                    <p>${esc(truncate(m.meal_description, 100))}</p>
                </div>
                <div class="meal-history-macros">
                    ${m.calories ? `<span><span class="macro-dot cal"></span>${Math.round(m.calories)} kcal</span>` : ''}
                    ${m.fat_g ? `<span><span class="macro-dot fat"></span>${Math.round(m.fat_g)}g F</span>` : ''}
                    ${m.protein_g ? `<span><span class="macro-dot protein"></span>${Math.round(m.protein_g)}g P</span>` : ''}
                    ${m.carbs_g ? `<span><span class="macro-dot carbs"></span>${Math.round(Math.max(0, (m.carbs_g||0) - (m.fiber_g||0)))}g NC</span>` : ''}
                </div>
                <button class="btn-delete" onclick="deleteMeal('${m.id}')" title="Supprimer">&times;</button>
            </div>
        `).join('');
        if (append) { container.querySelector('.load-more-btn')?.remove(); container.insertAdjacentHTML('beforeend', html); }
        else { container.innerHTML = html; }
        const nextOffset = offset + meals.length;
        container.dataset.offset = nextOffset;
        if (nextOffset < total) {
            container.insertAdjacentHTML('beforeend',
                `<button class="btn btn-sm btn-secondary load-more-btn" onclick="loadMeals(true)" style="margin-top:10px;width:100%">Load more (${total - nextOffset} remaining)</button>`);
        }
    } catch (e) { console.error('Load meals error:', e); }
}

// POURQUOI: Cache last loaded meals for undo without re-fetching all meals
let _lastLoadedMeals = [];
export function _setLastLoadedMeals(meals) { _lastLoadedMeals = meals; }

export async function deleteMeal(id) {
    if (!confirm('Delete this meal entry?')) return;
    try {
        // Use cached meals from last render instead of fetching all
        const stashed = _lastLoadedMeals.find(m => m.id === id);
        await api(`/meals/${id}`, { method: 'DELETE' });
        window.loadMeals?.();
        window.loadDashboard?.();
        if (stashed) {
            toastUndo('Meal deleted', async () => {
                await api('/meals', { method: 'POST', body: JSON.stringify({
                    date: stashed.date, meal_name: stashed.meal_name, meal_description: stashed.meal_description,
                    calories: stashed.calories, protein_g: stashed.protein_g, fat_g: stashed.fat_g,
                    carbs_g: stashed.carbs_g, fiber_g: stashed.fiber_g,
                }) });
                window.loadMeals?.();
                window.loadDashboard?.();
            });
        } else { toast('Meal deleted'); }
    } catch (e) { toast(e.message, 'error'); }
}
