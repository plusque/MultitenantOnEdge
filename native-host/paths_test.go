package main

import (
	"os"
	"testing"
)

func TestExpandEnvVars_ReplacesKnownVars(t *testing.T) {
	os.Setenv("TS_TEST_BASE", `C:\Users\test\AppData\Local`)
	defer os.Unsetenv("TS_TEST_BASE")
	got := expandEnvVars(`%TS_TEST_BASE%\TenantSwitcher\profiles`)
	want := `C:\Users\test\AppData\Local\TenantSwitcher\profiles`
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestExpandEnvVars_LeavesUnknownVars(t *testing.T) {
	os.Unsetenv("TS_DEFINITELY_NOT_SET")
	got := expandEnvVars(`%TS_DEFINITELY_NOT_SET%\foo`)
	want := `%TS_DEFINITELY_NOT_SET%\foo`
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestExpandEnvVars_NoVars(t *testing.T) {
	got := expandEnvVars(`C:\plain\path\no\vars`)
	want := `C:\plain\path\no\vars`
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

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
