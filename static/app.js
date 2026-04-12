// State
const state = {
    profile: null,
    ingredients: [],
    allergies: [],
    excluded: [],
    cuisines: [],
    fastStart: localStorage.getItem('fastStart') ? parseInt(localStorage.getItem('fastStart')) : null,
    fastGoalHours: parseInt(localStorage.getItem('fastGoalHours') || '23'),
};

// Data store for onclick handlers (avoids inline JSON / XSS risk)
const _dataStore = {};
let _dataId = 0;
function storeData(data) {
    const id = '__d' + (++_dataId);
    _dataStore[id] = data;
    return id;
}
function getData(id) {
    return _dataStore[id];
}

// Fasting timer
let fastingInterval = null;

function startFast() {
    state.fastStart = Date.now();
    localStorage.setItem('fastStart', state.fastStart);
    updateFastingUI();
    toast('Fast started!');
}

function breakFast() {
    state.fastStart = null;
    localStorage.removeItem('fastStart');
    updateFastingUI();
    toast('Fast broken — enjoy your OMAD!');
}

function updateFastingUI() {
    const badge = document.getElementById('fasting-status');
    const bar = document.getElementById('fasting-bar');
    const elapsed = document.getElementById('fast-elapsed');

    if (!state.fastStart) {
        badge.textContent = 'Not fasting';
        badge.className = 'fasting-badge eating';
        bar.style.setProperty('--fast-pct', '0%');
        elapsed.textContent = 'Tap "Start Fast" after your meal';
        return;
    }

    const now = Date.now();
    const elapsedMs = now - state.fastStart;
    const elapsedH = elapsedMs / 3600000;
    const goalH = state.fastGoalHours || 23;
    const pct = Math.min(100, (elapsedH / goalH) * 100);

    const h = Math.floor(elapsedH);
    const m = Math.floor((elapsedH - h) * 60);

    badge.textContent = elapsedH >= goalH ? 'Goal reached!' : 'Fasting';
    badge.className = `fasting-badge ${elapsedH >= goalH ? 'eating' : 'fasting'}`;
    bar.style.setProperty('--fast-pct', pct + '%');
    elapsed.textContent = `${h}h ${m}m / ${goalH}h`;
}

function startFastingTicker() {
    if (fastingInterval) clearInterval(fastingInterval);
    updateFastingUI();
    fastingInterval = setInterval(updateFastingUI, 60000);
}

// --- Navigation ---
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    document.getElementById(tab)?.classList.add('active');
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

    if (tab === 'today') loadDashboard();
    if (tab === 'meals') loadFavorites();
    if (tab === 'progress') { loadWeights(); loadMeals(); loadAchievements(); loadBodyComp(); }
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

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        switchTab(link.dataset.tab);
    });
});

// --- API helpers ---
let _serverOnline = true;
let _healthCheckInterval = null;
function _showOfflineBanner() {
    document.getElementById('offline-banner')?.classList.remove('hidden');
    if (!_healthCheckInterval) {
        _healthCheckInterval = setInterval(async () => {
            try {
                await fetch('/api/health');
                _hideOfflineBanner();
                loadDashboard();
            } catch {}
        }, 5000);
    }
}
function _hideOfflineBanner() {
    _serverOnline = true;
    document.getElementById('offline-banner')?.classList.add('hidden');
    if (_healthCheckInterval) { clearInterval(_healthCheckInterval); _healthCheckInterval = null; }
}
async function api(path, opts = {}) {
    try {
        const res = await fetch(`/api${path}`, {
            headers: { 'Content-Type': 'application/json', ...opts.headers },
            ...opts,
        });
        if (!_serverOnline) _hideOfflineBanner();
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(err.error || 'Request failed');
        }
        return res.json();
    } catch (e) {
        if (e instanceof TypeError) {
            _serverOnline = false;
            _showOfflineBanner();
        }
        throw e;
    }
}

// Toast stacking system
const _activeToasts = [];
function _repositionToasts() {
    let bottom = 24;
    for (let i = _activeToasts.length - 1; i >= 0; i--) {
        _activeToasts[i].style.bottom = bottom + 'px';
        bottom += _activeToasts[i].offsetHeight + 8;
    }
}
function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    _activeToasts.push(el);
    _repositionToasts();
    setTimeout(() => {
        _activeToasts.splice(_activeToasts.indexOf(el), 1);
        el.remove();
        _repositionToasts();
    }, 3500);
}
function toastUndo(msg, undoCallback) {
    const el = document.createElement('div');
    el.className = 'toast success toast-undo';
    el.innerHTML = `<span>${esc(msg)}</span><button class="toast-undo-btn">Undo</button>`;
    document.body.appendChild(el);
    _activeToasts.push(el);
    _repositionToasts();
    let undone = false;
    el.querySelector('.toast-undo-btn').onclick = () => {
        if (undone) return;
        undone = true;
        undoCallback();
        _activeToasts.splice(_activeToasts.indexOf(el), 1);
        el.remove();
        _repositionToasts();
        toast('Undone!');
    };
    setTimeout(() => {
        if (undone) return;
        _activeToasts.splice(_activeToasts.indexOf(el), 1);
        el.remove();
        _repositionToasts();
    }, 5000);
}

function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.dataset.origText = btn.dataset.origText || btn.textContent;
    btn.textContent = loading ? 'Working...' : btn.dataset.origText;
}

// --- Dashboard ---
async function loadDashboard() {
    try {
        const datePicker = document.getElementById('dash-date-picker');
        const today = new Date().toISOString().split('T')[0];
        const targetDate = datePicker?.value || today;
        const heading = document.getElementById('dash-heading');
        if (heading) heading.textContent = targetDate === today ? 'Today' : targetDate;

        const [stats, profile] = await Promise.all([api('/stats?target_date=' + targetDate), api('/profile')]);
        updateKetoModeBadge(profile.diet_type);
        // Adapt labels to diet type
        const isOmad = ['omad', 'keto_omad'].includes(profile.diet_type);
        const logTitle = document.getElementById('log-meal-title');
        if (logTitle) logTitle.textContent = isOmad ? 'Log Your OMAD' : 'Log Your Meal';
        const pct = (val, target) => target > 0 ? Math.min(100, Math.round(val / target * 100)) : 0;

        // Calories
        document.getElementById('stat-cal').textContent = Math.round(stats.calories);
        document.getElementById('stat-cal-target').textContent = `/ ${stats.calorie_target} kcal`;
        document.getElementById('prog-cal').style.width = pct(stats.calories, stats.calorie_target) + '%';

        // Net Carbs (total carbs - fiber) — the key keto metric
        const netCarbs = Math.max(0, (stats.carbs_g || 0) - (stats.fiber_g || 0));
        const carbLimit = profile.net_carb_limit ?? 20;
        document.getElementById('stat-net-carbs').textContent = Math.round(netCarbs) + 'g';
        document.getElementById('stat-carbs-target').textContent = carbLimit === 0 ? 'zero carb' : `/ ${carbLimit}g limit`;
        document.getElementById('prog-carbs').style.width = carbLimit > 0 ? pct(netCarbs, carbLimit) + '%' : (netCarbs > 0 ? '100%' : '0%');

        // Ketosis zone indicator — thresholds adapt to profile carb limit
        const ketoZone = document.getElementById('keto-zone');
        const nearThreshold = carbLimit > 0 ? Math.round(carbLimit * 0.75) : 0;
        if (netCarbs <= nearThreshold) {
            ketoZone.textContent = carbLimit === 0 ? 'Zero Carb' : 'In Ketosis';
            ketoZone.className = 'keto-zone in-ketosis';
        } else if (netCarbs <= carbLimit) {
            ketoZone.textContent = 'Near Limit';
            ketoZone.className = 'keto-zone near-limit';
        } else {
            ketoZone.textContent = 'Over Limit!';
            ketoZone.className = 'keto-zone over-limit';
        }

        // Fat (primary fuel)
        document.getElementById('stat-fat').textContent = Math.round(stats.fat_g) + 'g';
        document.getElementById('stat-fat-target').textContent = `/ ${stats.fat_target_g}g`;
        document.getElementById('prog-fat').style.width = pct(stats.fat_g, stats.fat_target_g) + '%';

        // Protein
        document.getElementById('stat-protein').textContent = Math.round(stats.protein_g) + 'g';
        document.getElementById('stat-protein-target').textContent = `/ ${stats.protein_target_g}g`;
        document.getElementById('prog-protein').style.width = pct(stats.protein_g, stats.protein_target_g) + '%';

        // Fasting timer
        startFastingTicker();

        // Today's meals + mini weight chart (parallel)
        const [mealsResp, weights] = await Promise.all([
            api(`/meals?target_date=${targetDate}`),
            api('/weight?limit=7'),
        ]);
        const meals = mealsResp.meals || mealsResp;
        const container = document.getElementById('dash-meals');
        if (meals.length === 0) {
            container.innerHTML = '<p class="text-muted">No meals logged today</p>';
        } else {
            container.innerHTML = meals.map(m => `
                <div class="meal-history-item">
                    <div class="meal-history-info">
                        <h4>${esc(m.meal_name || 'Meal')}</h4>
                        <p>${esc(truncate(m.meal_description, 80))}</p>
                    </div>
                    <div class="meal-history-macros">
                        <span><span class="macro-dot cal"></span>${Math.round(m.calories || 0)} kcal</span>
                        <span><span class="macro-dot protein"></span>${Math.round(m.protein_g || 0)}g P</span>
                        <span><span class="macro-dot fat"></span>${Math.round(m.fat_g || 0)}g F</span>
                        <span><span class="macro-dot carbs"></span>${Math.round(m.carbs_g || 0)}g C</span>
                    </div>
                </div>
            `).join('');
        }

        renderMiniWeightChart(weights);

        // Render macro donut
        renderMacroDonut(stats, profile);
        // Load meal timing for the selected date
        loadMealTiming(targetDate);

        // Ketosis tracker + daily trackers + favorites + weekly summary + exercises (parallel)
        Promise.all([loadKetosisTracker(profile), loadDailyTrackers(), loadFavorites(), loadWeeklySummary(), loadExerciseButtons(), loadTodayExercises()]);
    } catch (e) {
        console.error('Dashboard load error:', e);
    }
}

function renderMiniWeightChart(weights) {
    const container = document.getElementById('dash-weight-chart');
    if (!weights.length) {
        container.innerHTML = '<p class="text-muted">No weight data yet</p>';
        return;
    }
    const vals = weights.map(w => w.weight_kg).filter(v => v != null && !isNaN(v));
    const min = Math.min(...vals) - 1;
    const max = Math.max(...vals) + 1;
    const range = max - min || 1;

    container.innerHTML = `
        <div class="weight-bars" style="height:70px">
            ${weights.map(w => {
                const h = Math.max(8, ((w.weight_kg - min) / range) * 60);
                const d = w.date.slice(5);
                return `<div class="weight-bar-wrap">
                    <div class="weight-bar-value">${w.weight_kg}</div>
                    <div class="weight-bar" style="height:${h}px" title="${w.date}: ${w.weight_kg}kg"></div>
                    <div class="weight-bar-label">${d}</div>
                </div>`;
            }).join('')}
        </div>
    `;
}

// --- Meal Planner ---
async function generatePlan() {
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
    const container = document.getElementById('plan-results');
    if (!plan.days?.length) {
        container.innerHTML = '<div class="card"><p class="text-muted">No plan generated</p></div>';
        return;
    }

    let html = plan.plan_name ? `<h3 style="margin:16px 0 12px">${esc(plan.plan_name)}</h3>` : '';

    plan.days.forEach(day => {
        html += `<div class="plan-day">
            <div class="plan-day-header">Day ${day.day}</div>
            ${day.meals.map(meal => renderMealCard(meal, day.day)).join('')}
            ${day.daily_totals ? `
                <div class="meal-macros" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
                    <span><span class="macro-dot cal"></span><b>${Math.round(day.daily_totals.calories)}</b> kcal</span>
                    <span><span class="macro-dot protein"></span><b>${Math.round(day.daily_totals.protein_g)}</b>g protein</span>
                    <span><span class="macro-dot fat"></span><b>${Math.round(day.daily_totals.fat_g)}</b>g fat</span>
                    <span><span class="macro-dot carbs"></span><b>${Math.round(day.daily_totals.carbs_g)}</b>g carbs</span>
                </div>
            ` : ''}
        </div>`;
    });

    if (plan.shopping_list?.length) {
        const groceryDataId = storeData({ items: plan.shopping_list, name: plan.plan_name || 'Meal Plan' });
        html += `<div class="card">
            <div class="flex-between"><h3>Shopping List</h3>
            <button class="btn btn-sm btn-secondary" onclick="saveGroceryListFromStore('${groceryDataId}')">Save List</button></div>
            <ul class="shopping-list">${plan.shopping_list.map(i => `<li>${esc(i.quantity)} ${esc(i.item)}</li>`).join('')}</ul>
        </div>`;
    }

    if (plan.tips?.length) {
        html += `<div class="card">
            <h3>Tips</h3>
            <ul class="tips-list">${plan.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>`;
    }

    container.innerHTML = html;
}

let _mealCardId = 0;
function renderMealCard(meal, dayNum) {
    const id = `meal-${dayNum}-${++_mealCardId}`;
    const n = meal.nutrition || {};
    return `<div class="meal-card">
        <h4>${esc(meal.name)}</h4>
        <p>${esc(meal.description || '')}</p>
        ${meal.prep_time_minutes ? `<span class="text-muted" style="font-size:12px">${meal.prep_time_minutes} min</span>` : ''}

        <button class="section-toggle" onclick="toggleSection('${id}-ing')">Ingredients</button>
        <button class="section-toggle" onclick="toggleSection('${id}-steps')">Steps</button>

        <ul id="${id}-ing" class="ingredients-list hidden">
            ${(meal.ingredients || []).map(i => `<li>${esc(i.quantity || '')} ${esc(i.item || i)}</li>`).join('')}
        </ul>
        <ol id="${id}-steps" class="steps-list hidden">
            ${(meal.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}
        </ol>

        <div class="meal-macros">
            <span><span class="macro-dot cal"></span>${Math.round(n.calories || 0)} kcal</span>
            <span><span class="macro-dot protein"></span>${Math.round(n.protein_g || 0)}g P</span>
            <span><span class="macro-dot fat"></span>${Math.round(n.fat_g || 0)}g F</span>
            <span><span class="macro-dot carbs"></span>${Math.round(n.carbs_g || 0)}g C</span>
        </div>

        <button class="btn btn-sm btn-secondary" style="margin-top:8px" onclick="logFromPlanStore('${storeData(meal)}')">Log This Meal</button>
    </div>`;
}

function toggleSection(id) {
    document.getElementById(id)?.classList.toggle('hidden');
}

function logFromPlanStore(dataId) {
    logFromPlan(getData(dataId));
}

async function logFromPlan(meal) {
    const n = meal.nutrition || {};
    const entry = {
        date: new Date().toISOString().split('T')[0],
        meal_name: meal.name,
        meal_description: meal.description || meal.name,
        calories: n.calories || null,
        protein_g: n.protein_g || null,
        fat_g: n.fat_g || null,
        carbs_g: n.carbs_g || null,
        fiber_g: n.fiber_g || null,
    };
    try {
        await api('/meals', { method: 'POST', body: JSON.stringify(entry) });
        toast('Meal logged!');
    } catch (e) {
        toast(e.message, 'error');
    }
}

// --- Recipe Finder ---
function setupTagInput(inputId, tagsId, stateKey) {
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

function renderTags(containerId, stateKey) {
    const container = document.getElementById(containerId);
    container.innerHTML = state[stateKey].map((t, i) =>
        `<span class="tag">${esc(t)}<span class="tag-remove" onclick="removeTag('${stateKey}','${containerId}',${i})">&times;</span></span>`
    ).join('');
}

function removeTag(stateKey, containerId, index) {
    state[stateKey].splice(index, 1);
    renderTags(containerId, stateKey);
}

async function findRecipes() {
    if (!state.ingredients.length) {
        toast('Add at least one ingredient', 'error');
        return;
    }
    const count = parseInt(document.getElementById('recipe-count').value);
    const prefs = document.getElementById('recipe-prefs').value.trim();
    setLoading('btn-find-recipes', true);

    try {
        const result = await api('/suggest-recipes', {
            method: 'POST',
            body: JSON.stringify({
                ingredients: state.ingredients,
                max_recipes: count,
                preferences: prefs || null,
            }),
        });
        renderRecipes(result);
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        setLoading('btn-find-recipes', false);
    }
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

// --- Meal Log ---
async function analyzeMeal() {
    const desc = document.getElementById('meal-desc').value.trim();
    if (!desc) { toast('Describe your meal first', 'error'); return; }

    const btn = document.querySelector('[onclick="analyzeMeal()"]');
    btn.disabled = true;
    btn.textContent = 'Analyzing...';

    try {
        const result = await api('/analyze', {
            method: 'POST',
            body: JSON.stringify({ meal_description: desc }),
        });
        renderAnalysis(result);
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'AI Analyze';
    }
}

function renderAnalysis(data) {
    const container = document.getElementById('analysis-result');
    container.classList.remove('hidden');

    const totals = data.totals || {};
    const compliance = data.diet_compliance || {};

    container.innerHTML = `<div class="analysis-card">
        <h4>Nutritional Analysis: ${esc(data.meal_name || '')}</h4>
        ${data.components?.length ? `
        <table class="analysis-components">
            <tr><th>Item</th><th>Qty</th><th>Cal</th><th>P</th><th>F</th><th>C</th></tr>
            ${data.components.map(c => `<tr>
                <td>${esc(c.item)}</td>
                <td>${esc(c.estimated_quantity || '')}</td>
                <td>${Math.round(c.calories || 0)}</td>
                <td>${Math.round(c.protein_g || 0)}g</td>
                <td>${Math.round(c.fat_g || 0)}g</td>
                <td>${Math.round(c.carbs_g || 0)}g</td>
            </tr>`).join('')}
            <tr style="font-weight:600">
                <td colspan="2">Total</td>
                <td>${Math.round(totals.calories || 0)}</td>
                <td>${Math.round(totals.protein_g || 0)}g</td>
                <td>${Math.round(totals.fat_g || 0)}g</td>
                <td>${Math.round(totals.carbs_g || 0)}g</td>
            </tr>
        </table>` : ''}

        <div style="margin-bottom:8px">
            <span class="compliance-badge ${compliance.fits_diet ? 'fits' : 'doesnt'}">
                ${compliance.fits_diet ? 'Fits your diet' : 'Outside diet parameters'}
            </span>
        </div>
        ${compliance.notes ? `<p class="text-muted" style="margin-bottom:8px">${esc(compliance.notes)}</p>` : ''}

        ${data.suggestions?.length ? `
        <ul class="tips-list" style="margin-top:8px">
            ${data.suggestions.map(s => `<li>${esc(s)}</li>`).join('')}
        </ul>` : ''}

        <button class="btn btn-sm btn-primary" style="margin-top:10px" onclick="applyAnalysisStore('${storeData(totals)}')">Apply to meal log</button>
    </div>`;
}

function applyAnalysisStore(dataId) {
    applyAnalysis(getData(dataId));
}

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

function updateNetCarbs() {
    const carbs = parseFloat(document.getElementById('meal-carbs').value) || 0;
    const fiber = parseFloat(document.getElementById('meal-fiber').value) || 0;
    const net = Math.max(0, carbs - fiber);
    document.getElementById('meal-net-carbs').value = Math.round(net);
}

async function logMeal() {
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
        // Reset form
        document.getElementById('meal-desc').value = '';
        document.getElementById('meal-name').value = '';
        document.getElementById('meal-cal').value = '';
        document.getElementById('meal-protein').value = '';
        document.getElementById('meal-fat').value = '';
        document.getElementById('meal-carbs').value = '';
        document.getElementById('meal-fiber').value = '';
        document.getElementById('meal-net-carbs').value = '';
        document.getElementById('macro-fields').classList.add('hidden');
        document.getElementById('analysis-result').classList.add('hidden');
        loadMeals();
        loadDashboard();
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        setLoading('btn-log-meal', false);
    }
}

const MEALS_PAGE_SIZE = 20;
async function loadMeals(append = false) {
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
        if (!meals.length && !append) {
            container.innerHTML = '<p class="text-muted">No meals logged</p>';
            return;
        }
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
                    <button class="btn-delete" onclick="deleteMeal('${m.id}')" title="Delete">&times;</button>
                </div>
            </div>
        `).join('');
        if (append) {
            container.querySelector('.load-more-btn')?.remove();
            container.insertAdjacentHTML('beforeend', html);
        } else {
            container.innerHTML = html;
        }
        const nextOffset = offset + meals.length;
        container.dataset.offset = nextOffset;
        if (nextOffset < total) {
            container.insertAdjacentHTML('beforeend',
                `<button class="btn btn-sm btn-secondary load-more-btn" onclick="loadMeals(true)" style="margin-top:10px;width:100%">Load more (${total - nextOffset} remaining)</button>`);
        }
    } catch (e) {
        console.error('Load meals error:', e);
    }
}

async function deleteMeal(id) {
    if (!confirm('Delete this meal entry?')) return;
    try {
        // Stash for undo before deleting
        const allMeals = (await api('/meals')).meals || [];
        const stashed = allMeals.find(m => m.id === id);
        await api(`/meals/${id}`, { method: 'DELETE' });
        loadMeals();
        loadDashboard();
        if (stashed) {
            toastUndo('Meal deleted', async () => {
                await api('/meals', { method: 'POST', body: JSON.stringify({
                    date: stashed.date, meal_name: stashed.meal_name, meal_description: stashed.meal_description,
                    calories: stashed.calories, protein_g: stashed.protein_g, fat_g: stashed.fat_g,
                    carbs_g: stashed.carbs_g, fiber_g: stashed.fiber_g,
                }) });
                loadMeals();
                loadDashboard();
            });
        } else {
            toast('Meal deleted');
        }
    } catch (e) {
        toast(e.message, 'error');
    }
}

// --- Weight ---
async function logWeight() {
    const dateVal = document.getElementById('weight-date').value;
    const weightVal = parseFloat(document.getElementById('weight-value').value);
    if (!weightVal) { toast('Enter your weight', 'error'); return; }

    try {
        await api('/weight', {
            method: 'POST',
            body: JSON.stringify({
                date: dateVal || new Date().toISOString().split('T')[0],
                weight_kg: weightVal,
                notes: document.getElementById('weight-notes').value.trim() || null,
            }),
        });
        toast('Weight logged!');
        document.getElementById('weight-value').value = '';
        document.getElementById('weight-notes').value = '';
        loadWeights();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function loadWeights() {
    try {
        const weights = await api('/weight?limit=30');
        renderWeightChart(weights);
        renderWeightHistory(weights);
        loadDeficitSlider();
    } catch (e) {
        console.error('Load weights error:', e);
    }
}

function renderWeightChart(weights) {
    const container = document.getElementById('weight-chart');
    if (!weights.length) {
        container.innerHTML = '<p class="text-muted">No weight data yet. Start logging!</p>';
        return;
    }
    const vals = weights.map(w => w.weight_kg).filter(v => v != null && !isNaN(v));
    const minW = Math.min(...vals) - 0.5;
    const maxW = Math.max(...vals) + 0.5;
    const rangeW = maxW - minW || 1;
    const W = 700, H = 180, padL = 50, padR = 20, padT = 15, padB = 30;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = weights.length;

    // Grid lines + Y labels (5 ticks)
    let gridHtml = '';
    for (let i = 0; i <= 4; i++) {
        const v = minW + (rangeW * i / 4);
        const y = padT + plotH - (plotH * i / 4);
        gridHtml += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="svg-grid"/>`;
        gridHtml += `<text x="${padL - 6}" y="${y + 4}" class="svg-label" text-anchor="end">${v.toFixed(1)}</text>`;
    }

    // Points + polyline
    const points = weights.map((w, i) => {
        const x = n === 1 ? padL + plotW / 2 : padL + (plotW * i / (n - 1));
        const y = padT + plotH - ((w.weight_kg - minW) / rangeW) * plotH;
        return { x, y, w };
    });
    const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
    const dots = points.map(p =>
        `<circle cx="${p.x}" cy="${p.y}" r="4" class="svg-dot"><title>${p.w.date}: ${p.w.weight_kg}kg</title></circle>`
    ).join('');

    // X labels (show every Nth to avoid crowding)
    const step = Math.max(1, Math.floor(n / 8));
    const xLabels = points.filter((_, i) => i % step === 0 || i === n - 1).map(p =>
        `<text x="${p.x}" y="${H - 4}" class="svg-label" text-anchor="middle">${p.w.date.slice(5)}</text>`
    ).join('');

    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="weight-svg" preserveAspectRatio="xMidYMid meet">
        ${gridHtml}
        <polyline points="${polyline}" class="svg-line" fill="none"/>
        ${dots}
        ${xLabels}
    </svg>`;
}

function renderWeightHistory(weights) {
    const container = document.getElementById('weight-history');
    if (!weights.length) {
        container.innerHTML = '';
        return;
    }

    const reversed = [...weights].reverse();
    container.innerHTML = reversed.map((w, i) => {
        const prev = reversed[i + 1];
        let diffHtml = '';
        if (prev) {
            const diff = w.weight_kg - prev.weight_kg;
            const cls = diff < 0 ? 'down' : diff > 0 ? 'up' : 'same';
            diffHtml = `<span class="weight-diff ${cls}">${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg</span>`;
        }
        return `<div class="weight-history-item">
            <span class="weight-date">${w.date}</span>
            <span class="weight-val">${w.weight_kg} kg</span>
            ${diffHtml}
            ${w.notes ? `<span class="text-muted">${esc(w.notes)}</span>` : ''}
            <button class="btn-delete" onclick="deleteWeight('${w.date}')" title="Delete">&times;</button>
        </div>`;
    }).join('');
}

async function deleteWeight(d) {
    if (!confirm('Delete this weight entry?')) return;
    try {
        const weights = await api('/weight?limit=100');
        const stashed = weights.find(w => w.date === d);
        await api(`/weight/${d}`, { method: 'DELETE' });
        loadWeights();
        if (stashed) {
            toastUndo('Weight deleted', async () => {
                await api('/weight', { method: 'POST', body: JSON.stringify({
                    date: stashed.date, weight_kg: stashed.weight_kg, notes: stashed.notes || '',
                }) });
                loadWeights();
            });
        } else {
            toast('Entry deleted');
        }
    } catch (e) {
        toast(e.message, 'error');
    }
}

// Deficit slider state
let deficitData = null;

async function loadDeficitSlider() {
    try {
        const d = await api('/deficit');
        deficitData = d;
        document.getElementById('deficit-slider-wrap').classList.remove('hidden');
        document.getElementById('deficit-empty').classList.add('hidden');

        // Set slider to match current calorie target
        const maxDeficit = Math.min(d.tdee_estimate - 1200, 1200);
        const currentDeficit = d.tdee_estimate - d.calorie_target;
        const pct = Math.round((currentDeficit / maxDeficit) * 100);
        document.getElementById('deficit-slider').value = Math.max(10, Math.min(100, pct));

        onDeficitSlide();
    } catch (e) {
        document.getElementById('deficit-slider-wrap').classList.add('hidden');
        document.getElementById('deficit-empty').classList.remove('hidden');
    }
}

function onDeficitSlide() {
    if (!deficitData) return;
    const slider = document.getElementById('deficit-slider');
    const pct = parseInt(slider.value);
    const tdee = deficitData.tdee_estimate;
    const maxDeficit = Math.min(tdee - 1200, 1200);
    const deficit = Math.round(maxDeficit * pct / 100);
    const calories = tdee - deficit;
    const weeklyLoss = (deficit * 7 / 7700).toFixed(2);
    const toLose = deficitData.to_lose_kg || 0;

    document.getElementById('ds-tdee').textContent = tdee;
    document.getElementById('ds-deficit').textContent = deficit;
    document.getElementById('ds-calories').textContent = calories;
    document.getElementById('ds-weekly').textContent = weeklyLoss;

    if (toLose > 0 && parseFloat(weeklyLoss) > 0) {
        const weeks = toLose / parseFloat(weeklyLoss);
        const months = (weeks / 4.33).toFixed(1);
        if (weeks < 8) {
            document.getElementById('ds-timeline').textContent = Math.round(weeks);
            document.getElementById('ds-timeline-sub').textContent = 'weeks';
        } else {
            document.getElementById('ds-timeline').textContent = months;
            document.getElementById('ds-timeline-sub').textContent = 'months';
        }
    } else {
        document.getElementById('ds-timeline').textContent = '--';
        document.getElementById('ds-timeline-sub').textContent = 'set target weight';
    }

    // Store for apply
    slider.dataset.calories = calories;
}

async function applySliderCalories() {
    const slider = document.getElementById('deficit-slider');
    const calories = parseInt(slider.dataset.calories);
    if (!calories) return;

    try {
        const profile = await api('/profile');
        profile.calorie_target = calories;
        delete profile.api_key;  // don't send key back — server preserves existing
        await api('/profile', { method: 'POST', body: JSON.stringify(profile) });
        toast(`Calorie target set to ${calories} kcal/day`);
        loadDashboard();
    } catch (e) {
        toast(e.message, 'error');
    }
}

async function getWeightInsight() {
    setLoading('btn-weight-insight', true);
    try {
        const result = await api('/weight/insight');
        const container = document.getElementById('weight-insight');
        container.classList.remove('hidden');
        container.innerHTML = `<div class="insight-card">
            <h4>AI Insight — Trend: ${esc(result.trend || 'N/A')}</h4>
            <p>${esc(result.insight || '')}</p>
            ${result.avg_weekly_change_kg ? `<p>Average weekly change: <b>${result.avg_weekly_change_kg > 0 ? '+' : ''}${result.avg_weekly_change_kg} kg</b></p>` : ''}
            ${result.estimated_target_date ? `<p>Estimated target date: <b>${result.estimated_target_date}</b></p>` : ''}
            ${result.recommendations?.length ? `
                <ul>${result.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
            ` : ''}
        </div>`;
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        setLoading('btn-weight-insight', false);
    }
}

// --- Water Tracker ---
function _updateWaterUI(count) {
    const waterTarget = 12;
    document.getElementById('water-count').textContent = count;
    const label = document.getElementById('water-target-label');
    if (label) label.textContent = `${count} / ${waterTarget} glasses (${(count * 0.25).toFixed(1)}L / 3L)`;
}

async function addWater() {
    try {
        const data = await api('/daily-log/water', { method: 'POST' });
        _updateWaterUI(data.water_glasses || 0);
    } catch (e) { toast(e.message, 'error'); }
}

async function removeWater() {
    try {
        const data = await api('/daily-log/water', { method: 'DELETE' });
        _updateWaterUI(data.water_glasses || 0);
    } catch (e) { toast(e.message, 'error'); }
}

// --- Electrolyte Tracker ---
function showElectroForm() {
    document.getElementById('electro-form').classList.toggle('hidden');
}

async function saveElectrolytes() {
    const today = new Date().toISOString().split('T')[0];
    const log = await api('/daily-log?target_date=' + today);
    log.sodium_mg = (log.sodium_mg || 0) + (parseInt(document.getElementById('log-sodium').value) || 0);
    log.potassium_mg = (log.potassium_mg || 0) + (parseInt(document.getElementById('log-potassium').value) || 0);
    log.magnesium_mg = (log.magnesium_mg || 0) + (parseInt(document.getElementById('log-magnesium').value) || 0);
    log.date = today;
    await api('/daily-log', { method: 'POST', body: JSON.stringify(log) });
    document.getElementById('log-sodium').value = '';
    document.getElementById('log-potassium').value = '';
    document.getElementById('log-magnesium').value = '';
    document.getElementById('electro-form').classList.add('hidden');
    toast('Electrolytes logged!');
    await loadDailyTrackers();
}

async function loadDailyTrackers() {
    try {
        const [log, streak] = await Promise.all([
            api('/daily-log'),
            api('/streak'),
        ]);
        // Water
        _updateWaterUI(log.water_glasses || 0);
        // Streak
        document.getElementById('streak-count').textContent = streak.current_streak || 0;
        // Electrolyte targets (keto daily recommendations)
        const ELECTRO_TARGETS = { sodium: 5000, potassium: 3500, magnesium: 400 };
        const pct = (v, t) => t > 0 ? Math.min(100, Math.round((v / t) * 100)) : 0;
        document.getElementById('prog-sodium').style.width = pct(log.sodium_mg || 0, ELECTRO_TARGETS.sodium) + '%';
        document.getElementById('val-sodium').textContent = `${log.sodium_mg || 0} / ${ELECTRO_TARGETS.sodium}`;
        document.getElementById('prog-potassium').style.width = pct(log.potassium_mg || 0, ELECTRO_TARGETS.potassium) + '%';
        document.getElementById('val-potassium').textContent = `${log.potassium_mg || 0} / ${ELECTRO_TARGETS.potassium}`;
        document.getElementById('prog-magnesium').style.width = pct(log.magnesium_mg || 0, ELECTRO_TARGETS.magnesium) + '%';
        document.getElementById('val-magnesium').textContent = `${log.magnesium_mg || 0} / ${ELECTRO_TARGETS.magnesium}`;
    } catch (e) {
        console.error('Daily trackers error:', e);
    }
}

// --- Keto Flu Checker ---
function toggleFluChecker() {
    document.getElementById('flu-checker').classList.toggle('hidden');
}

function setupSymptomButtons() {
    document.querySelectorAll('.symptom-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.classList.toggle('active'));
    });
}

async function checkKetoFlu() {
    const symptoms = [];
    document.querySelectorAll('.symptom-btn.active').forEach(btn => {
        symptoms.push(btn.dataset.symptom);
    });
    if (!symptoms.length) { toast('Select at least one symptom', 'error'); return; }

    setLoading('btn-check-flu', true);
    try {
        const result = await api('/symptoms', {
            method: 'POST',
            body: JSON.stringify({ symptoms }),
        });
        const container = document.getElementById('flu-result');
        container.innerHTML = `<div class="flu-result-card">
            <h4>${result.severity === 'severe' ? '&#9888; ' : ''}${esc(result.diagnosis)}</h4>
            <p class="text-muted" style="margin-bottom:8px">Severity: <b>${esc(result.severity)}</b></p>
            <ul>${(result.remedies || []).map(r => `<li><b>${esc(r.action)}</b> — ${esc(r.why)}</li>`).join('')}</ul>
            ${result.warning ? `<p style="color:var(--red);margin-top:8px;font-size:12px">${esc(result.warning)}</p>` : ''}
        </div>`;
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        setLoading('btn-check-flu', false);
    }
}

// --- Food Database ---
async function loadFoodDB() {
    try {
        const data = await api('/foods');
        renderFoodDB(data.foods);
        const sel = document.getElementById('food-cat-filter');
        if (sel.options.length <= 1) {
            data.categories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                sel.appendChild(opt);
            });
        }
    } catch (e) { console.error('Food DB error:', e); }
}

async function searchFoodDB() {
    const q = document.getElementById('food-search').value;
    const cat = document.getElementById('food-cat-filter').value;
    try {
        const data = await api(`/foods?q=${encodeURIComponent(q)}&cat=${encodeURIComponent(cat)}`);
        renderFoodDB(data.foods);
    } catch (e) { console.error('Food search error:', e); }
}

function renderFoodDB(foods) {
    const container = document.getElementById('food-results');
    if (!foods.length) {
        container.innerHTML = '<p class="text-muted">No foods found</p>';
        return;
    }
    container.innerHTML = foods.map(f => {
        const fid = storeData(f);
        return `<div class="food-item" onclick="addFoodFromStore('${fid}')">
            <div class="food-item-name">${esc(f.name)}</div>
            <div class="food-item-meta">${esc(f.serving)} · ${esc(f.cat)} · <span class="net-badge ${f.net <= 3 ? 'ok' : 'warn'}">${f.net}g NC</span></div>
            <div class="food-item-macros">
                <span>${f.cal} kcal</span>
                <span>${f.fat}g F</span>
                <span>${f.protein}g P</span>
                <span>${f.carbs}g C</span>
            </div>
        </div>`;
    }).join('');
}

function addFoodFromStore(dataId) {
    const f = getData(dataId);
    if (f) addFoodToMeal(f.name, f.cal, f.fat, f.protein, f.carbs, f.fiber);
}

function addFoodToMeal(name, cal, fat, protein, carbs, fiber) {
    // Switch to Today tab and fill the meal form
    switchTab('today');
    document.getElementById('meal-name').value = name;
    document.getElementById('meal-desc').value = name;
    document.getElementById('meal-cal').value = cal;
    document.getElementById('meal-fat').value = fat;
    document.getElementById('meal-protein').value = protein;
    document.getElementById('meal-carbs').value = carbs;
    document.getElementById('meal-fiber').value = fiber;
    updateNetCarbs();
    document.getElementById('macro-fields').classList.remove('hidden');
    toast(`${name} added to meal log`);
}

// --- IF Presets ---
function setIF(hours) {
    document.getElementById('set-fasting-hours').value = hours;
    document.querySelectorAll('.if-preset').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.startsWith(hours + ':') || (hours === 23 && btn.textContent.includes('OMAD')));
    });
}

function highlightActiveIF(hours) {
    document.querySelectorAll('.if-preset').forEach(btn => {
        const btnHours = parseInt(btn.textContent);
        btn.classList.toggle('active', btnHours === hours);
    });
}

// --- Grocery List (from meal plan) ---
function saveGroceryListFromStore(dataId) {
    const d = getData(dataId);
    saveGroceryList(d.items, d.name);
}

async function saveGroceryList(items, planName) {
    try {
        await api('/grocery', {
            method: 'POST',
            body: JSON.stringify({ name: planName || 'Shopping List', items }),
        });
        toast('Grocery list saved!');
    } catch (e) { toast(e.message, 'error'); }
}

// --- Favorites / Quick Re-log ---
async function loadFavorites() {
    try {
        const favs = await api('/favorites?limit=20');
        renderFavorites('saved-meals-today', favs.slice(0, 5));
        renderFavorites('favorites-list', favs);
    } catch (e) {
        console.error('Favorites load error:', e);
    }
}

function renderFavorites(containerId, favs) {
    const container = document.getElementById(containerId);
    if (!favs.length) {
        container.innerHTML = '<p class="text-muted">No favorites yet. Log meals and they\'ll appear here.</p>';
        return;
    }
    container.innerHTML = favs.map(f => {
        const netCarbs = Math.max(0, (f.carbs_g || 0) - (f.fiber_g || 0));
        const favDataId = storeData(f);
        return `<div class="favorite-item" onclick="relogFavoriteStore('${favDataId}')">
            <div class="favorite-info">
                <span class="favorite-name">${esc(f.meal_name || f.meal_description?.slice(0, 40) || 'Meal')}</span>
                <span class="favorite-count">${f.count}x logged</span>
            </div>
            <div class="meal-macros">
                ${f.calories ? `<span><span class="macro-dot cal"></span>${Math.round(f.calories)}</span>` : ''}
                ${f.fat_g ? `<span><span class="macro-dot fat"></span>${Math.round(f.fat_g)}g F</span>` : ''}
                ${f.protein_g ? `<span><span class="macro-dot protein"></span>${Math.round(f.protein_g)}g P</span>` : ''}
                ${f.carbs_g ? `<span><span class="macro-dot carbs"></span>${Math.round(netCarbs)}g NC</span>` : ''}
            </div>
        </div>`;
    }).join('');
}

function relogFavoriteStore(dataId) {
    relogFavorite(getData(dataId));
}

async function relogFavorite(fav) {
    const entry = {
        date: new Date().toISOString().split('T')[0],
        meal_name: fav.meal_name || 'Meal',
        meal_description: fav.meal_description || fav.meal_name || '',
        calories: fav.calories || null,
        protein_g: fav.protein_g || null,
        fat_g: fav.fat_g || null,
        carbs_g: fav.carbs_g || null,
        fiber_g: fav.fiber_g || null,
    };
    try {
        await api('/meals', { method: 'POST', body: JSON.stringify(entry) });
        toast('Meal re-logged!');
        loadDashboard();
    } catch (e) {
        toast(e.message, 'error');
    }
}

// --- Label Scanner ---
async function scanLabel() {
    const fileInput = document.getElementById('label-photo');
    const grams = document.getElementById('label-grams').value;

    if (!fileInput.files.length) {
        toast('Select a photo of the nutrition label', 'error');
        return;
    }

    setLoading('btn-scan-label', true);
    try {
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        if (grams) formData.append('grams', grams);

        const res = await fetch('/api/scan-label', { method: 'POST', body: formData });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Scan failed');
        }
        const data = await res.json();
        renderScanResult(data);
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        setLoading('btn-scan-label', false);
    }
}

function renderScanResult(data) {
    const container = document.getElementById('scan-result');
    container.classList.remove('hidden');
    const n = data.nutrition || {};
    const keto = data.keto_verdict || {};

    container.innerHTML = `<div class="analysis-card" style="margin-top:12px">
        <h4>${esc(data.product_name || 'Scanned Label')}</h4>
        <p class="text-muted" style="margin-bottom:8px">
            Label serving: ${esc(data.serving_size || '?')}
            ${data.user_portion_g ? ` | You ate: <b>${data.user_portion_g}g</b>` : ''}
        </p>

        <table class="analysis-components">
            <tr><th>Nutrient</th><th>Amount</th></tr>
            <tr><td>Calories</td><td><b>${Math.round(n.calories || 0)}</b> kcal</td></tr>
            <tr><td>Fat</td><td>${(n.fat_g || 0).toFixed(1)}g</td></tr>
            <tr><td>Protein</td><td>${(n.protein_g || 0).toFixed(1)}g</td></tr>
            <tr><td>Total Carbs</td><td>${(n.carbs_g || 0).toFixed(1)}g</td></tr>
            <tr><td>Fiber</td><td>${(n.fiber_g || 0).toFixed(1)}g</td></tr>
            <tr style="font-weight:600"><td>Net Carbs</td><td>${(n.net_carbs_g || 0).toFixed(1)}g</td></tr>
            <tr><td>Sugar</td><td>${(n.sugar_g || 0).toFixed(1)}g</td></tr>
            <tr><td>Sodium</td><td>${Math.round(n.sodium_mg || 0)}mg</td></tr>
        </table>

        <div style="margin:10px 0">
            <span class="compliance-badge ${keto.is_keto_friendly ? 'fits' : 'doesnt'}">
                ${keto.is_keto_friendly ? 'Keto Friendly' : 'Not Keto Friendly'}
            </span>
            ${keto.notes ? `<span class="text-muted" style="margin-left:8px;font-size:12px">${esc(keto.notes)}</span>` : ''}
        </div>

        <div class="form-row" style="margin-top:10px">
            <button class="btn btn-sm btn-primary" onclick="applyScanStore('${storeData({ nutrition: n, name: data.product_name || 'Scanned item' })}')">Apply to Meal Log</button>
        </div>
    </div>`;
}

function applyScanStore(dataId) {
    const d = getData(dataId);
    applyScan(d.nutrition, d.name);
}

function applyScan(nutrition, name) {
    document.getElementById('meal-name').value = name;
    document.getElementById('meal-desc').value = name;
    document.getElementById('meal-cal').value = Math.round(nutrition.calories || 0);
    document.getElementById('meal-fat').value = Math.round(nutrition.fat_g || 0);
    document.getElementById('meal-protein').value = Math.round(nutrition.protein_g || 0);
    document.getElementById('meal-carbs').value = Math.round(nutrition.carbs_g || 0);
    document.getElementById('meal-fiber').value = Math.round(nutrition.fiber_g || 0);
    updateNetCarbs();
    document.getElementById('macro-fields').classList.remove('hidden');
    toast('Label values applied to meal log');
}

// --- Settings ---
async function loadSettings() {
    try {
        const p = await api('/profile');
        state.profile = p;

        document.getElementById('set-name').value = p.name || '';
        document.getElementById('set-diet').value = p.diet_type || 'keto_omad';
        document.getElementById('set-calories').value = p.calorie_target || 2000;
        document.getElementById('set-protein').value = p.protein_ratio ?? 25;
        document.getElementById('set-fat').value = p.fat_ratio ?? 70;
        document.getElementById('set-carbs').value = p.carb_ratio ?? 5;
        document.getElementById('set-sex').value = p.sex || 'male';
        document.getElementById('set-age').value = p.age || 30;
        document.getElementById('set-activity').value = p.activity_level || 1.375;
        document.getElementById('set-height').value = p.height_cm || '';
        document.getElementById('set-current-weight').value = p.current_weight_kg || '';
        document.getElementById('set-target-weight').value = p.target_weight_kg || '';

        state.allergies = p.allergies || [];
        state.excluded = p.excluded_ingredients || [];
        state.cuisines = p.cuisine_preferences || [];
        document.getElementById('set-carb-limit').value = p.net_carb_limit ?? 20;
        document.getElementById('set-fasting-hours').value = p.fasting_goal_hours ?? 23;
        document.getElementById('set-keto-start').value = p.keto_start_date || '';
        highlightActiveIF(p.fasting_goal_hours || 23);
        renderKetoPresets();
        renderTags('allergy-tags', 'allergies');
        renderTags('excluded-tags', 'excluded');
        renderTags('cuisine-tags', 'cuisines');

        const status = document.getElementById('api-key-status');
        if (p.api_key_set) {
            status.textContent = `(configured ${p.api_key_hint})`;
            status.style.color = 'var(--accent)';
        } else {
            status.textContent = '(not set)';
            status.style.color = 'var(--red)';
        }
    } catch (e) {
        console.error('Settings load error:', e);
    }
}

async function saveSettings() {
    // parseFloat('0') || default returns the default — use this helper to preserve 0
    const numVal = (id, fb) => { const v = parseFloat(document.getElementById(id).value); return Number.isFinite(v) ? v : fb; };
    const data = {
        name: document.getElementById('set-name').value.trim(),
        diet_type: document.getElementById('set-diet').value,
        calorie_target: parseInt(document.getElementById('set-calories').value) || 2000,
        protein_ratio: numVal('set-protein', 25),
        fat_ratio: numVal('set-fat', 70),
        carb_ratio: numVal('set-carbs', 5),
        sex: document.getElementById('set-sex').value,
        age: parseInt(document.getElementById('set-age').value) || 30,
        activity_level: parseFloat(document.getElementById('set-activity').value) || 1.375,
        height_cm: parseFloat(document.getElementById('set-height').value) || 0,
        current_weight_kg: parseFloat(document.getElementById('set-current-weight').value) || 0,
        target_weight_kg: parseFloat(document.getElementById('set-target-weight').value) || 0,
        allergies: state.allergies,
        excluded_ingredients: state.excluded,
        cuisine_preferences: state.cuisines,
        keto_start_date: document.getElementById('set-keto-start').value || '',
        net_carb_limit: numVal('set-carb-limit', 20),
        fasting_goal_hours: numVal('set-fasting-hours', 23),
        api_key: document.getElementById('set-api-key').value.trim() || '',
    };

    // Update fasting goal
    state.fastGoalHours = data.fasting_goal_hours;
    localStorage.setItem('fastGoalHours', data.fasting_goal_hours);

    // Validate macro ratios
    const total = data.protein_ratio + data.fat_ratio + data.carb_ratio;
    if (Math.abs(total - 100) > 1) {
        toast(`Macro ratios sum to ${total}%, should be 100%`, 'error');
        return;
    }

    try {
        await api('/profile', { method: 'POST', body: JSON.stringify(data) });
        document.getElementById('set-api-key').value = '';
        toast('Settings saved!');
        loadSettings();
        loadDashboard(); // refresh dashboard with new settings
    } catch (e) {
        toast(e.message, 'error');
    }
}

// --- Utilities ---
function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function truncate(s, len) {
    if (!s) return '';
    return s.length > len ? s.slice(0, len) + '...' : s;
}

// --- Ketosis Tracker ---
async function loadKetosisTracker(profile = null) {
    try {
        const data = await api('/ketosis');
        const container = document.getElementById('ketosis-phases');
        const info = document.getElementById('ketosis-info');
        const dayBadge = document.getElementById('ketosis-day-badge');

        if (data.phase === 'not_started') {
            container.innerHTML = '';
            info.innerHTML = `<p class="text-muted">${esc(data.message)}</p>`;
            dayBadge.textContent = '';
            return;
        }

        dayBadge.textContent = `Day ${data.day}`;

        // Phase steps
        container.innerHTML = data.phases.map((p, i) => {
            let cls = 'future';
            if (i < data.current_phase_idx) cls = 'completed';
            if (i === data.current_phase_idx) cls = 'current';
            return `<div class="ketosis-phase ${cls}">
                <div class="ketosis-phase-icon">${p.icon}</div>
                <div class="ketosis-phase-name">${p.name}</div>
            </div>`;
        }).join('');

        // Info
        const fastingNote = data.fasting_bonus ? `<div class="fasting-bonus">${esc(data.fasting_bonus)}</div>` : '';
        const timeEst = data.days_remaining > 0
            ? `<div class="ketosis-eta">~${data.days_remaining} day${data.days_remaining === 1 ? '' : 's'} to full adaptation (Day ${data.adapted_day})</div>`
            : (data.phase === 'adapted' ? '<div class="ketosis-eta adapted">Fat adapted!</div>' : '');
        let html = `<div class="ketosis-tip">${esc(data.icon)} <b>${esc(data.phase_name)}</b> — ${esc(data.desc)}<br><span class="text-muted">${esc(data.tip)}</span>${fastingNote}${timeEst}</div>`;

        if (data.warning) {
            html += `<div class="ketosis-warning">${esc(data.warning)}</div>`;
        }

        // Recent carb compliance mini-chart
        if (data.recent_carbs?.length) {
            const limit = (profile && profile.net_carb_limit) || 20;
            html += `<div class="ketosis-carbs-row">`;
            data.recent_carbs.slice(0, 7).reverse().forEach(c => {
                const cls = c.net_carbs === 0 ? 'empty' : c.net_carbs <= limit ? 'ok' : 'over';
                const label = c.date.slice(5);
                html += `<div class="ketosis-carb-day ${cls}" title="${c.date}: ${c.net_carbs}g" onclick="showDaySnapshot('${c.date}')" style="cursor:pointer">
                    <div>${c.net_carbs}g</div>
                    <div>${label}</div>
                </div>`;
            });
            html += `</div>`;
        }

        // Speed-up tips + accelerators
        if (data.phase !== 'adapted') {
            html += `<div class="speed-tips-section">
                <button class="btn btn-sm btn-secondary" onclick="document.getElementById('speed-tips-list').classList.toggle('hidden')" style="margin-top:10px;width:100%">Speed Up Ketosis</button>
                <div id="speed-tips-list" class="hidden" style="margin-top:8px">
                    ${(data.speed_tips || []).map(t => `<div class="speed-tip">
                        <div class="speed-tip-action">${esc(t.tip)}</div>
                        <div class="speed-tip-why">${esc(t.why)}</div>
                    </div>`).join('')}
                </div>
            </div>`;

            if (data.accelerators?.length) {
                html += `<div class="speed-tips-section">
                    <button class="btn btn-sm btn-secondary" onclick="document.getElementById('accel-list').classList.toggle('hidden')" style="margin-top:8px;width:100%">Ketosis Accelerators</button>
                    <div id="accel-list" class="hidden" style="margin-top:8px">
                        ${data.accelerators.map(a => `<div class="accel-item">
                            <div class="accel-header">
                                <span class="accel-icon">${a.icon}</span>
                                <span class="accel-action">${esc(a.action)}</span>
                                <span class="accel-impact">${esc(a.impact)}</span>
                            </div>
                            <div class="accel-detail">${esc(a.detail)}</div>
                        </div>`).join('')}
                    </div>
                </div>`;
            }
        }

        info.innerHTML = html;
    } catch (e) {
        console.error('Ketosis tracker error:', e);
    }
}

// --- Keto Presets ---
const KETO_PRESETS = [
    { id: 'carnivore', icon: '🥩', name: 'Carnivore', carbs: 0, fat: 75, protein: 25, carbPct: 0, desc: 'Zero carb. Meat, fish, eggs only.' },
    { id: 'ultra_keto', icon: '⚡', name: 'Ultra Keto', carbs: 5, fat: 77, protein: 20, carbPct: 3, desc: 'Hardcore. Deep ketosis guaranteed.' },
    { id: 'strict_keto', icon: '🔥', name: 'Strict Keto', carbs: 10, fat: 75, protein: 20, carbPct: 5, desc: 'Serious fat burner mode.' },
    { id: 'keto_omad', icon: '🎯', name: 'Standard Keto', carbs: 20, fat: 70, protein: 25, carbPct: 5, desc: 'The classic. Most popular.' },
    { id: 'lazy_keto', icon: '😎', name: 'Lazy Keto', carbs: 30, fat: 65, protein: 25, carbPct: 10, desc: 'Relaxed but still effective.' },
    { id: 'keto_lite', icon: '🌿', name: 'Keto Lite', carbs: 50, fat: 55, protein: 25, carbPct: 20, desc: 'Low carb lifestyle. Flexible.' },
];

function renderKetoPresets() {
    const container = document.getElementById('keto-presets');
    if (!container) return;
    const current = document.getElementById('set-diet')?.value || 'keto_omad';

    container.innerHTML = KETO_PRESETS.map(p => `
        <div class="keto-preset ${p.id === current ? 'active' : ''}" onclick="selectKetoPreset('${p.id}')">
            <div class="keto-preset-icon">${p.icon}</div>
            <div class="keto-preset-name">${p.name}</div>
            <div class="keto-preset-carbs">&lt;${p.carbs}g net carbs</div>
            <div class="keto-preset-desc">${p.desc}</div>
        </div>
    `).join('');
}

function selectKetoPreset(id) {
    const preset = KETO_PRESETS.find(p => p.id === id);
    if (!preset) return;

    document.getElementById('set-diet').value = id;
    document.getElementById('set-protein').value = preset.protein;
    document.getElementById('set-fat').value = preset.fat;
    document.getElementById('set-carbs').value = preset.carbPct;
    document.getElementById('set-carb-limit').value = preset.carbs;

    // Verify total = 100
    const total = preset.protein + preset.fat + preset.carbPct;
    if (Math.abs(total - 100) > 1) {
        // Auto-adjust fat to make it 100
        document.getElementById('set-fat').value = 100 - preset.protein - preset.carbPct;
    }

    // Update active state
    document.querySelectorAll('.keto-preset').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.keto-preset').forEach(el => {
        if (el.getAttribute('onclick')?.includes(id)) el.classList.add('active');
    });

    toast(`${preset.icon} ${preset.name} selected — ${preset.carbs}g net carbs`);
    saveSettings();
}

function updateKetoModeBadge(dietType) {
    const badge = document.getElementById('keto-mode-badge');
    if (!badge) return;
    const preset = KETO_PRESETS.find(p => p.id === dietType);
    const subtitle = document.getElementById('logo-sub-text');
    if (preset) {
        badge.textContent = `${preset.icon} ${preset.name}`;
        if (subtitle) subtitle.textContent = preset.name;
    } else {
        badge.textContent = dietType ? dietType.replace(/_/g, ' ') : '';
        if (subtitle) subtitle.textContent = dietType ? dietType.replace(/_/g, ' ') : 'KetoFuel';
    }
}

// --- Exercise Logger ---
let _exerciseTypes = {};
async function loadExerciseButtons() {
    try {
        const data = await api('/exercise-types');
        _exerciseTypes = data.types;
        renderExerciseGrid();
    } catch (e) { console.error('Exercise types error:', e); }
}

function renderExerciseGrid(todayExercises = []) {
    const grid = document.getElementById('exercise-grid');
    if (!grid) return;
    grid.innerHTML = Object.entries(_exerciseTypes).map(([key, ex]) => {
        const count = todayExercises.filter(e => e.type === key).length;
        const maxNote = ex.max_daily ? ` (${count}/${ex.max_daily})` : (count > 0 ? ` (${count}x)` : '');
        return `<button class="exercise-btn" onclick="logExercise('${key}')">
            <span class="exercise-btn-icon">${ex.icon}</span>
            <span class="exercise-btn-name">${esc(ex.name)}${maxNote}</span>
            <span class="exercise-btn-impact">+${ex.bonus} day</span>
        </button>`;
    }).join('');
}

async function logExercise(type) {
    try {
        const result = await api('/log-exercise', {
            method: 'POST',
            body: JSON.stringify({ type }),
        });
        toast(`${result.exercise.icon} ${result.exercise.name} logged! +${result.exercise.bonus} day boost`);
        updateExerciseLog(result.exercises, result.today_total_bonus);
        renderExerciseGrid(result.exercises);  // update counters
        loadKetosisTracker();  // refresh the timeline
    } catch (e) {
        toast(e.message, 'error');
    }
}

function updateExerciseLog(exercises, totalBonus) {
    const badge = document.getElementById('exercise-bonus-badge');
    if (badge) badge.textContent = totalBonus > 0 ? `+${totalBonus} days boost today` : '';
    const log = document.getElementById('exercise-today-log');
    if (!log) return;
    if (!exercises?.length) { log.innerHTML = ''; return; }
    log.innerHTML = `<div class="exercise-log-items">${exercises.map((e, i) =>
        `<span class="exercise-log-item">${e.icon} ${esc(e.name)} <span class="exercise-remove" onclick="removeExercise(${i})">&times;</span></span>`
    ).join('')}
    <button class="btn btn-sm" style="font-size:10px;padding:2px 8px;margin-left:4px;opacity:0.6" onclick="clearExercises()">Clear all</button>
    </div>`;
}

async function removeExercise(index) {
    try {
        const result = await api('/log-exercise?index=' + index, { method: 'DELETE' });
        updateExerciseLog(result.exercises, result.today_total_bonus);
        renderExerciseGrid(result.exercises);
        loadKetosisTracker();
    } catch (e) { toast(e.message, 'error'); }
}

async function clearExercises() {
    try {
        const result = await api('/log-exercise', { method: 'DELETE' });
        updateExerciseLog(result.exercises, result.today_total_bonus);
        renderExerciseGrid(result.exercises);
        loadKetosisTracker();
        toast('Exercises cleared');
    } catch (e) { toast(e.message, 'error'); }
}

async function loadTodayExercises() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const dl = await api('/daily-log?target_date=' + today);
        const exercises = dl.exercises || [];
        const total = exercises.reduce((s, e) => s + (e.bonus_days || 0), 0);
        updateExerciseLog(exercises, Math.round(total * 10) / 10);
        renderExerciseGrid(exercises);  // show counters
    } catch (e) { console.error('Exercise log error:', e); }
}

// --- Macro Donut Chart ---
function renderMacroDonut(stats, profile) {
    const container = document.getElementById('macro-donut');
    if (!container) return;
    const fat = stats.fat_g || 0, protein = stats.protein_g || 0, carbs = stats.carbs_g || 0;
    const total = (fat * 9) + (protein * 4) + (carbs * 4);
    if (total === 0) {
        container.innerHTML = '<svg viewBox="0 0 120 120" class="donut-svg"><circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="12"/><text x="60" y="64" text-anchor="middle" class="donut-center-text">No data</text></svg>';
        return;
    }
    const fatPct = (fat * 9) / total, protPct = (protein * 4) / total, carbPct = (carbs * 4) / total;
    const r = 50, circ = 2 * Math.PI * r;
    const fatLen = fatPct * circ, protLen = protPct * circ, carbLen = carbPct * circ;
    const fatOff = 0, protOff = fatLen, carbOff = fatLen + protLen;
    container.innerHTML = `<svg viewBox="0 0 120 120" class="donut-svg">
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--border)" stroke-width="12"/>
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--amber)" stroke-width="12"
            stroke-dasharray="${fatLen} ${circ - fatLen}" stroke-dashoffset="0" transform="rotate(-90 60 60)"/>
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--blue)" stroke-width="12"
            stroke-dasharray="${protLen} ${circ - protLen}" stroke-dashoffset="${-fatLen}" transform="rotate(-90 60 60)"/>
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--accent)" stroke-width="12"
            stroke-dasharray="${carbLen} ${circ - carbLen}" stroke-dashoffset="${-(fatLen + protLen)}" transform="rotate(-90 60 60)"/>
        <text x="60" y="56" text-anchor="middle" class="donut-center-text">${Math.round(total / 1)}</text>
        <text x="60" y="70" text-anchor="middle" class="donut-center-sub">kcal</text>
    </svg>
    <div class="donut-legend">
        <span><span class="macro-dot fat"></span>Fat ${Math.round(fatPct*100)}%</span>
        <span><span class="macro-dot protein"></span>Prot ${Math.round(protPct*100)}%</span>
        <span><span class="macro-dot carbs"></span>Carb ${Math.round(carbPct*100)}%</span>
    </div>`;
}

// --- Weekly Summary ---
async function loadWeeklySummary() {
    try {
        const ws = await api('/weekly-summary');
        document.getElementById('ws-avg-cal').textContent = ws.avg_calories || '--';
        document.getElementById('ws-avg-carbs').textContent = (ws.avg_net_carbs || 0) + 'g';
        document.getElementById('ws-compliance').textContent = ws.compliance_pct + '%';
        const wc = ws.weight_change_kg;
        document.getElementById('ws-weight').textContent = wc != null ? (wc > 0 ? '+' : '') + wc + ' kg' : '--';
        document.getElementById('ws-weight').className = 'weekly-value' + (wc != null ? (wc < 0 ? ' positive' : wc > 0 ? ' negative' : '') : '');
    } catch (e) { console.error('Weekly summary error:', e); }
}

// --- Meal Timing Heatmap ---
async function loadMealTiming(targetDate) {
    try {
        const data = await api('/meal-timing?target_date=' + targetDate);
        const container = document.getElementById('meal-timing-bar');
        if (!data.timings?.length) {
            container.innerHTML = '<p class="text-muted">No meals logged — timing will appear here</p>';
            return;
        }
        // 24h bar
        let hours = '';
        for (let h = 0; h < 24; h++) {
            const meal = data.timings.find(t => t.hour === h);
            const cls = meal ? 'timing-slot active' : 'timing-slot';
            const label = h % 6 === 0 ? `<span class="timing-label">${h}:00</span>` : '';
            hours += `<div class="${cls}" title="${meal ? esc(meal.meal_name) + ' (' + Math.round(meal.calories || 0) + ' kcal)' : h + ':00'}">${label}</div>`;
        }
        // Eating window calc
        const mealHours = data.timings.map(t => t.hour).sort((a, b) => a - b);
        const windowH = mealHours.length > 1 ? mealHours[mealHours.length - 1] - mealHours[0] : 0;
        container.innerHTML = `<div class="timing-bar">${hours}</div>
            <div class="timing-summary">${data.timings.length} meal${data.timings.length > 1 ? 's' : ''} · ${windowH > 0 ? windowH + 'h eating window' : 'OMAD'}</div>`;
    } catch (e) { console.error('Meal timing error:', e); }
}

// --- Body Composition ---
async function loadBodyComp() {
    try {
        const data = await api('/body-composition');
        const container = document.getElementById('body-comp');
        const leanPct = 100 - data.body_fat_pct;
        container.innerHTML = `<div class="body-comp-grid">
            <div class="body-comp-item">
                <div class="body-comp-value">${data.bmi}</div>
                <div class="body-comp-label">BMI</div>
            </div>
            <div class="body-comp-item">
                <div class="body-comp-value">${data.body_fat_pct}%</div>
                <div class="body-comp-label">Body Fat</div>
            </div>
            <div class="body-comp-item">
                <div class="body-comp-value">${data.fat_mass_kg} kg</div>
                <div class="body-comp-label">Fat Mass</div>
            </div>
            <div class="body-comp-item">
                <div class="body-comp-value">${data.lean_mass_kg} kg</div>
                <div class="body-comp-label">Lean Mass</div>
            </div>
        </div>
        <div class="body-comp-bar-wrap">
            <div class="body-comp-bar">
                <div class="body-comp-lean" style="width:${leanPct}%">${leanPct.toFixed(0)}% lean</div>
                <div class="body-comp-fat" style="width:${data.body_fat_pct}%">${data.body_fat_pct}% fat</div>
            </div>
        </div>
        <p class="text-muted" style="font-size:11px;margin-top:6px">${esc(data.method)}</p>`;
    } catch (e) {
        const container = document.getElementById('body-comp');
        if (container) container.innerHTML = '<p class="text-muted">Set height & weight in Settings to see body composition.</p>';
    }
}

// --- Achievements ---
async function loadAchievements() {
    try {
        const data = await api('/achievements');
        const container = document.getElementById('achievements-grid');
        container.innerHTML = data.badges.map(b => `
            <div class="badge-item ${b.earned ? 'earned' : 'locked'}">
                <div class="badge-icon">${b.earned ? b.icon : '🔒'}</div>
                <div class="badge-name">${esc(b.name)}</div>
                <div class="badge-desc">${esc(b.desc)}</div>
            </div>
        `).join('');
    } catch (e) { console.error('Achievements error:', e); }
}

// --- Daily Snapshot Modal ---
async function showDaySnapshot(dateStr) {
    try {
        const data = await api('/daily-snapshot?target_date=' + dateStr);
        const s = data.stats || {};
        const log = data.daily_log || {};
        const meals = data.meals || [];
        const net = Math.max(0, (s.carbs_g || 0) - (s.fiber_g || 0));
        document.getElementById('snapshot-title').textContent = dateStr;
        document.getElementById('snapshot-body').innerHTML = `
            <div class="snapshot-stats">
                <span>${Math.round(s.calories || 0)} kcal</span>
                <span>${Math.round(s.fat_g || 0)}g F</span>
                <span>${Math.round(s.protein_g || 0)}g P</span>
                <span>${Math.round(net)}g NC</span>
            </div>
            <div class="snapshot-trackers">
                <span>💧 ${log.water_glasses || 0} glasses</span>
                <span>Na: ${log.sodium_mg || 0}mg</span>
                <span>K: ${log.potassium_mg || 0}mg</span>
                <span>Mg: ${log.magnesium_mg || 0}mg</span>
            </div>
            ${meals.length ? `<h4 style="margin:10px 0 6px">Meals</h4>
            ${meals.map(m => `<div class="snapshot-meal">
                <b>${esc(m.meal_name || 'Meal')}</b> — ${esc(truncate(m.meal_description, 60))}
                <span class="text-muted">${Math.round(m.calories || 0)} kcal</span>
            </div>`).join('')}` : '<p class="text-muted">No meals logged</p>'}`;
        document.getElementById('snapshot-modal').classList.remove('hidden');
    } catch (e) { toast(e.message, 'error'); }
}

// --- Theme ---
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('theme-icon').innerHTML = next === 'light' ? '&#9728;' : '&#9790;';
}

function loadTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('theme-icon').innerHTML = saved === 'light' ? '&#9728;' : '&#9790;';
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = ['meal-date', 'weight-date', 'dash-date-picker'];
    dateInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = today;
    });

    // Setup tag inputs
    setupTagInput('ingredient-input', 'ingredient-tags', 'ingredients');
    setupTagInput('allergy-input', 'allergy-tags', 'allergies');
    setupTagInput('excluded-input', 'excluded-tags', 'excluded');
    setupTagInput('cuisine-input', 'cuisine-tags', 'cuisines');

    // Net carbs auto-calculation
    ['meal-carbs', 'meal-fiber'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateNetCarbs);
    });

    // Restore fasting goal from localStorage
    state.fastGoalHours = parseInt(localStorage.getItem('fastGoalHours') || '23');

    // Setup symptom buttons
    setupSymptomButtons();

    // Load today tab
    loadDashboard();
    loadFavorites();
});
