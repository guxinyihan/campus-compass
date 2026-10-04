package tracking

import (
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var vehicleIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`)

type trackingClaims struct {
	Role      string `json:"role"`
	VehicleID string `json:"vehicleId"`
	TokenType string `json:"tokenType"`
	jwt.RegisteredClaims
}

func (s *Service) authorize(r *http.Request, vehicleID string) (int, error) {
	parts := strings.Fields(r.Header.Get("Authorization"))
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || len(parts[1]) > 4096 {
		return http.StatusUnauthorized, errors.New("Valid driver tracking authorization required")
	}
	claims := &trackingClaims{}
	token, err := jwt.ParseWithClaims(parts[1], claims, func(token *jwt.Token) (interface{}, error) { return []byte(s.cfg.Secret), nil }, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer("campuscompass-api"), jwt.WithAudience("campuscompass-tracking"), jwt.WithExpirationRequired(), jwt.WithIssuedAt())
	if err != nil || !token.Valid || claims.IssuedAt == nil || claims.ExpiresAt == nil || claims.Subject == "" || len(claims.Subject) > 64 || claims.ExpiresAt.Sub(claims.IssuedAt.Time) <= 0 || claims.ExpiresAt.Sub(claims.IssuedAt.Time) > 120*time.Second || claims.TokenType != "tracking" {
		return http.StatusUnauthorized, errors.New("Valid driver tracking authorization required")
	}
	if claims.Role != "driver" || claims.VehicleID != vehicleID {
		return http.StatusForbidden, errors.New("Driver is not authorized for this vehicle")
	}
	return 0, nil
}
