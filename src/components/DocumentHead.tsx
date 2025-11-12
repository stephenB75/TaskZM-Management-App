import { useEffect } from "react";
import appIcon from "../assets/app-icon.png";

export function DocumentHead() {
  useEffect(() => {
    // Set document title
    document.title =
      "TaskZM - Neurodivergent-Friendly Task Management";

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
      meta.content = "#9B87E8"; // TaskZM purple/lavender
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
      meta.content =
        "TaskZM: A comprehensive neurodivergent-friendly task management application with AI-assisted planning, calendar integration, and analytics.";
    };

    // Set Open Graph tags for social media
    const setOGTags = () => {
      const ogTags = [
        {
          property: "og:title",
          content:
            "TaskZM - Neurodivergent-Friendly Task Management",
        },
        {
          property: "og:description",
          content:
            "A comprehensive neurodivergent-friendly task management application with AI-assisted planning, calendar integration, and analytics.",
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
    setOGTags();
  }, []);

  return null;
}