import React from 'react';
import { Text, View } from '@tarojs/components';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import type { Profile } from '@/types';
import { buildProfileMeta, formatProfileGender, formatProfileTags } from '@/utils/profile';
import styles from './index.module.scss';

interface ProfileSelectionPanelProps {
  profiles: Profile[];
  selectedProfileId: string;
  onCreate: () => void;
  onEdit: (profile: Profile) => void;
  onSelect: (profileId: string) => void;
}

interface ProfileSnapshotPanelProps {
  profile?: Profile;
  onEdit: () => void;
}

interface RegistrationSuccessModalProps {
  onClose: () => void;
  visible: boolean;
}

export const ProfileSelectionPanel: React.FC<ProfileSelectionPanelProps> = ({
  profiles,
  selectedProfileId,
  onCreate,
  onEdit,
  onSelect,
}) => {
  return (
    <View className={styles.stepSection}>
      <View className={styles.sectionHeader}>
        <Text className={styles.sectionTitle}>先挑一个档案吧</Text>
        <Text className={styles.sectionDesc}>默认档案会优先展示，你也可以先改一下，再去确认订单。</Text>
      </View>

      {profiles.length > 0 ? (
        <View className={styles.profileList}>
          {profiles.map((profile) => (
            <View
              key={profile.id}
              className={selectedProfileId === profile.id ? styles.profileCardActive : styles.profileCard}
              onClick={() => onSelect(profile.id)}
            >
              <View className={styles.profileRow}>
                <View>
                  <Text className={styles.profileName}>{profile.nickname || '还没起昵称'}</Text>
                  <Text className={styles.profileMeta}>{buildProfileMeta(profile)}</Text>
                </View>
                {profile.isDefault ? <Text className={styles.defaultBadge}>默认</Text> : null}
              </View>
              <Text className={styles.profileExcerpt}>{profile.socialGoal || profile.introduction || '这份档案还没有补充完整，可以先编辑一下再去报名。'}</Text>
              <Text className={styles.snapshotLine}>标签：{formatProfileTags(profile.tags)}</Text>
              <View className={styles.profileActions}>
                <Text className={styles.inlineAction} onClick={() => onEdit(profile)}>编辑</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <EmptyState title="你还没有社畜档案" description="先存一份自己的小档案，以后报名会轻松很多。" />
      )}

      <Button type="outline" size="medium" block onClick={onCreate}>新建档案</Button>
    </View>
  );
};

export const ProfileSnapshotPanel: React.FC<ProfileSnapshotPanelProps> = ({ profile, onEdit }) => {
  return (
    <View className={styles.sectionCard}>
      <Text className={styles.sectionTitle}>报名档案快照</Text>
      <Text className={styles.snapshotLine}>昵称：{profile?.nickname || '未填写'}</Text>
      <Text className={styles.snapshotLine}>微信名：{profile?.wechatName || '未填写'}</Text>
      <Text className={styles.snapshotLine}>电话：{profile?.phone || '未填写'}</Text>
      <Text className={styles.snapshotLine}>性别：{formatProfileGender(profile?.gender)}</Text>
      <Text className={styles.snapshotLine}>档案信息：{profile ? buildProfileMeta(profile) : '未填写'}</Text>
      <Text className={styles.snapshotLine}>社交目标：{profile?.socialGoal || '未填写'}</Text>
      <Text className={styles.snapshotLine}>标签：{formatProfileTags(profile?.tags)}</Text>
      <Text className={styles.snapshotLine}>自我介绍：{profile?.introduction || '未填写'}</Text>
      <Text className={styles.editLink} onClick={onEdit}>返回编辑档案</Text>
    </View>
  );
};

export const RegistrationSuccessModal: React.FC<RegistrationSuccessModalProps> = ({
  onClose,
  visible,
}) => {
  if (!visible) {
    return null;
  }

  return (
    <View className={styles.modalMask} onClick={onClose}>
      <View className={styles.successModal} onClick={(event) => event.stopPropagation()}>
        <Text className={styles.modalTitle}>报名成功</Text>
        <Text className={styles.modalText}>支付结果已经由服务端确认，活动名额已为你保留。</Text>
        <Text className={styles.modalHint}>可以在「我的报名」里随时查看活动与支付状态。</Text>
        <View className={styles.modalActions}>
          <Button type="primary" size="medium" className={styles.modalAction} onClick={onClose}>
            去我的报名
          </Button>
        </View>
      </View>
    </View>
  );
};
