/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Accent (dourado) — reage ao body.light via CSS var
        acc: 'var(--acc)',
        acc2: 'var(--acc2)',
        acc3: 'var(--acc3)',
        'acc-bg': 'var(--acc-bg)',
        'acc-bg2': 'var(--acc-bg2)',
        // Backgrounds
        bg0: 'var(--bg0)',
        bg1: 'var(--bg1)',
        bg2: 'var(--bg2)',
        bg3: 'var(--bg3)',
        bg4: 'var(--bg4)',
        bg5: 'var(--bg5)',
        // Texto
        tx: 'var(--tx)',
        tx2: 'var(--tx2)',
        tx3: 'var(--tx3)',
        // Bordas
        brd: 'var(--brd)',
        brd2: 'var(--brd2)',
        // Semântico
        green: 'var(--green)',
        'green-bg': 'var(--green-bg)',
        red: 'var(--red)',
        'red-bg': 'var(--red-bg)',
        blue: 'var(--blue)',
        'blue-bg': 'var(--blue-bg)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
        quote: ['var(--font-quote)'],
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
      },
      keyframes: {
        blobfloat: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(18px, -14px) scale(1.04)' },
        },
        blobfloat2: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-14px, 12px) scale(1.06)' },
        },
      },
      animation: {
        blobfloat: 'blobfloat 18s ease-in-out infinite',
        blobfloat2: 'blobfloat2 22s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};