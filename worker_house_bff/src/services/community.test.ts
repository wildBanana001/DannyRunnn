import assert from 'node:assert/strict';
import test from 'node:test';
import {
  commentCommunityPost,
  createCommunityPost,
  deleteCommunityPost,
  getCommunityPostDetail,
  likeCommunityPost,
  pinCommunityPost,
} from './community.js';

test('runs the complete mock post lifecycle through the BFF community service', async () => {
  const authorId = `community-service-${Date.now()}`;
  const post = await createCommunityPost({
    authorId,
    authorNickname: '测试用户',
    content: '由 BFF 直接管理的帖子',
    imageFileIds: ['cloud://mock/post.jpg'],
    images: ['https://example.test/post.jpg'],
    tags: ['直连测试'],
  });
  assert.ok(post);
  assert.equal(post.authorId, authorId);
  assert.equal(post.commentsCount, 0);

  const comment = await commentCommunityPost(post.id, {
    authorId,
    authorNickname: '测试用户',
    content: '由 BFF 直接写入的评论',
  });
  assert.ok(comment);

  const detail = await getCommunityPostDetail(post.id);
  assert.equal(detail?.comments.length, 1);
  assert.equal(detail?.post.commentsCount, 1);

  const liked = await likeCommunityPost(post.id, 1);
  assert.equal(liked?.likes, 1);
  const pinned = await pinCommunityPost(post.id, true);
  assert.equal(pinned?.isPinned, true);

  assert.equal(await deleteCommunityPost(post.id), true);
  assert.equal(await getCommunityPostDetail(post.id), null);
});
