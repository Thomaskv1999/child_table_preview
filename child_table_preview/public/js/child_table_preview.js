
// Copyright (c) 2026, Thomas K V and contributors
// For license information, please see license.txt

(function () {
    let _preview_rules = null;
    let _meta_cache = {};
    let _is_loading = false;
    let _settings_callbacks = [];
    let removeTimer = null;
    let currentHoverRow = null;

    // Ensure thumbnail styles are always active regardless of browser CSS caching
    if (!document.getElementById("child-preview-injected-styles")) {
        const injectedStyle = document.createElement("style");
        injectedStyle.id = "child-preview-injected-styles";
        injectedStyle.textContent = `
            .preview-avatar-wrap {
                display: flex !important;
                justify-content: center !important;
                align-items: center !important;
                margin-bottom: 12px !important;
                flex-shrink: 0 !important;
            }
            .preview-avatar-link {
                display: inline-block !important;
                border-radius: 50% !important;
                text-decoration: none !important;
                line-height: 0 !important;
                cursor: pointer !important;
            }
            .preview-avatar {
                display: block !important;
                width: 64px !important;
                height: 64px !important;
                min-width: 64px !important;
                min-height: 64px !important;
                max-width: 64px !important;
                max-height: 64px !important;
                border-radius: 50% !important;
                border: 2px solid var(--border-color, #d1d8dd) !important;
                object-fit: cover !important;
                background: var(--control-bg, #f4f5f6) !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12) !important;
                transition: transform 0.15s ease, box-shadow 0.15s ease !important;
            }
            .preview-avatar:hover {
                transform: scale(1.06) !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18) !important;
            }
            .preview-fields img,
            .preview-field img,
            .preview-field-value img,
            .preview-thumbnail {
                display: block !important;
                width: 50px !important;
                height: 50px !important;
                max-width: 50px !important;
                max-height: 50px !important;
                min-width: 50px !important;
                min-height: 50px !important;
                object-fit: cover !important;
                border-radius: 4px !important;
                border: 1px solid var(--border-color, #d1d8dd) !important;
                background: var(--control-bg, #f4f5f6) !important;
            }
            .preview-thumbnail-wrap {
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                width: 50px !important;
                height: 50px !important;
                max-width: 50px !important;
                max-height: 50px !important;
                overflow: hidden !important;
                border-radius: 4px !important;
                border: 1px solid var(--border-color, #d1d8dd) !important;
                background: var(--control-bg, #f4f5f6) !important;
                margin-top: 3px !important;
                text-decoration: none !important;
                flex-shrink: 0 !important;
            }
        `;
        document.head.appendChild(injectedStyle);
    }

    // Cancel scheduled popup removal
    function cancelRemove() {
        clearTimeout(removeTimer);
    }

    // Close preview popup
    function closePreview() {
        cancelRemove();
        currentHoverRow = null;

        const popup = document.querySelector(".child-hover-preview");

        if (popup) {
            popup.remove();
        }
    }

    // Load preview settings from the server
    function load_settings(callback) {
        if (_preview_rules !== null) {
            if (callback) {
                callback(_preview_rules);
            }
            return;
        }

        if (callback) {
            _settings_callbacks.push(callback);
        }

        if (_is_loading) {
            return;
        }

        _is_loading = true;

        frappe.call({
            method: "child_table_preview.child_table_preview.doctype.child_table_preview_settings.child_table_preview_settings.get_preview_settings",

            callback(r) {
                _preview_rules = r.message || [];
                _is_loading = false;

                const callbacks = [..._settings_callbacks];
                _settings_callbacks = [];

                callbacks.forEach((cb) => cb(_preview_rules));
            },

            error() {
                _preview_rules = [];
                _is_loading = false;

                const callbacks = [..._settings_callbacks];
                _settings_callbacks = [];

                callbacks.forEach((cb) => cb(_preview_rules));
            },
        });
    }

    // Load settings immediately
    load_settings();

    function clearCache() {
        _preview_rules = null;
        _meta_cache = {};
    }

    // Invalidate cached rules on route change or when settings are updated in realtime
    if (frappe.router && frappe.router.on) {
        frappe.router.on("change", clearCache);
    }

    $(document).on("page-change", clearCache);

    if (frappe.realtime) {
        frappe.realtime.on("child_table_preview_settings_updated", clearCache);
    }

    // Detect touch / mobile devices
    function isTouchDevice() {
        return (
            (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
            (frappe.utils && typeof frappe.utils.is_xs === "function" && frappe.utils.is_xs())
        );
    }

    // Check whether a row editor or modal is open
    function isRowEditorOpen(rowElement) {
        // 1. Any grid row editor is currently open anywhere on the page
        if (
            $(".grid-row-open").length > 0 ||
            $(".form-in-grid:visible").length > 0 ||
            $("#freeze:visible").length > 0 ||
            $(".modal.show:visible").length > 0 ||
            (frappe.ui?.form?.get_open_grid_form && frappe.ui.form.get_open_grid_form()) ||
            (window.cur_frm && window.cur_frm.cur_grid)
        ) {
            return true;
        }

        // 2. Specific checks on the row element itself
        if (rowElement) {
            const $row = $(rowElement);
            if (
                $row.hasClass("grid-row-open") ||
                $row.closest(".grid-row-open").length > 0 ||
                $row.closest(".form-in-grid").length > 0 ||
                $row.find(".form-in-grid:visible").length > 0 ||
                $row.closest(".form-grid").find(".grid-row-open").length > 0
            ) {
                return true;
            }
        }

        return false;
    }

    // Schedule popup removal when pointer leaves row and popup
    function scheduleRemove() {
        cancelRemove();

        removeTimer = setTimeout(() => {
            const popup = document.querySelector(".child-hover-preview");

            if (!popup) return;

            const mouseInsidePopup = popup.matches(":hover");
            const mouseInsideRow = $(".grid-row:hover").length > 0;

            if (mouseInsidePopup || mouseInsideRow) {
                return;
            }

            popup.remove();
        }, 100);
    }

    // Search filter inside preview popup: searches across ALL row fields
    function filterPreviewFields(popup, value) {
        const query = (value || "").toLowerCase().trim();
        const queryNorm = query.replace(/[_\s-]+/g, " ");
        const fields = popup.querySelectorAll(".preview-field");

        let count = 0;

        fields.forEach((field) => {
            const isConfigured = field.getAttribute("data-configured") === "1";

            if (!query) {
                // When search is empty, show only configured preview fields
                field.style.display = isConfigured ? "flex" : "none";
                if (isConfigured) {
                    count++;
                }
            } else {
                // When searching, match across fieldname, label, and formatted value
                const fieldName = (field.getAttribute("data-fieldname") || "").toLowerCase();
                const fieldNameNorm = fieldName.replace(/[_\s-]+/g, " ");
                const label = (
                    field.getAttribute("data-label") ||
                    field.querySelector(".preview-field-label")?.textContent ||
                    field.querySelector("span")?.textContent ||
                    ""
                ).toLowerCase();
                const labelNorm = label.replace(/[_\s-]+/g, " ");
                const val = (
                    field.getAttribute("data-value") ||
                    field.querySelector(".preview-field-value")?.textContent ||
                    field.querySelector("strong")?.textContent ||
                    ""
                ).toLowerCase();
                const valNorm = val.replace(/[_\s-]+/g, " ");

                const matches =
                    fieldName.includes(query) ||
                    fieldNameNorm.includes(queryNorm) ||
                    label.includes(query) ||
                    labelNorm.includes(queryNorm) ||
                    val.includes(query) ||
                    valNorm.includes(queryNorm);

                field.style.display = matches ? "flex" : "none";

                if (matches) {
                    count++;
                }
            }
        });

        let message = popup.querySelector(".preview-no-results");

        if (count === 0) {
            if (!message) {
                message = document.createElement("div");
                message.className = "preview-no-results";
                popup.querySelector(".preview-fields").appendChild(message);
            }
            if (!query) {
                message.textContent = __("No configured preview fields to display");
            } else {
                message.textContent = __("No matching fields found");
            }
        } else if (message) {
            message.remove();
        }
    }

    function extract_image_url(val) {
        if (!val || typeof val !== "string") return "";
        let str = val.trim();
        const match = str.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (match && match[1]) {
            str = match[1];
        }
        if (str && !str.startsWith("http") && !str.startsWith("/") && !str.startsWith("data:")) {
            str = "/" + str;
        }
        return str;
    }

    function is_image_field(val, df) {
        if (!val) return false;
        if (typeof val === "string") {
            const str = val.trim();
            if (str.startsWith("<img") || str.includes("<img")) return true;
            if (str.startsWith("data:image/")) return true;
            if (str.match(/\.(png|jpe?g|gif|webp|svg|bmp|ico)($|\?)/i)) return true;
        }
        if (df) {
            if (df.fieldtype === "Attach Image" || df.fieldtype === "Image") return true;
            if (
                df.fieldtype === "Attach" &&
                typeof val === "string" &&
                val.match(/\.(png|jpe?g|gif|webp|svg|bmp|ico)($|\?)/i)
            ) {
                return true;
            }
        }
        return false;
    }

    // Format field values
    function format_value(val, df) {
        if (val === undefined || val === null || val === "") {
            return "";
        }

        if (is_image_field(val, df)) {
            const rawUrl = extract_image_url(val);
            const cleanUrl = frappe.utils.escape_html(rawUrl);
            return `<a href="${cleanUrl}" target="_blank" class="preview-thumbnail-wrap" title="${cleanUrl}" style="display:inline-flex !important;align-items:center !important;justify-content:center !important;width:50px !important;height:50px !important;max-width:50px !important;max-height:50px !important;overflow:hidden !important;border-radius:4px !important;border:1px solid #d1d8dd !important;background:#f4f5f6 !important;margin-top:3px !important;text-decoration:none !important;flex-shrink:0 !important;"><img src="${cleanUrl}" class="preview-thumbnail" alt="Thumbnail" loading="lazy" style="display:block !important;width:50px !important;height:50px !important;max-width:50px !important;max-height:50px !important;min-width:50px !important;min-height:50px !important;object-fit:cover !important;border-radius:4px !important;border:none !important;background:#f4f5f6 !important;" /></a>`;
        }

        if (df && df.fieldtype === "Check") {
            return val ? __("Yes") : __("No");
        }

        if (df && df.fieldtype === "Currency" && frappe.format) {
            const formatted = frappe.format(val, df, {}, cur_frm?.doc);

            const temp = document.createElement("div");
            temp.innerHTML = formatted;

            return temp.textContent.trim() || String(val);
        }

        if (
            df &&
            (df.fieldtype === "Date" || df.fieldtype === "Datetime") &&
            frappe.datetime
        ) {
            return frappe.datetime.str_to_user(String(val));
        }

        return String(val);
    }

    // Identify child DocType from the grid row
    function get_child_doctype(rowElement, rowName) {
        const grid_row = $(rowElement).data("grid_row");

        // Get child DocType directly from grid row
        if (grid_row?.doc?.doctype) {
            return grid_row.doc.doctype;
        }

        // Get child DocType from parent field definition
        if (grid_row?.parent_df?.options) {
            return grid_row.parent_df.options;
        }

        // Get child DocType using the parent table field
        const fieldname = $(rowElement)
            .closest("[data-fieldname]")
            .attr("data-fieldname");

        if (
            fieldname &&
            cur_frm &&
            cur_frm.fields_dict[fieldname]?.df?.options
        ) {
            return cur_frm.fields_dict[fieldname].df.options;
        }

        // Search configured child tables in locals
        if (_preview_rules && rowName) {
            for (const rule of _preview_rules) {
                if (
                    locals[rule.child_table] &&
                    locals[rule.child_table][rowName]
                ) {
                    return rule.child_table;
                }
            }
        }

        return null;
    }

    // Wait for settings and display preview
    function showPreview(rowElement) {
        if (isTouchDevice()) {
            return;
        }

        if (isRowEditorOpen(rowElement)) {
            closePreview();
            return;
        }

        load_settings(() => {
            if (isTouchDevice() || isRowEditorOpen(rowElement)) {
                closePreview();
                return;
            }
            showPreviewWithSettings(rowElement);
        });
    }

    // Position popup neatly relative to row
    function positionPopup(popup, rowElement) {
        if (!popup || !rowElement) return;

        const rect = rowElement.getBoundingClientRect();

        const popupWidth = popup.offsetWidth || 320;
        const popupHeight = popup.offsetHeight || 300;

        const spaceRight = window.innerWidth - rect.right;
        const spaceLeft = rect.left;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        let left = 0;
        let top = 0;

        if (spaceRight >= popupWidth + 12) {
            // Position to the right of the row
            left = rect.right + 8;
            top = rect.top;
        } else if (spaceLeft >= popupWidth + 12) {
            // Position to the left of the row
            left = rect.left - popupWidth - 8;
            top = rect.top;
        } else {
            // Neither right nor left side has enough room (>320px):
            // Float neatly above or below the row instead of covering it
            left = Math.max(10, Math.min(rect.left + 24, window.innerWidth - popupWidth - 10));

            if (spaceBelow >= popupHeight + 12) {
                top = rect.bottom + 8;
            } else if (spaceAbove >= popupHeight + 12) {
                top = rect.top - popupHeight - 8;
            } else {
                top = spaceBelow >= spaceAbove ? rect.bottom + 8 : rect.top - popupHeight - 8;
            }
        }

        // Clamp safely inside viewport bounds
        left = Math.max(10, Math.min(left, window.innerWidth - popupWidth - 10));
        top = Math.max(10, Math.min(top, window.innerHeight - popupHeight - 10));

        popup.style.left = left + "px";
        popup.style.top = top + "px";
    }

    // Display preview using configured settings only
    function showPreviewWithSettings(rowElement) {
        if (isTouchDevice()) {
            return;
        }

        if (!document.body.contains(rowElement)) {
            return;
        }

        if (isRowEditorOpen(rowElement)) {
            closePreview();
            return;
        }

        cancelRemove();
        currentHoverRow = rowElement;

        const rowName = $(rowElement).attr("data-name");

        if (!rowName) {
            return;
        }

        const child_doctype = get_child_doctype(rowElement, rowName);

        if (!child_doctype) {
            return;
        }

        // Find rule matching both child and parent DocTypes
        const rule = (_preview_rules || []).find((r) => {
            return (
                r.child_table === child_doctype &&
                (!r.parent_doctype ||
                    r.parent_doctype === cur_frm?.doctype)
            );
        });

        // Only enabled and configured rules can display previews
        if (!rule || !rule.enabled) {
            closePreview();
            return;
        }

        // Get child row document
        const grid_row = $(rowElement).data("grid_row");

        const item =
            (grid_row && grid_row.doc) ||
            locals[child_doctype]?.[rowName];

        if (!item) {
            return;
        }

        // Avoid rebuilding the same popup
        const existing = document.querySelector(".child-hover-preview");

        if (existing && existing.dataset.rowName === rowName) {
            return;
        }

        if (existing) {
            existing.remove();
        }

        // Build all fields:
        // 1) Configured fields first (shown by default)
        // 2) All other child table row fields (searchable across all fields)
        const allFields = [];
        const seenFieldnames = new Set();
        const non_value_fieldtypes = [
            "Section Break",
            "Column Break",
            "Tab Break",
            "HTML",
            "Fold",
            "Heading",
            "Button",
            "Image",
        ];
        const ignoredKeys = new Set([
            "doctype",
            "name",
            "owner",
            "creation",
            "modified",
            "modified_by",
            "parent",
            "parentfield",
            "parenttype",
            "idx",
            "docstatus",
            "__islocal",
            "__unsaved",
            "__original_name",
            "_user_tags",
            "_comments",
            "_assign",
            "_liked_by",
        ]);

        function find_docfield(fname) {
            if (_meta_cache[child_doctype]) {
                const cached = _meta_cache[child_doctype].find((d) => d && d.fieldname === fname);
                if (cached) return cached;
            }
            if (grid_row && Array.isArray(grid_row.docfields)) {
                const df = grid_row.docfields.find((d) => d && d.fieldname === fname);
                if (df) return df;
            }
            if (grid_row?.grid && Array.isArray(grid_row.grid.docfields)) {
                const df = grid_row.grid.docfields.find((d) => d && d.fieldname === fname);
                if (df) return df;
            }
            if (frappe.meta?.get_docfield) {
                const df = frappe.meta.get_docfield(child_doctype, fname);
                if (df) return df;
            }
            const meta = frappe.get_meta(child_doctype);
            if (meta?.fields) {
                const df = meta.fields.find((d) => d && d.fieldname === fname);
                if (df) return df;
            }
            return null;
        }

        function get_field_label(fname, df) {
            if (df && df.label) {
                return __(df.label);
            }
            return frappe.model.unscrub(fname);
        }

        function should_skip_field(fname, df) {
            if (ignoredKeys.has(fname) || fname.startsWith("__")) {
                return true;
            }
            if (df) {
                if (non_value_fieldtypes.includes(df.fieldtype)) {
                    return true;
                }
                // Filter fields against Frappe's field permission checker
                if (df.permlevel) {
                    if (
                        frappe.perm &&
                        typeof frappe.perm.has_perm === "function" &&
                        !frappe.perm.has_perm(child_doctype, df.permlevel, "read", item)
                    ) {
                        return true;
                    }
                }
            }
            return false;
        }

        // 1. Add configured fields from settings rule
        (rule.fields || []).forEach((fname) => {
            if (!fname || seenFieldnames.has(fname)) return;
            const val = item[fname];
            if (val === undefined || val === null || val === "") return;

            const df = find_docfield(fname);
            if (should_skip_field(fname, df)) return;

            allFields.push({
                fieldname: fname,
                label: get_field_label(fname, df),
                value: format_value(val, df),
                raw_value: String(val),
                is_image: is_image_field(val, df),
                is_configured: true,
            });
            seenFieldnames.add(fname);
        });

        // 2. Add all available docfields from grid row / meta definitions (cached per DocType)
        let available_docfields = _meta_cache[child_doctype];
        if (!available_docfields) {
            available_docfields =
                (grid_row && Array.isArray(grid_row.docfields) && grid_row.docfields) ||
                (grid_row?.grid && Array.isArray(grid_row.grid.docfields) && grid_row.grid.docfields) ||
                (frappe.meta?.get_docfields && frappe.meta.get_docfields(child_doctype)) ||
                (frappe.get_meta(child_doctype)?.fields) ||
                [];
            _meta_cache[child_doctype] = available_docfields;
        }

        available_docfields.forEach((df) => {
            const fname = df && df.fieldname;
            if (!fname || seenFieldnames.has(fname)) return;
            if (should_skip_field(fname, df)) return;

            const val = item[fname];
            const hasVal = val !== undefined && val !== null && val !== "";
            const formattedVal = hasVal ? format_value(val, df) : "-";

            allFields.push({
                fieldname: fname,
                label: get_field_label(fname, df),
                value: formattedVal,
                raw_value: hasVal ? String(val) : "-",
                is_image: hasVal ? is_image_field(val, df) : false,
                is_configured: false,
            });
            seenFieldnames.add(fname);
        });

        // 3. Add all remaining fields present on the row item object
        Object.keys(item).forEach((fname) => {
            if (seenFieldnames.has(fname)) return;
            const df = find_docfield(fname);
            if (should_skip_field(fname, df)) return;

            const val = item[fname];
            const hasVal = val !== undefined && val !== null && val !== "";
            const formattedVal = hasVal ? format_value(val, df) : "-";

            allFields.push({
                fieldname: fname,
                label: get_field_label(fname, df),
                value: formattedVal,
                raw_value: hasVal ? String(val) : "-",
                is_image: hasVal ? is_image_field(val, df) : false,
                is_configured: false,
            });
            seenFieldnames.add(fname);
        });

        // Do not show popup if no field has a value
        if (!allFields.length) {
            return;
        }

        // Find any image belonging to this row to display as top circular avatar
        let primaryImageUrl = "";

        // 1. Check allFields for an image field
        const imgField = allFields.find(
            (f) => f.is_image && f.raw_value && f.raw_value !== "-" && f.raw_value !== "null"
        );
        if (imgField) {
            primaryImageUrl = extract_image_url(imgField.raw_value);
        }

        // 2. Check direct row properties if not found
        if (!primaryImageUrl) {
            const possibleImgKeys = ["image", "item_image", "thumbnail", "photo", "picture", "attach_image"];
            for (const key of possibleImgKeys) {
                const val = item[key];
                if (val && typeof val === "string" && is_image_field(val)) {
                    primaryImageUrl = extract_image_url(val);
                    break;
                }
            }
        }

        // 3. Fallback to cached Item document if available
        if (!primaryImageUrl && item.item_code && window.locals?.["Item"]?.[item.item_code]?.image) {
            const cachedImg = window.locals["Item"][item.item_code].image;
            if (is_image_field(cachedImg)) {
                primaryImageUrl = extract_image_url(cachedImg);
            }
        }

        let avatarHtml = "";
        if (primaryImageUrl) {
            const cleanUrl = frappe.utils.escape_html(primaryImageUrl);
            avatarHtml = `
                <div class="preview-avatar-wrap">
                    <a href="${cleanUrl}" target="_blank" class="preview-avatar-link" title="${frappe.utils.escape_html(
                        __("Click to view full image")
                    )}">
                        <img
                            src="${cleanUrl}"
                            class="preview-avatar"
                            alt="${frappe.utils.escape_html(__("Row Image"))}"
                            loading="lazy"
                            onerror="this.closest('.preview-avatar-wrap')?.remove();"
                        />
                    </a>
                </div>
            `;
        }

        // Build popup HTML
        let html = `
            <div class="child-hover-preview"
                data-row-name="${frappe.utils.escape_html(rowName)}">

                ${avatarHtml}

                <div class="preview-search">
                    <input
                        type="text"
                        class="preview-search-input"
                        placeholder="${frappe.utils.escape_html(
                            __("Search all fields or values...")
                        )}"
                        autocomplete="off"
                        spellcheck="false"
                    />
                </div>

                <div class="preview-fields">
        `;

        allFields.forEach((f) => {
            const displayStyle = f.is_configured ? "display: flex;" : "display: none;";
            const valueHtml = f.is_image
                ? f.value
                : frappe.utils.escape_html(String(f.value));

            html += `
                <div class="preview-field"
                     data-fieldname="${frappe.utils.escape_html(String(f.fieldname))}"
                     data-label="${frappe.utils.escape_html(String(f.label))}"
                     data-value="${frappe.utils.escape_html(String(f.raw_value || f.value))}"
                     data-configured="${f.is_configured ? "1" : "0"}"
                     style="${displayStyle}">
                     <span class="preview-field-label">${frappe.utils.escape_html(String(f.label))}</span>
                     <strong class="preview-field-value">${valueHtml}</strong>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        $("body").append(html);

        const popup = document.querySelector(".child-hover-preview");
        const searchInput = popup.querySelector(".preview-search-input");

        // Ensure list thumbnail images inside popup fields are strictly constrained to 50px x 50px
        popup.querySelectorAll(".preview-fields img, .preview-thumbnail").forEach((img) => {
            img.style.setProperty("display", "block", "important");
            img.style.setProperty("width", "50px", "important");
            img.style.setProperty("height", "50px", "important");
            img.style.setProperty("max-width", "50px", "important");
            img.style.setProperty("max-height", "50px", "important");
            img.style.setProperty("min-width", "50px", "important");
            img.style.setProperty("min-height", "50px", "important");
            img.style.setProperty("object-fit", "cover", "important");
            img.style.setProperty("border-radius", "4px", "important");
        });

        // Ensure top circular avatar image is styled neatly (slightly bigger than 50px list thumbnail)
        popup.querySelectorAll(".preview-avatar").forEach((img) => {
            img.style.setProperty("display", "block", "important");
            img.style.setProperty("width", "64px", "important");
            img.style.setProperty("height", "64px", "important");
            img.style.setProperty("max-width", "64px", "important");
            img.style.setProperty("max-height", "64px", "important");
            img.style.setProperty("min-width", "64px", "important");
            img.style.setProperty("min-height", "64px", "important");
            img.style.setProperty("object-fit", "cover", "important");
            img.style.setProperty("border-radius", "50%", "important");
        });

        // Prevent clicking inside popup from closing it
        popup.addEventListener("mousedown", (e) => e.stopPropagation());
        popup.addEventListener("pointerdown", (e) => e.stopPropagation());
        popup.addEventListener("click", (e) => e.stopPropagation());

        popup.addEventListener("mouseenter", cancelRemove);
        popup.addEventListener("mouseleave", scheduleRemove);

        // Search input events
        searchInput.addEventListener("focus", cancelRemove);

        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closePreview();
                return;
            }
            e.stopPropagation();
        });
        searchInput.addEventListener("keyup", function (e) {
            filterPreviewFields(popup, this.value);
            e.stopPropagation();
        });
        searchInput.addEventListener("input", function () {
            filterPreviewFields(popup, this.value);
            const fieldsContainer = popup.querySelector(".preview-fields");
            if (fieldsContainer) {
                fieldsContainer.scrollTop = 0;
            }
        });
        searchInput.addEventListener("change", function () {
            filterPreviewFields(popup, this.value);
        });

        // Position popup
        positionPopup(popup, rowElement);

        // Auto-focus search input immediately on row hover so user can type to search right away
        try {
            searchInput.focus({ preventScroll: true });
        } catch (e) {}

        requestAnimationFrame(() => {
            if (!document.body.contains(searchInput)) return;
            if (isRowEditorOpen(rowElement)) {
                closePreview();
                return;
            }
            searchInput.focus({ preventScroll: true });
        });
    }

    // Remove previous delegated event handlers
    $(document).off(".childPreview");

    // Show preview on row hover (only if not touch device and no row editor is open)
    $(document).on(
        "mouseenter.childPreview",
        ".grid-row",
        function () {
            if (isTouchDevice() || isRowEditorOpen(this)) {
                closePreview();
                return;
            }
            showPreview(this);
        }
    );

    // Close preview after leaving row
    $(document).on(
        "mouseleave.childPreview",
        ".grid-row",
        function () {
            scheduleRemove();
        }
    );

    // Close preview when clicking anywhere outside the preview popup (such as clicking the row or edit button)
    $(document).on(
        "mousedown.childPreview pointerdown.childPreview click.childPreview",
        function (e) {
            if (!$(e.target).closest(".child-hover-preview").length) {
                closePreview();
            }
        }
    );

    // Close preview immediately when opening row form or clicking open buttons
    $(document).on(
        "click.childPreview",
        ".btn-open-row, .edit-grid-row",
        function () {
            closePreview();
        }
    );

    // Also close preview whenever Frappe triggers a form render
    $(document).on("form_render.childPreview", function () {
        closePreview();
    });

    // Observe DOM changes to close preview immediately when a row form opens
    if (window.MutationObserver) {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (
                    mutation.type === "attributes" &&
                    mutation.attributeName === "class"
                ) {
                    const target = mutation.target;
                    if (target.classList && target.classList.contains("grid-row-open")) {
                        closePreview();
                        return;
                    }
                } else if (mutation.type === "childList") {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) {
                            if (
                                node.classList?.contains("grid-row-open") ||
                                node.classList?.contains("form-in-grid") ||
                                node.querySelector?.(".grid-row-open, .form-in-grid")
                            ) {
                                closePreview();
                                return;
                            }
                        }
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class"],
        });
    }

    // Reposition popup smoothly when the window or page scrolls
    window.addEventListener(
        "scroll",
        function (e) {
            const popup = document.querySelector(".child-hover-preview");
            if (!popup || !currentHoverRow) return;

            // If scrolling occurred inside the preview itself, don't reposition
            if (e.target && (e.target === popup || popup.contains(e.target))) {
                return;
            }

            if (!document.body.contains(currentHoverRow)) {
                closePreview();
                return;
            }

            const rect = currentHoverRow.getBoundingClientRect();
            // If row has scrolled out of view, close preview
            if (rect.bottom < 40 || rect.top > window.innerHeight - 40) {
                closePreview();
                return;
            }

            positionPopup(popup, currentHoverRow);
        },
        { passive: true, capture: true }
    );

    // Redirect wheel scrolling to popup; chain to screen when popup scroll reaches end
    document.addEventListener(
        "wheel",
        function (e) {
            const popup = document.querySelector(".child-hover-preview");

            if (!popup) {
                return;
            }

            const insidePopup = popup.contains(e.target);
            const row = e.target.closest?.(".grid-row");

            if (!insidePopup && !row) {
                return;
            }

            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                return;
            }

            const fieldsContainer = popup.querySelector(".preview-fields");
            if (!fieldsContainer) {
                return;
            }

            const maxScroll = fieldsContainer.scrollHeight - fieldsContainer.clientHeight;
            if (maxScroll <= 1) {
                // All fields fit inside preview; let the page scroll naturally
                return;
            }

            const atBottom = fieldsContainer.scrollTop >= (maxScroll - 1.5);
            const atTop = fieldsContainer.scrollTop <= 1.5;

            if (e.deltaY > 0) {
                // Scrolling down
                if (!atBottom) {
                    e.preventDefault();
                    e.stopPropagation();
                    fieldsContainer.scrollTop = Math.min(maxScroll, fieldsContainer.scrollTop + e.deltaY);
                    cancelRemove();
                }
                // If atBottom, do not preventDefault/stopPropagation: page scrolls down naturally
            } else if (e.deltaY < 0) {
                // Scrolling up
                if (!atTop) {
                    e.preventDefault();
                    e.stopPropagation();
                    fieldsContainer.scrollTop = Math.max(0, fieldsContainer.scrollTop + e.deltaY);
                    cancelRemove();
                }
                // If atTop, do not preventDefault/stopPropagation: page scrolls up naturally
            }
        },
        {
            capture: true,
            passive: false,
        }
    );
})();
