import { colors, radius, spacing, typography } from "./tokens"

export type UiTheme = {
  colors: typeof colors
  spacing: typeof spacing
  radius: typeof radius
  typography: typeof typography
}

export const darkTheme: UiTheme = {
  colors,
  spacing,
  radius,
  typography,
}
