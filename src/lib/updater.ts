/**
 * Flint - Auto-Update Manager
 * Uses Tauri's official updater plugin
 */

import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateCheckResult {
    available: boolean;
    currentVersion: string;
    newVersion?: string;
    body?: string;
    date?: string;
}

/**
 * Check for available updates using Tauri's updater plugin
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
    try {
        const update = await check();

        if (update && update.available) {
            return {
                available: true,
                currentVersion: update.currentVersion,
                newVersion: update.version,
                body: update.body,
                date: update.date,
            };
        }

        return {
            available: false,
            currentVersion: update?.currentVersion || '0.0.0',
        };
    } catch (error) {
        console.error('[Updater] Failed to check for updates:', error);
        throw error;
    }
}

/**
 * Download and install an available update
 */
export async function downloadAndInstallUpdate(
    onProgress?: (downloaded: number, total: number) => void
): Promise<void> {
    try {
        const update = await check();

        if (!update || !update.available) {
            throw new Error('No update available');
        }

        console.log('[Updater] Downloading update...');

        // Download with progress callback
        await update.downloadAndInstall((event) => {
            switch (event.event) {
                case 'Started':
                    console.log('[Updater] Download started');
                    onProgress?.(0, event.data.contentLength || 0);
                    break;
                case 'Progress':
                    console.log(`[Updater] Downloaded ${event.data.chunkLength} bytes`);
                    if (onProgress && event.data.chunkLength && event.data.contentLength) {
                        // Note: This is cumulative progress
                        onProgress(event.data.chunkLength, event.data.contentLength);
                    }
                    break;
                case 'Finished':
                    console.log('[Updater] Download finished');
                    onProgress?.(100, 100);
                    break;
            }
        });

        console.log('[Updater] Update installed successfully, relaunching...');

        // Relaunch the app
        await relaunch();
    } catch (error) {
        console.error('[Updater] Failed to install update:', error);
        throw error;
    }
}
