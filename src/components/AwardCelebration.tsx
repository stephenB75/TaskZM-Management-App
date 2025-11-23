import React, { useEffect } from "react";
import { toast } from "sonner";
import { useAwards } from "../contexts/AwardContext";
import { useIsMobile } from "./ui/use-mobile";
import {
  Target,
  TrendingUp,
  Zap,
  Award as AwardIcon,
  Sparkles,
} from "lucide-react";

export function AwardCelebration() {
  const { celebrationQueue, dismissCelebration } = useAwards();
  const currentAward = celebrationQueue[0];
  const isMobile = useIsMobile();
  const processingRef = React.useRef(false);

  useEffect(() => {
    if (currentAward && !processingRef.current) {
      processingRef.current = true;

      const userHasInteracted = typeof navigator !== 'undefined' && !!(navigator as any).userActivation?.hasBeenActive;

      // Play gentle success chime sound (Web Audio API)
      // Only play if AudioContext state is allowed (requires user interaction)
      if (userHasInteracted) {
        (async () => {
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) {
              throw new Error('AudioContext not supported');
            }
            
            const audioContext = new AudioContextClass();
            
            // Resume AudioContext if suspended (required after user interaction)
            if (audioContext.state === 'suspended') {
              try {
                await audioContext.resume();
              } catch {
                throw new Error('AudioContext resume rejected');
              }
            }
            
            // Only proceed if context is running
            if (audioContext.state !== 'running') {
              throw new Error('AudioContext not running');
            }
            
            const now = audioContext.currentTime;

            // Create gentle ascending notes (C5, E5, G5) - a pleasant success chime
            const frequencies = [523.25, 659.25, 783.99];
            frequencies.forEach((freq, i) => {
              try {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = freq;
                oscillator.type = "sine"; // Soft, pleasant tone

                // Gentle envelope for smooth sound
                const startTime = now + i * 0.1;
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(
                  0.12,
                  startTime + 0.02,
                );
                gainNode.gain.exponentialRampToValueAtTime(
                  0.01,
                  startTime + 0.3,
                );

                oscillator.start(startTime);
                oscillator.stop(startTime + 0.3);
              } catch (oscError) {
                // Ignore individual oscillator errors
              }
            });
          } catch (error) {
            // Silently ignore audio errors (browser may not support or user denied permissions)
            // This prevents console warnings when AudioContext cannot be created
          }
        })();
      }

      // Show subtle toast notification
      showAwardToast(currentAward);

      // Dismiss after 5 seconds and process next award in queue
      const timer = setTimeout(() => {
        dismissCelebration();
        // Reset processing flag after a short delay to allow next award to show
        setTimeout(() => {
          processingRef.current = false;
        }, 200);
      }, 5000);

      return () => {
        clearTimeout(timer);
        processingRef.current = false;
      };
    } else if (!currentAward) {
      // Reset processing flag when queue is empty
      processingRef.current = false;
    }
  }, [currentAward, dismissCelebration]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "completion":
        return Target;
      case "streak":
        return TrendingUp;
      case "focus":
        return Zap;
      case "special":
      case "speed":
        return Sparkles;
      default:
        return AwardIcon;
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return "rgb(245, 158, 11)"; // amber-500
      case "epic":
        return "rgb(168, 85, 247)"; // purple-500
      case "rare":
        return "rgb(59, 130, 246)"; // blue-500
      default:
        return "rgb(100, 116, 139)"; // slate-500
    }
  };

  const showAwardToast = (award: any) => {
    const Icon = getCategoryIcon(award.category);
    const color = getRarityColor(award.rarity);

    toast.custom(
      (t) => (
        <div
          className="w-full max-w-sm bg-white dark:bg-card rounded-2xl shadow-xl border border-gray-200 dark:border-border overflow-hidden"
          style={{
            boxShadow: `0 4px 20px ${color}20`,
          }}
        >
          <div className="relative p-4">
            {/* Subtle gradient background */}
            <div
              className="absolute inset-0 opacity-5"
              style={{
                background: `linear-gradient(135deg, ${color} 0%, transparent 100%)`,
              }}
            />

            {/* Content */}
            <div className="relative flex items-start gap-3">
              {/* Icon */}
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: `${color}15`,
                }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-60">
                    Achievement
                  </span>
                  <span
                    className="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `${color}20`,
                      color,
                    }}
                  >
                    {award.rarity}
                  </span>
                </div>
                <div className="font-semibold text-gray-900 dark:text-white mb-0.5">
                  {award.name}
                </div>
                <div className="text-sm text-gray-600 dark:text-muted-foreground">
                  {award.description}
                </div>
              </div>
            </div>
          </div>

          {/* Subtle bottom accent */}
          <div
            className="h-1"
            style={{
              background: `linear-gradient(90deg, ${color} 0%, transparent 100%)`,
              opacity: 0.3,
            }}
          />
        </div>
      ),
      {
        duration: 5000,
        position: isMobile ? "top-center" : "bottom-right",
      },
    );
  };

  return null;
}