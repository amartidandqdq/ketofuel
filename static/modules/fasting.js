// Fasting timer — start, break, UI, ticker
import { api, state, toast } from './core.js';

let fastingInterval = null;

export function startFast() {
    state.fastStart = Date.now();
    localStorage.setItem('fastStart', state.fastStart);
    updateFastingUI();
    api('/fasting-log?start_ts=' + state.fastStart, { method: 'POST' }).catch(() => {});
    toast('Fast started!');
}

export function breakFast() {
    const endTs = Date.now();
    api('/fasting-log?end_ts=' + endTs, { method: 'POST' }).then(() => loadFastingHistory()).catch(() => {});
    state.fastStart = null;
    localStorage.removeItem('fastStart');
    updateFastingUI();
    toast('Fast broken — enjoy your OMAD!');
}

export async function loadFastingHistory() {
    try {
        const data = await api('/fasting-history?days=7');
        const container = document.getElementById('fasting-history');
        if (!container || !data.history?.length) { if (container) container.innerHTML = ''; return; }
        container.innerHTML = data.history.slice(0, 5).map(h => {
            const start = new Date(h.start);
            const timeStr = start.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' +
                start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            return `<div class="fasting-history-item"><span>${timeStr}</span><span class="fasting-duration">${h.duration_h}h</span></div>`;
        }).join('');
    } catch (e) { console.error('Fasting history error:', e); }
}

export function updateFastingUI() {
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

export function startFastingTicker() {
    if (fastingInterval) clearInterval(fastingInterval);
    updateFastingUI();
    fastingInterval = setInterval(updateFastingUI, 60000);
}
