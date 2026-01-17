/**
 * Icon Comparison Demo
 * Shows different icon libraries with truly distinct visual styles
 * to help you find something that stands out from the typical minimal outline icons
 */

import React from 'react';
import { COLOR_PRIMARY, COLOR_PRIMARY_LIGHT, COLOR_PASTEL_LAVENDER, COLOR_PASTEL_SKY } from '../lib/color-theme';

export function IconComparisonDemo() {
  return (
    <div className="p-8 space-y-12 bg-gradient-to-br from-[#FAF9FC] via-[#F9F7FD] to-[#F3F0F9]">
      <h1 className="text-3xl font-bold mb-8">Icon Library Comparison - Distinct Styles</h1>
      
      {/* Option 1: Bootstrap Icons - More Rounded, Friendly */}
      <section className="space-y-4 p-6 bg-white/50 rounded-lg border border-primary/10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-semibold">1. Bootstrap Icons</h2>
          <span className="text-sm text-muted-foreground">More rounded, friendly, filled options</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          <strong>Style:</strong> Rounded corners, friendly aesthetic, both outline and filled variants
          <br />
          <strong>Why Different:</strong> Softer, more approachable than typical minimal icons. Has filled versions that work great with pastel colors.
        </p>
        <div className="flex gap-6 items-center">
          <div className="text-center">
            <div className="text-xs mb-2">Outline</div>
            {/* Bootstrap Icons would be: <BootstrapIcons.Sparkles /> */}
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 16 16" style={{ color: COLOR_PRIMARY }}>
                <path d="M8 0a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V.5A.5.5 0 0 1 8 0zM4.567.27a.5.5 0 0 1 .67.2l1.146 2.293a.5.5 0 0 1-.268.69l-.793.448a.5.5 0 0 1-.67-.2L3.5 1.207a.5.5 0 0 1 .067-.937zM11.433.27a.5.5 0 0 1 .67.2l1.146 2.293a.5.5 0 0 1-.268.69l-.793.448a.5.5 0 0 1-.67-.2L10.5 1.207a.5.5 0 0 1 .933-.937z"/>
                <path d="M8 5.5a.5.5 0 0 1 .5.5v1.5a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm-2.352.855a.5.5 0 0 1 .185.68l-.5.874a.5.5 0 0 1-.37.17H4.82a.5.5 0 0 1-.37-.17l-.5-.874a.5.5 0 0 1 .185-.68l.41-.205a.5.5 0 0 1 .37 0l.41.205zm4.704 0a.5.5 0 0 1 .37 0l.41-.205a.5.5 0 0 1 .185.68l-.5.874a.5.5 0 0 1-.37.17h-1.998a.5.5 0 0 1-.37-.17l-.5-.874a.5.5 0 0 1 .185-.68l.41-.205a.5.5 0 0 1 .37 0z"/>
              </svg>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs mb-2">Filled</div>
            <div className="w-12 h-12 rounded-lg bg-purple-200 flex items-center justify-center">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 16 16" style={{ color: COLOR_PRIMARY }}>
                <path d="M8 0a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V.5A.5.5 0 0 1 8 0z" fill={COLOR_PRIMARY}/>
                <path d="M8 5.5a.5.5 0 0 1 .5.5v1.5a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5z" fill={COLOR_PRIMARY}/>
              </svg>
            </div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-purple-50 rounded text-sm">
          <strong>Install:</strong> <code className="bg-white px-2 py-1 rounded">npm install bootstrap-icons</code>
          <br />
          <strong>Usage:</strong> <code className="bg-white px-2 py-1 rounded">import { Sparkles } from 'bootstrap-icons/react'</code>
        </div>
      </section>

      {/* Option 2: Font Awesome - Solid/Filled Style */}
      <section className="space-y-4 p-6 bg-white/50 rounded-lg border border-primary/10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-semibold">2. Font Awesome</h2>
          <span className="text-sm text-muted-foreground">Solid, filled, more rounded</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          <strong>Style:</strong> Solid filled icons, more rounded corners, friendly and approachable
          <br />
          <strong>Why Different:</strong> Filled icons stand out more, work great with pastel backgrounds. Has duotone option for gradients!
        </p>
        <div className="flex gap-6 items-center">
          <div className="text-center">
            <div className="text-xs mb-2">Solid</div>
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 512 512" style={{ color: COLOR_PRIMARY }}>
                <path d="M499.99 176h-59.87l-16.64-41.6C406.38 91.63 365.57 64 319.5 64h-127c-46.06 0-86.88 27.63-103.99 70.4L71.87 176H12.01C4.2 176-1.53 183.34.37 190.91l6 24C7.7 220.25 12.5 224 17.99 224h18.26l-2.13 10.66C28.54 263.18 16 300.6 16 340v80c0 53.02 42.98 96 96 96h192c53.02 0 96-42.98 96-96v-80c0-39.4-12.54-76.82-33.12-105.34L383.75 224h18.26c5.5 0 10.29-3.75 11.62-9.09l6-24c1.89-7.57-3.84-14.91-11.65-14.91zm-352.06-17.83c7.29-18.22 24.94-30.17 44.57-30.17h127c19.63 0 37.28 11.95 44.57 30.17L384 208H128l19.93-49.83zM96 319.8c-19.2 0-32-12.76-32-31.9S76.8 256 96 256s48 28.71 48 47.85-28.8 15.95-48 15.95zm320 0c-19.2 0-48 3.19-48-15.95S396.8 256 416 256s32 12.76 32 31.9-12.8 31.9-32 31.9z"/>
              </svg>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs mb-2">Duotone</div>
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
              <svg className="w-8 h-8" viewBox="0 0 512 512">
                <path d="M499.99 176h-59.87l-16.64-41.6C406.38 91.63 365.57 64 319.5 64h-127c-46.06 0-86.88 27.63-103.99 70.4L71.87 176H12.01C4.2 176-1.53 183.34.37 190.91l6 24C7.7 220.25 12.5 224 17.99 224h18.26l-2.13 10.66C28.54 263.18 16 300.6 16 340v80c0 53.02 42.98 96 96 96h192c53.02 0 96-42.98 96-96v-80c0-39.4-12.54-76.82-33.12-105.34L383.75 224h18.26c5.5 0 10.29-3.75 11.62-9.09l6-24c1.89-7.57-3.84-14.91-11.65-14.91z" fill={COLOR_PRIMARY} opacity="0.4"/>
                <path d="M499.99 176h-59.87l-16.64-41.6C406.38 91.63 365.57 64 319.5 64h-127c-46.06 0-86.88 27.63-103.99 70.4L71.87 176H12.01C4.2 176-1.53 183.34.37 190.91l6 24C7.7 220.25 12.5 224 17.99 224h18.26l-2.13 10.66C28.54 263.18 16 300.6 16 340v80c0 53.02 42.98 96 96 96h192c53.02 0 96-42.98 96-96v-80c0-39.4-12.54-76.82-33.12-105.34L383.75 224h18.26c5.5 0 10.29-3.75 11.62-9.09l6-24c1.89-7.57-3.84-14.91-11.65-14.91z" fill={COLOR_PRIMARY_LIGHT}/>
              </svg>
            </div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-purple-50 rounded text-sm">
          <strong>Install:</strong> <code className="bg-white px-2 py-1 rounded">npm install @fortawesome/fontawesome-svg-core @fortawesome/free-solid-svg-icons @fortawesome/react-fontawesome</code>
          <br />
          <strong>Note:</strong> Free version available, or Pro for duotone styles
        </div>
      </section>

      {/* Option 3: Remix Icon - Filled Variants */}
      <section className="space-y-4 p-6 bg-white/50 rounded-lg border border-primary/10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-semibold">3. Remix Icon</h2>
          <span className="text-sm text-muted-foreground">Filled, rounded, friendly</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          <strong>Style:</strong> Both outline and filled variants, more rounded, friendly aesthetic
          <br />
          <strong>Why Different:</strong> Filled versions are more prominent, work great with pastel backgrounds. Good balance of modern and friendly.
        </p>
        <div className="mt-4 p-3 bg-purple-50 rounded text-sm">
          <strong>Install:</strong> <code className="bg-white px-2 py-1 rounded">npm install remixicon</code>
          <br />
          <strong>Usage:</strong> <code className="bg-white px-2 py-1 rounded">import { RiSparklingFill } from 'remixicon'</code>
        </div>
      </section>

      {/* Option 4: Material Icons Rounded */}
      <section className="space-y-4 p-6 bg-white/50 rounded-lg border border-primary/10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-semibold">4. Material Icons (Rounded Variant)</h2>
          <span className="text-sm text-muted-foreground">Softer, more rounded corners</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          <strong>Style:</strong> Rounded variant has softer corners, more friendly than standard Material icons
          <br />
          <strong>Why Different:</strong> The rounded variant is much softer and friendlier than typical outline icons. Works well with pastel themes.
        </p>
        <div className="mt-4 p-3 bg-purple-50 rounded text-sm">
          <strong>Install:</strong> <code className="bg-white px-2 py-1 rounded">npm install @mui/icons-material</code>
          <br />
          <strong>Usage:</strong> <code className="bg-white px-2 py-1 rounded">import { AutoAwesomeRounded } from '@mui/icons-material'</code>
        </div>
      </section>

      {/* Option 5: IconPark - Multi-color */}
      <section className="space-y-4 p-6 bg-white/50 rounded-lg border border-primary/10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-semibold">5. IconPark</h2>
          <span className="text-sm text-muted-foreground">Multi-color, two-tone, very customizable</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          <strong>Style:</strong> Four themes - outline, filled, two-tone, multi-color. Very customizable stroke, colors, etc.
          <br />
          <strong>Why Different:</strong> Multi-color and two-tone options are perfect for your gradient theme! Can create truly unique looks.
        </p>
        <div className="mt-4 p-3 bg-purple-50 rounded text-sm">
          <strong>Install:</strong> <code className="bg-white px-2 py-1 rounded">npm install @icon-park/react</code>
          <br />
          <strong>Usage:</strong> <code className="bg-white px-2 py-1 rounded">import { Sparkles } from '@icon-park/react'</code>
          <br />
          <strong>Theme:</strong> Can use <code className="bg-white px-2 py-1 rounded">theme="two-tone"</code> or <code className="bg-white px-2 py-1 rounded">theme="multi-color"</code>
        </div>
      </section>

      {/* Option 6: Hugeicons - Rounded Variants */}
      <section className="space-y-4 p-6 bg-white/50 rounded-lg border border-primary/10">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-semibold">6. Hugeicons</h2>
          <span className="text-sm text-muted-foreground">Rounded variants, massive collection</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          <strong>Style:</strong> Has rounded and sharp variants, filled and outline options. 46,000+ icons!
          <br />
          <strong>Why Different:</strong> Rounded variants are softer and friendlier. Massive collection means you'll find everything you need.
        </p>
        <div className="mt-4 p-3 bg-purple-50 rounded text-sm">
          <strong>Install:</strong> <code className="bg-white px-2 py-1 rounded">npm install hugeicons-react</code>
          <br />
          <strong>Usage:</strong> <code className="bg-white px-2 py-1 rounded">import { Sparkles01 } from 'hugeicons-react'</code>
          <br />
          <strong>Style:</strong> Can use <code className="bg-white px-2 py-1 rounded">variant="Rounded"</code> for softer look
        </div>
      </section>

      <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
        <h3 className="text-xl font-semibold mb-3">💡 My Top Recommendations for Your Pastel Theme:</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li><strong>IconPark</strong> - Multi-color and two-tone themes are perfect for your gradient aesthetic</li>
          <li><strong>Bootstrap Icons</strong> - More rounded and friendly, filled versions work great with pastels</li>
          <li><strong>Font Awesome (Duotone)</strong> - If you can use Pro, duotone is amazing for gradients</li>
          <li><strong>Hugeicons (Rounded)</strong> - Soft rounded variants, massive collection</li>
        </ol>
      </div>
    </div>
  );
}
