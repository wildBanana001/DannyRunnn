import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StoryRecord } from '../types/index.js';

interface StoryStoreState {
  stories: StoryRecord[];
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const storageFilePath = path.join(currentDir, 'stories.store.json');

const storyStore: StoryStoreState = {
  stories: [],
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function now() {
  return new Date().toISOString();
}

function sanitizeString(value: unknown, fallback: string = ''): string {
  if (value === undefined || value === null) return fallback;
  return typeof value === 'string' ? value.trim() : fallback;
}

function createStoryId() {
  return `story-${randomUUID().slice(0, 8)}`;
}

function sortStories(list: StoryRecord[]) {
  return [...list].sort((first, second) => new Date(second.publishAt).getTime() - new Date(first.publishAt).getTime());
}

function normalizeStoryRecord(record: Partial<StoryRecord>, current?: StoryRecord): StoryRecord {
  return {
    id: sanitizeString(record.id, current?.id) || createStoryId(),
    title: sanitizeString(record.title, current?.title) || '未命名故事',
    cover: sanitizeString(record.cover, current?.cover),
    excerpt: sanitizeString(record.excerpt, current?.excerpt),
    content: sanitizeString(record.content, current?.content),
    publishAt: sanitizeString(record.publishAt, current?.publishAt) || now(),
    author: sanitizeString(record.author, current?.author),
    sourceUrl: sanitizeString(record.sourceUrl, current?.sourceUrl),
  };
}

function persistStories() {
  mkdirSync(path.dirname(storageFilePath), { recursive: true });
  writeFileSync(storageFilePath, JSON.stringify(storyStore.stories, null, 2), 'utf-8');
}

function loadStories() {
  if (storyStore.stories.length > 0) {
    return;
  }

  if (!existsSync(storageFilePath)) {
    storyStore.stories = [];
    persistStories();
    return;
  }

  try {
    const rawContent = readFileSync(storageFilePath, 'utf-8');
    const parsed = JSON.parse(rawContent) as StoryRecord[];
    storyStore.stories = Array.isArray(parsed) ? sortStories(parsed.map((item) => normalizeStoryRecord(item))) : [];
  } catch {
    storyStore.stories = [];
    persistStories();
  }
}

loadStories();

export function listStories() {
  loadStories();
  return clone(storyStore.stories);
}

export function getStoryById(storyId: string) {
  loadStories();
  const record = storyStore.stories.find((item) => item.id === storyId) ?? null;
  return clone(record);
}

export function upsertStory(storyId: string | undefined, input: Partial<StoryRecord>) {
  loadStories();
  const current = storyId ? storyStore.stories.find((item) => item.id === storyId) : undefined;
  const nextRecord = normalizeStoryRecord(input, current);

  storyStore.stories = current
    ? storyStore.stories.map((item) => (item.id === current.id ? nextRecord : item))
    : sortStories([nextRecord, ...storyStore.stories]);

  persistStories();
  return clone(nextRecord);
}

export function deleteStory(storyId: string) {
  loadStories();
  const existed = storyStore.stories.some((item) => item.id === storyId);
  if (!existed) {
    return false;
  }

  storyStore.stories = storyStore.stories.filter((item) => item.id !== storyId);
  persistStories();
  return true;
}
