/**
 * Icon Demo Component
 * Demonstrates how Phosphor Icons work with the app's pastel color theme
 * This is a demo file to show icon options - can be removed after decision
 */

import React from 'react';
import { 
  Sparkles, 
  Calendar, 
  Settings, 
  CheckCircle,
  // Regular weight (default)
} from 'phosphor-react';
import {
  Sparkles as SparklesBold,
  Calendar as CalendarBold,
  Settings as SettingsBold,
  // Bold weight
} from 'phosphor-react';
import {
  Sparkles as SparklesDuotone,
  Calendar as CalendarDuotone,
  Settings as SettingsDuotone,
  // Duotone weight - perfect for gradients!
} from 'phosphor-react';
import { COLOR_PRIMARY, COLOR_PRIMARY_LIGHT, COLOR_PASTEL_LAVENDER, COLOR_PASTEL_SKY } from '../lib/color-theme';

export function IconDemo() {
  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-[#FAF9FC] via-[#F9F7FD] to-[#F3F0F9]">
      <h2 className="text-2xl font-bold mb-4">Phosphor Icons Demo with Your Theme</h2>
      
      {/* Regular Weight - Clean, minimal */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Regular Weight (Outline)</h3>
        <div className="flex gap-4 items-center">
          <Sparkles size={32} color={COLOR_PRIMARY} />
          <Calendar size={32} color={COLOR_PRIMARY} />
          <Settings size={32} color={COLOR_PRIMARY} />
          <CheckCircle size={32} color={COLOR_PRIMARY} />
        </div>
      </div>

      {/* Bold Weight - More prominent */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Bold Weight</h3>
        <div className="flex gap-4 items-center">
          <SparklesBold size={32} color={COLOR_PRIMARY} weight="bold" />
          <CalendarBold size={32} color={COLOR_PRIMARY} weight="bold" />
          <SettingsBold size={32} color={COLOR_PRIMARY} weight="bold" />
        </div>
      </div>

      {/* Duotone - Perfect for your gradient theme! */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Duotone (Great for Gradients!)</h3>
        <div className="flex gap-4 items-center">
          <SparklesDuotone 
            size={32} 
            color={COLOR_PRIMARY}
            weight="duotone"
            secondaryColor={COLOR_PRIMARY_LIGHT}
          />
          <CalendarDuotone 
            size={32} 
            color={COLOR_PRIMARY}
            weight="duotone"
            secondaryColor={COLOR_PASTEL_LAVENDER}
          />
          <SettingsDuotone 
            size={32} 
            color={COLOR_PRIMARY}
            weight="duotone"
            secondaryColor={COLOR_PASTEL_SKY}
          />
        </div>
      </div>

      {/* With Theme Colors */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">With Your Pastel Theme Colors</h3>
        <div className="flex gap-4 items-center">
          <Sparkles size={32} color={COLOR_PASTEL_LAVENDER} />
          <Calendar size={32} color={COLOR_PASTEL_SKY} />
          <Settings size={32} color={COLOR_PRIMARY_LIGHT} />
        </div>
      </div>

      {/* Size Variations */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Size Variations</h3>
        <div className="flex gap-4 items-center">
          <Sparkles size={16} color={COLOR_PRIMARY} />
          <Sparkles size={24} color={COLOR_PRIMARY} />
          <Sparkles size={32} color={COLOR_PRIMARY} />
          <Sparkles size={48} color={COLOR_PRIMARY} />
        </div>
      </div>
    </div>
  );
}
