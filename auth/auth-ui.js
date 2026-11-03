// ====================== Authentication UI =========================
//
// Shared helpers for the auth pages plus the signed-in/signed-out state in the
// calculator's nav row. Kept separate from auth.js so the logic can be reused
// or tested without the DOM pieces.

// All user-supplied text goes through this before touching innerHTML.
function authEsc(s) {
	return String(s === null || s === undefined ? "" : s)
		.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

// For text going inside a JS string literal that itself sits inside an
// inline onclick="..." HTML attribute - authEsc alone is NOT enough there.
// authEsc escapes a raw " into the literal characters &quot;, but the
// browser's HTML parser decodes &quot; back into a real " before handing
// the attribute's text to the JS engine, at which point that quote can
// close the JS string literal early and let whatever follows run as
// script. (The rest of the payload after that point does not need to be
// valid JS on its own - a trailing // comments out whatever the template
// adds after the injection point.)
//
// The fix is to escape for the JS-string layer FIRST (so a real " becomes
// the two characters \" , which is a valid escaped-quote inside a JS
// string and does not close it) and only THEN escape for the HTML-
// attribute layer (authEsc) on top of that - reversing the order leaves
// the JS-breaking quote intact. Call this instead of
// authEsc(x).replace(/"/g,'&quot;') at any onclick="fn(&quot;'+HERE+'&quot;)"
// site where the value is not already known-safe (a uuid, an enum).
// A raise exception('...') from one of this app's own functions is written
// to be read by a member and is safe to show verbatim - that is the
// pass-through every *Error() mapper (friendsError, forumError, ...) relies
// on. An error Postgres raises on its own - a constraint violation, an RLS
// denial, a type error - was never written for an end user and can name a
// real table, column or index. Matched by shape (phrasing Postgres always
// uses for these) rather than trying to enumerate every possible message,
// since a mapper cannot tell the two apart just by "did .rpc() reject".
function authIsRawDbError(msg) {
	return /violates|constraint "|relation "|column "|permission denied|row-level security|duplicate key|null value in column|invalid input syntax/i.test(String(msg || ""))
}

// The flip side of hiding raw database errors: when something genuinely
// breaks, "Something went wrong" is as useless to whoever has to fix it
// as it is safe to show a member. This puts the real message back within
// reach without putting it on screen - set CY_DEBUG = true in the
// console and the next failure logs its actual Postgres error there.
//
// Off by default and never on for an ordinary visitor, so the reason
// those messages were made generic in the first place still holds: a
// constraint name or a policy name is not something to hand out to
// anybody who happens to open dev tools.
// Three ways to turn this on, in order of how little you have to know:
//   * add ?debug=1 to the address - nothing to type into a console
//   * be on localhost, where anyone looking is working on the site
//   * set CY_DEBUG = true by hand
// Anywhere else - cyphers.news without the parameter - it stays off, so
// an ordinary visitor never sees a table or policy name.
function authIsLocalHost() {
	try {
		var h = window.location.hostname
		return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === ""
	} catch (e) { return false }
}

function authDebugOn() {
	try {
		if (window.CY_DEBUG) return true
		if (authIsLocalHost()) return true
		return /[?&]debug=1(&|$)/.test(window.location.search)
	} catch (e) { return false }
}

// Logged to the console AND shown on screen. The on-screen half is the
// point: reading a console means finding dev tools first, which is a
// bigger ask than the bug is worth when the person who needs the answer
// is the one who owns the site.
function authDebugError(where, msg) {
	try {
		if (!authDebugOn()) return
		console.warn("[cyphers] " + where + " raw error:", msg)
		if (typeof displayCalcNotification === "function") {
			displayCalcNotification("DEBUG (" + where + "): " + msg, 9000)
		}
	} catch (e) {}
}

function authEscJs(s) {
	var raw = String(s === null || s === undefined ? "" : s)
		.replace(/\\/g, "\\\\")
		.replace(/'/g, "\\'")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
	return authEsc(raw)
}

// ---- form feedback ----------------------------------------------------

function authShowMessage(id, text, kind) {
	var el = document.getElementById(id)
	if (el === null) return
	el.className = "authMsg authMsg-" + (kind || "error")
	el.innerHTML = authEsc(text)
	el.classList.remove("hideValue")
}

function authClearMessage(id) {
	var el = document.getElementById(id)
	if (el === null) return
	el.innerHTML = ""
	el.classList.add("hideValue")
}

function authSetLoading(btnId, loading, idleLabel) {
	var btn = document.getElementById(btnId)
	if (btn === null) return
	btn.disabled = !!loading
	if (loading) {
		btn.dataset.idle = btn.dataset.idle || btn.value || btn.textContent
		var label = '<span class="authSpinner"></span>Working…'
		if (btn.tagName === "BUTTON") btn.innerHTML = label; else btn.value = "Working…"
	} else {
		var back = idleLabel || btn.dataset.idle || "Continue"
		if (btn.tagName === "BUTTON") btn.textContent = back; else btn.value = back
	}
}

function authFieldError(fieldId, text) {
	var el = document.getElementById(fieldId + "Err")
	var input = document.getElementById(fieldId)
	if (el !== null) {
		el.textContent = text || ""
		el.classList.toggle("hideValue", !text)
	}
	if (input !== null) input.classList.toggle("authInputBad", !!text)
}

function authClearFieldErrors(ids) {
	for (var i = 0; i < ids.length; i++) authFieldError(ids[i], "")
}

// ---- nav state --------------------------------------------------------

// Rendered into #authNavArea, which the auth pages and the calculator share.
function renderAuthNav() {
	var area = document.getElementById("authNavArea")
	if (area === null) return

	if (!authIsConfigured()) {
		area.innerHTML = '<span class="authNavNote" title="Add your project URL and anon key in auth/supabase-config.js">Auth not configured</span>'
		return
	}

	var o = ""
	if (authUser === null) {
		// One way in, not two. Login is the door; the sign-in page carries its own
		// "No account yet? Create one", so nobody without an account is stuck -
		// and the pair side by side made a visitor choose before they had any
		// reason to care which one they were.
		o += '<a class="authNavLink authNavPrimary" href="login.html">Login</a>'
	} else {
		// On the calculator the name opens the profile panel in place. On the
		// auth pages there is no panel to open, so it stays a link to the full
		// profile page.
		var avatar = authAvatarUrl()
		var inApp = (typeof toggleProfileMenu === "function")
		o += inApp
			? '<a class="authNavUser" href="#" title="Your profile" onclick="event.preventDefault();toggleProfileMenu()">'
			: '<a class="authNavUser" href="profile.html?stay=1" title="Your profile">'
		if (avatar) o += '<img class="authNavAvatar" src="' + authEsc(avatar) + '" alt="">'
		else o += '<span class="authNavAvatar authNavAvatarFallback">' + authEsc(authDisplayName().charAt(0).toUpperCase()) + '</span>'
		o += '<span class="authNavName">' + authEsc(authDisplayName()) + '</span>'
		o += '</a>'
		// A member reload restores account-backed history, so it cannot also be the
		// way to start with an empty table. Keep this explicit destructive action
		// on the calculator only; its handler requires a second deliberate click.
		if (inApp) {
			o += '<a class="authNavLink authNavHistoryClear" href="#" title="Click once to arm, again to clear saved phrase history" aria-label="Clear saved phrase history; requires two clicks" onclick="return authNavClearHistory(this,event)">&#8635; Clear</a>'
		}
		// only drawn for admins, and only as a shortcut - admin.html checks for
		// itself and every function it calls checks again in the database
		if (typeof adminIsAdmin !== "undefined" && adminIsAdmin === true) {
			o += '<a class="authNavLink authNavAdmin" href="admin.html" title="Admin panel">&#128737; Admin</a>'
		}
		o += '<a class="authNavLink" href="#" onclick="authNavSignOut(event)">Logout</a>'
	}
	area.innerHTML = o
}

function authNavClearHistory(el, e) {
	if (e) e.preventDefault()
	var confirmed = (typeof profileConfirmClick === "function")
		? profileConfirmClick(el, "Clear?")
		: window.confirm("Clear your saved phrase history?")
	if (!confirmed) return false

	// Never race an in-flight account restore: stale rows could arrive after the
	// clear and make it look as if the action failed.
	if (typeof histSyncLoaded !== "undefined" && histSyncLoaded !== true) {
		if (typeof displayCalcNotification === "function") displayCalcNotification("Wait for saved history to finish loading", 2600)
		return false
	}
	if (typeof histSyncSaving !== "undefined" && histSyncSaving === true) {
		if (typeof displayCalcNotification === "function") displayCalcNotification("Wait for saved history to finish saving", 2600)
		return false
	}

	if (typeof phraseBoxKeypress === "function") phraseBoxKeypress(36)
	if (typeof histSyncClearSaved === "function") {
		histSyncClearSaved().then(function () {
			if (typeof displayCalcNotification === "function") displayCalcNotification("Saved history cleared", 2200)
		}).catch(function () {
			if (typeof displayCalcNotification === "function") displayCalcNotification("History cleared here; saved copy could not be cleared", 3200)
		})
	} else if (typeof displayCalcNotification === "function") {
		displayCalcNotification("History cleared here; saved copy is unavailable", 3200)
	}
	return false
}

function authNavSignOut(e) {
	if (e) e.preventDefault()
	authSignOut().then(function () {
		renderAuthNav()
		// send the user somewhere public if they were on a gated page
		var page = window.location.pathname.split("/").pop()
		if (page === "profile.html") window.location.href = "login.html"
	})
}

$(document).ready(function () {
	onAuthReady(renderAuthNav)
})

// Flashes the back link green on click, matching the Find Matches tab, so the
// press registers before the navigation happens.
function authBackFlash(el) {
	if (!el) return
	el.classList.remove("authBackFlash")
	void el.offsetWidth // restart the animation rather than letting it no-op
	el.classList.add("authBackFlash")
}
