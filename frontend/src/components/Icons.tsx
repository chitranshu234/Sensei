import React from 'react';

export type IconProps = {
  className?: string;
  size?: number;
};

const Icon: React.FC<IconProps & { children: React.ReactNode }> = ({ className = '', size = 20, children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

export const Icons = {
  // Navigation / General
  Dashboard: (props: IconProps) => (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  ),

  // Architecture / Graph
  Architecture: (props: IconProps) => (
    <Icon {...props}>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="19" r="2.5" />
      <circle cx="19" cy="19" r="2.5" />
      <path d="M12 7.5v3.5M7 17.5l3.5-3.5M17 17.5l-3.5-3.5" />
    </Icon>
  ),

  // Search
  Search: (props: IconProps) => (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7.5" />
      <path d="m21 21-4.35-4.35" />
    </Icon>
  ),

  // Chat / AI
  Sparkles: (props: IconProps) => (
    <Icon {...props}>
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </Icon>
  ),

  // File
  File: (props: IconProps) => (
    <Icon {...props}>
      <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </Icon>
  ),

  // Folder
  Folder: (props: IconProps) => (
    <Icon {...props}>
      <path d="M4 20h16a2 2 0 002-2V8a2 2 0 00-2-2h-7.93a2 2 0 01-1.66-.9l-.82-1.2A2 2 0 007.93 3H4a2 2 0 00-2 2v13c0 1.1.9 2 2 2z" />
    </Icon>
  ),

  // FolderOpen
  FolderOpen: (props: IconProps) => (
    <Icon {...props}>
      <path d="M6 14l1.45-2.9A2 2 0 019.24 10H20a2 2 0 011.94 2.5l-1.55 6a2 2 0 01-1.94 1.5H4a2 2 0 01-2-2V5a2 2 0 012-2h3.93a2 2 0 011.66.9l.82 1.2a2 2 0 001.66.9H18a2 2 0 012 2v2" />
    </Icon>
  ),

  // Box / Package / Entity
  Box: (props: IconProps) => (
    <Icon {...props}>
      <path d="M21 8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </Icon>
  ),

  // Database / Repository
  Database: (props: IconProps) => (
    <Icon {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </Icon>
  ),

  // Server / Controller
  Server: (props: IconProps) => (
    <Icon {...props}>
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </Icon>
  ),

  // Cpu / Service / Logic
  Cpu: (props: IconProps) => (
    <Icon {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="15" x2="23" y2="15" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="15" x2="4" y2="15" />
    </Icon>
  ),

  // Layers
  Layers: (props: IconProps) => (
    <Icon {...props}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </Icon>
  ),

  // Warning / Alert triangle
  AlertTriangle: (props: IconProps) => (
    <Icon {...props}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
    </Icon>
  ),

  // X / Close
  X: (props: IconProps) => (
    <Icon {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </Icon>
  ),

  // Check / Checkmark
  Check: (props: IconProps) => (
    <Icon {...props}>
      <polyline points="20 6 9 17 4 12" />
    </Icon>
  ),

  // Clock / Timer
  Clock: (props: IconProps) => (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Icon>
  ),

  // Download
  Download: (props: IconProps) => (
    <Icon {...props}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </Icon>
  ),

  // Microscope / Parse
  Microscope: (props: IconProps) => (
    <Icon {...props}>
      <path d="M6 18h8M3 22h18M14 22a7 7 0 100-14h-1M9 14h2M9 12a2 2 0 01-2-2V6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2z" />
    </Icon>
  ),

  // Brain / AI
  Brain: (props: IconProps) => (
    <Icon {...props}>
      <path d="M9.5 2A5.5 5.5 0 004 7.5a5.5 5.5 0 00.43 2.14A5 5 0 007 19h2M14.5 2A5.5 5.5 0 0120 7.5a5.5 5.5 0 01-.43 2.14A5 5 0 0017 19h-2M12 2v20" />
    </Icon>
  ),

  // Explosion / Error
  AlertCircle: (props: IconProps) => (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </Icon>
  ),

  // Link / Citation
  Link: (props: IconProps) => (
    <Icon {...props}>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </Icon>
  ),

  // Send / Arrow
  Send: (props: IconProps) => (
    <Icon {...props}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </Icon>
  ),

  // Chevron right
  ChevronRight: (props: IconProps) => (
    <Icon {...props}>
      <polyline points="9 18 15 12 9 6" />
    </Icon>
  ),

  // Arrow right
  ArrowRight: (props: IconProps) => (
    <Icon {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </Icon>
  ),

  // Code
  Code: (props: IconProps) => (
    <Icon {...props}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </Icon>
  ),

  // Git branch
  GitBranch: (props: IconProps) => (
    <Icon {...props}>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 01-9 9" />
    </Icon>
  ),

  // MessageSquare
  MessageSquare: (props: IconProps) => (
    <Icon {...props}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </Icon>
  ),

  // Target
  Target: (props: IconProps) => (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </Icon>
  ),

  // GitHub Icon
  GitHub: (props: IconProps) => (
    <Icon {...props}>
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </Icon>
  ),

  // Trash / Delete
  Trash: (props: IconProps) => (
    <Icon {...props}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </Icon>
  ),

  // Copy
  Copy: (props: IconProps) => (
    <Icon {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
  ),

  // ExternalLink
  ExternalLink: (props: IconProps) => (
    <Icon {...props}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </Icon>
  ),

  // BookOpen (Onboarding Guide)
  BookOpen: (props: IconProps) => (
    <Icon {...props}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </Icon>
  ),

  // Filter
  Filter: (props: IconProps) => (
    <Icon {...props}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </Icon>
  ),

  // Compass / Layout
  Compass: (props: IconProps) => (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </Icon>
  ),

  // Maximize / Fullscreen
  Maximize: (props: IconProps) => (
    <Icon {...props}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </Icon>
  ),

  // Minimize
  Minimize: (props: IconProps) => (
    <Icon {...props}>
      <path d="M4 14h6v6m10-10h-6V4m0 6 7-7M10 14l-7 7" />
    </Icon>
  ),

  // Refresh
  Refresh: (props: IconProps) => (
    <Icon {...props}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </Icon>
  ),

  // Eye
  Eye: (props: IconProps) => (
    <Icon {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),

  // Info
  Info: (props: IconProps) => (
    <Icon {...props}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </Icon>
  ),
};
