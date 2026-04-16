# Documentacao Completa — Projeto Base Curso

Projeto fullstack com backend (Node.js + Fastify + TypeScript), frontend (React + Vite + TypeScript), banco PostgreSQL e deploy no Railway.

---

## Estrutura de Pastas

```
PROJETO_BASE_CURSO/
├── backend/
│   ├── src/
│   │   ├── index.ts                  # Entry point — inicializa servidor Fastify
│   │   ├── routes.ts                 # Todas as rotas da API
│   │   ├── db.ts                     # Conexao com PostgreSQL via pg
│   │   └── migrations/
│   │       ├── runner.ts             # Engine de migrations (versionada)
│   │       ├── index.ts              # Registro de todas as migrations
│   │       └── 001_create_items.ts   # Migration: cria tabela items
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── .env                          # Variaveis locais (nao commitado)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx                   # Componente principal com checklist de status
│   │   ├── main.tsx                  # Entry point do React
│   │   └── api.ts                    # Funcoes para chamar o backend
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts               # Proxy para backend em dev
├── .gitignore
└── README.md
```

---

## Backend

### Tecnologias

- Node.js 20
- Fastify 4 + @fastify/cors
- TypeScript
- pg (node-postgres)
- dotenv (carrega .env automaticamente)

### Conexao com o Banco (backend/src/db.ts)

```ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});
```

- Usa `DATABASE_URL` do `process.env` (carregada via dotenv do arquivo `.env` local ou via variaveis do Railway em producao)
- SSL ativado apenas quando `NODE_ENV=production`
- **Nao tem URLs fixas no codigo** — tudo via variavel de ambiente

### Entry Point (backend/src/index.ts)

```ts
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { pool } from './db';
import { registerRoutes } from './routes';
import { runMigrations } from './migrations/runner';

const app = Fastify({ logger: true });

async function start() {
  await runMigrations(pool);              // Roda migrations pendentes
  await app.register(cors, { origin: '*' });
  await registerRoutes(app);
  const port = Number(process.env.PORT) || 3000;
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Servidor rodando na porta ${port}`);
}

start();
```

- Porta: `process.env.PORT || 3000`
- CORS: qualquer origem
- Migrations rodam automaticamente no startup

### Rotas da API (backend/src/routes.ts)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/health` | Retorna `{ status: "ok", timestamp }` — verifica se backend esta no ar |
| GET | `/health/db` | Executa `SELECT 1` no PostgreSQL — verifica conexao com o banco |
| GET | `/api/items` | Lista todos os itens ordenados por data (DESC) |
| POST | `/api/items` | Cria item — body: `{ nome: string }`, retorna 201 |

**Detalhes das rotas de health:**

- `GET /health` — nao depende do banco, apenas confirma que o servidor Fastify esta respondendo
- `GET /health/db` — tenta executar `SELECT 1` no PostgreSQL. Retorna 200 se conectou, 500 com mensagem de erro se falhou

### Sistema de Migrations (backend/src/migrations/)

O projeto usa um sistema de migrations versionado:

**runner.ts** — Engine de migrations:
- Cria tabela `migrations` (version, name, applied_at) se nao existir
- Verifica quais versoes ja foram aplicadas
- Aplica apenas as pendentes, em ordem de versao
- Cada migration roda dentro de uma transacao (ROLLBACK em caso de erro)

**index.ts** — Registro das migrations:
```ts
export const migrations: Migration[] = [
  migration_001,
  // Adicionar novas migrations aqui
];
```

**001_create_items.ts** — Cria a tabela items:
```sql
CREATE TABLE IF NOT EXISTS items (
  id        SERIAL PRIMARY KEY,
  nome      TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);
```

**Para criar nova migration:**
1. Criar arquivo `backend/src/migrations/002_nome.ts`
2. Exportar objeto com `{ version: 2, name: 'nome', up: async (pool) => { ... } }`
3. Importar e adicionar ao array em `index.ts`

### Scripts (backend/package.json)

```json
{
  "dev": "ts-node-dev --respawn src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

### Dockerfile (backend)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### tsconfig.json (backend)

- target: ES2020
- module: commonjs
- outDir: ./dist
- rootDir: ./src
- strict: true
- esModuleInterop: true

---

## Frontend

### Tecnologias

- React 18
- Vite 5
- TypeScript

### Funcoes de API (frontend/src/api.ts)

```ts
const BASE_URL = import.meta.env.VITE_API_URL || '';
```

| Funcao | Metodo | Endpoint | Retorno |
|--------|--------|----------|---------|
| `checkBackend()` | GET | `/health` | `boolean` — true se backend responde 200 |
| `checkDatabase()` | GET | `/health/db` | `boolean` — true se banco responde 200 |
| `getItems()` | GET | `/api/items` | Array de items |
| `createItem(nome)` | POST | `/api/items` | Item criado |

- `VITE_API_URL` vazia em dev (proxy do Vite resolve)
- `VITE_API_URL` com URL publica do backend em producao
- **IMPORTANTE:** `VITE_API_URL` e lida no build time, nao em runtime. Mudar a variavel exige rebuild.

### Tela Principal (frontend/src/App.tsx)

A tela exibe um **checklist de status** que verifica sequencialmente:

1. **Aplicacao Frontend** — marca OK imediatamente (se renderizou, funciona)
2. **Conexao com o Backend** — chama `GET /health`
3. **Conexao com o Banco de Dados** — chama `GET /health/db`

Cada item mostra:
- `⏳ verificando...` enquanto testa
- `✅ OK` se passou
- `❌ Falhou` se falhou

**Logica:** se o backend falhar, o check do banco nem executa (ja marca como falha). O formulario e a lista de itens so aparecem quando os 3 checks passam.

Apos os checks, exibe:
- Formulario com campo `nome` + botao "Adicionar"
- Lista de itens do banco

### Proxy em Dev (frontend/vite.config.ts)

```ts
server: {
  proxy: {
    '/api': 'http://localhost:3000',
    '/health': 'http://localhost:3000',
  },
}
```

O proxy do `/health` cobre tambem `/health/db` (match por prefixo).

### Scripts (frontend/package.json)

```json
{
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview"
}
```

---

## Variaveis de Ambiente

### Backend (.env local)

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | URL completa do PostgreSQL |
| `PORT` | Nao | Porta do servidor (default: 3000) |
| `NODE_ENV` | Nao | `development` ou `production` |

**Exemplo (.env local para desenvolvimento):**
```
DATABASE_URL=postgresql://postgres:SENHA@monorail.proxy.rlwy.net:16293/railway
PORT=3000
NODE_ENV=development
```

### Frontend

| Variavel | Onde definir | Descricao |
|----------|-------------|-----------|
| `VITE_API_URL` | Railway Variables | URL publica do backend (so em producao) |

Em dev: vazia (proxy do Vite resolve).
Em producao: `VITE_API_URL=https://url-do-backend.railway.app`

---

## Deploy no Railway

### Servicos necessarios

1. **PostgreSQL** — banco de dados
2. **Backend** — servico Node.js (usa Dockerfile)
3. **Frontend** — servico React/Vite

### Configuracao do Backend no Railway

**Variables:**
- `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (referencia automatica ao servico Postgres)
- `NODE_ENV` = `production`
- `PORT` = `3000`

**Settings > Networking:**
- Public Networking: gerar dominio publico
- Custom port: `3000` (deve bater com PORT e EXPOSE do Dockerfile)

**IMPORTANTE sobre portas:**
A porta do EXPOSE no Dockerfile, a variavel PORT, e o Custom Port no Networking devem ser a **mesma**. Se estiverem diferentes, o Railway roteia trafico para uma porta onde ninguem esta escutando, causando erro 502 Bad Gateway.

### Configuracao do Frontend no Railway

**Variables:**
- `VITE_API_URL` = `https://url-publica-do-backend.railway.app` (URL gerada no passo anterior)

### Erros Comuns

| Erro | Causa | Solucao |
|------|-------|---------|
| 502 Bad Gateway | Porta do app diferente da porta do Networking | Alinhar EXPOSE, PORT e Custom Port para o mesmo valor |
| `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` | `DATABASE_URL` vazia ou nao definida | Criar arquivo `.env` com DATABASE_URL valida (local) ou definir variavel no Railway |
| Frontend mostra "Conexao com o Backend ❌" | `VITE_API_URL` errada ou backend fora do ar | Verificar URL e se o backend responde em `/health` |
| Frontend mostra "Banco de Dados ❌" | Backend nao consegue conectar no PostgreSQL | Verificar `DATABASE_URL` no backend e se o Postgres esta online |

---

## Como Rodar Localmente

**Backend:**
```bash
cd backend
cp .env.example .env
# Preencher DATABASE_URL com URL publica do PostgreSQL (Railway ou local)
npm install
npm run dev
# Rodando em http://localhost:3000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Rodando em http://localhost:5173
```

**Teste rapido:**
- Abrir http://localhost:5173 — deve mostrar checklist com 3 items verdes
- Abrir http://localhost:3000/health — deve retornar JSON com status ok
- Abrir http://localhost:3000/health/db — deve retornar JSON com status ok
