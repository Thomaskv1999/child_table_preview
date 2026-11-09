// Copyright (c) 2026, Thomas K V and contributors
// For license information, please see license.txt

frappe.ui.form.on("Child Table Preview Settings", {
	refresh(frm) {
		frm.add_custom_button(__("Load Standard Defaults"), function () {
			frappe.call({
				method: "child_table_preview.child_table_preview.doctype.child_table_preview_settings.child_table_preview_settings.load_standard_defaults",
				freeze: true,
				freeze_message: __("Loading standard defaults..."),
				callback(r) {
					if (r.message) {
						frm.reload_doc();
						frappe.show_alert({
							message: __("Loaded {0} standard preview rules (Total: {1})", [
								r.message.added,
								r.message.total,
							]),
							indicator: "green",
						});
					}
				},
			});
		});
	},

	setup(frm) {
		frm.set_query("child_table", "preview_rules", function () {
			return {
				filters: {
					istable: 1,
				},
			};
		});

		frm.set_query("parent_doctype", "preview_rules", function () {
			return {
				filters: {
					istable: 0,
				},
			};
		});
	},

	after_save(frm) {
		if (frappe.realtime) {
			frappe.realtime.publish("child_table_preview_settings_updated", {});
		}
		frappe.show_alert({
			message: __("Preview settings saved. Rules refreshed."),
			indicator: "green",
		});
	},
});

frappe.ui.form.on("Child Table Preview Rule", {
	select_fields(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (!row.child_table) {
			frappe.msgprint(__("Please select a Child Table first."));
			return;
		}

		frappe.model.with_doctype(row.child_table, function () {
			const meta = frappe.get_meta(row.child_table);
			const current_fields = (row.fields || "")
				.split(",")
				.map((f) => f.trim())
				.filter(Boolean);

			const non_value_fields = [
				"Section Break",
				"Column Break",
				"Tab Break",
				"HTML",
				"Fold",
				"Heading",
				"Button",
			];

			const options = meta.fields
				.filter((df) => !non_value_fields.includes(df.fieldtype) && !df.hidden)
				.map((df) => ({
					label: `${df.label || df.fieldname} (${df.fieldname})`,
					value: df.fieldname,
					checked: current_fields.includes(df.fieldname),
				}));

			const all_checked = options.length > 0 && options.every((o) => o.checked);

			const dialog = new frappe.ui.Dialog({
				title: __("Select Fields to Show: {0}", [row.child_table]),
				fields: [
					{
						fieldname: "search_fields",
						fieldtype: "Data",
						placeholder: __("Search fields by label or fieldname..."),
					},
					{
						fieldname: "select_all",
						fieldtype: "Check",
						label: __("Select All / Deselect All"),
						default: all_checked ? 1 : 0,
						change() {
							const check_all = dialog.get_value("select_all");
							const multicheck = dialog.get_field("fields_multicheck");
							if (multicheck) {
								multicheck.select_all(!check_all);
							}
						},
					},
					{
						fieldtype: "Section Break",
					},
					{
						fieldname: "fields_multicheck",
						fieldtype: "MultiCheck",
						options: options,
						columns: 2,
						on_change() {
							const multicheck = dialog.get_field("fields_multicheck");
							if (multicheck) {
								const checked = multicheck.get_checked_options();
								const is_all = checked.length === options.length && options.length > 0;
								const select_all_field = dialog.get_field("select_all");
								if (select_all_field && select_all_field.$input) {
									select_all_field.$input.prop("checked", is_all);
								}
							}
						},
					},
				],
				primary_action_label: __("Done"),
				primary_action(values) {
					const multicheck = dialog.get_field("fields_multicheck");
					const selected = multicheck ? multicheck.get_checked_options() : (values.fields_multicheck || []);
					frappe.model.set_value(cdt, cdn, "fields", selected.join(", "));
					dialog.hide();
					frm.dirty();
				},
			});

			dialog.show();

			function filter_checkboxes(q) {
				q = (q || "").toLowerCase().trim();
				dialog.$wrapper.find(".unit-checkbox").each(function () {
					const text = $(this).text().toLowerCase();
					const val = ($(this).find("input").attr("data-unit") || "").toLowerCase();
					$(this).toggle(!q || text.includes(q) || val.includes(q));
				});
			}

			// Realtime filtering of checkboxes as user types in search bar
			const search_field = dialog.get_field("search_fields");
			if (search_field && search_field.$input) {
				search_field.$input.on("input keyup", function () {
					filter_checkboxes($(this).val());
				});
			}

			dialog.$wrapper.on(
				"input keyup",
				"input[data-fieldname='search_fields'], .frappe-control[data-fieldname='search_fields'] input",
				function () {
					filter_checkboxes($(this).val());
				}
			);
		});
	},
});
