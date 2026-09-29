// ===================== Reset to defaults =====================
//
// One way back to a known-good calculator: the shipped cyphers, the shipped
// options, an empty History Table and no Find Matches filter left running.
// Available explicitly from the right-click menu; reloading never resets.
//
// The code rain is deliberately left alone. It is the one thing people tune to
// taste and then leave, and it is never the reason someone wants to start over,
// so a reset that wiped it would cost more than it fixed.
//
// This file must load after every script that declares an option variable
// (calc.js, encoding.js, coderain.js) and before anything that restores saved
// settings, because the snapshot below is taken while the values are still the
// ones the app shipped with.

// Option names kept as they are. These are exactly the code rain entries of
// calcOptionsArr; the interface and font colours are not among them, so a reset
// does put the theme back to the default blue.
var resetKeepOptions = [
	"optMatrixCodeRain",
	"optCoderainFollowCipher",
	"coderainStyle",
	"coderainDensity",
	"coderainSpeedMul",
	"coderainHue",
	"coderainSat",
	"coderainLit",
	"coderainColorPicked"
]

// The shipped option values, in the same "name = value" form importCalcOptions
// consumes. Captured once, at parse time, so it survives every later restore.
var calcFactoryOptions = null

function captureFactoryOptions() {
	if (calcFactoryOptions !== null) return calcFactoryOptions
	if (typeof exportCalcOptions !== "function" || typeof isJsonString !== "function") return null
	try {
		var m = exportCalcOptions().match(/(?<=calcOptions = )[\s\S]*?\]/m)
		if (m !== null && isJsonString(m[0])) calcFactoryOptions = JSON.parse(m[0])
	} catch (e) {
		console.warn("could not capture the default options:", e.message || e)
	}
	return calcFactoryOptions
}
captureFactoryOptions()

// ---- the reset itself --------------------------------------------------

function resetCalcToDefaults(silent) {
	var defaults = captureFactoryOptions()

	// 1. options, minus the code rain ones
	if (defaults !== null) {
		var keep = []
		for (var i = 0; i < defaults.length; i++) {
			var name = String(defaults[i]).split(" = ")[0]
			if (resetKeepOptions.indexOf(name) === -1) keep.push(defaults[i])
		}
		importCalcOptions(keep)
	}

	// 2. the History Table, the Find Matches filter and the value box beside the
	// phrase box. removeActiveFilter() is not used here: it puts back the
	// cyphers that were open before the filter, which is the opposite of what a
	// reset wants.
	sHistory = []
	// updateHistoryTable() returns early on an empty history and leaves the
	// markup it drew last time on screen, so the area is emptied here the same
	// way the Clear History button does it.
	var histArea = document.getElementById("HistoryTableArea")
	if (histArea !== null) histArea.innerHTML = ""
	if (typeof userHistory !== "undefined") userHistory = []
	if (typeof userOpenCiphers !== "undefined") userOpenCiphers = []
	if (typeof histDisplayOrder !== "undefined") histDisplayOrder = null // also drops hiddenCiphers
	$("#highlightBox").val("")
	$("#phraseBox").val("")
	$("#clearFilterButton").html("")

	// Cleared on the account as well, or the next sync sees a table with rows
	// on the server and none here, and puts them all back.
	if (typeof histSyncLastHash !== "undefined") histSyncLastHash = null
	if (typeof histSyncClearSaved === "function") {
		histSyncClearSaved().catch(function () { /* offline: the local clear still stands */ })
	}

	// 3. rebuild the menus so every tickbox shows its reset value, then put the
	// cypher selection back to the built-in base four
	document.getElementById("calcOptionsPanel").innerHTML = ""
	initCalc(false, true)
	if (typeof enableDefaultCiphers === "function") enableDefaultCiphers()

	updateTables()
	updateInterfaceColor(true)
	if (typeof coderainApplyBackdrop === "function") coderainApplyBackdrop()
	if (typeof toggleCodeRain === "function") toggleCodeRain()

	// let the account sync notice, rather than treating this as unchanged
	if (typeof wsSyncLastHash !== "undefined") wsSyncLastHash = null

	if (!silent && typeof displayCalcNotification === "function") {
		displayCalcNotification("Reset to default — table cleared, code rain kept", 2600)
	}
	return true
}
