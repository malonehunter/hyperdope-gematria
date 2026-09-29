// ====================== History sync (accounts) ======================
//
// Mirrors the History Table into public.history_entries for signed-in users,
// so it survives a refresh and follows them between devices. Signed-out
// visitors are untouched: the calculator keeps working entirely in memory
// exactly as it did before, and nothing here runs for them.
//
// Change detection: sHistory is mutated from about a dozen places across
// calc.js, highlighter.js, init-variables.js and export-csv.js, several of them
// inline handlers. Rather than patch every one of those call sites (easy to
// miss one, and it would fight future upstream changes), this watches for the
// array's contents changing and reacts. The check is a cheap rolling hash, so
// it costs nothing on a quiet page.

var histSyncEnabled = false
var histSyncLastHash = null     // hash of what the server is believed to hold
var histSyncTimer = null
var histSyncSaving = false
var histSyncPending = false
var histSyncLoaded = false      // don't push anything before the first load
var histSyncStatusEl = null

var HIST_SYNC_TICK_MS = 1200    // how often to look for a change
var HIST_SYNC_QUIET_MS = 900    // wait for edits to settle before writing
var HIST_SYNC_MAX = 2000        // safety cap on rows per user

// djb2 over the joined history; the separator cannot appear in a phrase
function histHash(arr) {
	var s = arr.join("\u0000")
	var h = 5381
	for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
	return arr.length + ":" + h.toString(36)
}

function histSyncSetStatus(text, kind) {
	if (histSyncStatusEl === null) histSyncStatusEl = document.getElementById("histSyncStatus")
	if (histSyncStatusEl === null) return
	histSyncStatusEl.textContent = text || ""
	histSyncStatusEl.className = "histSyncStatus" + (kind ? " histSync-" + kind : "")
	histSyncStatusEl.classList.toggle("hideValue", !text)
}

// ---- load -------------------------------------------------------------

// Called once the user is known to be signed in. Merges rather than replaces:
// whatever is already on screen is kept, and saved phrases are added around it,
// so signing in never destroys work in progress.
function histSyncLoad() {
	var client = getAuthClient()
	if (client === null || authUser === null) return Promise.resolve()

	histSyncSetStatus("Loading saved history…", "busy")

	return client.from("history_entries")
		.select("phrase, position")
		.order("position", { ascending: true })
		.then(function (res) {
			if (res.error) throw res.error

			var saved = (res.data || []).map(function (r) { return r.phrase })
			var local = (typeof sHistory !== "undefined") ? sHistory.slice() : []

			// union, saved order first, then anything typed before signing in
			var seen = {}
			var merged = []
			saved.concat(local).forEach(function (p) {
				if (p && seen[p] !== true) { seen[p] = true; merged.push(p) }
			})

			var added = merged.length - local.length

			if (typeof sHistory !== "undefined") {
				sHistory.length = 0
				for (var i = 0; i < merged.length; i++) sHistory.push(merged[i])
				if (typeof histDisplayOrder !== "undefined") histDisplayOrder = null
				if (typeof updateTables === "function") updateTables()
			}

			histSyncLoaded = true
			histSyncLastHash = histHash(saved) // what the server actually holds

			if (added > 0) {
				histSyncSetStatus("Restored " + added + (added === 1 ? " phrase" : " phrases"), "ok")
				if (typeof displayCalcNotification === "function") {
					displayCalcNotification("Restored " + added + (added === 1 ? " saved phrase" : " saved phrases"), 2200)
				}
			} else {
				histSyncSetStatus("Synced", "ok")
			}

			// local had phrases the server did not, push them straight away
			if (merged.length !== saved.length) histSyncSave()
		})
		.catch(function (err) {
			histSyncLoaded = true // let saving proceed; a later write may succeed
			histSyncSetStatus("Sync unavailable", "warn")
			console.warn("history sync load failed:", err.message || err)
		})
}

// ---- save -------------------------------------------------------------

function histSyncSave() {
	var client = getAuthClient()
	if (client === null || authUser === null || !histSyncLoaded) return Promise.resolve()
	if (histSyncSaving) { histSyncPending = true; return Promise.resolve() }

	var snapshot = (typeof sHistory !== "undefined") ? sHistory.slice(0, HIST_SYNC_MAX) : []
	var hash = histHash(snapshot)
	if (hash === histSyncLastHash) return Promise.resolve()

	histSyncSaving = true
	histSyncSetStatus("Saving…", "busy")

	var rows = snapshot.map(function (p, i) {
		return { user_id: authUser.id, phrase: p, position: i }
	})

	// Remove anything no longer present, then upsert the rest. Two statements
	// rather than delete-all-and-reinsert, so created_at survives on phrases
	// that were already saved.
	var del = client.from("history_entries").delete().eq("user_id", authUser.id)
	if (snapshot.length > 0) del = del.not("phrase", "in", "(" + snapshot.map(histSqlQuote).join(",") + ")")

	return del
		.then(function (res) {
			if (res.error) throw res.error
			if (rows.length === 0) return { error: null }
			return client.from("history_entries").upsert(rows, { onConflict: "user_id,phrase" })
		})
		.then(function (res) {
			if (res && res.error) throw res.error
			histSyncLastHash = hash
			histSyncSetStatus("Saved", "ok")
			setTimeout(function () { histSyncSetStatus("Synced", "ok") }, 1200)
		})
		.catch(function (err) {
			histSyncSetStatus("Not saved", "warn")
			console.warn("history sync save failed:", err.message || err)
		})
		.then(function () {
			histSyncSaving = false
			if (histSyncPending) { histSyncPending = false; histSyncSave() }
		})
}

// PostgREST's in() filter takes a bare list, so quote and escape each phrase
function histSqlQuote(s) {
	return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'
}

// ---- change watcher ---------------------------------------------------

var histSyncQuietUntil = 0

// Writes any pending edit immediately, skipping the quiet period.
//
// The tick deliberately waits for typing to stop so a burst of edits becomes
// one write. That is right in the background and wrong the moment something
// wants to read the list back, so anywhere that displays saved phrases calls
// this first and waits for it.
function histSyncFlush() {
	if (!histSyncEnabled || !histSyncLoaded) return Promise.resolve()
	histSyncQuietUntil = 0
	return histSyncSave()
}

function histSyncTick() {
	if (!histSyncEnabled || !histSyncLoaded || typeof sHistory === "undefined") return
	var hash = histHash(sHistory)
	if (hash === histSyncLastHash) return

	// wait for a quiet moment so a burst of edits becomes one write
	var now = Date.now()
	if (hash !== histSyncTick.seen) {
		histSyncTick.seen = hash
		histSyncQuietUntil = now + HIST_SYNC_QUIET_MS
		return
	}
	if (now < histSyncQuietUntil) return
	histSyncSave()
}

function histSyncStart() {
	if (histSyncTimer !== null) return
	histSyncTimer = setInterval(histSyncTick, HIST_SYNC_TICK_MS)
}

function histSyncStop() {
	if (histSyncTimer !== null) { clearInterval(histSyncTimer); histSyncTimer = null }
	histSyncEnabled = false
	histSyncLoaded = false
	histSyncLastHash = null
	histSyncSetStatus("", null)
}

// ---- account actions --------------------------------------------------

// Used by the profile page. Clears the saved copy only; whatever is on screen
// stays there until the user clears it themselves.
function histSyncClearSaved() {
	var client = getAuthClient()
	if (client === null || authUser === null) return Promise.reject(new Error("Not signed in"))
	return client.from("history_entries").delete().eq("user_id", authUser.id)
		.then(function (res) {
			if (res.error) throw res.error
			histSyncLastHash = histHash([])
			return true
		})
}

function histSyncCount() {
	var client = getAuthClient()
	if (client === null || authUser === null) return Promise.resolve(0)
	return client.from("history_entries")
		.select("id", { count: "exact", head: true })
		.eq("user_id", authUser.id)
		.then(function (res) { return res.error ? 0 : (res.count || 0) })
}

// ---- wiring -----------------------------------------------------------

// Reload timing is never consent to clear local or saved history.
$(document).ready(function () {
	// only the calculator page has a History Table to sync
	if (typeof sHistory === "undefined") return

	onAuthReady(function (user) {
		if (user === null) return
		histSyncEnabled = true
		histSyncLoad().then(histSyncStart)
	})

	// signing in or out mid-session, including from another tab
	var client = getAuthClient()
	if (client !== null) {
		client.auth.onAuthStateChange(function (event) {
			if (event === "SIGNED_IN" && !histSyncEnabled) {
				histSyncEnabled = true
				histSyncLoad().then(histSyncStart)
			} else if (event === "SIGNED_OUT") {
				histSyncStop()
			}
		})
	}

	// last chance to flush an edit made moments before leaving
	$(window).on("beforeunload", function () {
		if (histSyncEnabled && histSyncLoaded) histSyncSave()
	})
})
