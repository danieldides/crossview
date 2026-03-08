package sso

import (
	"testing"

	"crossview-go-server/lib"
	"crossview-go-server/models"

	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/spf13/viper"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestLogger() lib.Logger {
	return lib.GetLogger()
}

func setupTestEnv() lib.Env {
	return lib.Env{
		CORSOrigin: "http://localhost:5173",
	}
}

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	m.Run()
}

func setupTestRouter() *gin.Engine {
	return gin.New()
}

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.User{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func setupTestSessionStore() sessions.Store {
	return cookie.NewStore([]byte("test-secret-42"))
}

func setupBaseEnv() lib.Env {
	return lib.Env{
		CORSOrigin:      "http://localhost:5173",
		AuthMode:        "session",
		AuthCreateUsers: true,
		AuthDefaultRole: "viewer",
	}
}

func TestSSOConfig_Disabled(t *testing.T) {
	env := setupBaseEnv()
	cfg := lib.GetSSOConfig(env)
	assert.False(t, cfg.Enabled)
	assert.False(t, cfg.OIDC.Enabled)
	assert.False(t, cfg.SAML.Enabled)
}

func TestSSOConfig_OIDC_Enabled(t *testing.T) {
	env := setupBaseEnv()
	t.Setenv("OIDC_ENABLED", "true")
	cfg := lib.GetSSOConfig(env)
	assert.True(t, cfg.Enabled)
	assert.True(t, cfg.OIDC.Enabled)
	assert.False(t, cfg.SAML.Enabled)
	assert.Equal(t, "http://localhost:8080/realms/crossview", cfg.OIDC.Issuer)
	assert.Equal(t, "crossview-client", cfg.OIDC.ClientId)
	assert.Equal(t, "openid profile email", cfg.OIDC.Scope)
}

func TestSSOConfig_SAML_Enabled(t *testing.T) {
	env := setupBaseEnv()
	t.Setenv("SAML_ENABLED", "true")
	cfg := lib.GetSSOConfig(env)
	assert.True(t, cfg.Enabled)
	assert.False(t, cfg.OIDC.Enabled)
	assert.True(t, cfg.SAML.Enabled)
	assert.Equal(t, "http://localhost:8080/realms/crossview/protocol/saml", cfg.SAML.EntryPoint)
	assert.Equal(t, "crossview", cfg.SAML.Issuer)
}

func TestSSOConfig_Both_Enabled(t *testing.T) {
	env := setupBaseEnv()
	t.Setenv("OIDC_ENABLED", "true")
	t.Setenv("SAML_ENABLED", "true")
	cfg := lib.GetSSOConfig(env)
	assert.True(t, cfg.Enabled)
	assert.True(t, cfg.OIDC.Enabled)
	assert.True(t, cfg.SAML.Enabled)
}

func TestSSOConfig_OIDC_Overrides(t *testing.T) {
	env := setupBaseEnv()
	t.Setenv("OIDC_ENABLED", "true")
	t.Setenv("OIDC_ISSUER", "https://auth.real.com")
	t.Setenv("OIDC_CLIENT_ID", "app-xyz")
	t.Setenv("OIDC_CALLBACK_URL", "https://app.example.com/cb")
	cfg := lib.GetSSOConfig(env)
	assert.Equal(t, "https://auth.real.com", cfg.OIDC.Issuer)
	assert.Equal(t, "app-xyz", cfg.OIDC.ClientId)
	assert.Equal(t, "https://app.example.com/cb", cfg.OIDC.CallbackURL)
}

func TestSSOConfig_SAML_Cert_Path(t *testing.T) {
	env := setupBaseEnv()
	t.Setenv("SAML_ENABLED", "true")
	t.Setenv("SAML_CERT", "/does/not/exist/cert.pem")
	cfg := lib.GetSSOConfig(env)
	assert.Empty(t, cfg.SAML.Cert)
}

func TestSSOConfig_Priority_Env_Over_Viper(t *testing.T) {
	env := setupBaseEnv()
	t.Setenv("OIDC_ENABLED", "true")
	t.Setenv("OIDC_ISSUER", "env-issuer")
	viper.Set("sso.oidc.issuer", "viper-issuer")
	cfg := lib.GetSSOConfig(env)
	assert.Equal(t, "env-issuer", cfg.OIDC.Issuer)
}
