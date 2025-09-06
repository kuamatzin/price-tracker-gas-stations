import { CHART_CONFIG } from '../config/charts';

export const createChartAnimationProps = () => ({
  animationDuration: CHART_CONFIG.animations.duration,
  animationEasing: CHART_CONFIG.animations.easing,
});

export const createLineAnimationProps = () => ({
  animationDuration: CHART_CONFIG.animations.duration,
  animationEasing: CHART_CONFIG.animations.easing,
  strokeDasharray: '5 5',
  strokeDashoffset: 0,
});

export const createAreaAnimationProps = () => ({
  animationDuration: CHART_CONFIG.animations.duration,
  animationEasing: CHART_CONFIG.animations.easing,
  fillOpacity: 0.6,
});

export const createTooltipAnimationProps = () => ({
  animationDuration: 150,
  animationEasing: 'ease-out',
});

export const createTransitionConfig = (property: string, duration?: number) => ({
  property,
  duration: duration || CHART_CONFIG.animations.duration,
  timingFunction: CHART_CONFIG.animations.easing,
});

export const fadeInAnimation = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: CHART_CONFIG.animations.duration / 1000 },
};

export const slideInFromRight = {
  initial: { x: 20, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: { duration: CHART_CONFIG.animations.duration / 1000 },
};

export const scaleInAnimation = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { duration: CHART_CONFIG.animations.duration / 1000 },
};