PERMISSIONS = [
    {"code": "team.manage_members", "label": "Manage team members & permissions"},
    {"code": "hr.view_employees", "label": "View employee directory"},
    {"code": "hr.manage_employees", "label": "Add/edit/deactivate employees"},
    {"code": "hr.view_salary", "label": "View salary & payroll data"},
    {"code": "hr.edit_salary", "label": "Edit salary & run payroll"},
    {"code": "hr.manage_attendance", "label": "Record/edit attendance"},
    {"code": "hr.manage_leave", "label": "Approve/reject leave requests"},
]

PERMISSION_CODES = {p["code"] for p in PERMISSIONS}
