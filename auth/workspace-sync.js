// ===================== Workspace sync (accounts) =====================
//
// Saves the whole calculator workspace to the signed-in user's account and
// restores it on their next visit, on any device: enabled ciphers, custom
// ciphers, colours, code rain style, speed, density, and every option.
//
// It reuses the app's own settings format, the string exportCiphersDB(true)
// produces for localStorage and "Export Settings (JS)", so there is one format
// to maintain rather than a second parallel one that could drift.
//
// Signed-out visitors are untouched: nothing here runs for them, and
// localStorage keeps working exactly as before.

var wsSyncEnabled = false
var wsSyncLoaded = false
var wsSyncLastHash = null
var wsSyncTimer = null
var wsSyncSaving = false
var wsRestoreInProgress = false

var WS_SYNC_TICK_MS = 4000    // settings change far less often than history
var WS_SYNC_QUIET_MS = 2500

function wsHash(s) {
	var h = 5381
	for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
	return s.length + ":" + h.toString(36)
}

function wsCurrentSettings() {
	if (typeof exportCiphersDB !== "function") return null
	try { return exportCiphersDB(true) } catch (e) { return null }
}

// ---- load -------------------------------------------------------------

function wsSyncLoad() {
	var client = getAuthClient()
	if (client === null || authUser === null) return Promise.resolve()

	return client.from("workspaces").select("settings").eq("user_id", authUser.id).maybeSingle()
		.then(function (res) {
			if (res.error) throw res.error

			if (!res.data || !res.data.settings) {
				// nothing saved yet: adopt whatever they are using now as the
				// starting workspace, so the first save is not an empty one
				wsSyncLoaded = true
				var cur = wsCurrentSettings()
				wsSyncLastHash = cur ? wsHash(cur) : null
				return
			}

			wsRestoreInProgress = true
			var applied = false
			try {
				applied = applyCalcSettingsString(res.data.settings, true)
			} catch (e) {
				console.warn("workspace restore failed:", e.message || e)
			}
			wsRestoreInProgress = false

			wsSyncLoaded = true
			wsSyncLastHash = wsHash(res.data.settings)

			if (applied) {
				// the menus were rebuilt by the restore, so put the nav back
				if (typeof renderAuthNav === "function") renderAuthNav()
				if (typeof displayCalcNotification === "function") {
					displayCalcNotification("Workspace restored", 1800)
				}
			}
		})
		.catch(function (err) {
			wsSyncLoaded = true
			console.warn("workspace load failed:", err.message || err)
		})
}

// ---- save -------------------------------------------------------------

function wsSyncSave(force) {
	var client = getAuthClient()
	if (client === null || authUser === null) return Promise.resolve(false)
	if (!wsSyncLoaded && !force) return Promise.resolve(false)
	if (wsSyncSaving) return Promise.resolve(false)

	var settings = wsCurrentSettings()
	if (settings === null) return Promise.resolve(false)

	var hash = wsHash(settings)
	if (hash === wsSyncLastHash && !force) return Promise.resolve(false)

	wsSyncSaving = true
	return client.from("workspaces")
		.upsert({ user_id: authUser.id, settings: settings }, { onConflict: "user_id" })
		.then(function (res) {
			if (res.error) throw res.error
			wsSyncLastHash = hash
			return true
		})
		.catch(function (err) {
			console.warn("workspace save failed:", err.message || err)
			return false
		})
		.then(function (ok) { wsSyncSaving = false; return ok })
}

function wsSyncClear() {
	var client = getAuthClient()
	if (client === null || authUser === null) return Promise.reject(new Error("Not signed in"))
	return client.from("workspaces").delete().eq("user_id", authUser.id)
		.then(function (res) {
			if (res.error) throw res.error
			wsSyncLastHash = null
			return true
		})
}

function wsSyncInfo() {
	var client = getAuthClient()
	if (client === null || authUser === null) return Promise.resolve(null)
	return client.from("workspaces").select("updated_at, settings").eq("user_id", authUser.id).maybeSingle()
		.then(function (res) {
			if (res.error || !res.data) return null
			return { updated_at: res.data.updated_at, bytes: (res.data.settings || "").length }
		})
}

// ---- change watcher ---------------------------------------------------
//
// Same approach as the history sync: settings are mutated from dozens of
// conf_* handlers and colour sliders, so rather than hooking every one this
// watches the serialised form and reacts when it changes.

var wsQuietUntil = 0

function wsSyncTick() {
	if (!wsSyncEnabled || !wsSyncLoaded || wsRestoreInProgress) return
	var settings = wsCurrentSettings()
	if (settings === null) return
	var hash = wsHash(settings)
	if (hash === wsSyncLastHash) return

	var now = Date.now()
	if (hash !== wsSyncTick.seen) {
		wsSyncTick.seen = hash
		wsQuietUntil = now + WS_SYNC_QUIET_MS
		return
	}
	if (now < wsQuietUntil) return
	wsSyncSave()
}

function wsSyncStart() {
	if (wsSyncTimer !== null) return
	wsSyncTimer = setInterval(wsSyncTick, WS_SYNC_TICK_MS)
}

function wsSyncStop() {
	if (wsSyncTimer !== null) { clearInterval(wsSyncTimer); wsSyncTimer = null }
	wsSyncEnabled = false
	wsSyncLoaded = false
	wsSyncLastHash = null
}

// ---- wiring -----------------------------------------------------------

$(document).ready(function () {
	if (typeof exportCiphersDB !== "function") return // not the calculator page

	// Restoring a page never implies consent to reset or overwrite its workspace.
	onAuthReady(function (user) {
		if (user === null) return
		wsSyncEnabled = true
		wsSyncLoad().then(wsSyncStart)
	})

	var client = getAuthClient()
	if (client !== null) {
		client.auth.onAuthStateChange(function (event) {
			if (event === "SIGNED_IN" && !wsSyncEnabled) {
				wsSyncEnabled = true
				wsSyncLoad().then(wsSyncStart)
			} else if (event === "SIGNED_OUT") {
				wsSyncStop()
			}
		})
	}

	$(window).on("beforeunload", function () {
		if (wsSyncEnabled && wsSyncLoaded) wsSyncSave()
	})
})
