import { Router } from 'express';
import { openidAdminAuth } from '../middleware/openidAdminAuth.js';
import { deleteStory, getStoryById, listStories, upsertStory } from '../data/stories.js';
import { paginate, parsePage } from './utils.js';
function normalizeStoryRecord(record) {
    return {
        ...record,
        author: record.author || undefined,
        content: record.content || '',
        sourceUrl: record.sourceUrl || undefined,
    };
}
export const storiesRouter = Router();
export const adminMiniStoriesRouter = Router();
storiesRouter.get('/', (request, response) => {
    const limit = parsePage(request.query.limit, 0);
    const list = listStories().map((item) => normalizeStoryRecord(item));
    response.json({
        list: limit > 0 ? list.slice(0, limit) : list,
        total: list.length,
    });
});
storiesRouter.get('/:id', (request, response) => {
    const story = getStoryById(String(request.params.id));
    if (!story) {
        response.status(404).json({ message: '故事不存在' });
        return;
    }
    response.json(normalizeStoryRecord(story));
});
adminMiniStoriesRouter.use(openidAdminAuth);
adminMiniStoriesRouter.get('/', (request, response) => {
    const page = parsePage(request.query.page, 1);
    const pageSize = Math.min(parsePage(request.query.pageSize, 50), 200);
    const keyword = typeof request.query.keyword === 'string' ? request.query.keyword.trim().toLowerCase() : '';
    let records = listStories();
    if (keyword) {
        records = records.filter((item) => `${item.title} ${item.excerpt} ${item.author || ''}`.toLowerCase().includes(keyword));
    }
    response.json({
        ...paginate(records.map((item) => normalizeStoryRecord(item)), page, pageSize),
        page,
        pageSize,
    });
});
adminMiniStoriesRouter.post('/', (request, response) => {
    const record = upsertStory(undefined, request.body);
    response.json(normalizeStoryRecord(record));
});
adminMiniStoriesRouter.put('/:id', (request, response) => {
    const existing = getStoryById(String(request.params.id));
    if (!existing) {
        response.status(404).json({ message: '故事不存在' });
        return;
    }
    const record = upsertStory(existing.id, request.body);
    response.json(normalizeStoryRecord(record));
});
adminMiniStoriesRouter.delete('/:id', (request, response) => {
    const deleted = deleteStory(String(request.params.id));
    if (!deleted) {
        response.status(404).json({ message: '故事不存在' });
        return;
    }
    response.json({ success: true });
});
