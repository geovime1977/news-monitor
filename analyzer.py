import json
import os
import re

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

_PROMPT = """\
Você é um renomado comentarista geopolítico com décadas de experiência em análise internacional. \
Analise a notícia abaixo com profundidade e retorne APENAS um objeto JSON válido em português brasileiro, \
sem markdown, sem texto extra antes ou depois.

NOTÍCIA
Título: {title}
Fonte: {source} ({source_type})
Data: {date}
Conteúdo: {summary}

FORMATO DE RESPOSTA (JSON puro):
{{
  "resumo_executivo": "2-3 parágrafos explicando o que ocorreu e sua relevância global/nacional",
  "causas": ["causa histórica ou estrutural", "causa imediata", "fator desencadeante"],
  "consequencias": ["consequência imediata", "desdobramento de médio prazo", "impacto de longo prazo"],
  "reflexos_geopoliticos": "análise de disputas de poder, alianças afetadas, reordenamento regional e global",
  "reflexos_economicos": "impactos em mercados, comércio, moedas, commodities e cadeias de suprimento",
  "reflexos_politicos": "impactos políticos internos e externos, governabilidade, eleições, diplomacia",
  "reflexos_sociais": "impactos na sociedade civil, populações vulneráveis, migrações e coesão social",
  "texto_postagem": "texto de 300-400 palavras para LinkedIn, tom analítico e acessível, primeira pessoa, \
como comentarista experiente — termine com 4-5 hashtags relevantes"
}}"""


def _get_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY não encontrada. Configure o arquivo .env")
    return OpenAI(api_key=api_key)


def _clean(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()
    return text


def analyze_news(news: dict) -> dict:
    client = _get_client()
    model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    prompt = _PROMPT.format(
        title=news.get("title", ""),
        source=news.get("source", ""),
        source_type="Nacional" if news.get("source_type") == "nacional" else "Internacional",
        date=str(news.get("published_at", ""))[:10],
        summary=(news.get("summary") or "Conteúdo não disponível")[:3000],
    )

    response = client.chat.completions.create(
        model=model_name,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )

    raw = _clean(response.choices[0].message.content)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            raise ValueError(f"Resposta inválida do GPT: {raw[:300]}")
        data = json.loads(match.group())

    data["causas"] = json.dumps(data.get("causas", []), ensure_ascii=False)
    data["consequencias"] = json.dumps(data.get("consequencias", []), ensure_ascii=False)
    return data
