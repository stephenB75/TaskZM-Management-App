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
      
      // Use appIcon directly without cache busting to avoid service worker issues
      // The browser will handle caching appropriately
      const faviconUrl = appIcon;
      
      // Create new favicon link
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      link.href = faviconUrl;
      document.head.appendChild(link);
      
      // Also set sizes for better browser support
      const link192 = document.createElement("link");
      link192.rel = "icon";
      link192.type = "image/png";
      link192.sizes = "192x192";
      link192.href = faviconUrl;
      document.head.appendChild(link192);
      
      const link512 = document.createElement("link");
      link512.rel = "icon";
      link512.type = "image/png";
      link512.sizes = "512x512";
      link512.href = faviconUrl;
      document.head.appendChild(link512);
    };

    // Set apple-touch-icon
    const setAppleTouchIcon = () => {
      // Remove existing apple-touch-icon
      const existing = document.querySelector("link[rel='apple-touch-icon']");
      if (existing) {
        existing.remove();
      }
      
      // Use appIcon directly without cache busting to avoid service worker issues
      const iconUrl = appIcon;
      
      const link = document.createElement("link");
      link.rel = "apple-touch-icon";
      link.href = iconUrl;
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