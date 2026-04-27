export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
};

export const validateNickname = (nickname: string): boolean => {
  return nickname.length >= 2 && nickname.length <= 20;
};

export const validateWechatId = (wechatId: string): boolean => {
  const wechatRegex = /^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/;
  return wechatRegex.test(wechatId);
};

export const getPhoneError = (phone: string): string => {
  if (!phone) return '请输入手机号';
  if (!validatePhone(phone)) return '请输入正确的手机号';
  return '';
};

export const getNicknameError = (nickname: string): string => {
  if (!nickname) return '请输入昵称';
  if (nickname.length < 2) return '昵称至少需要2个字符';
  if (nickname.length > 20) return '昵称最多20个字符';
  return '';
};

export const getWechatIdError = (wechatId: string): string => {
  if (!wechatId) return '请输入微信号';
  if (!validateWechatId(wechatId)) return '请输入正确的微信号（6-20位，字母开头）';
  return '';
};
