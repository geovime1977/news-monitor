#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

# Verifica .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "  ┌─────────────────────────────────────────────────────┐"
  echo "  │  Arquivo .env criado.                                │"
  echo "  │  Abra o arquivo .env e insira sua GEMINI_API_KEY.    │"
  echo "  └─────────────────────────────────────────────────────┘"
  echo ""
  exit 1
fi

if grep -q "sua_chave_aqui" .env; then
  echo ""
  echo "  ⚠️  Configure sua GEMINI_API_KEY no arquivo .env antes de continuar."
  echo ""
  exit 1
fi

# Cria e ativa venv
if [ ! -d venv ]; then
  echo "→ Criando ambiente virtual Python..."
  python3 -m venv venv
fi
source venv/bin/activate

# Instala dependências
echo "→ Instalando dependências..."
pip install -q -r requirements.txt

echo ""
echo "  ┌──────────────────────────────────────────┐"
echo "  │  Monitor Geopolítico                      │"
echo "  │  Acesse: http://localhost:8002            │"
echo "  └──────────────────────────────────────────┘"
echo ""

uvicorn main:app --host 0.0.0.0 --port 8002 --reload
