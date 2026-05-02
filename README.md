# News Monitor

Sistema de monitoramento e análise automática de notícias com PLN (Processamento de Linguagem Natural).

## Funcionalidades

- Coleta automática de notícias por palavras-chave
- Análise de sentimento e classificação temática via LLM
- Detecção de sinais fracos e tendências emergentes
- Dashboard web com histórico e alertas
- Banco de dados local SQLite

## Stack

- Python 3, Flask, SQLite, NLP/LLM

## Como executar

```bash
git clone https://github.com/geovime1977/news-monitor.git
cd news-monitor
pip install -r requirements.txt
cp .env.example .env  # configure as chaves de API
python main.py
```

## Estrutura

```
news-monitor/
├── main.py          # Ponto de entrada
├── news_fetcher.py  # Coleta de notícias
├── analyzer.py      # Análise NLP
├── database.py      # Persistência SQLite
└── static/          # Frontend
```

*Desenvolvido por Geovane Virmecati*
