import { FastifyInstance } from 'fastify';
import { pool } from './db';

export async function registerRoutes(app: FastifyInstance) {
  // Health básico — backend no ar
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date() };
  });

  // Health do banco — testa conexão real com o PostgreSQL
  app.get('/health/db', async (_request, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ok', timestamp: new Date() };
    } catch (error) {
      return reply.status(500).send({
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  });

  // Health de migrations — lista versões aplicadas
  app.get('/health/migrations', async (_request, reply) => {
    try {
      const result = await pool.query('SELECT version, name, applied_at FROM migrations ORDER BY version');
      return { status: 'ok', migrations: result.rows };
    } catch (error) {
      return reply.status(500).send({
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  });

  // Health de select — confirma que a tabela items existe e é consultável
  app.get('/health/select', async (_request, reply) => {
    try {
      const result = await pool.query('SELECT COUNT(*) AS total FROM items');
      return { status: 'ok', total: Number(result.rows[0].total) };
    } catch (error) {
      return reply.status(500).send({
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  });

  app.get('/api/items', async () => {
    const result = await pool.query('SELECT * FROM items ORDER BY criado_em DESC');
    return result.rows;
  });

  app.post('/api/items', async (request, reply) => {
    const { nome } = request.body as { nome: string };
    const result = await pool.query(
      'INSERT INTO items (nome) VALUES ($1) RETURNING *',
      [nome]
    );
    return reply.status(201).send(result.rows[0]);
  });
}
