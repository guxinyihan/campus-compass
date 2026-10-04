package tracking

import (
	"errors"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config deliberately contains no account data or persistent GPS history setting.
type Config struct {
	Addr       string
	RedisAddr  string
	Secret     string
	Origins    []string
	TTL        time.Duration
	StaleAfter time.Duration
	KeyPrefix  string
}

func LoadConfig() (Config, error) {
	ttl, err := seconds("TRACKING_TTL_SECONDS", 120)
	if err != nil {
		return Config{}, err
	}
	stale, err := seconds("TRACKING_STALE_SECONDS", 30)
	if err != nil {
		return Config{}, err
	}
	cfg := Config{Addr: ":" + env("TRACKING_PORT", "8081"), RedisAddr: env("REDIS_ADDR", "localhost:6379"), Secret: os.Getenv("TRACKING_JWT_SECRET"), Origins: strings.Split(env("CORS_ORIGINS", "http://localhost:5173"), ","), TTL: ttl, StaleAfter: stale}
	return cfg, cfg.Validate()
}

func (c Config) Validate() error {
	if len(c.Secret) < 32 {
		return errors.New("TRACKING_JWT_SECRET must have at least 32 characters")
	}
	if c.TTL < time.Second || c.TTL > 120*time.Second || c.StaleAfter <= 0 || c.StaleAfter >= c.TTL {
		return errors.New("tracking freshness requires 0 < stale < TTL <= 120 seconds")
	}
	if len(c.Origins) == 0 {
		return errors.New("CORS_ORIGINS must contain explicit origins")
	}
	for _, raw := range c.Origins {
		u, err := url.Parse(strings.TrimSpace(raw))
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
			return errors.New("CORS_ORIGINS must contain exact HTTP(S) origins without paths")
		}
	}
	return nil
}

func env(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
func seconds(name string, fallback int) (time.Duration, error) {
	value, err := strconv.Atoi(env(name, strconv.Itoa(fallback)))
	if err != nil {
		return 0, errors.New(name + " must be integer seconds")
	}
	return time.Duration(value) * time.Second, nil
}
