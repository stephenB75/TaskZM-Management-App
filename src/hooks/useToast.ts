/**
 * useToast Hook
 * Same behavior as importing `toast` from lib/toast-wrapper: messages are stored in the
 * notification panel and delivered as system notifications on native.
 *
 * Usage:
 * const { toast } = useToast();
 * toast.success('Task completed!');
 */

import { toast } from '../lib/toast-wrapper';

export function useToast() {
  return { toast };
}
