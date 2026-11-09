# Copyright (c) 2026, Thomas K V and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

DEFAULT_PREVIEW_RULES = [
	{
		"child_table": "Sales Order Item",
		"parent_doctype": "Sales Order",
		"fields": "item_code, item_name, description, qty, rate, amount, warehouse",
	},
	{
		"child_table": "Sales Invoice Item",
		"parent_doctype": "Sales Invoice",
		"fields": "item_code, item_name, description, qty, rate, amount, warehouse",
	},
	{
		"child_table": "Purchase Order Item",
		"parent_doctype": "Purchase Order",
		"fields": "item_code, item_name, description, qty, rate, amount, warehouse",
	},
	{
		"child_table": "Quotation Item",
		"parent_doctype": "Quotation",
		"fields": "item_code, item_name, description, qty, rate, amount",
	},
	{
		"child_table": "Delivery Note Item",
		"parent_doctype": "Delivery Note",
		"fields": "item_code, item_name, description, qty, rate, warehouse",
	},
	{
		"child_table": "Purchase Receipt Item",
		"parent_doctype": "Purchase Receipt",
		"fields": "item_code, item_name, description, qty, rate, warehouse",
	},
	{
		"child_table": "BOM Item",
		"parent_doctype": "BOM",
		"fields": "item_code, item_name, description, qty, rate, amount",
	},
	{
		"child_table": "Stock Entry Detail",
		"parent_doctype": "Stock Entry",
		"fields": "item_code, item_name, description, qty, basic_rate, s_warehouse, t_warehouse",
	},
]


class ChildTablePreviewSettings(Document):
	def on_update(self):
		frappe.publish_realtime("child_table_preview_settings_updated")


@frappe.whitelist()
def load_standard_defaults():
	"""Loads standard default rules for installed DocTypes."""
	doc = frappe.get_doc("Child Table Preview Settings")
	existing_tables = {r.child_table for r in (doc.preview_rules or []) if r.child_table}

	added = 0
	for rule in DEFAULT_PREVIEW_RULES:
		if rule["child_table"] in existing_tables:
			continue
		if frappe.db.exists("DocType", rule["child_table"]):
			doc.append(
				"preview_rules",
				{
					"child_table": rule["child_table"],
					"parent_doctype": rule["parent_doctype"],
					"fields": rule["fields"],
					"enabled": 1,
				},
			)
			added += 1

	if added:
		doc.flags.ignore_permissions = True
		doc.save()
		frappe.publish_realtime("child_table_preview_settings_updated")

	return {"added": added, "total": len(doc.preview_rules or [])}


def ensure_default_rules_if_empty(doc):
	"""Auto-populates standard rules if settings document is completely empty."""
	if doc.preview_rules:
		return False

	added = False
	for rule in DEFAULT_PREVIEW_RULES:
		if frappe.db.exists("DocType", rule["child_table"]):
			doc.append(
				"preview_rules",
				{
					"child_table": rule["child_table"],
					"parent_doctype": rule["parent_doctype"],
					"fields": rule["fields"],
					"enabled": 1,
				},
			)
			added = True

	if added:
		doc.flags.ignore_permissions = True
		doc.save()
	return added


@frappe.whitelist()
def get_parent_doctype(child_table: str):
	"""Returns the parent DocType using this child table."""
	if not child_table:
		return ""
	match = frappe.db.get_value(
		"DocField",
		{"fieldtype": "Table", "options": child_table},
		"parent",
		order_by="creation asc",
	)
	return match or ""


@frappe.whitelist()
def get_preview_settings():
	try:
		doc = frappe.get_doc("Child Table Preview Settings", ignore_permissions=True)

		# Auto-seed standard rules on fresh installs
		if not doc.preview_rules:
			try:
				ensure_default_rules_if_empty(doc)
			except Exception:
				pass

		if not doc.enabled:
			return []

		return [
			{
				"child_table": r.child_table,
				"parent_doctype": (r.parent_doctype or "").strip(),
				"fields": [
					f.strip()
					for f in (r.fields or "").split(",")
					if f.strip()
				],
				"enabled": r.enabled,
			}
			for r in (doc.preview_rules or [])
			if r.enabled and r.child_table
		]

	except Exception:
		return []
