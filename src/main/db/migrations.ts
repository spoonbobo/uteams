import type { Migration } from './index';

// Minimal initial schema; extend as needed.
export const migrations: Migration[] = [
  {
    id: '0001_init',
    name: 'initialize base tables',
    up: [
      'create table if not exists settings (',
      '  key text primary key,',
      '  value text not null',
      ');',
    ].join('\n'),
  },
  {
    id: '0002_messages',
    name: 'messages for research/chat logs',
    up: [
      'create table if not exists messages (',
      '  id text primary key,',
      '  created_at text default (datetime(current_timestamp)),',
      '  chat_id text,',
      '  sender text,',
      '  text text,',
      '  is_read integer default 0',
      ');',
      'create index if not exists idx_messages_chat_id on messages(chat_id);',
    ].join('\n'),
  },
  {
    id: '0003_kv_store',
    name: 'generic key-value store',
    up: (db: any) => {
      db.exec(
        [
          'create table if not exists kv_store (',
          '  namespace text not null,',
          '  key text not null,',
          '  value text,',
          '  primary key (namespace, key)',
          ');',
          'create index if not exists idx_kv_store_ns on kv_store(namespace);',
        ].join('\n'),
      );
    },
  },
];
