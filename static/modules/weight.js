// Weight — log, chart, history, deficit slider, AI insight
import { api, esc, toast, toastUndo, setLoading } from './core.js';

let deficitData = null;
let _lastLoadedWeights = [];

export async function logWeight() {
    const dateVal = document.getElementById('weight-date').value;
    const weightVal = parseFloat(document.getElementById('weight-value').value);
    if (!weightVal) { toast('Enter your weight', 'error'); return; }
    try {
        await api('/weight', { method: 'POST', body: JSON.stringify({
            date: dateVal || new Date().toISOString().split('T')[0], weight_kg: weightVal,
            notes: document.getElementById('weight-notes').value.trim() || null,
        }) });
        toast('Weight logged!');
        document.getElementById('weight-value').value = '';
        document.getElementById('weight-notes').value = '';
        loadWeights();
    } catch (e) { toast(e.message, 'error'); }
}

export async function loadWeights() {
    try {
        const weights = await api('/weight?limit=30');
        _lastLoadedWeights = weights;
        renderWeightChart(weights);
        renderWeightHistory(weights);
        loadDeficitSlider();
    } catch (e) { console.error('Load weights error:', e); }
}

function renderWeightChart(weights) {
    const container = document.getElementById('weight-chart');
    if (!weights.length) { container.innerHTML = '<p class="text-muted">No weight data yet. Start logging!</p>'; return; }
    const vals = weights.map(w => w.weight_kg).filter(v => v != null && !isNaN(v));
    const minW = Math.min(...vals) - 0.5, maxW = Math.max(...vals) + 0.5;
    const rangeW = maxW - minW || 1;
    const W = 700, H = 180, padL = 50, padR = 20, padT = 15, padB = 30;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = weights.length;
    let gridHtml = '';
    for (let i = 0; i <= 4; i++) {
        const v = minW + (rangeW * i / 4);
        const y = padT + plotH - (plotH * i / 4);
        gridHtml += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="svg-grid"/>`;
        gridHtml += `<text x="${padL - 6}" y="${y + 4}" class="svg-label" text-anchor="end">${v.toFixed(1)}</text>`;
    }
    const points = weights.map((w, i) => {
        const x = n === 1 ? padL + plotW / 2 : padL + (plotW * i / (n - 1));
        const y = padT + plotH - ((w.weight_kg - minW) / rangeW) * plotH;
        return { x, y, w };
    });
    const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
    const dots = points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" class="svg-dot"><title>${p.w.date}: ${p.w.weight_kg}kg</title></circle>`).join('');
    const step = Math.max(1, Math.floor(n / 8));
    const xLabels = points.filter((_, i) => i % step === 0 || i === n - 1).map(p => `<text x="${p.x}" y="${H - 4}" class="svg-label" text-anchor="middle">${p.w.date.slice(5)}</text>`).join('');
    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="weight-svg" preserveAspectRatio="xMidYMid meet">${gridHtml}<polyline points="${polyline}" class="svg-line" fill="none"/>${dots}${xLabels}</svg>`;
}

function renderWeightHistory(weights) {
    const container = document.getElementById('weight-history');
    if (!weights.length) { container.innerHTML = ''; return; }
    const reversed = [...weights].reverse();
    container.innerHTML = reversed.map((w, i) => {
        const prev = reversed[i + 1];
        let diffHtml = '';
        if (prev) {
            const diff = w.weight_kg - prev.weight_kg;
            const cls = diff < 0 ? 'down' : diff > 0 ? 'up' : 'same';
            diffHtml = `<span class="weight-diff ${cls}">${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg</span>`;
        }
        return `<div class="weight-history-item"><span class="weight-date">${w.date}</span><span class="weight-val">${w.weight_kg} kg</span>${diffHtml}${w.notes ? `<span class="text-muted">${esc(w.notes)}</span>` : ''}<button class="btn-delete" onclick="deleteWeight('${w.date}')" title="Delete">&times;</button></div>`;
    }).join('');
}

export async function deleteWeight(d) {
    if (!confirm('Delete this weight entry?')) return;
    try {
        // Use cached weights from last render instead of re-fetching
        const stashed = _lastLoadedWeights.find(w => w.date === d);
        await api(`/weight/${d}`, { method: 'DELETE' });
        loadWeights();
        if (stashed) {
            toastUndo('Weight deleted', async () => {
                await api('/weight', { method: 'POST', body: JSON.stringify({ date: stashed.date, weight_kg: stashed.weight_kg, notes: stashed.notes || '' }) });
                loadWeights();
            });
        } else { toast('Entry deleted'); }
    } catch (e) { toast(e.message, 'error'); }
}

export async function loadDeficitSlider() {
    try {
        const d = await api('/deficit');
        deficitData = d;
        document.getElementById('deficit-slider-wrap').classList.remove('hidden');
        document.getElementById('deficit-empty').classList.add('hidden');
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

export function onDeficitSlide() {
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
        if (weeks < 8) { document.getElementById('ds-timeline').textContent = Math.round(weeks); document.getElementById('ds-timeline-sub').textContent = 'weeks'; }
        else { document.getElementById('ds-timeline').textContent = months; document.getElementById('ds-timeline-sub').textContent = 'months'; }
    } else { document.getElementById('ds-timeline').textContent = '--'; document.getElementById('ds-timeline-sub').textContent = 'set target weight'; }
    slider.dataset.calories = calories;
}

export async function applySliderCalories() {
    const slider = document.getElementById('deficit-slider');
    const calories = parseInt(slider.dataset.calories);
    if (!calories) return;
    try {
        const profile = await api('/profile');
        profile.calorie_target = calories;
        delete profile.api_key;
        await api('/profile', { method: 'POST', body: JSON.stringify(profile) });
        toast(`Calorie target set to ${calories} kcal/day`);
        window.loadDashboard?.();
    } catch (e) { toast(e.message, 'error'); }
}

export async function getWeightInsight() {
    setLoading('btn-weight-insight', true);
    try {
        const result = await api('/weight/insight');
        const container = document.getElementById('weight-insight');
        container.classList.remove('hidden');
        container.innerHTML = `<div class="insight-card"><h4>AI Insight — Trend: ${esc(result.trend || 'N/A')}</h4><p>${esc(result.insight || '')}</p>${result.avg_weekly_change_kg ? `<p>Average weekly change: <b>${result.avg_weekly_change_kg > 0 ? '+' : ''}${result.avg_weekly_change_kg} kg</b></p>` : ''}${result.estimated_target_date ? `<p>Estimated target date: <b>${result.estimated_target_date}</b></p>` : ''}${result.recommendations?.length ? `<ul>${result.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</div>`;
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading('btn-weight-insight', false); }
}
