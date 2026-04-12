// Settings — load and save profile
import { api, state, toast } from './core.js';

export async function loadSettings() {
    try {
        const p = await api('/profile');
        state.profile = p;
        document.getElementById('set-name').value = p.name || '';
        document.getElementById('set-diet').value = p.diet_type || 'keto_omad';
        document.getElementById('set-calories').value = p.calorie_target || 2000;
        document.getElementById('set-protein').value = p.protein_ratio ?? 25;
        document.getElementById('set-fat').value = p.fat_ratio ?? 70;
        document.getElementById('set-carbs').value = p.carb_ratio ?? 5;
        document.getElementById('set-sex').value = p.sex || 'male';
        document.getElementById('set-age').value = p.age || 30;
        document.getElementById('set-activity').value = p.activity_level || 1.375;
        document.getElementById('set-height').value = p.height_cm || '';
        document.getElementById('set-current-weight').value = p.current_weight_kg || '';
        document.getElementById('set-target-weight').value = p.target_weight_kg || '';
        state.allergies = p.allergies || [];
        state.excluded = p.excluded_ingredients || [];
        state.cuisines = p.cuisine_preferences || [];
        document.getElementById('set-carb-limit').value = p.net_carb_limit ?? 20;
        document.getElementById('set-fasting-hours').value = p.fasting_goal_hours ?? 23;
        document.getElementById('set-keto-start').value = p.keto_start_date || '';
        window.highlightActiveIF?.(p.fasting_goal_hours || 23);
        window.renderKetoPresets?.();
        window.renderTags?.('allergy-tags', 'allergies');
        window.renderTags?.('excluded-tags', 'excluded');
        window.renderTags?.('cuisine-tags', 'cuisines');
        const status = document.getElementById('api-key-status');
        if (p.api_key_set) { status.textContent = `(configured ${p.api_key_hint})`; status.style.color = 'var(--accent)'; }
        else { status.textContent = '(not set)'; status.style.color = 'var(--red)'; }
    } catch (e) { console.error('Settings load error:', e); }
}

export async function saveSettings() {
    const numVal = (id, fb) => { const v = parseFloat(document.getElementById(id).value); return Number.isFinite(v) ? v : fb; };
    const data = {
        name: document.getElementById('set-name').value.trim(),
        diet_type: document.getElementById('set-diet').value,
        calorie_target: parseInt(document.getElementById('set-calories').value) || 2000,
        protein_ratio: numVal('set-protein', 25), fat_ratio: numVal('set-fat', 70), carb_ratio: numVal('set-carbs', 5),
        sex: document.getElementById('set-sex').value, age: parseInt(document.getElementById('set-age').value) || 30,
        activity_level: parseFloat(document.getElementById('set-activity').value) || 1.375,
        height_cm: parseFloat(document.getElementById('set-height').value) || 0,
        current_weight_kg: parseFloat(document.getElementById('set-current-weight').value) || 0,
        target_weight_kg: parseFloat(document.getElementById('set-target-weight').value) || 0,
        allergies: state.allergies, excluded_ingredients: state.excluded, cuisine_preferences: state.cuisines,
        keto_start_date: document.getElementById('set-keto-start').value || '',
        net_carb_limit: numVal('set-carb-limit', 20),
        fasting_goal_hours: numVal('set-fasting-hours', 23),
        api_key: document.getElementById('set-api-key').value.trim() || '',
    };
    state.fastGoalHours = data.fasting_goal_hours;
    localStorage.setItem('fastGoalHours', data.fasting_goal_hours);
    const total = data.protein_ratio + data.fat_ratio + data.carb_ratio;
    if (Math.abs(total - 100) > 1) { toast(`Macro ratios sum to ${total}%, should be 100%`, 'error'); return; }
    try {
        await api('/profile', { method: 'POST', body: JSON.stringify(data) });
        document.getElementById('set-api-key').value = '';
        toast('Settings saved!');
        loadSettings();
        window.loadDashboard?.();
    } catch (e) { toast(e.message, 'error'); }
}
