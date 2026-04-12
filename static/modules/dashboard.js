// Dashboard — main load, mini weight chart, protein status, donut, weekly summary, meal timing
import { api, esc, storeData, truncate } from './core.js';
import { startFastingTicker } from './fasting.js';

export async function loadDashboard() {
    try {
        const datePicker = document.getElementById('dash-date-picker');
        const today = new Date().toISOString().split('T')[0];
        const targetDate = datePicker?.value || today;
        const heading = document.getElementById('dash-heading');
        if (heading) heading.textContent = targetDate === today ? 'Today' : targetDate;

        const [stats, profile] = await Promise.all([api('/stats?target_date=' + targetDate), api('/profile')]);
        window.updateKetoModeBadge?.(profile.diet_type);
        const isOmad = ['omad', 'keto_omad'].includes(profile.diet_type);
        const logTitle = document.getElementById('log-meal-title');
        if (logTitle) logTitle.textContent = isOmad ? 'Log Your OMAD' : 'Log Your Meal';
        const pct = (val, target) => target > 0 ? Math.min(100, Math.round(val / target * 100)) : 0;

        document.getElementById('stat-cal').textContent = Math.round(stats.calories);
        document.getElementById('stat-cal-target').textContent = `/ ${stats.calorie_target} kcal`;
        document.getElementById('prog-cal').style.width = pct(stats.calories, stats.calorie_target) + '%';

        const netCarbs = Math.max(0, (stats.carbs_g || 0) - (stats.fiber_g || 0));
        const carbLimit = profile.net_carb_limit ?? 20;
        document.getElementById('stat-net-carbs').textContent = Math.round(netCarbs) + 'g';
        document.getElementById('stat-carbs-target').textContent = carbLimit === 0 ? 'zero carb' : `/ ${carbLimit}g limit`;
        document.getElementById('prog-carbs').style.width = carbLimit > 0 ? pct(netCarbs, carbLimit) + '%' : (netCarbs > 0 ? '100%' : '0%');

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

        document.getElementById('stat-fat').textContent = Math.round(stats.fat_g) + 'g';
        document.getElementById('stat-fat-target').textContent = `/ ${stats.fat_target_g}g`;
        document.getElementById('prog-fat').style.width = pct(stats.fat_g, stats.fat_target_g) + '%';

        document.getElementById('stat-protein').textContent = Math.round(stats.protein_g) + 'g';
        document.getElementById('stat-protein-target').textContent = `/ ${stats.protein_target_g}g`;
        document.getElementById('prog-protein').style.width = pct(stats.protein_g, stats.protein_target_g) + '%';

        startFastingTicker();

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
        renderMacroDonut(stats, profile);
        loadMealTiming(targetDate);

        Promise.all([
            window.loadKetosisTracker?.(profile),
            window.loadDailyTrackers?.(),
            window.loadFavorites?.(),
            loadWeeklySummary(),
            window.loadExerciseButtons?.(),
            window.loadTodayExercises?.(),
            loadProteinStatus(),
        ]);
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

export async function loadProteinStatus() {
    const el = document.getElementById('protein-alert');
    if (!el) return;
    try {
        const data = await api('/protein-status');
        if (data.alert) {
            el.innerHTML = `<div class="protein-alert-card">
                <span class="protein-alert-icon">&#x1f4aa;</span>
                <div class="protein-alert-body">
                    <strong>Muscle Preservation</strong>
                    <p>${esc(data.alert)}</p>
                    <span class="protein-alert-meta">Target: ${data.g_per_kg_lean}g/kg lean mass &times; ${data.lean_mass_kg}kg = ${data.protein_target_g}g/day</span>
                </div>
            </div>`;
            el.style.display = 'block';
        } else if (data.pct >= 80) {
            el.innerHTML = `<div class="protein-ok-card">
                <span class="protein-alert-icon">&#x2705;</span>
                <div class="protein-alert-body">
                    <strong>Protein on track</strong>
                    <p>${data.protein_consumed_g}g of ${data.protein_target_g}g (${data.pct}%) &mdash; muscle preservation OK</p>
                </div>
            </div>`;
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }
    } catch { el.style.display = 'none'; }
}

export function renderMacroDonut(stats, profile) {
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
    container.innerHTML = `<svg viewBox="0 0 120 120" class="donut-svg">
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--border)" stroke-width="12"/>
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--amber)" stroke-width="12"
            stroke-dasharray="${fatLen} ${circ - fatLen}" stroke-dashoffset="0" transform="rotate(-90 60 60)"/>
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--blue)" stroke-width="12"
            stroke-dasharray="${protLen} ${circ - protLen}" stroke-dashoffset="${-fatLen}" transform="rotate(-90 60 60)"/>
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--accent)" stroke-width="12"
            stroke-dasharray="${carbLen} ${circ - carbLen}" stroke-dashoffset="${-(fatLen + protLen)}" transform="rotate(-90 60 60)"/>
        <text x="60" y="56" text-anchor="middle" class="donut-center-text">${Math.round(total)}</text>
        <text x="60" y="70" text-anchor="middle" class="donut-center-sub">kcal</text>
    </svg>
    <div class="donut-legend">
        <span><span class="macro-dot fat"></span>Fat ${Math.round(fatPct*100)}%</span>
        <span><span class="macro-dot protein"></span>Prot ${Math.round(protPct*100)}%</span>
        <span><span class="macro-dot carbs"></span>Carb ${Math.round(carbPct*100)}%</span>
    </div>`;
}

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

async function loadMealTiming(targetDate) {
    try {
        const data = await api('/meal-timing?target_date=' + targetDate);
        const container = document.getElementById('meal-timing-bar');
        if (!data.timings?.length) {
            container.innerHTML = '<p class="text-muted">No meals logged — timing will appear here</p>';
            return;
        }
        let hours = '';
        for (let h = 0; h < 24; h++) {
            const meal = data.timings.find(t => t.hour === h);
            const cls = meal ? 'timing-slot active' : 'timing-slot';
            const label = h % 6 === 0 ? `<span class="timing-label">${h}:00</span>` : '';
            hours += `<div class="${cls}" title="${meal ? esc(meal.meal_name) + ' (' + Math.round(meal.calories || 0) + ' kcal)' : h + ':00'}">${label}</div>`;
        }
        const mealHours = data.timings.map(t => t.hour).sort((a, b) => a - b);
        const windowH = mealHours.length > 1 ? mealHours[mealHours.length - 1] - mealHours[0] : 0;
        container.innerHTML = `<div class="timing-bar">${hours}</div>
            <div class="timing-summary">${data.timings.length} meal${data.timings.length > 1 ? 's' : ''} · ${windowH > 0 ? windowH + 'h eating window' : 'OMAD'}</div>`;
    } catch (e) { console.error('Meal timing error:', e); }
}
