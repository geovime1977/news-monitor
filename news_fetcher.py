import feedparser
import re
from datetime import datetime
from dateutil import parser as date_parser
from concurrent.futures import ThreadPoolExecutor, as_completed

RSS_FEEDS = {
    "nacional": [
        {"name": "G1 Globo", "url": "https://g1.globo.com/rss/g1/"},
        {"name": "Agência Brasil", "url": "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml"},
        {"name": "Folha de S.Paulo", "url": "https://feeds.folha.uol.com.br/poder/rss091.xml"},
        {"name": "UOL Notícias", "url": "https://rss.uol.com.br/feed/noticias.xml"},
        {"name": "CNN Brasil", "url": "https://www.cnnbrasil.com.br/feed/"},
    ],
    "internacional": [
        {"name": "BBC Brasil", "url": "https://feeds.bbci.co.uk/portuguese/rss.xml"},
        {"name": "DW Brasil", "url": "https://rss.dw.com/rdf/rss-bra-bra"},
        {"name": "Al Jazeera", "url": "https://www.aljazeera.com/xml/rss/all.xml"},
        {"name": "BBC World", "url": "https://feeds.bbci.co.uk/news/world/rss.xml"},
        {"name": "Reuters World", "url": "https://feeds.reuters.com/reuters/worldNews"},
        {"name": "France 24", "url": "https://www.france24.com/en/rss"},
    ],
}

_HTML_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")


def _strip_html(text: str) -> str:
    text = _HTML_RE.sub(" ", text)
    return _SPACE_RE.sub(" ", text).strip()


def _parse_date(entry) -> datetime:
    try:
        if getattr(entry, "published_parsed", None):
            return datetime(*entry.published_parsed[:6])
        if getattr(entry, "published", None):
            return date_parser.parse(entry.published, ignoretz=True)
    except Exception:
        pass
    return datetime.utcnow()


def _fetch_one(feed_info: dict, source_type: str) -> list:
    articles = []
    try:
        feed = feedparser.parse(feed_info["url"])
        for entry in feed.entries[:10]:
            summary = getattr(entry, "summary", "") or getattr(entry, "description", "")
            articles.append(
                {
                    "title": (getattr(entry, "title", "") or "Sem título")[:500],
                    "url": getattr(entry, "link", ""),
                    "source": feed_info["name"],
                    "source_type": source_type,
                    "summary": _strip_html(summary)[:2000],
                    "published_at": _parse_date(entry),
                }
            )
    except Exception as exc:
        print(f"[feed] Erro em {feed_info['name']}: {exc}")
    return articles


def fetch_all_feeds() -> list:
    jobs = [
        (feed_info, source_type)
        for source_type, feeds in RSS_FEEDS.items()
        for feed_info in feeds
    ]
    all_articles = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(_fetch_one, fi, st): fi["name"] for fi, st in jobs}
        for fut in as_completed(futures, timeout=20):
            try:
                all_articles.extend(fut.result())
            except Exception:
                pass
    return all_articles
