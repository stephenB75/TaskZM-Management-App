import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Icon } from '../Icon';
import { UserProfileAvatar } from '../UserProfileAvatar';
import { AVATAR_UI_TEXT } from '../../lib/avatar-constants';
import { SETTINGS_PANEL_UI_TEXT } from '../../lib/settings-panel-constants';
import { SettingsControlGroup } from './SettingsControlGroup';
import { SettingsField } from './SettingsField';
import { SettingsGroup } from './SettingsGroup';
import {
  SETTINGS_PANEL_CONTROL_GROUP_PADDING_X,
  SETTINGS_PANEL_AVATAR_EDIT_BADGE_SIZE,
  SETTINGS_PANEL_AVATAR_EDIT_HIT_OFFSET,
  SETTINGS_PANEL_AVATAR_EDIT_HIT_SIZE,
  SETTINGS_PANEL_AVATAR_EDIT_ICON_SIZE,
  SETTINGS_PANEL_ICON_SIZE_SMALL,
  SETTINGS_PANEL_INPUT_HEIGHT,
  SETTINGS_PANEL_LIST_ROW_PADDING_Y,
  SETTINGS_PANEL_MARGIN_RIGHT_SMALL,
  SETTINGS_PANEL_PADDING_MEDIUM,
  SETTINGS_PANEL_PROFILE_AVATAR_COMPACT_FONT_SIZE,
  SETTINGS_PANEL_PROFILE_AVATAR_COMPACT_SIZE,
  SETTINGS_PANEL_PROFILE_ICON_SIZE,
  SETTINGS_PANEL_PROFILE_META_ROW_PADDING_Y,
  SETTINGS_PANEL_PROFILE_NAME_SIZE,
  SETTINGS_PANEL_TEXT_SIZE_MEDIUM,
  SETTINGS_PANEL_TEXT_SIZE_SMALL,
  PANEL_GAP_MEDIUM,
  PANEL_GAP_SMALL,
} from '../../lib/layout-constants';

interface SettingsProfileSectionProps {
  displayName: string;
  email: string;
  username: string;
  avatar?: string;
  role?: string;
  teamName?: string | null;
  profileName: string;
  onProfileNameChange: (value: string) => void;
  isUpdatingProfile: boolean;
  canSaveProfile: boolean;
  onSaveProfile: () => void;
  onChangeAvatar: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  subscriptionTier: 'pro' | 'free';
  subscriptionStatus?: string;
  billingPeriod?: string;
}

function ProfileMetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{
        paddingTop: SETTINGS_PANEL_PROFILE_META_ROW_PADDING_Y,
        paddingBottom: SETTINGS_PANEL_PROFILE_META_ROW_PADDING_Y,
        paddingLeft: SETTINGS_PANEL_CONTROL_GROUP_PADDING_X,
        paddingRight: SETTINGS_PANEL_CONTROL_GROUP_PADDING_X,
      }}
    >
      <span className="shrink-0 text-muted-foreground" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_SMALL }}>
        {label}
      </span>
      <div
        className="min-w-0 text-right font-medium text-foreground"
        style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_MEDIUM }}
      >
        {children}
      </div>
    </div>
  );
}

export function SettingsProfileSection({
  displayName,
  email,
  username,
  avatar,
  role,
  teamName,
  profileName,
  onProfileNameChange,
  isUpdatingProfile,
  canSaveProfile,
  onSaveProfile,
  onChangeAvatar,
  onSignOut,
  onDeleteAccount,
  subscriptionTier,
  subscriptionStatus,
  billingPeriod,
}: SettingsProfileSectionProps) {
  const isPro = subscriptionTier === 'pro';

  return (
    <SettingsGroup>
      {/* Identity header */}
      <div className="overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-primary/8 via-card to-card shadow-sm">
        <div
          className="flex flex-col gap-4 sm:flex-row sm:items-center"
          style={{ padding: SETTINGS_PANEL_PADDING_MEDIUM, gap: PANEL_GAP_MEDIUM }}
        >
          <div className="relative mx-auto shrink-0 sm:mx-0">
            <UserProfileAvatar
              src={avatar}
              name={displayName}
              size={SETTINGS_PANEL_PROFILE_AVATAR_COMPACT_SIZE}
              fontSize={SETTINGS_PANEL_PROFILE_AVATAR_COMPACT_FONT_SIZE}
              showRing
              className="border-[3px] border-background shadow-md ring-0"
            />
            <button
              type="button"
              className="group absolute flex items-end justify-end border-0 bg-transparent p-0"
              style={{
                right: SETTINGS_PANEL_AVATAR_EDIT_HIT_OFFSET,
                bottom: SETTINGS_PANEL_AVATAR_EDIT_HIT_OFFSET,
                width: SETTINGS_PANEL_AVATAR_EDIT_HIT_SIZE,
                height: SETTINGS_PANEL_AVATAR_EDIT_HIT_SIZE,
              }}
              onClick={onChangeAvatar}
              title={AVATAR_UI_TEXT.changeAvatar}
              aria-label={AVATAR_UI_TEXT.changeAvatar}
            >
              <span
                className="flex items-center justify-center rounded-full border-2 border-background bg-foreground text-background shadow-sm transition-transform group-hover:scale-105"
                style={{
                  width: SETTINGS_PANEL_AVATAR_EDIT_BADGE_SIZE,
                  height: SETTINGS_PANEL_AVATAR_EDIT_BADGE_SIZE,
                }}
              >
                <Icon name="edit" size={SETTINGS_PANEL_AVATAR_EDIT_ICON_SIZE} weight="bold" />
              </span>
            </button>
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div
              className="flex flex-wrap items-center justify-center gap-2 sm:justify-start"
              style={{ marginBottom: PANEL_GAP_SMALL }}
            >
              <h3 className="truncate font-semibold text-foreground" style={{ fontSize: SETTINGS_PANEL_PROFILE_NAME_SIZE }}>
                {displayName}
              </h3>
              {isPro ? (
                <Icon
                  name="sparkles"
                  size={SETTINGS_PANEL_PROFILE_ICON_SIZE}
                  className="shrink-0 text-primary"
                  weight="duotone"
                />
              ) : null}
            </div>
            <p className="truncate text-muted-foreground" style={{ fontSize: SETTINGS_PANEL_TEXT_SIZE_MEDIUM }}>
              @{username}
            </p>
            <div
              className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start"
            >
              <Badge variant="secondary" className="border-primary/20 bg-primary/10 text-primary">
                {isPro ? SETTINGS_PANEL_UI_TEXT.profile.proMember : SETTINGS_PANEL_UI_TEXT.profile.freeMember}
              </Badge>
              {subscriptionStatus ? (
                <Badge variant="outline" className="border-muted text-muted-foreground capitalize">
                  {subscriptionStatus}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Account details */}
      <SettingsControlGroup>
        <ProfileMetaRow label={SETTINGS_PANEL_UI_TEXT.profile.plan}>
          {isPro ? SETTINGS_PANEL_UI_TEXT.profile.pro : SETTINGS_PANEL_UI_TEXT.profile.free}
        </ProfileMetaRow>
        {isPro && billingPeriod ? (
          <ProfileMetaRow label={SETTINGS_PANEL_UI_TEXT.profile.billing}>
            <span className="capitalize">{billingPeriod}</span>
          </ProfileMetaRow>
        ) : null}
        {role ? (
          <ProfileMetaRow label={SETTINGS_PANEL_UI_TEXT.profile.role}>
            <span className="capitalize">{role}</span>
          </ProfileMetaRow>
        ) : null}
        {teamName ? (
          <ProfileMetaRow label={SETTINGS_PANEL_UI_TEXT.profile.team}>
            <span className="inline-flex max-w-full items-center justify-end gap-1.5">
              <Icon name="users" size={SETTINGS_PANEL_ICON_SIZE_SMALL} className="shrink-0 text-muted-foreground" />
              <span className="truncate">{teamName}</span>
            </span>
          </ProfileMetaRow>
        ) : null}
        <ProfileMetaRow label={SETTINGS_PANEL_UI_TEXT.profile.emailLabel}>
          <span className="truncate font-normal text-muted-foreground">{email}</span>
        </ProfileMetaRow>
      </SettingsControlGroup>

      {/* Editable fields */}
      <SettingsControlGroup>
        <div style={{ padding: SETTINGS_PANEL_PADDING_MEDIUM }}>
          <SettingsField id="name" label="Name">
            <Input
              id="name"
              value={profileName}
              onChange={(e) => onProfileNameChange(e.target.value)}
              placeholder="Enter your name"
              style={{ height: SETTINGS_PANEL_INPUT_HEIGHT }}
              className="w-full"
            />
          </SettingsField>
        </div>
        <div style={{ padding: SETTINGS_PANEL_PADDING_MEDIUM }}>
          <SettingsField id="email" label="Email">
            <Input
              id="email"
              value={email}
              disabled
              className="w-full bg-muted/40"
              style={{ height: SETTINGS_PANEL_INPUT_HEIGHT }}
            />
          </SettingsField>
        </div>
      </SettingsControlGroup>

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="sm" variant="outline" className="flex-1" onClick={onChangeAvatar}>
          <Icon name="user-focus" size={SETTINGS_PANEL_ICON_SIZE_SMALL} style={{ marginRight: SETTINGS_PANEL_MARGIN_RIGHT_SMALL }} />
          {AVATAR_UI_TEXT.changeAvatar}
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={onSaveProfile}
          disabled={isUpdatingProfile || !canSaveProfile}
        >
          {isUpdatingProfile ? SETTINGS_PANEL_UI_TEXT.profile.saving : SETTINGS_PANEL_UI_TEXT.profile.saveProfile}
        </Button>
      </div>

      <SettingsControlGroup>
        <div
          style={{
            paddingTop: SETTINGS_PANEL_LIST_ROW_PADDING_Y,
            paddingBottom: SETTINGS_PANEL_LIST_ROW_PADDING_Y,
            paddingLeft: SETTINGS_PANEL_CONTROL_GROUP_PADDING_X,
            paddingRight: SETTINGS_PANEL_CONTROL_GROUP_PADDING_X,
          }}
        >
          <Button size="sm" variant="ghost" className="h-9 w-full justify-start px-2" onClick={onSignOut}>
            <Icon name="log-out" size={SETTINGS_PANEL_ICON_SIZE_SMALL} style={{ marginRight: SETTINGS_PANEL_MARGIN_RIGHT_SMALL }} />
            Sign Out
          </Button>
        </div>
        <div
          style={{
            paddingTop: SETTINGS_PANEL_LIST_ROW_PADDING_Y,
            paddingBottom: SETTINGS_PANEL_LIST_ROW_PADDING_Y,
            paddingLeft: SETTINGS_PANEL_CONTROL_GROUP_PADDING_X,
            paddingRight: SETTINGS_PANEL_CONTROL_GROUP_PADDING_X,
          }}
        >
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-full justify-start px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDeleteAccount}
          >
            <Icon
              name="trash-2"
              size={SETTINGS_PANEL_ICON_SIZE_SMALL}
              style={{ marginRight: SETTINGS_PANEL_MARGIN_RIGHT_SMALL }}
            />
            Delete Account
          </Button>
        </div>
      </SettingsControlGroup>
    </SettingsGroup>
  );
}
