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

export async function loadComplianceStreaks() {
    try {
        const data = await api('/compliance-streaks');
        const container = document.getElementById('compliance-streaks');
        if (!container) return;
        const days = data.days || [];
        const dots = days.map(d => {
            const label = d.date.slice(5);
            const cls = !d.has_meals ? 'dot-empty' : d.compliant ? 'dot-ok' : 'dot-fail';
            return `<div class="streak-dot ${cls}" title="${d.date}: ${d.net_carbs}g NC${d.compliant ? ' ✓' : ''}"><span>${label}</span></div>`;
        }).join('');
        container.innerHTML = `<div class="streak-dots">${dots}</div>
            <div style="display:flex;gap:16px;margin-top:8px;font-size:12px">
                <span class="streak-badge active">🔥 ${data.current_streak} day streak</span>
                <span class="streak-badge inactive">Best: ${data.longest_streak} days</span>
                <span class="text-muted">Limit: ${data.carb_limit}g/day</span>
            </div>`;
    } catch (e) { console.error('Compliance streaks error:', e); }
}

export async function importBackup(input) {
    const file = input.files?.[0];
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        const r = await api('/import-json', { method: 'POST', body: JSON.stringify(data) });
        toast(`Backup restored: ${r.imported?.join(', ')}`);
        input.value = '';
    } catch (e) { toast('Import failed: ' + e.message, 'error'); }
}

export async function loadMacroTrends(days = 7) {
    try {
        document.querySelectorAll('[data-trend-days]').forEach(b => b.classList.toggle('active', b.dataset.trendDays == days));
        const data = await api('/macro-trends?days=' + days);
        const container = document.getElementById('macro-trends');
        if (!container) return;
        const trend = data.trend || [];
        const avg = data.averages || {};
        const maxCal = Math.max(1, ...trend.map(t => t.calories));
        const barW = Math.max(8, Math.floor(280 / trend.length) - 2);
        const svgW = trend.length * (barW + 2) + 20;

        const bars = trend.map((t, i) => {
            const h = Math.max(2, (t.calories / maxCal) * 80);
            const x = 10 + i * (barW + 2);
            const label = t.date.slice(5);
            const fill = t.meal_count > 0 ? 'var(--primary)' : 'var(--border)';
            return `<rect x="${x}" y="${90 - h}" width="${barW}" height="${h}" rx="2" fill="${fill}" opacity="0.8"><title>${t.date}: ${t.calories} kcal</title></rect>
                    <text x="${x + barW / 2}" y="98" text-anchor="middle" fill="var(--text-secondary)" font-size="8">${label}</text>`;
        }).join('');

        const avgY = avg.calories > 0 ? 90 - (avg.calories / maxCal) * 80 : 90;
        const avgLine = avg.calories > 0 ? `<line x1="5" y1="${avgY}" x2="${svgW - 5}" y2="${avgY}" stroke="var(--amber)" stroke-width="1" stroke-dasharray="4,2"/>
            <text x="${svgW - 3}" y="${avgY - 3}" text-anchor="end" fill="var(--amber)" font-size="8">${avg.calories} avg</text>` : '';

        container.innerHTML = `<svg viewBox="0 0 ${svgW} 100" class="trend-svg" style="width:100%;max-height:120px">${bars}${avgLine}</svg>
            <div class="trend-stats">
                <div class="trend-stat"><div class="trend-stat-val">${avg.calories}</div><div class="trend-stat-label">avg kcal</div></div>
                <div class="trend-stat"><div class="trend-stat-val">${avg.protein_g}g</div><div class="trend-stat-label">protein</div></div>
                <div class="trend-stat"><div class="trend-stat-val">${avg.fat_g}g</div><div class="trend-stat-label">fat</div></div>
                <div class="trend-stat"><div class="trend-stat-val">${avg.net_carbs_g}g</div><div class="trend-stat-label">net carbs</div></div>
            </div>`;
    } catch (e) { console.error('Macro trends error:', e); }
}

export function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('theme-icon').innerHTML = next === 'light' ? '&#9728;' : '&#9790;';
}

export async function shareAchievements() {
    try {
        const data = await api('/achievements');
        const earned = (data.badges || []).filter(b => b.earned);
        if (!earned.length) { toast('Earn some badges first!', 'error'); return; }
        const text = `🏆 KetoFuel Achievements:\n${earned.map(b => `${b.icon} ${b.name}`).join('\n')}\n\n${data.stats.current_streak} day streak! #KetoFuel #Keto`;
        if (navigator.share) {
            await navigator.share({ title: 'My KetoFuel Achievements', text });
        } else {
            await navigator.clipboard.writeText(text);
            toast('Copied to clipboard!');
        }
    } catch (e) { if (e.name !== 'AbortError') toast('Share failed', 'error'); }
}

let _deferredInstallPrompt = null;
export function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        _deferredInstallPrompt = e;
        const banner = document.getElementById('pwa-install-banner');
        if (banner && !localStorage.getItem('pwa-dismissed')) banner.style.display = 'flex';
    });
}
export async function installPWA() {
    if (!_deferredInstallPrompt) return;
    _deferredInstallPrompt.prompt();
    const result = await _deferredInstallPrompt.userChoice;
    if (result.outcome === 'accepted') toast('App installed!');
    _deferredInstallPrompt = null;
    document.getElementById('pwa-install-banner').style.display = 'none';
}
export function dismissPWA() {
    document.getElementById('pwa-install-banner').style.display = 'none';
    localStorage.setItem('pwa-dismissed', '1');
}

export function loadTheme() {
    let saved = localStorage.getItem('theme');
    // POURQUOI: Auto-detect OS preference if user hasn't chosen manually
    if (!saved) saved = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('theme-icon').innerHTML = saved === 'light' ? '&#9728;' : '&#9790;';
}
