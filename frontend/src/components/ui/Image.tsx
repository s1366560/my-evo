"use client";

import { useState } from "react";
import Image from "next/image";
import type { ImageProps } from "next/image";

/**
 * OptimizedImage - Next.js Image with blur placeholder and lazy loading
 *
 * Performance features:
 * - Automatic WebP/AVIF conversion via Next.js
 * - Responsive srcset generation
 * - Blur placeholder during load
 * - Lazy loading by default
 * - Priority loading for above-the-fold images
 */

interface OptimizedImageProps extends Omit<ImageProps, "placeholder" | "blurDataURL"> {
  /** Enable blur placeholder (default: true) */
  enableBlur?: boolean;
  /** Custom blur data URL or 'auto' to generate from low-quality placeholder */
  blurDataURL?: string;
}

const DEFAULT_BLUR =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUE/8QAHhAAAgICAwEBAAAAAAAAAAAAAQMCEQASMSFR/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAYEQADAQEAAAAAAAAAAAAAAAAAATEh/9oADAMBAAIRAxEAPwCXJ5WPG4qTI5FpYooYmeSQoWKqB5JA8nQq5Xy3P5rO5G8yVvIyzTTyyySSOxLMzMSSSf5W6qKxZ//9k=";

export function OptimizedImage({
  src,
  alt,
  enableBlur = true,
  blurDataURL,
  priority = false,
  loading = priority ? undefined : "lazy",
  className,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <Image
      src={src}
      alt={alt}
      priority={priority}
      loading={loading}
      placeholder={enableBlur ? "blur" : undefined}
      blurDataURL={blurDataURL ?? DEFAULT_BLUR}
      className={`${className ?? ""} ${!isLoaded ? "opacity-90" : "opacity-100"} transition-opacity duration-300`}
      onLoad={() => setIsLoaded(true)}
      {...props}
    />
  );
}

/**
 * Avatar - Optimized user avatar with fallback
 */
interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: number;
  priority?: boolean;
}

export function Avatar({ src, alt, size = 40, priority = false }: AvatarProps) {
  const initials = alt
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-[var(--color-gene-green)] text-xs font-medium text-white"
        style={{ width: size, height: size }}
      >
        {initials}
      </div>
    );
  }

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className="rounded-full"
      style={{ objectFit: "cover" }}
    />
  );
}

/**
 * ResponsiveImage - Image with automatic srcset for different viewport sizes
 */
interface ResponsiveImageProps extends Omit<ImageProps, "srcSet"> {
  /** Image variants for different breakpoints */
  variants?: {
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
  };
}

export function ResponsiveImage({
  src,
  variants,
  alt,
  width,
  height,
  priority = false,
  ...props
}: ResponsiveImageProps) {
  // Use single src with variants as sizes hint
  if (variants) {
    return (
      <OptimizedImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={
          props.sizes ??
          `(min-width: 1280px) ${variants.xl ?? "100vw"}, (min-width: 1024px) ${variants.lg ?? "50vw"}, (min-width: 640px) ${variants.md ?? "100vw"}, ${variants.sm ?? "100vw"}`
        }
        {...props}
      />
    );
  }

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      {...props}
    />
  );
}
