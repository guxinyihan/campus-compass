package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"campuscompass/tracking/internal/tracking"
	"github.com/redis/go-redis/v9"
)

func main() {
	cfg, err := tracking.LoadConfig()
	if err != nil {
		log.Fatal(err)
	}
	client := redis.NewClient(&redis.Options{Addr: cfg.RedisAddr, Protocol: 2, DisableIndentity: true, DialTimeout: 3 * time.Second, ReadTimeout: 3 * time.Second, WriteTimeout: 3 * time.Second})
	defer client.Close()
	service, err := tracking.New(cfg, client)
	if err != nil {
		log.Fatal(err)
	}
	defer service.Close()
	server := &http.Server{Addr: cfg.Addr, Handler: service.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 8192}
	stopping := make(chan os.Signal, 1)
	signal.Notify(stopping, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-stopping
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
	}()
	log.Print("CampusCompass tracking listening")
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal("tracking HTTP server stopped")
	}
}
