// State
const state = {
    profile: null,
    ingredients: [],
    allergies: [],
    excluded: [],
    cuisines: [],
};

// --- Navigation ---
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    document.getElementById(tab)?.classList.add('active');
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

    if (tab === 'dashboard') loadDashboard();
    if (tab === 'tracker') loadMeals();
    if (tab === 'weight') loadWeights();
    if (tab === 'settings') loadSettings();
}

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        switchTab(link.dataset.tab);
    });
});

// --- API helpers ---
async function api(path, opts = {}) {
    const res = await fetch(`/api${path}`, {
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Request failed');
    }
    return res.json();
}

function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
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
        const stats = await api('/stats');
        const pct = (val, target) => target > 0 ? Math.min(100, Math.round(val / target * 100)) : 0;

        document.getElementById('stat-cal').textContent = Math.round(stats.calories);
        document.getElementById('stat-cal-target').textContent = `/ ${stats.calorie_target} kcal`;
        document.getElementById('prog-cal').style.width = pct(stats.calories, stats.calorie_target) + '%';

        document.getElementById('stat-protein').textContent = Math.round(stats.protein_g) + 'g';
        document.getElementById('stat-protein-target').textContent = `/ ${stats.protein_target_g}g`;
        document.getElementById('prog-protein').style.width = pct(stats.protein_g, stats.protein_target_g) + '%';

        document.getElementById('stat-fat').textContent = Math.round(stats.fat_g) + 'g';
        document.getElementById('stat-fat-target').textContent = `/ ${stats.fat_target_g}g`;
        document.getElementById('prog-fat').style.width = pct(stats.fat_g, stats.fat_target_g) + '%';

        document.getElementById('stat-carbs').textContent = Math.round(stats.carbs_g) + 'g';
        document.getElementById('stat-carbs-target').textContent = `/ ${stats.carbs_target_g}g`;
        document.getElementById('prog-carbs').style.width = pct(stats.carbs_g, stats.carbs_target_g) + '%';

        // Today's meals
        const meals = await api(`/meals?target_date=${new Date().toISOString().split('T')[0]}`);
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

        // Mini weight chart
        const weights = await api('/weight?limit=7');
        renderMiniWeightChart(weights);
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
    const vals = weights.map(w => w.weight_kg);
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
        html += `<div class="card">
            <h3>Shopping List</h3>
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

function renderMealCard(meal, dayNum) {
    const id = `meal-${dayNum}-${meal.name?.replace(/\s/g, '')}`;
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

        <button class="btn btn-sm btn-secondary" style="margin-top:8px" onclick='logFromPlan(${JSON.stringify(meal).replace(/'/g, "&#39;")})'>Log This Meal</button>
    </div>`;
}

function toggleSection(id) {
    document.getElementById(id)?.classList.toggle('hidden');
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

        <button class="btn btn-sm btn-primary" style="margin-top:10px" onclick="applyAnalysis(${JSON.stringify(totals).replace(/"/g, '&quot;')})">Apply to meal log</button>
    </div>`;
}

function applyAnalysis(totals) {
    document.getElementById('meal-cal').value = Math.round(totals.calories || 0);
    document.getElementById('meal-protein').value = Math.round(totals.protein_g || 0);
    document.getElementById('meal-fat').value = Math.round(totals.fat_g || 0);
    document.getElementById('meal-carbs').value = Math.round(totals.carbs_g || 0);
    document.getElementById('macro-fields').classList.remove('hidden');
    toast('Nutritional values applied');
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
        document.getElementById('macro-fields').classList.add('hidden');
        document.getElementById('analysis-result').classList.add('hidden');
        loadMeals();
    } catch (e) {
        toast(e.message, 'error');
    } finally {
        setLoading('btn-log-meal', false);
    }
}

async function loadMeals() {
    const dateInput = document.getElementById('history-date');
    const target = dateInput?.value || null;
    try {
        const meals = await api(`/meals${target ? `?target_date=${target}` : ''}`);
        const container = document.getElementById('meal-history');
        if (!meals.length) {
            container.innerHTML = '<p class="text-muted">No meals logged</p>';
            return;
        }
        container.innerHTML = meals.map(m => `
            <div class="meal-history-item">
                <div class="meal-history-info">
                    <h4>${esc(m.meal_name || 'Meal')} <span class="text-muted">${m.date}</span></h4>
                    <p>${esc(truncate(m.meal_description, 100))}</p>
                </div>
                <div class="meal-history-macros">
                    ${m.calories ? `<span><span class="macro-dot cal"></span>${Math.round(m.calories)} kcal</span>` : ''}
                    ${m.protein_g ? `<span><span class="macro-dot protein"></span>${Math.round(m.protein_g)}g P</span>` : ''}
                    ${m.fat_g ? `<span><span class="macro-dot fat"></span>${Math.round(m.fat_g)}g F</span>` : ''}
                    ${m.carbs_g ? `<span><span class="macro-dot carbs"></span>${Math.round(m.carbs_g)}g C</span>` : ''}
                    <button class="btn-delete" onclick="deleteMeal('${m.id}')" title="Delete">&times;</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('Load meals error:', e);
    }
}

async function deleteMeal(id) {
    try {
        await api(`/meals/${id}`, { method: 'DELETE' });
        toast('Meal deleted');
        loadMeals();
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

    const vals = weights.map(w => w.weight_kg);
    const min = Math.min(...vals) - 0.5;
    const max = Math.max(...vals) + 0.5;
    const range = max - min || 1;

    container.innerHTML = `
        <div class="weight-range">
            <span>${max.toFixed(1)} kg</span>
            <span>${min.toFixed(1)} kg</span>
        </div>
        <div class="weight-bars">
            ${weights.map(w => {
                const h = Math.max(6, ((w.weight_kg - min) / range) * 140);
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

async function deleteWeight(date) {
    try {
        await api(`/weight/${date}`, { method: 'DELETE' });
        toast('Entry deleted');
        loadWeights();
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

// --- Settings ---
async function loadSettings() {
    try {
        const p = await api('/profile');
        state.profile = p;

        document.getElementById('set-name').value = p.name || '';
        document.getElementById('set-diet').value = p.diet_type || 'keto_omad';
        document.getElementById('set-calories').value = p.calorie_target || 2000;
        document.getElementById('set-protein').value = p.protein_ratio || 25;
        document.getElementById('set-fat').value = p.fat_ratio || 70;
        document.getElementById('set-carbs').value = p.carb_ratio || 5;
        document.getElementById('set-height').value = p.height_cm || '';
        document.getElementById('set-current-weight').value = p.current_weight_kg || '';
        document.getElementById('set-target-weight').value = p.target_weight_kg || '';

        state.allergies = p.allergies || [];
        state.excluded = p.excluded_ingredients || [];
        state.cuisines = p.cuisine_preferences || [];
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
    const data = {
        name: document.getElementById('set-name').value.trim(),
        diet_type: document.getElementById('set-diet').value,
        calorie_target: parseInt(document.getElementById('set-calories').value) || 2000,
        protein_ratio: parseFloat(document.getElementById('set-protein').value) || 25,
        fat_ratio: parseFloat(document.getElementById('set-fat').value) || 70,
        carb_ratio: parseFloat(document.getElementById('set-carbs').value) || 5,
        height_cm: parseFloat(document.getElementById('set-height').value) || 0,
        current_weight_kg: parseFloat(document.getElementById('set-current-weight').value) || 0,
        target_weight_kg: parseFloat(document.getElementById('set-target-weight').value) || 0,
        allergies: state.allergies,
        excluded_ingredients: state.excluded,
        cuisine_preferences: state.cuisines,
        api_key: document.getElementById('set-api-key').value.trim() || '',
    };

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

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = ['meal-date', 'weight-date'];
    dateInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = today;
    });

    // Setup tag inputs
    setupTagInput('ingredient-input', 'ingredient-tags', 'ingredients');
    setupTagInput('allergy-input', 'allergy-tags', 'allergies');
    setupTagInput('excluded-input', 'excluded-tags', 'excluded');
    setupTagInput('cuisine-input', 'cuisine-tags', 'cuisines');

    // Load dashboard
    loadDashboard();
});
