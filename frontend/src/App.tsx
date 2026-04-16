import { useEffect, useState } from 'react';
import { getItems, createItem, checkBackend, checkDatabase, checkMigrations, checkSelect } from './api';

interface Item {
  id: number;
  nome: string;
  criado_em: string;
}

type CheckStatus = 'pending' | 'ok' | 'error';

interface HealthChecks {
  frontend: CheckStatus;
  backend: CheckStatus;
  database: CheckStatus;
  migrations: CheckStatus;
  select: CheckStatus;
}

interface MigrationsInfo {
  versions: number[];
}

interface SelectInfo {
  total: number;
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pending') return <span style={{ color: '#999' }}>⏳ verificando...</span>;
  if (status === 'ok') return <span style={{ color: '#22c55e' }}>✅ OK</span>;
  return <span style={{ color: '#ef4444' }}>❌ Falhou</span>;
}

function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<HealthChecks>({
    frontend: 'pending',
    backend: 'pending',
    database: 'pending',
    migrations: 'pending',
    select: 'pending',
  });
  const [migrationsInfo, setMigrationsInfo] = useState<MigrationsInfo>({ versions: [] });
  const [selectInfo, setSelectInfo] = useState<SelectInfo>({ total: 0 });

  useEffect(() => {
    runHealthChecks();
  }, []);

  async function runHealthChecks() {
    // 1. Frontend — se chegou aqui, já está ok
    setChecks(prev => ({ ...prev, frontend: 'ok' }));

    // 2. Backend — chama /health
    const backendOk = await checkBackend();
    setChecks(prev => ({ ...prev, backend: backendOk ? 'ok' : 'error' }));

    if (!backendOk) {
      setChecks(prev => ({ ...prev, database: 'error' }));
      setLoading(false);
      return;
    }

    // 3. Banco de dados — chama /health/db
    const dbOk = await checkDatabase();
    setChecks(prev => ({ ...prev, database: dbOk ? 'ok' : 'error' }));

    if (!dbOk) {
      setChecks(prev => ({ ...prev, migrations: 'error', select: 'error' }));
      setLoading(false);
      return;
    }

    // 4. Migrations — verifica versões aplicadas
    const migrationsResult = await checkMigrations();
    setChecks(prev => ({ ...prev, migrations: migrationsResult.ok ? 'ok' : 'error' }));
    setMigrationsInfo({ versions: migrationsResult.versions });

    // 5. SELECT na tabela items
    const selectResult = await checkSelect();
    setChecks(prev => ({ ...prev, select: selectResult.ok ? 'ok' : 'error' }));
    setSelectInfo({ total: selectResult.total });

    if (selectResult.ok) {
      await fetchItems();
    } else {
      setLoading(false);
    }
  }

  async function fetchItems() {
    setLoading(true);
    try {
      const data = await getItems();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    await createItem(nome);
    setNome('');
    await fetchItems();
  }

  const allOk = checks.frontend === 'ok' && checks.backend === 'ok' && checks.database === 'ok' && checks.migrations === 'ok' && checks.select === 'ok';

  return (
    <div style={{ maxWidth: 600, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>CURSO IA SÃO LOURENÇO</h1>

      {/* Checklist de status */}
      <div style={{
        background: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: 8,
        padding: '1rem 1.5rem',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>Status do Sistema</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <li style={{ padding: '0.3rem 0' }}>
            Aplicação Frontend — <StatusIcon status={checks.frontend} />
          </li>
          <li style={{ padding: '0.3rem 0' }}>
            Conexão com o Backend — <StatusIcon status={checks.backend} />
          </li>
          <li style={{ padding: '0.3rem 0' }}>
            Conexão com o Banco de Dados — <StatusIcon status={checks.database} />
          </li>
          <li style={{ padding: '0.3rem 0' }}>
            Migrations aplicadas —{' '}
            <StatusIcon status={checks.migrations} />
            {checks.migrations === 'ok' && (
              <span style={{ color: '#666', fontSize: '0.85rem', marginLeft: 6 }}>
                (v{migrationsInfo.versions.join(', v')})
              </span>
            )}
          </li>
          <li style={{ padding: '0.3rem 0' }}>
            SELECT na tabela items —{' '}
            <StatusIcon status={checks.select} />
            {checks.select === 'ok' && (
              <span style={{ color: '#666', fontSize: '0.85rem', marginLeft: 6 }}>
                ({selectInfo.total} registro{selectInfo.total !== 1 ? 's' : ''})
              </span>
            )}
          </li>
        </ul>
      </div>

      {/* Conteúdo principal — só mostra se tudo ok */}
      {allOk && (
        <>
          <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do item"
              style={{ padding: '0.5rem', marginRight: '0.5rem', fontSize: '1rem' }}
            />
            <button type="submit" style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>
              Adicionar
            </button>
          </form>

          {loading ? (
            <p>Carregando...</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>{item.nome}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default App;
