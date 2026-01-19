/**
 * Enhanced Phosphor Duotone Examples
 * Shows various duotone combinations with your theme colors
 */

import React from 'react';
import { Icon } from './Icon';
import { cn } from '../lib/utils';
import { 
  COLOR_PRIMARY, 
  COLOR_PRIMARY_LIGHT, 
  COLOR_PRIMARY_DARK,
  COLOR_PASTEL_LAVENDER, 
  COLOR_PASTEL_SKY,
  COLOR_PASTEL_MINT,
  COLOR_GRADIENT_START,
  COLOR_GRADIENT_MID,
  COLOR_GRADIENT_END,
} from '../lib/color-theme';
import { ICON_SIZE_MD, ICON_SIZE_XL, ICON_SIZE_2XL, ICON_SIZE_3XL, ICON_SIZE_4XL } from '../lib/layout-constants';
import { UI_GRADIENT_COLORS } from '../lib/ui-colors';

export function PhosphorDuotoneExamples() {
  return (
    <div className={cn("p-8 space-y-12", UI_GRADIENT_COLORS.dialog.className)}>
      <h1 className="text-3xl font-bold mb-8">Phosphor Duotone Examples with Your Theme</h1>
      
      {/* Primary Theme Colors */}
      <section className="space-y-4 p-6 bg-white/50 rounded-lg border border-primary/10">
        <h2 className="text-xl font-semibold">Primary Theme Colors</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <Icon 
              name="sparkles" 
              size={ICON_SIZE_2XL} 
              weight="duotone"
              color={COLOR_PRIMARY}
              secondaryColor={COLOR_PRIMARY_LIGHT}
            />
            <div className="text-xs mt-2">Primary + Light</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {COLOR_PRIMARY} + {COLOR_PRIMARY_LIGHT}
            </div>
          </div>
          <div className="text-center">
            <Icon 
              name="brain" 
              size={ICON_SIZE_2XL} 
              weight="duotone"
              color={COLOR_PRIMARY_DARK}
              secondaryColor={COLOR_PRIMARY}
            />
            <div className="text-xs mt-2">Dark + Primary</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {COLOR_PRIMARY_DARK} + {COLOR_PRIMARY}
            </div>
          </div>
          <div className="text-center">
            <Icon 
              name="target" 
              size={ICON_SIZE_2XL} 
              weight="duotone"
              color={COLOR_PRIMARY}
              secondaryColor={COLOR_PASTEL_LAVENDER}
            />
            <div className="text-xs mt-2">Primary + Lavender</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {COLOR_PRIMARY} + {COLOR_PASTEL_LAVENDER}
            </div>
          </div>
          <div className="text-center">
            <Icon 
              name="calendar" 
              size={ICON_SIZE_2XL} 
              weight="duotone"
              color={COLOR_PRIMARY}
              secondaryColor={COLOR_PASTEL_SKY}
            />
            <div className="text-xs mt-2">Primary + Sky</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {COLOR_PRIMARY} + {COLOR_PASTEL_SKY}
            </div>
          </div>
        </div>
      </section>

      {/* Gradient Colors */}
      <section className="space-y-4 p-6 bg-white/50 rounded-lg border border-primary/10">
        <h2 className="text-xl font-semibold">Gradient Theme Colors</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div className="text-center">
            <Icon 
              name="sparkles" 
              size={ICON_SIZE_2XL} 
              weight="duotone"
              color={COLOR_GRADIENT_START}
              secondaryColor={COLOR_GRADIENT_MID}
            />
            <div className="text-xs mt-2">Start + Mid</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Purple → Sky
            </div>
          </div>
          <div className="text-center">
            <Icon 
              name="brain" 
              size={ICON_SIZE_2XL} 
              weight="duotone"
              color={COLOR_GRADIENT_MID}
              secondaryColor={COLOR_GRADIENT_END}
            />
            <div className="text-xs mt-2">Mid + End</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Sky → Mint
            </div>
          </div>
          <div className="text-center">
            <Icon 
              name="target" 
              size={ICON_SIZE_2XL} 
              weight="duotone"
              color={COLOR_GRADIENT_START}
              secondaryColor={COLOR_GRADIENT_END}
            />
            <div className="text-xs mt-2">Start + End</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Purple → Mint
            </div>
          </div>
        </div>
      </section>

      {/* Pastel Combinations */}
      <section className="space-y-4 p-6 bg-white/50 rounded-lg border border-primary/10">
        <h2 className="text-xl font-semibold">Pastel Combinations</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <Icon 
              name="calendar" 
              size={ICON_SIZE_2XL} 
              weight="duotone"
              color={COLOR_PASTEL_LAVENDER}
              secondaryColor={COLOR_PASTEL_SKY}
            />
            <div className="text-xs mt-2">Lavender + Sky</div>
          </div>
          <div className="text-center">
            <Icon 
              name="check-circle" 
              size={ICON_SIZE_2XL} 
              weight="duotone"
              color={COLOR_PASTEL_SKY}
              secondaryColor={COLOR_PASTEL_MINT}
            />
            <div className="text-xs mt-2">Sky + Mint</div>
          </div>
          <div className="text-center">
            <Icon 
              name="brain" 
              size={ICON_SIZE_2XL} 
              weight="duotone"
              color={COLOR_PASTEL_LAVENDER}
              secondaryColor={COLOR_PASTEL_MINT}
            />
            <div className="text-xs mt-2">Lavender + Mint</div>
          </div>
          <div className="text-center">
            <Icon 
              name="target" 
              size={ICON_SIZE_2XL} 
              weight="duotone"
              color={COLOR_PRIMARY_LIGHT}
              secondaryColor={COLOR_PASTEL_LAVENDER}
            />
            <div className="text-xs mt-2">Light + Lavender</div>
          </div>
        </div>
      </section>

      {/* Auto Duotone Icons */}
      <section className="space-y-4 p-6 bg-white/50 rounded-lg border border-primary/10">
        <h2 className="text-xl font-semibold">Auto Duotone Icons (Default Theme Colors)</h2>
        <p className="text-sm text-muted-foreground mb-4">
          These icons automatically use duotone with your theme colors
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
          <div className="text-center">
            <Icon name="sparkles" size={ICON_SIZE_2XL} />
            <div className="text-xs mt-2">Sparkles</div>
          </div>
          <div className="text-center">
            <Icon name="brain" size={ICON_SIZE_2XL} />
            <div className="text-xs mt-2">Brain</div>
          </div>
          <div className="text-center">
            <Icon name="target" size={ICON_SIZE_2XL} />
            <div className="text-xs mt-2">Target</div>
          </div>
          <div className="text-center">
            <Icon name="calendar" size={ICON_SIZE_2XL} />
            <div className="text-xs mt-2">Calendar</div>
          </div>
          <div className="text-center">
            <Icon name="calendar-days" size={ICON_SIZE_2XL} />
            <div className="text-xs mt-2">Calendar Days</div>
          </div>
          <div className="text-center">
            <Icon name="check-circle" size={ICON_SIZE_2XL} />
            <div className="text-xs mt-2">Check Circle</div>
          </div>
        </div>
      </section>

      {/* Size Variations with Duotone */}
      <section className="space-y-4 p-6 bg-white/50 rounded-lg border border-primary/10">
        <h2 className="text-xl font-semibold">Size Variations with Duotone</h2>
        <div className="flex gap-6 items-center flex-wrap">
          <div className="text-center">
            <Icon 
              name="sparkles" 
              size={ICON_SIZE_MD} 
              weight="duotone"
              color={COLOR_PRIMARY}
              secondaryColor={COLOR_PRIMARY_LIGHT}
            />
            <div className="text-xs mt-2">16px</div>
          </div>
          <div className="text-center">
            <Icon 
              name="sparkles" 
              size={ICON_SIZE_XL} 
              weight="duotone"
              color={COLOR_PRIMARY}
              secondaryColor={COLOR_PRIMARY_LIGHT}
            />
            <div className="text-xs mt-2">24px</div>
          </div>
          <div className="text-center">
            <Icon 
              name="sparkles" 
              size={ICON_SIZE_2XL} 
              weight="duotone"
              color={COLOR_PRIMARY}
              secondaryColor={COLOR_PRIMARY_LIGHT}
            />
            <div className="text-xs mt-2">32px</div>
          </div>
          <div className="text-center">
            <Icon 
              name="sparkles" 
              size={ICON_SIZE_3XL} 
              weight="duotone"
              color={COLOR_PRIMARY}
              secondaryColor={COLOR_PRIMARY_LIGHT}
            />
            <div className="text-xs mt-2">48px</div>
          </div>
          <div className="text-center">
            <Icon 
              name="sparkles" 
              size={ICON_SIZE_4XL} 
              weight="duotone"
              color={COLOR_PRIMARY}
              secondaryColor={COLOR_PRIMARY_LIGHT}
            />
            <div className="text-xs mt-2">64px</div>
          </div>
        </div>
      </section>

      {/* Usage Examples */}
      <section className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
        <h2 className="text-xl font-semibold mb-4">Code Examples</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">Auto Duotone (Recommended)</h3>
            <pre className="text-xs bg-white p-3 rounded overflow-x-auto">
{`// Auto duotone with theme colors
<Icon name="sparkles" size={ICON_SIZE_XL} />

// Explicit duotone with custom colors
<Icon 
  name="calendar" 
  size={ICON_SIZE_2XL} 
  weight="duotone"
  color={COLOR_PRIMARY}
  secondaryColor={COLOR_PRIMARY_LIGHT}
/>`}
            </pre>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Gradient Theme Colors</h3>
            <pre className="text-xs bg-white p-3 rounded overflow-x-auto">
{`// Using gradient colors
<Icon 
  name="target" 
  weight="duotone"
  color={COLOR_GRADIENT_START}  // #9B87E8
  secondaryColor={COLOR_GRADIENT_END}  // #B8E6D5
/>

// Pastel combination
<Icon 
  name="brain" 
  weight="duotone"
  color={COLOR_PASTEL_LAVENDER}  // #E6D5F0
  secondaryColor={COLOR_PASTEL_SKY}  // #C9E4F7
/>`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
