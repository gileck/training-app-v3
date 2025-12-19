# iOS-Inspired UI Guidelines Examples

This folder contains practical HTML and CSS examples demonstrating the iOS-inspired UI design guidelines. These examples showcase modern, colorful, and fun design patterns suitable for iOS mobile apps.

## 📁 File Structure

```
ui-guidelines-example/
├── index.html          # Main showcase page with all components
├── forms.html          # Form components and validation examples
├── design-tokens.json  # Design system tokens for cross-platform use
├── styles/
│   ├── main.css        # Base styles, variables, and layout
│   ├── components.css  # Button, card, list, and interactive components
│   └── forms.css       # Form-specific styles and validation states
└── README.md          # This documentation
```

## 🎨 What's Included

### Main Components (`index.html`)
- **Color Palette**: Complete iOS-inspired color system
- **Typography Scale**: Responsive type hierarchy (H1-H3, body, caption, small)
- **Button Variants**: Primary, secondary, outline, and text buttons in multiple sizes
- **Cards & Containers**: Basic, elevated, and gradient cards with proper spacing
- **Image Cards**: Cards with images, overlay badges, metadata, and action buttons
- **Lists & Data Display**: iOS-style settings lists with icons and actions
- **Enhanced Lists**: Lists with avatars, thumbnails, metadata, and multiple actions
- **Grid Layout**: Responsive grid system examples
- **Navigation**: Sticky header with blur background effect

### Form Components (`forms.html`)
- **Input Fields**: Text, email, telephone, textarea inputs with enhanced focus states
- **Validation States**: Success, error, warning, and disabled states with ARIA support
- **Custom Controls**: Radio buttons, checkboxes, toggle switches with keyboard navigation
- **File Upload**: Drag-and-drop file upload component with accessibility features
- **Range Slider**: Custom-styled range input with value display and ARIA labels
- **Search & Filters**: Search box with filter chips and RTL support
- **Form Layout**: Proper spacing, labels, hints, and action buttons with enhanced accessibility

### Design Tokens (`design-tokens.json`)
- **Cross-Platform**: JSON structure for React Native, SwiftUI, and other platforms
- **Semantic Naming**: Consistent token naming across all design elements
- **Theme Support**: Light and dark mode values for all color tokens
- **Type Safety**: Structured format with descriptions and type definitions

## 🎯 Key Features

### Design System
- **8px Base Unit System**: Consistent spacing using CSS custom properties following iOS 4pt multiples
- **Dynamic Color System**: iOS semantic colors that adapt to system preferences with auto-detection
- **iOS Color Palette**: Primary (#007AFF), Secondary (#5856D6), Success (#34C759), Warning (#FF9500), Error (#FF3B30)
- **System Fonts**: Uses `-apple-system, BlinkMacSystemFont` font stack with proper weight mapping
- **Responsive Design**: Mobile-first approach with proper breakpoints (tested for iPhone 15 Pro Max landscape)
- **Dark Mode Support**: Automatic color scheme adaptation with optimized shadows

### Interactive Elements
- **Smart Animations**: iOS-style spring animations that adapt to device capabilities (hover vs touch)
- **Touch-Optimized**: 44px minimum touch targets following iOS HIG with scale feedback on touch devices
- **Focus States**: Enhanced accessibility with visible focus indicators and VoiceOver rotor support
- **Device-Aware Interactions**: Hover effects only on pointer devices, touch feedback on mobile
- **Performance-Optimized**: Subtle transforms and ultra-soft iOS shadows
- **Loading States**: Animated spinners and proper disabled states with utility classes
- **Card Interactions**: Image zoom on hover (1.05x), overlay badges, action hierarchies
- **List Enhancements**: Avatar/thumbnail displays, metadata organization, action buttons
- **Haptic Feedback**: Ready for PWA/native integration with tactile feedback patterns

### Enhanced Features (New in v2)
- **State Utilities**: Consistent state management with `.is-loading`, `.is-disabled`, `.is-active` classes
- **RTL Support**: Complete right-to-left language support with logical properties and icon mirroring
- **Performance Features**: Content visibility optimization for heavy components and image loading strategies
- **Dark Mode Images**: Automatic image treatment with brightness filters and mix-blend-mode
- **Keyboard Shortcuts**: iPad-first approach with ⌘ + number shortcuts for navigation
- **Motion Tokens**: Standardized animation durations and iOS-style spring curves
- **Enhanced Focus**: Visible focus indicators that adapt to keyboard vs mouse navigation

### Accessibility
- **Semantic HTML**: Proper use of labels, headings, landmarks, and ARIA attributes
- **Keyboard Navigation**: Full keyboard accessibility support with focus trapping
- **Color Contrast**: WCAG AA compliant contrast ratios (4.5:1 text, 3:1 non-text)
- **Reduced Motion**: Respects `prefers-reduced-motion` with opacity fallbacks
- **Screen Reader Friendly**: VoiceOver rotor support with proper landmark regions
- **Internationalization**: RTL support with logical properties and icon mirroring

## 🚀 How to Use

1. **View Examples**: Open `index.html` in a web browser to see all components
2. **Explore Forms**: Check `forms.html` for comprehensive form examples
3. **Copy Styles**: Use the CSS from `styles/` folder as a foundation for your projects
4. **Use Design Tokens**: Import `design-tokens.json` for cross-platform consistency (React Native, SwiftUI)
5. **Customize Colors**: Modify CSS custom properties in `main.css` to match your brand
6. **Responsive Testing**: Resize browser or use developer tools to test responsive behavior

## 📱 Mobile Optimization

- **Touch Targets**: All interactive elements meet iOS minimum size requirements (44px minimum)
- **Safe Areas**: CSS `env()` support for iPhone notch and home indicator on all fixed elements
- **Responsive Typography**: Uses `clamp()` for fluid font scaling with iOS Dynamic Type mapping
- **Mobile Navigation**: Bottom navigation patterns for mobile devices with proper landscape handling
- **Gesture Support**: Swipe actions and touch-friendly interactions with haptic feedback ready
- **Performance**: Content visibility optimization and backdrop-filter performance considerations

## 🎨 Customization

### Colors
Modify the CSS custom properties in `main.css`:
```css
:root {
  --color-primary: #007AFF;    /* Your primary brand color */
  --color-secondary: #5856D6;  /* Your secondary color */
  
  /* iOS Detection Override */
  @supports (-webkit-touch-callout: none) {
    --color-primary: var(--ios-system-blue, #007AFF);
  }
  /* ... other colors */
}
```

### Spacing
Adjust the spacing scale:
```css
:root {
  --spacing-xs: 4px;   /* 0.5 units */
  --spacing-sm: 8px;   /* 1 unit */
  --spacing-md: 16px;  /* 2 units */
  /* ... other spacing values */
}
```

### Typography
Customize the type scale:
```css
:root {
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  /* ... other font sizes */
}
```

## 💡 Best Practices

1. **Consistent Spacing**: Always use the defined spacing variables (8px multiples)
2. **Color Usage**: Follow the 60-30-10 rule for color distribution with dynamic system colors
3. **Typography**: Maintain proper heading hierarchy (H1 → H2 → H3) with iOS Dynamic Type mapping
4. **Interactive Feedback**: Provide device-appropriate feedback (hover vs touch)
5. **Loading States**: Always include loading and error states with utility classes
6. **Form Validation**: Use proper validation messages and visual indicators
7. **Accessibility**: Test with VoiceOver and keyboard navigation
8. **Performance**: Use content-visibility for heavy components and optimize images
9. **Internationalization**: Test with RTL layouts and longer text content
10. **Dark Mode**: Provide appropriate image treatments and shadow adjustments

## 🔗 Related Guidelines

This implementation follows the guidelines defined in:
- `.cursor/rules/ui-design-guidelines.mdc` - Complete UI design system documentation with advanced implementation guidelines
- iOS Human Interface Guidelines (HIG) - Dynamic system colors and interaction patterns
- Web Content Accessibility Guidelines (WCAG) - AA compliance with enhanced VoiceOver support
- Modern CSS best practices - Performance optimization and internationalization support

## 📄 License

These examples are provided as reference material for implementing iOS-inspired design systems in web applications. Feel free to use and modify for your projects. 