/* Floresça — lógica do site. Login e dados vêm do Supabase.
   A segurança real está nas regras (RLS) do schema.sql, não neste arquivo. */
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $app = document.getElementById('app');
const FRASES_PADRAO = [
  'Você é importante, mesmo nos dias em que não consegue enxergar isso.',
  'Respeite seu tempo. Cada pessoa tem seu próprio processo.',
  'Não há problema em pedir ajuda.',
  'Pequenos passos também são progresso.',
  'Você não precisa ser forte o tempo todo.',
  'Sua saúde emocional também merece atenção.',
  'Recomeçar quantas vezes forem necessárias também é coragem.'
];
let session = null, agenda = {}, dataSel = null;
let mes = new Date(); mes.setDate(1);

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const iso = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

/* ===== Dados ===== */
async function carregarSessao() {
  session = null;
  const { data } = await sb.auth.getUser();
  if (!data || !data.user) return;
  const { data: p } = await sb.from('profiles').select('nome,papel').eq('id', data.user.id).single();
  if (p) session = p;
}
async function buscarFrases() {
  const { data } = await sb.from('phrases').select('texto').order('id');
  return data && data.length ? data.map(x => x.texto) : FRASES_PADRAO;
}
async function carregarAgenda() {
  const y = mes.getFullYear(), m = mes.getMonth();
  const { data } = await sb.from('availability').select('dia,status,horas')
    .gte('dia', iso(new Date(y, m, 1))).lte('dia', iso(new Date(y, m+1, 0)));
  agenda = {}; (data || []).forEach(r => agenda[r.dia] = r);
}
async function salvarDia(dia, reg) {
  const r = reg ? await sb.from('availability').upsert({ dia, status: reg.status, horas: reg.horas })
                : await sb.from('availability').delete().eq('dia', dia);
  if (r.error) alert('Não foi possível salvar: ' + r.error.message);
}

/* ===== Páginas ===== */
const cards = (fs, n) => fs.slice(0, n || 99).map(f => '<div class="card q">' + esc(f) + '</div>').join('');

const pages = {
  home: async () => {
    const fs = await buscarFrases();
    return '<div class="hero"><h1>Você não precisa enfrentar tudo sozinho.</h1>' +
      '<p>A escola oferece um espaço de apoio e acolhimento emocional. Aqui você encontra mensagens, conteúdos e os horários da nossa psicóloga.</p>' +
      '<a class="btn soft" href="#sobre">Conheça nosso espaço</a><a class="btn soft" href="#login">Acesse sua conta</a></div>' +
      '<section><h2>Palavras para hoje</h2><div class="grid">' + cards(fs, 3) + '</div><p><a href="#frases">Ver todas as frases</a></p></section>' +
      '<section><h2>Por que cuidar da saúde mental?</h2><div class="grid">' +
      '<div class="card"><h3>Ela afeta tudo</h3><p>Sono, estudos, amizades e disposição passam pelo nosso bem-estar emocional.</p></div>' +
      '<div class="card"><h3>Pedir ajuda é cuidado</h3><p>Falar sobre o que sentimos cedo evita que as dificuldades pesem mais.</p></div>' +
      '<div class="card"><h3>Todos passam por isso</h3><p>Ter dias difíceis é humano. Você não precisa lidar com eles em silêncio.</p></div></div></section>' +
      '<section class="card"><h2>Apoio psicológico na escola</h2><p>A psicóloga da instituição atende alunos em horários combinados. Consulte os dias disponíveis no calendário.</p><a class="btn" href="#calendario">Ver calendário</a></section>';
  },
  sobre: async () => '<h1>Sobre o Floresça</h1><div class="card"><p>O Floresça é um espaço da escola para acolher estudantes. Reunimos frases de incentivo, conteúdos sobre saúde mental e a agenda de atendimento da psicóloga.</p><p>O site não faz diagnósticos e não substitui atendimento profissional. Pedimos apenas os dados necessários, e nenhum relato pessoal é exibido publicamente.</p></div>',
  frases: async () => '<h1>Frases para lembrar</h1><div class="grid">' + cards(await buscarFrases()) + '</div>',
  login: async () => '<h1>Entrar</h1><form id="f-login"><label>E-mail institucional<input type="email" name="email" required autocomplete="email"></label><label>Senha<input type="password" name="senha" required autocomplete="current-password"></label><div id="err" class="msg" hidden></div><button class="btn">Entrar</button><p class="note">Ainda não tem conta? <a href="#cadastro">Cadastre-se</a>. Psicóloga? <a href="#psicologa">Acesso administrativo</a>.</p></form>',
  cadastro: async () => '<h1>Criar conta de aluno</h1><form id="f-cad"><label>Nome<input name="nome" required autocomplete="name"></label><label>E-mail institucional<input type="email" name="email" required autocomplete="email"></label><label>Senha (mínimo 8 caracteres)<input type="password" name="senha" minlength="8" required autocomplete="new-password"></label><div id="err" class="msg" hidden></div><button class="btn">Criar conta</button></form>',
  psicologa: async () => '<h1>Acesso da psicóloga</h1><form id="f-psi"><label>E-mail<input type="email" name="email" required></label><label>Senha<input type="password" name="senha" required></label><div id="err" class="msg" hidden></div><button class="btn">Entrar no painel</button></form>',
  calendario: async () => {
    if (!session) return '<h1>Calendário de Disponibilidade</h1><div class="card"><p>Entre na sua conta para ver os dias de atendimento.</p><a class="btn" href="#login">Entrar</a></div>';
    await carregarAgenda();
    return '<h1>Calendário de Disponibilidade</h1>' + calHTML(false);
  },
  painel: async () => {
    if (!session || session.papel !== 'psicologa') return '<div class="card"><p>Área restrita à psicóloga.</p><a class="btn" href="#psicologa">Fazer login</a></div>';
    await carregarAgenda();
    return '<h1>Painel da psicóloga</h1><p>Olá, ' + esc(session.nome) + '. Escolha uma data para definir a disponibilidade.</p>' + calHTML(true);
  }
};

/* ===== Calendário ===== */
function calHTML(edit) {
  const y = mes.getFullYear(), m = mes.getMonth();
  const nome = mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  let h = '<div class="' + (edit ? 'edit' : '') + '"><div class="cal-head"><button class="btn soft sm" data-mes="-1" aria-label="Mês anterior">‹</button><h2 style="margin:0;text-transform:capitalize">' + nome + '</h2><button class="btn soft sm" data-mes="1" aria-label="Próximo mês">›</button></div><div class="cal">';
  ['D','S','T','Q','Q','S','S'].forEach(d => h += '<div class="dow">' + d + '</div>');
  for (let i = 0; i < new Date(y, m, 1).getDay(); i++) h += '<div class="day blank"></div>';
  for (let d = 1; d <= new Date(y, m+1, 0).getDate(); d++) {
    const k = iso(new Date(y, m, d)), a = agenda[k];
    const c = k === dataSel ? 'sel' : (a ? a.status : '');
    h += '<button class="day ' + c + '" data-d="' + k + '"' + (edit ? '' : ' tabindex="-1"') + '>' + d + (a && a.horas.length ? '<small>' + a.horas.length + ' hor.</small>' : '') + '</button>';
  }
  h += '</div><div class="legend"><span><i style="background:var(--sage)"></i>Disponível</span><span><i style="background:var(--bad)"></i>Indisponível</span><span><i style="background:#e9e3d6"></i>Sem cadastro</span><span><i style="background:var(--deep)"></i>Selecionado</span></div>';
  if (dataSel) {
    const a = agenda[dataSel];
    h += '<div class="card"><h3>' + dataSel.split('-').reverse().join('/') + '</h3>';
    if (a && a.status === 'ok') h += '<p>Horários: ' + (a.horas.map(x => esc(x) + (edit ? ' <button class="btn soft sm" data-rm="' + esc(x) + '" aria-label="Remover ' + esc(x) + '">×</button>' : '')).join(' · ') || 'a definir') + '</p>';
    else h += '<p>' + (a ? 'Sem atendimento neste dia.' : 'Ainda sem disponibilidade cadastrada.') + '</p>';
    if (edit) h += '<div class="row"><label>Novo horário<input type="time" id="hora"></label><button class="btn sm" data-add="1">Adicionar horário</button><button class="btn soft sm" data-st="no">Marcar indisponível</button><button class="btn soft sm" data-st="del">Limpar dia</button></div>';
    h += '</div>';
  }
  return h + '</div>';
}

/* ===== Navegação ===== */
function renderNav() {
  const links = [['home','Início'],['frases','Frases'],['calendario','Calendário'],['sobre','Sobre']];
  if (!session) links.push(['login','Entrar']); else if (session.papel === 'psicologa') links.push(['painel','Painel']);
  const cur = (location.hash || '#home').slice(1);
  document.getElementById('nav').innerHTML = links.map(l => '<a href="#' + l[0] + '"' + (cur === l[0] ? ' class="on"' : '') + '>' + l[1] + '</a>').join('') + (session ? '<a href="#home" id="sair">Sair</a>' : '');
}
async function route(scroll = true) {
  let r = (location.hash || '#home').slice(1);
  if (!pages[r]) r = 'home';
  $app.innerHTML = await pages[r]();
  renderNav(); if (scroll) window.scrollTo(0, 0);
}
const erro = t => { const e = document.getElementById('err'); if (e) { e.textContent = t; e.hidden = false; } };

/* ===== Formulários ===== */
document.addEventListener('submit', async ev => {
  ev.preventDefault();
  const f = new FormData(ev.target), id = ev.target.id;
  const email = String(f.get('email') || '').trim().toLowerCase(), senha = String(f.get('senha') || '');
  if (id === 'f-cad') {
    const { data, error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome: String(f.get('nome')).trim() } } });
    if (error) return erro('Não foi possível criar a conta: ' + error.message);
    if (!data.session) return erro('Conta criada. Confirme seu e-mail para entrar.');
  } else {
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) return erro('E-mail ou senha incorretos.');
  }
  await carregarSessao();
  if (id === 'f-psi' && (!session || session.papel !== 'psicologa')) { await sb.auth.signOut(); session = null; return erro('Esta conta não tem acesso administrativo.'); }
  location.hash = id === 'f-psi' ? 'painel' : 'home';
  route();
});

/* ===== Cliques (calendário e sair) ===== */
document.addEventListener('click', async ev => {
  const t = ev.target.closest('[data-mes],[data-d],[data-add],[data-st],[data-rm],#sair');
  if (!t) return;
  if (t.id === 'sair') { await sb.auth.signOut(); session = null; return route(); }
  if (t.dataset.mes) { mes.setMonth(mes.getMonth() + Number(t.dataset.mes)); dataSel = null; return route(false); }
  if (!session || session.papel !== 'psicologa') return;   // alunos: somente leitura (o banco também recusa)
  if (t.dataset.d) { dataSel = t.dataset.d; return route(false); }
  let a = agenda[dataSel];
  if (t.dataset.add) {
    const v = document.getElementById('hora').value; if (!v) return;
    a = (a && a.status === 'ok') ? a : { status: 'ok', horas: [] };
    if (!a.horas.includes(v)) a.horas.push(v);
    a.horas.sort(); await salvarDia(dataSel, a);
  } else if (t.dataset.st === 'no') await salvarDia(dataSel, { status: 'no', horas: [] });
  else if (t.dataset.st === 'del') await salvarDia(dataSel, null);
  else if (t.dataset.rm) {
    a.horas = a.horas.filter(x => x !== t.dataset.rm);
    await salvarDia(dataSel, a.horas.length ? a : null);
  }
  route(false);
});

window.addEventListener('hashchange', () => route());
carregarSessao().then(() => route());
