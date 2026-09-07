cTestCompleteChromeTabsAgentMimeType = "application/x-testcomplete12-0-chrome-tabs-agent";
cTestCompleteChromeTabsAgentScriptHelper = "g_TestCompleteChromeTabsAgentScriptHelper12_0";
cTestCompleteTabIdAttributeName = "tabId";
cTestCompleteChromeTabsAgent = "NATIVE_" + cTestCompleteChromeTabsAgentScriptHelper;

var callbacks = new Array();
var freeCallbackIndexes = new Array();
var agents = {};

startLogItems = [];

function getIocm() { return $iocm12; };

var nativePort = chrome.runtime.connectNative('testcomplete12.smartbear.chrome.extension');

var localPort = { 

	tabId: -1,

	postMessage: function (msg) 
	{
		if (msg["setobject"])
			return;

		if (typeof(msg["request"]) != "object")
			return;

		var retVal = getIocm().invoke(msg["request"]);	
		if (retVal == null) 
			return;

		var response = { responseId: msg["requestId"], "response": retVal};
		nativePort.postMessage(response);
	}
};

getIocm().context = 
{ 
	tabId: -1,
	
	deviceScaleFactor: 1.0,

	setRemoteProperty: function(name, value) 
	{
		if ((typeof(localPort) != "object") || (localPort == null))
			return false;

		if (typeof(value) == "object" || typeof(value) == "function")
			value = getIocm().cacheObject(value);            

		localPort.postMessage({
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
		getNamedItem: function(attrName)
		{
			if (attrName == "tabId")
				return { value: getIocm().context.tabId + "" };
			return null;
		}
	}
};

function setContextProto(proto)
{
	if ((typeof(proto) != "object") || (proto == null))
		return;

	for (var i = 0; i < proto.length; i++)
	{
		var funcName = proto[i];
		(function(funcName){
			getIocm().context[funcName] = function(){

				var params = new Array();
				for (var i = 0; i < arguments.length; i++)
					params[i] = arguments[i];
	
				localPort.postMessage({
					"callType": "invoke",
					"requestId": "",
					"objectId": this.tabId,
					"name": funcName,
					"flags": 2,
					"params": params
				});
			};
		})(funcName)
	}

}

function createObject(port, mime, callback)
{
	var callbackId = freeCallbackIndexes.length > 0 ? freeCallbackIndexes.pop(): callbacks.length;
	callbacks[callbackId] = function(response) { callback(response); };

	var prevAgent = agents[port.tabId];
	if ((typeof(prevAgent) == "object") && (typeof(prevAgent.port) == "object"))
	{
		prevAgent.port.disconnect()
		prevAgent.port.tabId = null;
		destroyObject(port.tabId);
	}

	agents[port.tabId] = { "tabId": port.tabId, "port": port, proto: [] };

	port.postMessage({"setobject": true, "tabId": port.tabId, "proto": []});
	nativePort.postMessage({requestId: callbackId + '', "objectId": port.tabId, callType: 'create', "mime": mime});
}

function destroyObject(tabId)
{
	if ((typeof(tabId) == "undefined") || (tabId == null))
		return;

	delete agents[tabId];
	nativePort.postMessage({requestId: "", callType: "destroy", "objectId": tabId});
}

nativePort.onMessage.addListener(

	function (msg) {

		var responseId = parseInt(msg["responseId"]);
		if (!isNaN(responseId))
		{
			var callback = callbacks[responseId];
			callbacks[responseId] = null;
			freeCallbackIndexes.push(responseId);

			if (typeof(callback) == "function")
			{
				callback(msg["response"]);
			}
		}

		var requestId = msg["requestId"];
		if (typeof(requestId) != "undefined")
		{

			var tabId = msg["context"];
			var agent = agents[tabId];
			if ((typeof(agent) != "object") || (agent == null) || (agent.port == null))
				return;

			try {
				agent.port.postMessage(msg);
			} catch(e) {

				console.trace(e);
				destroyObject(tabId);
			}
		}
	}
);

chrome.runtime.onConnect.addListener
(
	function (port)
	{
		if ((port == null) || (port.sender == null) || (port.sender.tab == null))
			return;

		port.tabId = port.sender.tab.id;
		port.onDisconnect.addListener(function(port) { 

			destroyObject(port.tabId);
		});

		port.onMessage.addListener(
			function (msg) {
				if (msg && msg.callType == "tabContentStateChanged")
					fireOnTabContentStateChanged(port.tabId);
				else
					nativePort.postMessage(msg);
			}
		);
		
		createObject(port, "application/x-testcomplete12-0-chrome-browser-agent", 
			
			function(msg) 
			{
				var agent = agents[msg["objectId"]];
				if (typeof(agent) != "object")
					return;
				var port = agent.port;
				if (typeof(port) != "object") 
					return;

				agents[msg["objectId"]].proto = msg["proto"];
				port.postMessage({"setobject": true, "tabId": port.tabId, "proto": msg["proto"], "deviceScaleFactor": gTabInfos[port.tabId].deviceScaleFactor});
			});

	}
);

startLogItems.push((new Date(Date.now())).toJSON());	

function popStartLogItems()
{
	var tempStartLogItems = startLogItems;
	startLogItems = [];
	return JSON.stringify(tempStartLogItems);
};

//Sync with background.js.h
cAgentTabsListenerKey = "tabsAgent";


function injectTabsAgent()
{
	createObject(localPort, cTestCompleteChromeTabsAgentMimeType, 
			
			function(msg) { 

				var tabId = msg["objectId"];
				if (typeof(agents[tabId]) != "object")
				{
					console.log("invalid tab agent");
					return;
				}

				if ((msg["proto"].length | 0) == 0)
				{
					console.log("wrong response " + JSON.stringify(msg));
					msg["proto"] = ["onTabCreated","onTabRemoved","onTabUpdated","onTabContentStateChanged"];
				}
				for (var i = 0; i < msg["proto"].length; i++)
				{
					var funcName = msg["proto"][i];
					(function(tabId, funcName){
						agents[tabId][funcName] = function(){

							var params = new Array();
							for (var i = 0; i < arguments.length; i++)
								params[i] = arguments[i];
							nativePort.postMessage({
								"callType": "invoke",
								"requestId": "",
								"objectId": this.tabId,
								"name": funcName,
								"flags": 2,
								"params": params
							});
						};
					})(tabId, funcName)

				}

				getIocm().context = agents[tabId];

				addTabsListener(cAgentTabsListenerKey, agents[tabId]);
				startWindowMonitor(2000);
			});
}

function unloadTabAgent()
{
    stopWindowMonitor();
    removeTabsListener(cAgentTabsListenerKey);
}

injectTabsAgent();


