import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import documentsRouter from './routes/documents.js';
import notebooksRouter from './routes/notebooks.js';
import queryRouter from './routes/query.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/documents', documentsRouter);
app.use('/notebooks', notebooksRouter);
app.use('/query', queryRouter);

app.listen(config.port, () => {
  console.log(`docent-api listening on http://localhost:${config.port}`);
});