import { Avatar, Style } from '@dicebear/core';
import loreleiDefinition from '@dicebear/styles/lorelei.json';
import micahDefinition from '@dicebear/styles/micah.json';
import notionistsDefinition from '@dicebear/styles/notionists.json';
import {
  AVATAR_RENDER_SIZE,
  getAvatarBackgroundColor,
  getAvatarOptionIndex,
  type AvatarOption,
  type AvatarStyleId,
} from './avatar-constants';

const STYLE_INSTANCES: Record<AvatarStyleId, Style> = {
  lorelei: new Style(loreleiDefinition),
  notionists: new Style(notionistsDefinition),
  micah: new Style(micahDefinition),
};

export function renderAvatarSvg(option: AvatarOption): string {
  const style = STYLE_INSTANCES[option.style];
  const backgroundColor = getAvatarBackgroundColor(getAvatarOptionIndex(option));

  return new Avatar(style, {
    seed: option.seed,
    size: AVATAR_RENDER_SIZE,
    backgroundColor: [backgroundColor],
  }).toString();
}

export function getAvatarSvgDataUrl(option: AvatarOption): string {
  const style = STYLE_INSTANCES[option.style];
  const backgroundColor = getAvatarBackgroundColor(getAvatarOptionIndex(option));

  return new Avatar(style, {
    seed: option.seed,
    size: AVATAR_RENDER_SIZE,
    backgroundColor: [backgroundColor],
  }).toDataUri();
}
