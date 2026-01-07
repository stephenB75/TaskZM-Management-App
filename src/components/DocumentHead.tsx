import { useEffect } from "react";
import appIcon from "../assets/app-icon.png";
import {
  APP_THEME_COLOR_PRIMARY,
  APP_TITLE,
  APP_DESCRIPTION,
} from "../lib/layout-constants";

export function DocumentHead() {
  useEffect(() => {
    // Set document title
    document.title = APP_TITLE;

    // Set favicon - remove all existing favicon links first, then add new ones
    const setFavicon = () => {
      // Remove all existing favicon links to prevent conflicts
      const existingFavicons = document.querySelectorAll("link[rel~='icon']");
      existingFavicons.forEach((link) => link.remove());
      
      // Use favicon.ico for the main favicon (smaller, optimized for browser tabs)
      // This prevents the icon from being too large and touching borders
      const faviconLink = document.createElement("link");
      faviconLink.rel = "icon";
      faviconLink.type = "image/x-icon";
      faviconLink.href = "/favicon.ico";
      document.head.appendChild(faviconLink);
      
      // Add PNG favicons with proper sizes for different use cases
      // Small size for browser tabs (16x16)
      const link16 = document.createElement("link");
      link16.rel = "icon";
      link16.type = "image/png";
      link16.sizes = "16x16";
      link16.href = "/icon-16.png";
      document.head.appendChild(link16);
      
      // Small size for browser tabs (32x32)
      const link32 = document.createElement("link");
      link32.rel = "icon";
      link32.type = "image/png";
      link32.sizes = "32x32";
      link32.href = "/icon-32.png";
      document.head.appendChild(link32);
      
      // Medium size for browser bookmarks
      const link192 = document.createElement("link");
      link192.rel = "icon";
      link192.type = "image/png";
      link192.sizes = "192x192";
      link192.href = "/icon-192.png";
      document.head.appendChild(link192);
      
      // Large size for PWA and high-DPI displays
      const link512 = document.createElement("link");
      link512.rel = "icon";
      link512.type = "image/png";
      link512.sizes = "512x512";
      link512.href = "/icon-512.png";
      document.head.appendChild(link512);
    };

    // Set apple-touch-icon
    const setAppleTouchIcon = () => {
      // Remove existing apple-touch-icon
      const existing = document.querySelector("link[rel='apple-touch-icon']");
      if (existing) {
        existing.remove();
      }
      
      // Use 180x180 icon for Apple devices (standard size)
      const link = document.createElement("link");
      link.rel = "apple-touch-icon";
      link.sizes = "180x180";
      link.href = "/icon-180.png";
      document.head.appendChild(link);
    };

    // Set iOS PWA title (for home screen label)
    const setAppleMobileWebAppTitle = () => {
      let meta: HTMLMetaElement | null = document.querySelector(
        "meta[name='apple-mobile-web-app-title']",
      );
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "apple-mobile-web-app-title";
        document.head.appendChild(meta);
      }
      meta.content = APP_TITLE;
    };

    // Set application name (for PWA install prompts on some browsers)
    const setApplicationName = () => {
      let meta: HTMLMetaElement | null = document.querySelector(
        "meta[name='application-name']",
      );
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "application-name";
        document.head.appendChild(meta);
      }
      meta.content = APP_TITLE;
    };

    // Set theme color
    const setThemeColor = () => {
      let meta: HTMLMetaElement | null = document.querySelector(
        "meta[name='theme-color']",
      );
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.appendChild(meta);
      }
      meta.content = APP_THEME_COLOR_PRIMARY;
    };

    // Set description meta tag
    const setDescription = () => {
      let meta: HTMLMetaElement | null = document.querySelector(
        "meta[name='description']",
      );
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
      }
      meta.content = APP_DESCRIPTION;
    };

    // Set Open Graph tags for social media
    const setOGTags = () => {
      const ogTags = [
        {
          property: "og:title",
          content: APP_TITLE,
        },
        {
          property: "og:description",
          content: APP_DESCRIPTION,
        },
        { property: "og:type", content: "website" },
        { property: "og:image", content: appIcon },
      ];

      ogTags.forEach(({ property, content }) => {
        let meta: HTMLMetaElement | null =
          document.querySelector(
            `meta[property='${property}']`,
          );
        if (!meta) {
          meta = document.createElement("meta");
          meta.setAttribute("property", property);
          document.head.appendChild(meta);
        }
        meta.content = content;
      });
    };

    setFavicon();
    setAppleTouchIcon();
    setThemeColor();
    setDescription();
    setAppleMobileWebAppTitle();
    setApplicationName();
    setOGTags();
  }, []);

  return null;
}