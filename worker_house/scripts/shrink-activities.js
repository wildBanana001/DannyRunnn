const fs = require('fs');
const path = require('path');
const file = path.resolve(__dirname, '../src/data/activities.ts');
let content = fs.readFileSync(file, 'utf-8');

// Find the index of act-003 and truncate there
const act3Index = content.indexOf("id: 'act-003'");
if (act3Index !== -1) {
  // Find the start of buildActivity({ before act-003
  const buildIndex = content.lastIndexOf('buildActivity({', act3Index);
  if (buildIndex !== -1) {
    const endStr = `];

export const featuredActivity: Activity = ongoingActivities[0];
export const upcomingActivities: Activity[] = ongoingActivities;
export const allActivities: Activity[] = ongoingActivities;

export const hostInfo: Host = {
  id: sharedHostId,
  name: sharedHostName,
  avatar: sharedHostAvatar,
  description: '把客厅变成新新人类社交方式试验场的主理人。',
  background:
    '橙子从互联网大厂裸辞后，徒手爆改了这间 80m² 的社畜快乐屋。她相信人和人的真实链接不该被年龄、职业和关系标签限定，所以把 fun、共创、女性友好借宿和去标签化社交都做进了这间客厅里。',
  activitiesCount: 52,
  followersCount: 1314
};

export const venueInfo: Venue = {
  id: 'venue-shenzhen-worker-house',
  name: sharedVenueName,
  description: '位于深圳南山大新站 D 口附近的 80m² 共居客厅，白天像住家，晚上像会发光的社交试验场。',
  images: [
    wechatArticleImageUrls.img29,
    wechatArticleImageUrls.img30,
    wechatArticleImageUrls.img17,
    wechatArticleImageUrls.img34
  ],
  address: sharedAddress,
  facilities: ['沙发客厅', '投影幕布', '手作长桌', '留言墙', '女性友好留宿空间', '喵星人陪伴']
};
`;
    content = content.substring(0, buildIndex) + endStr;
    fs.writeFileSync(file, content, 'utf-8');
    console.log('Shrinked activities.ts');
  }
}
