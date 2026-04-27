export const THEME_COLORS = {
  backgroundPrimary: '#F7F6F2',
  backgroundSecondary: '#FFFFFF',
  textPrimary: '#3E2C1C',
  textSecondary: '#8B7355',
  accent: '#E60000',
  accentSecondary: '#FFE600',
  earthGreen: '#5E8B73',
  sunshine: '#F4C430',
  noteYellow: '#FFE66D',
  notePink: '#FFADAD',
  noteBlue: '#A0E7E5',
  noteGreen: '#B4E197',
  noteOrange: '#FFB84D',
  notePurple: '#C8A8E9',
  border: '#E8DFC9',
  overlay: 'rgba(62, 44, 28, 0.28)',
  shadow: 'rgba(62, 44, 28, 0.08)'
} as const;

export const NOTE_COLOR_MAP = {
  yellow: THEME_COLORS.noteYellow,
  pink: THEME_COLORS.notePink,
  blue: THEME_COLORS.noteBlue,
  green: THEME_COLORS.noteGreen,
  orange: THEME_COLORS.noteOrange,
  purple: THEME_COLORS.notePurple
} as const;

export const THEME_RADIUS = {
  card: '20rpx',
  cardLarge: '24rpx',
  chip: '999rpx',
  avatar: '50%'
} as const;

export const THEME_SHADOW = {
  card: '0 4px 12px rgba(62, 44, 28, 0.08)'
} as const;
