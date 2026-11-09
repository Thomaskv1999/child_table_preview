# Copyright (c) 2026, Thomas K V and contributors
# For license information, please see license.txt

import frappe
from frappe.tests import IntegrationTestCase
from child_table_preview.child_table_preview.doctype.child_table_preview_settings.child_table_preview_settings import (
	get_preview_settings,
	get_parent_doctype,
	load_standard_defaults,
)


class TestChildTablePreviewSettings(IntegrationTestCase):
	def test_get_preview_settings(self):
		settings = get_preview_settings()
		self.assertIsInstance(settings, list)

	def test_get_parent_doctype(self):
		parent = get_parent_doctype("Sales Invoice Item")
		if frappe.db.exists("DocType", "Sales Invoice Item"):
			self.assertTrue(bool(parent))

	def test_load_standard_defaults(self):
		res = load_standard_defaults()
		self.assertIn("added", res)
		self.assertIn("total", res)
