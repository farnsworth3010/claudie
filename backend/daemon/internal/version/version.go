// Package version names the daemon's release; the plugin's hook replaces a daemon of another version.
package version

// Dev marks a build from source, which a released plugin never replaces.
const Dev = "dev"

// Version is set at release builds with -ldflags "-X claudie/daemon/internal/version.Version=X.Y.Z".
var Version = Dev
