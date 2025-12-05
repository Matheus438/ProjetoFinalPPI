import express from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const host = "0.0.0.0";
const porta = process.env.PORT || 3000; // Vercel will set PORT

// Dados em memória (substituir por banco em produção)
const equipes = []; // { id, nome, capitao, contato }
const jogadores = []; // { id, nome, nick, funcao, elo, genero, equipeId }
let nextEquipeId = 1;
let nextJogadorId = 1;

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: "ChaveSuperSecreta_CampeonatoLoL_2025",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 30 } // 30 minutos
}));

// --- Helpers ---
function verificaUserLogado(req, res, next) {
  if (req.session.dadosLogin?.logado) return next();
  return res.redirect('/login');
}

function renderBasePage(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
  <div class="container py-4">
    ${bodyHtml}
  </div>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;
}

// --- Rotas ---
app.get('/', verificaUserLogado, (req, res) => {
  const ultimoAcesso = req.cookies?.ultimoAcesso;
  const agora = new Date();
  // atualiza cookie com data/hora atual (string local)
  res.cookie('ultimoAcesso', agora.toLocaleString(), { maxAge: 1000 * 60 * 60 * 24 * 30 });

  const body = `
  <div class="card p-4 mx-auto" style="max-width:640px">
    <h1 class="text-center mb-3">Menu do Sistema - Campeonato Amador LoL</h1>

    <p class="text-center text-muted"><strong>Último acesso:</strong> ${ultimoAcesso || 'Primeiro acesso'}</p>

    <div class="d-grid gap-2">
      <a class="btn btn-primary" href="/equipes/novo">Cadastro de Equipe</a>
      <a class="btn btn-success" href="/jogadores/novo">Cadastro de Jogador</a>
      <a class="btn btn-secondary" href="/equipes/listar">Listar Equipes</a>
      <a class="btn btn-info text-white" href="/jogadores/listar">Listar Jogadores (por equipe)</a>
      <a class="btn btn-danger" href="/logout">Sair</a>
    </div>
  </div>`;

  res.send(renderBasePage('Menu', body));
});

// Login
app.get('/login', (req, res) => {
  // simples formulário de login com usuário único
  const body = `
  <div class="row justify-content-center">
    <div class="col-12 col-md-6">
      <h3 class="mb-3">Login</h3>
      <form method="POST" action="/login">
        <div class="mb-2">
          <label class="form-label">Usuário</label>
          <input class="form-control" name="usuario" required>
        </div>
        <div class="mb-3">
          <label class="form-label">Senha</label>
          <input type="password" class="form-control" name="senha" required>
        </div>
        <button class="btn btn-primary">Entrar</button>
      </form>
    </div>
  </div>`;
  res.send(renderBasePage('Login', body));
});

app.post('/login', (req, res) => {
  const { usuario, senha } = req.body;
  // credenciais fixas conforme enunciado (pode ser alterado)
  if (usuario === 'admin' && senha === '12345') {
    req.session.dadosLogin = { nome: 'Admin', logado: true };
    // salvar último acesso via cookie será feito na rota /
    return res.redirect('/');
  }
  res.send(renderBasePage('Login - Erro', `<div class="alert alert-danger">Usuário ou senha inválidos.</div><a href="/login" class="btn btn-secondary">Voltar</a>`));
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// --- Equipe: criar e listar ---
app.get('/equipes/novo', verificaUserLogado, (req, res) => {
  const body = `
  <div class="card p-3" style="max-width:720px;margin:0 auto;">
    <h3>Cadastro de Equipe</h3>
    <form method="POST" action="/equipes">
      <div class="mb-2">
        <label class="form-label">Nome da equipe</label>
        <input name="nome" class="form-control" required>
      </div>
      <div class="mb-2">
        <label class="form-label">Nome do capitão</label>
        <input name="capitao" class="form-control" required>
      </div>
      <div class="mb-2">
        <label class="form-label">Telefone / WhatsApp</label>
        <input name="contato" class="form-control" required>
      </div>
      <div class="mt-3">
        <button class="btn btn-success">Cadastrar Equipe</button>
        <a class="btn btn-secondary ms-2" href="/">Voltar</a>
      </div>
    </form>
  </div>`;
  res.send(renderBasePage('Cadastro de Equipe', body));
});

app.post('/equipes', verificaUserLogado, (req, res) => {
  const { nome, capitao, contato } = req.body;
  // Validação server-side
  if (!nome?.trim() || !capitao?.trim() || !contato?.trim()) {
    return res.send(renderBasePage('Erro - Cadastro Equipe', `<div class="alert alert-danger">Todos os campos são obrigatórios.</div><a class="btn btn-secondary" href="/equipes/novo">Voltar</a>`));
  }

  // cria equipe e redireciona para lista
  equipes.push({ id: nextEquipeId++, nome: nome.trim(), capitao: capitao.trim(), contato: contato.trim() });
  res.redirect('/equipes/listar');
});

app.get('/equipes/listar', verificaUserLogado, (req, res) => {
  let html = `
  <div class="card p-3">
    <h3>Equipes Cadastradas</h3>
    <table class="table table-striped mt-3">
      <thead><tr><th>#</th><th>Nome</th><th>Capitão</th><th>Contato</th><th>Jogadores</th></tr></thead>
      <tbody>`;

  for (const e of equipes) {
    const countPlayers = jogadores.filter(j => j.equipeId === e.id).length;
    html += `<tr><td>${e.id}</td><td>${e.nome}</td><td>${e.capitao}</td><td>${e.contato}</td><td>${countPlayers}/5</td></tr>`;
  }

  html += `</tbody></table>
    <a class="btn btn-primary" href="/equipes/novo">Cadastrar nova equipe</a>
    <a class="btn btn-secondary ms-2" href="/">Voltar ao menu</a>
  </div>`;

  res.send(renderBasePage('Lista de Equipes', html));
});

// --- Jogador: criar e listar (agrupado por equipe) ---
app.get('/jogadores/novo', verificaUserLogado, (req, res) => {
  // Renderiza select de equipes no servidor
  if (equipes.length === 0) {
    return res.send(renderBasePage('Cadastrar Jogador', `<div class="alert alert-warning">Não existem equipes cadastradas. Cadastre uma equipe antes de adicionar jogadores.</div><a class="btn btn-primary" href="/equipes/novo">Cadastrar Equipe</a> <a class="btn btn-secondary ms-2" href="/">Voltar</a>`));
  }

  let options = '';
  for (const e of equipes) {
    options += `<option value="${e.id}">${e.nome}</option>`;
  }

  const body = `
  <div class="card p-3" style="max-width:720px;margin:0 auto;">
    <h3>Cadastro de Jogador</h3>
    <form method="POST" action="/jogadores">
      <div class="mb-2">
        <label class="form-label">Nome do jogador</label>
        <input name="nome" class="form-control" required>
      </div>
      <div class="mb-2">
        <label class="form-label">Nickname (in-game)</label>
        <input name="nick" class="form-control" required>
      </div>
      <div class="mb-2">
        <label class="form-label">Função</label>
        <select name="funcao" class="form-select" required>
          <option value="">Selecione...</option>
          <option>Top</option>
          <option>Jungle</option>
          <option>Mid</option>
          <option>Atirador</option>
          <option>Suporte</option>
        </select>
      </div>
      <div class="mb-2">
        <label class="form-label">Elo</label>
        <select name="elo" class="form-select" required>
          <option value="">Selecione...</option>
          <option>Ferro</option>
          <option>Bronze</option>
          <option>Prata</option>
          <option>Ouro</option>
          <option>Platina</option>
          <option>Diamante</option>
          <option>Master</option>
          <option>Grandmaster</option>
          <option>Challenger</option>
        </select>
      </div>
      <div class="mb-2">
        <label class="form-label">Gênero</label>
        <select name="genero" class="form-select" required>
          <option value="">Selecione...</option>
          <option>Masculino</option>
          <option>Feminino</option>
          <option>Outro</option>
          <option>Prefiro não dizer</option>
        </select>
      </div>

      <div class="mb-2">
        <label class="form-label">Equipe</label>
        <select name="equipeId" class="form-select" required>
          <option value="">Selecione uma equipe...</option>
          ${options}
        </select>
      </div>

      <div class="mt-3">
        <button class="btn btn-success">Cadastrar Jogador</button>
        <a class="btn btn-secondary ms-2" href="/">Voltar</a>
      </div>
    </form>
  </div>`;

  res.send(renderBasePage('Cadastro de Jogador', body));
});

app.post('/jogadores', verificaUserLogado, (req, res) => {
  const { nome, nick, funcao, elo, genero, equipeId } = req.body;

  // validação server-side
  if (!nome?.trim() || !nick?.trim() || !funcao || !elo || !genero || !equipeId) {
    return res.send(renderBasePage('Erro - Cadastro Jogador', `<div class="alert alert-danger">Todos os campos são obrigatórios.</div><a class="btn btn-secondary" href="/jogadores/novo">Voltar</a>`));
  }

  const equipe = equipes.find(e => e.id === Number(equipeId));
  if (!equipe) {
    return res.send(renderBasePage('Erro - Cadastro Jogador', `<div class="alert alert-danger">Equipe selecionada inválida.</div><a class="btn btn-secondary" href="/jogadores/novo">Voltar</a>`));
  }

  // Verificar limite de 5 jogadores por equipe
  const qtd = jogadores.filter(j => j.equipeId === Number(equipeId)).length;
  if (qtd >= 5) {
    return res.send(renderBasePage('Erro - Cadastro Jogador', `<div class="alert alert-danger">A equipe "${equipe.nome}" já possui 5 jogadores cadastrados.</div><a class="btn btn-secondary" href="/jogadores/listar">Ver jogadores</a>`));
  }

  // adicionar jogador
  jogadores.push({ id: nextJogadorId++, nome: nome.trim(), nick: nick.trim(), funcao, elo, genero, equipeId: Number(equipeId) });
  res.redirect('/jogadores/listar');
});

app.get('/jogadores/listar', verificaUserLogado, (req, res) => {
  if (equipes.length === 0) {
    return res.send(renderBasePage('Jogadores', `<div class="alert alert-info">Nenhuma equipe cadastrada.</div><a class="btn btn-primary" href="/equipes/novo">Cadastrar Equipe</a>`));
  }

  let html = '<div class="card p-3">';
  html += '<h3>Jogadores por Equipe</h3>';

  for (const e of equipes) {
    html += `<div class="mt-3">
      <h5>${e.nome} <small class="text-muted">(Capitão: ${e.capitao})</small></h5>`;

    const lista = jogadores.filter(j => j.equipeId === e.id);
    if (lista.length === 0) {
      html += '<p class="text-muted">Nenhum jogador cadastrado nesta equipe.</p>';
    } else {
      html += '<table class="table table-sm table-striped"><thead><tr><th>#</th><th>Nome</th><th>Nick</th><th>Função</th><th>Elo</th><th>Gênero</th></tr></thead><tbody>';
      for (const j of lista) {
        html += `<tr><td>${j.id}</td><td>${j.nome}</td><td>${j.nick}</td><td>${j.funcao}</td><td>${j.elo}</td><td>${j.genero}</td></tr>`;
      }
      html += '</tbody></table>';
    }
    html += '</div>';
  }

  html += '<div class="mt-3"><a class="btn btn-primary" href="/jogadores/novo">Cadastrar Jogador</a> <a class="btn btn-secondary ms-2" href="/">Voltar</a></div>';
  html += '</div>';

  res.send(renderBasePage('Lista de Jogadores', html));
});

// rota health
app.get('/health', (req, res) => res.send('OK'));

app.listen(porta, host, () => {
  console.log(`Servidor rodando em http://${host}:${porta}`);
});
