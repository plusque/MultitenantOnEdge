package main

import "testing"

func TestValidateUserDataDir_HappyPath(t *testing.T) {
	err := validateUserDataDir(`C:\Users\you\AppData\Local\TenantSwitcher\profiles\mueller-ag`,
		`C:\Users\you\AppData\Local\TenantSwitcher\profiles`)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestValidateUserDataDir_RejectsParentTraversal(t *testing.T) {
	err := validateUserDataDir(`C:\tenants\..\..\Windows\System32`, `C:\tenants`)
	if err == nil {
		t.Error("expected rejection for .. traversal")
	}
}

func TestValidateUserDataDir_RejectsOutsideBase(t *testing.T) {
	err := validateUserDataDir(`D:\evil`, `C:\tenants`)
	if err == nil {
		t.Error("expected rejection for path outside base")
	}
}

func TestValidateUserDataDir_RejectsBaseItself(t *testing.T) {
	// Don't let user-data-dir equal the base itself; must be a child.
	err := validateUserDataDir(`C:\tenants`, `C:\tenants`)
	if err == nil {
		t.Error("expected rejection for path equal to base")
	}
}

func TestValidateUserDataDir_AcceptsForwardSlashes(t *testing.T) {
	// Normalize Windows + forward-slash mixed paths.
	err := validateUserDataDir(`C:/tenants/mueller-ag`, `C:\tenants`)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestValidateUserDataDir_RejectsRelativePath(t *testing.T) {
	err := validateUserDataDir(`tenants\mueller-ag`, `C:\tenants`)
	if err == nil {
		t.Error("expected rejection for relative path")
	}
}

func TestValidateUserDataDir_RejectsEmptyBase(t *testing.T) {
	err := validateUserDataDir(`C:\tenants\mueller-ag`, ``)
	if err == nil {
		t.Error("expected rejection for empty base path")
	}
}
