import * as idbKeyval from "/js/external/idb-keyval.js";

export { getData, saveData, getEncryptedAccount, decryptPayload, };

const b64AB = window["base64-arraybuffer"];
const aesDefaultOptions = {
	name: "AES-GCM",
};


// ****************************

async function getData(accountID,keyText) {
	try {
		accountID = accountID || sessionStorage.getItem("current-account-id");
		if (!keyText) return;
		let accounts = await idbKeyval.get("accounts");
		let account = accounts[accountID];
		if (!account) return;

		if (account.data && account.dataIV) {
			let iv = b64AB.decode(account.dataIV);
			let keyBuffer = b64AB.decode(keyText);
			let key = await crypto.subtle.importKey("raw",keyBuffer,"AES-GCM",false,[ "decrypt", ]);
			let dataBuffer = b64AB.decode(account.data);
			let aesOptions = Object.assign({},aesDefaultOptions,{ iv, });
			dataBuffer = await crypto.subtle.decrypt(aesOptions,key,dataBuffer);
			return (new TextDecoder()).decode(dataBuffer);
		}
	}
	catch (err) {
		console.log(err);
	}
}

async function getEncryptedAccount(accountID) {
	let accounts = await idbKeyval.get("accounts") || {};
	let account = accounts[accountID];
	if (!account) return;
	return {
		profileName: account.profileName,
		profileIcon: account.profileIcon,
		loginChallenge: account.loginChallenge,
		keyInfo: account.keyInfo,
		data: account.data,
		dataIV: account.dataIV,
	};
}

async function decryptPayload(account,keyText) {
	if (!account || !keyText || !account.data || !account.dataIV) return;
	let iv = b64AB.decode(account.dataIV);
	let keyBuffer = b64AB.decode(keyText);
	let key = await crypto.subtle.importKey("raw",keyBuffer,"AES-GCM",false,[ "decrypt", ]);
	let dataBuffer = b64AB.decode(account.data);
	dataBuffer = await crypto.subtle.decrypt(Object.assign({},aesDefaultOptions,{ iv, }),key,dataBuffer);
	return (new TextDecoder()).decode(dataBuffer);
}

async function saveData(data,accountID,keyText,resaveWithNewCredentials = false) {
	try {
		accountID = accountID || sessionStorage.getItem("current-account-id");
		if (!keyText) return false;
		let accounts = await idbKeyval.get("accounts");
		let account = accounts[accountID];
		if (!account) return false;

		let iv = new Uint8Array(16);
		self.crypto.getRandomValues(iv);
		account.dataIV = b64AB.encode(iv);
		let keyBuffer = b64AB.decode(keyText);
		let key = await crypto.subtle.importKey("raw",keyBuffer,"AES-GCM",false,[ "encrypt", ]);
		let dataBuffer = (new TextEncoder()).encode(data);
		let aesOptions = Object.assign({},aesDefaultOptions,{ iv, });
		let encData = await crypto.subtle.encrypt(aesOptions,key,dataBuffer);
		account.data = b64AB.encode(encData);

		// discard previous auth credentials now that
		// credentials change/upgrade is complete?
		if (resaveWithNewCredentials) {
			delete account.oldLoginChallenge;
			delete account.oldKeyInfo;
		}

		await idbKeyval.set("accounts",accounts);
		return true;
	}
	catch (err) {
		console.log(err);
	}

	return false;
}
