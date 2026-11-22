import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_REMOTE, DEFAULT_SETTINGS, EMPTY_COUNTERS,
  type Counters, type OnDeviceStatus, type Receipt, type RemoteSettings, type UserSettings,
} from '@satark/core';
import { getCounters, getReceipts, getSettings, onLocalChange, saveSettings } from '@/lib/storage';
import { loadRemote } from '@/lib/firebase';
import { onDeviceStatus } from '@/lib/engine';

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    const load = () => void getSettings().then(setSettings);
    load();
    return onLocalChange(['settings'], load);
  }, []);
  const update = useCallback(async (patch: Partial<UserSettings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
    return next;
  }, []);
  return [settings, update] as const;
}

export function useRemote() {
  const [remote, setRemote] = useState<RemoteSettings>(DEFAULT_REMOTE);
  useEffect(() => { void loadRemote().then(setRemote); }, []);
  return remote;
}

export function useOnDeviceStatus() {
  const [status, setStatus] = useState<OnDeviceStatus | 'checking'>('checking');
  const refresh = useCallback(async (force = true) => setStatus(await onDeviceStatus(force)), []);
  useEffect(() => {
    void refresh(false);
    const id = setInterval(() => void refresh(false), 30_000);
    return () => clearInterval(id);
  }, [refresh]);
  return [status, refresh] as const;
}

export function useLog() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [counters, setCounters] = useState<Counters>(EMPTY_COUNTERS);
  useEffect(() => {
    const load = () => { void getReceipts().then(setReceipts); void getCounters().then(setCounters); };
    load();
    return onLocalChange(['receipts', 'counters'], load);
  }, []);
  return { receipts, counters };
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);
  return online;
}
