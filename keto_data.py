# Ketosis domain data — timelines, accelerators, exercise impacts, and speed tips by diet type

# Exercise types and their ketosis impact (bonus days per session)
EXERCISE_IMPACTS = {
    "walk_30": {"name": "30-min Walk", "icon": "\U0001f6b6", "bonus": 0.5, "minutes": 30},
    "fat_fast": {"name": "Fat Fast Day", "icon": "\U0001f9c8", "bonus": 2.0, "minutes": 0},
    "espresso": {"name": "Black Espresso", "icon": "\u2615", "bonus": 0.15, "minutes": 0, "max_daily": 4},
}

_NON_KETO_DIETS = {"omad", "paleo", "mediterranean", "standard", "custom"}

_DIET_TIMELINE_MAP = {
    "carnivore": "carnivore", "ultra_keto": "ultra_strict", "strict_keto": "ultra_strict",
    "keto": "standard_keto", "keto_omad": "keto_omad", "lazy_keto": "lazy", "keto_lite": "lite",
}

def _phases(names_icons, descs):
    ids = ["glucose", "depletion", "entering", "ketosis", "adapted"]
    return [{"id": ids[i], "name": n, "icon": ic, "day_range": dr, "desc": descs[i]}
            for i, (n, ic, dr) in enumerate(names_icons)]

KETOSIS_TIMELINES = {
    "carnivore": {
        "thresholds": [1, 2, 3, 7], "adapted_day": 7,
        "phases": _phases([
            ("Burning Glucose", "\U0001f35e", "Day 0-1"), ("Glycogen Depletion", "\u231b", "Day 1-2"),
            ("Entering Ketosis", "\U0001f504", "Day 2-3"), ("Deep Ketosis", "\U0001f525", "Day 3-7"),
            ("Fat Adapted", "\u26a1", "Day 7+"),
        ], ["Body burning remaining glucose. Zero carbs = fast depletion.",
            "Glycogen emptying rapidly with zero carb intake.",
            "Ketone production ramping up. Carnivore flu possible \u2014 more intense than standard keto.",
            "Fat and protein are your only fuel. Ensure enough fat \u2014 excess protein can limit ketones via gluconeogenesis.",
            "Fully carnivore-adapted. Peak fat oxidation. Stable energy and appetite."]),
        "tips": {"glucose": "Zero carbs means glycogen depletes in hours, not days. Stay hydrated.",
                 "depletion": "Electrolytes are critical. Add salt liberally \u2014 5g+ sodium/day on carnivore.",
                 "entering": "Carnivore flu can be more intense. Bone broth, salt, magnesium. Expect digestive changes.",
                 "ketosis": "Eating enough fat? Too much protein without fat can blunt ketone production.",
                 "adapted": "Fully adapted. Your body runs on fat and ketones from animal sources."},
    },
    "ultra_strict": {
        "thresholds": [1, 3, 4, 10], "adapted_day": 10,
        "phases": _phases([
            ("Burning Glucose", "\U0001f35e", "Day 0-1"), ("Glycogen Depletion", "\u231b", "Day 1-3"),
            ("Entering Ketosis", "\U0001f504", "Day 3-4"), ("In Ketosis", "\U0001f525", "Day 4-10"),
            ("Fat Adapted", "\u26a1", "Day 10+"),
        ], ["Body using up glucose reserves quickly with ultra-low carbs.",
            "Glycogen stores emptying fast. Low energy is normal.",
            "Liver producing ketones. Keto flu likely \u2014 supplement electrolytes.",
            "Burning fat efficiently. Energy returning. Stay strict.",
            "Fully keto-adapted. Deep, stable ketosis."]),
        "tips": {"glucose": "Keep net carbs under {}g \u2014 glycogen will deplete within a day.",
                 "depletion": "Drink water with electrolytes. Sodium, potassium, magnesium are essential.",
                 "entering": "Hardest phase. Bone broth, magnesium citrate, and patience.",
                 "ketosis": "You're in deep ketosis. Consistent low carbs keep you here.",
                 "adapted": "Fat-adapted. Your body is an efficient fat-burning machine."},
    },
    "standard_keto": {
        "thresholds": [1, 3, 5, 14], "adapted_day": 14,
        "phases": _phases([
            ("Burning Glucose", "\U0001f35e", "Day 0-1"), ("Glycogen Depletion", "\u231b", "Day 1-3"),
            ("Entering Ketosis", "\U0001f504", "Day 3-5"), ("In Ketosis", "\U0001f525", "Day 5-14"),
            ("Fat Adapted", "\u26a1", "Day 14+"),
        ], ["Body still running on carbs and glucose reserves.",
            "Glycogen stores emptying. You may feel low energy.",
            "Liver starting ketone production. Keto flu possible.",
            "Burning fat for fuel. Energy stabilizing.",
            "Fully keto-adapted. Peak fat burning efficiency."]),
        "tips": {"glucose": "Keep net carbs under {}g to start depleting glycogen.",
                 "depletion": "Stay hydrated. Add salt to water for electrolytes.",
                 "entering": "This is the hardest part. Bone broth, magnesium, and patience help.",
                 "ketosis": "You're in! Keep consistent. Don't spike carbs or you'll reset.",
                 "adapted": "You're fat-adapted. Your body efficiently burns fat as primary fuel."},
    },
    "keto_omad": {
        "thresholds": [1, 2, 4, 10], "adapted_day": 10,
        "phases": _phases([
            ("Burning Glucose", "\U0001f35e", "Day 0-1"), ("Glycogen Depletion", "\u231b", "Day 1-2"),
            ("Entering Ketosis", "\U0001f504", "Day 2-4"), ("In Ketosis", "\U0001f525", "Day 4-10"),
            ("Fat Adapted", "\u26a1", "Day 10+"),
        ], ["Body using glucose, but 23h fasting window is already depleting glycogen fast.",
            "23h daily fast = rapid glycogen depletion. Your body spends most of the day burning stored fuel.",
            "Ketone production ramping up. OMAD's long fast means you're in mild ketosis every day between meals.",
            "Burning fat for fuel. OMAD keeps you in ketosis 20+ hours/day. Energy and focus improving.",
            "Fully keto-OMAD adapted. Your body thrives on fat with one powerful daily meal."]),
        "tips": {"glucose": "Your 23h fast is already doing the work. Keep your one meal strictly keto (<{}g net carbs).",
                 "depletion": "OMAD accelerates glycogen depletion. Stay hydrated with electrolytes.",
                 "entering": "You're entering ketosis faster thanks to OMAD. Each 23h fast produces ketones.",
                 "ketosis": "OMAD + keto = deep ketosis. You spend 20+ hours/day burning fat.",
                 "adapted": "Fat-adapted on keto OMAD. One powerful meal and 23h of fat burning."},
    },
    "lazy": {
        "thresholds": [2, 5, 10, 21], "adapted_day": 21,
        "phases": _phases([
            ("Burning Glucose", "\U0001f35e", "Day 0-2"), ("Glycogen Depletion", "\u231b", "Day 2-5"),
            ("Entering Ketosis", "\U0001f504", "Day 5-10"), ("In Ketosis", "\U0001f525", "Day 10-21"),
            ("Fat Adapted", "\u26a1", "Day 21+"),
        ], ["Body using glucose. At 30g carbs, depletion takes a bit longer.",
            "Glycogen slowly emptying. Some carbs means slower transition.",
            "Ketone production starting. May hover in and out of ketosis.",
            "Fat burning mode. Keep carbs consistent to stay here.",
            "Adapted to burning fat. Flexible but consistent."]),
        "tips": {"glucose": "At {}g carbs, glycogen takes 2+ days to deplete. Be patient.",
                 "depletion": "Stay hydrated. Lazy keto is more gradual \u2014 that's fine.",
                 "entering": "You may drift in and out of ketosis. Consistency matters more than perfection.",
                 "ketosis": "Steady state. Keep carbs under {}g and you'll stay here.",
                 "adapted": "Fat-adapted on lazy keto. Your metabolism is flexible and efficient."},
    },
    "lite": {
        "thresholds": [3, 7, 14, 28], "adapted_day": 28,
        "phases": _phases([
            ("Burning Glucose", "\U0001f35e", "Day 0-3"), ("Reducing Glycogen", "\u231b", "Day 3-7"),
            ("Low-Carb Transition", "\U0001f504", "Day 7-14"), ("Low-Carb Adapted", "\U0001f525", "Day 14-28"),
            ("Metabolically Flexible", "\u26a1", "Day 28+"),
        ], ["Body primarily using glucose. 50g carbs is low but not ketogenic for everyone.",
            "Glycogen reducing gradually. Full depletion unlikely at this carb level.",
            "Body adapting to lower carbs. You may or may not enter ketosis.",
            "Improved fat utilization. Some may achieve mild ketosis.",
            "Body efficiently uses both fat and glucose. Sustainable long-term."]),
        "tips": {"glucose": "At 50g carbs, you're low-carb but may not reach full ketosis. That's OK.",
                 "depletion": "Focus on food quality. Whole foods, healthy fats, adequate protein.",
                 "entering": "Your body is learning to use fat. Some people reach ketosis at 50g, others don't.",
                 "ketosis": "Focus on how you feel, not just ketone numbers. Energy and cravings improving?",
                 "adapted": "Metabolically flexible. You've built a sustainable low-carb lifestyle."},
    },
}

KETOSIS_ACCELERATORS = [
    {"action": "30-min fasted walk", "impact": "Saves ~0.5 day", "detail": "Burns ~150 kcal from fat/glycogen. Walking fasted forces your body to use stored fuel.", "icon": "\U0001f6b6"},
    {"action": "20-min HIIT or sprints", "impact": "Saves ~1 day", "detail": "High-intensity exercise depletes muscle glycogen 3-5x faster than walking.", "icon": "\U0001f3c3"},
    {"action": "45-min weight training", "impact": "Saves ~1 day", "detail": "Resistance training depletes glycogen from multiple muscle groups simultaneously.", "icon": "\U0001f3cb\ufe0f"},
    {"action": "16:8 intermittent fasting", "impact": "Saves ~1 day", "detail": "16 hours without food = 16 hours of fat burning and ketone production.", "icon": "\u23f0"},
    {"action": "24-hour fast", "impact": "Saves ~2 days", "detail": "A full day fast nearly guarantees entering ketosis. Glycogen empties within 24h.", "icon": "\U0001f6ab"},
    {"action": "Cold shower (2-5 min)", "impact": "Saves ~0.25 day", "detail": "Cold activates brown fat. Increases norepinephrine 200-300%, boosting fat oxidation.", "icon": "\U0001f976"},
    {"action": "MCT C8 oil (1-2 tbsp)", "impact": "Boosts ketones immediately", "detail": "C8 bypasses digestion and converts to ketones in the liver within 15 minutes.", "icon": "\U0001f965"},
    {"action": "Sleep 7-8 hours", "impact": "Prevents ~1 day delay", "detail": "Poor sleep raises cortisol 37-45%, which raises blood sugar and blocks ketosis.", "icon": "\U0001f634"},
    {"action": "Reduce stress", "impact": "Prevents ~0.5 day delay", "detail": "Chronic stress keeps cortisol elevated. Meditation, walks in nature, or deep breathing help.", "icon": "\U0001f9d8"},
]

SPEED_TIPS = {
    "carnivore": [
        {"tip": "Eat fatty cuts, not lean", "why": "Excess protein without fat triggers gluconeogenesis."},
        {"tip": "Add butter, tallow, or bone marrow", "why": "Fat is your primary fuel. More fat = more ketones. Ribeye > chicken breast."},
        {"tip": "Try a fat fast (1-3 days)", "why": "Eat ONLY fat (butter, tallow, MCT) \u2014 1000-1200 cal/day, 90%+ from fat."},
        {"tip": "Salt everything \u2014 5g+ sodium/day", "why": "Carnivore + ketosis = rapid sodium loss. Add 1/4 tsp salt to every glass of water."},
        {"tip": "Fasted morning walk (30-45 min)", "why": "Burns ~150 kcal from fat/glycogen. Saves ~0.5 day on ketosis entry."},
        {"tip": "Cold exposure (2-5 min)", "why": "Activates brown fat, increases norepinephrine 200-300%."},
    ],
    "ultra_strict": [
        {"tip": "Track every gram", "why": "At <10g carbs, a single tablespoon of wrong sauce can kick you out."},
        {"tip": "MCT oil in coffee", "why": "MCT converts directly to ketones. Fastest ketone boost."},
        {"tip": "Extend your fasting window", "why": "Longer fasts = more ketone production. Try 20:4 or OMAD."},
        {"tip": "Exercise fasted in the morning", "why": "Depletes remaining glycogen after overnight fast."},
        {"tip": "Prioritize sleep \u2014 7-8 hours", "why": "Poor sleep raises cortisol \u2192 raises blood sugar \u2192 slows ketosis."},
        {"tip": "Avoid all sweeteners initially", "why": "Even zero-calorie sweeteners can trigger insulin in some people."},
    ],
    "standard_keto": [
        {"tip": "Stay under 20g net carbs strictly", "why": "20g gets almost everyone into ketosis within 3-4 days."},
        {"tip": "Try a fat fast (1-3 days)", "why": "Eat only fat \u2014 1000-1200 cal/day, 90%+ from fat."},
        {"tip": "Add MCT C8 oil (1-2 tbsp/day)", "why": "C8 bypasses digestion and converts to ketones in 15 minutes."},
        {"tip": "Fasted morning walk (30-45 min)", "why": "Burns ~150 kcal from fat stores. Saves ~0.5 day."},
        {"tip": "Electrolytes: Na 5g, K 3.5g, Mg 400mg", "why": "Low electrolytes cause 90% of keto flu."},
        {"tip": "Consider OMAD or 20:4 IF", "why": "Longer fasting = more hours producing ketones."},
    ],
    "keto_omad": [
        {"tip": "Your 23h fast is your superpower", "why": "OMAD means 23 hours/day of fat burning and ketone production."},
        {"tip": "Fat fast your OMAD meal (first 2-3 days)", "why": "Make your one meal 90%+ fat to kickstart deep ketosis."},
        {"tip": "MCT C8 oil during the fast", "why": "1 tbsp in black coffee doesn't break ketosis but raises ketone levels."},
        {"tip": "Don't snack \u2014 strict one meal", "why": "Even a handful of nuts resets your insulin clock."},
        {"tip": "Fasted walk before your meal", "why": "Walking 30-45 min before breaking fast maximizes fat burning."},
        {"tip": "Make your meal nutrient-dense", "why": "One meal = one shot at all micronutrients. Don't waste it."},
    ],
    "lazy": [
        {"tip": "Temporarily tighten to 20g carbs", "why": "At 30g, ketosis is slower. Dropping to 20g for 2 weeks kickstarts it."},
        {"tip": "Track carbs for 1 week", "why": "You might be eating more carbs than you think."},
        {"tip": "Cut out all sugar and grains first", "why": "Highest-impact carb sources. Eliminating them alone may get you under 30g."},
        {"tip": "Add a 16:8 fasting window", "why": "Combining lazy keto with IF compensates for higher carbs."},
        {"tip": "Increase fat at meals", "why": "Cook with butter, add olive oil, eat avocado. Fat fuels ketosis."},
        {"tip": "Walk 30 minutes daily", "why": "Low-intensity movement burns fat preferentially."},
    ],
    "lite": [
        {"tip": "Drop to 30g carbs for 2 weeks", "why": "At 50g, many people don't reach ketosis. A temporary drop helps."},
        {"tip": "Focus on food quality", "why": "Eat whole foods, avoid processed carbs."},
        {"tip": "Try MCT oil", "why": "MCT produces ketones even at higher carb intakes."},
        {"tip": "Combine with exercise", "why": "Active people can stay ketotic at 50g."},
        {"tip": "Test with ketone strips", "why": "At 50g, individual response varies. Testing confirms YOUR threshold."},
        {"tip": "Prioritize fiber-rich carbs", "why": "10g from spinach \u2260 10g from bread. Fiber doesn't impact ketosis."},
    ],
}
