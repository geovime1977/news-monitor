from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, joinedload

from analyzer import analyze_news
from database import Analysis, News, get_db, init_db
from news_fetcher import fetch_all_feeds


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Monitor Geopolítico", lifespan=lifespan)


def db_session():
    db = get_db()
    try:
        yield db
    finally:
        db.close()


# ── News ──────────────────────────────────────────────────────────────────────

@app.get("/api/news/fetch")
def fetch_news(db: Session = Depends(db_session)):
    articles = fetch_all_feeds()
    new_count = 0
    for art in articles:
        if not art.get("url"):
            continue
        if db.query(News).filter(News.url == art["url"]).first():
            continue
        db.add(News(**art))
        new_count += 1
    db.commit()
    return {"fetched": len(articles), "new": new_count}


@app.get("/api/news")
def list_news(
    source_type: Optional[str] = None,
    limit: int = 150,
    db: Session = Depends(db_session),
):
    q = db.query(News)
    if source_type and source_type != "todas":
        q = q.filter(News.source_type == source_type)
    items = q.order_by(News.published_at.desc()).limit(limit).all()
    return [n.to_dict() for n in items]


# ── Analyses ──────────────────────────────────────────────────────────────────

@app.post("/api/news/{news_id}/analyze")
def analyze_endpoint(news_id: int, db: Session = Depends(db_session)):
    news = db.query(News).filter(News.id == news_id).first()
    if not news:
        raise HTTPException(status_code=404, detail="Notícia não encontrada")

    existing = db.query(Analysis).filter(Analysis.news_id == news_id).first()
    if existing:
        return existing.to_dict()

    try:
        result = analyze_news(news.to_dict())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    analysis = Analysis(news_id=news_id, **result)
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis.to_dict()


@app.get("/api/analyses")
def list_analyses(db: Session = Depends(db_session)):
    items = (
        db.query(Analysis)
        .options(joinedload(Analysis.news))
        .order_by(Analysis.created_at.desc())
        .all()
    )
    return [a.to_dict() for a in items]


@app.get("/api/analyses/{analysis_id}")
def get_analysis(analysis_id: int, db: Session = Depends(db_session)):
    a = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Análise não encontrada")
    return a.to_dict()


# ── Static frontend ───────────────────────────────────────────────────────────
app.mount("/", StaticFiles(directory="static", html=True), name="static")
