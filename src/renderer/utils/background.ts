import { useEffect, useRef } from 'react';

export interface BackgroundConfig {
  type: 'none' | 'color' | 'image';
  value: string;
  images?: string[];
  scrollEnabled?: boolean;
  scrollSpeed?: number;
  scrollDirection?: 'left' | 'right';
  opacity: number;
  blur: number;
}

/**
 * Convert file paths to proper URLs for local file protocol
 */
export function getImageUrl(imagePath: string): string {
  if (!imagePath) return '';

  // If it's already a data URL or http URL, return as is
  if (imagePath.startsWith('data:') || imagePath.startsWith('http')) {
    return imagePath;
  }

  // Convert to local-file protocol URL
  const normalizedPath = imagePath.replace(/\\/g, '/');

  // If it's an absolute path, use it directly
  if (normalizedPath.startsWith('/') || normalizedPath.match(/^[A-Za-z]:/)) {
    // Remove leading slash for Windows paths with drive letters
    const cleanPath = normalizedPath.replace(/^\//, '');
    return `local-file://${encodeURIComponent(cleanPath)}`;
  }

  // Relative path - shouldn't happen but handle it
  return `local-file://${encodeURIComponent(normalizedPath)}`;
}

/**
 * Apply color background to the root element
 */
function applyColorBackground(root: HTMLElement, background: BackgroundConfig) {
  const color = background.value;

  // Apply color background (supports hex colors)
  if (color) {
    root.style.background = color;
    document.body.style.background = color;
  }
}

/**
 * Create scrolling image carousel
 */
function createScrollingCarousel(background: BackgroundConfig) {
  // Create container element
  const containerElement = document.createElement('div');
  containerElement.className = 'app-background';
  containerElement.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
  `;

  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'app-background-scroll';
  scrollContainer.style.cssText = `
    display: flex;
    height: 100%;
    width: max-content;
    will-change: transform;
    opacity: ${background.opacity / 100};
    transition: none;
  `;

  // Create image elements - triple the sequence for seamless scrolling in both directions
  const createImageSet = () => {
    background.images!.forEach((imagePath) => {
      const imgElement = document.createElement('div');
      imgElement.style.cssText = `
        flex: 0 0 auto;
        width: 100vw;
        height: 100%;
        background-image: url("${getImageUrl(imagePath)}");
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        filter: blur(${background.blur}px);
        display: inline-block;
      `;
      scrollContainer.appendChild(imgElement);
    });
  };

  // Create three sets of images for seamless loop in both directions
  createImageSet();
  createImageSet();
  createImageSet();

  containerElement.appendChild(scrollContainer);
  document.body.appendChild(containerElement);
}

/**
 * Create single static image background
 */
function createStaticImage(background: BackgroundConfig) {
  const bgElement = document.createElement('div');
  bgElement.className = 'app-background';
  bgElement.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: -1;
    background-image: url("${getImageUrl(background.value)}");
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    filter: blur(${background.blur}px);
    opacity: ${background.opacity / 100};
    pointer-events: none;
  `;
  document.body.appendChild(bgElement);
}

/**
 * Clean up existing background elements
 */
function cleanupBackgrounds() {
  const existingBgs = document.querySelectorAll('.app-background');
  existingBgs.forEach(bg => bg.remove());
}

/**
 * Reset root element styles
 */
function resetRootStyles(root: HTMLElement) {
  root.style.background = '';
  root.style.backgroundImage = '';
  root.style.backgroundSize = '';
  root.style.backgroundPosition = '';
  root.style.filter = '';
  // Also reset body background to ensure clean slate
  document.body.style.background = '';
}

/**
 * Apply background effect based on configuration
 */
export function applyBackground(background: BackgroundConfig) {
  if (typeof document === 'undefined') return;

  const root = document.getElementById('root');
  if (!root) return;

  // Clean up existing backgrounds
  cleanupBackgrounds();
  resetRootStyles(root);

  // Apply new background based on type
  switch (background.type) {
    case 'color':
      if (background.value) {
        applyColorBackground(root, background);
      }
      break;

    case 'image':
      if (background.scrollEnabled && background.images && background.images.length > 1) {
        createScrollingCarousel(background);
      } else if (background.value || (background.images && background.images.length > 0)) {
        // Use the first image from the array if no specific value is set
        const imageToUse = background.value || background.images![0];
        createStaticImage({ ...background, value: imageToUse });
      }
      break;

    case 'none':
    default:
      // Set a subtle dark gradient as default
      const darkGradient = 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)';
      document.body.style.background = darkGradient;
      root.style.background = darkGradient;
      break;
  }
}

/**
 * Hook to manage scrolling animation for carousel backgrounds
 */
export function useScrollingAnimation(background: BackgroundConfig) {
  useEffect(() => {
    // Only run animation for scrolling carousel mode
    if (
      background.type !== 'image' ||
      !background.scrollEnabled ||
      !background.images ||
      background.images.length === 0
    ) {
      return;
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      const scrollElement = document.querySelector('.app-background-scroll') as HTMLDivElement;

      if (!scrollElement) return;

      console.log('Starting scroll animation', {
        images: background.images!.length,
        speed: background.scrollSpeed,
        direction: background.scrollDirection
      });

      const scrollSpeed = background.scrollSpeed || 30; // pixels per second
      const direction = background.scrollDirection === 'right' ? 1 : -1;
      let animationId: number;
      let lastTime = performance.now();
      let scrollPosition = 0;

      // Calculate the width of one complete image set
      const viewportWidth = window.innerWidth;
      const totalImages = background.images!.length;
      const imageSetWidth = viewportWidth * totalImages;

      // Start position for right scrolling should be negative
      if (direction === 1) {
        scrollPosition = -imageSetWidth;
      }

      const animate = (currentTime: number) => {
        const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
        lastTime = currentTime;

        // Update scroll position
        scrollPosition += direction * scrollSpeed * deltaTime;

        // Handle looping based on direction
        if (direction === -1) {
          // Scrolling left: when we've scrolled past all images, reset
          if (scrollPosition <= -imageSetWidth) {
            scrollPosition += imageSetWidth;
          }
        } else {
          // Scrolling right: when we reach 0, reset to negative position
          if (scrollPosition >= 0) {
            scrollPosition -= imageSetWidth;
          }
        }

        // Apply transform
        scrollElement.style.transform = `translateX(${scrollPosition}px)`;

        animationId = requestAnimationFrame(animate);
      };

      animationId = requestAnimationFrame(animate);

      return () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
      };
    }, 100); // 100ms delay to ensure DOM is ready

    return () => clearTimeout(timer);
  }, [
    background.type,
    background.scrollEnabled,
    background.images,
    background.scrollSpeed,
    background.scrollDirection,
  ]);
}

/**
 * Hook to manage background effects and cleanup
 */
export function useBackgroundEffect(background: BackgroundConfig) {
  // Apply background effect
  useEffect(() => {
    applyBackground(background);
  }, [background]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        cleanupBackgrounds();
      }
    };
  }, []);

  // Use scrolling animation if enabled
  useScrollingAnimation(background);
}
