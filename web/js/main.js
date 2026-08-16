import * as idbKeyval from "/js/external/idb-keyval.js";
import * as DataManager from "/js/data-manager.js";
import * as NotificationManager from "/js/notification-manager.js";
import { MINIMUM_FEATURES_SUPPORTED, storageManagerPersistSupported } from "/js/browser-support.js";
import * as RandomPhrase from "/js/passphrase/random-phrase.js";
import * as PeriodPrediction from "/js/period-prediction.js";

const b64AB = window["base64-arraybuffer"];
const UNSET = Symbol("unset");
const UAT_MODE = (
	new URLSearchParams(window.location.search).get("uat") === "1" &&
	["localhost","127.0.0.1","::1"].includes(window.location.hostname)
);
const UAT_ACCOUNT_ID = "localtracking-uat-testing";
const DEFAULT_PROFILE_ICON = "/assets/wolf-avatar-howling-moon.png";
const PROFILE_ICONS = new Set([
	"/assets/wolf-icon-charcoal-front.png",
	"/assets/wolf-icon-lavender-front.png",
	"/assets/wolf-icon-silver-front.png",
	"/assets/wolf-icon-teal-front.png",
]);
const TRACKER_ICONS = new Map([
	["/assets/misc-tracking/lightning-icon-cyan-alt.png","Lightning"],
	["/assets/misc-tracking/paw-print-motif-cyan.png","Cyan paw print"],
	["/assets/misc-tracking/paw-print-motif-gold.png","Gold paw print"],
	["/assets/misc-tracking/sprite-6-4.png","Tracker symbol"],
	["/assets/misc-tracking/sprite-8-6.png","Tracker badge"],
	["/assets/misc-tracking/wolf-avatar-amber-eyes.png","Amber-eyed wolf"],
	["/assets/misc-tracking/wolf-avatar-gray-snarl.png","Gray wolf"],
]);
var createProfileFormEl;
var passphraseSuggestionFormEl;
var loginFormEl;
var savedDataFormEl;
var changePassphraseFormEl;
var restoreBackupFormEl;
var profileNameSelectorEl;
var profileLabelEl;
var profileAvatarEl;
var authWorker;
var tmpDataBackup = UNSET;
var currentKeyText;
var pendingBackup;
var periodData = { version: 2, cycles: [], medications: [], reminders: { medicationTimes: {}, periodDaysBefore: null, }, };
var calendarMonth = new Date(new Date().getFullYear(),new Date().getMonth(),1);

document.addEventListener("DOMContentLoaded",() => main().catch(err => {
	console.error("[Moon.Time] startup failed; interactive controls may remain hidden/inert",err);
}),false);


// ****************************

async function main() {
	var bodyEl = document.querySelector("body");
	console.info("[Moon.Time] startup",{
		url: window.location.href,
		hostname: window.location.hostname,
		uatMode: UAT_MODE,
		minimumFeaturesSupported: MINIMUM_FEATURES_SUPPORTED,
		secureContext: window.isSecureContext,
		indexedDB: "indexedDB" in window,
		webCryptoSubtle: Boolean(window.crypto && window.crypto.subtle),
		worker: "Worker" in window,
	});
	createProfileFormEl = document.getElementById("create-profile");
	passphraseSuggestionFormEl = document.getElementById("generate-passphrase-suggestion");
	loginFormEl = document.getElementById("login");
	savedDataFormEl = document.getElementById("saved-data");
	changePassphraseFormEl = document.getElementById("change-secure-passphrase");
	restoreBackupFormEl = document.getElementById("restore-backup");
	profileNameSelectorEl = document.getElementById("profile-names");
	profileLabelEl = document.getElementById("profile-label");
	profileAvatarEl = document.getElementById("profile-avatar");

	NotificationManager.init(bodyEl);
	console.info("[Moon.Time] controls initialized",{
		createProfileForm: Boolean(createProfileFormEl),
		loginForm: Boolean(loginFormEl),
		savedDataForm: Boolean(savedDataFormEl),
		changePassphraseForm: Boolean(changePassphraseFormEl),
		restoreBackupForm: Boolean(restoreBackupFormEl),
	});
	logDateEntryDiagnostics("controls-initialized");
	for (let input of document.querySelectorAll("[data-date-input]")) {
		for (let eventName of ["focus", "input", "change"]) {
			input.addEventListener(eventName,() => logDateEntryDiagnostics(`${eventName}:${input.id}`),false);
		}
	}

	if (!MINIMUM_FEATURES_SUPPORTED) {
		showUnsupportedBrowserPage();
	}

	eventHandlers: {
		let createAnotherProfileBtn = document.getElementById("create-another-profile-btn");
		createAnotherProfileBtn.addEventListener("click",showRegistrationPage,false);

		let logoutBtn = document.getElementById("logout-btn");
		logoutBtn.addEventListener("click",onLogout,false);

		let changePassphraseBtn = document.getElementById("change-passphrase-btn");
		changePassphraseBtn.addEventListener("click",showChangePassphrasePage,false);

		let deleteProfileBtn = document.getElementById("delete-profile-btn");
		deleteProfileBtn.addEventListener("click",onStartDeleteProfile,false);

		createProfileFormEl.addEventListener("submit",onCreateProfile,false);
		passphraseSuggestionFormEl.addEventListener("submit",onSuggestPassphrase,false);
		loginFormEl.addEventListener("submit",onLogin,false);
		savedDataFormEl.addEventListener("submit",onSaveData,false);
		changePassphraseFormEl.addEventListener("submit",onChangePassphrase,false);
		restoreBackupFormEl.addEventListener("submit",onRestoreBackup,false);
		document.getElementById("export-backup-btn").addEventListener("click",onExportBackup,false);
		document.getElementById("save-medication-btn").addEventListener("click",onSaveMedication,false);
		document.getElementById("cancel-medication-btn").addEventListener("click",resetMedicationEditor,false);
		document.getElementById("medication-list").addEventListener("click",onMedicationAction,false);
		document.getElementById("today-medication-log").addEventListener("click",onMedicationAction,false);
		document.getElementById("save-tracker-btn").addEventListener("click",onSaveTracker,false);
		document.getElementById("cancel-tracker-btn").addEventListener("click",resetTrackerEditor,false);
		document.getElementById("tracker-list").addEventListener("click",onTrackerAction,false);
		document.getElementById("log-trackers-btn").addEventListener("click",onLogTrackers,false);
		document.getElementById("tracker-log-date").addEventListener("change",renderTodayTrackerLog,false);
		document.getElementById("period-reminder-days").addEventListener("change",onReminderSettingsChange,false);
		document.getElementById("request-notification-btn").addEventListener("click",onRequestNotifications,false);
		document.querySelector('[data-calendar="prev"]').addEventListener("click",() => changeCalendarMonth(-1),false);
		document.querySelector('[data-calendar="next"]').addEventListener("click",() => changeCalendarMonth(1),false);
	}

	authWorker = new Worker("/js/auth-worker.js");
	authWorker.addEventListener("message",onAuthMessage,false);

	loadProfiles: {
		if (UAT_MODE) await ensureTestingAccount();
		let profiles = await getProfiles();
		populateProfileSelector(profiles);
		document.getElementById("uat-login-note").classList.toggle("hidden",!UAT_MODE);
		console.info("[Moon.Time] profiles loaded",{
			profileCount: Object.keys(profiles).length,
			profileNames: Object.keys(profiles),
			uatAccountPresent: Boolean(profiles.Testing === UAT_ACCOUNT_ID),
		});
	}

	// no registered login(s) yet?
	if (profileNameSelectorEl.options.length == 0) {
		console.info("[Moon.Time] showing registration page");
		showRegistrationPage();
	}
	else {
		let accountID = sessionStorage.getItem("current-account-id");
		let keyText = currentKeyText;

		// already logged in?
		if (accountID && keyText) {
			console.info("[Moon.Time] restoring saved-data page from session");
			await showSavedDataPage();
		}
		else {
			console.info("[Moon.Time] showing login page");
			showLoginPage();
		}
	}
}

async function getProfiles() {
	var profiles = await idbKeyval.get("profiles");
	return profiles || {};
}

async function getAccounts() {
	var accounts = await idbKeyval.get("accounts");
	return accounts || {};
}

async function ensureTestingAccount() {
	let [ profiles, accounts, ] = await Promise.all([
		getProfiles(),
		getAccounts(),
	]);
	if (profiles.Testing && profiles.Testing !== UAT_ACCOUNT_ID) return;
	if (!accounts[UAT_ACCOUNT_ID]) {
		accounts[UAT_ACCOUNT_ID] = {
			profileName: "Testing",
			testAccount: true,
			testKeyText: b64AB.encode(crypto.getRandomValues(new Uint8Array(32))),
		};
		profiles.Testing = UAT_ACCOUNT_ID;
		await Promise.all([
			idbKeyval.set("profiles",profiles),
			idbKeyval.set("accounts",accounts),
		]);
	}
}

async function addProfileAccount(profileName,accountID,profileIcon) {
	var [ profiles, accounts, ] = await Promise.all([
		getProfiles(),
		getAccounts(),
	]);

	if (!(profileName in profiles)) {
		profiles[profileName] = accountID;
		accounts[accountID] = { profileName, profileIcon: normalizeProfileIcon(profileIcon), };
		try {
			await Promise.all([
				idbKeyval.set("profiles",profiles),
				idbKeyval.set("accounts",accounts),
			]);
			populateProfileSelector(profiles);
			return true;
		}
		catch (err) {}
	}
	return false;
}

async function deleteProfile(accountID) {
	var [ profiles, accounts, ] = await Promise.all([
		getProfiles(),
		getAccounts(),
	]);

	var { profileName, } = accounts[accountID];
	delete profiles[profileName];
	delete accounts[accountID];

	try {
		await Promise.all([
			idbKeyval.set("profiles",profiles),
			idbKeyval.set("accounts",accounts),
		]);
		return true;
	}
	catch (err) {}
	return false;
}

function populateProfileSelector(profiles) {
	profileNameSelectorEl.options.length = 0;
	var profileList = Object.entries(profiles).sort((p1,p2) => (
		(p1[0] < p2[0]) ? -1 :
		(p1[0] > p2[0]) ? 1 :
		0
	));

	for (let [ profileName, accountID, ] of profileList) {
		let optEl = document.createElement("option");
		optEl.value = accountID;
		optEl.innerText = profileName;
		profileNameSelectorEl.appendChild(optEl);
	}
}

function normalizeProfileIcon(profileIcon) {
	return PROFILE_ICONS.has(profileIcon) ? profileIcon : DEFAULT_PROFILE_ICON;
}

function normalizeTracker(tracker) {
	return {
		id: String(tracker.id || crypto.randomUUID()), name: String(tracker.name || "Tracker").slice(0,100),
		icon: TRACKER_ICONS.has(tracker.icon) ? tracker.icon : TRACKER_ICONS.keys().next().value,
		notes: String(tracker.notes || "").slice(0,500),
		entries: Array.isArray(tracker.entries) ? tracker.entries.filter(entry => entry && dateFromInput(entry.date)).map(entry => ({ date: entry.date, timestamp: entry.timestamp || new Date().toISOString(), note: String(entry.note || "").slice(0,500) })) : [],
	};
}

async function populateSavedData() {
	setProfileName: {
		let accounts = await getAccounts();
		let accountID = sessionStorage.getItem("current-account-id");
		let account = accounts[accountID];
		profileLabelEl.innerText = account.profileName;
		profileAvatarEl.src = normalizeProfileIcon(account.profileIcon);
	}

	let data = await DataManager.getData(undefined,currentKeyText);
	let needsMigration = false;
	try {
		let parsed = data ? JSON.parse(data) : null;
		periodData = parsed && Array.isArray(parsed.cycles) ? parsed : { version: 3, cycles: [], medications: [], trackers: [], reminders: { medicationTimes: {}, trackerTimes: {}, periodDaysBefore: null, }, };
		if (periodData.version < 2) { periodData = Object.assign(periodData,{ version: 2, medications: [], }); needsMigration = true; }
	periodData.medications = Array.isArray(periodData.medications) ? periodData.medications : [];
	periodData.trackers = Array.isArray(periodData.trackers) ? periodData.trackers.map(normalizeTracker) : [];
	periodData.reminders = periodData.reminders || { medicationTimes: {}, periodDaysBefore: null, };
	periodData.reminders.medicationTimes = periodData.reminders.medicationTimes || {};
	periodData.reminders.trackerTimes = periodData.reminders.trackerTimes || {};
	if (periodData.version < 3) { periodData.version = 3; needsMigration = true; }
	console.info("[Moon.Time] medication data loaded",{
		medicationCount: periodData.medications.length,
		medications: periodData.medications.map(medication => ({
			id: medication.id,
			name: medication.name,
			startDate: medication.startDate,
			endDate: medication.endDate || null,
			adherenceCount: Array.isArray(medication.adherence) ? medication.adherence.length : 0,
		})),
	});
	}
	catch (err) {
		periodData = { version: 3, cycles: [], medications: [], trackers: [], reminders: { medicationTimes: {}, trackerTimes: {}, periodDaysBefore: null, }, };
	}
	renderPeriods();
	renderMedications();
	renderTodayMedicationLog();
	renderTrackerIcons();
	renderTrackers();
	renderTodayTrackerLog();
	calendarMonth = new Date(new Date().getFullYear(),new Date().getMonth(),1);
	renderCalendar();
	if (needsMigration) await DataManager.saveData(JSON.stringify(periodData),undefined,currentKeyText);
	NotificationManager.scheduleReminders(periodData,PeriodPrediction.predict(periodData.cycles));
}

async function onSuggestPassphrase(evt) {
	cancelEvent(evt);

	var suggestionInput = passphraseSuggestionFormEl.querySelector("input[type=text]");
	var submitBtn = passphraseSuggestionFormEl.querySelector("button[type=submit]");
	var wordCountEl = passphraseSuggestionFormEl.querySelector("#generate-passphrase-word-count");

	if (!(
		passphraseSuggestionFormEl.classList.contains("hidden") ||
		submitBtn.disabled
	)) {
		suggestionInput.value = await RandomPhrase.get(wordCountEl.value);
	}
}

async function onCreateProfile(evt) {
	cancelEvent(evt);

	var submitBtn = createProfileFormEl.querySelector("button[type=submit]");

	if (!(
		createProfileFormEl.classList.contains("hidden") ||
		submitBtn.disabled
	)) {
		let profileNameEl = createProfileFormEl.querySelector("#register-profile-name");
		let passphraseEl = createProfileFormEl.querySelector("#register-password");
		let confirmPassphraseEl = createProfileFormEl.querySelector("#register-password-confirm");
		let profileIcon = createProfileFormEl.querySelector("input[name=profile-icon]:checked").value;
		if (profileNameEl.value.length < 2) {
			warn("Please enter a profile name/description at least 2 characters long.");
			return false;
		}
		if (passphraseEl.value.length < 5) {
			warn("Please enter a passphrase at least 5 characters long.");
			return false;
		}
		if (passphraseEl.value !== confirmPassphraseEl.value) {
			warn("Please make sure you enter the exact same passphrase twice.");
			return false;
		}

		let accountID = self.crypto.randomUUID();
		let res = await addProfileAccount(profileNameEl.value,accountID,profileIcon);
		if (!res) {
			warn("Could not add a profile with the given name/description.");
			return false;
		}

		let password = passphraseEl.value.trim();
		passphraseEl.value = "";
		confirmPassphraseEl.value = "";

		notify("Creating profile and credentials, please wait...");

		submitBtn.disabled = true;
		authWorker.postMessage({
			createAuth: {
				password,
				accountID,
			},
		});
	}
}

async function onLogin(evt) {
	cancelEvent(evt);

	var submitBtn = loginFormEl.querySelector("button[type=submit]");

	if (!(
		loginFormEl.classList.contains("hidden") ||
		submitBtn.disabled
	)) {
		let accountID = profileNameSelectorEl.value;
		let passphraseEl = loginFormEl.querySelector("#login-password");
		let password = passphraseEl.value.trim();
		passphraseEl.value = "";
		if (UAT_MODE && accountID === UAT_ACCOUNT_ID) {
			let accounts = await getAccounts();
			let account = accounts[accountID];
			if (account && account.testAccount && account.testKeyText) {
				sessionStorage.setItem("current-account-id",accountID);
				currentKeyText = account.testKeyText;
				NotificationManager.hide();
				await showSavedDataPage();
				return;
			}
		}

		if (password.length < 5) {
			warn("Please login with a passphrase at least 5 characters long.");
			return false;
		}

		notify("Please wait...");

		submitBtn.disabled = true;
		authWorker.postMessage({
			checkAuth: {
				password,
				accountID,
			},
		});
	}
}

async function onExportBackup() {
	let accountID = sessionStorage.getItem("current-account-id");
	let account = await DataManager.getEncryptedAccount(accountID);
	if (!account || !account.data) { warn("There is no encrypted data to export yet."); return; }
	let backup = {
		format: "Moon.Time encrypted backup",
		version: 1,
		exportedAt: new Date().toISOString(),
		accountID,
		account,
	};
	let blob = new Blob([JSON.stringify(backup,null,2)],{ type: "application/json", });
	let url = URL.createObjectURL(blob);
	let link = document.createElement("a");
	link.href = url;
	link.download = `moon-time-backup-${new Date().toISOString().slice(0,10)}.json`;
	link.click();
	URL.revokeObjectURL(url);
	notify("Encrypted backup downloaded. Keep it with your passphrase.");
}

async function onRestoreBackup(evt) {
	cancelEvent(evt);
	let file = document.getElementById("backup-file").files[0];
	let passwordEl = document.getElementById("backup-password");
	if (!file || passwordEl.value.trim().length < 5) { warn("Choose a backup and enter its passphrase (at least 5 characters).",false); return; }
	try {
		let backup = JSON.parse(await file.text());
		if (backup.format !== "Moon.Time encrypted backup" || backup.version !== 1 || !backup.account || !backup.account.keyInfo) throw new Error("Invalid backup");
		pendingBackup = backup;
		authWorker.postMessage({ verifyBackup: { account: backup.account, password: passwordEl.value.trim(), }, });
		passwordEl.value = "";
		notify("Verifying backup passphrase, please wait...");
	}
	catch (err) { console.log(err); warn("Could not read that backup file."); }
}

async function restoreVerifiedBackup(keyText) {
	let backup = pendingBackup;
	pendingBackup = undefined;
	let plaintext = await DataManager.decryptPayload(backup.account,keyText);
	if (!plaintext) throw new Error("Backup decryption failed");
	let profiles = await getProfiles();
	let accounts = await getAccounts();
	let requestedName = document.getElementById("backup-profile-name").value.trim();
	let targetID = profileNameSelectorEl.value;
	let targetExists = targetID && accounts[targetID];
	let profileName = requestedName || (targetExists ? accounts[targetID].profileName : backup.account.profileName);
	if (!profileName || profileName.length < 2) throw new Error("A profile name is required");
	if (!targetExists || requestedName) {
		targetID = crypto.randomUUID();
		if (profiles[profileName]) throw new Error("That profile name is already in use");
	}
	accounts[targetID] = Object.assign({},backup.account,{ profileName, profileIcon: normalizeProfileIcon(backup.account.profileIcon), });
	profiles[profileName] = targetID;
	await Promise.all([idbKeyval.set("profiles",profiles),idbKeyval.set("accounts",accounts)]);
	populateProfileSelector(profiles);
	sessionStorage.setItem("current-account-id",targetID);
	currentKeyText = keyText;
	await showSavedDataPage();
	notify("Encrypted backup restored successfully.",true);
}

async function onLogout(evt = false) {
	if (evt) {
		cancelEvent(evt);
	}
	NotificationManager.hide();
	createProfileFormEl.reset();
	loginFormEl.reset();
	savedDataFormEl.reset();
	profileLabelEl.innerText = "";
	currentKeyText = undefined;
	sessionStorage.clear();
	location.reload();
}

async function onSaveData(evt) {
	cancelEvent(evt);

	var submitBtn = savedDataFormEl.querySelector("button[type=submit]");

	if (!(
		savedDataFormEl.classList.contains("hidden") ||
		submitBtn.disabled
	)) {
		submitBtn.disabled = true;
		let startEl = savedDataFormEl.querySelector("#period-start");
		let endEl = savedDataFormEl.querySelector("#period-end");
		if (!startEl.value || (endEl.value && endEl.value < startEl.value)) {
			warn("Please enter a valid period start and end date.");
			submitBtn.disabled = false;
			return;
		}
		periodData.cycles = periodData.cycles.filter(cycle => cycle.start !== startEl.value);
		periodData.cycles.push({ start: startEl.value, end: endEl.value || null, exceptional: savedDataFormEl.querySelector("#period-exceptional").checked, });
		periodData.cycles.sort((a,b) => a.start.localeCompare(b.start));
		try {
			periodData.version = 3;
			let res = await DataManager.saveData(JSON.stringify(periodData),undefined,currentKeyText);
			if (res) {
				startEl.value = "";
				endEl.value = "";
				savedDataFormEl.querySelector("#period-exceptional").checked = false;
				renderPeriods();
				renderCalendar();
				NotificationManager.scheduleReminders(periodData,PeriodPrediction.predict(periodData.cycles));
				notify("Period saved (encrypted) successfully.");
			}
			else {
				throw res;
			}
		}
		catch (err) {
			console.log(err);
			warn("Saving data failed. Please try again.");
		}

		submitBtn.disabled = false;
	}
}

function renderPeriods() {
	let resultEl = savedDataFormEl.querySelector("#prediction-result");
	let listEl = savedDataFormEl.querySelector("#period-list");
	let prediction = PeriodPrediction.predict(periodData.cycles);
	resultEl.innerText = prediction.available ? `${prediction.date} (typical cycle ${prediction.typical} days; likely range ${prediction.min}–${prediction.max} days; ${prediction.confidence} confidence). Historical median absolute error: about ${prediction.error} days.` : "Record at least two non-exceptional period starts to see an estimate.";
	listEl.innerHTML = "";
	for (let cycle of periodData.cycles.slice().reverse()) {
		let item = document.createElement("li");
		item.innerText = `${cycle.start}${cycle.end ? " to " + cycle.end : ""}${cycle.exceptional ? " (exceptional)" : ""}`;
		listEl.appendChild(item);
	}
}

function changeCalendarMonth(offset) {
	calendarMonth = new Date(calendarMonth.getFullYear(),calendarMonth.getMonth() + offset,1);
	renderCalendar();
}

function dateFromInput(value) {
	let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
	if (!match) return null;
	let year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
	let date = new Date(year,month - 1,day);
	return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function dateKey(date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function addDateRange(markers, start, end, marker) {
	if (!start) return;
	let last = end || start;
	for (let date = new Date(start); date <= last; date.setDate(date.getDate() + 1)) markers[dateKey(date)] = (markers[dateKey(date)] || []).concat(marker);
}

function medicationWasTakenOn(medication,date) {
	let target = dateKey(date);
	return (medication.adherence || []).some(timestamp => dateKey(new Date(timestamp)) === target);
}

function renderCalendar() {
	let gridEl = document.querySelector('[data-calendar="grid"]');
	let labelEl = document.querySelector('[data-calendar="label"]');
	if (!gridEl || !labelEl) return;
	let year = calendarMonth.getFullYear();
	let month = calendarMonth.getMonth();
	let monthName = new Intl.DateTimeFormat(undefined,{ month: "long", year: "numeric" }).format(calendarMonth);
	labelEl.innerText = monthName;
	labelEl.setAttribute("aria-label",monthName);
	gridEl.querySelectorAll(".calendar-day, .calendar-blank").forEach(item => item.remove());
	let markers = {};
	let monthStart = new Date(year,month,1);
	let monthEnd = new Date(year,month + 1,0);
	for (let cycle of periodData.cycles || []) {
		let start = dateFromInput(cycle.start);
		let end = dateFromInput(cycle.end) || start;
		if (start && end >= monthStart && start <= monthEnd) addDateRange(markers,start < monthStart ? monthStart : start,end > monthEnd ? monthEnd : end,"period");
	}
	let prediction = PeriodPrediction.predict(periodData.cycles || []);
	if (prediction.available) {
		let predicted = dateFromInput(prediction.date);
		let window = Math.max(1,Number(prediction.error) || 1);
		let windowStart = new Date(predicted); windowStart.setDate(windowStart.getDate() - window);
		let windowEnd = new Date(predicted); windowEnd.setDate(windowEnd.getDate() + window);
		addDateRange(markers,windowStart,windowEnd,"predicted");
		let ovulation = new Date(predicted); ovulation.setDate(ovulation.getDate() - 14);
		addDateRange(markers,new Date(ovulation.getFullYear(),ovulation.getMonth(),ovulation.getDate() - 5),new Date(ovulation.getFullYear(),ovulation.getMonth(),ovulation.getDate() + 5),"fertile");
		addDateRange(markers,ovulation,ovulation,"fertile");
	}
	for (let medication of periodData.medications || []) {
		for (let timestamp of medication.adherence || []) {
			let takenDate = new Date(timestamp);
			if (takenDate >= monthStart && takenDate <= monthEnd) addDateRange(markers,takenDate,takenDate,"medication");
		}
	}
	for (let tracker of periodData.trackers || []) for (let entry of tracker.entries || []) {
		let loggedDate = dateFromInput(entry.date);
		if (loggedDate && loggedDate >= monthStart && loggedDate <= monthEnd) addDateRange(markers,loggedDate,loggedDate,"tracker");
	}
	let firstDay = new Date(year,month,1);
	let leadingBlanks = (firstDay.getDay() + 6) % 7;
	for (let index = 0; index < leadingBlanks; index++) appendBlank();
	let daysInMonth = new Date(year,month + 1,0).getDate();
	for (let day = 1; day <= daysInMonth; day++) {
		let date = new Date(year,month,day);
		let dayEl = document.createElement("span");
		let key = dateKey(date);
		let dayMarkers = [...new Set(markers[key] || [])];
		dayEl.className = "calendar-day";
		dayEl.innerText = day;
		dayEl.dataset.date = key;
		if (dayMarkers.length) dayEl.dataset.marker = dayMarkers.join(" ");
		dayEl.setAttribute("aria-label",`${monthName}, ${day}${dayMarkers.length ? `: ${dayMarkers.join(", ")}` : ""}`);
		let markerEl = document.createElement("span");
		markerEl.className = "calendar-markers";
		if (dayMarkers.includes("period")) markerEl.appendChild(calendarIcon("/assets/sprite-6-1.png","Period day","period-marker"));
		if (dayMarkers.includes("predicted")) markerEl.appendChild(calendarIcon("/assets/calendar-paw-icon.png","Projected period","projected-period-icon"));
		if (dayMarkers.includes("fertile")) markerEl.appendChild(calendarIcon("/assets/moon-icon-full-cyan.png","Estimated fertile window","fertile-marker"));
		if ((periodData.medications || []).some(medication => medicationWasTakenOn(medication,date))) markerEl.appendChild(calendarIcon("/assets/sprite-8-6.png","Medication taken","medication-marker"));
		if (dayMarkers.includes("tracker")) markerEl.appendChild(calendarIcon("/assets/misc-tracking/paw-print-motif-cyan.png","Tracker activity","tracker-marker"));
		dayEl.appendChild(markerEl);
		gridEl.appendChild(dayEl);
	}
	let trailingBlanks = (7 - ((leadingBlanks + daysInMonth) % 7)) % 7;
	for (let index = 0; index < trailingBlanks; index++) appendBlank();

	function appendBlank() {
		let blankEl = document.createElement("span");
		blankEl.className = "calendar-blank";
		blankEl.setAttribute("aria-hidden","true");
		gridEl.appendChild(blankEl);
	}

	function calendarIcon(src,alt,className) {
		let icon = document.createElement("img");
		icon.src = src;
		icon.alt = alt;
		icon.className = className;
		icon.addEventListener("error",evt => { evt.currentTarget.replaceWith(document.createTextNode("🐾")); },{ once: true, });
		return icon;
	}
}

function renderTrackerIcons(selected) {
	let options = document.getElementById("tracker-icon-options");
	if (!options) return;
	options.innerHTML = "";
	for (let [src,label] of TRACKER_ICONS) {
		let wrapper = document.createElement("label"); wrapper.className = "tracker-icon-option";
		let input = document.createElement("input"); input.type = "radio"; input.name = "tracker-icon"; input.value = src; input.checked = src === (selected || TRACKER_ICONS.keys().next().value); input.setAttribute("aria-label",label);
		let image = document.createElement("img"); image.src = src; image.alt = label;
		wrapper.append(input,image,document.createTextNode(label)); options.appendChild(wrapper);
	}
}

function renderTrackers() {
	let list = document.getElementById("tracker-list"); if (!list) return; list.innerHTML = "";
	for (let tracker of periodData.trackers) {
		let item = document.createElement("li"), head = document.createElement("div"); head.className = "tracker-card-head";
		let image = document.createElement("img"); image.src = tracker.icon; image.alt = ""; image.setAttribute("aria-hidden","true");
		head.append(image,document.createTextNode(tracker.name)); item.appendChild(head);
		if (tracker.notes) { let notes = document.createElement("span"); notes.className = "tracker-notes"; notes.innerText = tracker.notes; item.appendChild(notes); }
		let reminder = document.createElement("span"); reminder.className = "tracker-history"; reminder.innerText = periodData.reminders.trackerTimes[tracker.id] ? `Daily reminder: ${periodData.reminders.trackerTimes[tracker.id]}` : "No daily reminder"; item.appendChild(reminder);
		let history = document.createElement("span"); history.className = "tracker-history"; history.innerText = `Recent logs: ${(tracker.entries || []).slice(-3).reverse().map(entry => `${entry.date}${entry.note ? ` — ${entry.note}` : ""}`).join("; ") || "none"}`; item.appendChild(history);
		for (let [label,action] of [["Edit","edit"],["Delete","delete"]]) { let button = document.createElement("button"); button.type = "button"; button.dataset.action = action; button.dataset.id = tracker.id; button.innerText = label; item.appendChild(button); }
		list.appendChild(item);
	}
}

function renderTodayTrackerLog() {
	let log = document.getElementById("today-tracker-log"); if (!log) return;
	let dateInput = document.getElementById("tracker-log-date"); if (!dateInput.value) dateInput.value = dateKey(new Date()); log.innerHTML = "";
	if (!periodData.trackers.length) { let empty = document.createElement("p"); empty.className = "empty-state"; empty.innerText = "Create a tracker below to add it to the quick log."; log.appendChild(empty); return; }
	for (let tracker of periodData.trackers) {
		let label = document.createElement("label"); label.className = "tracker-check";
		let input = document.createElement("input"); input.type = "checkbox"; input.value = tracker.id; input.checked = (tracker.entries || []).some(entry => entry.date === dateInput.value);
		let image = document.createElement("img"); image.src = tracker.icon; image.alt = ""; image.setAttribute("aria-hidden","true"); label.append(input,image,document.createTextNode(tracker.name)); log.appendChild(label);
	}
}

async function onSaveTracker() {
	let id = document.getElementById("tracker-id").value, name = document.getElementById("tracker-name").value.trim();
	if (!name) { warn("Please enter a tracker name."); return; }
	let old = periodData.trackers.find(item => item.id === id), tracker = normalizeTracker({ id: id || crypto.randomUUID(), name, icon: document.querySelector('input[name="tracker-icon"]:checked')?.value, notes: document.getElementById("tracker-notes").value.trim(), entries: old ? old.entries : [] });
	periodData.trackers = periodData.trackers.filter(item => item.id !== tracker.id).concat(tracker);
	periodData.reminders.trackerTimes[tracker.id] = document.getElementById("tracker-reminder-time").value;
	if (await persistData("Tracker saved (encrypted) successfully.")) resetTrackerEditor();
}

function resetTrackerEditor() { document.getElementById("tracker-id").value = ""; document.getElementById("tracker-name").value = ""; document.getElementById("tracker-notes").value = ""; document.getElementById("tracker-reminder-time").value = ""; document.getElementById("cancel-tracker-btn").classList.add("hidden"); renderTrackerIcons(); }

async function onTrackerAction(evt) {
	let button = evt.target.closest("button[data-action]"); if (!button) return;
	let tracker = periodData.trackers.find(item => item.id === button.dataset.id); if (!tracker) return;
	if (button.dataset.action === "delete") { periodData.trackers = periodData.trackers.filter(item => item.id !== tracker.id); delete periodData.reminders.trackerTimes[tracker.id]; await persistData("Tracker deleted (encrypted) successfully."); }
	else { document.getElementById("tracker-id").value = tracker.id; document.getElementById("tracker-name").value = tracker.name; document.getElementById("tracker-notes").value = tracker.notes; document.getElementById("tracker-reminder-time").value = periodData.reminders.trackerTimes[tracker.id] || ""; document.getElementById("cancel-tracker-btn").classList.remove("hidden"); renderTrackerIcons(tracker.icon); }
}

async function onLogTrackers() {
	let date = document.getElementById("tracker-log-date").value, selected = [...document.querySelectorAll("#today-tracker-log input:checked")].map(input => input.value), note = document.getElementById("tracker-log-note").value.trim();
	if (!dateFromInput(date) || !selected.length) { warn("Choose a valid date and at least one tracker."); return; }
	for (let tracker of periodData.trackers) if (selected.includes(tracker.id)) { tracker.entries = (tracker.entries || []).filter(entry => entry.date !== date); tracker.entries.push({ date, timestamp: new Date().toISOString(), note }); }
	document.getElementById("tracker-log-note").value = ""; await persistData("Tracker activity logged (encrypted) successfully.");
}

async function onSaveMedication() {
	let idEl = document.getElementById("medication-id");
	let name = document.getElementById("medication-name").value.trim();
	let dose = document.getElementById("medication-dose").value.trim();
	let schedule = document.getElementById("medication-schedule").value.trim();
	let startDate = document.getElementById("medication-start").value;
	let endDate = document.getElementById("medication-end").value;
	if (!name || !dose || !schedule || !startDate || (endDate && endDate < startDate)) {
		warn("Please enter a medication name, dose, schedule, and valid dates.");
		return;
	}
	let old = periodData.medications.find(item => item.id === idEl.value);
	let medication = { id: idEl.value || crypto.randomUUID(), name, dose, schedule, startDate, endDate: endDate || null, notes: document.getElementById("medication-notes").value.trim() || null, adherence: old ? old.adherence : [], };
	periodData.medications = periodData.medications.filter(item => item.id !== medication.id);
	periodData.medications.push(medication);
	if (!periodData.reminders.medicationTimes[medication.id]) periodData.reminders.medicationTimes[medication.id] = "";
	await persistData("Medication saved (encrypted) successfully.");
	resetMedicationEditor();
}

function resetMedicationEditor() {
	let editor = document.getElementById("medication-editor");
	for (let input of editor.querySelectorAll("input:not([type=hidden]), textarea")) input.value = "";
	document.getElementById("medication-id").value = "";
	document.getElementById("cancel-medication-btn").classList.add("hidden");
}

function renderMedications() {
	let list = document.getElementById("medication-list");
	console.info("[Moon.Time] medication setup UI rendered",{
		sectionPresent: Boolean(document.getElementById("medications")),
		sectionHidden: document.getElementById("medications")?.classList.contains("hidden") || false,
		editorPresent: Boolean(document.getElementById("medication-editor")),
		medicationCount: periodData.medications.length,
	});
	list.innerHTML = "";
	document.getElementById("period-reminder-days").value = Number.isInteger(periodData.reminders.periodDaysBefore) ? periodData.reminders.periodDaysBefore : "";
	for (let medication of periodData.medications) {
		let item = document.createElement("li");
		let takenToday = (medication.adherence || []).some(timestamp => new Date(timestamp).toDateString() === new Date().toDateString());
		item.innerText = `${medication.name} — ${medication.dose}, ${medication.schedule} (${medication.startDate}${medication.endDate ? " to " + medication.endDate : ""})`;
		if (medication.notes) item.innerText += `; ${medication.notes}`;
		let time = document.createElement("input"); time.type = "time"; time.value = periodData.reminders.medicationTimes[medication.id] || ""; time.setAttribute("aria-label",`Reminder time for ${medication.name}`); time.addEventListener("change",() => { periodData.reminders.medicationTimes[medication.id] = time.value; persistData("Medication reminder saved (encrypted) successfully."); }); item.append(" Daily reminder: ",time);
		let history = document.createElement("span"); history.innerText = ` Taken: ${(medication.adherence || []).map(timestamp => new Date(timestamp).toLocaleString()).join(", ") || "none"}`; item.appendChild(history);
		for (let [label, action] of [[takenToday ? "Taken today" : "Mark taken today","taken"],["Edit","edit"],["Delete","delete"]]) { let button = document.createElement("button"); button.type = "button"; button.dataset.action = action; button.dataset.id = medication.id; button.innerText = label; button.disabled = action === "taken" && takenToday; if (action === "taken") button.classList.add("paw-action"); item.appendChild(button); }
		list.appendChild(item);
	}
}

function renderTodayMedicationLog() {
	let logEl = document.getElementById("today-medication-log");
	if (!logEl) return;
	logEl.innerHTML = "";
	let today = new Date();
	let active = (periodData.medications || []).filter(medication => {
		let start = dateFromInput(medication.startDate);
		let end = dateFromInput(medication.endDate);
		return start && start <= today && (!end || end >= today);
	});
	console.info("[Moon.Time] medication logging UI rendered",{
		logPresent: true,
		logHidden: logEl.classList.contains("hidden"),
		today: dateKey(today),
		configuredMedicationCount: periodData.medications.length,
		activeMedicationCount: active.length,
		activeMedicationNames: active.map(medication => medication.name),
	});
	if (!active.length) {
		let empty = document.createElement("p");
		empty.className = "empty-state";
		empty.innerText = "No medications scheduled for today.";
		logEl.appendChild(empty);
		return;
	}
	for (let medication of active) {
		let taken = medicationWasTakenOn(medication,today);
		let button = document.createElement("button");
		button.type = "button";
		button.className = `dose-rune${taken ? " is-taken" : ""}`;
		button.dataset.action = "taken";
		button.dataset.id = medication.id;
		button.disabled = taken;
		button.innerHTML = `<img src="/assets/sprite-8-6.png" alt=""> <span>${medication.name}</span><small>${taken ? "logged" : medication.dose}</small>`;
		button.querySelector("img").addEventListener("error",evt => { evt.currentTarget.replaceWith(document.createTextNode("🐾")); },{ once: true, });
		button.setAttribute("aria-label",`${medication.name}: ${taken ? "dose logged today" : "mark dose taken today"}`);
		logEl.appendChild(button);
	}
}

async function onMedicationAction(evt) {
	let button = evt.target.closest("button[data-action]");
	if (!button) return;
	let medication = periodData.medications.find(item => item.id === button.dataset.id);
	if (!medication) return;
	if (button.dataset.action === "taken") medication.adherence = (medication.adherence || []).concat(new Date().toISOString());
	else if (button.dataset.action === "delete") { periodData.medications = periodData.medications.filter(item => item.id !== medication.id); delete periodData.reminders.medicationTimes[medication.id]; }
	else { for (let [key, value] of Object.entries({ "medication-id": medication.id, "medication-name": medication.name, "medication-dose": medication.dose, "medication-schedule": medication.schedule, "medication-start": medication.startDate, "medication-end": medication.endDate || "", "medication-notes": medication.notes || "" })) document.getElementById(key).value = value; document.getElementById("cancel-medication-btn").classList.remove("hidden"); return; }
	await persistData(button.dataset.action === "delete" ? "Medication deleted (encrypted) successfully." : "Dose recorded (encrypted) successfully.");
}

async function onReminderSettingsChange() {
	let value = document.getElementById("period-reminder-days").value;
	periodData.reminders.periodDaysBefore = value === "" ? null : Number(value);
	await persistData("Reminder settings saved (encrypted) successfully.");
}

async function onRequestNotifications() {
	let permission = await NotificationManager.requestPermission();
	let message = permission === "granted" ? "Notifications enabled while Moon.Time is open." : permission === "unsupported" ? "Notifications are not supported by this browser." : "Notification permission was not granted.";
	document.getElementById("reminder-feedback").innerText = message;
	NotificationManager.scheduleReminders(periodData,PeriodPrediction.predict(periodData.cycles));
}

async function persistData(message) {
	periodData.version = 3;
	let result = await DataManager.saveData(JSON.stringify(periodData),undefined,currentKeyText);
	if (!result) { warn("Saving data failed. Please try again."); return false; }
	renderMedications();
	renderTodayMedicationLog();
	renderCalendar();
	NotificationManager.scheduleReminders(periodData,PeriodPrediction.predict(periodData.cycles));
	if (message) notify(message);
	return true;
}

function onChangePassphrase(evt) {
	cancelEvent(evt);

	var submitBtn = changePassphraseFormEl.querySelector("button[type=submit]");

	if (!(
		changePassphraseFormEl.classList.contains("hidden") ||
		submitBtn.disabled
	)) {
		let accountID = sessionStorage.getItem("current-account-id");
		let oldPassphraseEl = changePassphraseFormEl.querySelector("#change-old-password");
		let newPassphraseEl = changePassphraseFormEl.querySelector("#change-password");
		let confirmPassphraseEl = changePassphraseFormEl.querySelector("#change-password-confirm");

		if (oldPassphraseEl.value.length < 5) {
			warn("Please enter a current passphrase at least 5 characters long.");
			return false;
		}
		if (newPassphraseEl.value.length < 5) {
			warn("Please enter a new passphrase at least 5 characters long.");
			return false;
		}
		if (newPassphraseEl.value !== confirmPassphraseEl.value) {
			warn("Please make sure you enter the exact same passphrase twice.");
			return false;
		}

		let oldPassword = oldPassphraseEl.value.trim();
		let newPassword = newPassphraseEl.value.trim();
		oldPassphraseEl.value = "";
		newPassphraseEl.value = "";
		confirmPassphraseEl.value = "";

		notify("Please wait...");

		submitBtn.disabled = true;
		authWorker.postMessage({
			changeAuth: {
				oldPassword,
				newPassword,
				accountID,
			},
		});
	}
}

function onStartDeleteProfile(evt) {
	cancelEvent(evt);

	NotificationManager.show(
		"Warning: This will PERMANENTLY DELETE ALL your saved data. Continue?",
		{
			isModal: true,
			isError: false,
			showCancel: true,
			onClose,
		}
	);


	// ***************************

	async function onClose(result) {
		// confirmed profile delete?
		if (result === true) {
			let accountID = sessionStorage.getItem("current-account-id");
			let res = await deleteProfile(accountID);
			if (res) {
				onLogout();
			}
			else {
				warn("Deleting the profile FAILED!! Please try again.");
			}
		}
		// canceled the profile deletion
		else {
			await delay(250);
			notify("Phew, glad we didn't accidentally delete your data!");
		}
	}
}

function showUnsupportedBrowserPage() {
	hideLoginPage();
	hideSavedDataPage();
	hideChangePassphrasePage();
	hideRegistrationPage();

	NotificationManager.show(
		"Your browser doesn't support the features necessary to keep your data safe and reliable. Please try another browser.",
		{
			isModal: true,
			isError: true,
			canDismiss: false,
		}
	);

	throw new Error("Unsupported browser: " + window.navigator.userAgent);
}

function showRegistrationPage() {
	hideLoginPage();
	hideRestoreBackupPage();
	hideSavedDataPage();
	hideChangePassphrasePage();

	createProfileFormEl.removeAttribute("inert");
	createProfileFormEl.reset();
	var submitBtn = createProfileFormEl.querySelector("button[type=submit]");
	submitBtn.disabled = false;
	createProfileFormEl.classList.remove("hidden");
	passphraseSuggestionFormEl.classList.remove("hidden");
}

function hideRegistrationPage() {
	createProfileFormEl.classList.add("hidden");
	createProfileFormEl.setAttribute("inert","inert");
	createProfileFormEl.reset();
	var submitBtn = createProfileFormEl.querySelector("button[type=submit]");
	submitBtn.disabled = true;
	passphraseSuggestionFormEl.classList.add("hidden");
}

function showLoginPage() {
	hideRegistrationPage();
	hideSavedDataPage();
	hideChangePassphrasePage();
	restoreBackupFormEl.classList.remove("hidden");
	restoreBackupFormEl.removeAttribute("inert");

	loginFormEl.removeAttribute("inert");
	loginFormEl.reset();
	var submitBtn = loginFormEl.querySelector("button[type=submit]");
	submitBtn.disabled = false;
	var createAnotherProfileBtn = document.getElementById("create-another-profile-btn");
	createAnotherProfileBtn.disabled = false;
	loginFormEl.classList.remove("hidden");
	var passphraseEl = loginFormEl.querySelector("#login-password");
	passphraseEl.focus();
}

function hideLoginPage() {
	loginFormEl.classList.add("hidden");
	loginFormEl.setAttribute("inert","inert");
	loginFormEl.reset();
	hideRestoreBackupPage();
	var submitBtn = loginFormEl.querySelector("button[type=submit]");
	submitBtn.disabled = true;
	var createAnotherProfileBtn = document.getElementById("create-another-profile-btn");
	createAnotherProfileBtn.disabled = true;
}

function hideRestoreBackupPage() {
	restoreBackupFormEl.classList.add("hidden");
	restoreBackupFormEl.setAttribute("inert","inert");
	restoreBackupFormEl.reset();
}

async function showSavedDataPage() {
	hideLoginPage();
	hideRestoreBackupPage();
	hideRegistrationPage();
	hideChangePassphrasePage();

	savedDataFormEl.reset();
	await populateSavedData();
	savedDataFormEl.classList.remove("hidden");
	savedDataFormEl.removeAttribute("inert");
	logDateEntryDiagnostics("saved-data-visible");
	var submitBtn = savedDataFormEl.querySelector("button[type=submit]");
	submitBtn.disabled = false;
	if (storageManagerPersistSupported()) {
		let persisted = false;
		try {
			let alreadyPersisted = typeof navigator.storage.persisted === "function"
				? await navigator.storage.persisted()
				: "unsupported";
			console.info("[storage-persistence] checking browser storage policy", {
				userAgent: navigator.userAgent,
				platform: navigator.platform,
				alreadyPersisted,
			});
			persisted = await navigator.storage.persist();
			console.info("[storage-persistence] persist() result", { persisted });
		} catch (err) {
			console.warn("[storage-persistence] persist() rejected", {
				name: err && err.name,
				message: err && err.message,
			});
		}
		let notice = document.getElementById("storage-persistence-notice");
		if (!persisted) {
			notice.innerText = "This browser has not granted persistent storage. Keep encrypted backups because local data may be cleared.";
			notice.classList.remove("hidden");
		}
		else notice.classList.add("hidden");
	}
}

function hideSavedDataPage() {
	savedDataFormEl.classList.add("hidden");
	savedDataFormEl.setAttribute("inert","inert");
	var submitBtn = savedDataFormEl.querySelector("button[type=submit]");
	submitBtn.disabled = true;
}

function showChangePassphrasePage() {
	hideLoginPage();
	hideRegistrationPage();
	hideSavedDataPage();

	changePassphraseFormEl.reset();
	changePassphraseFormEl.classList.remove("hidden");
	changePassphraseFormEl.removeAttribute("inert");
	var submitBtn = changePassphraseFormEl.querySelector("button[type=submit]");
	submitBtn.disabled = false;
}

function hideChangePassphrasePage() {
	changePassphraseFormEl.classList.add("hidden");
	changePassphraseFormEl.setAttribute("inert","inert");
	var submitBtn = changePassphraseFormEl.querySelector("button[type=submit]");
	submitBtn.disabled = true;
}

function notify(msg,isModal = false) {
	NotificationManager.show(msg, {
		isModal: isModal,
	});
}

function warn(msg,isModal = true) {
	NotificationManager.show(msg, {
		isModal: isModal,
		isError: true,
	});
}

// *******************************

async function onAuthMessage({ data }) {
	if (data.backupVerified) {
		try { await restoreVerifiedBackup(data.keyText); }
		catch (err) { console.log(err); pendingBackup = undefined; warn("Backup restore failed. The existing profile was not changed."); }
		return;
	}
	if (data.login === true) {
		// upgrade/change of auth credentials pending?
		if (data.upgradePending || data.changePending) {
			// decrypt/extract current data
			tmpDataBackup = await DataManager.getData(
				data.accountID,
				data.keyText,
			);

			// trigger regeneration of new auth credentials
			authWorker.postMessage({
				createAuth: {
					password: data.password,
					accountID: data.accountID,
					regenerate: true,
				},
			});

			notify(
				data.upgradePending ? "Upgrading data encryption, please wait..." :
				data.changePending ? "Re-encrypting data with new credentials, please wait..." :
				"Please wait..."
			);
			return;
		}
		// auth credentials regenerated?
		else if (data.authRegenerated && tmpDataBackup !== UNSET) {
			try {
				// re-save the data using the upgraded
				// encryption credentials
				let res = await DataManager.saveData(
					tmpDataBackup,
					data.accountID,
					data.keyText,
					/*resaveWithNewCredentials=*/true
				);
				if (!res) {
					throw "Save failed.";
				}
				tmpDataBackup = UNSET;
			}
			catch (err) {
				console.log(err);

				// login page is active?
				if (!loginFormEl.classList.contains("hidden")) {
					warn("Re-saving data (during credentials upgrade) failed. Please login again.");

					let submitBtn = loginFormEl.querySelector("button[type=submit]");
					submitBtn.disabled = false;
				}
				// change-passphrase page is active?
				else if (!changePassphraseFormEl.classList.contains("hidden")) {
					warn("Re-saving data (during credentials change) failed. Please try again.");

					let submitBtn = changePassphraseFormEl.querySelector("button[type=submit]");
					submitBtn.disabled = false;
				}
				return;
			}
		}

		// need to save credentials into session?
		sessionStorage.setItem("current-account-id",data.accountID);
		currentKeyText = data.keyText;

		// passphrase credentials changed?
		let credentialsChanged = (
			data.authRegenerated &&
			!changePassphraseFormEl.classList.contains("hidden")
		);

		NotificationManager.hide();
		await showSavedDataPage();

		// new local profile created?
		if (data.credentialsCreated) {
			notify(
				"Local profile created successfully, you're now logged in!",
				/*isModal=*/true
			);
		}
		// passphrase credentials changed?
		else if (credentialsChanged) {
			notify("Passphrase changed successfully!");
		}
	}
	else if (data.error) {
		let submitBtns = document.querySelectorAll("form button[type=submit]");
		for (let btn of submitBtns) {
			btn.disabled = false;
		}
		warn(data.error);
	}
}

function logDateEntryDiagnostics(reason) {
	let dateInputs = [...document.querySelectorAll("[data-date-input]")].map(input => ({
		id: input.id,
		type: input.type,
		value: input.value,
		disabled: input.disabled,
		readOnly: input.readOnly,
		formHidden: input.form?.classList.contains("hidden") || false,
		formInert: input.form?.hasAttribute("inert") || false,
		formConnected: Boolean(input.form?.isConnected),
	}));
	console.info("[Moon.Time] date-entry diagnostics",{
		reason,
		hostname: window.location.hostname,
		uatQuery: new URLSearchParams(window.location.search).get("uat"),
		uatMode: UAT_MODE,
		activeElement: document.activeElement?.id || document.activeElement?.tagName || null,
		dateInputCount: dateInputs.length,
		dateInputs,
	});
}
