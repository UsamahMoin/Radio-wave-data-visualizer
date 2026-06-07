# Project Style Guide

Use `style.css` as the visual base for future projects.

## Keep Projects Consistent

1. Copy the `:root` tokens, base styles, and reusable component sections.
2. Change theme values only in `:root`.
3. Reuse these classes before creating new ones:
   - `.shell` for the page container
   - `.panel` for primary content cards
   - `.panel-head` for card headings with actions
   - `.section-heading` and `.section-label` for section introductions
   - `.field` and `.help` for form fields
   - `.button`, `.button-primary`, and `.button-secondary` for actions
   - `.pill` for compact status labels
   - `.note` for highlighted information
   - `.grid-3` and `.cluster` for common layouts
4. Put project-only CSS below the `Page-specific layout` comment.

## Example

```html
<main class="shell">
  <section class="panel">
    <div class="panel-head">
      <div>
        <p class="section-label">Section label</p>
        <h2>Section title</h2>
        <p>Short supporting description.</p>
      </div>
      <button class="button button-primary">Action</button>
    </div>

    <div class="cluster">
      <span class="pill">Status</span>
      <span class="pill">Category</span>
    </div>

    <p class="note"><strong>Note:</strong> Important supporting information.</p>
  </section>
</main>
```

The main rule is to adjust design tokens instead of adding slightly different colors, spacing, shadows, or border radii for every new component.
