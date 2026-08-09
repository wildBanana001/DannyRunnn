import type { Activity } from '@/types';
import dinnerTableMenu from './assets/dinner-table/menu.jpg';
import dinnerTableFood1 from './assets/dinner-table/food-1.jpg';
import dinnerTableFood2 from './assets/dinner-table/food-2.jpg';
import dinnerTableFood3 from './assets/dinner-table/food-3.jpg';
import dinnerTableFood4 from './assets/dinner-table/food-4.jpg';

const dinnerTableGallery = [
  dinnerTableMenu,
  dinnerTableFood1,
  dinnerTableFood2,
  dinnerTableFood3,
  dinnerTableFood4,
];

export const withLocalActivityDetailAssets = (activity: Activity): Activity => {
  if (activity.id !== 'act-002') {
    return activity;
  }

  const coverImage = activity.cover || activity.coverImage;
  return {
    ...activity,
    coverImage,
    cover: coverImage,
    gallery: dinnerTableGallery,
    covers: [coverImage, ...dinnerTableGallery],
  };
};
