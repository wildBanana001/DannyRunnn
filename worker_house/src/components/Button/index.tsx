import React from 'react';
import { Button as TaroButton, Text } from '@tarojs/components';
import classnames from 'classnames';
import { usePressFeedback } from '@/hooks/usePressFeedback';
import styles from './index.module.scss';

interface ButtonProps {
  children: React.ReactNode;
  type?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
  className?: string;
  onClick?: () => void;
}

const Button: React.FC<ButtonProps> = ({
  children,
  type = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  block = false,
  className,
  onClick
}) => {
  const isInactive = disabled || loading;
  const { bind } = usePressFeedback({ disabled: isInactive });

  return (
    <TaroButton
      {...bind()}
      className={classnames(
        styles.button,
        styles[type],
        styles[size],
        block && styles.block,
        isInactive && styles.disabled,
        className
      )}
      disabled={isInactive}
      onClick={onClick}
    >
      {loading ? <Text className={styles.loading}>加载中...</Text> : children}
    </TaroButton>
  );
};

export default Button;
