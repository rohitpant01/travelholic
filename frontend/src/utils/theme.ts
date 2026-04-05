import { useSelector } from 'react-redux';
import { RootState } from '../store';

export const LIGHT_COLORS = {
  // Primary palette
  teal: '#00B4B4',
  tealDark: '#007F7F',
  tealLight: '#E0F7F7',
  orange: '#FF6B35',
  orangeLight: '#FFF0EB',
  gold: '#F0A500',
  goldLight: '#FFF8E6',

  // Neutral
  white: '#FFFFFF',
  background: '#F8FAFB',
  card: '#FFFFFF',
  border: '#E8ECEF',
  borderLight: '#F2F4F5',

  // Text
  text: '#1A1A2E',
  textSecondary: '#5A6878',
  textLight: '#9BA8B5',
  textWhite: '#FFFFFF',

  // Status
  success: '#27AE60',
  error: '#E74C3C',
  warning: '#F0A500',
  info: '#3498DB',

  // Social swipe colors
  like: '#00B4B4',
  skip: '#E74C3C',
  superLike: '#F0A500',

  // Gradient stops
  gradientStart: '#00B4B4',
  gradientEnd: '#007F7F',
  gradientOrange: '#FF6B35',
  gradientGold: '#F0A500',

  // Overlay
  overlay: 'rgba(0,0,0,0.4)',
  overlayLight: 'rgba(0,0,0,0.15)',
};

export const DARK_COLORS = {
  // Primary palette
  teal: '#00D1D1', // Brighter teal for dark mode
  tealDark: '#00A3A3',
  tealLight: '#1C2C2C', // Darker background for light teal areas
  orange: '#FF8A5C',
  orangeLight: '#2C1D18',
  gold: '#FFC845',
  goldLight: '#2C261A',

  // Neutral
  white: '#121212', // Background color for 'white' components
  background: '#0F172A', // Slate 900
  card: '#1E293B', // Slate 800
  border: '#334155', // Slate 700
  borderLight: '#1E293B',

  // Text
  text: '#F8FAFC', // Slate 50
  textSecondary: '#94A3B8', // Slate 400
  textLight: '#64748B', // Slate 500
  textWhite: '#FFFFFF',

  // Status
  success: '#4ADE80',
  error: '#F87171',
  warning: '#FBBC05',
  info: '#60A5FA',

  // Social swipe colors
  like: '#00D1D1',
  skip: '#F87171',
  superLike: '#FBBC05',

  // Gradient stops
  gradientStart: '#00B4B4',
  gradientEnd: '#0F172A',
  gradientOrange: '#FF6B35',
  gradientGold: '#F0A500',

  // Overlay
  overlay: 'rgba(0,0,0,0.7)',
  overlayLight: 'rgba(0,0,0,0.4)',
};

export const COLORS = LIGHT_COLORS; // Legacy export

export const useAppTheme = () => {
  const mode = useSelector((state: RootState) => state.theme.mode);
  const colors = mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  return { ...colors, mode };
};

export const FONTS = {
  xs: 11,
  sm: 13,
  md: 15,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 38,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  card: {
    shadowColor: '#00B4B4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
