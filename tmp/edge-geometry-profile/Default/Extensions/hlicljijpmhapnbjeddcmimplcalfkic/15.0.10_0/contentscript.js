//Sync with contentscript.js.h
var cTestCompleteChromeBrowserAgentMimeType = "application/x-testcomplete12-0-chrome-browser-agent";
var cTestCompleteChromeBrowserAgentScriptHelper = "g_TestCompleteChromeBrowserAgentScriptHelper12_0";
var cTestCompleteHiddenNodeAttributeName = "isTestCompleteHiddenNode";
var cTestCompleteTabIdAttributeName = "tabId";
var cTestCompleteChromeBrowserAgent = "NATIVE_" + cTestCompleteChromeBrowserAgentScriptHelper;
var cTestCompleteChromeBrowserScript = "SCRIPT_" + cTestCompleteChromeBrowserAgentScriptHelper;

var _tcIocmName = "$iocm12";
function getIocm() { return window[_tcIocmName]; };
getIocm().port = null;

const MainWorldHelper = (() => {
	const TYPES = Object.freeze({
		INVOKE:   "TYPE_INVOKE",
		ANCESTOR: "TYPE_ANCESTOR",
		CALLBACK: "TYPE_CALLBACK",
	});

	function init() {
		window.addEventListener("IOCM_RESPONSE", onMessage);
	}

	function onMessage(msg) {
		const { type, data } = msg?.detail ?? {};

		if (type !== TYPES.CALLBACK)
			return;

		getIocm().port.postMessage(data);
	}

	function dispatch(data, type) {
		window.dispatchEvent(
			new CustomEvent("IOCM_REQUEST", {
				detail: {
					type: type,
					data: data
				}
			})
		);
	}

	return {
		init,
		dispatch,
		TYPES
	};
})();

function getIsChromeBrowser() {
	return (typeof chrome === "object") && !(chrome.cef === true) && 
		((typeof chrome.runtime === "object") || (typeof chrome.extension === "object"));
}

function addHiddenNodeAttribute(node) {
	var attr = document.createAttribute(cTestCompleteHiddenNodeAttributeName);
	attr.value = "1";
	node.attributes.setNamedItem(attr);
}

function injectJSFile(url){
	var beginComment = document.createComment("Begining of TestComplete File");
	var endComment = document.createComment("Ending of TestComplete File");
	var scriptElement = document.createElement("SCRIPT");
	
	scriptElement.src = chrome.runtime.getURL(url);
	addHiddenNodeAttribute(scriptElement);

	document.documentElement.appendChild(beginComment);
	document.documentElement.appendChild(scriptElement);
	document.documentElement.appendChild(endComment);
}

function setContextProto(proto) {
	if ((typeof (proto) != "object") || (proto == null))
		return;
	for (var i = 0; i < proto.length; i++) {
		var funcName = proto[i];
		(function(funcName){
			getIocm().context[funcName] = function anonymous(){
				var params = new Array();
				for (var i = 0; i < arguments.length; i++)
					params[i] = arguments[i];
				window[_tcIocmName].port.postMessage({
					"callType": "invoke",
					"requestId": "",
					"objectId": this.tabId,
					"name": funcName,
					"flags": 2,
					"params": params
				});
			}
		})(funcName)
	}

}

(function () {

	"use strict";

	function stringifyObjectFull(vContent) {
		if (typeof vContent === "function")
			return vContent.toString();

		if (vContent instanceof Object) {
			var sOutput = "";
			if (vContent.constructor === Array) {
				for (var nId = 0; nId < vContent.length; sOutput += stringifyObjectFull(vContent[nId]) + ",", nId++);
				return "[" + sOutput.substr(0, sOutput.length - 1) + "]";
			}

			if (vContent.toString !== Object.prototype.toString) {
				return "\"" + vContent.toString().replace(/[\\"]/g, "\\$&") + "\"";
			}

			for (var sProp in vContent) {
				sOutput += "\"" + sProp.replace(/[\\"]/g, "\\$&") + "\":" + stringifyObjectFull(vContent[sProp]) + ",";
			}
			return "{" + sOutput.substr(0, sOutput.length - 1) + "}";
		}

		return typeof vContent === "string" ? "\"" + vContent.replace(/[\\"]/g, "\\$&") + "\"" : String(vContent);
	}

	// let callIndex = 1;
	// let retValElem = null;
	// let retValId = "_retVal12";
	let endComment = null;
	let injectorScript = "";

	function getInjectorScript() {
		if (injectorScript == "")
			injectorScript = "window[\"" + iocmName + "\"] = " + stringifyObjectFull(window[iocmName]) + ";\n";

		return "var " + cTestCompleteChromeBrowserAgentScriptHelper + " = " + stringifyObjectFull(window[cTestCompleteChromeBrowserAgentScriptHelper]) + ";\n" +
			injectorScript;
	}

	window[cTestCompleteChromeBrowserAgentScriptHelper] =
		{
			addScriptToAgent: function () { },

			removeScriptFromAgent: function () { },

			addCustomScript: function (text) {
				try {
					engineStart();
					var nameCode = text.split("\n")[0].split("_")[text.split("\n")[0].split("_").length-1].split("=")[0].trim();
					for(const props in g_TestCompleteChromeBrowserAgentScriptHelper12_0){
						if(props.includes("TC15")){
							g_TestCompleteChromeBrowserAgentScriptHelper12_0[props+nameCode] = g_TestCompleteChromeBrowserAgentScriptHelper12_0[props];
						}
					}
				} catch (e) {
					console.trace(e);
				}
				return true;
			},

			runCustomScript: function (text) {
				try {
					return vtIntegration[text]();
				} catch (e) {
					console.trace(e);
					return 'error : ' + e;
				}
			},

			runCustomScript1: function (text, param) {
				try {
					return vtIntegration[text](param);
				} catch (e) {
					console.trace(e);
					return 'error : ' + e;
				}
			},

			runCustomScript2: function (text, param1, param2) {
				try {
					return vtIntegration[text](param1, param2);
				} catch (e) {
					console.trace(e);
					return 'error : ' + e;
				}
			}
		};

	function injectIocmOnPage() {
		if (!getIsChromeBrowser())
			return;

		injectJSFile("common/iocm.js");
		injectJSFile("common/pageBridge.js");

		MainWorldHelper.init();

		window[iocmName].nextCacheId = window[iocmName].OBJECTID_IOCM - 1;
		window[iocmName].nextCacheIdStep = -1;

		window[iocmName].prevGetObjectFromCache = window[iocmName].getObjectFromCache;
		window[iocmName].getObjectFromCache = function (objectId) {

			if (objectId === 0)
				return null;

			var obj = this.prevGetObjectFromCache(objectId);
			if ((obj !== null) || (objectId < this.OBJECTID_IOCM))
				return obj;

			var moniker = this.objectMonikerCache[objectId];
			if (moniker == "")
				return null;

			try {
				obj = window[iocmName].returnObject(moniker);
			} catch (e) {
				console.trace(e);
			}

			this.objectCache[objectId] = obj;
			this.objectMonikerCache[objectId] = moniker;

			return obj;
		};

		window[iocmName].prevInvoke = window[iocmName].invoke;
		window[iocmName].invoke = function (callData) {

			try {

				if (!callData || (typeof (callData) != "object"))
					return this.createError(callData, "invalid callData");

				var methodName = callData["method"] + "";
				var objectId = callData["objectId"] || 0;
				var flags = callData["flags"] || 0;
				var params = callData["params"];
				var moniker = this.getObjectMoniker(objectId);

				if ((flags == 2) && (methodName == "#batchRelease")) {
					var outerIds = [];
					for (var i = 0; i < params.length; i++) {
						this.revokeObject(params[i]);
						if (params[i] > this.OBJECTID_NULL)
							outerIds.push(params[i]);
					}
					if (outerIds.length == 0)
						return null;
					params = outerIds;
					callData["params"] = params;
				}

				var marshalToPage = ((objectId == this.OBJECTID_WINDOW) && ((methodName == "Array") || (methodName == "eval"))) ||
					((flags == 2) && ((methodName.indexOf("tcaInvokeObjectMethod") == 0) || (methodName.indexOf("isCustomElement") == 0)));

				if (!marshalToPage && (typeof (params) == "object") && (params.length > 0)) {
					for (var i = 0; i < params.length; i++) {
						if ((typeof (params[i]) == "object") && (params[i] != null)
							&& (typeof (params[i]["objectId"]) == "number")
							&& (params[i]["objectId"] > this.OBJECTID_NULL)) {
							var paramValue = this.getObjectFromCache(params[i]["objectId"]);
							if (paramValue == null) {
								marshalToPage = true;
								break;
							}
						}
					}
				}

				var obj = marshalToPage ? null : this.getObjectFromCache(objectId);
				let hasProperty = this.hasProperty.apply(obj, [methodName, this]);

				if (!marshalToPage &&
					((typeof (obj) == "function") ||
						(this.isObject(obj) && (obj !== null) && (
							(objectId == this.OBJECTID_CONTEXT) ||
							(objectId == this.OBJECTID_AGENT) ||
							(objectId == this.OBJECTID_IOCM) ||
							(moniker == "") ||
							(methodName == "#has") ||
							(methodName == "#getbounds") ||
							(methodName == "#addWebHelpers") ||
							(hasProperty > 0)
						))))
				{
					var retVal = this.prevInvoke(callData);

					if ((methodName != "#has") || (retVal["retVal"] > 0)) {
						return retVal;
					}
					else if (retVal["retVal"] == 0) {
						return { "result": -1, "type": MainWorldHelper.TYPES.INVOKE};
					}
				} else if (hasProperty == 0) {
					const type = methodName.startsWith("getStandartAncestorClassName_")
  						? MainWorldHelper.TYPES.ANCESTOR
  						: MainWorldHelper.TYPES.INVOKE;

					return { "result": -1, "type": type};
				}

				if (objectId < this.OBJECTID_IOCM) {
					callData["objectId"] = moniker;
				}

				if (typeof (params) == "object") {
					for (var i = 0; i < params.length; i++) {
						if ((typeof (params[i]) == "object") && (params[i] != null)
							&& (typeof (params[i]["objectId"]) == "number")
							&& (params[i]["objectId"] < this.OBJECTID_IOCM)) {
							callData["params"][i]["objectId"] = this.getObjectMoniker(params[i]["objectId"]);
						}
					}

				}

				if ((flags != 1) && (methodName != "#batchRelease")) {
					if ((retVal == null) || (typeof (retVal["retVal"]) == "undefined")) {
						if (retVal == null) retVal = {};
						retVal["errorScript"] = "Error in #batchRelease";
					}
				}
				return this.injectObjects(retVal);

			} catch (e) {
				console.trace(e);
				return this.createError(callData, "local exception: " + e);
			}

		};
	}

	injectIocmOnPage(); // Attention! Not later!

	window[cTestCompleteChromeBrowserAgentScriptHelper].addScriptToAgent = function () {
		getIocm().context.setRemoteProperty("createCallback0", function (cookie0, cookie1) {
			var callback = function () {
				getIocm().context.callback0(cookie0, cookie1);
			};

			return callback;
		});
	};

	window[cTestCompleteChromeBrowserAgentScriptHelper].removeScriptFromAgent = function (agent) {
		getIocm().context.setRemoteProperty("createCallback0", null);
	};

	if (window[iocmName]) {
		window[iocmName].stateCheckTimeout = 100;
		window[iocmName].stateCheckTimer = null;
		window[iocmName].lastStateCheckTime = null;
		window[iocmName].savedContentState = null;
		window[iocmName].lastMouseOverTime = null;
		window[iocmName].lastMouseClickTime = null;

		window[iocmName].getVisibleObjects = function (doc) {
			var result = [];
			if (!doc) doc = document;
			var all = doc.getElementsByTagName("*");
			var count = all.length;
			for (var i = 0; i < count; i++) {
				var obj = all[i];
				var style = window.getComputedStyle(obj);
				if (!style ||
					style.display == "none" ||
					style.visibility == "hidden")
					continue;
				var rect = obj.getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0 && (rect.left + rect.width) > 0 && (rect.top + rect.height) > 0)
					result.push(obj);
				try {
					if (obj.contentDocument)
						result = result.concat(window[iocmName].getVisibleObjects(obj.contentDocument));
				} catch (e) { }
			}
			return result;
		}

		window[iocmName].checkPageChanged = function () {
			var t1 = Date.now();
			var iocm = getIocm();
			if ((t1 - iocm.lastMouseClickTime) < 500)
				iocm.lastMouseOverTime = null;
			if (iocm.lastMouseOverTime && (t1 - iocm.lastMouseOverTime) > 500)
				iocm.lastMouseOverTime = null;

			try { var currentContentState = iocm.getVisibleObjects(); } catch (e) { }
			if (iocm.lastMouseOverTime && iocm.savedContentState && iocm.savedContentState.length) {
				var changed = iocm.savedContentState.length < currentContentState.length;
				for (var i = 0; !changed && i < currentContentState.length; i++)
					if (iocm.savedContentState.indexOf(currentContentState[i]) < 0)
						changed = true;

				if (changed && getIocm().port)
					getIocm().port.postMessage({ "callType": "tabContentStateChanged" });
			}
			iocm.savedContentState = currentContentState;

			var t2 = Date.now();
			iocm.lastStateCheckTime = t2;

			if (iocm.lastMouseOverTime)
				iocm.stateCheckTimer = window.setTimeout(iocm.checkPageChanged, (t2 - t1) > iocm.stateCheckTimeout ? (t2 - t1) : iocm.stateCheckTimeout);
			else
				iocm.stateCheckTimer = null;
		}

		window[iocmName].documentMouseMove = function (e) {
			if (window[iocmName].stateCheckTimer)
				return;
			if (!window[iocmName].lastStateCheckTime || (Date.now() - window[iocmName].lastStateCheckTime) > window[iocmName].stateCheckTimeout) {
				window[iocmName].savedContentState = null;
				window[iocmName].checkPageChanged();
			}
		}

		window[iocmName].documentMouseOver = function (e) {
			window[iocmName].lastMouseOverTime = Date.now();
		}

		window[iocmName].documentMouseClick = function (e) {
			window[iocmName].lastMouseClickTime = Date.now();
		}
	}

	getIocm().context =
		{
			tabId: 0,

			deviceScaleFactor: 1.0,

			setRemoteProperty: function (name, value) {
				if ((typeof (getIocm().port) != "object") || (getIocm().port == null))
					return false;

				if (typeof (value) == "object" || typeof (value) == "function")
					value = getIocm().cacheObject(value);

				getIocm().port.postMessage({
					"callType": "invoke",
					"requestId": "",
					"objectId": getIocm().context.tabId,
					"name": name,
					"flags": 1,
					"params": value
				});
				return true;
			},

			attributes:
			{
				getNamedItem: function (attrName) {
					if (attrName == "tabId")
						return { value: getIocm().context.tabId + "" };
					return null;
				}
			}
		};


	(function () {

		if (!getIsChromeBrowser())
			return;

		var initializePort = function () {
			getIocm().port = null;
			getIocm().port = ((typeof chrome.runtime === "object") ? chrome.runtime : chrome.extension).connect({});
			getIocm().port.onMessage.addListener(

				function (msg) {
					if (msg["setobject"]) {
						getIocm().context.tabId = msg["tabId"];
						getIocm().context.deviceScaleFactor = msg["deviceScaleFactor"] || 1.0;
						setContextProto(msg["proto"]);
						return;
					}

					var retVal = getIocm().invoke(msg["request"]);
					if (retVal == null) {
						return;
					} else if (retVal.result == "-1") {
						MainWorldHelper.dispatch(msg, retVal.type);
						return;
					}

					var response = { responseId: msg["requestId"], "response": retVal };
					getIocm().port.postMessage(response);
				}
			);
		};

		initializePort();

		var initInterval = 0;
		var initCount = 0;

		var tryInitializePort = function () {
			if ((initCount >= 15) ||
				((getIocm().port != null) && (getIocm().context.tabId != 0))) {
				clearInterval(initInterval);
				initInterval = 0;
				return;
			}
			initializePort();
			initCount++;
		}

		initInterval = setInterval(tryInitializePort, 150);
	})();

})();