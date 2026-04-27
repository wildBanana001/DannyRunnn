import React from 'react';
import { Image } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';

interface DoodleProps {
  className?: string;
}

const doodleCircle = require('@/assets/home/doodle-circle.svg');
const doodleArrow = require('@/assets/home/doodle-arrow.svg');
const doodleStar = require('@/assets/home/doodle-star.svg');

const DoodleAsset: React.FC<DoodleProps & { src: string }> = ({ className, src }) => (
  <Image className={classnames(styles.asset, className)} src={src} mode="aspectFit" />
);

export const DoodleCircle: React.FC<DoodleProps> = ({ className }) => <DoodleAsset className={className} src={doodleCircle} />;
export const DoodleArrow: React.FC<DoodleProps> = ({ className }) => <DoodleAsset className={className} src={doodleArrow} />;
export const DoodleStar: React.FC<DoodleProps> = ({ className }) => <DoodleAsset className={className} src={doodleStar} />;
