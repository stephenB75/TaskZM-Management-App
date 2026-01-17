/**
 * Phosphor Icons Duotone Demo
 * Shows how Phosphor Icons work with duotone style and your theme colors
 */

import React from 'react';
import { Icon } from './Icon';
import { COLOR_PRIMARY, COLOR_PRIMARY_LIGHT, COLOR_PASTEL_LAVENDER, COLOR_PASTEL_SKY } from '../lib/color-theme';

export function PhosphorIconDemo() {
  return (
    <div className="p-8 space-y-8 bg-gradient-to-br from-[#FAF9FC] via-[#F9F7FD] to-[#F3F0F9]">
      <h2 className="text-2xl font-bold mb-4">Phosphor Icons Duotone with Your Theme</h2>
      
      {/* Duotone Examples */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Duotone Icons (Auto-enabled for special icons)</h3>
        <div className="flex gap-6 items-center flex-wrap">
          <div className="text-center">
            <Icon name="sparkles" size={32} />
            <div className="text-xs mt-2">Sparkles</div>
          </div>
          <div className="text-center">
            <Icon name="brain" size={32} />
            <div className="text-xs mt-2">Brain</div>
          </div>
          <div className="text-center">
            <Icon name="target" size={32} />
            <div className="text-xs mt-2">Target</div>
          </div>
          <div className="text-center">
            <Icon name="calendar" size={32} />
            <div className="text-xs mt-2">Calendar</div>
          </div>
          <div className="text-center">
            <Icon name="check-circle" size={32} />
            <div className="text-xs mt-2">Check Circle</div>
          </div>
        </div>
      </div>

      {/* Custom Duotone Colors */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Custom Duotone Colors</h3>
        <div className="flex gap-6 items-center flex-wrap">
          <div className="text-center">
            <Icon 
              name="sparkles" 
              size={32} 
              weight="duotone"
              color={COLOR_PRIMARY}
              secondaryColor={COLOR_PASTEL_LAVENDER}
            />
            <div className="text-xs mt-2">Purple + Lavender</div>
          </div>
          <div className="text-center">
            <Icon 
              name="calendar" 
              size={32} 
              weight="duotone"
              color={COLOR_PRIMARY}
              secondaryColor={COLOR_PASTEL_SKY}
            />
            <div className="text-xs mt-2">Purple + Sky</div>
          </div>
          <div className="text-center">
            <Icon 
              name="target" 
              size={32} 
              weight="duotone"
              color={COLOR_PASTEL_LAVENDER}
              secondaryColor={COLOR_PRIMARY_LIGHT}
            />
            <div className="text-xs mt-2">Lavender + Light</div>
          </div>
        </div>
      </div>

      {/* Other Weights */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Other Weights</h3>
        <div className="flex gap-6 items-center flex-wrap">
          <div className="text-center">
            <Icon name="settings" size={32} weight="regular" />
            <div className="text-xs mt-2">Regular</div>
          </div>
          <div className="text-center">
            <Icon name="settings" size={32} weight="bold" />
            <div className="text-xs mt-2">Bold</div>
          </div>
          <div className="text-center">
            <Icon name="settings" size={32} weight="fill" />
            <div className="text-xs mt-2">Fill</div>
          </div>
          <div className="text-center">
            <Icon name="settings" size={32} weight="light" />
            <div className="text-xs mt-2">Light</div>
          </div>
        </div>
      </div>

      {/* Size Variations */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Size Variations</h3>
        <div className="flex gap-6 items-center flex-wrap">
          <div className="text-center">
            <Icon name="sparkles" size={16} weight="duotone" />
            <div className="text-xs mt-2">16px</div>
          </div>
          <div className="text-center">
            <Icon name="sparkles" size={24} weight="duotone" />
            <div className="text-xs mt-2">24px</div>
          </div>
          <div className="text-center">
            <Icon name="sparkles" size={32} weight="duotone" />
            <div className="text-xs mt-2">32px</div>
          </div>
          <div className="text-center">
            <Icon name="sparkles" size={48} weight="duotone" />
            <div className="text-xs mt-2">48px</div>
          </div>
        </div>
      </div>

      {/* Usage Examples */}
      <div className="mt-8 p-6 bg-white/50 rounded-lg border border-primary/10">
        <h3 className="text-lg font-semibold mb-3">Usage Examples</h3>
        <pre className="text-sm bg-gray-100 p-4 rounded overflow-x-auto">
{`// Basic usage - duotone auto-enabled for special icons
<Icon name="sparkles" size={24} />

// Explicit duotone with custom colors
<Icon 
  name="calendar" 
  size={32} 
  weight="duotone"
  color="#9B87E8"
  secondaryColor="#D4C5F9"
/>

// Regular weight (no duotone)
<Icon name="settings" size={24} weight="regular" />

// Using theme colors
import { COLOR_PRIMARY, COLOR_PRIMARY_LIGHT } from '../lib/color-theme';
<Icon 
  name="target" 
  weight="duotone"
  color={COLOR_PRIMARY}
  secondaryColor={COLOR_PRIMARY_LIGHT}
/>`}
        </pre>
      </div>
    </div>
  );
}
