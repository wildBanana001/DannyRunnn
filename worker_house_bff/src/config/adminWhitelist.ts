function parseAdminWhitelist(value?: string) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const adminOpenidWhitelist = parseAdminWhitelist(process.env.ADMIN_OPENID_WHITELIST);

export function isOpenidAdmin(openid: string) {
  const normalizedOpenid = openid.trim();
  if (!normalizedOpenid) {
    return false;
  }

  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  return adminOpenidWhitelist.includes(normalizedOpenid);
}
