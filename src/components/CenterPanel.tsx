/**
 * Flint - Center Panel Component
 */

import React from 'react';
import { useAppState } from '../lib/state';
import { WelcomeScreen } from './WelcomeScreen';
import { PreviewPanel } from './PreviewPanel';

interface QuickActionCardProps {
    icon: string;
    title: string;
    description: string;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({ icon, title, description }) => {
    const [isHovered, setIsHovered] = React.useState(false);

    return (
        <div
            className="quick-action-card"
            style={{
                backgroundColor: 'var(--bg-secondary)',
                padding: '20px',
                borderRadius: '8px',
                border: `1px solid ${isHovered ? 'var(--accent-primary)' : 'var(--border)'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>{icon}</div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{title}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{description}</div>
        </div>
    );
};

const ProjectView: React.FC = () => {
    const { state } = useAppState();
    const project = state.currentProject;

    return (
        <div className="project-view" style={{ padding: '24px' }}>
            <h2 style={{ marginBottom: '16px' }}>
                {project ? `${project.champion} - ${project.display_name || project.name}` : 'Project'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Select a file from the tree on the left to preview or edit it.
            </p>
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                }}
            >
                <QuickActionCard icon="🖼️" title="Textures" description="View and replace textures" />
                <QuickActionCard icon="📄" title="BIN Files" description="Edit particle and data files" />
                <QuickActionCard icon="🔊" title="Audio" description="Preview and replace sounds" />
                <QuickActionCard icon="📦" title="Export" description="Build your mod package" />
            </div>
        </div>
    );
};

export const CenterPanel: React.FC = () => {
    const { state } = useAppState();

    const renderView = () => {
        switch (state.currentView) {
            case 'welcome':
                return <WelcomeScreen />;
            case 'preview':
            case 'editor':
                return <PreviewPanel />;
            case 'project':
                return <ProjectView />;
            default:
                return <WelcomeScreen />;
        }
    };

    return (
        <main className="center-panel" id="center-panel">
            {renderView()}
        </main>
    );
};
