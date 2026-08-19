import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import 'vuetify/styles'

// mdi-svg iconset's built-in aliases are missing some internal Vuetify icons
// (e.g. circle-small used by VSwitch/VCheckbox on-state indicator).
// Without these, Vuetify tries to parse the icon NAME as an SVG path and throws
// "Problem parsing d=\"mdi-circle-small\"". Merge the missing aliases here.
const customAliases = {
  ...aliases,
  // MDI circle-small path (VSwitch/VCheckbox on-state dot)
  circleSmall: 'svg:M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10Z',
  'circle-small': 'svg:M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10Z',
}

export default createVuetify({
  icons: {
    defaultSet: 'mdi',
    aliases: customAliases,
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          // Tinted neutrals (no pure #000/#fff): subtle cool for e-ink/paper feel
          primary: '#17181a',
          secondary: '#5c5d62',
          surface: '#f5f6f7',
          background: '#fafbfc',
          error: '#b00020',
          warning: '#e65100',
          info: '#424242',
          success: '#2e7d32',
        },
      },
      dark: {
        dark: true,
        colors: {
          primary: '#e2e3e6',
          secondary: '#9a9ca2',
          surface: '#1c1d21',
          background: '#121318',
          error: '#cf6679',
          warning: '#ffb74d',
          info: '#90a4ae',
          success: '#81c784',
        },
      },
    },
  },
})
