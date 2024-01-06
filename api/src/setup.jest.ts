import 'ts-node/register';

import { execSync } from 'child_process';
import { createClient } from 'edgedb';

const EDGEDB_DATABASE_ENV = 'EDGEDB_DATABASE';

export default async () => {
  const database = 'tests';
  const client = createClient();

  try {
    await client.query(`create database ${database}`);
  } catch (e) {
    if (!(e as Error).message?.includes('already exists')) throw e;
  } finally {
    await client.close();
  }

  process.env[EDGEDB_DATABASE_ENV] = database;

  execSync(`edgedb migrate --dev-mode && yarn db:seed`, { env: process.env });
};
