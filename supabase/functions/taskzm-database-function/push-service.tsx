/**
 * Remote push (APNs) — device token storage, JWT signing, delivery, and the
 * due-soon / overdue dispatcher run by pg_cron.
 *
 * Reminder rules mirror src/lib/notification-task-filters.ts so remote pushes
 * fire at the same moments the on-device scheduler would.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export const PUSH_CONFIG = {
  table: 'push_device_tokens',
  apnsHosts: {
    production: 'https://api.push.apple.com',
    sandbox: 'https://api.sandbox.push.apple.com',
  },
  defaultKeyId: 'W3QFFC6SFU',
  defaultBundleId: 'com.app.taskzm.com',
  /** APNs rejects provider tokens older than 1 hour; refresh well before that. */
  jwtRefreshMs: 50 * MS_PER_MINUTE,
  defaultReminderMinutes: 60,
  dueNowMinutes: 5,
  /** Only alert tasks that became overdue recently, so first runs don't flood old backlog. */
  overdueLookbackMs: MS_PER_DAY,
  sentRetentionMs: 7 * MS_PER_DAY,
  /** Cron runs every 5 minutes; treat server reminders as live if a run happened within this window. */
  dispatchHealthyWithinMs: 15 * MS_PER_MINUTE,
  lastRunKey: 'push_dispatch_last_run',
  sentKeyPrefix: 'push_sent_',
  collapseIdMaxBytes: 64,
  titles: {
    overdue: 'Task Overdue',
    dueNow: 'Task Due Now',
    upcoming: 'Upcoming Task',
    test: 'TaskZM notifications are on',
  },
  messages: {
    wasDue: (title: string, date: string) => `${title} was due ${date}`,
    dueNow: (title: string) => `${title} is due now!`,
    upcoming: (title: string, timeText: string) => `${title} is upcoming in ${timeText}`,
    minutes: (n: number) => `${n} minutes`,
    hours: (n: number) => `${n} hours`,
    test: 'Push notifications from TaskZM will appear on this device.',
  },
} as const;

type ApnsEnvironment = 'production' | 'sandbox';

export interface PushPreferences {
  enabled: boolean;
  dueDateReminders: boolean;
  overdueAlerts: boolean;
  reminderTime: number;
}

interface DeviceRow {
  token: string;
  user_id: string;
  platform: 'ios' | 'android';
  apns_environment: ApnsEnvironment | null;
  timezone: string;
  preferences: Partial<PushPreferences>;
}

interface PushTask {
  id: string;
  title?: string;
  status?: string;
  scheduledDate?: string | null;
  dueDate?: string | null;
  recurrence?: { type?: string } | null;
}

export interface PushMessage {
  title: string;
  body: string;
  collapseId?: string;
  data?: Record<string, string>;
}

const db = () =>
  createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

// ---------------------------------------------------------------------------
// APNs provider token (ES256 JWT)
// ---------------------------------------------------------------------------

function apnsCredentials() {
  const teamId = Deno.env.get('APNS_TEAM_ID') ?? '';
  const privateKey = Deno.env.get('APNS_PRIVATE_KEY') ?? '';
  return {
    keyId: Deno.env.get('APNS_KEY_ID') || PUSH_CONFIG.defaultKeyId,
    teamId,
    privateKey,
    bundleId: Deno.env.get('APNS_BUNDLE_ID') || PUSH_CONFIG.defaultBundleId,
  };
}

export function isApnsConfigured(): boolean {
  const { teamId, privateKey } = apnsCredentials();
  return teamId.length > 0 && privateKey.length > 0;
}

function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let cachedJwt: { token: string; issuedAt: number } | null = null;

async function getProviderToken(): Promise<string> {
  const now = Date.now();
  if (cachedJwt && now - cachedJwt.issuedAt < PUSH_CONFIG.jwtRefreshMs) {
    return cachedJwt.token;
  }

  const { keyId, teamId, privateKey } = apnsCredentials();
  const pemBody = privateKey
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = base64Url(JSON.stringify({ iss: teamId, iat: Math.floor(now / 1000) }));
  const signingInput = `${header}.${claims}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(signingInput),
    ),
  );

  const token = `${signingInput}.${base64Url(signature)}`;
  cachedJwt = { token, issuedAt: now };
  return token;
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

type SendResult = { ok: true; environment: ApnsEnvironment } | { ok: false; status: number; reason: string; dropToken: boolean };

async function postToApns(
  token: string,
  environment: ApnsEnvironment,
  message: PushMessage,
): Promise<{ status: number; reason: string }> {
  const { bundleId } = apnsCredentials();
  const headers: Record<string, string> = {
    authorization: `bearer ${await getProviderToken()}`,
    'apns-topic': bundleId,
    'apns-push-type': 'alert',
    'apns-priority': '10',
    'content-type': 'application/json',
  };
  if (message.collapseId) {
    headers['apns-collapse-id'] = message.collapseId.slice(0, PUSH_CONFIG.collapseIdMaxBytes);
  }

  const response = await fetch(`${PUSH_CONFIG.apnsHosts[environment]}/3/device/${token}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      aps: { alert: { title: message.title, body: message.body }, sound: 'default' },
      ...(message.data ?? {}),
    }),
  });

  if (response.ok) return { status: response.status, reason: '' };
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, reason: String((payload as { reason?: string }).reason ?? '') };
}

/** Send to one device; unknown environments try production then sandbox (Xcode debug builds). */
async function sendToDevice(device: DeviceRow, message: PushMessage): Promise<SendResult> {
  const order: ApnsEnvironment[] = device.apns_environment
    ? [device.apns_environment]
    : ['production', 'sandbox'];

  let last = { status: 0, reason: '' };
  for (const environment of order) {
    last = await postToApns(device.token, environment, message);
    if (last.status === 200) return { ok: true, environment };
    if (last.reason !== 'BadDeviceToken') break;
  }

  const dropToken =
    last.status === 410 || last.reason === 'BadDeviceToken' || last.reason === 'Unregistered';
  return { ok: false, status: last.status, reason: last.reason, dropToken };
}

async function deliver(device: DeviceRow, message: PushMessage): Promise<'sent' | 'failed' | 'dropped'> {
  const result = await sendToDevice(device, message);
  const supabase = db();

  if (result.ok) {
    if (device.apns_environment !== result.environment) {
      device.apns_environment = result.environment;
      await supabase
        .from(PUSH_CONFIG.table)
        .update({ apns_environment: result.environment, last_error: null })
        .eq('token', device.token);
    }
    return 'sent';
  }

  console.warn('[push] APNs delivery failed', result.status, result.reason);
  if (result.dropToken) {
    await supabase.from(PUSH_CONFIG.table).delete().eq('token', device.token);
    return 'dropped';
  }
  await supabase
    .from(PUSH_CONFIG.table)
    .update({ last_error: `${result.status} ${result.reason}`.trim() })
    .eq('token', device.token);
  return 'failed';
}

// ---------------------------------------------------------------------------
// Token registration
// ---------------------------------------------------------------------------

function normalizePreferences(input: Partial<PushPreferences> | undefined): PushPreferences {
  return {
    enabled: input?.enabled !== false,
    dueDateReminders: input?.dueDateReminders !== false,
    overdueAlerts: input?.overdueAlerts !== false,
    reminderTime:
      typeof input?.reminderTime === 'number' && input.reminderTime >= 0
        ? input.reminderTime
        : PUSH_CONFIG.defaultReminderMinutes,
  };
}

function isValidTimezone(timezone: unknown): timezone is string {
  if (typeof timezone !== 'string' || timezone.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export async function isDispatchHealthy(): Promise<boolean> {
  const lastRun = Number(await kv.get(PUSH_CONFIG.lastRunKey));
  return Number.isFinite(lastRun) && Date.now() - lastRun <= PUSH_CONFIG.dispatchHealthyWithinMs;
}

export async function registerDeviceToken(
  userId: string,
  body: { token?: unknown; platform?: unknown; timezone?: unknown; preferences?: Partial<PushPreferences> },
): Promise<{ ok: true; serverReminders: boolean } | { ok: false; error: string }> {
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!/^[0-9a-fA-F]{32,200}$/.test(token)) return { ok: false, error: 'Invalid device token' };
  if (body.platform !== 'ios') return { ok: false, error: 'Only iOS push is supported' };

  const { error } = await db()
    .from(PUSH_CONFIG.table)
    .upsert(
      {
        token,
        user_id: userId,
        platform: 'ios',
        timezone: isValidTimezone(body.timezone) ? body.timezone : 'UTC',
        preferences: normalizePreferences(body.preferences),
        last_error: null,
      },
      { onConflict: 'token' },
    );
  if (error) return { ok: false, error: error.message };

  const serverReminders = isApnsConfigured() && (await isDispatchHealthy());
  return { ok: true, serverReminders };
}

export async function unregisterDeviceToken(userId: string, token: unknown): Promise<void> {
  if (typeof token !== 'string' || token.length === 0) return;
  await db().from(PUSH_CONFIG.table).delete().eq('token', token).eq('user_id', userId);
}

export async function sendTestPush(userId: string): Promise<{ sent: number; devices: number; errors: string[] }> {
  const { data, error } = await db().from(PUSH_CONFIG.table).select('*').eq('user_id', userId);
  if (error) return { sent: 0, devices: 0, errors: [error.message] };

  const devices = (data ?? []) as DeviceRow[];
  let sent = 0;
  const errors: string[] = [];
  for (const device of devices) {
    const result = await sendToDevice(device, {
      title: PUSH_CONFIG.titles.test,
      body: PUSH_CONFIG.messages.test,
      data: { type: 'test' },
    });
    if (result.ok) {
      sent++;
      if (device.apns_environment !== result.environment) {
        await db().from(PUSH_CONFIG.table).update({ apns_environment: result.environment }).eq('token', device.token);
      }
    } else {
      errors.push(`${result.status} ${result.reason}`.trim());
      if (result.dropToken) await db().from(PUSH_CONFIG.table).delete().eq('token', device.token);
    }
  }
  return { sent, devices: devices.length, errors };
}

// ---------------------------------------------------------------------------
// Timezone-aware task timing (mirrors notification-task-filters.ts)
// ---------------------------------------------------------------------------

function zonedParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

/** UTC instant of local midnight for a calendar day in the given zone. */
function zonedMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  const offsetAt = (ms: number) => {
    const p = zonedParts(new Date(ms), timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms;
  };
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first));
}

function parseTarget(raw: string, timeZone: string): { date: Date; dateOnly: boolean } | null {
  let s = raw.trim();
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dayMatch) {
    return {
      date: zonedMidnight(Number(dayMatch[1]), Number(dayMatch[2]), Number(dayMatch[3]), timeZone),
      dateOnly: true,
    };
  }
  if (/^\d{4}-\d{2}-\d{2} \d/.test(s)) s = s.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d/.test(s) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) s += 'Z';

  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return null;
  const local = zonedParts(date, timeZone);
  const dateOnly = local.hour === 0 && local.minute === 0 && local.second === 0;
  return { date, dateOnly };
}

function isRecurring(task: PushTask): boolean {
  return Boolean(task.recurrence && task.recurrence.type && task.recurrence.type !== 'none');
}

function formatLocalDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric', day: 'numeric', year: 'numeric' }).format(date);
}

function dueSoonMessage(task: PushTask, target: Date, now: Date): PushMessage {
  const title = task.title ?? '';
  const minutesUntil = Math.max(0, Math.round((target.getTime() - now.getTime()) / MS_PER_MINUTE));
  if (minutesUntil <= PUSH_CONFIG.dueNowMinutes) {
    return { title: PUSH_CONFIG.titles.dueNow, body: PUSH_CONFIG.messages.dueNow(title) };
  }
  const timeText =
    minutesUntil < 60
      ? PUSH_CONFIG.messages.minutes(minutesUntil)
      : PUSH_CONFIG.messages.hours(Math.round(minutesUntil / 60));
  return { title: PUSH_CONFIG.titles.upcoming, body: PUSH_CONFIG.messages.upcoming(title, timeText) };
}

interface DueAlert {
  key: string;
  message: PushMessage;
}

function alertsForTask(task: PushTask, prefs: PushPreferences, timeZone: string, now: Date): DueAlert[] {
  if (task.status === 'done' || isRecurring(task)) return [];
  const raw = task.scheduledDate ?? task.dueDate ?? null;
  if (!raw) return [];
  const target = parseTarget(raw, timeZone);
  if (!target) return [];

  const alerts: DueAlert[] = [];
  const targetMs = target.date.getTime();
  const nowMs = now.getTime();

  const dueEligible = Boolean(task.scheduledDate) || !target.dateOnly;
  if (prefs.dueDateReminders && dueEligible) {
    const reminderAt = targetMs - prefs.reminderTime * MS_PER_MINUTE;
    if (nowMs >= reminderAt && nowMs < targetMs) {
      alerts.push({
        key: `reminder:${task.id}:${targetMs}`,
        message: {
          ...dueSoonMessage(task, target.date, now),
          collapseId: `reminder_${task.id}`,
          data: { taskId: task.id, type: 'reminder' },
        },
      });
    }
  }

  if (prefs.overdueAlerts) {
    let overdueAt = targetMs;
    if (target.dateOnly) {
      const local = zonedParts(target.date, timeZone);
      const nextDay = new Date(Date.UTC(local.year, local.month - 1, local.day) + MS_PER_DAY);
      overdueAt = zonedMidnight(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate(), timeZone).getTime();
    }
    if (nowMs >= overdueAt && nowMs - overdueAt <= PUSH_CONFIG.overdueLookbackMs) {
      alerts.push({
        key: `overdue:${task.id}:${targetMs}`,
        message: {
          title: PUSH_CONFIG.titles.overdue,
          body: PUSH_CONFIG.messages.wasDue(task.title ?? '', formatLocalDate(target.date, timeZone)),
          collapseId: `overdue_${task.id}`,
          data: { taskId: task.id, type: 'overdue' },
        },
      });
    }
  }

  return alerts;
}

async function loadUserTasks(userId: string): Promise<PushTask[]> {
  const workspaceId = await kv.get(`user_${userId}_workspace`);
  if (!workspaceId) return [];
  const prefix = `workspace_${workspaceId}_task_`;
  const rows = await kv.getByPrefix(prefix);
  return rows
    .filter((row) => row?.key?.startsWith(prefix) && row.key.length > prefix.length)
    .map((row) => row.value as PushTask)
    .filter((task) => task && typeof task === 'object' && typeof task.id === 'string');
}

// ---------------------------------------------------------------------------
// Dispatcher (pg_cron → POST /push/dispatch)
// ---------------------------------------------------------------------------

export async function dispatchDuePushes(): Promise<{ users: number; devices: number; sent: number }> {
  const now = new Date();
  await kv.set(PUSH_CONFIG.lastRunKey, now.getTime());

  if (!isApnsConfigured()) {
    console.warn('[push] APNS_TEAM_ID / APNS_PRIVATE_KEY not set; skipping dispatch');
    return { users: 0, devices: 0, sent: 0 };
  }

  const { data, error } = await db().from(PUSH_CONFIG.table).select('*').eq('platform', 'ios');
  if (error) throw new Error(error.message);

  const byUser = new Map<string, DeviceRow[]>();
  for (const device of (data ?? []) as DeviceRow[]) {
    const list = byUser.get(device.user_id) ?? [];
    list.push(device);
    byUser.set(device.user_id, list);
  }

  let sent = 0;
  for (const [userId, devices] of byUser) {
    const tasks = await loadUserTasks(userId);
    if (tasks.length === 0) continue;

    const sentKey = `${PUSH_CONFIG.sentKeyPrefix}${userId}`;
    const sentLog: Record<string, number> = (await kv.get(sentKey)) ?? {};
    let changed = false;

    for (const device of devices) {
      const prefs = normalizePreferences(device.preferences);
      if (!prefs.enabled) continue;
      const tokenTag = device.token.slice(-12);
      const alerts = tasks.flatMap((task) => alertsForTask(task, prefs, device.timezone || 'UTC', now));

      for (const alert of alerts) {
        const logKey = `${tokenTag}:${alert.key}`;
        if (sentLog[logKey]) continue;
        const outcome = await deliver(device, alert.message);
        if (outcome === 'dropped') break;
        if (outcome === 'failed') continue;
        sent++;
        sentLog[logKey] = now.getTime();
        changed = true;
      }
    }

    if (changed) {
      const cutoff = now.getTime() - PUSH_CONFIG.sentRetentionMs;
      for (const [key, sentAt] of Object.entries(sentLog)) {
        if (sentAt < cutoff) delete sentLog[key];
      }
      await kv.set(sentKey, sentLog);
    }
  }

  return { users: byUser.size, devices: data?.length ?? 0, sent };
}

/** Constant-time comparison for the cron shared secret. */
export function isValidCronSecret(provided: string | null | undefined): boolean {
  const expected = Deno.env.get('PUSH_CRON_SECRET') ?? '';
  if (!expected || !provided || provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}
