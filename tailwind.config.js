/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        background: '#0f172a',   // Dark navy
        foreground: '#f8fafc',   // Light text

        primary: '#3b82f6',      // Tailwind blue-500 → for buttons/links
        secondary: '#64748b',    // Slate-500 → subtle accents
        border: '#1e293b',       // Slate-800 → borders, separators
        muted: '#94a3b8',        // Slate-400 → muted text
        destructive: '#ef4444',  // Red-500 → errors
        success: '#22c55e',      // Green-500 → success states
        warning: '#facc15',      // Yellow-400 → warnings
        info: '#0ea5e9',         // Sky-500 → highlights / info states
      },
    },
  },
  plugins: [],
};
