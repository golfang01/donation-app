export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#0A0D12',
        panel: '#131820',
        'panel-raised': '#1B2230',
        signal: '#38E1C6',
        live: '#FF3B5C',
        gold: '#FFB627',
        ink: '#EDEFF2',
        'ink-muted': '#7C8696',
      },
      fontFamily: {
        display: ['"Oswald"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};