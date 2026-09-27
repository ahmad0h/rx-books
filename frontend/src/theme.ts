import type { ThemeConfig } from 'antd'

/** RxBooks brand colours (green from the PRD's document tokens, ink from the pilot apps). */
export const brand = {
  green: '#17A87C',
  ink: '#1F3328',
  paper: '#F7F5F0',
}

export const theme: ThemeConfig = {
  token: {
    colorPrimary: brand.green,
    colorLink: brand.green,
    borderRadius: 8,
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: {
      headerBg: brand.ink,
      bodyBg: brand.paper,
      footerBg: brand.paper,
    },
  },
}
