# NutriPlan AI

AI-powered nutrition and meal planner with support for OMAD, Keto, and custom diets. Generates personalized meal plans, suggests recipes from available ingredients, analyzes nutritional content, and tracks weight progress.

## Features

- **Meal Planner** — AI-generated meal plans tailored to your diet (OMAD, Keto, Paleo, etc.)
- **Recipe Finder** — Input available ingredients, get recipes that fit your macros
- **Nutritional Analysis** — Describe a meal, get AI-powered macro/micro breakdown
- **Meal Logging** — Track daily meals with nutritional data
- **Weight Tracking** — Log weight, visualize trends, get AI insights
- **Dashboard** — Daily macro progress and quick actions

## Setup

```bash
cd nutrition-planner
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your OpenAI API key
```

## Run

```bash
python main.py
```

Open http://localhost:8001

## Configuration

Set your API key either:
- In `.env` file: `OPENAI_API_KEY=sk-...`
- In the app Settings page

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model to use |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | API base URL (for compatible providers) |
| `APP_PORT` | `8001` | Server port |

## Tech Stack

Python, FastAPI, OpenAI, HTML/CSS/JS
