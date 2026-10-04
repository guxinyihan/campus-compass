package tracking

import (
	"testing"
	"time"
)

func TestConfigurationRejectsUnsafeSettings(t *testing.T) {
	cases := []func(*Config){
		func(c *Config) { c.Secret = "short" }, func(c *Config) { c.TTL = 121 * time.Second }, func(c *Config) { c.StaleAfter = c.TTL }, func(c *Config) { c.StaleAfter = 0 },
		func(c *Config) { c.Origins = nil }, func(c *Config) { c.Origins = []string{"*"} }, func(c *Config) { c.Origins = []string{"http://localhost:5173/path"} }, func(c *Config) { c.Origins = []string{"http://username@localhost:5173"} },
	}
	for i, change := range cases {
		c := testConfig()
		change(&c)
		if c.Validate() == nil {
			t.Fatalf("unsafe config case %d accepted", i)
		}
	}
	t.Setenv("TRACKING_JWT_SECRET", testSecret)
	t.Setenv("TRACKING_TTL_SECONDS", "120")
	t.Setenv("TRACKING_STALE_SECONDS", "30")
	t.Setenv("CORS_ORIGINS", testOrigin)
	if _, err := LoadConfig(); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TRACKING_TTL_SECONDS", "nonsense")
	if _, err := LoadConfig(); err == nil {
		t.Fatal("invalid duration accepted")
	}
}
