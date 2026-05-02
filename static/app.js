'use strict';

let currentFilter = 'todas';
let allNews = [];
const analysisCache = new Map(); // newsId → analysis object

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadNews();
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
});

// ── Fetch news from RSS ───────────────────────────────────────────────────────

async function fetchNews() {
  const btn = document.getElementById('fetch-btn');
  const icon = document.getElementById('fetch-icon');
  btn.disabled = true;
  icon.innerHTML = '<span class="spinner" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:2px;"></span>';

  try {
    const res = await fetch('/api/news/fetch');
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    showToast(`✓ ${data.new} novas notícias adicionadas (${data.fetched} lidas)`, 'success');
    await loadNews();
  } catch (e) {
    showToast('Erro ao buscar notícias: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    icon.textContent = '↻';
  }
}

// ── Load & render news ────────────────────────────────────────────────────────

async function loadNews() {
  const grid = document.getElementById('news-grid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando notícias...</div>';

  try {
    const res = await fetch('/api/news');
    allNews = await res.json();
    updateStats();
    renderNews(currentFilter);
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>Erro ao carregar notícias. Verifique o servidor.</p></div>';
  }
}

function updateStats() {
  const nacional = allNews.filter(n => n.source_type === 'nacional').length;
  const internacional = allNews.filter(n => n.source_type === 'internacional').length;
  const analyzed = allNews.filter(n => n.analyzed).length;
  const bar = document.getElementById('stats-bar');
  if (allNews.length === 0) { bar.innerHTML = ''; return; }
  bar.innerHTML =
    `<span>🇧🇷 ${nacional} nacionais</span>` +
    `<span>🌍 ${internacional} internacionais</span>` +
    `<span style="color:var(--green)">✓ ${analyzed} analisadas</span>`;
}

function renderNews(filter) {
  const grid = document.getElementById('news-grid');
  const list = filter === 'todas' ? allNews : allNews.filter(n => n.source_type === filter);

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">${allNews.length === 0 ? '📡' : '🔍'}</div><p>${
      allNews.length === 0
        ? 'Clique em <strong>Buscar Notícias</strong> para carregar os principais veículos.'
        : 'Nenhuma notícia nesta categoria.'
    }</p></div>`;
    return;
  }

  grid.innerHTML = list.map(n => `
    <div class="news-card" id="card-${n.id}">
      <div class="card-tags">
        <span class="tag tag-${n.source_type}">${n.source_type === 'nacional' ? '🇧🇷 Nacional' : '🌍 Internacional'}</span>
        ${n.analyzed ? '<span class="tag tag-analyzed">✓ Analisado</span>' : ''}
      </div>
      <div class="card-title">
        <a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a>
      </div>
      ${n.summary ? `<div class="card-summary">${esc(n.summary)}</div>` : ''}
      <div class="card-footer">
        <div class="card-meta">
          <span class="card-source">${esc(n.source)}</span>
          ${n.published_at ? ` · ${fmtDate(n.published_at)}` : ''}
        </div>
        ${n.analyzed
          ? `<button class="btn-green" onclick="viewAnalysis(${n.id})">Ver Análise</button>`
          : `<button class="btn-outline btn" onclick="analyzeNews(${n.id})" id="analyze-${n.id}">Analisar</button>`}
      </div>
    </div>`).join('');
}

function filterNews(type, el) {
  currentFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderNews(type);
}

function switchTab(tab, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'history') loadHistory();
}

// ── Analyze ───────────────────────────────────────────────────────────────────

async function analyzeNews(newsId) {
  const btn = document.getElementById('analyze-' + newsId);
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Analisando…';

  try {
    const res = await fetch(`/api/news/${newsId}/analyze`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Erro desconhecido' }));
      throw new Error(err.detail || 'Erro na análise');
    }
    const analysis = await res.json();
    analysisCache.set(newsId, analysis);

    const item = allNews.find(n => n.id === newsId);
    if (item) item.analyzed = true;

    updateStats();
    renderNews(currentFilter);
    showModal(analysis);
    showToast('✓ Análise geopolítica concluída!', 'success');
  } catch (e) {
    showToast('Erro: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Analisar'; }
  }
}

async function viewAnalysis(newsId) {
  if (analysisCache.has(newsId)) { showModal(analysisCache.get(newsId)); return; }
  try {
    const res = await fetch(`/api/news/${newsId}/analyze`, { method: 'POST' });
    const analysis = await res.json();
    analysisCache.set(newsId, analysis);
    showModal(analysis);
  } catch (e) {
    showToast('Erro ao carregar análise', 'error');
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function showModal(a) {
  const news = a.news || {};
  const causas = Array.isArray(a.causas) ? a.causas : [];
  const consequencias = Array.isArray(a.consequencias) ? a.consequencias : [];

  document.getElementById('modal-body').innerHTML = `
    <div class="a-title">${esc(news.title || 'Análise')}</div>
    <div class="a-meta">
      <span class="tag tag-${news.source_type || 'internacional'}" style="font-size:.62rem">
        ${news.source_type === 'nacional' ? '🇧🇷 Nacional' : '🌍 Internacional'}
      </span>
      <span>${esc(news.source || '')}</span>
      <span>·</span>
      <span>${fmtDate(a.created_at)}</span>
      ${news.url ? `<a href="${esc(news.url)}" target="_blank" rel="noopener" style="color:var(--accent);font-size:.72rem">↗ Fonte original</a>` : ''}
    </div>

    <div class="section">
      <div class="section-title">📋 Resumo Executivo</div>
      <div class="section-body">${esc(a.resumo_executivo || '—')}</div>
    </div>

    <hr class="divider">

    <div class="two-col">
      <div class="section">
        <div class="section-title">🔍 Causas</div>
        <ul class="list-bullets">${causas.map(c => `<li>${esc(c)}</li>`).join('') || '<li>—</li>'}</ul>
      </div>
      <div class="section">
        <div class="section-title">⚡ Consequências</div>
        <ul class="list-bullets">${consequencias.map(c => `<li>${esc(c)}</li>`).join('') || '<li>—</li>'}</ul>
      </div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">🌐 Reflexos Geopolíticos</div>
      <div class="section-body">${esc(a.reflexos_geopoliticos || '—')}</div>
    </div>
    <div class="section">
      <div class="section-title">💰 Reflexos Econômicos</div>
      <div class="section-body">${esc(a.reflexos_economicos || '—')}</div>
    </div>
    <div class="section">
      <div class="section-title">🏛️ Reflexos Políticos</div>
      <div class="section-body">${esc(a.reflexos_politicos || '—')}</div>
    </div>
    <div class="section">
      <div class="section-title">👥 Reflexos Sociais</div>
      <div class="section-body">${esc(a.reflexos_sociais || '—')}</div>
    </div>

    <hr class="divider">

    <div class="section">
      <div class="section-title">✍️ Texto para Postagem</div>
      <div class="post-box" id="post-text">${esc(a.texto_postagem || '—')}</div>
      <button class="copy-btn" id="copy-btn" onclick="copyPost()">📋 Copiar Texto</button>
    </div>`;

  const modal = document.getElementById('modal');
  modal.classList.add('open');
  modal.scrollTop = 0;
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

function copyPost() {
  const text = document.getElementById('post-text').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = '✓ Copiado!';
    btn.classList.add('copied');
    showToast('✓ Texto copiado para a área de transferência!', 'success');
    setTimeout(() => { btn.textContent = '📋 Copiar Texto'; btn.classList.remove('copied'); }, 2500);
  }).catch(() => showToast('Não foi possível copiar. Selecione e copie manualmente.', 'error'));
}

// ── History ───────────────────────────────────────────────────────────────────

async function loadHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '<div class="loading" style="display:flex"><div class="spinner"></div> Carregando histórico...</div>';

  try {
    const res = await fetch('/api/analyses');
    const analyses = await res.json();
    analyses.forEach(a => analysisCache.set(a.news_id, a));

    if (analyses.length === 0) {
      list.innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><p>Nenhuma análise realizada ainda. Vá para <strong>Notícias</strong> e clique em <strong>Analisar</strong>.</p></div>';
      return;
    }

    list.innerHTML = analyses.map(a => `
      <div class="history-item">
        <div class="history-info">
          <div class="history-title">${esc(a.news?.title || 'Sem título')}</div>
          <div class="history-meta">
            <span class="tag tag-${a.news?.source_type || 'internacional'}" style="font-size:.62rem">
              ${a.news?.source_type === 'nacional' ? '🇧🇷 Nacional' : '🌍 Internacional'}
            </span>
            <span>${esc(a.news?.source || '')}</span>
            <span>·</span>
            <span>Analisado em ${fmtDate(a.created_at)}</span>
          </div>
        </div>
        <button class="btn-green" onclick="showCached(${a.news_id})">Ver Análise</button>
      </div>`).join('');
  } catch (e) {
    list.innerHTML = '<div class="empty-state"><p>Erro ao carregar histórico.</p></div>';
  }
}

function showCached(newsId) {
  const a = analysisCache.get(newsId);
  if (a) showModal(a);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtDate(str) {
  if (!str) return '';
  try {
    return new Date(str).toLocaleString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return str; }
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let _toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}
