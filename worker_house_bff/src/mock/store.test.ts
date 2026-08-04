import assert from 'node:assert/strict';
import test from 'node:test';
import { mockStore } from './store.js';

test('removes a user\'s posts, comments and tracked image references together', () => {
  const authorId = 'openid-mock-account-delete';
  const authoredPost = mockStore.createPost({
    authorId,
    authorNickname: '待注销用户',
    content: '这条帖子需要删除',
    images: ['https://example.test/user-image.jpg'],
    imageFileIds: ['cloud://env/user-image.jpg'],
  });
  const otherPost = mockStore.createPost({
    authorId: 'openid-other-user',
    authorNickname: '其他用户',
    content: '这条帖子需要保留',
  });
  mockStore.commentPost(authoredPost.id, {
    authorId: 'openid-other-user',
    authorNickname: '其他用户',
    content: '随父帖删除的评论',
    isAnonymous: false,
  });
  mockStore.commentPost(otherPost.id, {
    authorId,
    authorNickname: '待注销用户',
    content: '单独删除的评论',
    isAnonymous: false,
  });

  const result = mockStore.deleteAccountData(authorId);
  assert.equal(result.postsDeleted, 1);
  assert.equal(result.commentsDeleted, 2);
  assert.deepEqual(result.imageFileIds, ['cloud://env/user-image.jpg']);
  assert.equal(mockStore.getPost(authoredPost.id), null);
  assert.equal(mockStore.getPostComments(authoredPost.id).length, 0);
  assert.equal(mockStore.getPostComments(otherPost.id).length, 0);
  assert.equal(mockStore.getPost(otherPost.id)?.commentsCount, 0);
});
