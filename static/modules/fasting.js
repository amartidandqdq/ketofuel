// Fasting timer — start, break, UI, ticker
import { state, toast } from './core.js';

let fastingInterval = null;

export function startFast() {
    state.fastStart = Date.now();
    localStorage.setItem('fastStart', state.fastStart);
    updateFastingUI();
    toast('Fast started!');
}

export function breakFast() {
    state.fastStart = null;
    localStorage.removeItem('fastStart');
    updateFastingUI();
    toast('Fast broken — enjoy your OMAD!');
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
