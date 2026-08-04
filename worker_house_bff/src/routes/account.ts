import { Router } from 'express';
import { wxCloudrunAuth } from '../middlewares/wx-cloudrun-auth.js';
import {
  ACCOUNT_DELETION_CONFIRMATION,
  AccountDeletionBlockedError,
  deleteAccountData,
  getAccountDeletionPreview,
} from '../services/account-deletion.js';
import { requireWxOpenid } from './utils.js';

export const accountRouter = Router();

accountRouter.get('/deletion-preview', wxCloudrunAuth, async (request, response) => {
  const openid = requireWxOpenid(request, response);
  if (!openid) return;

  try {
    response.json(await getAccountDeletionPreview(openid));
  } catch (error) {
    console.error('[account deletion] preview failed', error instanceof Error ? error.message : error);
    response.status(500).json({
      code: 'ACCOUNT_DELETION_PREVIEW_FAILED',
      message: '暂时无法检查账号状态，请稍后重试',
    });
  }
});

accountRouter.delete('/', wxCloudrunAuth, async (request, response) => {
  const openid = requireWxOpenid(request, response);
  if (!openid) return;

  const confirmation = typeof request.body?.confirmation === 'string'
    ? request.body.confirmation.trim()
    : '';
  if (confirmation !== ACCOUNT_DELETION_CONFIRMATION) {
    response.status(400).json({
      code: 'ACCOUNT_DELETION_CONFIRMATION_REQUIRED',
      message: `请输入“${ACCOUNT_DELETION_CONFIRMATION}”确认注销`,
    });
    return;
  }

  try {
    response.json(await deleteAccountData(openid));
  } catch (error) {
    if (error instanceof AccountDeletionBlockedError) {
      response.status(409).json({
        code: error.code,
        message: error.message,
        preview: error.preview,
      });
      return;
    }

    console.error('[account deletion] delete failed', error instanceof Error ? error.message : error);
    response.status(500).json({
      code: 'ACCOUNT_DELETION_FAILED',
      message: '账号注销未完成，账号仍可正常使用，请稍后重试',
    });
  }
});
