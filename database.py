from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import json

Base = declarative_base()
engine = create_engine("sqlite:///news_monitor.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)


class News(Base):
    __tablename__ = "news"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    url = Column(String(1000), unique=True)
    source = Column(String(100))
    source_type = Column(String(20))  # nacional | internacional
    summary = Column(Text)
    published_at = Column(DateTime)
    fetched_at = Column(DateTime, default=datetime.utcnow)

    analyses = relationship("Analysis", back_populates="news", lazy="select")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "url": self.url,
            "source": self.source,
            "source_type": self.source_type,
            "summary": self.summary,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "fetched_at": self.fetched_at.isoformat() if self.fetched_at else None,
            "analyzed": len(self.analyses) > 0,
        }


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    news_id = Column(Integer, ForeignKey("news.id"))
    resumo_executivo = Column(Text)
    causas = Column(Text)         # JSON array string
    consequencias = Column(Text)  # JSON array string
    reflexos_geopoliticos = Column(Text)
    reflexos_economicos = Column(Text)
    reflexos_politicos = Column(Text)
    reflexos_sociais = Column(Text)
    texto_postagem = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    news = relationship("News", back_populates="analyses")

    def to_dict(self):
        return {
            "id": self.id,
            "news_id": self.news_id,
            "resumo_executivo": self.resumo_executivo,
            "causas": json.loads(self.causas) if self.causas else [],
            "consequencias": json.loads(self.consequencias) if self.consequencias else [],
            "reflexos_geopoliticos": self.reflexos_geopoliticos,
            "reflexos_economicos": self.reflexos_economicos,
            "reflexos_politicos": self.reflexos_politicos,
            "reflexos_sociais": self.reflexos_sociais,
            "texto_postagem": self.texto_postagem,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "news": self.news.to_dict() if self.news else None,
        }


def init_db():
    Base.metadata.create_all(engine)


def get_db():
    return SessionLocal()
