import multiavatar from '@multiavatar/multiavatar/esm';
import type { AvatarOption } from './avatar-constants';

export function renderAvatarSvg(option: AvatarOption): string {
  return multiavatar('taskzm', false, { part: option.part, theme: option.theme });
}

export function getAvatarSvgDataUrl(option: AvatarOption): string {
  const svg = renderAvatarSvg(option);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
