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
  {
    id: '0004_work_tracking',
    name: 'work tracking for chat sessions',
    up: [
      'create table if not exists work (',
      '  id text primary key,',
      '  created_at text not null default (datetime(current_timestamp)),',
      '  ended_at text,',
      '  description text not null,',
      '  category text not null default "general",',
      '  session_id text',
      ');',
      'create index if not exists idx_work_session_id on work(session_id);',
      'create index if not exists idx_work_category on work(category);',
      'create index if not exists idx_work_created_at on work(created_at);',
    ].join('\n'),
  },
];
