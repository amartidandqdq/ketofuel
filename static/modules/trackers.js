// Trackers — water, electrolytes, streak, keto flu
import { api, esc, toast, setLoading } from './core.js';

function _updateWaterUI(count) {
    const waterTarget = 12;
    document.getElementById('water-count').textContent = count;
    const label = document.getElementById('water-target-label');
    if (label) label.textContent = `${count} / ${waterTarget} glasses (${(count * 0.25).toFixed(1)}L / 3L)`;
}

export async function addWater() {
    try {
        const data = await api('/daily-log/water', { method: 'POST' });
        _updateWaterUI(data.water_glasses || 0);
    } catch (e) { toast(e.message, 'error'); }
}

export async function removeWater() {
    try {
        const data = await api('/daily-log/water', { method: 'DELETE' });
        _updateWaterUI(data.water_glasses || 0);
    } catch (e) { toast(e.message, 'error'); }
}

export function showElectroForm() {
    document.getElementById('electro-form').classList.toggle('hidden');
}

export async function saveElectrolytes() {
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

export async function loadDailyTrackers() {
    try {
        const [log, streak] = await Promise.all([api('/daily-log'), api('/streak')]);
        _updateWaterUI(log.water_glasses || 0);
        document.getElementById('streak-count').textContent = streak.current_streak || 0;
        const ELECTRO_TARGETS = { sodium: 5000, potassium: 3500, magnesium: 400 };
        const pct = (v, t) => t > 0 ? Math.min(100, Math.round((v / t) * 100)) : 0;
        document.getElementById('prog-sodium').style.width = pct(log.sodium_mg || 0, ELECTRO_TARGETS.sodium) + '%';
        document.getElementById('val-sodium').textContent = `${log.sodium_mg || 0} / ${ELECTRO_TARGETS.sodium}`;
        document.getElementById('prog-potassium').style.width = pct(log.potassium_mg || 0, ELECTRO_TARGETS.potassium) + '%';
        document.getElementById('val-potassium').textContent = `${log.potassium_mg || 0} / ${ELECTRO_TARGETS.potassium}`;
        document.getElementById('prog-magnesium').style.width = pct(log.magnesium_mg || 0, ELECTRO_TARGETS.magnesium) + '%';
        document.getElementById('val-magnesium').textContent = `${log.magnesium_mg || 0} / ${ELECTRO_TARGETS.magnesium}`;
    } catch (e) { console.error('Daily trackers error:', e); }
}

export function toggleFluChecker() {
    document.getElementById('flu-checker').classList.toggle('hidden');
}

export function setupSymptomButtons() {
    document.querySelectorAll('.symptom-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.classList.toggle('active'));
    });
}

export async function checkKetoFlu() {
    const symptoms = [];
    document.querySelectorAll('.symptom-btn.active').forEach(btn => { symptoms.push(btn.dataset.symptom); });
    if (!symptoms.length) { toast('Select at least one symptom', 'error'); return; }
    setLoading('btn-check-flu', true);
    try {
        const result = await api('/symptoms', { method: 'POST', body: JSON.stringify({ symptoms }) });
        const container = document.getElementById('flu-result');
        container.innerHTML = `<div class="flu-result-card"><h4>${result.severity === 'severe' ? '&#9888; ' : ''}${esc(result.diagnosis)}</h4><p class="text-muted" style="margin-bottom:8px">Severity: <b>${esc(result.severity)}</b></p><ul>${(result.remedies || []).map(r => `<li><b>${esc(r.action)}</b> — ${esc(r.why)}</li>`).join('')}</ul>${result.warning ? `<p style="color:var(--red);margin-top:8px;font-size:12px">${esc(result.warning)}</p>` : ''}</div>`;
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading('btn-check-flu', false); }
}
