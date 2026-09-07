var engineStart = function(){

	g_TestCompleteChromeBrowserAgentScriptHelper12_0.getStandartAncestorClassName_TC15_ = function(el)
	{
		var classes = ['Element', 'HTMLElement', 'HTMLAnchorElement', 'HTMLAppletElement', 'HTMLAreaElement', 'HTMLAudioElement', 'HTMLBaseElement', 'HTMLBaseFontElement', 'HTMLBlockquoteElement',					'HTMLBodyElement', 'HTMLBRElement', 'HTMLButtonElement', 'HTMLCanvasElement', 'HTMLDetailsElement', 'HTMLDirectoryElement', 'HTMLDivElement', 'HTMLDListElement',					'HTMLEmbedElement', 'HTMLFieldSetElement', 'HTMLFontElement', 'HTMLFormElement', 'HTMLFrameElement', 'HTMLFrameSetElement', 'HTMLHeadElement', 'HTMLHeadingElement',					'HTMLHRElement', 'HTMLHtmlElement', 'HTMLIFrameElement', 'HTMLImageElement', 'HTMLInputElement', 'HTMLKeygenElement', 'HTMLLabelElement', 'HTMLLegendElement',					'HTMLLIElement', 'HTMLLinkElement', 'HTMLMapElement', 'HTMLMarqueeElement', 'HTMLMediaElement', 'HTMLMenuElement', 'HTMLMetaElement','HTMLMeterElement',					'HTMLModElement', 'HTMLObjectElement', 'HTMLOListElement', 'HTMLOptGroupElement', 'HTMLOptionElement', 'HTMLOutputElement', 'HTMLParagraphElement', 'HTMLParamElement',					'HTMLPreElement', 'HTMLProgressElement', 'HTMLQuoteElement', 'HTMLScriptElement', 'HTMLSelectElement', 'HTMLSlotElement', 'HTMLSourceElement', 'HTMLSpanElement',					'HTMLStyleElement', 'HTMLTableCaptionElement', 'HTMLTableCellElement', 'HTMLTableColElement', 'HTMLTableElement', 'HTMLTableRowElement', 'HTMLTableSectionElement',					'HTMLTextAreaElement', 'HTMLTitleElement', 'HTMLUListElement', 'HTMLUnknownElement', 'HTMLVideoElement'];
		var realClsName = '';
		if (el.constructor)
			realClsName = el.constructor.name;
		var curr = el;
		do {
			var ctor = curr.constructor;
			if (ctor) {
				if (classes.indexOf(ctor.name) >= 0)
					return ctor.name;
			}
			curr = curr.__proto__;
		} while ((curr != null) && (curr != undefined));
		return realClsName;
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getParent_TC15_ = function(node)
	{
		if (11 == node.nodeType)
			return node.host;
		  else 
			return node.parentNode;
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_inDocumentNodeExists_TC15_ = function(node, savedParent)
	{
		if (this. LOCAL_getParent_TC15_(node) !== savedParent)        return false;
		var curr = node;
		for(;;)
		{
			if (9 == curr.nodeType) return this.LOCAL_documentExists_TC15_(curr);
			var parent = this. LOCAL_getParent_TC15_(curr);
			if (!parent) return false;
			curr = parent;
		}
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_inDocumentNodeHidden_TC15_ = function(node)
	{
		if (!node || node.hidden === true)        return true;
		var style = window.getComputedStyle(node, '');
		if (style && style.getPropertyValue('display') === 'none')
			return true;
		if (style && style.getPropertyValue('visibility') === 'hidden')
			return true;
		return false;
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_documentExists_TC15_ = function(doc)
	{
		if (!doc.defaultView) return false;
		if (doc.defaultView.document !== doc) return false;
		return true;
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_isNode_TC15_ = function(obj)
	{
		return obj && (typeof obj === 'object') && (typeof obj.nodeType === 'number') && (typeof obj.nodeName === 'string');
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getConstructorName_TC15_ = function(obj)
	{
		var c = obj.constructor;
		if (c) return c.name;
		return '';
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getWindowViewportWidth_TC15_ = function(wnd)
	{
		var result = wnd.innerWidth;    var doc = wnd.document;    if (doc)    {        var rootEl = doc.doctype ? doc.documentElement : doc.body;        if (rootEl)        {            var elVal = rootEl.clientWidth;            if (result > elVal)                result = elVal;        }    }    return result;}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getWindowViewportHeight_TC15_ = function(wnd)
	{
		var result = wnd.innerHeight;    var doc = wnd.document;    if (doc)    {        var rootEl = doc.doctype ? doc.documentElement : doc.body;        if (rootEl)        {            var elVal = rootEl.clientHeight;            if (result > elVal)                result = elVal;        }    }    return result;}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getInFrameContentLeft_TC15_ = function(frame)
	{
		var style = frame.ownerDocument.defaultView.getComputedStyle(frame);
		if (!style)
			return 0;
		var border = parseInt(style.getPropertyValue('border-left-width'));
		var padding = parseInt(style.getPropertyValue('padding-left'));
		return border + padding;
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getInFrameContentTop_TC15_ = function(frame)
	{
		var style = frame.ownerDocument.defaultView.getComputedStyle(frame);
		if (!style)
			return 0;
		var border = parseInt(style.getPropertyValue('border-top-width'));
		var padding = parseInt(style.getPropertyValue('padding-top'));
		return border + padding;
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getClientRectMember_TC15_ = function(element, memberName)
	{
		return element ? element.getBoundingClientRect()[memberName] : 0;
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getInnerText_TC15_ = function(node, nodeToOmit, delimeter)
	{
		var innerTextRes = '';
		if (node.nodeType == 3)
			innerTextRes += node.nodeValue + delimeter;
		else
		{
			var children = node.childNodes;
			for(var i = 0; i < children.length; i++ )
			{
				var child = children[i];
				if (child === nodeToOmit)
					continue;
				innerTextRes += g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getInnerText_TC15_(child, nodeToOmit, delimeter);
			}
		}
		return innerTextRes;
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getBoundLabelInnerText_TC15_ = function(node)
	{
		var labels = node.labels;
		if ((labels != null) && (labels.length > 0)){
		   for (var i = 0; i < labels.length; i++) {
			var retVal = g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getInnerText_TC15_(labels[i], node, '');
			if ((typeof retVal == 'string') && (retVal.length > 0)) return retVal;
		   }
		}
		if (typeof node.testComplete15_evaluateLabelText == 'function') {
			return node.testComplete15_evaluateLabelText();
		}
		return '';
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getNodeInfo_TC15_ = function(node)
	{
	  var node_info = {};
	  var isElement = (node.nodeType == 1);
	  var isInputElement = (isElement && node.tagName.toLowerCase() == 'input');
	  if (!isElement || !node.getAttribute('isTestCompleteHiddenNode'))
	  {
		node_info.nodeType    = node.nodeType;
		node_info.tagName     = node.tagName || '';
		node_info.className   = node.className || '';
		node_info.inputType   = isInputElement ? node.type  : '';
		node_info.inputValue  = isInputElement ? node.value : '';
		node_info.id          = (isElement && node.getAttribute('id'  )) || '';
		node_info.name        = (isElement && node.getAttribute('name')) || '';
		node_info.role        = (isElement && node.getAttribute('role')) || '';
		node_info.hasNonEmptyTextChild = false;
		node_info.firstChildIsNonEmptyText = false;
		var child = node.firstChild;
		var isFirstChild = true;
		while (child)
		{
		  if (child.nodeType == 3)
		  {
			var txt = child.data;
			if (txt && txt.replace(/^[ \n\r\t]+/, ''))
			{
			  node_info.hasNonEmptyTextChild = true;
			  if (isFirstChild)
				node_info.firstChildIsNonEmptyText = true;
			  break;
			}
		  }
		  child = child.nextSibling;
		  isFirstChild = false;
		}
		node_info.hasChildren = node_info.hasNonEmptyTextChild || (isElement ? node.childElementCount > 0 : node.hasChildNodes());
	  }
	  return JSON.stringify(node_info);
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_hasChildNodeContainingText_TC15_ = function(node, text, tagName, searchSibling)
	{ if (node == null) return '';
	var result = { "found": false, "nextText": ""}; 
	var currNode = null; 
	if (searchSibling) { 
		currNode = node.nextElementSibling; 
	} else { 
		currNode = node.firstElementChild; 
	} 
	var checkTag = tagName != ''; 
	var nextText = ''; 
	while (currNode != null) 
	{ 
		var currTagName = (typeof(currNode.tagName) == "string") ? currNode.tagName.toUpperCase(): "#text"; 
		var skip = false; 
		if (checkTag && (currTagName != tagName)) 
			skip = true; 
		if (!skip) 
		{ 
			var currText = ''; 
			if (currTagName == 'SCRIPT') 
				currText = currNode.text; 
			else 
				currText = currNode.innerText; 
			if (currText != '') 
			{ 
				currText = currText.toLowerCase(); 
				var matchIndex = currText.indexOf(text); 
				if (matchIndex > 0) 
				{ 
					matchIndex += text.length; 
					var str = currText.slice(matchIndex); 
					var pos = -1; 
					var stopList = " ;,()'\"\t\n\r"; 
					for (var i = 0; i < stopList.length; i++) 
					{ 
						var charPos = str.indexOf(stopList.charAt(i)); 
						if (charPos > 0) 
						{ 
							if ((pos == -1) || (pos > charPos)) 
								pos = charPos; 
						} 
					} 
					if (pos > 0) 
					{ 
						if (nextText.length > 0) 
							nextText += '|'; 
						nextText += str.slice(0, pos); 
					} 
					result["found"] = true; 
				} 
			} 
		} 
		currNode = currNode.nextElementSibling; 
	} 
	result["nextText"] = nextText; 
	if (result["found"] == false) 
			return ''; 
	return JSON.stringify(result); 
	} 
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_documentContainsFrames_TC15_ = function(doc)
	{
		return (doc.getElementsByTagName('iframe').length + doc.getElementsByTagName('frame').length) > 0;
	} 
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_evaluateXPath_TC15_ = function(doc, expression, contextNode)
	{
		var expr = doc.createExpression(expression, null);
		var result = expr.evaluate(contextNode, XPathResult.ANY_TYPE, null);
		if (!result) return result;
		if (result.resultType !== XPathResult.UNORDERED_NODE_ITERATOR_TYPE) return result;
		result = expr.evaluate(contextNode, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
		var index = 0; return { "resultType": XPathResult.UNORDERED_NODE_ITERATOR_TYPE, 
		"iterateNext": function() { return result.snapshotItem(index++); } };
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getZoom_TC15_ = function()
	{
		var dpr = window.devicePixelRatio;
		if (typeof dpr !== 'number') return 1.0;
		var iocm = window['$iocm12'];
		var dsf = 1.0;
		if (typeof iocm !== 'undefined') dsf = iocm.context.deviceScaleFactor || 1.0;
		return dpr / dsf;
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getParentsSignatures_TC15_ = function(obj)
	{
		if ((typeof obj !== 'object') || (obj == null) || (typeof obj.nodeType === 'undefined')) return '[]';
		var signatures = [];
		var iocm = window['$iocm12'];
		if (typeof iocm !== 'undefined') {
			var parentNode = this. LOCAL_getParent_TC15_(obj);
			while (parentNode && (parentNode !== document.body)) {
				if (parentNode.nodeName != 'UL') signatures.push(iocm.getObjectPersistentId(parentNode) + '');
				parentNode = this. LOCAL_getParent_TC15_(parentNode);
			}
		}
		return JSON.stringify(signatures);
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.getAttributeNamesString_TC15_ = function(element)
	{
		if (element.getAttributeNames) {
			return element.getAttributeNames().sort().toString();
		}
		var attributes = element.attributes;
		var length = attributes.length;
		var result = new Array(length);
		for (var i = 0; i < length; i++) {
			result[i] = attributes[i].name;
		}
		return result.sort().toString();
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.datasetKeysString_TC15_ = function(element)
	{
	  try {
		if (element.dataset) 
			return Object.keys(element.dataset).toString();
	  } catch(e) {} 
	  return '';
	}
	g_TestCompleteChromeBrowserAgentScriptHelper12_0.LOCAL_getObjectFromCache_TC15_ = function(objectId)
	{
	  var iocm = window['$iocm12'];
	  if (typeof iocm !== 'undefined') {
		return iocm.getObjectFromCache(objectId);
	  }
	  return null;
	};
	(function () {
		"use strict";
	
		var g_LogEnabled = false;
		var g_UseTimeouts = true;

		function logMessage() {
			if (!g_LogEnabled) return;
			if (!console || !console.log) return;
			console.log.apply(console, arguments);
		}
	
		function traceMessage() {
			if (!g_LogEnabled) return;
			if (!console) return;
			if (console.trace) return console.trace.apply(console, arguments);
			console.log.apply(console, arguments);
		}
	
		function safeCall(func) {
			return function() {
				try {
					return func.apply(this, arguments);
				} catch(err) {
					logMessage(err.message);
				}
			};
		}
	
		function getTimeoutExpired(startedAt, timeout) {
			if (!g_UseTimeouts) return false;
			var expired = (new Date() - startedAt) > timeout;
			if (expired) {
				traceMessage('expired');
			}
			return expired;
		}
	
		function findRootDocument(el) {
			var node = el;
			while (node != null) {
				if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE)
					return node;
				node = node.parentNode;
			}
			return !el ? document: el.ownerDocument || document;
		}
	
		function getDeviceScaleFactor() {
			if (typeof getIocm === "function") {
				var iocm = getIocm();
				if ((typeof iocm === "object") && iocm && (typeof iocm.context === "object"))
					return iocm.context.deviceScaleFactor;
			}
	
			return 1.0;
		}
	
		function getZoom(view) {
			var v = view || window;
			return !v ? 1.0: ((v.devicePixelRatio || 1.0) / getDeviceScaleFactor());
		}
	
		(function () {
			if (typeof getIocm !== "function")
				return;
			var iocm = getIocm();
			if ((typeof iocm !== "object") || !iocm)
				return;
	
			if (iocm.inSandbox())
				return;
	
			if ((typeof iocmName !== "string") || (iocmName == "") ||
				(typeof window[iocmName] != "object") || (window[iocmName] == null))
				return;
	
			var getWindowCache = function() {
				return {"zoom": getZoom(window) };
			};
	
			if ((typeof window[iocmName].prevPrevInvoke != 'function') &&
				(typeof window[iocmName].prevInvoke == 'function')) {
				var getCallbackCache = function(iocm, obj, methodName) {
					var nodeType = obj.nodeType || 0;
					if ((nodeType != 1) && (nodeType != 3) && (nodeType != 8))
						return null;
	
					var cache = {};
					var empty = true;
	
					try {
						if (methodName != "#getbounds") {
							cache["#getbounds"] = iocm.getBounds.apply(obj, []);
							empty = false;
						}
	
						if (methodName.indexOf("GetElementSelectorsJson") != -1) {
							cache["testComplete15_GetContentText"] =
								obj.testComplete15_GetContentText();
							empty = false;
						}
					} catch(e) {
					}
	
					return empty ? null: cache;
				}
				var wrapRetVal = function(iocm, callData, methodName, retVal) {
					if (!callData || !retVal)
						return retVal;
	
					var cache = {};
					var empty = true;
	
					var pushObject = function(objectId) {
						if (!objectId)
							return;
						if (cache[objectId])
							return;
						var obj = iocm.getObjectFromCache(objectId);
						if (!obj)
							return;
						var callbackCache = getCallbackCache(iocm, obj, methodName);
						if (!callbackCache)
							return;
						cache[objectId] = callbackCache;
						empty = false;
					}
	
					pushObject(callData["objectId"]);
	
					var params = callData["params"] || [];
					for (var i = 0; i < params.length; i++) {
						var param = params[i] || {};
						pushObject(param["objectId"]);
					}
	
					if (!empty) {
						retVal["cache"] = cache;
					}
		
					return retVal;
				};
				window[iocmName].prevPrevInvoke = window[iocmName].invoke;
				window[iocmName].invoke = function (callData) {
					var methodName = callData ? (callData['method'] || ''): '';
					if (methodName == "#zoom") {
						return { "retVal": getZoom() };
					}
	
					var iocm = window[iocmName];
					var initialCallData = JSON.parse(JSON.stringify(callData));
	
					if ((methodName.indexOf('testComplete') == 0) || 
						(methodName.indexOf('LOCAL_') == 0) || 
						(methodName == 'document') || 
						(methodName == 'activeElement') || 
						(methodName == 'elementFromPoint')) {
						return wrapRetVal(iocm, initialCallData, methodName, iocm.prevInvoke(callData));
					}
					if (methodName == 'isCustomElement') {
						var retVal = iocm.prevInvoke(callData);
						if (retVal && (retVal.retVal === true)) { 
							return wrapRetVal(iocm, initialCallData, methodName, retVal);
						}
					}
					return wrapRetVal(iocm, initialCallData, methodName, iocm.prevPrevInvoke(callData));
				}
			}
			if (typeof window[iocmName].prevCalcMoniker != 'function') {
				window[iocmName].prevCalcMoniker = window[iocmName].calcMoniker;
				window[iocmName].calcMoniker = function fixedCalcMoniker(obj, parentMoniker) {
					var retVal = window[iocmName].prevCalcMoniker(obj, parentMoniker);
					if (retVal != "")
						return retVal;
	
					var rootDocument = findRootDocument(obj);
					if (!rootDocument || (rootDocument == document))
						return ""; // BUGBUG
	
					if (!rootDocument.host)
						return ""; // BUGBUG
					
					parentMoniker = fixedCalcMoniker(rootDocument.host);
	
					if (obj == rootDocument)
						return parentMoniker + ".shadowRoot";
	
					if ((typeof (obj.id) == "string") && (rootDocument.getElementById(obj.id) == obj))
						return parentMoniker + ".shadowRoot.getElementById(\"" + obj.id + "\")";
	
					var parentNode = obj.parentNode;
					if ((typeof parentNode != "object") || (parentNode == null))
						return "";
	
					parentMoniker = fixedCalcMoniker(parentNode);
					if (parentMoniker == "")
						return "";
	
					for (var i = 0; i < parentNode.childNodes.length; i++) {
						if (parentNode.childNodes[i] == obj)
							return parentMoniker + ".childNodes[" + i + "]";
					}
	
					return "";
				}
			}
			if (typeof window[iocmName].prevCreateRetVal != 'function') {
				window[iocmName].prevCreateRetVal = window[iocmName].createRetVal;
				window[iocmName].createRetVal = function (value, parentMoniker, getterName) {
					var retVal = window[iocmName].prevCreateRetVal(value, parentMoniker, getterName);
					retVal["window"] = getWindowCache();
					return retVal;
				};
			}
			if (typeof window[iocmName].prevCacheObject != 'function') {
				window[iocmName].prevCacheObject = window[iocmName].cacheObject;
				window[iocmName].cacheObject = function (obj, parentMoniker, getterName, depth) {
					var initialParentMoniker = parentMoniker || "";
					var initialGetterName = getterName || "";
	
					var iocm = window[iocmName];
					var retVal = iocm.prevCacheObject(obj, parentMoniker, getterName, depth);
					if ((typeof retVal != "object") || !retVal)
						return retVal;
					if ((typeof retVal["cache"] != "object") || !retVal["cache"]) {
						retVal["cache"] = {};
					}
	
					var ctor = retVal["cache"]["$ctor"];
					if (ctor == "Array") {
						retVal["cache"]["length"] = obj.length;
						return retVal;
					// } else if (ctor == "HTMLDocument") {
					// 	retVal["cache"]["title"] = obj.title;
					}
	
					parentMoniker = initialParentMoniker;
					getterName = initialGetterName;
	
					if ((getterName.indexOf("activeElement") != -1) ||
						(getterName.indexOf("elementFromPoint") != -1) ||
						(parentMoniker.indexOf("getMappingContainers") != -1)) {
	
						var nodeType = retVal["cache"]["nodeType"];
						if ((nodeType != 1 /* Element */) && (nodeType != 3 /* TextNode */) && (nodeType != 8 /* Comment */))
							return retVal;
	
						retVal["cache"]["#getbounds"] = iocm.getBounds.apply(obj, []);
	
						retVal["cache"]["#has,\"disabled\""] = 1;
						var disabled = ((obj["disabled"] || obj.getAttribute("disabled") || "false") + "").toLowerCase();
						disabled = (disabled == "yes") || (disabled == "on") || (disabled == "true") ||
							(disabled == "disabled") || (disabled == "");
						retVal["cache"]["disabled"] = disabled;
	
						var rootNode = (typeof obj.getRootNode == "function") ? obj.getRootNode(): null;
						retVal["cache"]["getRootNode"] = iocm.cacheObject(rootNode, parentMoniker, "getRootNode()", depth + 1);
	
						retVal["cache"]["#has,\"value\""] = iocm.hasProperty.apply(obj, ["value", iocm]);
						retVal["cache"]["#has,\"type\""] = iocm.hasProperty.apply(obj, ["type", iocm]);
						var typeValue = obj["type"];
						if (typeValue !== null && typeValue !== undefined) {
							retVal["cache"]["type"] = iocm.encodeParam(typeValue, parentMoniker, "type", depth + 1);
						}
	
						var shadowRoot = obj.shadowRoot;
						if (shadowRoot === null || shadowRoot === undefined) {
							retVal["cache"]["shadowRoot"] = iocm.cacheObject(null, parentMoniker, "shadowRoot", depth + 1);
						}
					}
	
					return retVal;
				}
			}
			window[iocmName].persistentIdValue = Math.round(((new Date()).getTime() % 86400000) * 24.85484713139894);
			
			document.addEventListener("mouseover", window[iocmName].documentMouseOver);
			
			new MutationObserver(function(mutations) {
				if (typeof getIocm === "function") {
					var iocm = getIocm();
					if ((typeof iocm === "object") && iocm) {
						if (!iocm.lastMouseOverTime || (Date.now() - iocm.lastMouseOverTime) > 500)
							return;
						for (var i = 0; mutations && i < mutations.length; i++) {
							var mutationTarget = mutations[i].target;
							// MS Dynamics CRM lookup control
							if (mutationTarget.nodeName.toLowerCase() == "li") {
								for (var j = 0; j < mutations[i].addedNodes.length; j++) {
									var addedNode = mutations[i].addedNodes[j];
									if (addedNode.nodeName.toLowerCase() == "button") {
										var addedNodeId = addedNode.id;
										if (addedNodeId && addedNodeId.indexOf("LookupResultsDropdown") > 0 && addedNodeId.indexOf("_selected_tag_delete_") > 0) {
											var eventTarget = mutationTarget;
											for (var k = 0; k < 5; k++) {
												eventTarget = eventTarget.parentElement;
												if (!eventTarget)
													break;
												if (eventTarget.nodeName.toLowerCase() == "div" && eventTarget.hasAttribute("data-lp-id")) {
													var cachedObj = iocm.cacheObject(eventTarget);
													if (cachedObj && cachedObj.objectId)
														iocm.context.customEvent("HoverMouse", JSON.stringify({ objectId: cachedObj.objectId.toString() }));
													break;
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}).observe(
				document.documentElement, 
				{ attributes: false, characterData: false, childList: true, subtree: true }
			);
		}) ();
	 
		function ObjectAssign(target) {
			if (target === undefined || target === null) {
				throw new TypeError('Cannot convert first argument to object');
			}
		
			var to = Object(target);
			for (var i = 1; i < arguments.length; i++) {
				var nextSource = arguments[i];
				if (nextSource === undefined || nextSource === null) {
					continue;
				}
		
				var keysArray = Object.keys(Object(nextSource));
				for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
					var nextKey = keysArray[nextIndex];
					var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
					if (desc !== undefined && desc.enumerable) {
						to[nextKey] = nextSource[nextKey];
					}
				}
			}
			return to;
		}
	
		function ObjectValues(o) {
			if (typeof Object.values === "function") {
				return Object.values(o);
			}
			return ArrayReduce(Object.keys(o), function(v, k) {
				return v.concat(typeof k === 'string' && !!o[k] ? [o[k]]: []);
			}, []);
		}
	
		function ObjectEntries(o) {
			if (typeof Object.entries === "function") {
				return Object.entries(o);
			}
			return ArrayReduce(Object.keys(o), function(v, k) {
				return v.concat(typeof k === 'string' && !!o[k] ? [[k, o[k]]]: []);
			}, []);
		}
	
		function StringStartsWith(str, value) {
			if (str.startsWith)
				return str.startsWith(value);
			return str.indexOf(value) == 0;
		}
	
		function ArrayPush(thisArg, value) {
			if (!!thisArg.push) {
				return thisArg.push(value);
			}
	
			thisArg[thisArg.length] = value;
			return thisArg.length;
		}
	
		function ArrayShift(thisArg) {
			if (!!thisArg.shift) {
				return thisArg.shift();
			}
	
			if (!thisArg.length)
				return;
			return thisArg.splice(0, 1)[0];
		}
	
		function ArrayUnshift(thisArg, value) {
			if (!!thisArg.unshift) {
				return thisArg.unshift(value);
			}
	
			thisArg.splice(0, 0, value);
			return thisArg.length;
		}
	
		function ArrayFrom(thisArg) {
			if (!!thisArg.from) {
				return Array.from(thisArg);
			}
	
			var toStr = Object.prototype.toString;
			var isCallable = function (fn) {
				return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
			};
			var toInteger = function (value) {
				var number = Number(value);
				if (isNaN(number)) { return 0; }
				if (number === 0 || !isFinite(number)) { return number; }
				return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
			};
			var maxSafeInteger = Math.pow(2, 53) - 1;
			var toLength = function (value) {
				var len = toInteger(value);
				return Math.min(Math.max(len, 0), maxSafeInteger);
			};
	
			return (function (arrayLike) {
				var items = Object(arrayLike);
				if (arrayLike == null) {
					throw new TypeError("Array.from requires an array-like object - not null or undefined");
				}
				var len = toLength(items.length);
				var A = new Array(len);
				var kValue;
				if (len === 0 && isCallable(items.next)) {
					while(true) {
						kValue = items.next();
						if (kValue.done) break;
						ArrayPush(A, kValue.value);
					}
				} else {
					var k = 0;
					while (k < len) {
						kValue = items[k];
						A[k] = kValue;
						k += 1;
					}
					A.length = len;
				}
				return A;
			})(thisArg);
		}
	
		function ArrayFilter(thisArg, func) {
			if (!!thisArg.filter){
				return thisArg.filter(func);
			}
	
			return (function(func, thisArg) {
				if (! ((typeof func === 'Function' || typeof func === 'function') && this) )
					throw new TypeError();
				 
				var len = this.length >>> 0,
					res = new Array(len),
					t = this, c = 0, i = -1;
			  
				var kValue;
				if (thisArg === undefined) {
					while (++i !== len) {
						if (i in this) {
							kValue = t[i]; 
							if (func(t[i], i, t)){
								res[c++] = kValue;
							}
						}
					}
				}
				else {
					while (++i !== len) {
						if (i in this) {
							kValue = t[i];
							if (func.call(thisArg, t[i], i, t)) {
								res[c++] = kValue;
							}
						}
					}
				}
				
				res.length = c; 
				return res;
			}).apply(thisArg, [func, thisArg]);
		}
	
		function ArrayMap(thisArg, callback, callbackThis) {
			if (!!thisArg.map) {
				return thisArg.map(callback, callbackThis);
			}
	
			return (function() {
				var A, k;
			
				var O = Object(thisArg);
				var len = O.length >>> 0;
			
				A = new Array(len);
				k = 0;
				while (k < len) {
				  var kValue, mappedValue;
				  if (k in O) {
					kValue = O[k];
					mappedValue = callback.call(callbackThis, kValue, k, O);
					A[k] = mappedValue;
				  }
				  k++;
				}
				return A;
			}) ();
		}
	
		function ArrayReduce(thisArg, callback, initialValue) {
			if (!!thisArg.reduce) {
				return thisArg.reduce(callback, initialValue);
			}
	
			return (function(callback, initialValue) {
				if (this === null) {
					throw new TypeError('Array.prototype.reduce called on null or undefined' );
				}
				if (typeof callback !== 'function') {
					throw new TypeError(callback + ' is not a function');
				}
		  
				var o = Object(this);
				var len = o.length >>> 0; 
				var k = 0; 
				var value;
		  
				if (arguments.length >= 2) {
				  value = arguments[1];
				} else {
					while (k < len && !(k in o)) {
						k++; 
					}
			
					if (k >= len) {
						return initialValue;
					}
					value = o[k++];
				}
		  
				while (k < len) {
					if (k in o) {
						value = callback(value, o[k], k, o);
					}
					k++;
				}
				return value;
			}).apply(thisArg, [callback, initialValue]);
		}
	
		function ArraySort(thisArg, callback) {
			if (!!thisArg.sort) {
				return thisArg.sort(callback);
			}
	
			return (function(compareFn) {
	
				if (!compareFn) {
					compareFn = function (l, r) { return l - r; };
				}
				return mergeSort(this);
	
				function mergeSort(arr) {
					if (arr.length === 1) {
						return arr
					}
					var middle = Math.floor(arr.length / 2);
					var left = arr.slice(0, middle);
					var right = arr.slice(middle);
					return merge(
						mergeSort(left),
						mergeSort(right)
					);
				}
	
				function merge(left, right) {
					var result = [];
					var indexLeft = 0;
					var indexRight = 0;
					while (indexLeft < left.length && indexRight < right.length) {
						var _left = left[indexLeft];
						var _right = right[indexRight];
						if (composeCompareFn(compareFn(_left, _right))) {
							ArrayPush(result, left[indexLeft]);
							indexLeft++;
						} else {
							ArrayPush(result, right[indexRight]);
							indexRight++;
						}
					}        
					return result.concat(left.slice(indexLeft)).concat(right.slice(indexRight));
				}    
				
				function composeCompareFn(compareResult) {
					if (compareResult <= 0)
						return false;
					return true;
				}
			}).apply(thisArg, [callback]);
		}
	
		function ArrayForEach(thisArg, callback, callbackThisArg) {
			if (!!thisArg.forEach) {
				return thisArg.forEach(callback, callbackThisArg);
			}
	
			for (var i = 0; i < thisArg.length; i++)
				callback.call(callbackThisArg, thisArg[i], i, thisArg);
			return thisArg;
		}
	
		function ArrayFind(thisArg, callback, callbackThis) {
			if (!!thisArg.find) {
				return thisArg.find(callback, callbackThis || thisArg);
			}
	
			for (var i = 0; i < thisArg.length; i++) {
				var element = thisArg[i];
				if (callback.call(callbackThis || thisArg, element, i, thisArg)) {
					return element;
				}
			}
		}
	
		function cssesc(string, options) {
			var merge = function (options, defaults) {
				var object = {};
				var hasOwnProperty = object.hasOwnProperty;
				if (!options) {
					return defaults;
				}
				var result = {};
				for (var key in defaults) {
					result[key] = hasOwnProperty.call(options, key)
						? options[key]
						: defaults[key];
				}
				return result;
			};
			options = merge(options, cssesc.options);
			if (options.quotes != 'single' && options.quotes != 'double') {
				options.quotes = 'single';
			}
			var quote = options.quotes == 'double' ? '"' : '\'';
			var isIdentifier = options.isIdentifier;
	
			var firstChar = string.charAt(0);
			var output = '';
			var counter = 0;
			var length = string.length;
			while (counter < length) {
				var character = string.charAt(counter++);
				var codePoint = character.charCodeAt();
				var value;
				if (codePoint < 0x20 || codePoint > 0x7E) {
					if (codePoint >= 0xD800 && codePoint <= 0xDBFF && counter < length) {
						var extra = string.charCodeAt(counter++);
						if ((extra & 0xFC00) == 0xDC00) { // next character is low surrogate
							codePoint = ((codePoint & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000;
						} else {
							counter--;
						}
					}
					value = '\\' + codePoint.toString(16).toUpperCase() + ' ';
				} else {
					if (options.escapeEverything) {
						if (options.regexAnySingleEscape.test(character)) {
							value = '\\' + character;
						} else {
							value = '\\' + codePoint.toString(16).toUpperCase() + ' ';
						}
					} else if (/[\t\n\f\r\x0B:]/.test(character)) {
						if (!isIdentifier && character == ':') {
							value = character;
						} else {
							value = '\\' + codePoint.toString(16).toUpperCase() + ' ';
						}
					} else if (
						character == '\\' ||
						(
							!isIdentifier &&
							(
								(character == '"' && quote == character) ||
								(character == '\'' && quote == character)
							)
						) ||
						(isIdentifier && options.regexSingleEscape.test(character))
					) {
						value = '\\' + character;
					} else {
						value = character;
					}
				}
				output += value;
			}
	
			if (isIdentifier) {
				if (/^_/.test(output)) {
					output = '\\_' + output.slice(1);
				} else if (/^-[-\d]/.test(output)) {
					output = '\\-' + output.slice(1);
				} else if (/\d/.test(firstChar)) {
					output = '\\3' + firstChar + ' ' + output.slice(1);
				}
			}
			output = output.replace(options.regexExcessiveSpaces, function ($0, $1, $2) {
				if ($1 && $1.length % 2) {
					return $0;
				}
				return ($1 || '') + $2;
			});
	
			if (!isIdentifier && options.wrap) {
				return quote + output + quote;
			}
			return output;
		};
	
		// Expose default options (so they can be overridden globally).
		cssesc.options = {
			'escapeEverything': false,
			'isIdentifier': false,
			'quotes': 'single',
			'wrap': false,
			'regexAnySingleEscape': /[ -,\./;-@\[-\^`\{-~]/,
			'regexSingleEscape': /[ !#-&\(-,\./;-@\[\]\^`\{-~]/,
			'regexExcessiveSpaces': /(^|\\+)?(\\[A-F0-9]{1,6})\x20(?![a-fA-F0-9\x20])/g,
		};
	
		function NodeListFromArray(array)  {
			if (array === null || array === undefined)
				return null;
	
			function NodeListItem(index) {
				if (this === null || this === undefined)
					return undefined;
	
				return this[index];
			}
	
			array.item = NodeListItem;
			return array;
		}
	
		function LocatorBuilder(element, frameDocument) {
			/* This function contains modified source code from 
			   selenium-ide (https://github.com/SeleniumHQ/selenium-ide) */
			this.element = element;
			this.rootDocument = !!frameDocument ? frameDocument: findRootDocument(element);
			this.shortStringLength = 64;
			this.hugeStringLength = 256;
			this.lastChance = false;
			this.useCss = (typeof this.rootDocument.evaluate !== "function") &&
				(typeof this.rootDocument.querySelector === "function");
		}
	
		LocatorBuilder.selectorGenerationTimeout = 100;
	
		function CssLocatorBuilder(element, rootDocument, options) {
			this.element = element;
			this.rootDocument = rootDocument;
			options = options || {};
			var filterValues = true;
			var minDepth = options.minDepth || 2;
			var maxDepth = options.maxDepth || 3;
			var leafAttrs = options.leafAttrs;
			var justMatch = options.justMatch;
			var noIndex = options.noIndex;
	
			var timeout = LocatorBuilder.selectorGenerationTimeout;
			var startedAt = new Date();
			var abortException = "{5CD57FB2-723E-4F66-8F38-BA7C73346FB0}";
			function getExpired() {
				var effectiveTimeout = timeout > 0 ? timeout: LocatorBuilder.selectorGenerationTimeout / 2;
				return getTimeoutExpired(startedAt, effectiveTimeout);
			}
	
			var __assign = (this && this.__assign) || function () {
				__assign = Object.assign || function (t) {
					for (var s, i = 1, n = arguments.length; i < n; i++) {
						s = arguments[i];
						for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
							t[p] = s[p];
					}
					return t;
				};
				return __assign.apply(this, arguments);
			};
			var __generator = (this && this.__generator) || function (thisArg, body) {
				var _ = { label: 0, sent: function () { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
				return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
				function verb(n) { return function (v) { return step([n, v]); }; }
				function step(op) {
					if (getExpired()) throw new TypeError(abortException);
					if (f) throw new TypeError("Generator is already executing.");
					while (_) try {
						if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
						if (y = 0, t) op = [op[0] & 2, t.value];
						switch (op[0]) {
							case 0: case 1: t = op; break;
							case 4: _.label++; return { value: op[1], done: false };
							case 5: _.label++; y = op[1]; op = [0]; continue;
							case 7: op = _.ops.pop(); _.trys.pop(); continue;
							default:
								if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
								if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
								if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
								if (t && _.label < t[2]) { _.label = t[2]; ArrayPush(_.ops, op); break; }
								if (t[2]) _.ops.pop();
								_.trys.pop(); continue;
						}
						op = body.call(thisArg, _);
					} catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
					if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
				}
			};
			var __spreadArrays = (this && this.__spreadArrays) || function () {
				for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
				for (var r = Array(s), k = 0, i = 0; i < il; i++)
					for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++ , k++)
						r[k] = a[j];
				return r;
			};
			var __values = (this && this.__values) || function (o) {
				var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
				if (m) return m.call(o);
				if (o && typeof o.length === "number") return {
					next: function () {
						if (o && i >= o.length) o = void 0;
						return { value: o && o[i++], done: !o };
					}
				};
				if (o && typeof o.next === "function") return o;
				throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
			};
			var config;
			function default_1(input, options) {
				if (input.nodeType !== Node.ELEMENT_NODE) {
					throw new Error("Can't generate CSS selector for non-element node type.");
				}
				if ('html' === input.tagName.toLowerCase()) {
					return 'html';
				}
				var defaults = {
					root: rootDocument.body || rootDocument,
					idName: function (name) { return filterValues ? idIsStatic(name): true; },
					className: function (name) { return filterValues ? classNameIsStatic(name): true; },
					tagName: function (name) { return true; },
					attr: function (name, value, input) {
						if (!attrIsApplicable(name))
							return false;
						if ((input === element) && (name == "name"))
							return false;
						return filterValues ? attrIsStatic(name, value): !!value; 
					},
					seedMinLength: minDepth,
					optimizedMinLength: maxDepth + 1,
				};
				config = __assign(__assign({}, defaults), options);
				var path;
				try {
					path = bottomUpSearch(input);
				} catch(e) {
				}
				if (path) {
					try {
						var optimized = sort(optimize(path, input));
						if (optimized && optimized.length) {
							path = optimized[0];
						}
					} catch(e) {
					}
					return path;
				}
				else {
					throw new Error("Selector was not found.");
				}
			}
			function bottomUpSearch(input) {
				var path = null;
				var stack = [];
				var current = input;
				var i = 0;
				var dirty = false;
				var _loop_1 = function () {
					var level = [];
					if (element !== current) {
						level = level.concat(id(current));
					} else if (!leafAttrs || !leafAttrs.length) {
						level = level.concat(tagName(current));
					} 
					level = level.concat(attr(current)).concat(classNames(current));
					if (element !== current) {
						level = level.concat(tagName(current));
					}
					if (level.length) {
						if (!noIndex && ((element !== current) || !leafAttrs || !leafAttrs.length)) { 
							var nth = index(current);
							if (nth) {
								level = level.concat(ArrayMap(ArrayFilter(level, requiredNth), function (node) { return nthChild(node, nth); }));
							}
						}
	
						for (var _i = 0, level_1 = level; _i < level_1.length; _i++) {
							var node = level_1[_i];
							node.level = i;
							node.input = current;
						}
	
						ArrayPush(stack, level);
						dirty = true;
	
						if (stack.length >= config.seedMinLength) {
							path = findUniquePath(stack);
							dirty = false;
							if (path) {
								return "break";
							}
						}
					}
	
					current = current.parentElement;
					i++;
				};
				while (current && current !== config.root.parentElement) {
					var state_1 = _loop_1();
					if (state_1 === "break")
						break;
					if (getExpired()) return null;
				}
				if (!path && dirty) {
					path = findUniquePath(stack);
				}
				return path;
			}
			function findUniquePath(stack) {
				var combinationsCount = 0;
				var effectiveStack = stack;
				var propagateChanges = false;
				while (true) {
					var effectiveCount = ArrayReduce(effectiveStack, function(acc, level) {
						return acc * ((level && level.length) ? level.length: 1);
					}, 1);
	
					if ((effectiveCount < 300) || (effectiveCount == combinationsCount)) {
						break;
					}
	
					effectiveStack = ArrayMap(effectiveStack, function(level) {
						if (level.length <= 2)
							return level;
						var nth = -1;
						for (var i = 0; i < level.length; i++) {
							if (level[i].nth) {
								nth = i;
								break;
							}
						}
						if (nth != -1) {
							var top = level.slice(0, 1), bottom = [];
							if (nth > 2)
								top = top.concat(level.slice(1, nth - 1));
							if (nth < level.length - 1)
								bottom = level.slice(nth, level.length - 1);
							return top.concat(bottom);
						}
						return level.slice(0, level.length - 1);
					});
					combinationsCount = effectiveCount;
					propagateChanges = true;
				}
				if (propagateChanges) {
					ArrayForEach(effectiveStack, function(level, i) {
						stack[i] = level;
					});
				}
	
				var paths = sort(combinations(stack));
				if (getExpired()) return;
	
				for (var _i = 0, paths_1 = paths; _i < paths_1.length; _i++) {
					var candidate = paths_1[_i];
					if (unique(candidate)) {
						return candidate;
					}
					if (getExpired()) return;
				}
				return null;
			}
			function selector(path) {
				var node = path[0];
				var query = node.name;
				for (var i = 1; i < path.length; i++) {
					var level = path[i].level || 0;
					if (node.level === level - 1) {
						query = path[i].name + " > " + query;
					}
					else {
						query = path[i].name + " " + query;
					}
					node = path[i];
				}
				return query;
			}
			function penalty(path) {
				return ArrayReduce(ArrayMap(path, function (node) { return node.penalty; }), function (acc, i) { return acc + i; }, 0);
			}
			function unique(path) {
				var result = rootDocument.querySelectorAll(selector(path));
				switch (result.length) {
					case 0:
						throw new Error("Can't select any node with this selector: " + selector(path));
					case 1:
						return result[0];
					default:
						return !justMatch ? false: (result[0] !== element ? false: result[0]);
				}
			}
			function id(input) {
				var elementId = input.getAttribute('id');
				if (elementId && config.idName(elementId)) {
					return [{
						name: '#' + cssesc(elementId, { isIdentifier: true }),
						penalty: 0,
					}];
				}
				return [];
			}
			function attr(input) {
				var attrs;
				if ((input === element) && leafAttrs && leafAttrs.length) {
					attrs = leafAttrs;
				}
				if (!attrs) {
					var hrefBasedAttrs = ['src', 'href', 'action'];
					var attrList = ArrayFilter(ArrayFrom(input.attributes), function (attr) { 
						return config.attr(attr.name, attr.value, input); 
					});
					attrs = [];
					ArrayForEach(attrList, function(attr) {
						if (hrefBasedAttrs.indexOf(attr.name) != -1) {
							var href = attr.value;
							if (!href) return;
							var purified = purifyHref(href);
							var hrefs = combineHrefGrowth(href).concat(purified ? [purified]: []);
							ArrayForEach(hrefs, function(item) {
								ArrayPush(attrs, {'name': attr.name, 'value': item, 'contains': item != href });
							});
							if (purified && (href == purified)) return;
						}
						ArrayPush(attrs, {'name': attr.name, 'value': attr.value, 'contains': false });
					});
				}
				return ArrayMap(attrs, function (attr) {
					if (attr.name != "class") {
						return ({
							name: '[' + cssesc(attr.name, { isIdentifier: true }) + 
								(attr.contains ? '*=': '=') + '\'' + cssesc(attr.value) + '\']',
							penalty: 0.5
						});
					}
					return ({
						name: '.' + cssesc(attr.value, { isIdentifier: true }),
						penalty: 1
					});
				});
			}
			function classNames(input) {
				var names = ArrayFilter(ArrayFrom(input.classList), config.className);
				return ArrayMap(names, function (name) {
					return ({
						name: '.' + cssesc(name, { isIdentifier: true }),
						penalty: 1
					});
				});
			}
			function tagName(input) {
				var name = input.tagName.toLowerCase();
				if (config.tagName(name)) {
					return [{
						name: name,
						penalty: (element === input ? 0: 2)
					}];
				}
				return [];
			}
			function any() {
				return [{
					name: '*',
					penalty: 3
				}];
			}
			function index(input) {
				var parent = input.parentNode;
				if (!parent) {
					return null;
				}
				var child = parent.firstChild;
				if (!child) {
					return null;
				}
				var i = 0;
				while (child) {
					if (child.nodeType === Node.ELEMENT_NODE) {
						i++;
					}
					if (child === input) {
						break;
					}
					child = child.nextSibling;
				}
				return i;
			}
			function nthChild(node, i) {
				return {
					name: node.name + (":nth-child(" + i + ")"),
					penalty: node.penalty + 1,
					nth: true
				};
			}
			function requiredNth(node) {
				return node.name !== 'html' && ((node.name === '') || (node.name.charAt(0) !== '#'));
			}
			function notEmpty(value) {
				return value !== null && value !== undefined;
			}
			function combinations(stack, path) {
				var _i, _a, node;
				if (path === void 0) { path = []; }
				return __generator(this, function (_b) {
					switch (_b.label) {
						case 0:
							if (!(stack.length > 0)) return [3 /*break*/, 5];
							_i = 0, _a = stack[0];
							_b.label = 1;
						case 1:
							if (!(_i < _a.length)) return [3 /*break*/, 4];
							node = _a[_i];
							return [5 /*yield**/, __values(combinations(stack.slice(1, stack.length), path.concat(node)))];
						case 2:
							_b.sent();
							_b.label = 3;
						case 3:
							_i++;
							return [3 /*break*/, 1];
						case 4: return [3 /*break*/, 7];
						case 5: return [4 /*yield*/, path];
						case 6:
							_b.sent();
							_b.label = 7;
						case 7: return [2 /*return*/];
					}
				});
			}
			function sort(paths) {
				return ArraySort(ArrayFrom(paths), function (a, b) { return penalty(a) - penalty(b); });
			}
			function optimize(path, input) {
				var i, newPath;
				return __generator(this, function (_a) {
					switch (_a.label) {
						case 0:
							if (!(path.length > 2 && path.length > config.optimizedMinLength)) return [3 /*break*/, 5];
							i = 1;
							_a.label = 1;
						case 1:
							if (!(i < path.length - 1)) return [3 /*break*/, 5];
							newPath = __spreadArrays(path);
							newPath.splice(i, 1);
							if (unique(newPath) !== input) return [3 /*break*/, 4];
							return [4 /*yield*/, newPath];
						case 2:
							_a.sent();
							return [5 /*yield**/, __values(optimize(newPath, input))];
						case 3:
							_a.sent();
							_a.label = 4;
						case 4:
							i++;
							return [3 /*break*/, 1];
						case 5: return [2 /*return*/];
					}
				});
			}
	
			this.path = default_1(element);
		}
	
		CssLocatorBuilder.prototype.getSelector = function () {
			var path = this.path || [];
			if (path.length == 0) {
				return "";
			}
			var node = path[0];
			var query = node.name;
			for (var i = 1; i < path.length; i++) {
				var level = path[i].level || 0;
				if (node.level === level - 1) {
					query = path[i].name + " > " + query;
				}
				else {
					query = path[i].name + " " + query;
				}
				node = path[i];
			}
			return query;
		}
	
		CssLocatorBuilder.prototype.getContainers = function () {
			var path = this.path || [];
			var nodes = [];
			for (var i = 0; i < path.length; i++) {
				var node = path[i];
				if (node.input && (node.input != this.element)) {
					ArrayPush(nodes, node.input);
				}
			}
			return nodes;
		}
	
		Element.prototype.testComplete15_GetContentText = safeCall(function () {
			return TestCompleteWebTestingHelpers.getContentText(this);
		});
	
		Element.prototype.testComplete15_GetAttributeNames = safeCall(function () {
			if (this === null || this === undefined)
				return '';
	
			var attributes = this.attributes;
			var length = attributes.length;
			var result = new Array(length);
			for (var i = 0; i < length; i++) {
				result[i] = attributes[i].name;
			}
			return ArraySort(result).toString();
		});
	
		Element.prototype.testComplete15_GetDataSetKeys = safeCall(function () {
			if (this === null || this === undefined)
				return '';
	
			return Object.keys(this.dataset).toString();
		});
	
		function calcEntropy(str) {
			var len = str.length
			var freq = ArrayReduce(ArrayFrom(str), function(f, c) {
				  return (f[c] = (f[c] || 0) + 1) && f;
			}, {});
			return ArrayReduce(ObjectValues(freq), function(sum, f) {
				return sum - f/len * Math.log(f/len) * Math.LOG2E;
			}, 0);
		}
		
		function highEntropy(str) {
			return calcEntropy(str) >= 4.2;
		}
	
		var g_idIsStatic_Expr = [
			/^yui-gen(.*)/i,
			/^(.*)yui_3_(.*)/i,
			/^ui-id-(.*)/i,
			/^dijit_(.*)/i,
			/[0-9a-fA-F]{8}[-_][0-9a-fA-F]{4}[-_][0-9a-fA-F]{4}[-_][0-9a-fA-F]{4}[-_][0-9a-fA-F]{12}/i,
			/^[A-Za-z](\d\d\d\d\d+)([A-Za-z-]*)$/i,
			/^([A-Za-z-]+)(\d\d\d\d\d+)$/i,
			/^([A-Za-z_]+)_(\d\d\d\d\d+)([A-Za-z_]*)$/i,
			/^([A-Za-z_]+)(\d\d\d\d\d+)([A-Za-z_]*)$/i,
			/^(.*[-_$])?(ctl[0-9]+)$/i,
			/^(.*-)?ext-gen/i,
			/^(.*-)?ext-comp/i,
			/^extdd-(.*)$/i,
			/^([A-Za-z-]+)-(\d\d\d\d+)(.*)$/i,
			/^ext-(.*)-\d+$/i,
			/^(_t)([0-9]+)$/i,
			/^(j_idt?)([0-9]+)$/i,
			/(.+):([^0-9]+)$/i,
			/(.+):(.*)/i,
			/^(gwt-uid-[0-9]+)(_(.*))?$/i,
			/^(x-((widget)|(auto))-.*[0-9]+)([-_](.*))?$/i,
			/^([A-Za-z-]+)([_0-9a-f]{15,})$/i,
			/^checkbox-[0-9\-]+$/i,
			/^input-[0-9\-]+$/i,
			/^id[_0-9\-]+$/i,
		];
	
		var idIsStaticGeneral = function(name) {
			if (typeof name !== "string" || name === "") {
				return false;
			}
			try {
				var basicFilters = [/(\d\d\d\d+)/, 
					/^[0-9a-z]{6,6}-[0-9a-z]{6,6}-[0-9a-z]{6,6}-[0-9a-z]{6,6}$/,
					/[ !#-&\(-,/:;-@\[\]\^`\{-~]/,
				];
				for (var i = 0; i < basicFilters.length; i++) {
					if (basicFilters[i].test(name)) {
						logMessage('RegExpr: ' + basicFilters[i] + ' treats "' + name + '" as dynamic');
						return false;
					}
				}
	
				for (var i = 0; i < g_idIsStatic_Expr.length; i++) {
					var expr = g_idIsStatic_Expr[i];
					if (expr.test(name) === true) {
						logMessage('RegExpr: ' + expr + ' treats "' + name + '" as dynamic');
						return false;
					}
				}
	
				if (highEntropy(name)) {
					logMessage('Treat "' + name + '" as high entropy');
					return false;
				}
			} catch (e) {
	
			}
			return true;
		};
	
		var idIsStaticWithoutDigits = function(name) {
			if (typeof name !== "string" || name === "") {
				return false;
			}
			if (/\d/.test(name)) {
				return false;
			}
			return idIsStaticGeneral(name);
		}; 
	
		var suppressDigitsInId = (function() {
			try {
				var href = document.location.href.toLowerCase();
				return href.indexOf("crm.dynamics.com") != -1;
			} catch (e) {
			}
			return false;
		}) ();
	
		var idIsStatic = !suppressDigitsInId ? idIsStaticGeneral: idIsStaticWithoutDigits;
	
		function classNameIsStatic(name) {
			if (typeof name !== "string" || name === "") {
				return false;
			}
			try {
				var reHoverClass = /(on)?(hover|hovered|over|active|current|focus|focused|focusin|selected)([^a-z0-9]|$)/i;
				if (reHoverClass.test(name) === true) {
					return false;
				}
			} catch (e) {
	
			}
			return true;
		}
	
		function roleIsStatic(name) {
			if (typeof name !== "string" || name === "") {
				return false;
			}
			return name.toLowerCase() != "presentation";
		}
	
		function hrefIsInvalid(href) {
			return StringStartsWith((href || "").toLowerCase().trim(), "javascript:void(0)");
		}
	
		var c_hrefDomain_Limit = 16;
		var c_hrefParameter_Limit = 16;
		var c_hrefAlias_Limit = 32;
	
		function hasHrefAttribute(el, attrName) {
			if (!el || !el.hasAttribute) {
				return false;
			}
			attrName = attrName || "href";
			if (!el.hasAttribute(attrName)) {
				return false;
			}
			var href = (el.getAttribute ? el.getAttribute(attrName): null) || "";
			return !hrefIsInvalid(href);
		}
	
		function getHrefAttribute(el, attrName) {
			attrName = attrName || "href";
			if (!hasHrefAttribute(el, attrName)) {
				return "";
			}
			return (el.getAttribute ? el.getAttribute(attrName): null) || "";
		}
	
		function hrefHasDynamicParams(href) {
			if (!href || (href == ""))
				return false;
	
			var index = href.indexOf("?");
			if (index != -1) {
				var params = (href.slice(index + 1) || "").split("&");
				for (var i = 0; i < params.length; i++) {
					var item = params[i].split("=");
					for (var p = 0; p < item.length; p++) {
						var param = item[p];
						if ((param.length > c_hrefParameter_Limit) || !idIsStatic(param)) {
							return true;
						}
					}
				}
			}
	
			return false;
		}
	
		function hrefIsStatic(href) {
			if ((typeof href != "string") || 
				(href === "")) {
				return false;
			}
	
			if (hrefIsInvalid(href)) {
				return false;
			}
			
			if (href.indexOf('%') != -1)
				return false;
	
			if (hrefHasDynamicParams(href))
				return false;
	
			var index = href.indexOf("?");
			if (index != -1) {
				href = href.slice(0, index);
			}
	
			var parts = href.split('/');
			for (var i = 0; i < parts.length; i++) {
				var part = parts[i];
				if (!part || (part == ""))
					continue;
				var domains = part.split('.');
				if (domains.length > 0) {
					for (var d = 0; d < domains.length; d++) {
						var domain = domains[d];
						if (!domain || (domain == ""))
							continue;
						if ((domain.length > c_hrefDomain_Limit) || !idIsStatic(domain))
							return false;
					}
					continue;
				}
				if ((part.length > c_hrefAlias_Limit) || !idIsStatic(part))
					return false;
			}
	
			return true;
		}
	
		function purifyHref(href) {
			if ((typeof href != "string") || 
				(href === "") || (href == "#")) {
					return null;
			}
	
			if (hrefIsStatic(href)) {
				return href;
			}
	
			var index = href.indexOf("?");
			if (index != -1) {
				if ((index > 0) && (index < href.length - 1)) {
					href = href.slice(0, index);
				} else {
					href = href.slice(index, href.length - 1);
				}
			}
	
			if (hrefIsStatic(href)) {
				return href;
			}
	
			var splitChar = '/';
			var parts = href.split(splitChar);
			if (parts.length <= 1) {
				splitChar = '\\';
				parts = href.split(splitChar);
			}
			href = "";		
			var protocols = ["http:", "https:", "file:"];
			for (var i = 0; i < parts.length; i++) {
				var part = parts[i];
				if (!part || (part == "")) {
					if (href != "") {
						break;
					}
					continue;
				}
				if ((i == 0) && (protocols.indexOf(part.toLowerCase()) != -1)) {
					continue;
				}
				if (((part.indexOf('.') == -1) && (part.length > c_hrefAlias_Limit)) || 
					!idIsStatic(part) || (part.indexOf('%') != -1) || (part.indexOf('\\') != -1)) {
					if (href != "") {
						break;
					}
					continue;
				}
	
				if (href != "") href += splitChar;
				href += part;
			}
	
			return href != "" ? href: null;
		}
	
		function splitHref(href) {
			if ((typeof href != "string") || 
				(href === "") || (href == "#")) {
				return [];
			}
	
			var firstSplits = ["?", "#"];
			ArrayForEach(firstSplits, function(s) {
				var index = href.indexOf(s);
				if (index != -1) {
					href = href.slice(0, index);
				}
			});
	
			var splitChar = href.indexOf('/') != -1 ? '/': '\\';
			return ArrayFilter(ArrayMap(href.split(splitChar), function (part) {
				if (!part || (part == ""))
					return "";
				if (["http:", "https:", "file:"].indexOf(part.toLowerCase()) != -1)
					return "";
				if (!idIsStatic(part) || (part.indexOf('%') != -1))
					return "";
				return part;
			}), function (part) {
				return part && (part.length > 0);
			});
		}
	
		function combineHrefGrowth(href) {
			if (typeof href !== "string" || !href) return [];
			var growth = [];
			var current = "";
			var parts = splitHref(href);
			var splitChar = href.indexOf('/') != -1 ? '/': '\\';
			for (var i = parts.length; i > 0; i--) {
				if (current) current = splitChar + current;
				current = parts[i - 1] + current;
				if (href.indexOf(current) == -1) current = parts[i - 1];
				if (current) ArrayPush(growth, current);
			}
			return growth;
		}
	
		function lastHrefPart(href) {
			var parts = combineHrefGrowth(href);
			return parts.length ? parts[0]: "";
		}
	
		var applicableAttrs = ["name", "type", "value", "src", "href", "action", "alt", "role", "title", "disabled", "checked"];
	
		function attrIsApplicable(name) {
			if (typeof name !== "string" || name === "")
				return false;
			name = name.toLowerCase();
			if (applicableAttrs.indexOf(name) != -1)
				return true;
			if ((name.indexOf("aria-") == 0) ||
				(name.indexOf("data-") == 0))
				return true;
			return false;
		}
	
		function attrIsStatic(name, value) {
			if (!name || !value)
				return false;
			name = name.toLowerCase();
			if (name == "href" || name == "src") {
				return hrefIsStatic(value);
			}
			return (value.length <= 32) && idIsStatic(value);
		}
	
		function applyDynamicIds(dynamicIds) {
			g_idIsStatic_Expr = [];
			var arr = dynamicIds.split('\n');
			for (var i = 0; i < arr.length; i++) {
				try {
					if (arr[i] == "") continue;
					ArrayPush(g_idIsStatic_Expr, new RegExp(arr[i]));
				} catch (e) {
	
				}
			}
			ArrayPush(g_idIsStatic_Expr, /^([A-Za-z-]+)([_0-9a-f]{15,})$/i); // Lithium
		}
	
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
	
		Element.prototype.testComplete15_GetElementSelectorsJson = safeCall(function (dynamicIds, selectorsLimit) {
			if (this === null || this === undefined)
				return '';
	
			if (typeof dynamicIds === "string") {
				applyDynamicIds(dynamicIds);
			}
	
			var builder = new LocatorBuilder(this);
			var retVal = builder.build((typeof selectorsLimit == "number") ? selectorsLimit: 0);
			return stringifyObjectFull(retVal);
		});
	
		function element_FindElement(root, frameDocument, selectors) {
			var builder = new LocatorBuilder(root, frameDocument);
			var selectorList = (selectors || "").split("\n");
			for (var i = 0; i < selectorList.length; i++) {
				var selector = selectorList[i];
				var el = builder.findElement(selector);
				if (typeof el === "object" && el != null) {
					el.testComplete15_effectiveSelector = selector;
					return el;
				}
			}
			return null;
		}
	
		function element_getVisible(el, rootDocument) {
			if (!rootDocument) {
				rootDocument = findRootDocument(el);
				if (!rootDocument) {
					return false;
				}
			}
			var view = rootDocument.defaultView || window;
			var style = {};
			try {
				style = window.getComputedStyle(el) || {};
			} catch(e) {
			}
			return ((style.display || "").toLowerCase() != "none") && 
				((style.visibility || "").toLowerCase() != "hidden");
		}
	
		function element_getClientRect(el, rootDocument) {
			if (!el) return;
			if (!element_getVisible(el, rootDocument)) return;
			if (typeof el.getClientRects == "function") {
				var rects = el.getClientRects();
				if (!rects) return;
				var rect = { "left": [], "top": [], "right": [], "bottom": [] };
				for (var i = 0; i < rects.length; i++) {
					var r = rects[i];
					ArrayPush(rect.left, r.left);
					ArrayPush(rect.top, r.top);
					ArrayPush(rect.right, r.right);
					ArrayPush(rect.bottom, r.bottom);
				}
				rect.left = Math.min.apply(null, rect.left);
				rect.top = Math.min.apply(null, rect.top);
				rect.right = Math.max.apply(null, rect.right);
				rect.bottom = Math.max.apply(null, rect.bottom);
				return rect;
			}
			
			var rect = { "left": 0, "top": 0, "right": 0, "bottom": 0 };
			rect.left = el.offsetLeft || 0;
			rect.top = el.offsetTop || 0;
			rect.right = rect.left + (el.offsetWidth || 0);
			rect.bottom = rect.top + (el.offsetHeight || 0);
			return rect;
		}
	
		function element_FindElementsVisibleWithSimilarRect(root, frameDocument, selectors, width, height) {
			var result = [];
			var p1 = "testComplete15_effectiveSelector";
			var p2 = "testComplete15_sortIndex";
			var compareSizes = function (size) {
				if (!width || !height || !size || !size.width || !size.height)
					return false;
				var sf1 = width / height;
				var sf2 = size.width / size.height;
				if (Math.abs(sf1 - sf2) > 0.8) 
					return false;
				var sf = (width > size.width) ? (width / size.width): (size.width / width);
				if ((sf < 0.5) || (sf > 7.5)) 
					return false;
				return true;
			};
			var builder = new LocatorBuilder(root, frameDocument);
			ArrayForEach((selectors || "").split("\n"), function(selector) {
				ArrayForEach(builder.findElements(selector) || [], function(el) {
					var rect = element_getClientRect(el, frameDocument);
					if (!rect) return;
					if (!compareSizes({
							 "width": (rect.right - rect.left), 
							"height": (rect.bottom - rect.top)
						})) return;
					el[p1] = selector;
					el[p2] = rect.top;
					ArrayPush(result, el);
				});
			});
			return ArraySort(result, function(a, b) {
				return a[p2] - b[p2];
			});
		}
	
		Element.prototype.testComplete15_FindElement = safeCall(function (selectors) {
			if (this === null || this === undefined)
				return null;
	
			return element_FindElement(this, null, selectors);
		});
	
		Element.prototype.testComplete15_FindElementsVisibleWithSimilarRect = safeCall(function (selectors, width, height) {
			if (this === null || this === undefined)
				return null;
	
			return element_FindElementsVisibleWithSimilarRect(this, null, selectors, width, height);
		});
	
		window.testComplete15_FindElement = function (selectors) {
			return element_FindElement(null, window.document, selectors);
		}
	
		window.testComplete15_FindElementsVisibleWithSimilarRect = function (selectors, width, height) {
			return element_FindElementsVisibleWithSimilarRect(null, window.document, selectors, width, height);
		}
	
		var g_StaticContainers = [
			"A", "INPUT", "BUTTON", "IMG", "OBJECT", "APPLET", "EMBED", "SELECT", "TEXTAREA",
			"LABEL", "FRAME", "IFRAME", "LEGEND", "FORM", "FIELDSET",
			"ARTICLE", "ASIDE", "DETAILS", "FIGURE", "FOOTER", "HEADER", "NAV", "OUTPUT", "SECTION",
			"SUMMARY", "TIME", "AUDIO", "CANVAS", "METER", "PROGRESS", "VIDEO", "SVG", "MATH", 
			"H1", "H2", "H3", "H4", "H5", "UL", "OL", "LI",
		];
	
		function simple_getInnerText(node, nodeToOmit, delimeter) {
			var innerTextRes = '';
			if (node.nodeType == 3) {
				innerTextRes += node.nodeValue + delimeter;
			} else {
				var children = node.childNodes;
				for(var i = 0; i < children.length; i++ ) {
					var child = children[i];
					if (child === nodeToOmit)
						continue;
					innerTextRes += simple_getInnerText(child, nodeToOmit, delimeter);
				}
			}
			return innerTextRes;
		}
	
		function visibleOnly_getInnerText_getFirstLine(node, rootDocument, ignoreNodeVisibility) {
			if (!node) return "";
			if (node.nodeType == 3) {
				return (node.nodeValue || "").trim();
			} else if (node.nodeType == 1) {
				if (!rootDocument) {
					rootDocument = findRootDocument(node);
					if (!rootDocument) {
						return "";
					}
				}
				var hidden = false;
				if (!ignoreNodeVisibility) {
					var view = rootDocument.defaultView || window;
					var style = {};
					try {
						style = window.getComputedStyle(node) || {};
					} catch(e) {
					}
					hidden = ((style.display || "").toLowerCase() == "none") || 
						((style.visibility || "").toLowerCase() == "hidden");
				}
				if (!hidden) {
					var children = node.childNodes;
					for(var i = 0; i < children.length; i++ ) {
						var child = children[i];
						if (child === node)
							continue;
						var line = visibleOnly_getInnerText_getFirstLine(child, rootDocument);
						if (line) return line;
					}
				}
			}
			return "";
		}
	
		function visibleOnly_getInnerText(node, nodeToOmit, delimeter, rootDocument) {
			var innerTextRes = '';
			if (node.nodeType == 3) {
				innerTextRes += node.nodeValue + delimeter;
			} else if (node.nodeType == 1) {
				if (!rootDocument) {
					rootDocument = findRootDocument(node);
					if (!rootDocument) {
						return innerTextRes;
					}
				}
				var view = rootDocument.defaultView || window;
				var style = {};
				try {
					style = window.getComputedStyle(node) || {};
				} catch(e) {
				}
				var hidden = ((style.display || "").toLowerCase() == "none") || 
					((style.visibility || "").toLowerCase() == "hidden");
				if (!hidden) {
					var children = node.childNodes;
					for(var i = 0; i < children.length; i++ ) {
						var child = children[i];
						if (child === nodeToOmit)
							continue;
						innerTextRes += visibleOnly_getInnerText(child, nodeToOmit, delimeter, rootDocument);
					}
				}
			}
			return innerTextRes;
		}
	
		function getParentLabelObject(el) {
			var labelObject;
			var parentElement = el.parentElement;
			for (var i = 0; i < 4; i++) {
				if (!parentElement)
					break;
				if ((parentElement.nodeName || "").toLowerCase() == "label") {
					labelObject = parentElement;
					break;
				}
				parentElement = parentElement.parentElement;
			}
			return labelObject;
		}
	
		function getParentLabelText(el)	{
			var labelObject = getParentLabelObject(el);
			if (!labelObject)
				return [];
			return prepareForSearchLines(labelObject.textContent || labelObject.innerText);
		}
	
		function getFieldsetLegend(el) {
			var rootDocument = findRootDocument(el);
			if (rootDocument.evaluate) {
				var legendObject = rootDocument.evaluate("legend", el, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
				if (!legendObject)
					return null;
				if (!legendObject.textContent && !legendObject.innerText)
					return null;
				return legendObject;
			}
			return null;
		}
	
		function getFieldSetLabel(el) {
			var legendObject = getFieldsetLegend(el);
			if (legendObject) {
				var text = simple_getInnerText(legendObject);
				if (text) {
					return text;
				}
			}
			return "";
		}
	
		function getCustomControlLabel(el) {
			var tagName = (el.tagName || "").toLowerCase();
			if (tagName == "fieldset") {
				var text = getFieldSetLabel(el);
				if (text) {
					return text;
				}
			}
	
			var auraClass = el["data-aura-class"] || (el.getAttribute && el.getAttribute("data-aura-class"));
			if (["uiMenu"].indexOf(auraClass) != -1) {
				var ariaLinks = [
					//'aria-labelledby',
					'aria-describedby',
				];
	
				for (var i = 0; i < ariaLinks.length; i++) {
					var links = el.querySelectorAll("[" + ariaLinks[i] + "]");
					if (!links)
						continue;
					for (var j = 0; j < links.length; j++) {
						var link = links[j];
						if (!link)
							continue;
						var labelId = link.getAttribute(ariaLinks[i]);
						if (!labelId) 
							continue;
						var label = document.getElementById(labelId);
						if (!label) 
							continue;
						var text = simple_getInnerText(label, el, '');
						if (text != "")
							return text;
					}
				}
			} 
	
			var auraClasses = auraClass ? auraClass.split(" ") : [];
			if (auraClasses.indexOf("uiInputDate") != -1) {
				var labelObject = el.querySelector ? el.querySelector("label") : null;
				if (labelObject) {
					var text = simple_getInnerText(labelObject, el, '');
					if (text != "")
						return text;
				}
			}
	
			var className = el.className || "";
			if (typeof className != "string")
				className = "";
	
			if (className.indexOf("radio") != -1) {
				var tagName = (el.nodeName || "").toLowerCase();
				if (tagName == "span") {
					var labelValue = getParentLabelText(el);
					for (var i = 0; i < labelValue.length; i++) {
						var labelText = labelValue[i] || "";
						if (labelText.length > 0)
							return labelText;
					}
				}
			} 
			else if (className.indexOf("option") != -1) {
				var dataValue = (el.getAttribute ? el.getAttribute("data-value"): null) || "";
				if (typeof dataValue == "string")
					return dataValue;
			}
	
			return "";
		}
	
		function getIsCustomControlContainer(el) {
			var auraClass = el["data-aura-class"] || (el.getAttribute && el.getAttribute("data-aura-class"));
			if (["uiMenu"].indexOf(auraClass) != -1) {
				return true;
			}
	
			var auraClasses = auraClass ? auraClass.split(" ") : [];
			var auraContainers = ["uiInputDate", "uiDatePicker"];
			for (var i = 0; i < auraContainers.length; i++) {
				if (auraClasses.indexOf(auraContainers[i]) != -1) {
					return true;
				}
			}
	
			var tagName = (el.tagName || "").toLowerCase();
			if (tagName == "fieldset") {
				if (getFieldSetLabel(el)) {
					return true;
				}
			}
			else if (tagName == "lightning-combobox") {
				return true;
			}
			return false;
		}
	
		function getIsUnifiedControl(el) {
			var auraClass = el["data-aura-class"] || (el.getAttribute && el.getAttribute("data-aura-class"));
			if (["uiMenu", "uiTooltip", "forceActionLink"].indexOf(auraClass) != -1) {
				return true;
			}
	
			var auraClasses = auraClass ? auraClass.split(" ") : [];
			var auraControls = ["uiAutocompleteOption", "uiMenuItem"];
			for (var i = 0; i < auraControls.length; i++) {
				if (auraClasses.indexOf(auraControls[i]) != -1) {
					return true;
				}
			}
	
			var tagName = (el.nodeName || "").toLowerCase();
			if (["button"].indexOf(tagName) != -1) {
				return true;
			}
	
			return false;
		}
	
		function getUnifiedControlParent(el) {
			if (!el)
				return null;
			var parentElement = el.parentElement;
			for (var i = 0; i < 5; i++) {
				if (!parentElement)
					break;
				if (getIsUnifiedControl(parentElement))
					return parentElement;
				parentElement = parentElement.parentElement;
			}
			return null;
		}
	
		function getIsContainer(el) {
			if (!el || !el.getAttribute) {
				return false;
			}
	
			var className = el.className || "";
			if (className && !classNameIsStatic(className)) {
				return false;
			}
	
			var role = el.role || el.getAttribute("role") || "";
			if (role && !roleIsStatic(role)) {
				return false;
			}
	
			if (getIsCustomControlContainer(el)) {
				return true;
			}
	
			var nodeType = (el.nodeName || "").toUpperCase();
			if (g_StaticContainers.indexOf(nodeType) == -1)  {
				return false;
			}
	
			return idIsStatic(el.id) || className || role;
		}
	
		function getMappingContainers(el) {
			if (el === null || el === undefined)
				return null;
	
			var getParent = function(e) {
				var attrs = [
					'aria-labelledby',
				//	'aria-describedby',
				];
				for (var i = 0; i < attrs.length; i++) {
					var id = e[attrs[i]] || (e.getAttribute && e.getAttribute(attrs[i]));
					if (!id) continue;
					var p = document.getElementById(id);
					if (!!p && (p != e) && !e.contains(p)) {
						return p;
					}
				}
				return e.parentElement;
			}
	
			var containers = [];
			var container = getParent(el);
	
			while (container) {
				if (getIsContainer(container)) {
					ArrayUnshift(containers, container);
				}
				container = getParent(container);
			}
	
			if (containers.length > 3) {
				containers.splice(2, containers.length - 3);
			}
	
			return NodeListFromArray(containers);
		}
	
		window.testComplete15_getMappingContainers = function (el) {
			return getMappingContainers(el);
		}
	
		Element.prototype.testComplete15_getMappingContainers = safeCall(function () {
			return getMappingContainers(this);
		});
	
		Element.prototype.testComplete15_evaluateInnerText = safeCall(function () {
			return simple_getInnerText(this, this, '');
		});
	
		function evaluateLabelText(el) {
			if (el === null || el === undefined)
				return "";
	
			var ariaLinks = [
				'aria-labelledby',
				'aria-describedby',
			];
	
			for (var i = 0; i < ariaLinks.length; i++) {
				var ariaAttrName = ariaLinks[i];
				var idValue = el[ariaAttrName] || el.getAttribute(ariaAttrName);
				if (!idValue)
					continue;
				var labelObject = document.getElementById(idValue);
				if (!labelObject)
					continue;
	
				var labelValue = simple_getInnerText(labelObject, labelObject, '');
				if (labelValue.length > 0)
					return labelValue;
			}
	
			var elementId = el.getAttribute && el.getAttribute("id");
			if (elementId && document.querySelectorAll) {
				var labels = document.querySelectorAll("label[for=\'" + 
					cssesc(elementId, { isIdentifier: true }) + "\']");
				if (labels && labels.length) {
					for (var i = 0; i < labels.length; i++) {
						var label = labels[i];
						if (!label) continue;
						var labelValue = visibleOnly_getInnerText_getFirstLine(label);
						if (labelValue) return labelValue;
					}
				}
			}
	
			var tagName = el.nodeName.toLowerCase();
			if (tagName == "input") {
				var typeName = el.getAttribute && el.getAttribute("type");
				if (typeName == "button" || typeName == "submit" || typeName == "reset") {
					var value = el.value;
					if ((typeof value === "string") && value) {
						return value;
					}
				}
			}
	
			return getCustomControlLabel(el);
		}
	
		Element.prototype.testComplete15_evaluateLabelText = safeCall(function () {
			return evaluateLabelText(this);
		});
	
		function evaluateDefaultNameSuffix(el) {
			if (!el || el.nodeType != 1) return;
			var tagName = el.nodeName.toLowerCase();
	
			var labels = [function() {
				return evaluateLabelText(el);
			}, function() {
				var label = el.getAttribute && el.getAttribute('aria-label');
				if (!label) return;
				if (!!document.getElementById(label)) return;
				return label;
			}, function() {
				var clearWS = function(s) {
					return (s || "").replace(/\s/g, '');
				}
				var id = el.getAttribute && el.getAttribute('id');
				if (id && idIsStatic(clearWS(id))) return id;
				var name = el.getAttribute && el.getAttribute('name');
				if (name && idIsStatic(clearWS(name))) return name;
			}, function() {
				if (tagName == "select") return;
				return visibleOnly_getInnerText_getFirstLine(el, null, tagName == "label");
			}, function() {
				return el.title;
			}, function() {
				return el.alt;
			}, function() {
				return lastHrefPart(el.getAttribute && el.getAttribute('href'));
			}, function() {
				return lastHrefPart(el.getAttribute && el.getAttribute('src'));
			}, function() {
				return lastHrefPart(el.getAttribute && el.getAttribute('action'));
			}, function() {
				var role = el.getAttribute && el.getAttribute('role');
				if (!role) return;
				if (!roleIsStatic(role)) return;
				if (role.toLowerCase() == tagName) return;
				return role;
			}];
	
			function cleanStr(str) {
				if (typeof str !== "string" || !str) return "";
	
				var retVal = "";
				var delimiter = false;
				for (var i = 0; i < str.length; i++) {
					if (!((str[i] >= 'a' && str[i] <= 'z')
						|| (str[i] >= 'A' && str[i] <= 'Z')
						|| (str[i] >= '0' && str[i] <= '9')
						|| (str[i] == '_') || (str[i] == ' ')))
					{
						if (!delimiter && (retVal != "")) {
							retVal += ".";
							delimiter = true;
						}
						continue;
					}
					retVal += str[i];
					delimiter = false;
				}
				return retVal.trim();
			}
	
			function convertToName(innerText)	{
				if (!innerText)
					return;
	
				if (highEntropy(innerText))
					return;
	
				var lines = innerText.split('\n');
				if (!lines || !lines.length)
					return;
	
				var i = 0;
				var firstLine = "";
				while ((i < lines.length) && !(firstLine = cleanStr(lines[i]))) i++;
				if (firstLine.length > 32) {
					var words = firstLine.split(" ");
					if (words.length > 1) {
						firstLine = "";
						for (var i = 0; i < words.length; i++) {
							if (!words[i]) continue;
							if (firstLine) firstLine += " ";
							if (firstLine.length + words[i].length > 32) break;
							firstLine += words[i];
						}
					} else {
						firstLine = firstLine.slice(0, 31);
					}
				}
				var appendDot = function(acc, s) {
					return !!acc && !!s ? acc + "." + s: acc + s;
				};
				return ArrayReduce(firstLine.split(" "), function (acc, s) {
					s = s.trim();
					if (!s) return acc;
					if (s.toUpperCase() == s) return appendDot(acc, s);
					var s2 = s.substring(1);
					if (s2.toLowerCase() == s2) {
						s = s[0].toUpperCase() + s2.toLowerCase();
					}
					return appendDot(acc, s);
				}, "");
			}
			
			for (var i = 0; i < labels.length; i++) {
				var name = convertToName(labels[i]());
				if (!!name) return name;
			}
	
			return "";
		}
	
		Element.prototype.testComplete15_evaluateDefaultName = safeCall(function () {
			var defaultName = evaluateDefaultNameSuffix(this);
			logMessage('evaluateDefaultName', this, defaultName);
			return defaultName;
		});
	
		var TestCompleteWebTestingHelpers = {
	
			getContentText: function(node)
			{
				if (node === null || node === undefined)
					return '';
			
				var nodeValueList = this.getNodeValueList(node);
				return this.stringListToStringWithoutSpaces(nodeValueList, '\n');
			},
	
			getNodeValue: function (node) {
				if (node && node.nodeType == 3 /*TEXT_NODE*/)
					return node.nodeValue;
				else
					return '';
			},
	
			getFirstChild: function (node) {
				var nodeName = node.nodeName;
				if (typeof nodeName === "string") {
					nodeName = nodeName.toUpperCase();
					if (nodeName === "FRAME" || nodeName === "IFRAME") {
						var firstChild;
						try {
							firstChild = node.contentDocument.body.firstChild;
						} catch (e) {
	
						}
						if (typeof firstChild === "object")
							return firstChild;
					}
				}
				return node.firstChild;
			},
	
			getNodeValueList: function (node, nodeToOmit) {
				var valueList = [];
				var child = null;
				var curNode = this.getFirstChild(node);
				var parents = [];
	
				if (!curNode) {
					ArrayPush(valueList, this.getNodeValue(curNode));
					return valueList;
				}
	
				while (true) {
					if (!curNode) {
						while (parents.length > 0) {
							curNode = parents.pop();
							child = curNode.nextSibling;
							if (child)
								break;
						}
	
						if (!child)
							break;
	
						curNode = child;
					}
	
					if (curNode && curNode == nodeToOmit)
						curNode = curNode.nextSibling;
	
					child = this.getFirstChild(curNode);
					if (child) {
						ArrayPush(parents, curNode);
						curNode = child;
						continue;
					}
	
					ArrayPush(valueList, this.getNodeValue(curNode));
	
					curNode = curNode.nextSibling;
				}
	
				return valueList;
			},
	
			stringListToStringWithoutSpaces: function (list, separator) {
				var whiteSpaceChars = '\u0009\u000a\u000b\u000c\u000d\u0020\u0085\u00a0\u1680\u2000\u2001' +
					'\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000';
				var result = '';
	
				for (var i = 0; i < list.length; i++) {
					var nonSpaceSymbolsWereAdded = false;
					var prevWasSpace = false;
	
					for (var c = 0; c < list[i].length; c++) {
						var cCurr = list[i].charAt(c);
						if (whiteSpaceChars.indexOf(cCurr) > -1) {
							prevWasSpace = true;
						}
						else {
							if (nonSpaceSymbolsWereAdded && prevWasSpace)
								result += ' ';
							result += cCurr;
	
							nonSpaceSymbolsWereAdded = true;
							prevWasSpace = false;
						}
					}
	
					if (nonSpaceSymbolsWereAdded)
						result += separator;
				}
	
				if (result.charAt(result.length - 1) == separator)
					result = result.substring(0, result.length - 1);
	
				return result;
			},
	
			addGetContextTextMethodToDocFrames: function(doc)
			{
				if (doc == null)
					return;
				
				var iframes = doc.getElementsByTagName("iframe");
				for (var i = 0; i < iframes.length; i++)
					this.addGetContextTextMethodToFrameScope(iframes[i]);
					
				var frames = doc.getElementsByTagName("frame");
				for (var i = 0; i < frames.length; i++)
					this.addGetContextTextMethodToFrameScope(frames[i]);
			},
	
			addGetContextTextMethodToFrameScope: function(frame)
			{	
				if (typeof frame.contentWindow === 'undefined')
					return;
					
				var contentWindow = frame.contentWindow;
				if (contentWindow == null)
					return;
					
				try {			
					contentWindow.Element.prototype.testComplete15_GetContentText = safeCall(function () {
						return TestCompleteWebTestingHelpers.getContentText(this);
					});
				} catch(e) {
	
				}
				
				var frameDocument;
				try
				{
					frameDocument = frame.contentDocument || frame.contentWindow.document;
				}
				catch (e)
				{
					return;
				}
				
				this.addGetContextTextMethodToDocFrames(frameDocument);
			},
	
		};
	
		function prepareForSearchLines(s) {
			if (!s) return [];
			return ArrayFilter(ArrayMap(s.trim().replace(/[\t\f\r\xA0]/g, '\n').split('\n'), function(line) {
				return line.trim();
			}), function(line) {
				return line.length > 1;
			});
		}
		
		function suitableForTextSearch(e) {
			return ['input', 'textarea', 'select'].indexOf((e.nodeName || "").toLowerCase()) == -1;
		}
	
		LocatorBuilder.generators = [];
		LocatorBuilder.generationGroups = [];
	
		LocatorBuilder.AcceptLastChance = {"acceptLastChance": true};
		LocatorBuilder.SelfVerified = {"selfVerified": true};
		LocatorBuilder.SelfVerifiedLastChance = {"selfVerified": true, "acceptLastChance": true};
	
		LocatorBuilder.add = function (fullName, finder, options) {
			// options = {"acceptLastChance": true|false, "selfVerified": true|false}
			var names = fullName.split(':');
			while (names.length < 3) {
				ArrayPush(names, '');
			}
			if ((names[0] != 'css') && (names[0] != 'xpath')) {
				names[0] = '*';
			}
			var name = names[0] + ':' + names[1];
			var instanceName = name;
			if (names[2] != '') {
				instanceName += ':' + names[2];
			}
			var prev = ArrayFind(LocatorBuilder.generators, function(e) {
				return e.instanceName == instanceName;
			});
			if (!!prev) {
				this.log('LocatorBuilder.add invalid parameter ' + instanceName);
				return;
			}
			var mergedOptions = ObjectAssign({"name": name, "instanceName": instanceName, "proc": finder}, options);
			ArrayPush(LocatorBuilder.generators, mergedOptions);
		}
	
		function GeneratorsGroup() {
			this.list = [];
			this.finishers = [];
		}
	
		GeneratorsGroup.prototype.addGenerators = function(generators) {
			var group = this;
			ArrayForEach(generators, function (name) {
				var generator = ArrayFind(LocatorBuilder.generators, function(item) {
					return item.instanceName == name;
				});
				if (!generator) {
					return;
				}
				ArrayPush(group.list, generator);
			});
		};
	
		GeneratorsGroup.prototype.addFinishers = function(finishers) {
			var group = this;
			ArrayForEach(finishers, function (name) {
				var generator = ArrayFind(LocatorBuilder.generators, function(item) {
					return item.instanceName == name;
				});
				if (!generator) {
					return;
				}
				ArrayPush(group.finishers, generator);
			});
		};
	
		LocatorBuilder.createGroup = function (grouplist) {
			var newGroup = new GeneratorsGroup();
			ArrayPush(this.generationGroups, newGroup);
			newGroup.addGenerators(grouplist);
			return newGroup;
		}
	
		LocatorBuilder.prototype.log = function() {
			logMessage.apply(null, arguments);
		}
	
		LocatorBuilder.prototype.build = function (limit) {
	
			function buildImpl(generators, groupIndex, lastChance) {
				var locator
				var candidates
				var locators = []
				var passedTypes = {}
				var existingLocators = {};
				for (var i = 0; i < generators.length; i++) {
					var finder = generators[i]
					if (typeof finder !== "object")
						continue;
					if (passedTypes[finder.name] !== undefined)
						continue;
					if ((finder.name.indexOf('css:') == 0) && !this.rootDocument.querySelector)
						continue;
					if ((finder.name.indexOf('xpath:') == 0) && !this.rootDocument.evaluate)
						continue;
					if (!lastChance && !finder.acceptLastChance && !!(this.element._tc15_SelectorsBanList || {})[finder.name])
					{
						var failData = (this.element._tc15_SelectorsBanList || {})[finder.name];
						if (!!failData && failData.succeeded) {
							failData.succeeded = false;
							if (failData.candidates && (failData.candidates.length > 0)) {
								var locator = failData.candidates[0];
								var startedAt = new Date();
								var fe = this.findElement(locator)
								if (getTimeoutExpired(startedAt, LocatorBuilder.selectorGenerationTimeout)) {
									this.log('Cached selector for ' + finder.name + ' was dropped due to ' + (new Date() - startedAt) + ' ms timeout.');
								}
								if (this.element == fe) {
									ArrayPush(locators, [locator])
									passedTypes[finder.name] = true;
									failData.succeeded = true;
								}
							}
						}
					} else {
						try {
							var startedAt = new Date();
							var succeeded = false;
							try {
								candidates = finder.proc.call(this, this.element, lastChance, groupIndex)
								succeeded = true;
							} catch(e) {
								this.log(finder.name + ' throws ' + e.message);
							}
							if (candidates && (typeof candidates == "string")) {
								candidates = [candidates];
							}
							if (!succeeded || (!lastChance && getTimeoutExpired(startedAt, LocatorBuilder.selectorGenerationTimeout))) {
								this.log(finder.name + ' was banned after ' + LocatorBuilder.selectorGenerationTimeout + ' ms timeout');
								var banList = this.element._tc15_SelectorsBanList || {};
								banList[finder.name] = {"succeeded": succeeded, "candidates": candidates};
								this.element._tc15_SelectorsBanList = banList;
								if (!succeeded) {
									continue;
								}
							}
							if (!candidates || !candidates.length) {
								this.log(finder.name + ' did not provide any selector');
								continue;
							}
							startedAt = new Date();
							for (var j = 0; j < candidates.length; j++) {
								locator = candidates[j];
								if (!locator) continue;
								locator = String(locator);
								if (existingLocators[locator] === undefined) {
									existingLocators[locator] = true;
									var validSelector = false;
									if (!!finder.selfVerified) {
										validSelector = true;
										this.log(finder.name + ': self verified selector = ' + locator);
									} else {
										var fe = this.findElement(locator)
										validSelector = this.element == fe;
										this.log(finder.name + ': ' + (validSelector ? 'valid': 'invalid') + ' selector = ' + locator);
									}
									if (validSelector) {
										ArrayPush(locators, [locator])
										passedTypes[finder.name] = true;
										break;
									}
								}
								if (new Date - startedAt > 50) {
									this.log('Break selector check for ' + finder.name);
									break;
								}
							}
						} catch (e) {
							this.log(finder.name + '.findElement() throws ' + e.message);
						}
					}
					if ((limit > 0) && (locators.length == limit)) {
						break;
					}
					if (lastChance && (locators.length > 0)) {
						break;
					}
				}
				return locators
			}
			var startedAt = new Date();
			for (var level = 0; level < LocatorBuilder.generationGroups.length; level++) {
				var group = LocatorBuilder.generationGroups[level];
				if (!group) {
					break;
				}
				this.lastChance = level == LocatorBuilder.generationGroups.length - 1;
				var locators = buildImpl.call(this, 
					group.list, level, this.lastChance);
				if (locators && locators.length) {
					this.log('Found ' + locators.length + ' selectors for ' + ((new Date()) - startedAt) + ' ms');
					if (!limit || (locators.length < limit)) {
						if (limit) limit -= locators.length;
						var finishingStartedAt = new Date();
						var finishers = (!this.lastChance && group.finishers.length) ? 
							buildImpl.call(this, group.finishers, level, this.lastChance): null;
						if (finishers && finishers.length) {
							this.log('Found ' + finishers.length + ' finishing selectors for ' + ((new Date()) - finishingStartedAt) + ' ms');
							ArrayForEach(finishers, function(locator) {
								if (!locator || !locator.length || !locator[0]) return;
								if (!ArrayFind(locators, function(item) {
										if (!item || !item.length || !item[0]) return false;
										return item[0] == locator[0];
									})) ArrayPush(locators, locator);
							});
						}
					}
					return locators;
				}
			}
			return [];
		}
	
		LocatorBuilder.prototype.parseLocator = function (locator) {
			if (!locator)
				return null;
			var result = locator.match(/^([A-Za-z]+)=.+/)
			if (result) {
				var type = result[1]
				var length = type.length
				if (type === 'link') {
					type = 'linkText'
				}
				var actualLocator = locator.substring(length + 1)
				return { type: type, string: actualLocator }
			}
	
			function isOnlyXPathExpression(locator) {
				if (locator == '..' || locator == '.')
					return true;
	
				var xpathSelectorsStart = ['/', '(', '../', './', '*'];
				for (var i = 0; i < xpathSelectorsStart.length; i++) {
					if (locator.indexOf(xpathSelectorsStart[i]) == 0) {
						return true;
					}
				}
	
				var xpathSelectorsContains = ['[@', '.=', 'contains(', '@for', /\[\d+\]/];
				for (var i = 0; i < xpathSelectorsContains.length; i++) {
					var cond = xpathSelectorsContains[i];
					if (typeof cond === "string") {
						if (locator.indexOf(cond) >= 0) {
							return true;
						}
					} else if (typeof cond === "object") {
						if (cond.test(locator)) {
							return true;
						}
					}
				}
	
				return false;
			}
	
			var implicitType = isOnlyXPathExpression(locator) ? 'xpath': 'css';
			return { type: implicitType, string: locator }
		}
	
		LocatorBuilder.prototype.findElement = function (loc) {
			try {
				var locator = this.parseLocator(loc)
				if (locator == null)
					return null;
				switch (locator.type) {
					case "id":
						return this.rootDocument.getElementById(locator.string);
					case "name":
						return this.rootDocument.querySelector ? this.rootDocument.querySelector('[name="' + locator.string + '"]'): null;
					case "linkText":
						{
							var links = this.rootDocument.getElementsByTagName('a')
							for (var i = 0; i < links.length; i++) {
								var link = links[i]
								var linkText = (link.textContent || link.innerText).replace(/\xA0/g, ' ').replace(/^\s*(.*?)\s*$/, '$1')
								if (linkText == locator.string) {
									return link
								}
							}
							return null
						}
					case "css":
						return this.rootDocument.querySelector ? this.rootDocument.querySelector(locator.string): null;
					case "xpath":
						{
							if (!this.rootDocument.evaluate) return;
							var firstChar = locator.string.charAt(0);
							var validFirstChars = ['/', '(', '.'];
							var rootObject = (validFirstChars.indexOf(firstChar) != -1) ? 
								this.rootDocument: (this.rootDocument.body || this.rootDocument);
							var retVal;
							try {
								retVal = this.rootDocument.evaluate(
									locator.string, rootObject, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
								if (retVal) return retVal;
								if (rootObject !== this.rootDocument) {
									retVal = this.rootDocument.evaluate(
										locator.string, this.rootDocument, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
									if (retVal) return retVal;
								}
							} catch(e) {
								logMessage("Exception: findElement xpath", e.message);
							}
							if (!this.rootDocument.querySelector) return;
							try {
								retVal = this.rootDocument.querySelector(locator.string);
							} catch(e) {
							}
							return retVal;
						}
				}
			} catch (error) {
				return null
			}
		}
	
		LocatorBuilder.prototype.findElements = function (loc) {
			try {
				var locator = this.parseLocator(loc);
				if (locator == null)
					return;
				switch (locator.type) {
					case "css":
						return ArrayFrom(this.rootDocument.querySelectorAll ? this.rootDocument.querySelectorAll(locator.string): []);
					case "xpath":
						{
							var arrayFromSnapshot = function(s) {
								var result = [];
								for (var i = 0; i < s.snapshotLength; i++) {
									ArrayPush(result, s.snapshotItem(i));
								}
								return result;
							};
							if (!this.rootDocument.evaluate) return;
							var firstChar = locator.string.charAt(0);
							var validFirstChars = ['/', '(', '.'];
							var rootObject = (validFirstChars.indexOf(firstChar) != -1) ? 
								this.rootDocument: (this.rootDocument.body || this.rootDocument);
							var retVal;
							try {
								retVal = this.rootDocument.evaluate(
									locator.string, rootObject, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
								if (retVal.snapshotLength) return arrayFromSnapshot(retVal);
								if (rootObject !== this.rootDocument) {
									retVal = this.rootDocument.evaluate(
										locator.string, this.rootDocument, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
									if (retVal.snapshotLength) return arrayFromSnapshot(retVal);
								}
							} catch(e) {
							}
							return ArrayFrom(this.rootDocument.querySelectorAll ? 
								this.rootDocument.querySelectorAll(locator.string): []);
						}
				}
			} catch (error) {
			}
		}
	
		LocatorBuilder.prototype.attributeValue = function (value) {
			try {
				if (value.indexOf("'") < 0) {
					return "'" + value + "'"
				} else if (value.indexOf('"') < 0) {
					return '"' + value + '"'
				} else {
					var result = 'concat('
					var part = ''
					var didReachEndOfValue = false
					while (!didReachEndOfValue) {
						var apos = value.indexOf("'")
						var quot = value.indexOf('"')
						if (apos < 0) {
							result += "'" + value + "'"
							didReachEndOfValue = true
							break
						} else if (quot < 0) {
							result += '"' + value + '"'
							didReachEndOfValue = true
							break
						} else if (quot < apos) {
							part = value.substring(0, apos)
							result += "'" + part + "'"
							value = value.substring(part.length)
						} else {
							part = value.substring(0, quot)
							result += '"' + part + '"'
							value = value.substring(part.length)
						}
						result += ','
					}
					result += ')'
					return result
				}
			} catch (e) {
				return '';
			}
		}
	
		function nodeNameToXPathName(name, rootDocument) {
			var node;
			if (typeof name === "object") {
				node = name;
				name = node ? node.nodeName.toLowerCase(): "";
			}
			if (!name) return;
	
			if (node) {
				var ctorName = node.constructor.name.toLowerCase();
				if (ctorName.indexOf('svg') == 0) {
					return "*[name()='" + name + "']";
				}
			}
			var nodeDocument = rootDocument || (node ? node.ownerDocument: null) || document;
			if (nodeDocument) {
				if (nodeDocument.contentType == 'application/xhtml+xml') {
					return 'x:' + name;
				}
			}
			return name;
		}
	
		LocatorBuilder.prototype.xpathHtmlElement = function (name) {
			return nodeNameToXPathName(name, this.rootDocument);
		}
	
		LocatorBuilder.prototype.relativeXPathFromParent = function (current) {
			var index = this.getNodeNbr(current)
			var currentPath = '/' + this.xpathHtmlElement(current)
			if (index > 0) {
				currentPath += '[' + (index + 1) + ']'
			}
			return currentPath
		}
	
		LocatorBuilder.prototype.PushSelectorCancelProcess = function (selectors, value) {
			if (!value) {
				return false;
			}
			ArrayPush(selectors, value);
			if (this.lastChance) {
				return true;
			}
			return false;
		}
	
		LocatorBuilder.prototype.getNodeNbr = function (current) {
			var childNodes = current.parentNode.childNodes
			var total = 0
			var index = -1
			for (var i = 0; i < childNodes.length; i++) {
				var child = childNodes[i]
				if (child.nodeName == current.nodeName) {
					if (child == current) {
						index = total
						break;
					}
					total++
				}
			}
			return index
		}
	
		LocatorBuilder.prototype.calcXPathIndex = function (xpath, e, contextNode, calcIndex) {
			if (!this.rootDocument.evaluate) {
				return -1;
			}
			if (!calcIndex) {
				return 0;
			}
			try {
				if (!contextNode) {
					contextNode = this.rootDocument;
				}
				var result = this.rootDocument.evaluate(
					xpath,
					contextNode,
					null,
					XPathResult.ORDERED_NODE_ITERATOR_TYPE,
					null
				)
				var item = result.iterateNext();
				if (!item) {
					return 0;
				}
				if (item == e) {
					return 1;
				}
				var index = 1;
				while (item = result.iterateNext()) {
					index++;
					if (item == e) { 
						return index;
					}
				}
			}
			catch (e) {
			}
			return 0;
		}
	
		LocatorBuilder.prototype.uniqueXPath = function (xpath, e, internalSyntax, contextNode) {
			if (!this.rootDocument.evaluate || !e || !xpath) {
				return null;
			}
			try {
				if (!contextNode) {
					contextNode = this.rootDocument;
				}
				var result = this.rootDocument.evaluate(
					xpath,
					contextNode,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				).singleNodeValue;
				if (result == e) {
					return xpath;
				}
			} catch(e) {
	
			}
			return null;
		}
	
		LocatorBuilder.prototype.preciseXPath = function (xpath, e, internalSyntax, contextNode) {
			var index = this.calcXPathIndex(xpath, e, contextNode, this.lastChance);
			if (index < 0) {
				return null;
			}
			if (this.lastChance && !index) {
				return null;
			}
	
			var preciseValue;
			if (index > 1) {
				preciseValue = '(' + xpath + ')[' + index + ']';
			} else {
				preciseValue = xpath;
			}
	
			return internalSyntax ? preciseValue: 'xpath=' + preciseValue;
		}
	
		LocatorBuilder.prototype.preciseXPathWithHref = function (e, purify, pathTail) {
			var href = getHrefAttribute(e)
			var puredHref = purify ? purifyHref(href): href;
			if (!puredHref) {
				return null;
			}
			var precisePath;
			if ((puredHref == href) && (href.search(/^http?:\/\//) >= 0)) {
				precisePath = this.preciseXPath(
					this.getXPathRoot(e) +
					this.xpathHtmlElement('a') +
					'[@href=' +
					this.attributeValue(href) +
					']',
					e
				)
			} else {
				precisePath = this.preciseXPath(
					this.getXPathRoot(e) +
					this.xpathHtmlElement('a') +
					'[contains(@href, ' +
					this.attributeValue(puredHref) +
					')]',
					e
				)
			}
			if (!precisePath) {
				return null;
			}
			if ((typeof pathTail === "string") && !!pathTail) {
				precisePath += pathTail;
			}
			return precisePath;
		}
	
		LocatorBuilder.add('css:data-attr', function (e) {
			var selectors = [];
			var dataAttributes = ['data-test', 'data-test-id', 'data-test-selector']
			for (var i = 0; i < dataAttributes.length; i++) {
				var attr = dataAttributes[i]
				var value = e.getAttribute(attr)
				if (value) {
					ArrayPush(selectors, 'css=[' + attr + '=\'' + value + '\']');
				}
			}
			return selectors.length > 0 ? selectors: null;
		})
	
		LocatorBuilder.add('css:data-attr-lowpriority', function (e) {
			var selectors = [];
			var dataAttributes = ['data-lp-id']
			for (var i = 0; i < dataAttributes.length; i++) {
				var attr = dataAttributes[i]
				var value = e.getAttribute(attr)
				if (value) {
					ArrayPush(selectors, 'css=[' + attr + '=\'' + value + '\']');
				}
			}
			return selectors.length > 0 ? selectors: null;
		})
	
		var generateCssIdSelector = function (e, lastChance, idIsStaticProc) {
			var elementId = e.id || e.getAttribute("id")
			if (elementId && (lastChance || (idIsStaticProc || idIsStatic)(elementId))) {
				return 'css=#' + elementId;
			}
			return null
		};
	
		LocatorBuilder.add('css:id', function (e, lastChance) {
			return generateCssIdSelector(e, lastChance, idIsStatic);
		}, LocatorBuilder.AcceptLastChance)
	
		LocatorBuilder.add('css:id:with-digits', function (e, lastChance) {
			return generateCssIdSelector(e, lastChance, idIsStaticGeneral);
		}, LocatorBuilder.AcceptLastChance)
	
		LocatorBuilder.add('*:radio', function (e, lastChance) {
			if (((e.nodeName || "").toLowerCase() != 'input') || 
				((e.type || "").toLowerCase() != 'radio')) {
				return null;
			}
	
			var value = e.value || "";
			return [
				this.addXPathPrefix(this.generateUniqueXPath(e, {
					'minDepth': 1, 'maxDepth': 5,
					'leafName': this.xpathHtmlElement("input") + 
					"[@type='radio'][@value=" + this.attributeValue(value) + "]"
				})),
				"css=input[type='radio'][value='" + value + "']",
			];
		}, LocatorBuilder.AcceptLastChance)
	
		LocatorBuilder.add('*:name', function (e, lastChance) {
			var elementName = e.name || e.getAttribute("name");
			if (elementName && (lastChance || idIsStatic(elementName))) {
				return this.generateLocatorForAttrs(e, ['name']);
			}
		}, LocatorBuilder.AcceptLastChance)
	
		LocatorBuilder.add('*:href', function (e, lastChance) {
			var attrName;
			var nodeName = e.nodeName.toLowerCase();
			if (nodeName == "a") {
				attrName = "href";
			} else if (nodeName == "img") {
				attrName = "src";
			} else {
				return;
			}
	
			var elementHref = getHrefAttribute(e, attrName);
			if (!elementHref) {
				return null;
			}
	
			var rootPrefix = "xpath=" + this.getXPathRoot(e);
			var selectors = [];
			var addOption = function(part, contains) {
				if (!contains) {
					if (this.useCss) {
						ArrayPush(selectors, "css=[" + attrName + "='" + cssesc(part) + "']");
					} else {
						ArrayPush(selectors, rootPrefix + this.xpathHtmlElement(nodeName) + "[@" + attrName + 
							"=" +  this.attributeValue(part) + "]");
					}
				} else {
					if (this.useCss) {
						ArrayPush(selectors, "css=[" + attrName + "*='" + cssesc(part) + "']");
					} else {
						ArrayPush(selectors, rootPrefix + this.xpathHtmlElement(nodeName) + 
							"[contains(@" + attrName + ", " + this.attributeValue(part) + ")]");
					}
				}
			};
	
			var purifiedHref = purifyHref(elementHref);
			ArrayForEach(combineHrefGrowth(elementHref), function (part) {
				if ((part != elementHref) && (part != purifiedHref)) {
					addOption.call(this, part, true);
				}
			}, this);
			if (purifiedHref) {
				addOption.call(this, purifiedHref, purifiedHref != elementHref);
			}
			return selectors;
		}, LocatorBuilder.AcceptLastChance)
	
		LocatorBuilder.add('xpath:fieldset', function (e, lastChance) {
			if (((e.nodeName || "").toLowerCase() != 'fieldset')) {
				return null;
			}
	
			var legendObject = getFieldsetLegend(e);
			if (!legendObject)
				return null;
			var legendFullText = (legendObject.textContent || legendObject.innerText || "").trim();
			var legendValue = prepareForSearchLines(legendFullValue);
			if (legendValue.length == 0) {
				return null;
			}
	
			var legendSelector;
			for (var i = 0; i < legendValue.length; i++) {
				var legendText = legendValue[i] || "";
				if (legendText.length == 0) continue;
	
				if (legendFullText == legendText) {
					legendSelector = this.uniqueXPath("legend[.=" + 
						this.attributeValue(legendText) + "]", legendObject, true, e);
					if (!!legendSelector) break;
				}
				legendSelector = this.uniqueXPath("legend[text()=" + 
					this.attributeValue(legendText) + "]", legendObject, true, e);
				if (!!legendSelector) break;
	
				legendSelector = this.uniqueXPath("legend[contains(.," + this.attributeValue(legendText) + ")]", legendObject, true, e);
				if (!!legendSelector) break;
			}
			
			if (!legendSelector) {
				return null;
			}
	
			return this.addXPathPrefix(this.getXPathRoot(e) + 
				this.xpathHtmlElement("fieldset") + 
					"[" + legendSelector + "]");
		}, LocatorBuilder.AcceptLastChance)
	
		LocatorBuilder.add('xpath:spanInLabel', function (e) {
			if (((e.nodeName || "").toLowerCase() != 'span')) {
				return null;
			}
			var className = e.className || "";
			if (className.indexOf("radio") == -1) {
				return null;
			}
	
			var labelObject = getParentLabelObject(e);
			if (!labelObject)
				return null;
			var labelFullText = (labelObject.textContent || labelObject.innerText || "").trim();
			var labelValue = prepareForSearchLines(labelFullText);
			if (labelValue.length == 0) {
				return null;
			}
				
			var labelSelector;
			var labelNodeName = this.xpathHtmlElement(labelObject);
			var rootPrefix = this.getXPathRoot(labelObject);
			for (var i = 0; i < labelValue.length; i++) {
				var labelText = labelValue[i] || "";
				if (labelText.length == 0) continue;
	
				if (labelFullText == labelText) {
					labelSelector = this.uniqueXPath(rootPrefix + labelNodeName + 
						"[.=" + this.attributeValue(labelText) + "]", labelObject, true);
					if (!!labelSelector) break;
				}
				labelSelector = this.uniqueXPath(rootPrefix + labelNodeName + "[text()=" + 
					this.attributeValue(labelText) + "]", labelObject, true);
				if (!!labelSelector) break;
	
				labelSelector = this.uniqueXPath(rootPrefix + labelNodeName + 
					"[contains(.," + this.attributeValue(labelText) + ")]", labelObject, true);
				if (!!labelSelector) break;
			}
			
			if (!labelSelector) {
				return null;
			}
	
			return this.addXPathPrefix(
				labelSelector + "//" + this.xpathHtmlElement("span"));
		}, LocatorBuilder.AcceptLastChance)
	
		LocatorBuilder.add('xpath:labelFor', function (e) {
			var nodeName = (e.nodeName || "").toLowerCase();
			if (['input', 'select', 'textarea'].indexOf(nodeName) == -1) {
				return null;
			}
	
			var idValue = e.id || e.getAttribute('id');
			if (!idValue) {
				return null;
			}
	
			var labelNodeName = this.xpathHtmlElement("label");
			var idTail = "";
			var labelSelector = "//" + labelNodeName + "[@for=" + this.attributeValue(idValue) + "]";
			var labelObject = this.rootDocument.evaluate(labelSelector, this.rootDocument, null, 
				XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
			if (!labelObject) {
				var labelId = "";
				var labels = this.rootDocument.evaluate("//" + labelNodeName, this.rootDocument, null, XPathResult.ANY_TYPE, null);
				while (labelObject = labels.iterateNext()) {
					labelId = labelObject['for'] || labelObject.getAttribute('for');
					if (!labelId)
						continue;
					if (idValue.indexOf(labelId) == 0) 
						break;
				}
				if (!labelObject)
					return null;
				idTail = idValue.slice(labelId.length);
			}
			labelSelector = "";
	
			var labelFullText = (labelObject.textContent || labelObject.innerText || "").trim();
			var labelValue = prepareForSearchLines(labelFullText);
			if (labelValue.length != 0) {
				var labelRootPrefix = "//";
				for (var i = 0; i < labelValue.length; i++) {
					var labelText = labelValue[i] || "";
					if (labelText.length == 0) continue;
	
					if (labelFullText == labelText) {
						labelSelector = this.uniqueXPath(labelRootPrefix + labelNodeName + 
							"[.=" + this.attributeValue(labelText) + "]", labelObject, true);
						if (!!labelSelector) break;
					}
	
					labelSelector = this.uniqueXPath(labelRootPrefix + labelNodeName + 
						"[text()=" + this.attributeValue(labelText) + "]", labelObject, true);
					if (!!labelSelector) break;
	
					labelSelector = this.uniqueXPath(labelRootPrefix + labelNodeName + 
						"[contains(.," + this.attributeValue(labelText) + ")]", labelObject, true);
					if (!!labelSelector) break;
				}
	
				if (labelSelector) {
					labelSelector = "(" + labelSelector + "/@for)";
				}
			} else {
				if (idIsStatic(idValue)) {
					labelSelector = this.attributeValue(idValue);
				}
			}
	
			if (!labelSelector) {
				return null;
			}
	
			var idSelector;
			if (idTail.length == 0) {
				idSelector = "@id=" + labelSelector;
			} else {
				idSelector = "starts-with(@id, " + labelSelector + ")";
			}
	
			return this.addXPathPrefix(this.getXPathRoot(e) + this.xpathHtmlElement(nodeName) + 
				"[" + idSelector + "]");
		}, LocatorBuilder.AcceptLastChance)
	
		LocatorBuilder.prototype.getAriaLinkXPath = function (e, ariaAttrName, internalSyntax) {
			if (e['aria-hidden'] || e.getAttribute('aria-hidden')) {
				return null;
			}

			var idValue = e[ariaAttrName] || e.getAttribute(ariaAttrName);
			if (!idValue) {
				return null;
			}
			var labelObject = this.rootDocument.getElementById(idValue);
			if (!labelObject) {
				return null;
			}			
	
			var labelSelector;
			var labelFullValue = (labelObject.textContent || labelObject.innerText || "").trim();
			var labelValue = prepareForSearchLines(labelFullValue);
			if (labelValue.length) {
				var selfDescribing = e.contains(labelObject);
				if (selfDescribing) {
					labelObject = e;
				}
	
				var preparelabelSelector = function() {
					var labelObjectName = this.xpathHtmlElement(labelObject);
					for (var j = 0; j < labelValue.length; j++) {
						var labelText = labelValue[j] || "";
						if (labelText.length == 0) continue;
	
						if (labelFullValue == labelText) {
							labelSelector = this.uniqueXPath("//" + labelObjectName + 
								"[.=" + this.attributeValue(labelText) + "]", labelObject, !selfDescribing);
							if (!!labelSelector) break;
						}
						labelSelector = this.uniqueXPath("//" + labelObjectName + 
							"[text()=" + this.attributeValue(labelText) + "]", labelObject, !selfDescribing);
						if (!!labelSelector) break;
	
						labelSelector = this.uniqueXPath("//" + labelObjectName + 
							"[contains(.," + this.attributeValue(labelText) + ")]", labelObject, !selfDescribing);
						if (!!labelSelector) break;
					}
				};
	
				preparelabelSelector.call(this);
	
				if (labelSelector) {
					if (selfDescribing) {
						return labelSelector;
					}
					labelSelector = "(" + labelSelector + "/@id)";
				} else if (!selfDescribing) {
					var elementFullValue = (e.textContent || e.innerText || "").trim();
					var elementLabelValue = prepareForSearchLines(elementFullValue);
					var overrides = false;
					ArrayForEach(elementLabelValue, function (text) {
						overrides = overrides || (labelFullValue.indexOf(text) != -1);
					});
					if (overrides) {
						selfDescribing = true;
						labelObject = e;
						labelFullValue = elementFullValue;
						labelValue = elementLabelValue;
						preparelabelSelector.call(this);
						if (internalSyntax)
							return labelSelector;
						return this.addXPathPrefix(labelSelector);
					}
				}
			} else {
				if (idIsStatic(idValue)) {
					labelSelector = this.attributeValue(idValue);
				}
			}
	
			if (!labelSelector) {
				return null;
			}
	
			var idSelector = "@" + ariaAttrName + "=" + labelSelector;
	
			return this.uniqueXPath(
				this.getXPathRoot(e) + this.xpathHtmlElement(e) +
				"[" + idSelector + "]",
				e,
				internalSyntax
			);
		}
	
		LocatorBuilder.add('xpath:ariaLinks', function (e, lastChance) {
			var ariaLinks = [
				'aria-labelledby',
				'aria-describedby',
			];
	
			for (var i = 0; i < ariaLinks.length; i++) {
				var ariaAttrName = ariaLinks[i];
				var retVal = this.getAriaLinkXPath(e, ariaAttrName);
				if (!!retVal)
					return retVal;
			}
			return null;
		}, LocatorBuilder.AcceptLastChance)
	
		LocatorBuilder.add('xpath:sfdc_uiMenu', function (e) {
			var nodeName = (e.nodeName || "").toLowerCase();
			if (nodeName != "div")
				return null;
			var auraClass = e["data-aura-class"] || (e.getAttribute && e.getAttribute("data-aura-class"));
			if (auraClass != "uiMenu")
				return null;
	
			var ariaAttrName = "aria-describedby";
			var links = e.querySelectorAll("[" + ariaAttrName + "]");
			if (links) {
				for (var j = 0; j < links.length; j++) {
					var link = links[j];
					if (!link)
						continue;
					var selector = this.getAriaLinkXPath(link, ariaAttrName, true);
					if (!selector)
						continue;
					var retVal = this.uniqueXPath(selector + "/ancestor::div[@class='uiMenu']", e);
					if (!!retVal)
						return retVal;
				}
			}
			return null;
		}, LocatorBuilder.AcceptLastChance)
	
		LocatorBuilder.add('xpath:text', function (e, lastChance) {
			if (!suitableForTextSearch(e)) {
				return null;
			}
	
			var fullText = visibleOnly_getInnerText(e, e, '\n').trim();
			var lines = prepareForSearchLines(fullText);
			if (!lines.length) {
				return null;
			}
	
			var builder = this;
			var nodeName = this.xpathHtmlElement(e);
			var rootPrefix = "xpath=" + this.getXPathRoot(e);
	
			if (!lastChance) {
				var selectors = [];
				var processLine = function(text) {
					if (text.length > builder.shortStringLength)
						return;
					if (text == fullText) {
						ArrayPush(selectors, rootPrefix + nodeName + 
							'[.=' + builder.attributeValue(text) + ']');
					}
					ArrayPush(selectors, rootPrefix + nodeName + 
						'[text()=' + builder.attributeValue(text) + ']');
					ArrayPush(selectors, rootPrefix + nodeName + 
						'[contains(text(), ' + builder.attributeValue(text) + ')]');
					ArrayPush(selectors, rootPrefix + nodeName + 
						'[contains(., ' + builder.attributeValue(text) + ')]');
				};
		
				processLine(lines[0]);
				lines.splice(0, 1);
				lines = ArraySort(lines, function(a, b) {
					return b.length - a.length;
				});
				ArrayForEach(lines, processLine);
				return selectors;
			}
	
			var selector;
			var rootPrefix = this.getXPathRoot(e);
			ArrayForEach(lines, function(text) {
				if (selector) return;
				if (text.length > builder.shortStringLength)
					return;
				if (text == fullText) {
					selector = builder.preciseXPath(rootPrefix + nodeName + 
						'[.=' + builder.attributeValue(text) + ']', e);
					if (selector) return;
				}
				selector = builder.preciseXPath(rootPrefix + nodeName + 
					'[text()=' + builder.attributeValue(text) + ']', e);
				if (selector) return;
	
				selector = builder.preciseXPath(rootPrefix + nodeName + 
					'[contains(text(), ' + builder.attributeValue(text) + ')]', e);
				if (selector) return;
	
				selector = builder.preciseXPath(rootPrefix + nodeName + 
					'[contains(., ' + builder.attributeValue(text) + ')]', e);
				if (selector) return;
			});
			return selector;
		}, LocatorBuilder.AcceptLastChance)
	
		LocatorBuilder.add('*:aria-attr', function (e) {
			var PREFERRED_ATTRIBUTES = [
				'aria-label',
				'aria-level',
				'aria-labelledby',
				'aria-describedby',
			]
	
			return this.generateLocatorForAttrs(e, PREFERRED_ATTRIBUTES);
		}, LocatorBuilder.SelfVerified)
	
		LocatorBuilder.add('xpath:img', function (el) {
			var nodeName = (el.nodeName || "").toLowerCase();
			if (nodeName != "img")
				return null;
	
			var selectors = [];
			var attrs = [
				['alt', true],
				['title', true],
				['src', false, true],
			];
			var attrList = [];
			ArrayForEach(attrs, function(attr) {
				var attrValue = (el.getAttribute ? el.getAttribute(attr[0]): null) || "";
				if (!attrValue)
					return;
				var useEqual = attr[1];
				if (!!attr[2]) {
					var purified = purifyHref(attrValue);
					if (!purified)
						return;
					if (purified == attrValue) {
						useEqual = true;
					}
					attrValue = purified;
				} 
				if (attrValue.length > this.shortStringLength)
					return;
				var selector;
				if (!!useEqual) {
					selector = this.xpathHtmlElement("img") + "[@" + attr[0] + "=" + 
						this.attributeValue(attrValue) + "]";
				} else {
					selector = this.xpathHtmlElement("img") + "[contains(@" + attr[0] + "," + 
						this.attributeValue(attrValue) + ")]";
				}
				ArrayPush(selectors, selector);
				ArrayPush(attrList, [attr, attrValue]);
			}, this);
			if (attrList.length > 1) {
				var complexSelector = "";
				ArrayForEach(attrList, function(attrListItem) {
					var attr = attrListItem[0];
					var attrValue = attrListItem[1];
					if (complexSelector) {
						complexSelector += " AND ";
					}
					if (!!attr[1]) {
						complexSelector += "@" + attr[0] + "=" + 
							this.attributeValue(attrValue);
					} else {
						complexSelector += "contains(@" + attr[0] + "," + 
							this.attributeValue(attrValue) + ")";
					}
				});
				complexSelector = this.xpathHtmlElement("img") + "[" + complexSelector + "]";
				ArrayPush(selectors, complexSelector);
			}
	
			var unique;
			var startedAt = new Date();
			ArrayFind(selectors, function(s) {
				if (getTimeoutExpired(startedAt, 50)) return true;
				unique = this.addXPathPrefix(this.generateUniqueXPath(
					el, { 'leafName': s }));
				return !!unique;
			}, this);
			return unique;
		}, LocatorBuilder.SelfVerified)
	
		LocatorBuilder.add('xpath:inputtype', function (e, lastChance) {
			var nodeName = (e.nodeName || "").toLowerCase();
			if (nodeName != "input") {
				return;
			}
			var leafName = this.generateXPathOneLevelId(e);
			if (!leafName || (leafName == nodeName)) {
				return;
			}
			return this.addXPathPrefix(this.generateUniqueXPath(e, {
				'minDepth': 1, 'maxDepth': 7,
				'leafName': leafName
			}));
		}, LocatorBuilder.AcceptLastChance)
	
		LocatorBuilder.prototype.generateXPathForAttrSet = function(e, attNames, minDepth) {
			var locator = this.xpathHtmlElement(e);
			for (var i = 0; i < attNames.length; i++) {
				var attName = attNames[i][0];
				var attValue = this.attributeValue(attNames[i][1]);
				if (!!attNames[i][2]) {
					locator += '[contains(@' + attName + ', ' + attValue + ')]';
				} else {
					locator += '[@' + attName + '=' + attValue + ']';
				}
			}
			return this.addXPathPrefix(this.generateUniqueXPath(e, {
				'leafName': locator, 'minDepth': minDepth}));
		};
	
		LocatorBuilder.prototype.generateCssForAttrSet = function(e, attNames) {
			var attrs = ArrayMap(attNames, function(attr) {
				return {'name': attr[0], 'value': attr[1], 'contains': attr[2] };
			});
			var finder = new CssLocatorBuilder(e, this.rootDocument, 
				{ 'leafAttrs': attrs, 'minDepth': 1, 'justMatch': false });
			var selector = finder.getSelector();
			if (selector) {
				return 'css=' + selector;
			}
		};
	
		LocatorBuilder.prototype.generateLocatorForAttrs = function(e, attrNames, generator) {
			if (!e.attributes) {
				return null;
			}
	
			if (!generator) {
				if (this.useCss) {
					generator = this.generateCssForAttrSet;
				} else {
					generator = this.generateXPathForAttrSet;
				}
			}
	
			var atts = [];
			var ids = ['id', 'name', 'aria-label', 'aria-labelledby', 'aria-describedby'];
			ArrayForEach(attrNames, function(name) {
				var value = (e.getAttribute ? e.getAttribute(name): null) || "";
				if (!value) return;
				if (name == 'class') {
					var classList = ArrayMap(ArrayFrom(
						value.replace(/[\t\f\r\n\xA0]/g, ' ').split(' ')), function(name) {
						return (name || "").trim();
					});
					var classes = ArraySort(ArrayFilter(classList, function(classValue) {
						return classValue && classNameIsStatic(classValue);
					}), function(a, b) {
						return a.length > b.length;
					});
					ArrayForEach(classes, function(classValue) {
						ArrayPush(atts, [name, classValue, true]);
					});
				} else if (name == 'href' || name == 'src' || name == 'action') {
					ArrayForEach(combineHrefGrowth(value), function(item) {
						ArrayPush(atts, [name, item, value != item]);	
					});
					var purified = purifyHref(value);
					if (!purified) return;
					ArrayPush(atts, [name, purified, value != purified]);	
				} else if (ids.indexOf(name) != -1) {
					if (!idIsStatic(value)) return;
					ArrayPush(atts, [name, value]);	
				} else if (name == 'role') {
					if (!roleIsStatic(value)) return;
					ArrayPush(atts, [name, value]);	
				} else {
					if (name.length > this.shortStringLength) return;
					ArrayPush(atts, [name, value]);
				}
			}, this);
	
			var names = [];
			var depthMax = 2;
			var startedAt = new Date();
			for (var depth = 0; depth < depthMax; depth++) {
				for (var i = depth; i < atts.length; i++) {
					if (getTimeoutExpired(startedAt, 50)) return;
					var locator = generator.call(this, e, names.concat([atts[i]]), depthMax - depth);
					if (locator) {
						return locator;
					}
				}
				ArrayPush(names, atts[depth]);
			}
			return null
		};
	
		LocatorBuilder.add('*:attributes', function (e) {
			var PREFERRED_ATTRIBUTES = [
				'value', 
				'title', 
				'role',
				'type',
				'src',
				'action', 
			]
	
			return this.generateLocatorForAttrs(e, PREFERRED_ATTRIBUTES);
		}, LocatorBuilder.SelfVerified)
	
		LocatorBuilder.add('*:attributes_unstable', function (e) {
			if (this.useCss) return;
	
			var PREFERRED_ATTRIBUTES = [
				'class',
			]
	
			return this.generateLocatorForAttrs(e, PREFERRED_ATTRIBUTES);
		}, LocatorBuilder.SelfVerified)
	
		LocatorBuilder.prototype.generateXPathOneLevelId = function(e) {
			var nodeName = e.nodeName.toLowerCase();
			var xpathName = this.xpathHtmlElement(e);
	
			var processAttrs = function(attrs) {
				var retVal;
				ArrayForEach(attrs, function(item) {
					if (retVal) return;
					var value = e[item];
					if (value && idIsStatic(value)) {
						retVal = xpathName + '[@' + item + '=' + this.attributeValue(value) + ']';
					}
				}, this);
				return retVal;
			};
	
			if (nodeName == "input") {
				var retVal = processAttrs.call(this, [
					"name", 
					"type",
					"title",
					"alt",
				]);
				if (retVal) {
					return retVal;
				}
			}
	
			return xpathName;
		};
	
		LocatorBuilder.prototype.getXPathRoot = function(el) {
			var parent = el.parentNode || el.parentElement;
			if (!parent || (this.rootDocument == parent) 
				|| (this.rootDocument.body == parent))
				return "";
			return "//";
		}
	
		LocatorBuilder.prototype.addXPathPrefix = function(v) {
			if (!v) return;
			return 'xpath=' + v;
		}
	
		LocatorBuilder.prototype.generateUniqueXPath = function(el, options) {
	
			options = options || {};
			var root = options.root;
			var fullPath = options.fullPath;
			var rootName = options.rootName || "";
			var minDepth = options.minDepth || 2;
			var maxDepth = options.maxDepth || 7;
			var customLeafName = options.leafName;
			if (customLeafName) {
				for (var i = 0; i < 2; i++) {
					if (customLeafName[0] == '/') {
						customLeafName = customLeafName.slice(1);
						if (!customLeafName) {
							break;
						}
					}
				}
			}
			var leafName = customLeafName || nodeNameToXPathName(el);
			var targetElement = el;
	
			var evaluateRoot = findRootDocument(el) || document;
			if (!root) {
				if (el.parentElement === evaluateRoot.body) {
					rootName = "";
					evaluateRoot = evaluateRoot.body;
				} else {
					rootName = "//";
				}
				root = evaluateRoot;
			} else {
				if (!rootName) {
					var rootRoot = findRootDocument(root) || document;
					if (root == rootRoot) {
						rootName = "";
					} else {
						rootName = this.generateUniqueXPath(root, {
							'root': rootRoot, 
							'minDepth': 1, 
							'maxDepth': 3
						});
						if (!rootName) {
							return;
						}
					}
				}
				if (el.parentElement === root) {
					rootName += "/";
				} else {
					rootName += "//";
				}
				if (rootName.indexOf("//") != 0) {
					evaluateRoot = evaluateRoot.body;
				}
			}
	
			if ((root.nodeType != 1) && root.body) {
				root = root.body;
			}
	
			function Node() {
				this.transition = {};
				this.suffixLink = null;
			}
		
			Node.prototype.addTransition = function (node, start, end, t) {
				this.transition[t] = [node, start, end];
			}
		
			Node.prototype.isLeaf = function () {
				return Object.keys(this.transition).length === 0;
			}
		
			function SuffixTree(ValueType) {
				this.valueType = ValueType;
				this.text = this.valueType.createEmptyValue();
				this.str_list = [];
				this.seps = []
				this.root = new Node();
				this.bottom = new Node();
				this.root.suffixLink = this.bottom;
				this.s = this.root;
				this.k = 0;
				this.i = -1;
			}
		
			SuffixTree.prototype.addString = function (str) {
				var temp = this.text.length;
				this.text = this.valueType.concat(this.text, str);
				ArrayPush(this.seps, str[str.length - 1])
				ArrayPush(this.str_list, str);
				var s, k, i;
				s = this.s;
				k = this.k;
				i = this.i;
		
				for (var j = temp; j < this.text.length; j++) {
					this.bottom.addTransition(this.root, j, j, this.text[j]);
				}
		
				while (this.text[i + 1]) {
					i++;
					var up = this.update(s, k, i);
					up = this.canonize(up[0], up[1], i);
					s = up[0];
					k = up[1];
				}
		
				this.s = s;
				this.k = k;
				this.i = i;
				return this;
			}
		
			SuffixTree.prototype.update = function (s, k, i) {
				var oldr = this.root;
				var endAndr = this.testAndSplit(s, k, i - 1, this.text[i]);
				var endPoint = endAndr[0]; var r = endAndr[1]
		
				while (!endPoint) {
					r.addTransition(new Node(), i, Infinity, this.text[i]);
		
					if (oldr != this.root) {
						oldr.suffixLink = r;
					}
		
					oldr = r;
					var sAndk = this.canonize(s.suffixLink, k, i - 1);
					s = sAndk[0];
					k = sAndk[1];
					endAndr = this.testAndSplit(s, k, i - 1, this.text[i]);
					var endPoint = endAndr[0]; var r = endAndr[1]
				}
		
				if (oldr != this.root) {
					oldr.suffixLink = s;
				}
		
				return [s, k];
			}
		
			SuffixTree.prototype.testAndSplit = function (s, k, p, t) {
				if (k <= p) {
					var traNs = s.transition[this.text[k]];
					var s2 = traNs[0], k2 = traNs[1], p2 = traNs[2];
					if (t == this.text[k2 + p - k + 1]) {
						return [true, s];
					} else {
						var r = new Node();
						s.addTransition(r, k2, k2 + p - k, this.text[k2]);
						r.addTransition(s2, k2 + p - k + 1, p2, this.text[k2 + p - k + 1]);
						return [false, r];
					}
				} else {
					if (!s.transition[t])
						return [false, s];
					else
						return [true, s];
				}
			}
		
			SuffixTree.prototype.canonize = function (s, k, p) {
				if (p < k)
					return [s, k];
				else {
					var traNs = s.transition[this.text[k]];
					var s2 = traNs[0], k2 = traNs[1], p2 = traNs[2];
		
					while (p2 - k2 <= p - k) {
						k = k + p2 - k2 + 1;
						s = s2;
			
						if (k <= p) {
							var traNs = s.transition[this.text[k]];
							s2 = traNs[0]; k2 = traNs[1]; p2 = traNs[2];
						}
					}
		
					return [s, k];
				}
			}
		
			SuffixTree.prototype.findLeafsOf = function (stringIndex) {
				var ret = [];
				var text = this.text;
		
				function traverse(node, suffix) {
					if (!node.transition) 
						return [];
		
					var values = ObjectValues(node.transition);
					for (var t = 0; t < values.length; t++) {
						var traNs = values[t];
						var s = traNs[0], a = traNs[1];
						var name = this.valueType.createEmptyValue();
						if (s.isLeaf()) {
							for (var pos = a; pos < text.length; pos++) {
								var insep = this.seps.indexOf(text[pos]);
								if (insep > -1) {
									if (insep != stringIndex) {
										break;
									}
									if (a == pos) {
										break;
									}
									name = this.valueType.slice(text, a, pos + 1);
									break;
								}
							}
							if (!name.length)
								continue;
							ArrayPush(ret, this.valueType.concat(suffix, name));
						} else {
							var b = traNs[2];
							name = this.valueType.slice(text, a, b + 1);
							traverse.call(this, s, this.valueType.concat(suffix, name));
						}
					}
				}
		
				traverse.call(this, this.root, this.valueType.createEmptyValue());
				return ret;
			}
			
			function DnaBuilder() {
				this.elements = [];
				this.dict = {};
				this.nextId = 1;
				this.valueType = {
					'createEmptyValue': function () {
						return [];
					},
					'concat': function (a, b) {
						return a.concat(b);
					},
					'slice': function (s, a, b) {
						return s.slice(a, b);
					}
				};
			}
		
			DnaBuilder.prototype.addElement = function(el) {
				ArrayPush(this.elements, el);
			}
		
			DnaBuilder.prototype.encodeDna = function(root, leafItem, predecessorDna) {
	
				var calcIndex = function(nodeName, el) {
					var index = 0;
					el = el.previousSibling;
					while (el) {
						if (el.nodeName.toLowerCase() == nodeName) {
							index++;
						}
						el = el.previousSibling;
					}
					return index;
				};
	
				var getNodeName = function(el, strongify) {
					var nodeName = el.nodeName.toLowerCase();
					var name = nodeNameToXPathName(el);
					if (nodeName != name) 
						return name;
					if (el !== leafItem) {
						var role = el.getAttribute && el.getAttribute("role");
						if ((role === "dialog") || (role === "main")) {
							return nodeName + "[@role='" + role + "']";	
						}
					}
					if (!strongify) {
						return nodeName;
					}
					if (el !== leafItem) {
						var parent = el.parentElement;
						if (!parent)
							return name;
						var generators = [function(el) {
							var role = el.getAttribute && el.getAttribute("role");
							if (role && roleIsStatic(role)) {
								return nodeName + "[@role='" + role + "']";
							}
						}, function(el) {
							var id = el.getAttribute && el.getAttribute("id");
							if (!id) return;
							if (idIsStatic(id)) {
								return nodeName + "[@id='" + id + "']";
							}
							if (idIsStaticGeneral(id)) {
								return nodeName + "[@id]";
							}
						}];
						var child = parent.firstChild;
						var children = [];
						while (child) {
							ArrayPush(children, child);
							child = child.nextSibling;
						}
						for (var i = 0; i < generators.length; i++) {
							var curName = generators[i](el);
							if (!curName) continue;
							var match = ArrayFind(children, function(child) {
								if (child === el) return false;
								var childName = generators[i](child);
								if (!childName) return false;
								return childName == curName;
							});
							if (!!match) continue;
							return curName;
						}
					}
					return nodeName + "[" + (calcIndex(nodeName, el) + 1) + "]";
				};
	
				var getDnaValue = function(nodeName) {
					var value = this.dict[nodeName];
					if (value) return value;
					value = this.nextId++;
					this.dict[nodeName] = value;
					return value;
				};
	
				var findDna = function(el) {
					var dna = predecessorDna;
					while (!!dna) {
						if (dna.node === el)
							return dna;
						dna = dna.parent;
					}
					return null;
				};
	
				var updateResultBranch = function(dna) {
					dna.resultBranch = true;
					var parentDna = dna.parent;
					if (!parentDna) 
						return;
					if (parentDna.children.length > 1) {
						ArrayForEach(parentDna.children, function(childDna) {
							if (childDna.strong) return;
							childDna.name = getNodeName(childDna.node, true);
							childDna.value = getDnaValue.call(this, childDna.name);
							childDna.strong = true;
						}, this);
					}
					updateResultBranch.call(this, parentDna);
				};
	
				var createDna = function(el) {
					var dna = findDna(el);
					if (!!dna) return dna;
	
					dna = {
						'value': 0,
						'node': el,
						'parent': null,
						'name': '',
						'children': [],
						'strong': false,
						'resultBranch': (targetElement === el)
					};
	
					if ((el === leafItem) && !!customLeafName) {
						dna.name = customLeafName;
					} else {
						dna.name = getNodeName(el);
					}
					dna.strong = (!fullPath && (el === leafItem)) || (dna.name != el.nodeName.toLowerCase());
					dna.value = getDnaValue.call(this, dna.name);
	
					var parent;
					var role = ((el.getAttribute && el.getAttribute("role")) || "").toLowerCase();
					if ((role !== "dialog") && (role !== "main")) {
						parent = el.parentElement;
					}
	
					if (parent && (parent !== root) && (parent.nodeType == 1)) {
						dna.parent = createDna.call(this, parent);
						if (dna.parent) {
							ArrayPush(dna.parent.children, dna);
							if (dna.resultBranch || dna.parent.resultBranch) {
								updateResultBranch.call(this, dna);
							}
						}
					}
	
					return dna;
				};
	
				return createDna.call(this, leafItem);
			}
	
			DnaBuilder.prototype.decodeDna = function(dna) {
				var ret = '';
				var dict = ObjectEntries(this.dict);
				var decodeItem = function(a) {
					var nodeName = ArrayFind(dict, function(i) {
						return i[1] == a;
					}) [0];
					return nodeName;
				};
				ArrayForEach(dna, function (a) {
					if (ret) ret += "/";
					ret += !a ? '': decodeItem(a);
				});
				return ret;
			}
		
			DnaBuilder.prototype.findUniqueSequence = function(position, root, minDepth, maxDepth) {
				var list = this.elements;
				var el = list[position];
				if (!el) {
					return;
				}
		
				if (list.length == 1) {
					if (!!fullPath || !minDepth || (minDepth <= 1)) {
						return [leafName];
					}
					return;
				}
		
				var lastDna;
				var dnaTree = [];
	
				for (var i = 0; i < list.length; i++) {
					var itemDna = this.encodeDna(root, list[i], lastDna);
					ArrayPush(dnaTree, itemDna);
					lastDna = itemDna;
				}
	
				var dnas = ArrayMap(dnaTree, function(dna) {
					var values = [];
					while (!!dna) {
						ArrayUnshift(values, dna.value);
						dna = dna.parent;
					}
					return values;
				});
	
				ArrayForEach(dnaTree, function(dna) {
					while (!!dna) {
						dna.children = null;
						dna = dna.parent;
					}
				});
	
				var tree = new SuffixTree(this.valueType);
	
				var elementId = this.nextId;
				ArrayForEach(dnas, function(dna) {
					ArrayPush(dna, ++elementId);
					tree.addString(dna);
				});
	
				var uniques = ArraySort(ArrayFilter(ArrayMap(tree.findLeafsOf(position), function(item) {
					if (!item || !item.length) 
						return null;
					return item.slice(0, item.length - 1);
				}), function(item) {
					return item && item.length;
				}), function(a, b) {
					return a.length - b.length;
				});
	
				if (!uniques.length) {
					return;
				}
	
				var meaninglessItemNames = ["table", "tbody", "thead", "div", "span"]; 
				var meaninglessItems = ArrayMap(ArrayFilter(ObjectEntries(this.dict), function(a) {
					return meaninglessItemNames.indexOf(a[0]) != -1;
				}), function (a) {
					return a[1];
				});
	
				var compressedLength = function (arr) {
					return ArrayReduce(arr, function(acc, i) {
						return acc + (i ? 1: 0);
					}, 0);
				}
	
				var trimedPaths = [];
				ArrayForEach(uniques, function(path) {
					if (!path)
						return;
					if (minDepth && path.length < minDepth)
						return;
					if (maxDepth && path.length > maxDepth) {
						var trimedLength = maxDepth - 2;
						if (trimedLength <= 0) {
							return;
						}
						var compressedPath = ArrayFilter(ArrayMap(path, function(a, i, arr) {
							if (i == (arr.length - 1)) {
								return a;
							}
							if (meaninglessItems.indexOf(a) != -1) {
								return 0;
							}
							return a;
						}), function(a, i, arr) {
							if ((i == 0) || (i == (arr.length - 1))) {
								return true;
							}
							if ((a == 0) && (arr[i - 1] == 0)) {
								return false;
							}
							return true;
						});
						var newLength = compressedLength(compressedPath);
						if ((!minDepth || (newLength >= minDepth)) && (newLength <= maxDepth)) {
							ArrayPush(trimedPaths, compressedPath);
						}
						ArrayPush(trimedPaths, path.slice(0, 1).concat([0]).
							concat(path.slice(-trimedLength)));
						ArrayPush(trimedPaths, path.slice(0, trimedLength).
							concat([0, path[path.length - 1]]));
						return;
					}
					ArrayPush(trimedPaths, path);
				});
	
				var builder = this;
				var penalty = function (a) {
					return ArrayReduce(a, function (acc, i, index) {
						if (index == a.length - 1)
							return acc - 1;
						if (i == 0) 
							return acc;
						if (meaninglessItems.indexOf(i) != -1) 
							return acc + 1;
						var name = builder.decodeDna([i]);
						if (!name)
							return acc;
						if (name.indexOf('@') == -1)
							return acc - 1;
						if (name.indexOf('role') == -1)
							return acc - 3;
						return acc - 6;
					}, 2 * compressedLength(a));
				};
	
				// console.log("trimedPaths", ArrayMap(trimedPaths, function(a) {
				// 	return [a, penalty(a)];
				// }, this));
	
				var hashes = {};
				return ArrayFilter(ArrayMap(ArraySort(trimedPaths, function (a, b) {
					return penalty(a) - penalty(b);
				}), function (a) {
					return this.decodeDna(a).toString().replace(/\[1\]/g,"");
				}, this), function(a) {
					if (!hashes[a]) {
						hashes[a] = true;
						return true;
					}
					return false;
				});
			}
		
			this.log('Unique. Start to generate unique set for ' + rootName + leafName + '. [' + minDepth + ', ' + maxDepth + ']');
			var result = document.evaluate(rootName + leafName, evaluateRoot, null, 
				XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
			if (!result) {
				this.log('Unique. Invalid preds search. ' + rootName + leafName);
				return;
			}
		
			var builder = new DnaBuilder();
		
			var item;
			var count = 0, position = -1;
			while (item = result.iterateNext()) {
				builder.addElement(item);
				if (item == el) {
					position = count;
				}
				count++;
				if ((position != -1) && (count > 10)) {
					break;
				}
			}
	
			if (position == -1) {
				this.log('Unique. Target not found in preds. ' + rootName + leafName);
				return;
			}
	
			var uniquePath;
			if (count == 1) {
				this.log('Unique. Fully unique ' + rootName + leafName);
				uniquePath = [leafName];
			} else {
				uniquePath = builder.findUniqueSequence(position, root, minDepth, maxDepth);
				if (!uniquePath) {
					this.log('Unique. Cannot generate unique set for ' + rootName + leafName + 
						'. position=' + position + '. count=' + count);
					return;
				}
			}
	
			// console.log("uniquePath", uniquePath);
			var startedAt = new Date();
			for (var i = 0; i < uniquePath.length; i++) {
				var fullPath = rootName + uniquePath[i];
				var result = document.evaluate(fullPath, root, null, 
					XPathResult.FIRST_ORDERED_NODE_TYPE, null);
				if (!result) {
					this.log('Unique. Cannot check uniqueness ' + fullPath);
					continue;
				}
			
				if (result.singleNodeValue != el) {
					this.log('Unique. Is not unique ' + fullPath);
					if (!getTimeoutExpired(startedAt, 50)) {
						continue;
					}
					this.log('Unique. Break because of timeout');
					break;
				}
			
				return fullPath;
			}
		}
		
		LocatorBuilder.add('xpath:unique', function (e, lastChance, level) {
			var d = new Date();
			var uniquePath = this.addXPathPrefix(this.generateUniqueXPath(e, {
				'minDepth': (level == 0 ? 2: 1)
			} ));
			if (uniquePath) {
				this.log('Unique generated for ' + (new Date() - d) + 'ms.');
				return uniquePath;
			}
	
			this.log('Failed to generate unique for ' + (new Date() - d) + 'ms.');
		}, LocatorBuilder.SelfVerified)
	
		LocatorBuilder.prototype.generateLinkXPathes = function(el)  {
			var elementHref = getHrefAttribute(el);
			if (!elementHref) {
				return null;
			}
	
			var selectors = [];
			var purifiedHref = purifyHref(el);
			var nodeName = this.xpathHtmlElement('a');
			var hash = {};
			var rootPrexix = this.getXPathRoot(el);
	
			var pushSelector = function(href, contains) {
				if (!!hash[href]) {
					return;
				}
				hash[href] = true;
	
				var selector;
				if (contains) {
					selector = rootPrexix + nodeName + '[contains(@href, ' + 
						this.attributeValue(href) + ')]';
				} else {
					selector = rootPrexix + nodeName + '[@href=' + 
						this.attributeValue(href) + ']';
				}
				ArrayPush(selectors, selector);
			};
	
			ArrayForEach(combineHrefGrowth(elementHref), function (part) {
				if ((part != elementHref) && (part != purifiedHref)) {
					pushSelector.call(this, part, true);
				}
			}, this);
	
			if (purifiedHref) {
				if (purifiedHref == elementHref) {
					pushSelector.call(this, elementHref);
				} else {
					pushSelector.call(this, purifiedHref, true);
				}
			}
	
			return selectors;
		}
	
		LocatorBuilder.add('xpath:relative', function (e, lastChance) {
			var current = e
			var testCount = 2;
			while (current && current.parentNode) {
				var parent = current.parentNode;
				if (parent.nodeType == Node.DOCUMENT_FRAGMENT_NODE ||
					parent.nodeType == Node.DOCUMENT_NODE) {
					break;
				}
				if (Node.ELEMENT_NODE == parent.nodeType) {
					if (parent.nodeName.toLowerCase() == "body") {
						break;
					}
		
					if ((parent.nodeName.toLowerCase() == "a") &&
						(hasHrefAttribute(parent)))
					{
						var linkSelectors = this.generateLinkXPathes(parent);
						if (!linkSelectors || !linkSelectors.length) {
							linkSelectors = ["//" + this.xpathHtmlElement(parent)];
						}
	
						var uniquePath;
						var startedAt = new Date();
						ArrayForEach(linkSelectors, function(linkPath) {
							if (uniquePath || getTimeoutExpired(startedAt, 50)) return;
							uniquePath = this.addXPathPrefix(this.generateUniqueXPath(e, {
								'root': parent, 
								'rootName': linkPath, 
								'minDepth': 1, 'maxDepth': 6
							}));
						}, this);
						if (uniquePath) {
							return uniquePath;
						}
						--testCount;
					}
	
					if (idIsStatic(parent.getAttribute('id'))) 
					{
						var rootName = this.getXPathRoot(parent) + this.xpathHtmlElement(parent) + 
							"[@id=" + this.attributeValue(parent.getAttribute("id")) + "]";
						var uniquePath = this.addXPathPrefix(this.generateUniqueXPath(e, {
								'root': parent, 
								'rootName': rootName,
								'minDepth': 1, 'maxDepth': 6
							}));
						if (uniquePath) {
							return uniquePath;
						}
						--testCount;
					}
	
					if (testCount <= 0)
						return;
				}
				current = current.parentNode
			}
		}, LocatorBuilder.AcceptLastChance)
	
		LocatorBuilder.add('xpath:position', function (e) {
			var selector = this.addXPathPrefix(
				this.generateUniqueXPath(e, {'fullPath': true }));
			if (!!selector) return selector;
			var index;
			var nodeName = this.xpathHtmlElement(e.nodeName.toLowerCase());
			if (e.parentElement === this.rootDocument.body) {
				selector = nodeName;
				index = this.calcXPathIndex(selector, e, this.rootDocument.body, true);
			} else {
				selector = "//" + nodeName;
				index = this.calcXPathIndex(selector, e, this.rootDocument, true);
			}
			if (index < 0) {
				return null;
			}
			if (index > 1) {
				if (selector.indexOf("//") != 0) {
					selector += "[" + index + "]";
				} else {
					selector = "(" + selector + ")[" + index + "]";
				}
			} 
			return this.addXPathPrefix(selector);
		}, LocatorBuilder.AcceptLastChance)
	
		LocatorBuilder.add('css:finder', function (e, lastChance) {
			if (!this.useCss) return;
	
			var selectors = [];
			var stages = [
				{ 'minDepth': 1, 'justMatch': true },
				{ 'minDepth': 1, 'justMatch': false },
				{ 'minDepth': 1, 'justMatch': false, 'noIndex': true },
			];
	
			var startedAt = new Date();
			var uniqueSelectors = {};
			try {
				for (var i = 0; i < stages.length; i++) {
					var finder = new CssLocatorBuilder(e, this.rootDocument, stages[i]);
					var selector = finder.getSelector();
					if (selector && !uniqueSelectors[selector]) {
						ArrayUnshift(selectors, 'css=' + selector);
						uniqueSelectors[selector] = true;
					}
					if (getTimeoutExpired(startedAt, 100)) break;
				}
			} catch(e) {
				this.log(':finder fails with ' + e.message);
			}
			return selectors;
		}, LocatorBuilder.SelfVerifiedLastChance)
	
		LocatorBuilder.createGroup([ // Type-specific reliable selectors
			'xpath:spanInLabel', 
			'xpath:labelFor', 
			'xpath:ariaLinks', 
			'xpath:sfdc_uiMenu', 
			'*:radio', 
			'xpath:fieldset', 
		]).addFinishers([
			'xpath:text', 
			'css:id', 
			'xpath:inputtype', 
			'xpath:unique',
			'css:id:with-digits', 
		]);
	
		LocatorBuilder.createGroup([ // Generic non-indexed selectors 
			'css:data-attr', 
			'css:id', 
			'*:name', 
			'xpath:text', 
			'css:data-attr-lowpriority',
			'*:aria-attr', 
			'*:attributes', 
			'xpath:inputtype', 
			'*:attributes_unstable', 
			'css:finder',
			'xpath:relative', 
			'xpath:unique',
			'css:id:with-digits',
		]);
	
		LocatorBuilder.createGroup([ // Last-chance indexed selectors
			'css:id', 
			'*:name', 
			'xpath:relative', 
			'css:finder',
			'xpath:position', 
		]);
	
		function window_elementFromPoint(view, x, y, inspectShadowDOM, viewDocument) {
			if (!view) return null;
	
			if (!viewDocument) {
				try {
					viewDocument = view.contentDocument || view.document;
				} catch (e) {
				}
				if (!viewDocument) return null;
			}
	
			var element = null;
			try {
				var zoom = getZoom(view);
				x /= zoom; y /= zoom;
	
				while (true) {
					var tempElement = viewDocument.elementFromPoint(x, y);
					if (!tempElement) 
						break;
	
					var tempNodeName = (tempElement["nodeName"] || "").toUpperCase();
					if ((tempNodeName == "IFRAME") || (tempNodeName == "FRAME")) {
						attachToFrame(tempElement);
					}
	
					element = tempElement;
					if (tempNodeName == "WEBVIEW")
						break;
					if (!inspectShadowDOM)
						break;
					var shadowDocument = null;
					try {
						shadowDocument = element.shadowRoot;
					} catch(e) {
	
					}
					if (!shadowDocument) 
						break;
	
					if (shadowDocument == viewDocument) 
						break;
	
					viewDocument = shadowDocument;
				}
	
				if (element)
				{
					var customControl = getUnifiedControlParent(element.ownerSVGElement || element);
					if (customControl)
						element = customControl;
				}
	
				while (element) {
					var nodeName = (element.nodeName || "").toUpperCase();
					if (nodeName == "AREA")
						break;
					if (nodeName == "BODY")
						return null;
					if (element.offsetWidth === undefined)
						break;
					if ((element.offsetWidth > 0) && (element.offsetHeight > 0))
						break;
					element = element.parentElement;
				}
			} catch(e) {
			}
			return element;
		}
	
		var elementFromPointMethodName = "testComplete15_elementFromPoint";
	
		function attachToFrame(frame) {
			try {
				var contentWindow = frame.contentWindow;
				if (contentWindow) {
					contentWindow[elementFromPointMethodName] = function(x, y, inspectShadowDOM, viewDocument) {
						return window_elementFromPoint(contentWindow, x, y, inspectShadowDOM, viewDocument);
					}
				}
				var contentDocument = frame.contentDocument;
				if (contentDocument) {
					if (contentWindow) {
						contentWindow.testComplete15_FindElement = function (selectors) {
							return element_FindElement(null, contentDocument, selectors);
						}
						contentWindow.testComplete15_FindElementsVisibleWithSimilarRect = function (selectors, width, height) {
							return element_FindElementsVisibleWithSimilarRect(null, contentDocument, selectors, width, height);
						}
					}
					contentDocument.addEventListener('DOMContentLoaded', function() {
						attachToFrames(contentDocument);
					});
					attachToFrames(contentDocument);
				}
			} catch(e) {
			}
		}
	
		function attachToFrames(frameDocument) {
			ArrayForEach(ArrayFrom(frameDocument.getElementsByTagName("IFRAME")), attachToFrame);
			ArrayForEach(ArrayFrom(frameDocument.getElementsByTagName("FRAME")), attachToFrame);
			TestCompleteWebTestingHelpers.addGetContextTextMethodToDocFrames(frameDocument);
		}
	
		function attachToWindow(frameWindow) {
			try {
				frameWindow[elementFromPointMethodName] = function(x, y, inspectShadowDOM, viewDocument) {
					return window_elementFromPoint(frameWindow, x, y, inspectShadowDOM, viewDocument);
				}
				frameWindow.document.addEventListener('DOMContentLoaded', function() {
					attachToFrames(frameWindow.document);
				});
				frameWindow["__tc15_WebHelpersLog"] = function (value) { g_LogEnabled = value; };
				frameWindow["__tc15_WebHelpersTimeout"] = function (value) { g_UseTimeouts = value; };
				attachToFrames(frameWindow.document);
			} catch(e) {
			}
		};
	
		function watchForDocumentTitleChanges() {
			var title = document && document.querySelector && document.querySelector('title');
			if (!title) return;
			if (typeof MutationObserver === "function") {
				new MutationObserver(function(mutations) {
					if (typeof getIocm === "function") {
						var iocm = getIocm();
						if ((typeof iocm === "object") && iocm) {
							var URL = document.location.href;
							if (URL != iocm.lastTitleUpdateURL)
							{
								iocm.lastTitleUpdateURL = document.location.href;
								iocm.context.updateTitle(mutations[0].target.textContent);
							}
						}
					}
				}).observe(
					title, 
					{ subtree: true, characterData: true, childList: true }
				);
			}
		}
	
		attachToWindow(window);
		watchForDocumentTitleChanges();
	})();

	console.log('TestComplete engine injected correctly!');
};

var webHelpersStart = function () {
	"use strict";

	var g_LogEnabled = false;
	var g_UseTimeouts = true;

	function logMessage() {
		if (!g_LogEnabled) return;
		if (!console || !console.log) return;
		console.log.apply(console, arguments);
	}

	function traceMessage() {
		if (!g_LogEnabled) return;
		if (!console) return;
		if (console.trace) return console.trace.apply(console, arguments);
		console.log.apply(console, arguments);
	}

	function safeCall(func) {
		return function() {
			try {
				return func.apply(this, arguments);
			} catch(err) {
				logMessage(err.message);
			}
		};
	}

	function getTimeoutExpired(startedAt, timeout) {
		if (!g_UseTimeouts) return false;
		var expired = (new Date() - startedAt) > timeout;
		if (expired) {
			traceMessage('expired');
		}
		return expired;
	}

	function findRootDocument(el) {
		var node = el;
		while (node != null) {
			if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE)
				return node;
			node = node.parentNode;
		}
		return !el ? document: el.ownerDocument || document;
	}

	function getDeviceScaleFactor() {
		if (typeof getIocm === "function") {
			var iocm = getIocm();
			if ((typeof iocm === "object") && iocm && (typeof iocm.context === "object"))
				return iocm.context.deviceScaleFactor;
		}

		return 1.0;
	}

	function getZoom(view) {
		var v = view || window;
		return !v ? 1.0: ((v.devicePixelRatio || 1.0) / getDeviceScaleFactor());
	}

	(function () {
		if (typeof getIocm !== "function")
			return;
		var iocm = getIocm();
		if ((typeof iocm !== "object") || !iocm)
			return;

		if (iocm.inSandbox())
			return;

		if ((typeof iocmName !== "string") || (iocmName == "") ||
			(typeof window[iocmName] != "object") || (window[iocmName] == null))
			return;

		var getWindowCache = function() {
			return {"zoom": getZoom(window) };
		};

		if ((typeof window[iocmName].prevPrevInvoke != 'function') &&
			(typeof window[iocmName].prevInvoke == 'function')) {
			var getCallbackCache = function(iocm, obj, methodName) {
				var nodeType = obj.nodeType || 0;
				if ((nodeType != 1) && (nodeType != 3) && (nodeType != 8))
					return null;

				var cache = {};
				var empty = true;

				try {
					if (methodName != "#getbounds") {
						cache["#getbounds"] = iocm.getBounds.apply(obj, []);
						empty = false;
					}

					if (methodName.indexOf("GetElementSelectorsJson") != -1) {
						cache["testComplete15_GetContentText"] =
							obj.testComplete15_GetContentText();
						empty = false;
					}
				} catch(e) {
				}

				return empty ? null: cache;
			}
			var wrapRetVal = function(iocm, callData, methodName, retVal) {
				if (!callData || !retVal)
					return retVal;

				var cache = {};
				var empty = true;

				var pushObject = function(objectId) {
					if (!objectId)
						return;
					if (cache[objectId])
						return;
					var obj = iocm.getObjectFromCache(objectId);
					if (!obj)
						return;
					var callbackCache = getCallbackCache(iocm, obj, methodName);
					if (!callbackCache)
						return;
					cache[objectId] = callbackCache;
					empty = false;
				}

				pushObject(callData["objectId"]);

				var params = callData["params"] || [];
				for (var i = 0; i < params.length; i++) {
					var param = params[i] || {};
					pushObject(param["objectId"]);
				}

				if (!empty) {
					retVal["cache"] = cache;
				}
	
				return retVal;
			};
			window[iocmName].prevPrevInvoke = window[iocmName].invoke;
			window[iocmName].invoke = function (callData) {
				var methodName = callData ? (callData['method'] || ''): '';
				if (methodName == "#zoom") {
					return { "retVal": getZoom() };
				}

				var iocm = window[iocmName];
				var initialCallData = JSON.parse(JSON.stringify(callData));

				if ((methodName.indexOf('testComplete') == 0) || 
					(methodName.indexOf('LOCAL_') == 0) || 
					(methodName == 'document') || 
					(methodName == 'activeElement') || 
					(methodName == 'elementFromPoint')) {
					return wrapRetVal(iocm, initialCallData, methodName, iocm.prevInvoke(callData));
				}
				if (methodName == 'isCustomElement') {
					var retVal = iocm.prevInvoke(callData);
					if (retVal && (retVal.retVal === true)) { 
						return wrapRetVal(iocm, initialCallData, methodName, retVal);
					}
				}
				return wrapRetVal(iocm, initialCallData, methodName, iocm.prevPrevInvoke(callData));
			}
		}
		if (typeof window[iocmName].prevCalcMoniker != 'function') {
			window[iocmName].prevCalcMoniker = window[iocmName].calcMoniker;
			window[iocmName].calcMoniker = function fixedCalcMoniker(obj, parentMoniker) {
				var retVal = window[iocmName].prevCalcMoniker(obj, parentMoniker);
				if (retVal != "")
					return retVal;

				var rootDocument = findRootDocument(obj);
				if (!rootDocument || (rootDocument == document))
					return ""; // BUGBUG

				if (!rootDocument.host)
					return ""; // BUGBUG
				
				parentMoniker = fixedCalcMoniker(rootDocument.host);

				if (obj == rootDocument)
					return parentMoniker + ".shadowRoot";

				if ((typeof (obj.id) == "string") && (rootDocument.getElementById(obj.id) == obj))
					return parentMoniker + ".shadowRoot.getElementById(\"" + obj.id + "\")";

				var parentNode = obj.parentNode;
				if ((typeof parentNode != "object") || (parentNode == null))
					return "";

				parentMoniker = fixedCalcMoniker(parentNode);
				if (parentMoniker == "")
					return "";

				for (var i = 0; i < parentNode.childNodes.length; i++) {
					if (parentNode.childNodes[i] == obj)
						return parentMoniker + ".childNodes[" + i + "]";
				}

				return "";
			}
		}
		if (typeof window[iocmName].prevCreateRetVal != 'function') {
			window[iocmName].prevCreateRetVal = window[iocmName].createRetVal;
			window[iocmName].createRetVal = function (value, parentMoniker, getterName) {
				var retVal = window[iocmName].prevCreateRetVal(value, parentMoniker, getterName);
				retVal["window"] = getWindowCache();
				return retVal;
			};
		}
		if (typeof window[iocmName].prevCacheObject != 'function') {
			window[iocmName].prevCacheObject = window[iocmName].cacheObject;
			window[iocmName].cacheObject = function (obj, parentMoniker, getterName, depth) {
				var initialParentMoniker = parentMoniker || "";
				var initialGetterName = getterName || "";

				var iocm = window[iocmName];
				var retVal = iocm.prevCacheObject(obj, parentMoniker, getterName, depth);
				if ((typeof retVal != "object") || !retVal)
					return retVal;
				if ((typeof retVal["cache"] != "object") || !retVal["cache"]) {
					retVal["cache"] = {};
				}

				var ctor = retVal["cache"]["$ctor"];
				if (ctor == "Array") {
					retVal["cache"]["length"] = obj.length;
					return retVal;
				// } else if (ctor == "HTMLDocument") {
				// 	retVal["cache"]["title"] = obj.title;
				}

				parentMoniker = initialParentMoniker;
				getterName = initialGetterName;

				if ((getterName.indexOf("activeElement") != -1) ||
					(getterName.indexOf("elementFromPoint") != -1) ||
					(parentMoniker.indexOf("getMappingContainers") != -1)) {

					var nodeType = retVal["cache"]["nodeType"];
					if ((nodeType != 1 /* Element */) && (nodeType != 3 /* TextNode */) && (nodeType != 8 /* Comment */))
						return retVal;

					retVal["cache"]["#getbounds"] = iocm.getBounds.apply(obj, []);

					retVal["cache"]["#has,\"disabled\""] = 1;
					var disabled = ((obj["disabled"] || obj.getAttribute("disabled") || "false") + "").toLowerCase();
					disabled = (disabled == "yes") || (disabled == "on") || (disabled == "true") ||
						(disabled == "disabled") || (disabled == "");
					retVal["cache"]["disabled"] = disabled;

					var rootNode = (typeof obj.getRootNode == "function") ? obj.getRootNode(): null;
					retVal["cache"]["getRootNode"] = iocm.cacheObject(rootNode, parentMoniker, "getRootNode()", depth + 1);

					retVal["cache"]["#has,\"value\""] = iocm.hasProperty.apply(obj, ["value", iocm]);
					retVal["cache"]["#has,\"type\""] = iocm.hasProperty.apply(obj, ["type", iocm]);
					var typeValue = obj["type"];
					if (typeValue !== null && typeValue !== undefined) {
						retVal["cache"]["type"] = iocm.encodeParam(typeValue, parentMoniker, "type", depth + 1);
					}

					var shadowRoot = obj.shadowRoot;
					if (shadowRoot === null || shadowRoot === undefined) {
						retVal["cache"]["shadowRoot"] = iocm.cacheObject(null, parentMoniker, "shadowRoot", depth + 1);
					}
				}

				return retVal;
			}
		}
		window[iocmName].persistentIdValue = Math.round(((new Date()).getTime() % 86400000) * 24.85484713139894);
		
		document.addEventListener("mouseover", window[iocmName].documentMouseOver);
		
		new MutationObserver(function(mutations) {
			if (typeof getIocm === "function") {
				var iocm = getIocm();
				if ((typeof iocm === "object") && iocm) {
					if (!iocm.lastMouseOverTime || (Date.now() - iocm.lastMouseOverTime) > 500)
						return;
					for (var i = 0; mutations && i < mutations.length; i++) {
						var mutationTarget = mutations[i].target;
						// MS Dynamics CRM lookup control
						if (mutationTarget.nodeName.toLowerCase() == "li") {
							for (var j = 0; j < mutations[i].addedNodes.length; j++) {
								var addedNode = mutations[i].addedNodes[j];
								if (addedNode.nodeName.toLowerCase() == "button") {
									var addedNodeId = addedNode.id;
									if (addedNodeId && addedNodeId.indexOf("LookupResultsDropdown") > 0 && addedNodeId.indexOf("_selected_tag_delete_") > 0) {
										var eventTarget = mutationTarget;
										for (var k = 0; k < 5; k++) {
											eventTarget = eventTarget.parentElement;
											if (!eventTarget)
												break;
											if (eventTarget.nodeName.toLowerCase() == "div" && eventTarget.hasAttribute("data-lp-id")) {
												var cachedObj = iocm.cacheObject(eventTarget);
												if (cachedObj && cachedObj.objectId)
													iocm.context.customEvent("HoverMouse", JSON.stringify({ objectId: cachedObj.objectId.toString() }));
												break;
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}).observe(
			document.documentElement, 
			{ attributes: false, characterData: false, childList: true, subtree: true }
		);
	}) ();
 
	function ObjectAssign(target) {
		if (target === undefined || target === null) {
			throw new TypeError('Cannot convert first argument to object');
		}
	
		var to = Object(target);
		for (var i = 1; i < arguments.length; i++) {
			var nextSource = arguments[i];
			if (nextSource === undefined || nextSource === null) {
				continue;
			}
	
			var keysArray = Object.keys(Object(nextSource));
			for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
				var nextKey = keysArray[nextIndex];
				var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
				if (desc !== undefined && desc.enumerable) {
					to[nextKey] = nextSource[nextKey];
				}
			}
		}
		return to;
	}

	function ObjectValues(o) {
		if (typeof Object.values === "function") {
			return Object.values(o);
		}
		return ArrayReduce(Object.keys(o), function(v, k) {
			return v.concat(typeof k === 'string' && !!o[k] ? [o[k]]: []);
		}, []);
	}

	function ObjectEntries(o) {
		if (typeof Object.entries === "function") {
			return Object.entries(o);
		}
		return ArrayReduce(Object.keys(o), function(v, k) {
			return v.concat(typeof k === 'string' && !!o[k] ? [[k, o[k]]]: []);
		}, []);
	}

	function StringStartsWith(str, value) {
		if (str.startsWith)
			return str.startsWith(value);
		return str.indexOf(value) == 0;
	}

	function ArrayPush(thisArg, value) {
		if (!!thisArg.push) {
			return thisArg.push(value);
		}

		thisArg[thisArg.length] = value;
		return thisArg.length;
	}

	function ArrayShift(thisArg) {
		if (!!thisArg.shift) {
			return thisArg.shift();
		}

		if (!thisArg.length)
			return;
		return thisArg.splice(0, 1)[0];
	}

	function ArrayUnshift(thisArg, value) {
		if (!!thisArg.unshift) {
			return thisArg.unshift(value);
		}

		thisArg.splice(0, 0, value);
		return thisArg.length;
	}

	function ArrayFrom(thisArg) {
		if (!!thisArg.from) {
			return Array.from(thisArg);
		}

		var toStr = Object.prototype.toString;
		var isCallable = function (fn) {
			return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
		};
		var toInteger = function (value) {
			var number = Number(value);
			if (isNaN(number)) { return 0; }
			if (number === 0 || !isFinite(number)) { return number; }
			return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
		};
		var maxSafeInteger = Math.pow(2, 53) - 1;
		var toLength = function (value) {
			var len = toInteger(value);
			return Math.min(Math.max(len, 0), maxSafeInteger);
		};

		return (function (arrayLike) {
			var items = Object(arrayLike);
			if (arrayLike == null) {
				throw new TypeError("Array.from requires an array-like object - not null or undefined");
			}
			var len = toLength(items.length);
			var A = new Array(len);
			var kValue;
			if (len === 0 && isCallable(items.next)) {
				while(true) {
					kValue = items.next();
					if (kValue.done) break;
					ArrayPush(A, kValue.value);
				}
			} else {
				var k = 0;
				while (k < len) {
					kValue = items[k];
					A[k] = kValue;
					k += 1;
				}
				A.length = len;
			}
			return A;
		})(thisArg);
	}

	function ArrayFilter(thisArg, func) {
		if (!!thisArg.filter){
			return thisArg.filter(func);
		}

		return (function(func, thisArg) {
			if (! ((typeof func === 'Function' || typeof func === 'function') && this) )
				throw new TypeError();
			 
			var len = this.length >>> 0,
				res = new Array(len),
				t = this, c = 0, i = -1;
		  
			var kValue;
			if (thisArg === undefined) {
				while (++i !== len) {
					if (i in this) {
						kValue = t[i]; 
						if (func(t[i], i, t)){
							res[c++] = kValue;
						}
					}
				}
			}
			else {
				while (++i !== len) {
					if (i in this) {
						kValue = t[i];
						if (func.call(thisArg, t[i], i, t)) {
							res[c++] = kValue;
						}
					}
				}
			}
			
			res.length = c; 
			return res;
		}).apply(thisArg, [func, thisArg]);
	}

	function ArrayMap(thisArg, callback, callbackThis) {
		if (!!thisArg.map) {
			return thisArg.map(callback, callbackThis);
		}

		return (function() {
			var A, k;
		
			var O = Object(thisArg);
			var len = O.length >>> 0;
		
			A = new Array(len);
			k = 0;
			while (k < len) {
			  var kValue, mappedValue;
			  if (k in O) {
				kValue = O[k];
				mappedValue = callback.call(callbackThis, kValue, k, O);
				A[k] = mappedValue;
			  }
			  k++;
			}
			return A;
		}) ();
	}

	function ArrayReduce(thisArg, callback, initialValue) {
		if (!!thisArg.reduce) {
			return thisArg.reduce(callback, initialValue);
		}

		return (function(callback, initialValue) {
			if (this === null) {
				throw new TypeError('Array.prototype.reduce called on null or undefined' );
			}
			if (typeof callback !== 'function') {
				throw new TypeError(callback + ' is not a function');
			}
	  
			var o = Object(this);
			var len = o.length >>> 0; 
			var k = 0; 
			var value;
	  
			if (arguments.length >= 2) {
			  value = arguments[1];
			} else {
				while (k < len && !(k in o)) {
					k++; 
				}
		
				if (k >= len) {
					return initialValue;
				}
				value = o[k++];
			}
	  
			while (k < len) {
				if (k in o) {
					value = callback(value, o[k], k, o);
				}
				k++;
			}
			return value;
		}).apply(thisArg, [callback, initialValue]);
	}

	function ArraySort(thisArg, callback) {
		if (!!thisArg.sort) {
			return thisArg.sort(callback);
		}

		return (function(compareFn) {

			if (!compareFn) {
				compareFn = function (l, r) { return l - r; };
			}
			return mergeSort(this);

			function mergeSort(arr) {
				if (arr.length === 1) {
					return arr
				}
				var middle = Math.floor(arr.length / 2);
				var left = arr.slice(0, middle);
				var right = arr.slice(middle);
				return merge(
					mergeSort(left),
					mergeSort(right)
				);
			}

			function merge(left, right) {
				var result = [];
				var indexLeft = 0;
				var indexRight = 0;
				while (indexLeft < left.length && indexRight < right.length) {
					var _left = left[indexLeft];
					var _right = right[indexRight];
					if (composeCompareFn(compareFn(_left, _right))) {
						ArrayPush(result, left[indexLeft]);
						indexLeft++;
					} else {
						ArrayPush(result, right[indexRight]);
						indexRight++;
					}
				}        
				return result.concat(left.slice(indexLeft)).concat(right.slice(indexRight));
			}    
			
			function composeCompareFn(compareResult) {
				if (compareResult <= 0)
					return false;
				return true;
			}
		}).apply(thisArg, [callback]);
	}

	function ArrayForEach(thisArg, callback, callbackThisArg) {
		if (!!thisArg.forEach) {
			return thisArg.forEach(callback, callbackThisArg);
		}

		for (var i = 0; i < thisArg.length; i++)
			callback.call(callbackThisArg, thisArg[i], i, thisArg);
		return thisArg;
	}

	function ArrayFind(thisArg, callback, callbackThis) {
		if (!!thisArg.find) {
			return thisArg.find(callback, callbackThis || thisArg);
		}

		for (var i = 0; i < thisArg.length; i++) {
			var element = thisArg[i];
			if (callback.call(callbackThis || thisArg, element, i, thisArg)) {
				return element;
			}
		}
	}

	function cssesc(string, options) {
		var merge = function (options, defaults) {
			var object = {};
			var hasOwnProperty = object.hasOwnProperty;
			if (!options) {
				return defaults;
			}
			var result = {};
			for (var key in defaults) {
				result[key] = hasOwnProperty.call(options, key)
					? options[key]
					: defaults[key];
			}
			return result;
		};
		options = merge(options, cssesc.options);
		if (options.quotes != 'single' && options.quotes != 'double') {
			options.quotes = 'single';
		}
		var quote = options.quotes == 'double' ? '"' : '\'';
		var isIdentifier = options.isIdentifier;

		var firstChar = string.charAt(0);
		var output = '';
		var counter = 0;
		var length = string.length;
		while (counter < length) {
			var character = string.charAt(counter++);
			var codePoint = character.charCodeAt();
			var value;
			if (codePoint < 0x20 || codePoint > 0x7E) {
				if (codePoint >= 0xD800 && codePoint <= 0xDBFF && counter < length) {
					var extra = string.charCodeAt(counter++);
					if ((extra & 0xFC00) == 0xDC00) { // next character is low surrogate
						codePoint = ((codePoint & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000;
					} else {
						counter--;
					}
				}
				value = '\\' + codePoint.toString(16).toUpperCase() + ' ';
			} else {
				if (options.escapeEverything) {
					if (options.regexAnySingleEscape.test(character)) {
						value = '\\' + character;
					} else {
						value = '\\' + codePoint.toString(16).toUpperCase() + ' ';
					}
				} else if (/[\t\n\f\r\x0B:]/.test(character)) {
					if (!isIdentifier && character == ':') {
						value = character;
					} else {
						value = '\\' + codePoint.toString(16).toUpperCase() + ' ';
					}
				} else if (
					character == '\\' ||
					(
						!isIdentifier &&
						(
							(character == '"' && quote == character) ||
							(character == '\'' && quote == character)
						)
					) ||
					(isIdentifier && options.regexSingleEscape.test(character))
				) {
					value = '\\' + character;
				} else {
					value = character;
				}
			}
			output += value;
		}

		if (isIdentifier) {
			if (/^_/.test(output)) {
				output = '\\_' + output.slice(1);
			} else if (/^-[-\d]/.test(output)) {
				output = '\\-' + output.slice(1);
			} else if (/\d/.test(firstChar)) {
				output = '\\3' + firstChar + ' ' + output.slice(1);
			}
		}
		output = output.replace(options.regexExcessiveSpaces, function ($0, $1, $2) {
			if ($1 && $1.length % 2) {
				return $0;
			}
			return ($1 || '') + $2;
		});

		if (!isIdentifier && options.wrap) {
			return quote + output + quote;
		}
		return output;
	};

	// Expose default options (so they can be overridden globally).
	cssesc.options = {
		'escapeEverything': false,
		'isIdentifier': false,
		'quotes': 'single',
		'wrap': false,
		'regexAnySingleEscape': /[ -,\./;-@\[-\^`\{-~]/,
		'regexSingleEscape': /[ !#-&\(-,\./;-@\[\]\^`\{-~]/,
		'regexExcessiveSpaces': /(^|\\+)?(\\[A-F0-9]{1,6})\x20(?![a-fA-F0-9\x20])/g,
	};

	function NodeListFromArray(array)  {
		if (array === null || array === undefined)
			return null;

		function NodeListItem(index) {
			if (this === null || this === undefined)
				return undefined;

			return this[index];
		}

		array.item = NodeListItem;
		return array;
	}

	function LocatorBuilder(element, frameDocument) {
		/* This function contains modified source code from 
		   selenium-ide (https://github.com/SeleniumHQ/selenium-ide) */
		this.element = element;
		this.rootDocument = !!frameDocument ? frameDocument: findRootDocument(element);
		this.shortStringLength = 64;
		this.hugeStringLength = 256;
		this.lastChance = false;
		this.useCss = (typeof this.rootDocument.evaluate !== "function") &&
			(typeof this.rootDocument.querySelector === "function");
	}

	LocatorBuilder.selectorGenerationTimeout = 100;

	function CssLocatorBuilder(element, rootDocument, options) {
		this.element = element;
		this.rootDocument = rootDocument;
		options = options || {};
		var filterValues = true;
		var minDepth = options.minDepth || 2;
		var maxDepth = options.maxDepth || 3;
		var leafAttrs = options.leafAttrs;
		var justMatch = options.justMatch;
		var noIndex = options.noIndex;

		var timeout = LocatorBuilder.selectorGenerationTimeout;
		var startedAt = new Date();
		var abortException = "{5CD57FB2-723E-4F66-8F38-BA7C73346FB0}";
		function getExpired() {
			var effectiveTimeout = timeout > 0 ? timeout: LocatorBuilder.selectorGenerationTimeout / 2;
			return getTimeoutExpired(startedAt, effectiveTimeout);
		}

		var __assign = (this && this.__assign) || function () {
			__assign = Object.assign || function (t) {
				for (var s, i = 1, n = arguments.length; i < n; i++) {
					s = arguments[i];
					for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
						t[p] = s[p];
				}
				return t;
			};
			return __assign.apply(this, arguments);
		};
		var __generator = (this && this.__generator) || function (thisArg, body) {
			var _ = { label: 0, sent: function () { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
			return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
			function verb(n) { return function (v) { return step([n, v]); }; }
			function step(op) {
				if (getExpired()) throw new TypeError(abortException);
				if (f) throw new TypeError("Generator is already executing.");
				while (_) try {
					if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
					if (y = 0, t) op = [op[0] & 2, t.value];
					switch (op[0]) {
						case 0: case 1: t = op; break;
						case 4: _.label++; return { value: op[1], done: false };
						case 5: _.label++; y = op[1]; op = [0]; continue;
						case 7: op = _.ops.pop(); _.trys.pop(); continue;
						default:
							if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
							if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
							if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
							if (t && _.label < t[2]) { _.label = t[2]; ArrayPush(_.ops, op); break; }
							if (t[2]) _.ops.pop();
							_.trys.pop(); continue;
					}
					op = body.call(thisArg, _);
				} catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
				if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
			}
		};
		var __spreadArrays = (this && this.__spreadArrays) || function () {
			for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
			for (var r = Array(s), k = 0, i = 0; i < il; i++)
				for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++ , k++)
					r[k] = a[j];
			return r;
		};
		var __values = (this && this.__values) || function (o) {
			var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
			if (m) return m.call(o);
			if (o && typeof o.length === "number") return {
				next: function () {
					if (o && i >= o.length) o = void 0;
					return { value: o && o[i++], done: !o };
				}
			};
			if (o && typeof o.next === "function") return o;
			throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
		};
		var config;
		function default_1(input, options) {
			if (input.nodeType !== Node.ELEMENT_NODE) {
				throw new Error("Can't generate CSS selector for non-element node type.");
			}
			if ('html' === input.tagName.toLowerCase()) {
				return 'html';
			}
			var defaults = {
				root: rootDocument.body || rootDocument,
				idName: function (name) { return filterValues ? idIsStatic(name): true; },
				className: function (name) { return filterValues ? classNameIsStatic(name): true; },
				tagName: function (name) { return true; },
				attr: function (name, value, input) {
					if (!attrIsApplicable(name))
						return false;
					if ((input === element) && (name == "name"))
						return false;
					return filterValues ? attrIsStatic(name, value): !!value; 
				},
				seedMinLength: minDepth,
				optimizedMinLength: maxDepth + 1,
			};
			config = __assign(__assign({}, defaults), options);
			var path;
			try {
				path = bottomUpSearch(input);
			} catch(e) {
			}
			if (path) {
				try {
					var optimized = sort(optimize(path, input));
					if (optimized && optimized.length) {
						path = optimized[0];
					}
				} catch(e) {
				}
				return path;
			}
			else {
				throw new Error("Selector was not found.");
			}
		}
		function bottomUpSearch(input) {
			var path = null;
			var stack = [];
			var current = input;
			var i = 0;
			var dirty = false;
			var _loop_1 = function () {
				var level = [];
				if (element !== current) {
					level = level.concat(id(current));
				} else if (!leafAttrs || !leafAttrs.length) {
					level = level.concat(tagName(current));
				} 
				level = level.concat(attr(current)).concat(classNames(current));
				if (element !== current) {
					level = level.concat(tagName(current));
				}
				if (level.length) {
					if (!noIndex && ((element !== current) || !leafAttrs || !leafAttrs.length)) { 
						var nth = index(current);
						if (nth) {
							level = level.concat(ArrayMap(ArrayFilter(level, requiredNth), function (node) { return nthChild(node, nth); }));
						}
					}

					for (var _i = 0, level_1 = level; _i < level_1.length; _i++) {
						var node = level_1[_i];
						node.level = i;
						node.input = current;
					}

					ArrayPush(stack, level);
					dirty = true;

					if (stack.length >= config.seedMinLength) {
						path = findUniquePath(stack);
						dirty = false;
						if (path) {
							return "break";
						}
					}
				}

				current = current.parentElement;
				i++;
			};
			while (current && current !== config.root.parentElement) {
				var state_1 = _loop_1();
				if (state_1 === "break")
					break;
				if (getExpired()) return null;
			}
			if (!path && dirty) {
				path = findUniquePath(stack);
			}
			return path;
		}
		function findUniquePath(stack) {
			var combinationsCount = 0;
			var effectiveStack = stack;
			var propagateChanges = false;
			while (true) {
				var effectiveCount = ArrayReduce(effectiveStack, function(acc, level) {
					return acc * ((level && level.length) ? level.length: 1);
				}, 1);

				if ((effectiveCount < 300) || (effectiveCount == combinationsCount)) {
					break;
				}

				effectiveStack = ArrayMap(effectiveStack, function(level) {
					if (level.length <= 2)
						return level;
					var nth = -1;
					for (var i = 0; i < level.length; i++) {
						if (level[i].nth) {
							nth = i;
							break;
						}
					}
					if (nth != -1) {
						var top = level.slice(0, 1), bottom = [];
						if (nth > 2)
							top = top.concat(level.slice(1, nth - 1));
						if (nth < level.length - 1)
							bottom = level.slice(nth, level.length - 1);
						return top.concat(bottom);
					}
					return level.slice(0, level.length - 1);
				});
				combinationsCount = effectiveCount;
				propagateChanges = true;
			}
			if (propagateChanges) {
				ArrayForEach(effectiveStack, function(level, i) {
					stack[i] = level;
				});
			}

			var paths = sort(combinations(stack));
			if (getExpired()) return;

			for (var _i = 0, paths_1 = paths; _i < paths_1.length; _i++) {
				var candidate = paths_1[_i];
				if (unique(candidate)) {
					return candidate;
				}
				if (getExpired()) return;
			}
			return null;
		}
		function selector(path) {
			var node = path[0];
			var query = node.name;
			for (var i = 1; i < path.length; i++) {
				var level = path[i].level || 0;
				if (node.level === level - 1) {
					query = path[i].name + " > " + query;
				}
				else {
					query = path[i].name + " " + query;
				}
				node = path[i];
			}
			return query;
		}
		function penalty(path) {
			return ArrayReduce(ArrayMap(path, function (node) { return node.penalty; }), function (acc, i) { return acc + i; }, 0);
		}
		function unique(path) {
			var result = rootDocument.querySelectorAll(selector(path));
			switch (result.length) {
				case 0:
					throw new Error("Can't select any node with this selector: " + selector(path));
				case 1:
					return result[0];
				default:
					return !justMatch ? false: (result[0] !== element ? false: result[0]);
			}
		}
		function id(input) {
			var elementId = input.getAttribute('id');
			if (elementId && config.idName(elementId)) {
				return [{
					name: '#' + cssesc(elementId, { isIdentifier: true }),
					penalty: 0,
				}];
			}
			return [];
		}
		function attr(input) {
			var attrs;
			if ((input === element) && leafAttrs && leafAttrs.length) {
				attrs = leafAttrs;
			}
			if (!attrs) {
				var hrefBasedAttrs = ['src', 'href', 'action'];
				var attrList = ArrayFilter(ArrayFrom(input.attributes), function (attr) { 
					return config.attr(attr.name, attr.value, input); 
				});
				attrs = [];
				ArrayForEach(attrList, function(attr) {
					if (hrefBasedAttrs.indexOf(attr.name) != -1) {
						var href = attr.value;
						if (!href) return;
						var purified = purifyHref(href);
						var hrefs = combineHrefGrowth(href).concat(purified ? [purified]: []);
						ArrayForEach(hrefs, function(item) {
							ArrayPush(attrs, {'name': attr.name, 'value': item, 'contains': item != href });
						});
						if (purified && (href == purified)) return;
					}
					ArrayPush(attrs, {'name': attr.name, 'value': attr.value, 'contains': false });
				});
			}
			return ArrayMap(attrs, function (attr) {
				if (attr.name != "class") {
					return ({
						name: '[' + cssesc(attr.name, { isIdentifier: true }) + 
							(attr.contains ? '*=': '=') + '\'' + cssesc(attr.value) + '\']',
						penalty: 0.5
					});
				}
				return ({
					name: '.' + cssesc(attr.value, { isIdentifier: true }),
					penalty: 1
				});
			});
		}
		function classNames(input) {
			var names = ArrayFilter(ArrayFrom(input.classList), config.className);
			return ArrayMap(names, function (name) {
				return ({
					name: '.' + cssesc(name, { isIdentifier: true }),
					penalty: 1
				});
			});
		}
		function tagName(input) {
			var name = input.tagName.toLowerCase();
			if (config.tagName(name)) {
				return [{
					name: name,
					penalty: (element === input ? 0: 2)
				}];
			}
			return [];
		}
		function any() {
			return [{
				name: '*',
				penalty: 3
			}];
		}
		function index(input) {
			var parent = input.parentNode;
			if (!parent) {
				return null;
			}
			var child = parent.firstChild;
			if (!child) {
				return null;
			}
			var i = 0;
			while (child) {
				if (child.nodeType === Node.ELEMENT_NODE) {
					i++;
				}
				if (child === input) {
					break;
				}
				child = child.nextSibling;
			}
			return i;
		}
		function nthChild(node, i) {
			return {
				name: node.name + (":nth-child(" + i + ")"),
				penalty: node.penalty + 1,
				nth: true
			};
		}
		function requiredNth(node) {
			return node.name !== 'html' && ((node.name === '') || (node.name.charAt(0) !== '#'));
		}
		function notEmpty(value) {
			return value !== null && value !== undefined;
		}
		function combinations(stack, path) {
			var _i, _a, node;
			if (path === void 0) { path = []; }
			return __generator(this, function (_b) {
				switch (_b.label) {
					case 0:
						if (!(stack.length > 0)) return [3 /*break*/, 5];
						_i = 0, _a = stack[0];
						_b.label = 1;
					case 1:
						if (!(_i < _a.length)) return [3 /*break*/, 4];
						node = _a[_i];
						return [5 /*yield**/, __values(combinations(stack.slice(1, stack.length), path.concat(node)))];
					case 2:
						_b.sent();
						_b.label = 3;
					case 3:
						_i++;
						return [3 /*break*/, 1];
					case 4: return [3 /*break*/, 7];
					case 5: return [4 /*yield*/, path];
					case 6:
						_b.sent();
						_b.label = 7;
					case 7: return [2 /*return*/];
				}
			});
		}
		function sort(paths) {
			return ArraySort(ArrayFrom(paths), function (a, b) { return penalty(a) - penalty(b); });
		}
		function optimize(path, input) {
			var i, newPath;
			return __generator(this, function (_a) {
				switch (_a.label) {
					case 0:
						if (!(path.length > 2 && path.length > config.optimizedMinLength)) return [3 /*break*/, 5];
						i = 1;
						_a.label = 1;
					case 1:
						if (!(i < path.length - 1)) return [3 /*break*/, 5];
						newPath = __spreadArrays(path);
						newPath.splice(i, 1);
						if (unique(newPath) !== input) return [3 /*break*/, 4];
						return [4 /*yield*/, newPath];
					case 2:
						_a.sent();
						return [5 /*yield**/, __values(optimize(newPath, input))];
					case 3:
						_a.sent();
						_a.label = 4;
					case 4:
						i++;
						return [3 /*break*/, 1];
					case 5: return [2 /*return*/];
				}
			});
		}

		this.path = default_1(element);
	}

	CssLocatorBuilder.prototype.getSelector = function () {
		var path = this.path || [];
		if (path.length == 0) {
			return "";
		}
		var node = path[0];
		var query = node.name;
		for (var i = 1; i < path.length; i++) {
			var level = path[i].level || 0;
			if (node.level === level - 1) {
				query = path[i].name + " > " + query;
			}
			else {
				query = path[i].name + " " + query;
			}
			node = path[i];
		}
		return query;
	}

	CssLocatorBuilder.prototype.getContainers = function () {
		var path = this.path || [];
		var nodes = [];
		for (var i = 0; i < path.length; i++) {
			var node = path[i];
			if (node.input && (node.input != this.element)) {
				ArrayPush(nodes, node.input);
			}
		}
		return nodes;
	}

	this.Element.prototype.testComplete15_GetContentText = safeCall(function () {
		return TestCompleteWebTestingHelpers.getContentText(this);
	});

	this.Element.prototype.testComplete15_GetAttributeNames = safeCall(function () {
		if (this === null || this === undefined)
			return '';

		var attributes = this.attributes;
		var length = attributes.length;
		var result = new Array(length);
		for (var i = 0; i < length; i++) {
			result[i] = attributes[i].name;
		}
		return ArraySort(result).toString();
	});

	this.Element.prototype.testComplete15_GetDataSetKeys = safeCall(function () {
		if (this === null || this === undefined)
			return '';

		return Object.keys(this.dataset).toString();
	});

	function calcEntropy(str) {
		var len = str.length
		var freq = ArrayReduce(ArrayFrom(str), function(f, c) {
			  return (f[c] = (f[c] || 0) + 1) && f;
		}, {});
		return ArrayReduce(ObjectValues(freq), function(sum, f) {
			return sum - f/len * Math.log(f/len) * Math.LOG2E;
		}, 0);
	}
	
	function highEntropy(str) {
		return calcEntropy(str) >= 4.2;
	}

	var g_idIsStatic_Expr = [
		/^yui-gen(.*)/i,
		/^(.*)yui_3_(.*)/i,
		/^ui-id-(.*)/i,
		/^dijit_(.*)/i,
		/[0-9a-fA-F]{8}[-_][0-9a-fA-F]{4}[-_][0-9a-fA-F]{4}[-_][0-9a-fA-F]{4}[-_][0-9a-fA-F]{12}/i,
		/^[A-Za-z](\d\d\d\d\d+)([A-Za-z-]*)$/i,
		/^([A-Za-z-]+)(\d\d\d\d\d+)$/i,
		/^([A-Za-z_]+)_(\d\d\d\d\d+)([A-Za-z_]*)$/i,
		/^([A-Za-z_]+)(\d\d\d\d\d+)([A-Za-z_]*)$/i,
		/^(.*[-_$])?(ctl[0-9]+)$/i,
		/^(.*-)?ext-gen/i,
		/^(.*-)?ext-comp/i,
		/^extdd-(.*)$/i,
		/^([A-Za-z-]+)-(\d\d\d\d+)(.*)$/i,
		/^ext-(.*)-\d+$/i,
		/^(_t)([0-9]+)$/i,
		/^(j_idt?)([0-9]+)$/i,
		/(.+):([^0-9]+)$/i,
		/(.+):(.*)/i,
		/^(gwt-uid-[0-9]+)(_(.*))?$/i,
		/^(x-((widget)|(auto))-.*[0-9]+)([-_](.*))?$/i,
		/^([A-Za-z-]+)([_0-9a-f]{15,})$/i,
		/^checkbox-[0-9\-]+$/i,
		/^input-[0-9\-]+$/i,
		/^id[_0-9\-]+$/i,
	];

	var idIsStaticGeneral = function(name) {
		if (typeof name !== "string" || name === "") {
			return false;
		}
		try {
			var basicFilters = [/(\d\d\d\d+)/, 
				/^[0-9a-z]{6,6}-[0-9a-z]{6,6}-[0-9a-z]{6,6}-[0-9a-z]{6,6}$/,
				/[ !#-&\(-,/:;-@\[\]\^`\{-~]/,
			];
			for (var i = 0; i < basicFilters.length; i++) {
				if (basicFilters[i].test(name)) {
					logMessage('RegExpr: ' + basicFilters[i] + ' treats "' + name + '" as dynamic');
					return false;
				}
			}

			for (var i = 0; i < g_idIsStatic_Expr.length; i++) {
				var expr = g_idIsStatic_Expr[i];
				if (expr.test(name) === true) {
					logMessage('RegExpr: ' + expr + ' treats "' + name + '" as dynamic');
					return false;
				}
			}

			if (highEntropy(name)) {
				logMessage('Treat "' + name + '" as high entropy');
				return false;
			}
		} catch (e) {

		}
		return true;
	};

	var idIsStaticWithoutDigits = function(name) {
		if (typeof name !== "string" || name === "") {
			return false;
		}
		if (/\d/.test(name)) {
			return false;
		}
		return idIsStaticGeneral(name);
	}; 

	var suppressDigitsInId = (function() {
		try {
			var href = document.location.href.toLowerCase();
			return href.indexOf("crm.dynamics.com") != -1;
		} catch (e) {
		}
		return false;
	}) ();

	var idIsStatic = !suppressDigitsInId ? idIsStaticGeneral: idIsStaticWithoutDigits;

	function classNameIsStatic(name) {
		if (typeof name !== "string" || name === "") {
			return false;
		}
		try {
			var reHoverClass = /(on)?(hover|hovered|over|active|current|focus|focused|focusin|selected)([^a-z0-9]|$)/i;
			if (reHoverClass.test(name) === true) {
				return false;
			}
		} catch (e) {

		}
		return true;
	}

	function roleIsStatic(name) {
		if (typeof name !== "string" || name === "") {
			return false;
		}
		return name.toLowerCase() != "presentation";
	}

	function hrefIsInvalid(href) {
		return StringStartsWith((href || "").toLowerCase().trim(), "javascript:void(0)");
	}

	var c_hrefDomain_Limit = 16;
	var c_hrefParameter_Limit = 16;
	var c_hrefAlias_Limit = 32;

	function hasHrefAttribute(el, attrName) {
		if (!el || !el.hasAttribute) {
			return false;
		}
		attrName = attrName || "href";
		if (!el.hasAttribute(attrName)) {
			return false;
		}
		var href = (el.getAttribute ? el.getAttribute(attrName): null) || "";
		return !hrefIsInvalid(href);
	}

	function getHrefAttribute(el, attrName) {
		attrName = attrName || "href";
		if (!hasHrefAttribute(el, attrName)) {
			return "";
		}
		return (el.getAttribute ? el.getAttribute(attrName): null) || "";
	}

	function hrefHasDynamicParams(href) {
		if (!href || (href == ""))
			return false;

		var index = href.indexOf("?");
		if (index != -1) {
			var params = (href.slice(index + 1) || "").split("&");
			for (var i = 0; i < params.length; i++) {
				var item = params[i].split("=");
				for (var p = 0; p < item.length; p++) {
					var param = item[p];
					if ((param.length > c_hrefParameter_Limit) || !idIsStatic(param)) {
						return true;
					}
				}
			}
		}

		return false;
	}

	function hrefIsStatic(href) {
		if ((typeof href != "string") || 
			(href === "")) {
			return false;
		}

		if (hrefIsInvalid(href)) {
			return false;
		}
		
		if (href.indexOf('%') != -1)
			return false;

		if (hrefHasDynamicParams(href))
			return false;

		var index = href.indexOf("?");
		if (index != -1) {
			href = href.slice(0, index);
		}

		var parts = href.split('/');
		for (var i = 0; i < parts.length; i++) {
			var part = parts[i];
			if (!part || (part == ""))
				continue;
			var domains = part.split('.');
			if (domains.length > 0) {
				for (var d = 0; d < domains.length; d++) {
					var domain = domains[d];
					if (!domain || (domain == ""))
						continue;
					if ((domain.length > c_hrefDomain_Limit) || !idIsStatic(domain))
						return false;
				}
				continue;
			}
			if ((part.length > c_hrefAlias_Limit) || !idIsStatic(part))
				return false;
		}

		return true;
	}

	function purifyHref(href) {
		if ((typeof href != "string") || 
			(href === "") || (href == "#")) {
				return null;
		}

		if (hrefIsStatic(href)) {
			return href;
		}

		var index = href.indexOf("?");
		if (index != -1) {
			if ((index > 0) && (index < href.length - 1)) {
				href = href.slice(0, index);
			} else {
				href = href.slice(index, href.length - 1);
			}
		}

		if (hrefIsStatic(href)) {
			return href;
		}

		var splitChar = '/';
		var parts = href.split(splitChar);
		if (parts.length <= 1) {
			splitChar = '\\';
			parts = href.split(splitChar);
		}
		href = "";		
		var protocols = ["http:", "https:", "file:"];
		for (var i = 0; i < parts.length; i++) {
			var part = parts[i];
			if (!part || (part == "")) {
				if (href != "") {
					break;
				}
				continue;
			}
			if ((i == 0) && (protocols.indexOf(part.toLowerCase()) != -1)) {
				continue;
			}
			if (((part.indexOf('.') == -1) && (part.length > c_hrefAlias_Limit)) || 
				!idIsStatic(part) || (part.indexOf('%') != -1) || (part.indexOf('\\') != -1)) {
				if (href != "") {
					break;
				}
				continue;
			}

			if (href != "") href += splitChar;
			href += part;
		}

		return href != "" ? href: null;
	}

	function splitHref(href) {
		if ((typeof href != "string") || 
			(href === "") || (href == "#")) {
			return [];
		}

		var firstSplits = ["?", "#"];
		ArrayForEach(firstSplits, function(s) {
			var index = href.indexOf(s);
			if (index != -1) {
				href = href.slice(0, index);
			}
		});

		var splitChar = href.indexOf('/') != -1 ? '/': '\\';
		return ArrayFilter(ArrayMap(href.split(splitChar), function (part) {
			if (!part || (part == ""))
				return "";
			if (["http:", "https:", "file:"].indexOf(part.toLowerCase()) != -1)
				return "";
			if (!idIsStatic(part) || (part.indexOf('%') != -1))
				return "";
			return part;
		}), function (part) {
			return part && (part.length > 0);
		});
	}

	function combineHrefGrowth(href) {
		if (typeof href !== "string" || !href) return [];
		var growth = [];
		var current = "";
		var parts = splitHref(href);
		var splitChar = href.indexOf('/') != -1 ? '/': '\\';
		for (var i = parts.length; i > 0; i--) {
			if (current) current = splitChar + current;
			current = parts[i - 1] + current;
			if (href.indexOf(current) == -1) current = parts[i - 1];
			if (current) ArrayPush(growth, current);
		}
		return growth;
	}

	function lastHrefPart(href) {
		var parts = combineHrefGrowth(href);
		return parts.length ? parts[0]: "";
	}

	var applicableAttrs = ["name", "type", "value", "src", "href", "action", "alt", "role", "title", "disabled", "checked"];

	function attrIsApplicable(name) {
		if (typeof name !== "string" || name === "")
			return false;
		name = name.toLowerCase();
		if (applicableAttrs.indexOf(name) != -1)
			return true;
		if ((name.indexOf("aria-") == 0) ||
			(name.indexOf("data-") == 0))
			return true;
		return false;
	}

	function attrIsStatic(name, value) {
		if (!name || !value)
			return false;
		name = name.toLowerCase();
		if (name == "href" || name == "src") {
			return hrefIsStatic(value);
		}
		return (value.length <= 32) && idIsStatic(value);
	}

	function applyDynamicIds(dynamicIds) {
		g_idIsStatic_Expr = [];
		var arr = dynamicIds.split('\n');
		for (var i = 0; i < arr.length; i++) {
			try {
				if (arr[i] == "") continue;
				ArrayPush(g_idIsStatic_Expr, new RegExp(arr[i]));
			} catch (e) {

			}
		}
		ArrayPush(g_idIsStatic_Expr, /^([A-Za-z-]+)([_0-9a-f]{15,})$/i); // Lithium
	}

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

	this.Element.prototype.testComplete15_GetElementSelectorsJson = safeCall(function (dynamicIds, selectorsLimit) {
		if (this === null || this === undefined)
			return '';

		if (typeof dynamicIds === "string") {
			applyDynamicIds(dynamicIds);
		}

		var builder = new LocatorBuilder(this);
		var retVal = builder.build((typeof selectorsLimit == "number") ? selectorsLimit: 0);
		return stringifyObjectFull(retVal);
	});

	function element_FindElement(root, frameDocument, selectors) {
		var builder = new LocatorBuilder(root, frameDocument);
		var selectorList = (selectors || "").split("\n");
		for (var i = 0; i < selectorList.length; i++) {
			var selector = selectorList[i];
			var el = builder.findElement(selector);
			if (typeof el === "object" && el != null) {
				el.testComplete15_effectiveSelector = selector;
				return el;
			}
		}
		return null;
	}

	function element_getVisible(el, rootDocument) {
		if (!rootDocument) {
			rootDocument = findRootDocument(el);
			if (!rootDocument) {
				return false;
			}
		}
		var view = rootDocument.defaultView || window;
		var style = {};
		try {
			style = window.getComputedStyle(el) || {};
		} catch(e) {
		}
		return ((style.display || "").toLowerCase() != "none") && 
			((style.visibility || "").toLowerCase() != "hidden");
	}

	function element_getClientRect(el, rootDocument) {
		if (!el) return;
		if (!element_getVisible(el, rootDocument)) return;
		if (typeof el.getClientRects == "function") {
			var rects = el.getClientRects();
			if (!rects) return;
			var rect = { "left": [], "top": [], "right": [], "bottom": [] };
			for (var i = 0; i < rects.length; i++) {
				var r = rects[i];
				ArrayPush(rect.left, r.left);
				ArrayPush(rect.top, r.top);
				ArrayPush(rect.right, r.right);
				ArrayPush(rect.bottom, r.bottom);
			}
			rect.left = Math.min.apply(null, rect.left);
			rect.top = Math.min.apply(null, rect.top);
			rect.right = Math.max.apply(null, rect.right);
			rect.bottom = Math.max.apply(null, rect.bottom);
			return rect;
		}
		
		var rect = { "left": 0, "top": 0, "right": 0, "bottom": 0 };
		rect.left = el.offsetLeft || 0;
		rect.top = el.offsetTop || 0;
		rect.right = rect.left + (el.offsetWidth || 0);
		rect.bottom = rect.top + (el.offsetHeight || 0);
		return rect;
	}

	function element_FindElementsVisibleWithSimilarRect(root, frameDocument, selectors, width, height) {
		var result = [];
		var p1 = "testComplete15_effectiveSelector";
		var p2 = "testComplete15_sortIndex";
		var compareSizes = function (size) {
			if (!width || !height || !size || !size.width || !size.height)
				return false;
			var sf1 = width / height;
			var sf2 = size.width / size.height;
			if (Math.abs(sf1 - sf2) > 0.8) 
				return false;
			var sf = (width > size.width) ? (width / size.width): (size.width / width);
			if ((sf < 0.5) || (sf > 7.5)) 
				return false;
			return true;
		};
		var builder = new LocatorBuilder(root, frameDocument);
		ArrayForEach((selectors || "").split("\n"), function(selector) {
			ArrayForEach(builder.findElements(selector) || [], function(el) {
				var rect = element_getClientRect(el, frameDocument);
				if (!rect) return;
				if (!compareSizes({
					 	"width": (rect.right - rect.left), 
						"height": (rect.bottom - rect.top)
					})) return;
				el[p1] = selector;
				el[p2] = rect.top;
				ArrayPush(result, el);
			});
		});
		return ArraySort(result, function(a, b) {
			return a[p2] - b[p2];
		});
	}

	this.Element.prototype.testComplete15_FindElement = safeCall(function (selectors) {
		if (this === null || this === undefined)
			return null;

		return element_FindElement(this, null, selectors);
	});

	this.Element.prototype.testComplete15_FindElementsVisibleWithSimilarRect = safeCall(function (selectors, width, height) {
		if (this === null || this === undefined)
			return null;

		return element_FindElementsVisibleWithSimilarRect(this, null, selectors, width, height);
	});

	window.testComplete15_FindElement = function (selectors) {
		return element_FindElement(null, window.document, selectors);
	}

	window.testComplete15_FindElementsVisibleWithSimilarRect = function (selectors, width, height) {
		return element_FindElementsVisibleWithSimilarRect(null, window.document, selectors, width, height);
	}

	var g_StaticContainers = [
		"A", "INPUT", "BUTTON", "IMG", "OBJECT", "APPLET", "EMBED", "SELECT", "TEXTAREA",
		"LABEL", "FRAME", "IFRAME", "LEGEND", "FORM", "FIELDSET",
		"ARTICLE", "ASIDE", "DETAILS", "FIGURE", "FOOTER", "HEADER", "NAV", "OUTPUT", "SECTION",
		"SUMMARY", "TIME", "AUDIO", "CANVAS", "METER", "PROGRESS", "VIDEO", "SVG", "MATH", 
		"H1", "H2", "H3", "H4", "H5", "UL", "OL", "LI",
	];

	function simple_getInnerText(node, nodeToOmit, delimeter) {
		var innerTextRes = '';
		if (node.nodeType == 3) {
			innerTextRes += node.nodeValue + delimeter;
		} else {
			var children = node.childNodes;
			for(var i = 0; i < children.length; i++ ) {
				var child = children[i];
				if (child === nodeToOmit)
					continue;
				innerTextRes += simple_getInnerText(child, nodeToOmit, delimeter);
			}
		}
		return innerTextRes;
	}

	function visibleOnly_getInnerText_getFirstLine(node, rootDocument, ignoreNodeVisibility) {
		if (!node) return "";
		if (node.nodeType == 3) {
			return (node.nodeValue || "").trim();
		} else if (node.nodeType == 1) {
			if (!rootDocument) {
				rootDocument = findRootDocument(node);
				if (!rootDocument) {
					return "";
				}
			}
			var hidden = false;
			if (!ignoreNodeVisibility) {
				var view = rootDocument.defaultView || window;
				var style = {};
				try {
					style = window.getComputedStyle(node) || {};
				} catch(e) {
				}
				hidden = ((style.display || "").toLowerCase() == "none") || 
					((style.visibility || "").toLowerCase() == "hidden");
			}
			if (!hidden) {
				var children = node.childNodes;
				for(var i = 0; i < children.length; i++ ) {
					var child = children[i];
					if (child === node)
						continue;
					var line = visibleOnly_getInnerText_getFirstLine(child, rootDocument);
					if (line) return line;
				}
			}
		}
		return "";
	}

	function visibleOnly_getInnerText(node, nodeToOmit, delimeter, rootDocument) {
		var innerTextRes = '';
		if (node.nodeType == 3) {
			innerTextRes += node.nodeValue + delimeter;
		} else if (node.nodeType == 1) {
			if (!rootDocument) {
				rootDocument = findRootDocument(node);
				if (!rootDocument) {
					return innerTextRes;
				}
			}
			var view = rootDocument.defaultView || window;
			var style = {};
			try {
				style = window.getComputedStyle(node) || {};
			} catch(e) {
			}
			var hidden = ((style.display || "").toLowerCase() == "none") || 
				((style.visibility || "").toLowerCase() == "hidden");
			if (!hidden) {
				var children = node.childNodes;
				for(var i = 0; i < children.length; i++ ) {
					var child = children[i];
					if (child === nodeToOmit)
						continue;
					innerTextRes += visibleOnly_getInnerText(child, nodeToOmit, delimeter, rootDocument);
				}
			}
		}
		return innerTextRes;
	}

	function getParentLabelObject(el) {
		var labelObject;
		var parentElement = el.parentElement;
		for (var i = 0; i < 4; i++) {
			if (!parentElement)
				break;
			if ((parentElement.nodeName || "").toLowerCase() == "label") {
				labelObject = parentElement;
				break;
			}
			parentElement = parentElement.parentElement;
		}
		return labelObject;
	}

	function getParentLabelText(el)	{
		var labelObject = getParentLabelObject(el);
		if (!labelObject)
			return [];
		return prepareForSearchLines(labelObject.textContent || labelObject.innerText);
	}

	function getFieldsetLegend(el) {
		var rootDocument = findRootDocument(el);
		if (rootDocument.evaluate) {
			var legendObject = rootDocument.evaluate("legend", el, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
			if (!legendObject)
				return null;
			if (!legendObject.textContent && !legendObject.innerText)
				return null;
			return legendObject;
		}
		return null;
	}

	function getFieldSetLabel(el) {
		var legendObject = getFieldsetLegend(el);
		if (legendObject) {
			var text = simple_getInnerText(legendObject);
			if (text) {
				return text;
			}
		}
		return "";
	}

	function getCustomControlLabel(el) {
		var tagName = (el.tagName || "").toLowerCase();
		if (tagName == "fieldset") {
			var text = getFieldSetLabel(el);
			if (text) {
				return text;
			}
		}

		var auraClass = el["data-aura-class"] || (el.getAttribute && el.getAttribute("data-aura-class"));
		if (["uiMenu"].indexOf(auraClass) != -1) {
			var ariaLinks = [
				//'aria-labelledby',
				'aria-describedby',
			];

			for (var i = 0; i < ariaLinks.length; i++) {
				var links = el.querySelectorAll("[" + ariaLinks[i] + "]");
				if (!links)
					continue;
				for (var j = 0; j < links.length; j++) {
					var link = links[j];
					if (!link)
						continue;
					var labelId = link.getAttribute(ariaLinks[i]);
					if (!labelId) 
						continue;
					var label = document.getElementById(labelId);
					if (!label) 
						continue;
					var text = simple_getInnerText(label, el, '');
					if (text != "")
						return text;
				}
			}
		} 

		var auraClasses = auraClass ? auraClass.split(" ") : [];
		if (auraClasses.indexOf("uiInputDate") != -1) {
			var labelObject = el.querySelector ? el.querySelector("label") : null;
			if (labelObject) {
				var text = simple_getInnerText(labelObject, el, '');
				if (text != "")
					return text;
			}
		}

		var className = el.className || "";
		if (typeof className != "string")
			className = "";

		if (className.indexOf("radio") != -1) {
			var tagName = (el.nodeName || "").toLowerCase();
			if (tagName == "span") {
				var labelValue = getParentLabelText(el);
				for (var i = 0; i < labelValue.length; i++) {
					var labelText = labelValue[i] || "";
					if (labelText.length > 0)
						return labelText;
				}
			}
		} 
		else if (className.indexOf("option") != -1) {
			var dataValue = (el.getAttribute ? el.getAttribute("data-value"): null) || "";
			if (typeof dataValue == "string")
				return dataValue;
		}

		return "";
	}

	function getIsCustomControlContainer(el) {
		var auraClass = el["data-aura-class"] || (el.getAttribute && el.getAttribute("data-aura-class"));
		if (["uiMenu"].indexOf(auraClass) != -1) {
			return true;
		}

		var auraClasses = auraClass ? auraClass.split(" ") : [];
		var auraContainers = ["uiInputDate", "uiDatePicker"];
		for (var i = 0; i < auraContainers.length; i++) {
			if (auraClasses.indexOf(auraContainers[i]) != -1) {
				return true;
			}
		}

		var tagName = (el.tagName || "").toLowerCase();
		if (tagName == "fieldset") {
			if (getFieldSetLabel(el)) {
				return true;
			}
		}
		else if (tagName == "lightning-combobox") {
			return true;
		}
		return false;
	}

	function getIsUnifiedControl(el) {
		var auraClass = el["data-aura-class"] || (el.getAttribute && el.getAttribute("data-aura-class"));
		if (["uiMenu", "uiTooltip", "forceActionLink"].indexOf(auraClass) != -1) {
			return true;
		}

		var auraClasses = auraClass ? auraClass.split(" ") : [];
		var auraControls = ["uiAutocompleteOption", "uiMenuItem"];
		for (var i = 0; i < auraControls.length; i++) {
			if (auraClasses.indexOf(auraControls[i]) != -1) {
				return true;
			}
		}

		var tagName = (el.nodeName || "").toLowerCase();
		if (["button"].indexOf(tagName) != -1) {
			return true;
		}

		return false;
	}

	function getUnifiedControlParent(el) {
		if (!el)
			return null;
		var parentElement = el.parentElement;
		for (var i = 0; i < 5; i++) {
			if (!parentElement)
				break;
			if (getIsUnifiedControl(parentElement))
				return parentElement;
			parentElement = parentElement.parentElement;
		}
		return null;
	}

	function getIsContainer(el) {
		if (!el || !el.getAttribute) {
			return false;
		}

		var className = el.className || "";
		if (className && !classNameIsStatic(className)) {
			return false;
		}

		var role = el.role || el.getAttribute("role") || "";
		if (role && !roleIsStatic(role)) {
			return false;
		}

		if (getIsCustomControlContainer(el)) {
			return true;
		}

		var nodeType = (el.nodeName || "").toUpperCase();
		if (g_StaticContainers.indexOf(nodeType) == -1)  {
			return false;
		}

		return idIsStatic(el.id) || className || role;
	}

	function getMappingContainers(el) {
		if (el === null || el === undefined)
			return null;

		var getParent = function(e) {
			var attrs = [
				'aria-labelledby',
			//	'aria-describedby',
			];
			for (var i = 0; i < attrs.length; i++) {
				var id = e[attrs[i]] || (e.getAttribute && e.getAttribute(attrs[i]));
				if (!id) continue;
				var p = document.getElementById(id);
				if (!!p && (p != e) && !e.contains(p)) {
					return p;
				}
			}
			return e.parentElement;
		}

		var containers = [];
		var container = getParent(el);

		while (container) {
			if (getIsContainer(container)) {
				ArrayUnshift(containers, container);
			}
			container = getParent(container);
		}

		if (containers.length > 3) {
			containers.splice(2, containers.length - 3);
		}

		return NodeListFromArray(containers);
	}

	window.testComplete15_getMappingContainers = function (el) {
		return getMappingContainers(el);
	}

	this.Element.prototype.testComplete15_getMappingContainers = safeCall(function () {
		return getMappingContainers(this);
	});

	this.Element.prototype.testComplete15_evaluateInnerText = safeCall(function () {
		return simple_getInnerText(this, this, '');
	});

	function evaluateLabelText(el) {
		if (el === null || el === undefined)
			return "";

		var ariaLinks = [
			'aria-labelledby',
			'aria-describedby',
		];

		for (var i = 0; i < ariaLinks.length; i++) {
			var ariaAttrName = ariaLinks[i];
			var idValue = el[ariaAttrName] || el.getAttribute(ariaAttrName);
			if (!idValue)
				continue;
			var labelObject = document.getElementById(idValue);
			if (!labelObject)
				continue;

			var labelValue = simple_getInnerText(labelObject, labelObject, '');
			if (labelValue.length > 0)
				return labelValue;
		}

		var elementId = el.getAttribute && el.getAttribute("id");
		if (elementId && document.querySelectorAll) {
			var labels = document.querySelectorAll("label[for=\'" + 
				cssesc(elementId, { isIdentifier: true }) + "\']");
			if (labels && labels.length) {
				for (var i = 0; i < labels.length; i++) {
					var label = labels[i];
					if (!label) continue;
					var labelValue = visibleOnly_getInnerText_getFirstLine(label);
					if (labelValue) return labelValue;
				}
			}
		}

		var tagName = el.nodeName.toLowerCase();
		if (tagName == "input") {
			var typeName = el.getAttribute && el.getAttribute("type");
			if (typeName == "button" || typeName == "submit" || typeName == "reset") {
				var value = el.value;
				if ((typeof value === "string") && value) {
					return value;
				}
			}
		}

		return getCustomControlLabel(el);
	}

	this.Element.prototype.testComplete15_evaluateLabelText = safeCall(function () {
		return evaluateLabelText(this);
	});

	function evaluateDefaultNameSuffix(el) {
		if (!el || el.nodeType != 1) return;
		var tagName = el.nodeName.toLowerCase();

		var labels = [function() {
			return evaluateLabelText(el);
		}, function() {
			var label = el.getAttribute && el.getAttribute('aria-label');
			if (!label) return;
			if (!!document.getElementById(label)) return;
			return label;
		}, function() {
			var clearWS = function(s) {
				return (s || "").replace(/\s/g, '');
			}
			var id = el.getAttribute && el.getAttribute('id');
			if (id && idIsStatic(clearWS(id))) return id;
			var name = el.getAttribute && el.getAttribute('name');
			if (name && idIsStatic(clearWS(name))) return name;
		}, function() {
			if (tagName == "select") return;
			return visibleOnly_getInnerText_getFirstLine(el, null, tagName == "label");
		}, function() {
			return el.title;
		}, function() {
			return el.alt;
		}, function() {
			return lastHrefPart(el.getAttribute && el.getAttribute('href'));
		}, function() {
			return lastHrefPart(el.getAttribute && el.getAttribute('src'));
		}, function() {
			return lastHrefPart(el.getAttribute && el.getAttribute('action'));
		}, function() {
			var role = el.getAttribute && el.getAttribute('role');
			if (!role) return;
			if (!roleIsStatic(role)) return;
			if (role.toLowerCase() == tagName) return;
			return role;
		}];

		function cleanStr(str) {
			if (typeof str !== "string" || !str) return "";

			var retVal = "";
			var delimiter = false;
			for (var i = 0; i < str.length; i++) {
				if (!((str[i] >= 'a' && str[i] <= 'z')
					|| (str[i] >= 'A' && str[i] <= 'Z')
					|| (str[i] >= '0' && str[i] <= '9')
					|| (str[i] == '_') || (str[i] == ' ')))
				{
					if (!delimiter && (retVal != "")) {
						retVal += ".";
						delimiter = true;
					}
					continue;
				}
				retVal += str[i];
				delimiter = false;
			}
			return retVal.trim();
		}

		function convertToName(innerText)	{
			if (!innerText)
				return;

			if (highEntropy(innerText))
				return;

			var lines = innerText.split('\n');
			if (!lines || !lines.length)
				return;

			var i = 0;
			var firstLine = "";
			while ((i < lines.length) && !(firstLine = cleanStr(lines[i]))) i++;
			if (firstLine.length > 32) {
				var words = firstLine.split(" ");
				if (words.length > 1) {
					firstLine = "";
					for (var i = 0; i < words.length; i++) {
						if (!words[i]) continue;
						if (firstLine) firstLine += " ";
						if (firstLine.length + words[i].length > 32) break;
						firstLine += words[i];
					}
				} else {
					firstLine = firstLine.slice(0, 31);
				}
			}
			var appendDot = function(acc, s) {
				return !!acc && !!s ? acc + "." + s: acc + s;
			};
			return ArrayReduce(firstLine.split(" "), function (acc, s) {
				s = s.trim();
				if (!s) return acc;
				if (s.toUpperCase() == s) return appendDot(acc, s);
				var s2 = s.substring(1);
				if (s2.toLowerCase() == s2) {
					s = s[0].toUpperCase() + s2.toLowerCase();
				}
				return appendDot(acc, s);
			}, "");
		}
		
		for (var i = 0; i < labels.length; i++) {
			var name = convertToName(labels[i]());
			if (!!name) return name;
		}

		return "";
	}

	this.Element.prototype.testComplete15_evaluateDefaultName = safeCall(function () {
		var defaultName = evaluateDefaultNameSuffix(this);
		logMessage('evaluateDefaultName', this, defaultName);
		return defaultName;
	});

	var TestCompleteWebTestingHelpers = {

		getContentText: function(node)
		{
			if (node === null || node === undefined)
				return '';
		
			var nodeValueList = this.getNodeValueList(node);
			return this.stringListToStringWithoutSpaces(nodeValueList, '\n');
		},

		getNodeValue: function (node) {
			if (node && node.nodeType == 3 /*TEXT_NODE*/)
				return node.nodeValue;
			else
				return '';
		},

		getFirstChild: function (node) {
			var nodeName = node.nodeName;
			if (typeof nodeName === "string") {
				nodeName = nodeName.toUpperCase();
				if (nodeName === "FRAME" || nodeName === "IFRAME") {
					var firstChild;
					try {
						firstChild = node.contentDocument.body.firstChild;
					} catch (e) {

					}
					if (typeof firstChild === "object")
						return firstChild;
				}
			}
			return node.firstChild;
		},

		getNodeValueList: function (node, nodeToOmit) {
			var valueList = [];
			var child = null;
			var curNode = this.getFirstChild(node);
			var parents = [];

			if (!curNode) {
				ArrayPush(valueList, this.getNodeValue(curNode));
				return valueList;
			}

			while (true) {
				if (!curNode) {
					while (parents.length > 0) {
						curNode = parents.pop();
						child = curNode.nextSibling;
						if (child)
							break;
					}

					if (!child)
						break;

					curNode = child;
				}

				if (curNode && curNode == nodeToOmit)
					curNode = curNode.nextSibling;

				child = this.getFirstChild(curNode);
				if (child) {
					ArrayPush(parents, curNode);
					curNode = child;
					continue;
				}

				ArrayPush(valueList, this.getNodeValue(curNode));

				curNode = curNode.nextSibling;
			}

			return valueList;
		},

		stringListToStringWithoutSpaces: function (list, separator) {
			var whiteSpaceChars = '\u0009\u000a\u000b\u000c\u000d\u0020\u0085\u00a0\u1680\u2000\u2001' +
				'\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000';
			var result = '';

			for (var i = 0; i < list.length; i++) {
				var nonSpaceSymbolsWereAdded = false;
				var prevWasSpace = false;

				for (var c = 0; c < list[i].length; c++) {
					var cCurr = list[i].charAt(c);
					if (whiteSpaceChars.indexOf(cCurr) > -1) {
						prevWasSpace = true;
					}
					else {
						if (nonSpaceSymbolsWereAdded && prevWasSpace)
							result += ' ';
						result += cCurr;

						nonSpaceSymbolsWereAdded = true;
						prevWasSpace = false;
					}
				}

				if (nonSpaceSymbolsWereAdded)
					result += separator;
			}

			if (result.charAt(result.length - 1) == separator)
				result = result.substring(0, result.length - 1);

			return result;
		},

		addGetContextTextMethodToDocFrames: function(doc)
		{
			if (doc == null)
				return;
			
			var iframes = doc.getElementsByTagName("iframe");
			for (var i = 0; i < iframes.length; i++)
				this.addGetContextTextMethodToFrameScope(iframes[i]);
				
			var frames = doc.getElementsByTagName("frame");
			for (var i = 0; i < frames.length; i++)
				this.addGetContextTextMethodToFrameScope(frames[i]);
		},

		addGetContextTextMethodToFrameScope: function(frame)
		{	
			if (typeof frame.contentWindow === 'undefined')
				return;
				
			var contentWindow = frame.contentWindow;
			if (contentWindow == null)
				return;
				
			try {			
				contentWindow.Element.prototype.testComplete15_GetContentText = safeCall(function () {
					return TestCompleteWebTestingHelpers.getContentText(this);
				});
			} catch(e) {

			}
			
			var frameDocument;
			try
			{
				frameDocument = frame.contentDocument || frame.contentWindow.document;
			}
			catch (e)
			{
				return;
			}
			
			this.addGetContextTextMethodToDocFrames(frameDocument);
		},

	};

	function prepareForSearchLines(s) {
		if (!s) return [];
		return ArrayFilter(ArrayMap(s.trim().replace(/[\t\f\r\xA0]/g, '\n').split('\n'), function(line) {
			return line.trim();
		}), function(line) {
			if(suppressDigitsInId)
				return line.length > 1;
			return line.length > 0;
		});
	}
	
	function suitableForTextSearch(e) {
		return ['input', 'textarea', 'select'].indexOf((e.nodeName || "").toLowerCase()) == -1;
	}

	LocatorBuilder.generators = [];
	LocatorBuilder.generationGroups = [];

	LocatorBuilder.AcceptLastChance = {"acceptLastChance": true};
	LocatorBuilder.SelfVerified = {"selfVerified": true};
	LocatorBuilder.SelfVerifiedLastChance = {"selfVerified": true, "acceptLastChance": true};

	LocatorBuilder.add = function (fullName, finder, options) {
		// options = {"acceptLastChance": true|false, "selfVerified": true|false}
		var names = fullName.split(':');
		while (names.length < 3) {
			ArrayPush(names, '');
		}
		if ((names[0] != 'css') && (names[0] != 'xpath')) {
			names[0] = '*';
		}
		var name = names[0] + ':' + names[1];
		var instanceName = name;
		if (names[2] != '') {
			instanceName += ':' + names[2];
		}
		var prev = ArrayFind(LocatorBuilder.generators, function(e) {
			return e.instanceName == instanceName;
		});
		if (!!prev) {
			this.log('LocatorBuilder.add invalid parameter ' + instanceName);
			return;
		}
		var mergedOptions = ObjectAssign({"name": name, "instanceName": instanceName, "proc": finder}, options);
		ArrayPush(LocatorBuilder.generators, mergedOptions);
	}

	function GeneratorsGroup() {
		this.list = [];
		this.finishers = [];
	}

	GeneratorsGroup.prototype.addGenerators = function(generators) {
		var group = this;
		ArrayForEach(generators, function (name) {
			var generator = ArrayFind(LocatorBuilder.generators, function(item) {
				return item.instanceName == name;
			});
			if (!generator) {
				return;
			}
			ArrayPush(group.list, generator);
		});
	};

	GeneratorsGroup.prototype.addFinishers = function(finishers) {
		var group = this;
		ArrayForEach(finishers, function (name) {
			var generator = ArrayFind(LocatorBuilder.generators, function(item) {
				return item.instanceName == name;
			});
			if (!generator) {
				return;
			}
			ArrayPush(group.finishers, generator);
		});
	};

	LocatorBuilder.createGroup = function (grouplist) {
		var newGroup = new GeneratorsGroup();
		ArrayPush(this.generationGroups, newGroup);
		newGroup.addGenerators(grouplist);
		return newGroup;
	}

	LocatorBuilder.prototype.log = function() {
		logMessage.apply(null, arguments);
	}

	LocatorBuilder.prototype.build = function (limit) {

		function buildImpl(generators, groupIndex, lastChance) {
			var locator
			var candidates
			var locators = []
			var passedTypes = {}
			var existingLocators = {};
			for (var i = 0; i < generators.length; i++) {
				var finder = generators[i]
				if (typeof finder !== "object")
					continue;
				if (passedTypes[finder.name] !== undefined)
					continue;
				if ((finder.name.indexOf('css:') == 0) && !this.rootDocument.querySelector)
					continue;
				if ((finder.name.indexOf('xpath:') == 0) && !this.rootDocument.evaluate)
					continue;
				if (!lastChance && !finder.acceptLastChance && !!(this.element._tc15_SelectorsBanList || {})[finder.name])
				{
					var failData = (this.element._tc15_SelectorsBanList || {})[finder.name];
					if (!!failData && failData.succeeded) {
						failData.succeeded = false;
						if (failData.candidates && (failData.candidates.length > 0)) {
							var locator = failData.candidates[0];
							var startedAt = new Date();
							var fe = this.findElement(locator)
							if (getTimeoutExpired(startedAt, LocatorBuilder.selectorGenerationTimeout)) {
								this.log('Cached selector for ' + finder.name + ' was dropped due to ' + (new Date() - startedAt) + ' ms timeout.');
							}
							if (this.element == fe) {
								ArrayPush(locators, [locator])
								passedTypes[finder.name] = true;
								failData.succeeded = true;
							}
						}
					}
				} else {
					try {
						var startedAt = new Date();
						var succeeded = false;
						try {
							candidates = finder.proc.call(this, this.element, lastChance, groupIndex)
							succeeded = true;
						} catch(e) {
							this.log(finder.name + ' throws ' + e.message);
						}
						if (candidates && (typeof candidates == "string")) {
							candidates = [candidates];
						}
						if (!succeeded || (!lastChance && getTimeoutExpired(startedAt, LocatorBuilder.selectorGenerationTimeout))) {
							this.log(finder.name + ' was banned after ' + LocatorBuilder.selectorGenerationTimeout + ' ms timeout');
							var banList = this.element._tc15_SelectorsBanList || {};
							banList[finder.name] = {"succeeded": succeeded, "candidates": candidates};
							this.element._tc15_SelectorsBanList = banList;
							if (!succeeded) {
								continue;
							}
						}
						if (!candidates || !candidates.length) {
							this.log(finder.name + ' did not provide any selector');
							continue;
						}
						startedAt = new Date();
						for (var j = 0; j < candidates.length; j++) {
							locator = candidates[j];
							if (!locator) continue;
							locator = String(locator);
							if (existingLocators[locator] === undefined) {
								existingLocators[locator] = true;
								var validSelector = false;
								if (!!finder.selfVerified) {
									validSelector = true;
									this.log(finder.name + ': self verified selector = ' + locator);
								} else {
									var fe = this.findElement(locator)
									validSelector = this.element == fe;
									this.log(finder.name + ': ' + (validSelector ? 'valid': 'invalid') + ' selector = ' + locator);
								}
								if (validSelector) {
									ArrayPush(locators, [locator])
									passedTypes[finder.name] = true;
									break;
								}
							}
							if (new Date - startedAt > 50) {
								this.log('Break selector check for ' + finder.name);
								break;
							}
						}
					} catch (e) {
						this.log(finder.name + '.findElement() throws ' + e.message);
					}
				}
				if ((limit > 0) && (locators.length == limit)) {
					break;
				}
				if (lastChance && (locators.length > 0)) {
					break;
				}
			}
			return locators
		}
		var startedAt = new Date();
		for (var level = 0; level < LocatorBuilder.generationGroups.length; level++) {
			var group = LocatorBuilder.generationGroups[level];
			if (!group) {
				break;
			}
			this.lastChance = level == LocatorBuilder.generationGroups.length - 1;
			var locators = buildImpl.call(this, 
				group.list, level, this.lastChance);
			if (locators && locators.length) {
				this.log('Found ' + locators.length + ' selectors for ' + ((new Date()) - startedAt) + ' ms');
				if (!limit || (locators.length < limit)) {
					if (limit) limit -= locators.length;
					var finishingStartedAt = new Date();
					var finishers = (!this.lastChance && group.finishers.length) ? 
						buildImpl.call(this, group.finishers, level, this.lastChance): null;
					if (finishers && finishers.length) {
						this.log('Found ' + finishers.length + ' finishing selectors for ' + ((new Date()) - finishingStartedAt) + ' ms');
						ArrayForEach(finishers, function(locator) {
							if (!locator || !locator.length || !locator[0]) return;
							if (!ArrayFind(locators, function(item) {
									if (!item || !item.length || !item[0]) return false;
									return item[0] == locator[0];
								})) ArrayPush(locators, locator);
						});
					}
				}
				return locators;
			}
		}
		return [];
	}

	LocatorBuilder.prototype.parseLocator = function (locator) {
		if (!locator)
			return null;
		var result = locator.match(/^([A-Za-z]+)=.+/)
		if (result) {
			var type = result[1]
			var length = type.length
			if (type === 'link') {
				type = 'linkText'
			}
			var actualLocator = locator.substring(length + 1)
			return { type: type, string: actualLocator }
		}

		function isOnlyXPathExpression(locator) {
			if (locator == '..' || locator == '.')
				return true;

			var xpathSelectorsStart = ['/', '(', '../', './', '*'];
			for (var i = 0; i < xpathSelectorsStart.length; i++) {
				if (locator.indexOf(xpathSelectorsStart[i]) == 0) {
					return true;
				}
			}

			var xpathSelectorsContains = ['[@', '.=', 'contains(', '@for', /\[\d+\]/];
			for (var i = 0; i < xpathSelectorsContains.length; i++) {
				var cond = xpathSelectorsContains[i];
				if (typeof cond === "string") {
					if (locator.indexOf(cond) >= 0) {
						return true;
					}
				} else if (typeof cond === "object") {
					if (cond.test(locator)) {
						return true;
					}
				}
			}

			return false;
		}

		var implicitType = isOnlyXPathExpression(locator) ? 'xpath': 'css';
		return { type: implicitType, string: locator }
	}

	LocatorBuilder.prototype.findElement = function (loc) {
		try {
			var locator = this.parseLocator(loc)
			if (locator == null)
				return null;
			switch (locator.type) {
				case "id":
					return this.rootDocument.getElementById(locator.string);
				case "name":
					return this.rootDocument.querySelector ? this.rootDocument.querySelector('[name="' + locator.string + '"]'): null;
				case "linkText":
					{
						var links = this.rootDocument.getElementsByTagName('a')
						for (var i = 0; i < links.length; i++) {
							var link = links[i]
							var linkText = (link.textContent || link.innerText).replace(/\xA0/g, ' ').replace(/^\s*(.*?)\s*$/, '$1')
							if (linkText == locator.string) {
								return link
							}
						}
						return null
					}
				case "css":
					return this.rootDocument.querySelector ? this.rootDocument.querySelector(locator.string): null;
				case "xpath":
					{
						if (!this.rootDocument.evaluate) return;
						var firstChar = locator.string.charAt(0);
						var validFirstChars = ['/', '(', '.'];
						var rootObject = (validFirstChars.indexOf(firstChar) != -1) ? 
							this.rootDocument: (this.rootDocument.body || this.rootDocument);
						var retVal;
						try {
							retVal = this.rootDocument.evaluate(
								locator.string, rootObject, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
							if (retVal) return retVal;
							if (rootObject !== this.rootDocument) {
								retVal = this.rootDocument.evaluate(
									locator.string, this.rootDocument, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
								if (retVal) return retVal;
							}
						} catch(e) {
							logMessage("Exception: findElement xpath", e.message);
						}
						if (!this.rootDocument.querySelector) return;
						try {
							retVal = this.rootDocument.querySelector(locator.string);
						} catch(e) {
						}
						return retVal;
					}
			}
		} catch (error) {
			return null
		}
	}

	LocatorBuilder.prototype.findElements = function (loc) {
		try {
			var locator = this.parseLocator(loc);
			if (locator == null)
				return;
			switch (locator.type) {
				case "css":
					return ArrayFrom(this.rootDocument.querySelectorAll ? this.rootDocument.querySelectorAll(locator.string): []);
				case "xpath":
					{
						var arrayFromSnapshot = function(s) {
							var result = [];
							for (var i = 0; i < s.snapshotLength; i++) {
								ArrayPush(result, s.snapshotItem(i));
							}
							return result;
						};
						if (!this.rootDocument.evaluate) return;
						var firstChar = locator.string.charAt(0);
						var validFirstChars = ['/', '(', '.'];
						var rootObject = (validFirstChars.indexOf(firstChar) != -1) ? 
							this.rootDocument: (this.rootDocument.body || this.rootDocument);
						var retVal;
						try {
							retVal = this.rootDocument.evaluate(
								locator.string, rootObject, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
							if (retVal.snapshotLength) return arrayFromSnapshot(retVal);
							if (rootObject !== this.rootDocument) {
								retVal = this.rootDocument.evaluate(
									locator.string, this.rootDocument, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
								if (retVal.snapshotLength) return arrayFromSnapshot(retVal);
							}
						} catch(e) {
						}
						return ArrayFrom(this.rootDocument.querySelectorAll ? 
							this.rootDocument.querySelectorAll(locator.string): []);
					}
			}
		} catch (error) {
		}
	}

	LocatorBuilder.prototype.attributeValue = function (value) {
		try {
			if (value.indexOf("'") < 0) {
				return "'" + value + "'"
			} else if (value.indexOf('"') < 0) {
				return '"' + value + '"'
			} else {
				var result = 'concat('
				var part = ''
				var didReachEndOfValue = false
				while (!didReachEndOfValue) {
					var apos = value.indexOf("'")
					var quot = value.indexOf('"')
					if (apos < 0) {
						result += "'" + value + "'"
						didReachEndOfValue = true
						break
					} else if (quot < 0) {
						result += '"' + value + '"'
						didReachEndOfValue = true
						break
					} else if (quot < apos) {
						part = value.substring(0, apos)
						result += "'" + part + "'"
						value = value.substring(part.length)
					} else {
						part = value.substring(0, quot)
						result += '"' + part + '"'
						value = value.substring(part.length)
					}
					result += ','
				}
				result += ')'
				return result
			}
		} catch (e) {
			return '';
		}
	}

	function nodeNameToXPathName(name, rootDocument) {
		var node;
		if (typeof name === "object") {
			node = name;
			name = node ? node.nodeName.toLowerCase(): "";
		}
		if (!name) return;

		if (node) {
			var ctorName = node.constructor.name.toLowerCase();
			if (ctorName.indexOf('svg') == 0) {
				return "*[name()='" + name + "']";
			}
		}
		var nodeDocument = rootDocument || (node ? node.ownerDocument: null) || document;
		if (nodeDocument) {
			if (nodeDocument.contentType == 'application/xhtml+xml') {
				return 'x:' + name;
			}
		}
		return name;
	}

	LocatorBuilder.prototype.xpathHtmlElement = function (name) {
		return nodeNameToXPathName(name, this.rootDocument);
	}

	LocatorBuilder.prototype.relativeXPathFromParent = function (current) {
		var index = this.getNodeNbr(current)
		var currentPath = '/' + this.xpathHtmlElement(current)
		if (index > 0) {
			currentPath += '[' + (index + 1) + ']'
		}
		return currentPath
	}

	LocatorBuilder.prototype.PushSelectorCancelProcess = function (selectors, value) {
		if (!value) {
			return false;
		}
		ArrayPush(selectors, value);
		if (this.lastChance) {
			return true;
		}
		return false;
	}

	LocatorBuilder.prototype.getNodeNbr = function (current) {
		var childNodes = current.parentNode.childNodes
		var total = 0
		var index = -1
		for (var i = 0; i < childNodes.length; i++) {
			var child = childNodes[i]
			if (child.nodeName == current.nodeName) {
				if (child == current) {
					index = total
					break;
				}
				total++
			}
		}
		return index
	}

	LocatorBuilder.prototype.calcXPathIndex = function (xpath, e, contextNode, calcIndex) {
		if (!this.rootDocument.evaluate) {
			return -1;
		}
		if (!calcIndex) {
			return 0;
		}
		try {
			if (!contextNode) {
				contextNode = this.rootDocument;
			}
			var result = this.rootDocument.evaluate(
				xpath,
				contextNode,
				null,
				XPathResult.ORDERED_NODE_ITERATOR_TYPE,
				null
			)
			var item = result.iterateNext();
			if (!item) {
				return 0;
			}
			if (item == e) {
				return 1;
			}
			var index = 1;
			while (item = result.iterateNext()) {
				index++;
				if (item == e) { 
					return index;
				}
			}
		}
		catch (e) {
		}
		return 0;
	}

	LocatorBuilder.prototype.uniqueXPath = function (xpath, e, internalSyntax, contextNode) {
		if (!this.rootDocument.evaluate || !e || !xpath) {
			return null;
		}
		try {
			if (!contextNode) {
				contextNode = this.rootDocument;
			}
			var result = this.rootDocument.evaluate(
				xpath,
				contextNode,
				null,
				XPathResult.FIRST_ORDERED_NODE_TYPE,
				null
			).singleNodeValue;
			if (result == e) {
				return xpath;
			}
		} catch(e) {

		}
		return null;
	}

	LocatorBuilder.prototype.preciseXPath = function (xpath, e, internalSyntax, contextNode) {
		var index = this.calcXPathIndex(xpath, e, contextNode, this.lastChance);
		if (index < 0) {
			return null;
		}
		if (this.lastChance && !index) {
			return null;
		}

		var preciseValue;
		if (index > 1) {
			preciseValue = '(' + xpath + ')[' + index + ']';
		} else {
			preciseValue = xpath;
		}

		return internalSyntax ? preciseValue: 'xpath=' + preciseValue;
	}

	LocatorBuilder.prototype.preciseXPathWithHref = function (e, purify, pathTail) {
		var href = getHrefAttribute(e)
		var puredHref = purify ? purifyHref(href): href;
		if (!puredHref) {
			return null;
		}
		var precisePath;
		if ((puredHref == href) && (href.search(/^http?:\/\//) >= 0)) {
			precisePath = this.preciseXPath(
				this.getXPathRoot(e) +
				this.xpathHtmlElement('a') +
				'[@href=' +
				this.attributeValue(href) +
				']',
				e
			)
		} else {
			precisePath = this.preciseXPath(
				this.getXPathRoot(e) +
				this.xpathHtmlElement('a') +
				'[contains(@href, ' +
				this.attributeValue(puredHref) +
				')]',
				e
			)
		}
		if (!precisePath) {
			return null;
		}
		if ((typeof pathTail === "string") && !!pathTail) {
			precisePath += pathTail;
		}
		return precisePath;
	}

	LocatorBuilder.add('css:data-attr', function (e) {
		var selectors = [];
		var dataAttributes = ['data-test', 'data-test-id', 'data-test-selector']
		for (var i = 0; i < dataAttributes.length; i++) {
			var attr = dataAttributes[i]
			var value = e.getAttribute(attr)
			if (value) {
				ArrayPush(selectors, 'css=[' + attr + '=\'' + value + '\']');
			}
		}
		return selectors.length > 0 ? selectors: null;
	})

	LocatorBuilder.add('css:data-attr-lowpriority', function (e) {
		var selectors = [];
		var dataAttributes = ['data-lp-id']
		for (var i = 0; i < dataAttributes.length; i++) {
			var attr = dataAttributes[i]
			var value = e.getAttribute(attr)
			if (value) {
				ArrayPush(selectors, 'css=[' + attr + '=\'' + value + '\']');
			}
		}
		return selectors.length > 0 ? selectors: null;
	})

	var generateCssIdSelector = function (e, lastChance, idIsStaticProc) {
		var elementId = e.id || e.getAttribute("id")
		if (elementId && (lastChance || (idIsStaticProc || idIsStatic)(elementId))) {
			return 'css=#' + elementId;
		}
		return null
	};

	LocatorBuilder.add('css:id', function (e, lastChance) {
		return generateCssIdSelector(e, lastChance, idIsStatic);
	}, LocatorBuilder.AcceptLastChance)

	LocatorBuilder.add('css:id:with-digits', function (e, lastChance) {
		return generateCssIdSelector(e, lastChance, idIsStaticGeneral);
	}, LocatorBuilder.AcceptLastChance)

	LocatorBuilder.add('*:radio', function (e, lastChance) {
		if (((e.nodeName || "").toLowerCase() != 'input') || 
			((e.type || "").toLowerCase() != 'radio')) {
			return null;
		}

		var value = e.value || "";
		return [
			this.addXPathPrefix(this.generateUniqueXPath(e, {
				'minDepth': 1, 'maxDepth': 5,
				'leafName': this.xpathHtmlElement("input") + 
				"[@type='radio'][@value=" + this.attributeValue(value) + "]"
			})),
			"css=input[type='radio'][value='" + value + "']",
		];
	}, LocatorBuilder.AcceptLastChance)

	LocatorBuilder.add('*:name', function (e, lastChance) {
		var elementName = e.name || e.getAttribute("name");
		if (elementName && (lastChance || idIsStatic(elementName))) {
			return this.generateLocatorForAttrs(e, ['name']);
		}
	}, LocatorBuilder.AcceptLastChance)

	LocatorBuilder.add('*:href', function (e, lastChance) {
		var attrName;
		var nodeName = e.nodeName.toLowerCase();
		if (nodeName == "a") {
			attrName = "href";
		} else if (nodeName == "img") {
			attrName = "src";
		} else {
			return;
		}

		var elementHref = getHrefAttribute(e, attrName);
		if (!elementHref) {
			return null;
		}

		var rootPrefix = "xpath=" + this.getXPathRoot(e);
		var selectors = [];
		var addOption = function(part, contains) {
			if (!contains) {
				if (this.useCss) {
					ArrayPush(selectors, "css=[" + attrName + "='" + cssesc(part) + "']");
				} else {
					ArrayPush(selectors, rootPrefix + this.xpathHtmlElement(nodeName) + "[@" + attrName + 
						"=" +  this.attributeValue(part) + "]");
				}
			} else {
				if (this.useCss) {
					ArrayPush(selectors, "css=[" + attrName + "*='" + cssesc(part) + "']");
				} else {
					ArrayPush(selectors, rootPrefix + this.xpathHtmlElement(nodeName) + 
						"[contains(@" + attrName + ", " + this.attributeValue(part) + ")]");
				}
			}
		};

		var purifiedHref = purifyHref(elementHref);
		ArrayForEach(combineHrefGrowth(elementHref), function (part) {
			if ((part != elementHref) && (part != purifiedHref)) {
				addOption.call(this, part, true);
			}
		}, this);
		if (purifiedHref) {
			addOption.call(this, purifiedHref, purifiedHref != elementHref);
		}
		return selectors;
	}, LocatorBuilder.AcceptLastChance)

	LocatorBuilder.add('xpath:fieldset', function (e, lastChance) {
		if (((e.nodeName || "").toLowerCase() != 'fieldset')) {
			return null;
		}

		var legendObject = getFieldsetLegend(e);
		if (!legendObject)
			return null;
		var legendFullText = (legendObject.textContent || legendObject.innerText || "").trim();
		var legendValue = prepareForSearchLines(legendFullValue);
		if (legendValue.length == 0) {
			return null;
		}

		var legendSelector;
		for (var i = 0; i < legendValue.length; i++) {
			var legendText = legendValue[i] || "";
			if (legendText.length == 0) continue;

			if (legendFullText == legendText) {
				legendSelector = this.uniqueXPath("legend[.=" + 
					this.attributeValue(legendText) + "]", legendObject, true, e);
				if (!!legendSelector) break;
			}
			legendSelector = this.uniqueXPath("legend[text()=" + 
				this.attributeValue(legendText) + "]", legendObject, true, e);
			if (!!legendSelector) break;

			legendSelector = this.uniqueXPath("legend[contains(.," + this.attributeValue(legendText) + ")]", legendObject, true, e);
			if (!!legendSelector) break;
		}
		
		if (!legendSelector) {
			return null;
		}

		return this.addXPathPrefix(this.getXPathRoot(e) + 
			this.xpathHtmlElement("fieldset") + 
				"[" + legendSelector + "]");
	}, LocatorBuilder.AcceptLastChance)

	LocatorBuilder.add('xpath:spanInLabel', function (e) {
		if (((e.nodeName || "").toLowerCase() != 'span')) {
			return null;
		}
		var className = e.className || "";
		if (className.indexOf("radio") == -1) {
			return null;
		}

		var labelObject = getParentLabelObject(e);
		if (!labelObject)
			return null;
		var labelFullText = (labelObject.textContent || labelObject.innerText || "").trim();
		var labelValue = prepareForSearchLines(labelFullText);
		if (labelValue.length == 0) {
			return null;
		}
			
		var labelSelector;
		var labelNodeName = this.xpathHtmlElement(labelObject);
		var rootPrefix = this.getXPathRoot(labelObject);
		for (var i = 0; i < labelValue.length; i++) {
			var labelText = labelValue[i] || "";
			if (labelText.length == 0) continue;

			if (labelFullText == labelText) {
				labelSelector = this.uniqueXPath(rootPrefix + labelNodeName + 
					"[.=" + this.attributeValue(labelText) + "]", labelObject, true);
				if (!!labelSelector) break;
			}
			labelSelector = this.uniqueXPath(rootPrefix + labelNodeName + "[text()=" + 
				this.attributeValue(labelText) + "]", labelObject, true);
			if (!!labelSelector) break;

			labelSelector = this.uniqueXPath(rootPrefix + labelNodeName + 
				"[contains(.," + this.attributeValue(labelText) + ")]", labelObject, true);
			if (!!labelSelector) break;
		}
		
		if (!labelSelector) {
			return null;
		}

		return this.addXPathPrefix(
			labelSelector + "//" + this.xpathHtmlElement("span"));
	}, LocatorBuilder.AcceptLastChance)

	LocatorBuilder.add('xpath:labelFor', function (e) {
		var nodeName = (e.nodeName || "").toLowerCase();
		if (['input', 'select', 'textarea'].indexOf(nodeName) == -1) {
			return null;
		}

		var idValue = e.id || e.getAttribute('id');
		if (!idValue) {
			return null;
		}

		var labelNodeName = this.xpathHtmlElement("label");
		var idTail = "";
		var labelSelector = "//" + labelNodeName + "[@for=" + this.attributeValue(idValue) + "]";
		var labelObject = this.rootDocument.evaluate(labelSelector, this.rootDocument, null, 
			XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
		if (!labelObject) {
			var labelId = "";
			var labels = this.rootDocument.evaluate("//" + labelNodeName, this.rootDocument, null, XPathResult.ANY_TYPE, null);
			while (labelObject = labels.iterateNext()) {
				labelId = labelObject['for'] || labelObject.getAttribute('for');
				if (!labelId)
					continue;
				if (idValue.indexOf(labelId) == 0) 
					break;
			}
			if (!labelObject)
				return null;
			idTail = idValue.slice(labelId.length);
		}
		labelSelector = "";

		var labelFullText = (labelObject.textContent || labelObject.innerText || "").trim();
		var labelValue = prepareForSearchLines(labelFullText);
		if (labelValue.length != 0) {
			var labelRootPrefix = "//";
			for (var i = 0; i < labelValue.length; i++) {
				var labelText = labelValue[i] || "";
				if (labelText.length == 0) continue;

				if (labelFullText == labelText) {
					labelSelector = this.uniqueXPath(labelRootPrefix + labelNodeName + 
						"[.=" + this.attributeValue(labelText) + "]", labelObject, true);
					if (!!labelSelector) break;
				}

				labelSelector = this.uniqueXPath(labelRootPrefix + labelNodeName + 
					"[text()=" + this.attributeValue(labelText) + "]", labelObject, true);
				if (!!labelSelector) break;

				labelSelector = this.uniqueXPath(labelRootPrefix + labelNodeName + 
					"[contains(.," + this.attributeValue(labelText) + ")]", labelObject, true);
				if (!!labelSelector) break;
			}

			if (labelSelector) {
				labelSelector = "(" + labelSelector + "/@for)";
			}
		} else {
			if (idIsStatic(idValue)) {
				labelSelector = this.attributeValue(idValue);
			}
		}

		if (!labelSelector) {
			return null;
		}

		var idSelector;
		if (idTail.length == 0) {
			idSelector = "@id=" + labelSelector;
		} else {
			idSelector = "starts-with(@id, " + labelSelector + ")";
		}

		return this.addXPathPrefix(this.getXPathRoot(e) + this.xpathHtmlElement(nodeName) + 
			"[" + idSelector + "]");
	}, LocatorBuilder.AcceptLastChance)

	LocatorBuilder.prototype.getAriaLinkXPath = function (e, ariaAttrName, internalSyntax) {
		if (e['aria-hidden'] || e.getAttribute('aria-hidden')) {
			return null;
		}

		var idValue = e[ariaAttrName] || e.getAttribute(ariaAttrName);
		if (!idValue) {
			return null;
		}
		var labelObject = this.rootDocument.getElementById(idValue);
		if (!labelObject) {
			return null;
		}			

		var labelSelector;
		var labelFullValue = (labelObject.textContent || labelObject.innerText || "").trim();
		var labelValue = prepareForSearchLines(labelFullValue);
		if (labelValue.length) {
			var selfDescribing = e.contains(labelObject);
			if (selfDescribing) {
				labelObject = e;
			}

			var preparelabelSelector = function() {
				var labelObjectName = this.xpathHtmlElement(labelObject);
				for (var j = 0; j < labelValue.length; j++) {
					var labelText = labelValue[j] || "";
					if (labelText.length == 0) continue;

					if (labelFullValue == labelText) {
						labelSelector = this.uniqueXPath("//" + labelObjectName + 
							"[.=" + this.attributeValue(labelText) + "]", labelObject, !selfDescribing);
						if (!!labelSelector) break;
					}
					labelSelector = this.uniqueXPath("//" + labelObjectName + 
						"[text()=" + this.attributeValue(labelText) + "]", labelObject, !selfDescribing);
					if (!!labelSelector) break;

					labelSelector = this.uniqueXPath("//" + labelObjectName + 
						"[contains(.," + this.attributeValue(labelText) + ")]", labelObject, !selfDescribing);
					if (!!labelSelector) break;
				}
			};

			preparelabelSelector.call(this);

			if (labelSelector) {
				if (selfDescribing) {
					return labelSelector;
				}
				labelSelector = "(" + labelSelector + "/@id)";
			} else if (!selfDescribing) {
				var elementFullValue = (e.textContent || e.innerText || "").trim();
				var elementLabelValue = prepareForSearchLines(elementFullValue);
				var overrides = false;
				ArrayForEach(elementLabelValue, function (text) {
					overrides = overrides || (labelFullValue.indexOf(text) != -1);
				});
				if (overrides) {
					selfDescribing = true;
					labelObject = e;
					labelFullValue = elementFullValue;
					labelValue = elementLabelValue;
					preparelabelSelector.call(this);
					if (internalSyntax)
						return labelSelector;
					return this.addXPathPrefix(labelSelector);
				}
			}
		} else {
			if (idIsStatic(idValue)) {
				labelSelector = this.attributeValue(idValue);
			}
		}

		if (!labelSelector) {
			return null;
		}

		var idSelector = "@" + ariaAttrName + "=" + labelSelector;

		return this.uniqueXPath(
			this.getXPathRoot(e) + this.xpathHtmlElement(e) +
			"[" + idSelector + "]",
			e,
			internalSyntax
		);
	}

	LocatorBuilder.add('xpath:ariaLinks', function (e, lastChance) {
		var ariaLinks = [
			'aria-labelledby',
			'aria-describedby',
		];

		for (var i = 0; i < ariaLinks.length; i++) {
			var ariaAttrName = ariaLinks[i];
			var retVal = this.getAriaLinkXPath(e, ariaAttrName);
			if (!!retVal)
				return retVal;
		}
		return null;
	}, LocatorBuilder.AcceptLastChance)

	LocatorBuilder.add('xpath:sfdc_uiMenu', function (e) {
		var nodeName = (e.nodeName || "").toLowerCase();
		if (nodeName != "div")
			return null;
		var auraClass = e["data-aura-class"] || (e.getAttribute && e.getAttribute("data-aura-class"));
		if (auraClass != "uiMenu")
			return null;

		var ariaAttrName = "aria-describedby";
		var links = e.querySelectorAll("[" + ariaAttrName + "]");
		if (links) {
			for (var j = 0; j < links.length; j++) {
				var link = links[j];
				if (!link)
					continue;
				var selector = this.getAriaLinkXPath(link, ariaAttrName, true);
				if (!selector)
					continue;
				var retVal = this.uniqueXPath(selector + "/ancestor::div[@class='uiMenu']", e);
				if (!!retVal)
					return retVal;
			}
		}
		return null;
	}, LocatorBuilder.AcceptLastChance)

	LocatorBuilder.add('xpath:text', function (e, lastChance) {
		if (!suitableForTextSearch(e)) {
			return null;
		}

		var fullText = visibleOnly_getInnerText(e, e, '\n').trim();
		var lines = prepareForSearchLines(fullText);
		if (!lines.length) {
			return null;
		}

		var builder = this;
		var nodeName = this.xpathHtmlElement(e);
		var rootPrefix = "xpath=" + this.getXPathRoot(e);

		if (!lastChance) {
			var selectors = [];
			var processLine = function(text) {
				if (text.length > builder.shortStringLength)
					return;
				if (text == fullText) {
					ArrayPush(selectors, rootPrefix + nodeName + 
						'[.=' + builder.attributeValue(text) + ']');
				}
				ArrayPush(selectors, rootPrefix + nodeName + 
					'[text()=' + builder.attributeValue(text) + ']');
				ArrayPush(selectors, rootPrefix + nodeName + 
					'[contains(text(), ' + builder.attributeValue(text) + ')]');
				ArrayPush(selectors, rootPrefix + nodeName + 
					'[contains(., ' + builder.attributeValue(text) + ')]');
			};
	
			processLine(lines[0]);
			lines.splice(0, 1);
			lines = ArraySort(lines, function(a, b) {
				return b.length - a.length;
			});
			ArrayForEach(lines, processLine);
			return selectors;
		}

		var selector;
		var rootPrefix = this.getXPathRoot(e);
		ArrayForEach(lines, function(text) {
			if (selector) return;
			if (text.length > builder.shortStringLength)
				return;
			if (text == fullText) {
				selector = builder.preciseXPath(rootPrefix + nodeName + 
					'[.=' + builder.attributeValue(text) + ']', e);
				if (selector) return;
			}
			selector = builder.preciseXPath(rootPrefix + nodeName + 
				'[text()=' + builder.attributeValue(text) + ']', e);
			if (selector) return;

			selector = builder.preciseXPath(rootPrefix + nodeName + 
				'[contains(text(), ' + builder.attributeValue(text) + ')]', e);
			if (selector) return;

			selector = builder.preciseXPath(rootPrefix + nodeName + 
				'[contains(., ' + builder.attributeValue(text) + ')]', e);
			if (selector) return;
		});
		return selector;
	}, LocatorBuilder.AcceptLastChance)

	LocatorBuilder.add('*:aria-attr', function (e) {
		var PREFERRED_ATTRIBUTES = [
			'aria-label',
			'aria-level',
			'aria-labelledby',
			'aria-describedby',
		]

		return this.generateLocatorForAttrs(e, PREFERRED_ATTRIBUTES);
	}, LocatorBuilder.SelfVerified)

	LocatorBuilder.add('xpath:img', function (el) {
		var nodeName = (el.nodeName || "").toLowerCase();
		if (nodeName != "img")
			return null;

		var selectors = [];
		var attrs = [
			['alt', true],
			['title', true],
			['src', false, true],
		];
		var attrList = [];
		ArrayForEach(attrs, function(attr) {
			var attrValue = (el.getAttribute ? el.getAttribute(attr[0]): null) || "";
			if (!attrValue)
				return;
			var useEqual = attr[1];
			if (!!attr[2]) {
				var purified = purifyHref(attrValue);
				if (!purified)
					return;
				if (purified == attrValue) {
					useEqual = true;
				}
				attrValue = purified;
			} 
			if (attrValue.length > this.shortStringLength)
				return;
			var selector;
			if (!!useEqual) {
				selector = this.xpathHtmlElement("img") + "[@" + attr[0] + "=" + 
					this.attributeValue(attrValue) + "]";
			} else {
				selector = this.xpathHtmlElement("img") + "[contains(@" + attr[0] + "," + 
					this.attributeValue(attrValue) + ")]";
			}
			ArrayPush(selectors, selector);
			ArrayPush(attrList, [attr, attrValue]);
		}, this);
		if (attrList.length > 1) {
			var complexSelector = "";
			ArrayForEach(attrList, function(attrListItem) {
				var attr = attrListItem[0];
				var attrValue = attrListItem[1];
				if (complexSelector) {
					complexSelector += " AND ";
				}
				if (!!attr[1]) {
					complexSelector += "@" + attr[0] + "=" + 
						this.attributeValue(attrValue);
				} else {
					complexSelector += "contains(@" + attr[0] + "," + 
						this.attributeValue(attrValue) + ")";
				}
			});
			complexSelector = this.xpathHtmlElement("img") + "[" + complexSelector + "]";
			ArrayPush(selectors, complexSelector);
		}

		var unique;
		var startedAt = new Date();
		ArrayFind(selectors, function(s) {
			if (getTimeoutExpired(startedAt, 50)) return true;
			unique = this.addXPathPrefix(this.generateUniqueXPath(
				el, { 'leafName': s }));
			return !!unique;
		}, this);
		return unique;
	}, LocatorBuilder.SelfVerified)

	LocatorBuilder.add('xpath:inputtype', function (e, lastChance) {
		var nodeName = (e.nodeName || "").toLowerCase();
		if (nodeName != "input") {
			return;
		}
		var leafName = this.generateXPathOneLevelId(e);
		if (!leafName || (leafName == nodeName)) {
			return;
		}
		return this.addXPathPrefix(this.generateUniqueXPath(e, {
			'minDepth': 1, 'maxDepth': 7,
			'leafName': leafName
		}));
	}, LocatorBuilder.AcceptLastChance)

	LocatorBuilder.prototype.generateXPathForAttrSet = function(e, attNames, minDepth) {
		var locator = this.xpathHtmlElement(e);
		for (var i = 0; i < attNames.length; i++) {
			var attName = attNames[i][0];
			var attValue = this.attributeValue(attNames[i][1]);
			if (!!attNames[i][2]) {
				locator += '[contains(@' + attName + ', ' + attValue + ')]';
			} else {
				locator += '[@' + attName + '=' + attValue + ']';
			}
		}
		return this.addXPathPrefix(this.generateUniqueXPath(e, {
			'leafName': locator, 'minDepth': minDepth}));
	};

	LocatorBuilder.prototype.generateCssForAttrSet = function(e, attNames) {
		var attrs = ArrayMap(attNames, function(attr) {
			return {'name': attr[0], 'value': attr[1], 'contains': attr[2] };
		});
		var finder = new CssLocatorBuilder(e, this.rootDocument, 
			{ 'leafAttrs': attrs, 'minDepth': 1, 'justMatch': false });
		var selector = finder.getSelector();
		if (selector) {
			return 'css=' + selector;
		}
	};

	LocatorBuilder.prototype.generateLocatorForAttrs = function(e, attrNames, generator) {
		if (!e.attributes) {
			return null;
		}

		if (!generator) {
			if (this.useCss) {
				generator = this.generateCssForAttrSet;
			} else {
				generator = this.generateXPathForAttrSet;
			}
		}

		var atts = [];
		var ids = ['id', 'name', 'aria-label', 'aria-labelledby', 'aria-describedby'];
		ArrayForEach(attrNames, function(name) {
			var value = (e.getAttribute ? e.getAttribute(name): null) || "";
			if (!value) return;
			if (name == 'class') {
				var classList = ArrayMap(ArrayFrom(
					value.replace(/[\t\f\r\n\xA0]/g, ' ').split(' ')), function(name) {
					return (name || "").trim();
				});
				var classes = ArraySort(ArrayFilter(classList, function(classValue) {
					return classValue && classNameIsStatic(classValue);
				}), function(a, b) {
					return a.length > b.length;
				});
				ArrayForEach(classes, function(classValue) {
					ArrayPush(atts, [name, classValue, true]);
				});
			} else if (name == 'href' || name == 'src' || name == 'action') {
				ArrayForEach(combineHrefGrowth(value), function(item) {
					ArrayPush(atts, [name, item, value != item]);	
				});
				var purified = purifyHref(value);
				if (!purified) return;
				ArrayPush(atts, [name, purified, value != purified]);	
			} else if (ids.indexOf(name) != -1) {
				if (!idIsStatic(value)) return;
				ArrayPush(atts, [name, value]);	
			} else if (name == 'role') {
				if (!roleIsStatic(value)) return;
				ArrayPush(atts, [name, value]);	
			} else {
				if (name.length > this.shortStringLength) return;
				ArrayPush(atts, [name, value]);
			}
		}, this);

		var names = [];
		var depthMax = 2;
		var startedAt = new Date();
		for (var depth = 0; depth < depthMax; depth++) {
			for (var i = depth; i < atts.length; i++) {
				if (getTimeoutExpired(startedAt, 50)) return;
				var locator = generator.call(this, e, names.concat([atts[i]]), depthMax - depth);
				if (locator) {
					return locator;
				}
			}
			ArrayPush(names, atts[depth]);
		}
		return null
	};

	LocatorBuilder.add('*:attributes', function (e) {
		var PREFERRED_ATTRIBUTES = [
			'value', 
			'title', 
			'role',
			'type',
			'src',
			'action', 
		]

		return this.generateLocatorForAttrs(e, PREFERRED_ATTRIBUTES);
	}, LocatorBuilder.SelfVerified)

	LocatorBuilder.add('*:attributes_unstable', function (e) {
		if (this.useCss) return;

		var PREFERRED_ATTRIBUTES = [
			'class',
		]

		return this.generateLocatorForAttrs(e, PREFERRED_ATTRIBUTES);
	}, LocatorBuilder.SelfVerified)

	LocatorBuilder.prototype.generateXPathOneLevelId = function(e) {
		var nodeName = e.nodeName.toLowerCase();
		var xpathName = this.xpathHtmlElement(e);

		var processAttrs = function(attrs) {
			var retVal;
			ArrayForEach(attrs, function(item) {
				if (retVal) return;
				var value = e[item];
				if (value && idIsStatic(value)) {
					retVal = xpathName + '[@' + item + '=' + this.attributeValue(value) + ']';
				}
			}, this);
			return retVal;
		};

		if (nodeName == "input") {
			var retVal = processAttrs.call(this, [
				"name", 
				"type",
				"title",
				"alt",
			]);
			if (retVal) {
				return retVal;
			}
		}

		return xpathName;
	};

	LocatorBuilder.prototype.getXPathRoot = function(el) {
		var parent = el.parentNode || el.parentElement;
		if (!parent || (this.rootDocument == parent) 
			|| (this.rootDocument.body == parent))
			return "";
		return "//";
	}

	LocatorBuilder.prototype.addXPathPrefix = function(v) {
		if (!v) return;
		return 'xpath=' + v;
	}

	LocatorBuilder.prototype.generateUniqueXPath = function(el, options) {

		options = options || {};
		var root = options.root;
		var fullPath = options.fullPath;
		var rootName = options.rootName || "";
		var minDepth = options.minDepth || 2;
		var maxDepth = options.maxDepth || 7;
		var customLeafName = options.leafName;
		if (customLeafName) {
			for (var i = 0; i < 2; i++) {
				if (customLeafName[0] == '/') {
					customLeafName = customLeafName.slice(1);
					if (!customLeafName) {
						break;
					}
				}
			}
		}
		var leafName = customLeafName || nodeNameToXPathName(el);
		var targetElement = el;

		var evaluateRoot = findRootDocument(el) || document;
		if (!root) {
			if (el.parentElement === evaluateRoot.body) {
				rootName = "";
				evaluateRoot = evaluateRoot.body;
			} else {
				rootName = "//";
			}
			root = evaluateRoot;
		} else {
			if (!rootName) {
				var rootRoot = findRootDocument(root) || document;
				if (root == rootRoot) {
					rootName = "";
				} else {
					rootName = this.generateUniqueXPath(root, {
						'root': rootRoot, 
						'minDepth': 1, 
						'maxDepth': 3
					});
					if (!rootName) {
						return;
					}
				}
			}
			if (el.parentElement === root) {
				rootName += "/";
			} else {
				rootName += "//";
			}
			if (rootName.indexOf("//") != 0) {
				evaluateRoot = evaluateRoot.body;
			}
		}

		if ((root.nodeType != 1) && root.body) {
			root = root.body;
		}

		function Node() {
			this.transition = {};
			this.suffixLink = null;
		}
	
		Node.prototype.addTransition = function (node, start, end, t) {
			this.transition[t] = [node, start, end];
		}
	
		Node.prototype.isLeaf = function () {
			return Object.keys(this.transition).length === 0;
		}
	
		function SuffixTree(ValueType) {
			this.valueType = ValueType;
			this.text = this.valueType.createEmptyValue();
			this.str_list = [];
			this.seps = []
			this.root = new Node();
			this.bottom = new Node();
			this.root.suffixLink = this.bottom;
			this.s = this.root;
			this.k = 0;
			this.i = -1;
		}
	
		SuffixTree.prototype.addString = function (str) {
			var temp = this.text.length;
			this.text = this.valueType.concat(this.text, str);
			ArrayPush(this.seps, str[str.length - 1])
			ArrayPush(this.str_list, str);
			var s, k, i;
			s = this.s;
			k = this.k;
			i = this.i;
	
			for (var j = temp; j < this.text.length; j++) {
				this.bottom.addTransition(this.root, j, j, this.text[j]);
			}
	
			while (this.text[i + 1]) {
				i++;
				var up = this.update(s, k, i);
				up = this.canonize(up[0], up[1], i);
				s = up[0];
				k = up[1];
			}
	
			this.s = s;
			this.k = k;
			this.i = i;
			return this;
		}
	
		SuffixTree.prototype.update = function (s, k, i) {
			var oldr = this.root;
			var endAndr = this.testAndSplit(s, k, i - 1, this.text[i]);
			var endPoint = endAndr[0]; var r = endAndr[1]
	
			while (!endPoint) {
				r.addTransition(new Node(), i, Infinity, this.text[i]);
	
				if (oldr != this.root) {
					oldr.suffixLink = r;
				}
	
				oldr = r;
				var sAndk = this.canonize(s.suffixLink, k, i - 1);
				s = sAndk[0];
				k = sAndk[1];
				endAndr = this.testAndSplit(s, k, i - 1, this.text[i]);
				var endPoint = endAndr[0]; var r = endAndr[1]
			}
	
			if (oldr != this.root) {
				oldr.suffixLink = s;
			}
	
			return [s, k];
		}
	
		SuffixTree.prototype.testAndSplit = function (s, k, p, t) {
			if (k <= p) {
				var traNs = s.transition[this.text[k]];
				var s2 = traNs[0], k2 = traNs[1], p2 = traNs[2];
				if (t == this.text[k2 + p - k + 1]) {
					return [true, s];
				} else {
					var r = new Node();
					s.addTransition(r, k2, k2 + p - k, this.text[k2]);
					r.addTransition(s2, k2 + p - k + 1, p2, this.text[k2 + p - k + 1]);
					return [false, r];
				}
			} else {
				if (!s.transition[t])
					return [false, s];
				else
					return [true, s];
			}
		}
	
		SuffixTree.prototype.canonize = function (s, k, p) {
			if (p < k)
				return [s, k];
			else {
				var traNs = s.transition[this.text[k]];
				var s2 = traNs[0], k2 = traNs[1], p2 = traNs[2];
	
				while (p2 - k2 <= p - k) {
					k = k + p2 - k2 + 1;
					s = s2;
		
					if (k <= p) {
						var traNs = s.transition[this.text[k]];
						s2 = traNs[0]; k2 = traNs[1]; p2 = traNs[2];
					}
				}
	
				return [s, k];
			}
		}
	
		SuffixTree.prototype.findLeafsOf = function (stringIndex) {
			var ret = [];
			var text = this.text;
	
			function traverse(node, suffix) {
				if (!node.transition) 
					return [];
	
				var values = ObjectValues(node.transition);
				for (var t = 0; t < values.length; t++) {
					var traNs = values[t];
					var s = traNs[0], a = traNs[1];
					var name = this.valueType.createEmptyValue();
					if (s.isLeaf()) {
						for (var pos = a; pos < text.length; pos++) {
							var insep = this.seps.indexOf(text[pos]);
							if (insep > -1) {
								if (insep != stringIndex) {
									break;
								}
								if (a == pos) {
									break;
								}
								name = this.valueType.slice(text, a, pos + 1);
								break;
							}
						}
						if (!name.length)
							continue;
						ArrayPush(ret, this.valueType.concat(suffix, name));
					} else {
						var b = traNs[2];
						name = this.valueType.slice(text, a, b + 1);
						traverse.call(this, s, this.valueType.concat(suffix, name));
					}
				}
			}
	
			traverse.call(this, this.root, this.valueType.createEmptyValue());
			return ret;
		}
		
		function DnaBuilder() {
			this.elements = [];
			this.dict = {};
			this.nextId = 1;
			this.valueType = {
				'createEmptyValue': function () {
					return [];
				},
				'concat': function (a, b) {
					return a.concat(b);
				},
				'slice': function (s, a, b) {
					return s.slice(a, b);
				}
			};
		}
	
		DnaBuilder.prototype.addElement = function(el) {
			ArrayPush(this.elements, el);
		}
	
		DnaBuilder.prototype.encodeDna = function(root, leafItem, predecessorDna) {

			var calcIndex = function(nodeName, el) {
				var index = 0;
				el = el.previousSibling;
				while (el) {
					if (el.nodeName.toLowerCase() == nodeName) {
						index++;
					}
					el = el.previousSibling;
				}
				return index;
			};

			var getNodeName = function(el, strongify) {
				var nodeName = el.nodeName.toLowerCase();
				var name = nodeNameToXPathName(el);
				if (nodeName != name) 
					return name;
				if (el !== leafItem) {
					var role = el.getAttribute && el.getAttribute("role");
					if ((role === "dialog") || (role === "main")) {
						return nodeName + "[@role='" + role + "']";	
					}
				}
				if (!strongify) {
					return nodeName;
				}
				if (el !== leafItem) {
					var parent = el.parentElement;
					if (!parent)
						return name;
					var generators = [function(el) {
						var role = el.getAttribute && el.getAttribute("role");
						if (role && roleIsStatic(role)) {
							return nodeName + "[@role='" + role + "']";
						}
					}, function(el) {
						var id = el.getAttribute && el.getAttribute("id");
						if (!id) return;
						if (idIsStatic(id)) {
							return nodeName + "[@id='" + id + "']";
						}
						if (idIsStaticGeneral(id)) {
							return nodeName + "[@id]";
						}
					}];
					var child = parent.firstChild;
					var children = [];
					while (child) {
						ArrayPush(children, child);
						child = child.nextSibling;
					}
					for (var i = 0; i < generators.length; i++) {
						var curName = generators[i](el);
						if (!curName) continue;
						var match = ArrayFind(children, function(child) {
							if (child === el) return false;
							var childName = generators[i](child);
							if (!childName) return false;
							return childName == curName;
						});
						if (!!match) continue;
						return curName;
					}
				}
				return nodeName + "[" + (calcIndex(nodeName, el) + 1) + "]";
			};

			var getDnaValue = function(nodeName) {
				var value = this.dict[nodeName];
				if (value) return value;
				value = this.nextId++;
				this.dict[nodeName] = value;
				return value;
			};

			var findDna = function(el) {
				var dna = predecessorDna;
				while (!!dna) {
					if (dna.node === el)
						return dna;
					dna = dna.parent;
				}
				return null;
			};

			var updateResultBranch = function(dna) {
				dna.resultBranch = true;
				var parentDna = dna.parent;
				if (!parentDna) 
					return;
				if (parentDna.children.length > 1) {
					ArrayForEach(parentDna.children, function(childDna) {
						if (childDna.strong) return;
						childDna.name = getNodeName(childDna.node, true);
						childDna.value = getDnaValue.call(this, childDna.name);
						childDna.strong = true;
					}, this);
				}
				updateResultBranch.call(this, parentDna);
			};

			var createDna = function(el) {
				var dna = findDna(el);
				if (!!dna) return dna;

				dna = {
					'value': 0,
					'node': el,
					'parent': null,
					'name': '',
					'children': [],
					'strong': false,
					'resultBranch': (targetElement === el)
				};

				if ((el === leafItem) && !!customLeafName) {
					dna.name = customLeafName;
				} else {
					dna.name = getNodeName(el);
				}
				dna.strong = (!fullPath && (el === leafItem)) || (dna.name != el.nodeName.toLowerCase());
				dna.value = getDnaValue.call(this, dna.name);

				var parent;
				var role = ((el.getAttribute && el.getAttribute("role")) || "").toLowerCase();
				if ((role !== "dialog") && (role !== "main")) {
					parent = el.parentElement;
				}

				if (parent && (parent !== root) && (parent.nodeType == 1)) {
					dna.parent = createDna.call(this, parent);
					if (dna.parent) {
						ArrayPush(dna.parent.children, dna);
						if (dna.resultBranch || dna.parent.resultBranch) {
							updateResultBranch.call(this, dna);
						}
					}
				}

				return dna;
			};

			return createDna.call(this, leafItem);
		}

		DnaBuilder.prototype.decodeDna = function(dna) {
			var ret = '';
			var dict = ObjectEntries(this.dict);
			var decodeItem = function(a) {
				var nodeName = ArrayFind(dict, function(i) {
					return i[1] == a;
				}) [0];
				return nodeName;
			};
			ArrayForEach(dna, function (a) {
				if (ret) ret += "/";
				ret += !a ? '': decodeItem(a);
			});
			return ret;
		}
	
		DnaBuilder.prototype.findUniqueSequence = function(position, root, minDepth, maxDepth) {
			var list = this.elements;
			var el = list[position];
			if (!el) {
				return;
			}
	
			if (list.length == 1) {
				if (!!fullPath || !minDepth || (minDepth <= 1)) {
					return [leafName];
				}
				return;
			}
	
			var lastDna;
			var dnaTree = [];

			for (var i = 0; i < list.length; i++) {
				var itemDna = this.encodeDna(root, list[i], lastDna);
				ArrayPush(dnaTree, itemDna);
				lastDna = itemDna;
			}

			var dnas = ArrayMap(dnaTree, function(dna) {
				var values = [];
				while (!!dna) {
					ArrayUnshift(values, dna.value);
					dna = dna.parent;
				}
				return values;
			});

			ArrayForEach(dnaTree, function(dna) {
				while (!!dna) {
					dna.children = null;
					dna = dna.parent;
				}
			});

			// console.log("dnas", ArrayMap(dnas, function(dna, i) {
			// 	return this.decodeDna(dna) + (i == position ? " <- target": "");
			// }, this));

			var tree = new SuffixTree(this.valueType);

			var elementId = this.nextId;
			ArrayForEach(dnas, function(dna) {
				ArrayPush(dna, ++elementId);
				tree.addString(dna);
			});

			var uniques = ArraySort(ArrayFilter(ArrayMap(tree.findLeafsOf(position), function(item) {
				if (!item || !item.length) 
					return null;
				return item.slice(0, item.length - 1);
			}), function(item) {
				return item && item.length;
			}), function(a, b) {
				return a.length - b.length;
			});

			if (!uniques.length) {
				return;
			}

			// console.log("uniques", uniques);

			var meaninglessItemNames = ["table", "tbody", "thead", "div", "span"]; 
			var meaninglessItems = ArrayMap(ArrayFilter(ObjectEntries(this.dict), function(a) {
				return meaninglessItemNames.indexOf(a[0]) != -1;
			}), function (a) {
				return a[1];
			});

			var compressedLength = function (arr) {
				return ArrayReduce(arr, function(acc, i) {
					return acc + (i ? 1: 0);
				}, 0);
			}

			var trimedPaths = [];
			ArrayForEach(uniques, function(path) {
				if (!path)
					return;
				if (minDepth && path.length < minDepth)
					return;
				if (maxDepth && path.length > maxDepth) {
					var trimedLength = maxDepth - 2;
					if (trimedLength <= 0) {
						return;
					}
					var compressedPath = ArrayFilter(ArrayMap(path, function(a, i, arr) {
						if (i == (arr.length - 1)) {
							return a;
						}
						if (meaninglessItems.indexOf(a) != -1) {
							return 0;
						}
						return a;
					}), function(a, i, arr) {
						if ((i == 0) || (i == (arr.length - 1))) {
							return true;
						}
						if ((a == 0) && (arr[i - 1] == 0)) {
							return false;
						}
						return true;
					});
					var newLength = compressedLength(compressedPath);
					if ((!minDepth || (newLength >= minDepth)) && (newLength <= maxDepth)) {
						ArrayPush(trimedPaths, compressedPath);
					}
					ArrayPush(trimedPaths, path.slice(0, 1).concat([0]).
						concat(path.slice(-trimedLength)));
					ArrayPush(trimedPaths, path.slice(0, trimedLength).
						concat([0, path[path.length - 1]]));
					return;
				}
				ArrayPush(trimedPaths, path);
			});

			var builder = this;
			var penalty = function (a) {
				return ArrayReduce(a, function (acc, i, index) {
					if (index == a.length - 1)
						return acc - 1;
					if (i == 0) 
						return acc;
					if (meaninglessItems.indexOf(i) != -1) 
						return acc + 1;
					var name = builder.decodeDna([i]);
					if (!name)
						return acc;
					if (name.indexOf('@') == -1)
						return acc - 1;
					if (name.indexOf('role') == -1)
						return acc - 3;
					return acc - 6;
				}, 2 * compressedLength(a));
			};

			// console.log("trimedPaths", ArrayMap(trimedPaths, function(a) {
			// 	return [a, penalty(a)];
			// }, this));

			var hashes = {};
			return ArrayFilter(ArrayMap(ArraySort(trimedPaths, function (a, b) {
				return penalty(a) - penalty(b);
			}), function (a) {
				return this.decodeDna(a).toString().replace(/\[1\]/g,"");
			}, this), function(a) {
				if (!hashes[a]) {
					hashes[a] = true;
					return true;
				}
				return false;
			});
		}
	
		this.log('Unique. Start to generate unique set for ' + rootName + leafName + '. [' + minDepth + ', ' + maxDepth + ']');
		var result = document.evaluate(rootName + leafName, evaluateRoot, null, 
			XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
		if (!result) {
			this.log('Unique. Invalid preds search. ' + rootName + leafName);
			return;
		}
	
		var builder = new DnaBuilder();
	
		var item;
		var count = 0, position = -1;
		while (item = result.iterateNext()) {
			builder.addElement(item);
			if (item == el) {
				position = count;
			}
			count++;
			if ((position != -1) && (count > 10)) {
				break;
			}
		}

		if (position == -1) {
			this.log('Unique. Target not found in preds. ' + rootName + leafName);
			return;
		}

		var uniquePath;
		if (count == 1) {
			this.log('Unique. Fully unique ' + rootName + leafName);
			uniquePath = [leafName];
		} else {
			uniquePath = builder.findUniqueSequence(position, root, minDepth, maxDepth);
			if (!uniquePath) {
				this.log('Unique. Cannot generate unique set for ' + rootName + leafName + 
					'. position=' + position + '. count=' + count);
				return;
			}
		}

		// console.log("uniquePath", uniquePath);
		var startedAt = new Date();
		for (var i = 0; i < uniquePath.length; i++) {
			var fullPath = rootName + uniquePath[i];
			var result = document.evaluate(fullPath, root, null, 
				XPathResult.FIRST_ORDERED_NODE_TYPE, null);
			if (!result) {
				this.log('Unique. Cannot check uniqueness ' + fullPath);
				continue;
			}
		
			if (result.singleNodeValue != el) {
				this.log('Unique. Is not unique ' + fullPath);
				if (!getTimeoutExpired(startedAt, 50)) {
					continue;
				}
				this.log('Unique. Break because of timeout');
				break;
			}
		
			return fullPath;
		}
	}
	
	LocatorBuilder.add('xpath:unique', function (e, lastChance, level) {
		var d = new Date();
		var uniquePath = this.addXPathPrefix(this.generateUniqueXPath(e, {
			'minDepth': (level == 0 ? 2: 1)
		} ));
		if (uniquePath) {
			this.log('Unique generated for ' + (new Date() - d) + 'ms.');
			return uniquePath;
		}

		this.log('Failed to generate unique for ' + (new Date() - d) + 'ms.');
	}, LocatorBuilder.SelfVerified)

	LocatorBuilder.prototype.generateLinkXPathes = function(el)  {
		var elementHref = getHrefAttribute(el);
		if (!elementHref) {
			return null;
		}

		var selectors = [];
		var purifiedHref = purifyHref(el);
		var nodeName = this.xpathHtmlElement('a');
		var hash = {};
		var rootPrexix = this.getXPathRoot(el);

		var pushSelector = function(href, contains) {
			if (!!hash[href]) {
				return;
			}
			hash[href] = true;

			var selector;
			if (contains) {
				selector = rootPrexix + nodeName + '[contains(@href, ' + 
					this.attributeValue(href) + ')]';
			} else {
				selector = rootPrexix + nodeName + '[@href=' + 
					this.attributeValue(href) + ']';
			}
			ArrayPush(selectors, selector);
		};

		ArrayForEach(combineHrefGrowth(elementHref), function (part) {
			if ((part != elementHref) && (part != purifiedHref)) {
				pushSelector.call(this, part, true);
			}
		}, this);

		if (purifiedHref) {
			if (purifiedHref == elementHref) {
				pushSelector.call(this, elementHref);
			} else {
				pushSelector.call(this, purifiedHref, true);
			}
		}

		return selectors;
	}

	LocatorBuilder.add('xpath:relative', function (e, lastChance) {
		var current = e
		var testCount = 2;
		while (current && current.parentNode) {
			var parent = current.parentNode;
			if (parent.nodeType == Node.DOCUMENT_FRAGMENT_NODE ||
				parent.nodeType == Node.DOCUMENT_NODE) {
				break;
			}
			if (Node.ELEMENT_NODE == parent.nodeType) {
				if (parent.nodeName.toLowerCase() == "body") {
					break;
				}
	
				if ((parent.nodeName.toLowerCase() == "a") &&
					(hasHrefAttribute(parent)))
				{
					var linkSelectors = this.generateLinkXPathes(parent);
					if (!linkSelectors || !linkSelectors.length) {
						linkSelectors = ["//" + this.xpathHtmlElement(parent)];
					}

					var uniquePath;
					var startedAt = new Date();
					ArrayForEach(linkSelectors, function(linkPath) {
						if (uniquePath || getTimeoutExpired(startedAt, 50)) return;
						uniquePath = this.addXPathPrefix(this.generateUniqueXPath(e, {
							'root': parent, 
							'rootName': linkPath, 
							'minDepth': 1, 'maxDepth': 6
						}));
					}, this);
					if (uniquePath) {
						return uniquePath;
					}
					--testCount;
				}

				if (idIsStatic(parent.getAttribute('id'))) 
				{
					var rootName = this.getXPathRoot(parent) + this.xpathHtmlElement(parent) + 
						"[@id=" + this.attributeValue(parent.getAttribute("id")) + "]";
					var uniquePath = this.addXPathPrefix(this.generateUniqueXPath(e, {
							'root': parent, 
							'rootName': rootName,
							'minDepth': 1, 'maxDepth': 6
						}));
					if (uniquePath) {
						return uniquePath;
					}
					--testCount;
				}

				if (testCount <= 0)
					return;
			}
			current = current.parentNode
		}
	}, LocatorBuilder.AcceptLastChance)

	LocatorBuilder.add('xpath:position', function (e) {
		var selector = this.addXPathPrefix(
			this.generateUniqueXPath(e, {'fullPath': true }));
		if (!!selector) return selector;
		var index;
		var nodeName = this.xpathHtmlElement(e.nodeName.toLowerCase());
		if (e.parentElement === this.rootDocument.body) {
			selector = nodeName;
			index = this.calcXPathIndex(selector, e, this.rootDocument.body, true);
		} else {
			selector = "//" + nodeName;
			index = this.calcXPathIndex(selector, e, this.rootDocument, true);
		}
		if (index < 0) {
			return null;
		}
		if (index > 1) {
			if (selector.indexOf("//") != 0) {
				selector += "[" + index + "]";
			} else {
				selector = "(" + selector + ")[" + index + "]";
			}
		} 
		return this.addXPathPrefix(selector);
	}, LocatorBuilder.AcceptLastChance)

	LocatorBuilder.add('css:finder', function (e, lastChance) {
		if (!this.useCss) return;

		var selectors = [];
		var stages = [
			{ 'minDepth': 1, 'justMatch': true },
			{ 'minDepth': 1, 'justMatch': false },
			{ 'minDepth': 1, 'justMatch': false, 'noIndex': true },
		];

		var startedAt = new Date();
		var uniqueSelectors = {};
		try {
			for (var i = 0; i < stages.length; i++) {
				var finder = new CssLocatorBuilder(e, this.rootDocument, stages[i]);
				var selector = finder.getSelector();
				if (selector && !uniqueSelectors[selector]) {
					ArrayUnshift(selectors, 'css=' + selector);
					uniqueSelectors[selector] = true;
				}
				if (getTimeoutExpired(startedAt, 100)) break;
			}
		} catch(e) {
			this.log(':finder fails with ' + e.message);
		}
		return selectors;
	}, LocatorBuilder.SelfVerifiedLastChance)

	LocatorBuilder.createGroup([ // Type-specific reliable selectors
		'xpath:spanInLabel', 
		'xpath:labelFor', 
		'xpath:ariaLinks', 
		'xpath:sfdc_uiMenu', 
		'*:radio', 
		'xpath:fieldset', 
	]).addFinishers([
		'xpath:text', 
		'css:id', 
		'xpath:inputtype', 
		'xpath:unique',
		'css:id:with-digits', 
	]);

	LocatorBuilder.createGroup([ // Generic non-indexed selectors 
		'css:data-attr', 
		'css:id', 
		'*:name', 
		'xpath:text', 
		'css:data-attr-lowpriority',
		'*:aria-attr', 
		'*:attributes', 
		'xpath:inputtype', 
		'*:attributes_unstable', 
		'css:finder',
		'xpath:relative', 
		'xpath:unique',
		'css:id:with-digits',
	]);

	LocatorBuilder.createGroup([ // Last-chance indexed selectors
		'css:id', 
		'*:name', 
		'xpath:relative', 
		'css:finder',
		'xpath:position', 
	]);

	function window_elementFromPoint(view, x, y, inspectShadowDOM, viewDocument) {
		if (!view) return null;

		if (!viewDocument) {
			try {
				viewDocument = view.contentDocument || view.document;
			} catch (e) {
			}
			if (!viewDocument) return null;
		}

		var element = null;
		try {
			var zoom = getZoom(view);
			x /= zoom; y /= zoom;

			while (true) {
				var tempElement = viewDocument.elementFromPoint(x, y);
				if (!tempElement) 
					break;

				var tempNodeName = (tempElement["nodeName"] || "").toUpperCase();
				if ((tempNodeName == "IFRAME") || (tempNodeName == "FRAME")) {
					attachToFrame(tempElement);
				}

				element = tempElement;
				if (tempNodeName == "WEBVIEW")
					break;
				if (!inspectShadowDOM)
					break;
				var shadowDocument = null;
				try {
					shadowDocument = element.shadowRoot;
				} catch(e) {

				}
				if (!shadowDocument) 
					break;

				if (shadowDocument == viewDocument) 
					break;

				viewDocument = shadowDocument;
			}

			if (element)
			{
				var customControl = getUnifiedControlParent(element.ownerSVGElement || element);
				if (customControl)
					element = customControl;
			}

			while (element) {
				var nodeName = (element.nodeName || "").toUpperCase();
				if (nodeName == "AREA")
					break;
				if (nodeName == "BODY")
					return null;
				if (element.offsetWidth === undefined)
					break;
				if ((element.offsetWidth > 0) && (element.offsetHeight > 0))
					break;
				element = element.parentElement;
			}
		} catch(e) {
		}
		return element;
	}

	var elementFromPointMethodName = "testComplete15_elementFromPoint";

	function attachToFrame(frame) {
		try {
			var contentWindow = frame.contentWindow;
			if (contentWindow) {
				contentWindow[elementFromPointMethodName] = function(x, y, inspectShadowDOM, viewDocument) {
					return window_elementFromPoint(contentWindow, x, y, inspectShadowDOM, viewDocument);
				}
			}
			var contentDocument = frame.contentDocument;
			if (contentDocument) {
				if (contentWindow) {
					contentWindow.testComplete15_FindElement = function (selectors) {
						return element_FindElement(null, contentDocument, selectors);
					}
					contentWindow.testComplete15_FindElementsVisibleWithSimilarRect = function (selectors, width, height) {
						return element_FindElementsVisibleWithSimilarRect(null, contentDocument, selectors, width, height);
					}
				}
				contentDocument.addEventListener('DOMContentLoaded', function() {
					attachToFrames(contentDocument);
				});
				attachToFrames(contentDocument);
			}
		} catch(e) {
		}
	}

	function attachToFrames(frameDocument) {
		ArrayForEach(ArrayFrom(frameDocument.getElementsByTagName("IFRAME")), attachToFrame);
		ArrayForEach(ArrayFrom(frameDocument.getElementsByTagName("FRAME")), attachToFrame);
		TestCompleteWebTestingHelpers.addGetContextTextMethodToDocFrames(frameDocument);
	}

	function attachToWindow(frameWindow) {
		try {
			frameWindow[elementFromPointMethodName] = function(x, y, inspectShadowDOM, viewDocument) {
				return window_elementFromPoint(frameWindow, x, y, inspectShadowDOM, viewDocument);
			}
			frameWindow.document.addEventListener('DOMContentLoaded', function() {
				attachToFrames(frameWindow.document);
			});
			frameWindow["__tc15_WebHelpersLog"] = function (value) { g_LogEnabled = value; };
			frameWindow["__tc15_WebHelpersTimeout"] = function (value) { g_UseTimeouts = value; };
			attachToFrames(frameWindow.document);
		} catch(e) {
		}
	};

	function watchForDocumentTitleChanges() {
		var title = document && document.querySelector && document.querySelector('title');
		if (!title) return;
		if (typeof MutationObserver === "function") {
			new MutationObserver(function(mutations) {
				if (typeof getIocm === "function") {
					var iocm = getIocm();
					if ((typeof iocm === "object") && iocm) {
						var URL = document.location.href;
						if (URL != iocm.lastTitleUpdateURL)
						{
							iocm.lastTitleUpdateURL = document.location.href;
							iocm.context.updateTitle(mutations[0].target.textContent);
						}
					}
				}
			}).observe(
				title, 
				{ subtree: true, characterData: true, childList: true }
			);
		}
	}

	attachToWindow(window);
	watchForDocumentTitleChanges();
	console.log('TestComplete WebHelpers injected correctly!');
};