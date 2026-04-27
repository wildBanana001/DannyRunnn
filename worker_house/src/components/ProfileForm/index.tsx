import React from 'react';
import { Input, Text, Textarea, View } from '@tarojs/components';
import classNames from 'classnames';
import Button from '@/components/Button';
import type { ProfileFormValue, ProfileGender } from '@/types';
import { parseProfileTags } from '@/utils/profile';
import styles from './index.module.scss';

interface ProfileFormProps {
  value: ProfileFormValue;
  onChange: (patch: Partial<ProfileFormValue>) => void;
  title?: string;
  description?: string;
  submitText?: string;
  secondaryActionText?: string;
  cancelText?: string;
  onSubmit?: () => void;
  onSecondaryAction?: () => void;
  onCancel?: () => void;
  className?: string;
}

const genderOptions: Array<{ label: string; value: ProfileGender }> = [
  { label: '男🙋‍♂️', value: 'male' },
  { label: '女🙋‍♀️', value: 'female' },
  { label: '其他 / 不方便说明', value: 'other' },
];

const ProfileForm: React.FC<ProfileFormProps> = ({
  value,
  onChange,
  title = '社畜档案',
  description,
  submitText = '保存',
  secondaryActionText,
  cancelText,
  onSubmit,
  onSecondaryAction,
  onCancel,
  className,
}) => {
  return (
    <View className={classNames(styles.form, className)}>
      <View className={styles.header}>
        <Text className={styles.title}>{title}</Text>
        {description ? <Text className={styles.description}>{description}</Text> : null}
      </View>

      <View className={styles.fields}>
        <View className={styles.fieldCard}>
          <Text className={styles.label}>1 希望大家如何称呼你</Text>
          <Input
            className={styles.input}
            value={value.nickname}
            placeholder="比如：橙子 / 香蕉"
            onInput={(event) => onChange({ nickname: event.detail.value })}
          />
        </View>

        <View className={styles.fieldCard}>
          <Text className={styles.label}>2 微信名</Text>
          <Input
            className={styles.input}
            value={value.wechatName}
            placeholder="方便活动前后联系你"
            onInput={(event) => onChange({ wechatName: event.detail.value })}
          />
        </View>

        <View className={styles.fieldCard}>
          <Text className={styles.label}>3 联系电话（选填）</Text>
          <Input
            className={styles.input}
            value={value.phone || ''}
            placeholder="临时变更时方便联系"
            onInput={(event) => onChange({ phone: event.detail.value })}
          />
        </View>

        <View className={styles.fieldCard}>
          <Text className={styles.label}>4 性别</Text>
          <View className={styles.tagGroup}>
            {genderOptions.map((option) => (
              <View
                key={option.value}
                className={classNames(styles.tag, value.gender === option.value && styles.tagActive)}
                onClick={() => onChange({ gender: option.value })}
              >
                <Text className={classNames(styles.tagText, value.gender === option.value && styles.tagTextActive)}>{option.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className={styles.fieldCard}>
          <Text className={styles.label}>5 年龄段</Text>
          <Input
            className={styles.input}
            value={value.ageRange}
            placeholder="比如：95 后 / 90 后 / 30+"
            onInput={(event) => onChange({ ageRange: event.detail.value })}
          />
        </View>

        <View className={styles.fieldCard}>
          <Text className={styles.label}>6 所在行业</Text>
          <Input
            className={styles.input}
            value={value.industry}
            placeholder="比如：互联网产品 / 品牌策划 / 教育"
            onInput={(event) => onChange({ industry: event.detail.value })}
          />
        </View>

        <View className={styles.fieldCard}>
          <Text className={styles.label}>7 你的职业 / 身份</Text>
          <Input
            className={styles.input}
            value={value.occupation}
            placeholder="比如：产品经理 / 摄影师 / 自由职业"
            onInput={(event) => onChange({ occupation: event.detail.value })}
          />
        </View>

        <View className={styles.fieldCard}>
          <Text className={styles.label}>8 常驻城市</Text>
          <Input
            className={styles.input}
            value={value.city}
            placeholder="比如：上海 / 北京 / 杭州"
            onInput={(event) => onChange({ city: event.detail.value })}
          />
        </View>

        <View className={styles.fieldCard}>
          <Text className={styles.label}>9 你想在这里遇见什么样的人或关系</Text>
          <Text className={styles.tip}>可以写你的社交目标、当前状态，或者想尝试的线下陪伴方式。</Text>
          <Textarea
            className={styles.textarea}
            value={value.socialGoal}
            maxlength={300}
            placeholder="比如：想认识也愿意认真生活的人，一起做点手作、散步、吃饭。"
            onInput={(event) => onChange({ socialGoal: event.detail.value })}
          />
        </View>

        <View className={styles.fieldCard}>
          <Text className={styles.label}>10 请介绍一下自己</Text>
          <Text className={styles.tip}>写写你的生活节奏、喜欢的活动，或者近期在意的事。</Text>
          <Textarea
            className={styles.textarea}
            value={value.introduction}
            maxlength={500}
            placeholder="可以聊聊你最近的生活状态、喜欢的活动、想在这里遇见什么样的人。"
            onInput={(event) => onChange({ introduction: event.detail.value })}
          />
        </View>

        <View className={styles.fieldCard}>
          <Text className={styles.label}>11 给自己贴几个标签</Text>
          <Text className={styles.tip}>多个标签用中文逗号、英文逗号或顿号隔开。</Text>
          <Input
            className={styles.input}
            value={(value.tags || []).join('，')}
            placeholder="比如：手作，散步，电影，城市观察"
            onInput={(event) => onChange({ tags: parseProfileTags(event.detail.value) })}
          />
        </View>
      </View>

      {(onCancel || onSecondaryAction || onSubmit) ? (
        <View className={styles.footer}>
          {cancelText && onCancel ? (
            <Button type="ghost" size="medium" className={styles.ghostButton} onClick={onCancel}>
              {cancelText}
            </Button>
          ) : null}
          {secondaryActionText && onSecondaryAction ? (
            <Button type="outline" size="medium" className={styles.secondaryButton} onClick={onSecondaryAction}>
              {secondaryActionText}
            </Button>
          ) : null}
          {onSubmit ? (
            <Button type="primary" size="large" block onClick={onSubmit}>
              {submitText}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

export default ProfileForm;
