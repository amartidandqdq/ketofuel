// Progress — body composition, achievements, daily snapshot, theme
import { api, esc, toast, truncate } from './core.js';

export async function loadBodyComp() {
    try {
        const data = await api('/body-composition');
        const container = document.getElementById('body-comp');
        const leanPct = 100 - data.body_fat_pct;
        container.innerHTML = `<div class="body-comp-grid"><div class="body-comp-item"><div class="body-comp-value">${data.bmi}</div><div class="body-comp-label">BMI</div></div><div class="body-comp-item"><div class="body-comp-value">${data.body_fat_pct}%</div><div class="body-comp-label">Body Fat</div></div><div class="body-comp-item"><div class="body-comp-value">${data.fat_mass_kg} kg</div><div class="body-comp-label">Fat Mass</div></div><div class="body-comp-item"><div class="body-comp-value">${data.lean_mass_kg} kg</div><div class="body-comp-label">Lean Mass</div></div></div><div class="body-comp-bar-wrap"><div class="body-comp-bar"><div class="body-comp-lean" style="width:${leanPct}%">${leanPct.toFixed(0)}% lean</div><div class="body-comp-fat" style="width:${data.body_fat_pct}%">${data.body_fat_pct}% fat</div></div></div><p class="text-muted" style="font-size:11px;margin-top:6px">${esc(data.method)}</p>`;
    } catch (e) {
        const container = document.getElementById('body-comp');
        if (container) container.innerHTML = '<p class="text-muted">Set height & weight in Settings to see body composition.</p>';
    }
}

export async function loadAchievements() {
    try {
        const data = await api('/achievements');
        const container = document.getElementById('achievements-grid');
        container.innerHTML = data.badges.map(b => `<div class="badge-item ${b.earned ? 'earned' : 'locked'}"><div class="badge-icon">${b.earned ? b.icon : '\u{1F512}'}</div><div class="badge-name">${esc(b.name)}</div><div class="badge-desc">${esc(b.desc)}</div></div>`).join('');
    } catch (e) { console.error('Achievements error:', e); }
}

export async function showDaySnapshot(dateStr) {
    try {
        const data = await api('/daily-snapshot?target_date=' + dateStr);
        const s = data.stats || {};
        const log = data.daily_log || {};
        const meals = data.meals || [];
        const net = Math.max(0, (s.carbs_g || 0) - (s.fiber_g || 0));
        document.getElementById('snapshot-title').textContent = dateStr;
        document.getElementById('snapshot-body').innerHTML = `<div class="snapshot-stats"><span>${Math.round(s.calories || 0)} kcal</span><span>${Math.round(s.fat_g || 0)}g F</span><span>${Math.round(s.protein_g || 0)}g P</span><span>${Math.round(net)}g NC</span></div><div class="snapshot-trackers"><span>\u{1F4A7} ${log.water_glasses || 0} glasses</span><span>Na: ${log.sodium_mg || 0}mg</span><span>K: ${log.potassium_mg || 0}mg</span><span>Mg: ${log.magnesium_mg || 0}mg</span></div>${meals.length ? `<h4 style="margin:10px 0 6px">Meals</h4>${meals.map(m => `<div class="snapshot-meal"><b>${esc(m.meal_name || 'Meal')}</b> — ${esc(truncate(m.meal_description, 60))}<span class="text-muted">${Math.round(m.calories || 0)} kcal</span></div>`).join('')}` : '<p class="text-muted">No meals logged</p>'}`;
        document.getElementById('snapshot-modal').classList.remove('hidden');
    } catch (e) { toast(e.message, 'error'); }
}

export function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('theme-icon').innerHTML = next === 'light' ? '&#9728;' : '&#9790;';
}

export function loadTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('theme-icon').innerHTML = saved === 'light' ? '&#9728;' : '&#9790;';
}
