<p align="center">
  <img src="child_table_preview/public/images/logo.png" alt="Child Table Preview Logo" width="140" height="140" style="border-radius: 28px;" />
</p>

# Child Table Hover Preview for Frappe & ERPNext

> **Instant, searchable hover previews for ERPNext and Frappe child tables — eliminating the need for constant horizontal scrolling.**

---

## ✨ Features

- **⚡ Instant Hover Previews**: Hover over any child table row (e.g. Sales Invoice Item, Sales Order Item, Purchase Order Item) to instantly view all key fields in a clean floating popover.
- **🔍 Real-Time Keyboard Search**: Resting your mouse on any table row automatically activates the search bar — start typing immediately to search across all fields, labels, and values without clicking.
- **🖼️ 50×50px Thumbnail Renderer**: Automatically detects image fields (`Attach Image`, `Attach`, image URLs) and renders neat, compact thumbnails with zoom-on-click support.
- **📱 Touch & Mobile Guard**: Automatically disables hover popups on mobile devices and coarse touchscreens, preserving native touch-to-edit behavior.
- **🛡️ Field Permission Filtering**: Respects Frappe's field-level permissions (`permlevel > 0`), ensuring users never see fields they aren't authorized to view.
- **📐 Smart Viewport Positioning**: Automatically calculates available screen space on all four sides. If a table spans edge-to-edge, the preview intelligently floats above or below the row instead of covering row data.
- **🎨 Native Frappe Theming**: Utilizes standard Frappe CSS variables with complete fallbacks (`--card-bg`, `--border-color`, `--text-muted`), rendering seamlessly across Frappe Light Mode, Dark Mode, and custom themes.
- **🚀 Out-of-the-Box ERPNext Defaults**: Ships with pre-configured rules for standard ERPNext child tables (Sales Order, Sales Invoice, Purchase Order, Quotation, Delivery Note, Purchase Receipt, BOM, Stock Entry).

---

## 📦 Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/Thomaskv1999/child_table_preview
bench --site [your-site-name] install-app child_table_preview
bench --site [your-site-name] clear-cache
```

---

## ⚙️ Configuration

1. In Frappe Desk, search for **Child Table Preview Settings** in the Awesomebar.
2. Enable the feature toggle: **Enable Hover Preview**.
3. Click **Load Standard Defaults** to automatically populate rules for all standard ERPNext tables on your site.
4. To customize fields for any child table:
   - Click **Select Fields** on the rule row.
   - Use the live search and multiselect checkboxes to choose exactly which fields to show.
   - Save the settings. All connected browser tabs refresh their rules in real time.

---

## 🛠️ Supported Child Tables (Out of the Box)

- **Sales Order Item** (`Sales Order`)
- **Sales Invoice Item** (`Sales Invoice`)
- **Purchase Order Item** (`Purchase Order`)
- **Quotation Item** (`Quotation`)
- **Delivery Note Item** (`Delivery Note`)
- **Purchase Receipt Item** (`Purchase Receipt`)
- **BOM Item** (`BOM`)
- **Stock Entry Detail** (`Stock Entry`)
- *Supports any custom Child DocType in any custom app!*

---

## 🌐 Compatibility

- **Frappe Framework**: v14.x, v15.x, v16.x
- **Python**: 3.10, 3.11, 3.12, 3.14
- **Browsers**: Chrome, Firefox, Safari, Edge

---

## 📄 License

MIT License. See [license.txt](license.txt) for details.
