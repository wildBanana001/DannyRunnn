import { Router } from 'express';
import { listCardPackages } from '../data/cardPackages.js';
export const cardPackageRouter = Router();
cardPackageRouter.get('/', (_request, response) => {
    const list = listCardPackages();
    response.json({ data: list, list, total: list.length });
});
