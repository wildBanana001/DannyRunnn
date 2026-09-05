import type { RequestHandler } from 'express';

export const rejectCardPurchase: RequestHandler = (_request, response) => {
  response.status(503).json({
    code: 'CARD_PURCHASE_UNAVAILABLE',
    message: '次卡购买暂未开放',
  });
};
