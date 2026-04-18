// Core utilities shared by all modules — state, data store, API, toast, helpers

export const state = {
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
export function storeData(data) {
    const id = '__d' + (++_dataId);
    _dataStore[id] = data;
    return id;
}
export function getData(id) {
    return _dataStore[id];
}
// POURQUOI: Prevent unbounded memory growth in long PWA sessions
export function clearDataStore() {
    for (const key in _dataStore) delete _dataStore[key];
    _dataId = 0;
}

// --- API + Offline ---
let _serverOnline = true;
let _healthCheckInterval = null;

function _showOfflineBanner() {
    document.getElementById('offline-banner')?.classList.remove('hidden');
    if (!_healthCheckInterval) {
        _healthCheckInterval = setInterval(async () => {
            try {
                await fetch('/api/health');
                _hideOfflineBanner();
                window.loadDashboard?.();
            } catch {}
        }, 5000);
    }
}

function _hideOfflineBanner() {
    _serverOnline = true;
    document.getElementById('offline-banner')?.classList.add('hidden');
    if (_healthCheckInterval) { clearInterval(_healthCheckInterval); _healthCheckInterval = null; }
}

export async function api(path, opts = {}) {
    try {
        // POURQUOI: Don't set Content-Type for FormData — browser sets multipart boundary automatically
        const headers = opts.body instanceof FormData ? { ...opts.headers } : { 'Content-Type': 'application/json', ...opts.headers };
        const res = await fetch(`/api${path}`, {
            headers,
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

// --- Toast stacking ---
const _activeToasts = [];
function _repositionToasts() {
    let bottom = 24;
    for (let i = _activeToasts.length - 1; i >= 0; i--) {
        _activeToasts[i].style.bottom = bottom + 'px';
        bottom += _activeToasts[i].offsetHeight + 8;
    }
}

export function toast(msg, type = 'success') {
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

export function toastUndo(msg, undoCallback) {
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

export function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.dataset.origText = btn.dataset.origText || btn.textContent;
    btn.textContent = loading ? 'Working...' : btn.dataset.origText;
}

// --- Utilities ---
export function esc(s) {
    if (!s) return '';
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

export function truncate(s, len) {
    if (!s) return '';
    return s.length > len ? s.slice(0, len) + '...' : s;
}
