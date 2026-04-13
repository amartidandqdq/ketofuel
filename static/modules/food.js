// Food DB, IF presets, grocery, favorites, label scanner
import { api, esc, storeData, getData, toast, setLoading } from './core.js';

export async function loadFoodDB() {
    try {
        const data = await api('/foods');
        renderFoodDB(data.foods);
        const sel = document.getElementById('food-cat-filter');
        if (sel.options.length <= 1) {
            data.categories.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; sel.appendChild(opt); });
        }
    } catch (e) { console.error('Food DB error:', e); }
}

export async function searchFoodDB() {
    const q = document.getElementById('food-search').value;
    const cat = document.getElementById('food-cat-filter').value;
    try { const data = await api(`/foods?q=${encodeURIComponent(q)}&cat=${encodeURIComponent(cat)}`); renderFoodDB(data.foods); }
    catch (e) { console.error('Food search error:', e); }
}

function renderFoodDB(foods) {
    const container = document.getElementById('food-results');
    if (!foods.length) { container.innerHTML = '<p class="text-muted">No foods found</p>'; return; }
    container.innerHTML = foods.map(f => {
        const fid = storeData(f);
        return `<div class="food-item" onclick="addFoodFromStore('${fid}')"><div class="food-item-name">${esc(f.name)}</div><div class="food-item-meta">${esc(f.serving)} · ${esc(f.cat)} · <span class="net-badge ${f.net <= 3 ? 'ok' : 'warn'}">${f.net}g NC</span></div><div class="food-item-macros"><span>${f.cal} kcal</span><span>${f.fat}g F</span><span>${f.protein}g P</span><span>${f.carbs}g C</span></div></div>`;
    }).join('');
}

export function addFoodFromStore(dataId) {
    const f = getData(dataId);
    if (f) addFoodToMeal(f.name, f.cal, f.fat, f.protein, f.carbs, f.fiber);
}

export function addFoodToMeal(name, cal, fat, protein, carbs, fiber) {
    window.switchTab?.('today');
    document.getElementById('meal-name').value = name;
    document.getElementById('meal-desc').value = name;
    document.getElementById('meal-cal').value = cal;
    document.getElementById('meal-fat').value = fat;
    document.getElementById('meal-protein').value = protein;
    document.getElementById('meal-carbs').value = carbs;
    document.getElementById('meal-fiber').value = fiber;
    window.updateNetCarbs?.();
    document.getElementById('macro-fields').classList.remove('hidden');
    toast(`${name} added to meal log`);
}

export function setIF(hours) {
    document.getElementById('set-fasting-hours').value = hours;
    document.querySelectorAll('.if-preset').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.startsWith(hours + ':') || (hours === 23 && btn.textContent.includes('OMAD')));
    });
}

export function highlightActiveIF(hours) {
    document.querySelectorAll('.if-preset').forEach(btn => {
        const btnHours = parseInt(btn.textContent);
        btn.classList.toggle('active', btnHours === hours);
    });
}

export function saveGroceryListFromStore(dataId) {
    const d = getData(dataId);
    saveGroceryList(d.items, d.name);
}

export async function saveGroceryList(items, planName) {
    try {
        await api('/grocery', { method: 'POST', body: JSON.stringify({ name: planName || 'Shopping List', items }) });
        toast('Grocery list saved!');
    } catch (e) { toast(e.message, 'error'); }
}

export async function loadFavorites() {
    try {
        const favs = await api('/favorites?limit=20');
        renderFavorites('saved-meals-today', favs.slice(0, 5));
        renderFavorites('favorites-list', favs);
    } catch (e) { console.error('Favorites load error:', e); }
}

function renderFavorites(containerId, favs) {
    const container = document.getElementById(containerId);
    if (!favs.length) { container.innerHTML = '<p class="text-muted">No favorites yet. Log meals and they\'ll appear here.</p>'; return; }
    container.innerHTML = favs.map(f => {
        const netCarbs = Math.max(0, (f.carbs_g || 0) - (f.fiber_g || 0));
        const favDataId = storeData(f);
        return `<div class="favorite-item" onclick="relogFavoriteStore('${favDataId}')"><div class="favorite-info"><span class="favorite-name">${esc(f.meal_name || f.meal_description?.slice(0, 40) || 'Meal')}</span><span class="favorite-count">${f.count}x logged</span></div><div class="meal-macros">${f.calories ? `<span><span class="macro-dot cal"></span>${Math.round(f.calories)}</span>` : ''}${f.fat_g ? `<span><span class="macro-dot fat"></span>${Math.round(f.fat_g)}g F</span>` : ''}${f.protein_g ? `<span><span class="macro-dot protein"></span>${Math.round(f.protein_g)}g P</span>` : ''}${f.carbs_g ? `<span><span class="macro-dot carbs"></span>${Math.round(netCarbs)}g NC</span>` : ''}</div></div>`;
    }).join('');
}

export function relogFavoriteStore(dataId) { relogFavorite(getData(dataId)); }

async function relogFavorite(fav) {
    const entry = {
        date: new Date().toISOString().split('T')[0], meal_name: fav.meal_name || 'Meal',
        meal_description: fav.meal_description || fav.meal_name || '',
        calories: fav.calories || null, protein_g: fav.protein_g || null,
        fat_g: fav.fat_g || null, carbs_g: fav.carbs_g || null, fiber_g: fav.fiber_g || null,
    };
    try { await api('/meals', { method: 'POST', body: JSON.stringify(entry) }); toast('Meal re-logged!'); window.loadDashboard?.(); }
    catch (e) { toast(e.message, 'error'); }
}

export async function lookupBarcode() {
    const code = document.getElementById('barcode-input').value.trim();
    if (!code) { toast('Enter a barcode number', 'error'); return; }
    const container = document.getElementById('barcode-result');
    container.innerHTML = '<p class="text-muted">Looking up...</p>';
    try {
        const data = await api('/barcode/' + encodeURIComponent(code));
        const n = data.nutrition || {};
        const nc = Math.round(n.net_carbs_g || 0);
        container.innerHTML = `<div style="margin-top:8px;padding:8px;background:var(--bg);border-radius:8px">
            <div class="flex-between"><strong>${esc(data.name)}</strong>${data.nutriscore ? `<span class="net-badge">${data.nutriscore.toUpperCase()}</span>` : ''}</div>
            <div class="food-item-macros" style="margin:6px 0"><span>${n.calories} kcal</span><span>${n.fat_g}g F</span><span>${n.protein_g}g P</span><span class="net-badge ${nc <= 5 ? 'ok' : 'warn'}">${nc}g NC</span></div>
            <button class="btn btn-sm btn-primary" onclick="addFoodToMeal('${esc(data.name).replace(/'/g, "\\\\'")}',${n.calories},${n.fat_g},${n.protein_g},${n.carbs_g},${n.fiber_g})">Add to Meal</button>
        </div>`;
    } catch (e) { container.innerHTML = '<p class="text-muted">Product not found</p>'; }
}

export async function searchOpenFoodFacts() {
    const q = document.getElementById('off-search').value.trim();
    if (!q || q.length < 2) { toast('Enter at least 2 characters', 'error'); return; }
    const container = document.getElementById('off-results');
    container.innerHTML = '<p class="text-muted">Searching...</p>';
    try {
        const data = await api('/food-search?q=' + encodeURIComponent(q));
        if (!data.products?.length) { container.innerHTML = '<p class="text-muted">No results found</p>'; return; }
        container.innerHTML = data.products.map(p => {
            const n = p.nutrition || {};
            const nc = Math.round(n.net_carbs_g || 0);
            const fid = storeData({ name: p.name, cal: n.calories, fat: n.fat_g, protein: n.protein_g, carbs: n.carbs_g, fiber: n.fiber_g });
            return `<div class="food-item" onclick="addFoodFromStore('${fid}')" style="cursor:pointer">
                <div class="food-item-name">${esc(p.name)}</div>
                <div class="food-item-meta">per 100g · <span class="net-badge ${nc <= 5 ? 'ok' : 'warn'}">${nc}g NC</span></div>
                <div class="food-item-macros"><span>${n.calories} kcal</span><span>${n.fat_g}g F</span><span>${n.protein_g}g P</span><span>${n.carbs_g}g C</span></div>
            </div>`;
        }).join('');
    } catch (e) { container.innerHTML = '<p class="text-muted">Search failed</p>'; }
}

export async function scanLabel() {
    const fileInput = document.getElementById('label-photo');
    const grams = document.getElementById('label-grams').value;
    if (!fileInput.files.length) { toast('Select a photo of the nutrition label', 'error'); return; }
    setLoading('btn-scan-label', true);
    try {
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        if (grams) formData.append('grams', grams);
        const res = await fetch('/api/scan-label', { method: 'POST', body: formData });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Scan failed'); }
        const data = await res.json();
        renderScanResult(data);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading('btn-scan-label', false); }
}

function renderScanResult(data) {
    const container = document.getElementById('scan-result');
    container.classList.remove('hidden');
    const n = data.nutrition || {};
    const keto = data.keto_verdict || {};
    container.innerHTML = `<div class="analysis-card" style="margin-top:12px"><h4>${esc(data.product_name || 'Scanned Label')}</h4><p class="text-muted" style="margin-bottom:8px">Label serving: ${esc(data.serving_size || '?')}${data.user_portion_g ? ` | You ate: <b>${data.user_portion_g}g</b>` : ''}</p><table class="analysis-components"><tr><th>Nutrient</th><th>Amount</th></tr><tr><td>Calories</td><td><b>${Math.round(n.calories || 0)}</b> kcal</td></tr><tr><td>Fat</td><td>${(n.fat_g || 0).toFixed(1)}g</td></tr><tr><td>Protein</td><td>${(n.protein_g || 0).toFixed(1)}g</td></tr><tr><td>Total Carbs</td><td>${(n.carbs_g || 0).toFixed(1)}g</td></tr><tr><td>Fiber</td><td>${(n.fiber_g || 0).toFixed(1)}g</td></tr><tr style="font-weight:600"><td>Net Carbs</td><td>${(n.net_carbs_g || 0).toFixed(1)}g</td></tr><tr><td>Sugar</td><td>${(n.sugar_g || 0).toFixed(1)}g</td></tr><tr><td>Sodium</td><td>${Math.round(n.sodium_mg || 0)}mg</td></tr></table><div style="margin:10px 0"><span class="compliance-badge ${keto.is_keto_friendly ? 'fits' : 'doesnt'}">${keto.is_keto_friendly ? 'Keto Friendly' : 'Not Keto Friendly'}</span>${keto.notes ? `<span class="text-muted" style="margin-left:8px;font-size:12px">${esc(keto.notes)}</span>` : ''}</div><div class="form-row" style="margin-top:10px"><button class="btn btn-sm btn-primary" onclick="applyScanStore('${storeData({ nutrition: n, name: data.product_name || 'Scanned item' })}')">Apply to Meal Log</button></div></div>`;
}

export function applyScanStore(dataId) { const d = getData(dataId); applyScan(d.nutrition, d.name); }

function applyScan(nutrition, name) {
    document.getElementById('meal-name').value = name;
    document.getElementById('meal-desc').value = name;
    document.getElementById('meal-cal').value = Math.round(nutrition.calories || 0);
    document.getElementById('meal-fat').value = Math.round(nutrition.fat_g || 0);
    document.getElementById('meal-protein').value = Math.round(nutrition.protein_g || 0);
    document.getElementById('meal-carbs').value = Math.round(nutrition.carbs_g || 0);
    document.getElementById('meal-fiber').value = Math.round(nutrition.fiber_g || 0);
    window.updateNetCarbs?.();
    document.getElementById('macro-fields').classList.remove('hidden');
    toast('Label values applied to meal log');
}
