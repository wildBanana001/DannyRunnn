const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const readSource = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('unfinished member card capability is fail-closed in the mini-program', () => {
  const capabilities = readSource('src/constants/capabilities.ts');
  const memberService = readSource('src/services/member.ts');
  const cardsPage = readSource('src/pages/my-cards/index.tsx');
  const minePage = readSource('src/pages/mine/index.tsx');

  assert.match(capabilities, /MEMBER_CARD_ENABLED\s*=\s*false/);
  assert.match(memberService, /throw new Error\('次卡购买暂未开放'\)/);
  assert.match(memberService, /if \(payload\.useCard\)[\s\S]*次卡抵扣暂未开放/);
  assert.doesNotMatch(cardsPage, /purchaseCardOrder|立即购买|购买成功，次卡已到账/);
  assert.match(cardsPage, /次卡暂未开放/);
  assert.match(minePage, /item\.key === 'cards' && !MEMBER_CARD_ENABLED/);
});

test('optional profile and card data cannot block activity registration', () => {
  const registerPage = readSource('src/pages/register/index.tsx');
  const clientRequestId = 'activity-mtk6zpgn-b6tf1y8n';
  const transientProfileId = `registration-profile-${clientRequestId}`;

  assert.match(registerPage, /void refreshMemberData\(\)\.catch/);
  assert.match(registerPage, /MEMBER_CARD_ENABLED \? fetchCurrentCardOrder\(\) : Promise\.resolve\(null\)/);
  assert.match(registerPage, /continueWithTransientProfile/);
  assert.match(registerPage, /id: `registration-profile-\$\{clientRequestId\}`/);
  assert.match(registerPage, /当前填写只用于本次报名/);
  assert.doesNotMatch(registerPage, /if \(memberError\)/);
  assert.doesNotMatch(registerPage, /去「社畜次卡」页面买一张/);
  assert.match(clientRequestId, /^[A-Za-z0-9_-]{8,64}$/);
  assert.ok(transientProfileId.length <= 80);
});
