// Ketosis tracker, keto presets, exercise logger
import { api, esc, storeData, toast } from './core.js';

export async function loadKetosisTracker(profile = null) {
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

        container.innerHTML = data.phases.map((p, i) => {
            let cls = 'future';
            if (i < data.current_phase_idx) cls = 'completed';
            if (i === data.current_phase_idx) cls = 'current';
            return `<div class="ketosis-phase ${cls}"><div class="ketosis-phase-icon">${p.icon}</div><div class="ketosis-phase-name">${p.name}</div></div>`;
        }).join('');

        const fastingNote = data.fasting_bonus ? `<div class="fasting-bonus">${esc(data.fasting_bonus)}</div>` : '';
        const timeEst = data.days_remaining > 0
            ? `<div class="ketosis-eta">~${data.days_remaining} day${data.days_remaining === 1 ? '' : 's'} to full adaptation (Day ${data.adapted_day})</div>`
            : (data.phase === 'adapted' ? '<div class="ketosis-eta adapted">Fat adapted!</div>' : '');
        let html = `<div class="ketosis-tip">${esc(data.icon)} <b>${esc(data.phase_name)}</b> — ${esc(data.desc)}<br><span class="text-muted">${esc(data.tip)}</span>${fastingNote}${timeEst}</div>`;

        if (data.warning) html += `<div class="ketosis-warning">${esc(data.warning)}</div>`;

        if (data.recent_carbs?.length) {
            const limit = (profile && profile.net_carb_limit) || 20;
            html += `<div class="ketosis-carbs-row">`;
            data.recent_carbs.slice(0, 7).reverse().forEach(c => {
                const cls = c.net_carbs === 0 ? 'empty' : c.net_carbs <= limit ? 'ok' : 'over';
                const label = c.date.slice(5);
                html += `<div class="ketosis-carb-day ${cls}" title="${c.date}: ${c.net_carbs}g" onclick="showDaySnapshot('${c.date}')" style="cursor:pointer"><div>${c.net_carbs}g</div><div>${label}</div></div>`;
            });
            html += `</div>`;
        }

        if (data.phase !== 'adapted') {
            html += `<div class="speed-tips-section"><button class="btn btn-sm btn-secondary" onclick="document.getElementById('speed-tips-list').classList.toggle('hidden')" style="margin-top:10px;width:100%">Speed Up Ketosis</button><div id="speed-tips-list" class="hidden" style="margin-top:8px">${(data.speed_tips || []).map(t => `<div class="speed-tip"><div class="speed-tip-action">${esc(t.tip)}</div><div class="speed-tip-why">${esc(t.why)}</div></div>`).join('')}</div></div>`;
            if (data.accelerators?.length) {
                html += `<div class="speed-tips-section"><button class="btn btn-sm btn-secondary" onclick="document.getElementById('accel-list').classList.toggle('hidden')" style="margin-top:8px;width:100%">Ketosis Accelerators</button><div id="accel-list" class="hidden" style="margin-top:8px">${data.accelerators.map(a => `<div class="accel-item"><div class="accel-header"><span class="accel-icon">${a.icon}</span><span class="accel-action">${esc(a.action)}</span><span class="accel-impact">${esc(a.impact)}</span></div><div class="accel-detail">${esc(a.detail)}</div></div>`).join('')}</div></div>`;
            }
        }

        info.innerHTML = html;
    } catch (e) { console.error('Ketosis tracker error:', e); }
}

export const KETO_PRESETS = [
    { id: 'carnivore', icon: '\u{1F969}', name: 'Carnivore', carbs: 0, fat: 75, protein: 25, carbPct: 0, desc: 'Zero carb. Meat, fish, eggs only.' },
    { id: 'ultra_keto', icon: '\u26A1', name: 'Ultra Keto', carbs: 5, fat: 77, protein: 20, carbPct: 3, desc: 'Hardcore. Deep ketosis guaranteed.' },
    { id: 'strict_keto', icon: '\u{1F525}', name: 'Strict Keto', carbs: 10, fat: 75, protein: 20, carbPct: 5, desc: 'Serious fat burner mode.' },
    { id: 'keto_omad', icon: '\u{1F3AF}', name: 'Standard Keto', carbs: 20, fat: 70, protein: 25, carbPct: 5, desc: 'The classic. Most popular.' },
    { id: 'lazy_keto', icon: '\u{1F60E}', name: 'Lazy Keto', carbs: 30, fat: 65, protein: 25, carbPct: 10, desc: 'Relaxed but still effective.' },
    { id: 'keto_lite', icon: '\u{1F33F}', name: 'Keto Lite', carbs: 50, fat: 55, protein: 25, carbPct: 20, desc: 'Low carb lifestyle. Flexible.' },
];

export function renderKetoPresets() {
    const container = document.getElementById('keto-presets');
    if (!container) return;
    const current = document.getElementById('set-diet')?.value || 'keto_omad';
    container.innerHTML = KETO_PRESETS.map(p => `<div class="keto-preset ${p.id === current ? 'active' : ''}" onclick="selectKetoPreset('${p.id}')"><div class="keto-preset-icon">${p.icon}</div><div class="keto-preset-name">${p.name}</div><div class="keto-preset-carbs">&lt;${p.carbs}g net carbs</div><div class="keto-preset-desc">${p.desc}</div></div>`).join('');
}

export function selectKetoPreset(id) {
    const preset = KETO_PRESETS.find(p => p.id === id);
    if (!preset) return;
    document.getElementById('set-diet').value = id;
    document.getElementById('set-protein').value = preset.protein;
    document.getElementById('set-fat').value = preset.fat;
    document.getElementById('set-carbs').value = preset.carbPct;
    document.getElementById('set-carb-limit').value = preset.carbs;
    const total = preset.protein + preset.fat + preset.carbPct;
    if (Math.abs(total - 100) > 1) document.getElementById('set-fat').value = 100 - preset.protein - preset.carbPct;
    document.querySelectorAll('.keto-preset').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.keto-preset').forEach(el => { if (el.getAttribute('onclick')?.includes(id)) el.classList.add('active'); });
    toast(`${preset.icon} ${preset.name} selected — ${preset.carbs}g net carbs`);
    window.saveSettings?.();
}

export function updateKetoModeBadge(dietType) {
    const badge = document.getElementById('keto-mode-badge');
    if (!badge) return;
    const preset = KETO_PRESETS.find(p => p.id === dietType);
    const subtitle = document.getElementById('logo-sub-text');
    if (preset) { badge.textContent = `${preset.icon} ${preset.name}`; if (subtitle) subtitle.textContent = preset.name; }
    else { badge.textContent = dietType ? dietType.replace(/_/g, ' ') : ''; if (subtitle) subtitle.textContent = dietType ? dietType.replace(/_/g, ' ') : 'KetoFuel'; }
}

// --- Exercise Logger ---
let _exerciseTypes = {};

export async function loadExerciseButtons() {
    try { const data = await api('/exercise-types'); _exerciseTypes = data.types; renderExerciseGrid(); }
    catch (e) { console.error('Exercise types error:', e); }
}

export function renderExerciseGrid(todayExercises = []) {
    const grid = document.getElementById('exercise-grid');
    if (!grid) return;
    grid.innerHTML = Object.entries(_exerciseTypes).map(([key, ex]) => {
        const count = todayExercises.filter(e => e.type === key).length;
        const maxNote = ex.max_daily ? ` (${count}/${ex.max_daily})` : (count > 0 ? ` (${count}x)` : '');
        return `<button class="exercise-btn" onclick="logExercise('${key}')"><span class="exercise-btn-icon">${ex.icon}</span><span class="exercise-btn-name">${esc(ex.name)}${maxNote}</span><span class="exercise-btn-impact">+${ex.bonus} day</span></button>`;
    }).join('');
}

export async function logExercise(type) {
    try {
        const result = await api('/log-exercise', { method: 'POST', body: JSON.stringify({ type }) });
        toast(`${result.exercise.icon} ${result.exercise.name} logged! +${result.exercise.bonus} day boost`);
        updateExerciseLog(result.exercises, result.today_total_bonus);
        renderExerciseGrid(result.exercises);
        window.loadKetosisTracker?.();
    } catch (e) { toast(e.message, 'error'); }
}

export function updateExerciseLog(exercises, totalBonus) {
    const badge = document.getElementById('exercise-bonus-badge');
    if (badge) badge.textContent = totalBonus > 0 ? `+${totalBonus} days boost today` : '';
    const log = document.getElementById('exercise-today-log');
    if (!log) return;
    if (!exercises?.length) { log.innerHTML = ''; return; }
    log.innerHTML = `<div class="exercise-log-items">${exercises.map((e, i) =>
        `<span class="exercise-log-item">${e.icon} ${esc(e.name)} <span class="exercise-remove" onclick="removeExercise(${i})">&times;</span></span>`
    ).join('')}<button class="btn btn-sm" style="font-size:10px;padding:2px 8px;margin-left:4px;opacity:0.6" onclick="clearExercises()">Clear all</button></div>`;
}

export async function removeExercise(index) {
    try {
        const result = await api('/log-exercise?index=' + index, { method: 'DELETE' });
        updateExerciseLog(result.exercises, result.today_total_bonus);
        renderExerciseGrid(result.exercises);
        window.loadKetosisTracker?.();
    } catch (e) { toast(e.message, 'error'); }
}

export async function clearExercises() {
    try {
        const result = await api('/log-exercise', { method: 'DELETE' });
        updateExerciseLog(result.exercises, result.today_total_bonus);
        renderExerciseGrid(result.exercises);
        window.loadKetosisTracker?.();
        toast('Exercises cleared');
    } catch (e) { toast(e.message, 'error'); }
}

export async function loadTodayExercises() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const dl = await api('/daily-log?target_date=' + today);
        const exercises = dl.exercises || [];
        const total = exercises.reduce((s, e) => s + (e.bonus_days || 0), 0);
        updateExerciseLog(exercises, Math.round(total * 10) / 10);
        renderExerciseGrid(exercises);
    } catch (e) { console.error('Exercise log error:', e); }
}
