/**
 * Flint - Status Bar Component
 */

import React from 'react';
import { useAppState } from '../lib/state';
import { formatNumber } from '../lib/utils';

export const StatusBar: React.FC = () => {
    const { state } = useAppState();

    const getStatusClass = () => {
        switch (state.status) {
            case 'working':
                return 'statusbar__indicator--working';
            case 'error':
                return 'statusbar__indicator--error';
            default:
                return 'statusbar__indicator--ready';
        }
    };

    const formatHashCount = (count: number): string => {
        if (count >= 1000000) {
            return `Hashes: ${(count / 1000000).toFixed(1)}M entries`;
        } else if (count >= 1000) {
            return `Hashes: ${(count / 1000).toFixed(1)}K entries`;
        } else if (count > 0) {
            return `Hashes: ${formatNumber(count)} entries`;
        }
        return state.hashesLoaded ? `Hashes: ${formatNumber(count)} entries` : 'Hashes: Not Loaded';
    };

    return (
        <footer className="statusbar">
            {/* Left section - status */}
            <div className="statusbar__left">
                <span className={`statusbar__indicator ${getStatusClass()}`} />
                <span>{state.statusMessage}</span>
            </div>

            {/* Right section - hash count */}
            <div className="statusbar__right">
                <span>{formatHashCount(state.hashCount)}</span>
            </div>
        </footer>
    );
};
