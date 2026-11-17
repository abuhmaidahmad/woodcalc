"""Payroll calculation helpers.

Pure functions only: no database access, no request handling. The payroll
engine (Phase 3) builds on these; keeping them free of Django models makes
them easy to test with plain numbers.
"""
